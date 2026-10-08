import { DOC_TYPES, caseBy, inList } from './doctypes.js';
import { dayAfter } from './documents.js';

const round2 = (v) => Math.round(v * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';

// Ağırlıklı ortalama alış maliyeti (mal kabul + giriş belgelerinden), yoksa kart alış fiyatı.
export function costMap(db) {
  const map = new Map();
  for (const r of db.prepare('SELECT id, buy_price FROM products').all()) map.set(r.id, r.buy_price);
  const rows = db.prepare(
    `SELECT l.product_id, SUM(l.qty * l.price) / SUM(l.qty) AS cost
     FROM document_lines l JOIN documents d ON d.id = l.document_id
     WHERE d.posted = 1 AND d.type IN ('supply', 'enter') AND l.qty > 0 AND l.price > 0
     GROUP BY l.product_id`,
  ).all();
  for (const r of rows) map.set(r.product_id, r.cost);
  return map;
}

function openOrderQty(db, type, closingType, warehouseId) {
  const closed = DOC_TYPES[type].closed;
  const rows = db.prepare(
    `SELECT l.product_id, SUM(l.qty) AS q
     FROM document_lines l JOIN documents d ON d.id = l.document_id
     WHERE d.type = ? AND d.posted = 1
       AND d.status NOT IN (${closed.map(() => '?').join(',')})
       AND NOT EXISTS (SELECT 1 FROM documents c WHERE c.base_id = d.id AND c.type = ? AND c.posted = 1)
       AND (? IS NULL OR d.warehouse_id = ?)
     GROUP BY l.product_id`,
  ).all(type, ...closed, closingType, warehouseId, warehouseId);
  return new Map(rows.map((r) => [r.product_id, r.q]));
}

export function stockReport(db, { warehouse_id = '', q = '', group_id = '', only = '' } = {}) {
  const wh = warehouse_id ? Number(warehouse_id) : null;
  const rows = db.prepare(
    `SELECT p.id, p.name, p.code, p.article, p.barcode, p.unit, p.min_stock, p.sale_price, p.buy_price,
            g.name AS group_name, COALESCE(SUM(m.qty), 0) AS stock
     FROM products p
     LEFT JOIN stock_moves m ON m.product_id = p.id AND ($wh IS NULL OR m.warehouse_id = $wh)
     LEFT JOIN product_groups g ON g.id = p.group_id
     WHERE p.archived = 0 AND p.is_service = 0
       AND ($q = '' OR p.name LIKE $like OR p.code LIKE $like OR p.article LIKE $like OR p.barcode LIKE $like)
       AND ($g IS NULL OR p.group_id = $g)
     GROUP BY p.id ORDER BY p.name`,
  ).all({ wh, q, like: `%${q}%`, g: group_id ? Number(group_id) : null });
  const reserve = openOrderQty(db, 'customerorder', 'demand', wh);
  const expected = openOrderQty(db, 'purchaseorder', 'supply', wh);
  const cost = costMap(db);
  let out = rows.map((r) => {
    const c = cost.get(r.id) ?? 0;
    const reserved = reserve.get(r.id) ?? 0;
    return {
      ...r,
      reserve: reserved,
      expected: expected.get(r.id) ?? 0,
      available: r.stock - reserved,
      cost: round2(c),
      stock_cost: round2(r.stock * c),
      stock_retail: round2(r.stock * r.sale_price),
    };
  });
  if (only === 'positive') out = out.filter((r) => r.stock > 0);
  if (only === 'low') out = out.filter((r) => r.min_stock > 0 && r.stock < r.min_stock);
  if (only === 'negative') out = out.filter((r) => r.stock < 0);
  return out;
}

export function stockByWarehouse(db, productId) {
  return db.prepare(
    `SELECT w.id, w.name, COALESCE(SUM(m.qty), 0) AS stock
     FROM warehouses w LEFT JOIN stock_moves m ON m.warehouse_id = w.id AND m.product_id = ?
     WHERE w.archived = 0 GROUP BY w.id ORDER BY w.name`,
  ).all(productId);
}

export function turnoverReport(db, { from = monthStart(), to = today(), warehouse_id = '' } = {}) {
  return db.prepare(
    `SELECT p.id, p.name, p.code, p.unit,
       SUM(CASE WHEN m.moment < $from THEN m.qty ELSE 0 END) AS opening,
       SUM(CASE WHEN m.moment >= $from AND m.moment < $to AND m.qty > 0 THEN m.qty ELSE 0 END) AS incoming,
       SUM(CASE WHEN m.moment >= $from AND m.moment < $to AND m.qty < 0 THEN -m.qty ELSE 0 END) AS outgoing,
       SUM(CASE WHEN m.moment < $to THEN m.qty ELSE 0 END) AS closing
     FROM products p JOIN stock_moves m ON m.product_id = p.id
     WHERE ($wh IS NULL OR m.warehouse_id = $wh)
     GROUP BY p.id
     HAVING opening != 0 OR incoming != 0 OR outgoing != 0 OR closing != 0
     ORDER BY p.name`,
  ).all({ from, to: dayAfter(to), wh: warehouse_id ? Number(warehouse_id) : null });
}

export function productMoves(db, productId) {
  return db.prepare(
    `SELECT m.doc_id, m.type, m.moment, d.number, w.name AS warehouse, m.qty, m.price
     FROM stock_moves m JOIN documents d ON d.id = m.doc_id LEFT JOIN warehouses w ON w.id = m.warehouse_id
     WHERE m.product_id = ? ORDER BY m.moment DESC, m.doc_id DESC LIMIT 500`,
  ).all(productId);
}

function salesLines(db, from, to) {
  return db.prepare(
    `SELECT l.product_id, p.name AS product, d.counterparty_id, COALESCE(c.name, 'Perakende') AS counterparty,
            l.qty * (${caseBy('sale')}) AS qty, l.qty * l.price * (${caseBy('sale')}) AS revenue
     FROM document_lines l JOIN documents d ON d.id = l.document_id
     JOIN products p ON p.id = l.product_id
     LEFT JOIN counterparties c ON c.id = d.counterparty_id
     WHERE d.posted = 1 AND d.type IN (${inList('sale')}) AND d.moment >= ? AND d.moment < ?`,
  ).all(from, dayAfter(to));
}

export function profitReport(db, { from = monthStart(), to = today(), by = 'product' } = {}) {
  const cost = costMap(db);
  const groups = new Map();
  for (const l of salesLines(db, from, to)) {
    const key = by === 'counterparty' ? (l.counterparty_id ?? 0) : l.product_id;
    const g = groups.get(key) ?? {
      id: key, name: by === 'counterparty' ? l.counterparty : l.product, qty: 0, revenue: 0, cost: 0,
    };
    g.qty += l.qty;
    g.revenue += l.revenue;
    g.cost += l.qty * (cost.get(l.product_id) ?? 0);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => {
      const profit = g.revenue - g.cost;
      return {
        ...g, qty: round2(g.qty), revenue: round2(g.revenue), cost: round2(g.cost), profit: round2(profit),
        margin: g.revenue ? round2((profit / g.revenue) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function settlementsReport(db, { q = '' } = {}) {
  return db.prepare(
    `SELECT c.id, c.name, c.phone, c.roles,
       COALESCE(SUM(d.sum * (${caseBy('settle')})), 0) AS balance,
       MAX(d.moment) AS last_moment
     FROM counterparties c
     LEFT JOIN documents d ON d.counterparty_id = c.id AND d.posted = 1 AND d.type IN (${inList('settle')})
     WHERE c.archived = 0 AND ($q = '' OR c.name LIKE $like)
     GROUP BY c.id ORDER BY ABS(balance) DESC, c.name`,
  ).all({ q, like: `%${q}%` }).map((r) => ({ ...r, balance: round2(r.balance) }));
}

export function counterpartyStatement(db, id) {
  let running = 0;
  return db.prepare(
    `SELECT d.id, d.type, d.number, d.moment, d.sum, d.sum * (${caseBy('settle')}) AS effect
     FROM documents d WHERE d.counterparty_id = ? AND d.posted = 1 AND d.type IN (${inList('settle')})
     ORDER BY d.moment, d.id`,
  ).all(id).map((r) => {
    running += r.effect;
    return { ...r, balance: round2(running) };
  });
}

export function moneyReport(db, { from = monthStart(), to = today() } = {}) {
  const accounts = db.prepare(
    `SELECT d.account, SUM(d.sum * (${caseBy('money')})) AS balance
     FROM documents d WHERE d.posted = 1 AND d.type IN (${inList('money')}) AND d.moment < ?
     GROUP BY d.account ORDER BY d.account`,
  ).all(dayAfter(to)).map((r) => ({ ...r, balance: round2(r.balance) }));
  const p = { from, to: dayAfter(to) };
  const totals = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN (${caseBy('money')}) > 0 THEN d.sum END), 0) AS income,
       COALESCE(SUM(CASE WHEN (${caseBy('money')}) < 0 THEN d.sum END), 0) AS expense
     FROM documents d WHERE d.posted = 1 AND d.type IN (${inList('money')}) AND d.moment >= $from AND d.moment < $to`,
  ).get(p);
  const byCategory = db.prepare(
    `SELECT CASE WHEN d.type = 'retaildemand' THEN 'Perakende satış'
                 WHEN d.category = '' THEN 'Kategorisiz' ELSE d.category END AS category,
            SUM(d.sum * (${caseBy('money')})) AS amount
     FROM documents d WHERE d.posted = 1 AND d.type IN (${inList('money')}) AND d.moment >= $from AND d.moment < $to
     GROUP BY 1 ORDER BY amount DESC`,
  ).all(p).map((r) => ({ ...r, amount: round2(r.amount) }));
  return { accounts, income: round2(totals.income), expense: round2(totals.expense), byCategory };
}

export function dashboard(db) {
  const t = today();
  const ms = monthStart();
  const salesSum = (from, to) => db.prepare(
    `SELECT COALESCE(SUM(d.sum * (${caseBy('sale')})), 0) AS s, COUNT(*) AS n FROM documents d
     WHERE d.posted = 1 AND d.type IN (${inList('sale')}) AND d.moment >= ? AND d.moment < ?`,
  ).get(from, dayAfter(to));
  const profit = profitReport(db, { from: ms, to: t }).reduce((s, r) => s + r.profit, 0);

  const start = new Date(`${t}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const since = start.toISOString().slice(0, 10);
  const daily = new Map(db.prepare(
    `SELECT substr(d.moment, 1, 10) AS day, SUM(d.sum * (${caseBy('sale')})) AS s FROM documents d
     WHERE d.posted = 1 AND d.type IN (${inList('sale')}) AND d.moment >= ? GROUP BY day`,
  ).all(since).map((r) => [r.day, r.s]));
  const series = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    series.push({ day, sum: round2(daily.get(day) ?? 0) });
  }

  const orders = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(sum), 0) AS s FROM documents d
     WHERE d.type = 'customerorder' AND d.posted = 1
       AND d.status NOT IN (${DOC_TYPES.customerorder.closed.map((s) => `'${s}'`).join(',')})`,
  ).get();
  const stock = stockReport(db);
  const settle = settlementsReport(db);
  const money = moneyReport(db, { from: ms, to: t });
  return {
    salesToday: salesSum(t, t),
    salesMonth: salesSum(ms, t),
    profitMonth: round2(profit),
    openOrders: { count: orders.n, sum: round2(orders.s) },
    stockValue: round2(stock.reduce((s, r) => s + Math.max(r.stock, 0) * r.cost, 0)),
    receivables: round2(settle.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0)),
    payables: round2(settle.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0)),
    money: money.accounts,
    series,
    lowStock: stock.filter((r) => r.min_stock > 0 && r.stock < r.min_stock).slice(0, 10),
    topProducts: profitReport(db, { from: ms, to: t }).slice(0, 5),
  };
}
