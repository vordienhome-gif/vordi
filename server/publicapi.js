// İnternet mağazası ve dış sistemler için token korumalı REST API (/api/v1).
import { createHash, randomBytes } from 'node:crypto';
import { HttpError, saveDocument } from './documents.js';
import { stockReport } from './reports.js';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

export function createToken(db, name) {
  if (!String(name ?? '').trim()) throw new HttpError(400, 'Ad alanı zorunludur');
  const token = 'vrd_' + randomBytes(24).toString('hex');
  const r = db.prepare('INSERT INTO api_tokens (name, token_hash) VALUES (?, ?)').run(String(name).trim(), sha(token));
  return { id: Number(r.lastInsertRowid), name, token };
}

export function tokenUser(db, header) {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  if (!m) return null;
  const row = db.prepare('SELECT id, name FROM api_tokens WHERE token_hash = ?').get(sha(m[1]));
  if (!row) return null;
  db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  return { id: null, name: `API: ${row.name}`, role: 'api', token_id: row.id };
}

const STATUS_CODE = {
  Yeni: 'new', Onaylandı: 'confirmed', Toplanıyor: 'picking', 'Sevk edildi': 'shipped', 'Teslim edildi': 'delivered', İptal: 'cancelled',
};
const settingsOf = (db) => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
const shopWarehouse = (db) => {
  const id = Number(settingsOf(db).shop_warehouse_id);
  if (id && db.prepare('SELECT 1 FROM warehouses WHERE id = ? AND archived = 0').get(id)) return id;
  return db.prepare('SELECT id FROM warehouses WHERE archived = 0 ORDER BY id LIMIT 1').get()?.id;
};

export function apiProducts(db, { warehouse_id = '' } = {}) {
  const stock = new Map(stockReport(db, { warehouse_id }).map((r) => [r.id, r]));
  return db.prepare(
    `SELECT p.id, p.name, p.code, p.article, p.barcode, p.unit, p.sale_price AS price, p.vat, p.is_service,
            g.name AS group_name, p.description
     FROM products p LEFT JOIN product_groups g ON g.id = p.group_id WHERE p.archived = 0 ORDER BY p.name`,
  ).all().map((p) => {
    const s = stock.get(p.id);
    return { ...p, is_service: !!p.is_service, stock: s ? s.stock : null, available: s ? s.available : null };
  });
}

function findProduct(db, item) {
  if (item.product_id) return db.prepare('SELECT * FROM products WHERE id = ? AND archived = 0').get(Number(item.product_id));
  for (const col of ['code', 'article', 'barcode']) {
    const v = String(item[col] ?? '').trim();
    if (v) return db.prepare(`SELECT * FROM products WHERE ${col} = ? AND archived = 0 LIMIT 1`).get(v);
  }
  return null;
}

export function findOrCreateCustomer(db, c = {}) {
  const name = String(c.name ?? '').trim();
  const email = String(c.email ?? '').trim().toLowerCase();
  const phone = String(c.phone ?? '').replace(/[^\d+]/g, '');
  if (email) {
    const r = db.prepare('SELECT id FROM counterparties WHERE lower(email) = ? LIMIT 1').get(email);
    if (r) return r.id;
  }
  if (phone) {
    const rows = db.prepare("SELECT id, phone FROM counterparties WHERE phone != ''").all();
    const r = rows.find((x) => x.phone.replace(/[^\d+]/g, '') === phone);
    if (r) return r.id;
  }
  if (!name) throw new HttpError(400, 'Müşteri adı zorunludur');
  return Number(db.prepare(
    "INSERT INTO counterparties (name, kind, roles, phone, email, address, comment) VALUES (?, 'person', 'customer', ?, ?, ?, ?)",
  ).run(name, String(c.phone ?? ''), email, String(c.address ?? ''), 'İnternet mağazası').lastInsertRowid);
}

function orderView(db, doc) {
  const shipped = db.prepare("SELECT 1 FROM documents WHERE base_id = ? AND type = 'demand' AND posted = 1").get(doc.id);
  return {
    id: doc.id, external_id: doc.external_id, number: doc.number, moment: doc.moment,
    status: STATUS_CODE[doc.status] ?? doc.status, sum: doc.sum, shipped: !!shipped,
  };
}

function getOrder(db, externalId) {
  const doc = db.prepare("SELECT * FROM documents WHERE type = 'customerorder' AND external_id = ?").get(String(externalId));
  if (!doc) throw new HttpError(404, 'Sipariş bulunamadı');
  return doc;
}

export function apiCreateOrder(db, body, user) {
  const externalId = String(body.external_id ?? '').trim();
  if (!externalId) throw new HttpError(400, 'external_id zorunludur');
  const existing = db.prepare("SELECT * FROM documents WHERE type = 'customerorder' AND external_id = ?").get(externalId);
  if (existing) return { created: false, order: orderView(db, existing) };
  if (!Array.isArray(body.items) || !body.items.length) throw new HttpError(400, 'Sipariş kalemleri boş');
  const lines = body.items.map((it) => {
    const p = findProduct(db, it);
    if (!p) throw new HttpError(400, `Ürün bulunamadı: ${it.code ?? it.article ?? it.barcode ?? it.product_id ?? ''}`);
    return { product_id: p.id, qty: Number(it.qty ?? it.quantity ?? 1), price: it.price != null ? Number(it.price) : p.sale_price, vat: p.vat };
  });
  const doc = saveDocument(db, {
    type: 'customerorder',
    counterparty_id: findOrCreateCustomer(db, body.customer),
    warehouse_id: shopWarehouse(db),
    comment: [`İnternet mağazası #${externalId}`, body.comment].filter(Boolean).join('\n'),
    lines,
  }, user?.id ?? null);
  try {
    db.prepare('UPDATE documents SET external_id = ? WHERE id = ?').run(externalId, doc.id);
  } catch (e) {
    // Aynı external_id ile eşzamanlı istek: ikinci kaydı geri al.
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
    return { created: false, order: orderView(db, getOrder(db, externalId)) };
  }
  return { created: true, order: orderView(db, getOrder(db, externalId)) };
}

export const publicRoutes = [
  ['GET', '/api/v1/products', ({ db, query }) => apiProducts(db, query)],
  ['GET', '/api/v1/stock', ({ db, query }) => stockReport(db, query).map((r) => ({
    id: r.id, code: r.code, article: r.article, barcode: r.barcode, stock: r.stock, reserve: r.reserve, available: r.available,
  }))],
  ['GET', '/api/v1/warehouses', ({ db }) => db.prepare('SELECT id, name, address FROM warehouses WHERE archived = 0').all()],
  ['POST', '/api/v1/orders', ({ db, body, user }) => apiCreateOrder(db, body, user)],
  ['GET', '/api/v1/orders/:external_id', ({ db, params }) => orderView(db, getOrder(db, params.external_id))],
  ['POST', '/api/v1/orders/:external_id/cancel', ({ db, params }) => {
    const doc = getOrder(db, params.external_id);
    if (orderView(db, doc).shipped) throw new HttpError(400, 'Sevk edilmiş sipariş iptal edilemez');
    db.prepare("UPDATE documents SET status = 'İptal', updated_at = datetime('now') WHERE id = ?").run(doc.id);
    return orderView(db, getOrder(db, params.external_id));
  }],
];
