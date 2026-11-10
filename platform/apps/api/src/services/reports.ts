import type { StockRow } from '@vordi/contracts';
import { runFifo, type FifoMove } from '@vordi/domain';
import { and, asc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/index.ts';
import { counterparties, documentLines, documents, products, settlementMoves, stockMoves, variants } from '../db/schema.ts';

/**
 * FIFO'yu tüm stok hareketleri üzerinden çalıştırır (transferler hariç: maliyeti değiştirmezler).
 * Not: ürün ve hareket sayısı büyüdüğünde dönem sonu maliyet anlık görüntüleri (snapshot) ile hızlandırılacak.
 */
async function fifo(db: DbOrTx, until?: Date) {
  const rows = await db
    .select({ id: stockMoves.id, variantId: stockMoves.variantId, qty: stockMoves.qty, unitCost: stockMoves.unitCost })
    .from(stockMoves).innerJoin(documents, eq(documents.id, stockMoves.documentId))
    .where(and(ne(documents.type, 'move'), until ? lte(stockMoves.moment, until) : undefined))
    .orderBy(asc(stockMoves.moment), asc(stockMoves.id));
  return runFifo(rows.map<FifoMove>((r) => ({ key: r.id, variantId: r.variantId, qty: r.qty, unitCost: r.unitCost })));
}

/** Остатки: stok, rezerv, beklenen, kullanılabilir ve FIFO maliyet değeri. */
export async function stockReport(db: DbOrTx, q: { warehouseId?: number; search?: string; warehouseIds?: number[] }): Promise<StockRow[]> {
  const whFilter = q.warehouseId ? [q.warehouseId] : q.warehouseIds?.length ? q.warehouseIds : null;
  const stock = await db
    .select({ variantId: stockMoves.variantId, warehouseId: stockMoves.warehouseId, qty: sql<string>`sum(${stockMoves.qty})` })
    .from(stockMoves)
    .where(whFilter ? inArray(stockMoves.warehouseId, whFilter) : undefined)
    .groupBy(stockMoves.variantId, stockMoves.warehouseId);

  // Rezerv: işlenmiş, kapanmamış müşteri siparişlerinde ayrılan miktar (satırda rezerv yoksa tamamı) − bu siparişe bağlı işlenmiş sevkiyatlar.
  const pending = async (orderType: 'customerorder' | 'purchaseorder', childType: 'demand' | 'supply') => {
    // Satır başına: kalan rezerv = rezerv (yoksa miktar) − teslim edilen (satırda yoksa bağlı sevkiyat/perakende satışlardan).
    const res = (await db.execute(sql`
      select l.variant_id, o.warehouse_id, sum(greatest(coalesce(l.reserve, l.qty) - coalesce(l.shipped, (
        select sum(cl.qty) from ${documentLines} cl join ${documents} c on c.id = cl.document_id
        where c.parent_id = o.id and c.type in (${childType}, 'retaildemand') and c.posted and not c.deleted and cl.variant_id = l.variant_id
      ), 0), 0)) as qty
      from ${documents} o join ${documentLines} l on l.document_id = o.id
      where o.type = ${orderType} and o.posted and not o.deleted and not o.closed and coalesce(o.status, '') not in ('cancelled', 'delivered', 'closed')
      group by o.warehouse_id, l.variant_id`)) as unknown as { rows: { variant_id: number; warehouse_id: number; qty: string }[] };
    const m = new Map<string, number>();
    for (const r of res.rows) m.set(`${r.variant_id}:${r.warehouse_id}`, (m.get(`${r.variant_id}:${r.warehouse_id}`) ?? 0) + Number(r.qty));
    return m;
  };
  const reserve = await pending('customerorder', 'demand');
  const expected = await pending('purchaseorder', 'supply');

  const keys = new Set([...stock.map((s) => `${s.variantId}:${s.warehouseId}`), ...reserve.keys(), ...expected.keys()]);
  const variantIds = [...new Set([...keys].map((k) => Number(k.split(':')[0])))];
  if (!variantIds.length) return [];
  const s = q.search?.trim();
  const info = await db
    .select({ variantId: variants.id, productId: products.id, productName: products.name, variantName: variants.name, article: products.article })
    .from(variants).innerJoin(products, eq(products.id, variants.productId))
    .where(and(inArray(variants.id, variantIds), s ? or(ilike(products.name, `%${s}%`), ilike(products.article, `%${s}%`)) : undefined));
  const byVariant = new Map(info.map((i) => [i.variantId, i]));
  const { remaining } = await fifo(db);
  const stockMap = new Map(stock.map((r) => [`${r.variantId}:${r.warehouseId}`, Number(r.qty)]));

  const rows: StockRow[] = [];
  for (const k of keys) {
    const [variantId, warehouseId] = k.split(':').map(Number) as [number, number];
    const meta = byVariant.get(variantId);
    if (!meta) continue;
    if (whFilter && !whFilter.includes(warehouseId)) continue;
    const qty = stockMap.get(k) ?? 0;
    const res = reserve.get(k) ?? 0;
    const rest = remaining.get(variantId);
    const unit = rest && rest.qty > 0 ? rest.value / rest.qty : 0;
    rows.push({ ...meta, warehouseId, stock: qty, reserve: res, expected: expected.get(k) ?? 0,
      available: Math.round((qty - res) * 1000) / 1000, costValue: Math.round(Math.max(qty, 0) * unit) });
  }
  return rows.sort((a, b) => a.productName.localeCompare(b.productName, 'ru') || a.variantName.localeCompare(b.variantName, 'ru'));
}

/** Взаиморасчёты: + cari bize borçlu, − biz cariye borçluyuz. */
export async function settlementReport(db: DbOrTx) {
  const rows = await db
    .select({ counterpartyId: settlementMoves.counterpartyId, name: counterparties.name, balance: sql<string>`sum(${settlementMoves.amount})` })
    .from(settlementMoves).innerJoin(counterparties, eq(counterparties.id, settlementMoves.counterpartyId))
    .groupBy(settlementMoves.counterpartyId, counterparties.name).orderBy(counterparties.name);
  return rows.map((r) => ({ ...r, balance: Number(r.balance) })).filter((r) => r.balance !== 0);
}

/** Прибыльность: satış geliri − FIFO maliyet, varyant bazında. */
export async function profitReport(db: DbOrTx, q: { from?: string; to?: string }) {
  const to = q.to ? new Date(q.to) : undefined;
  const { costs } = await fifo(db, to);
  const SIGN: Record<string, number> = { demand: 1, retaildemand: 1, salesreturn: -1, retailsalesreturn: -1 };
  const rows = await db
    .select({ moveId: stockMoves.id, type: documents.type, variantId: documentLines.variantId, qty: documentLines.qty,
      price: documentLines.price, discount: documentLines.discount, productName: products.name, variantName: variants.name })
    .from(stockMoves)
    .innerJoin(documents, eq(documents.id, stockMoves.documentId))
    .innerJoin(documentLines, eq(documentLines.id, stockMoves.lineId))
    .innerJoin(variants, eq(variants.id, documentLines.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(inArray(documents.type, Object.keys(SIGN)),
      q.from ? gte(stockMoves.moment, new Date(q.from)) : undefined, to ? lte(stockMoves.moment, to) : undefined));

  const agg = new Map<number, { variantId: number; productName: string; variantName: string; qty: number; revenue: number; cost: number; profit: number; estimated: boolean }>();
  for (const r of rows) {
    const sign = SIGN[r.type]!;
    const a = agg.get(r.variantId) ?? { variantId: r.variantId, productName: r.productName, variantName: r.variantName, qty: 0, revenue: 0, cost: 0, profit: 0, estimated: false };
    const c = costs.get(r.moveId);
    a.qty += sign * r.qty;
    a.revenue += sign * Math.round(r.qty * r.price * (1 - r.discount / 100));
    a.cost += c?.cost ?? 0; // iade girişlerinde maliyet zaten negatif
    a.estimated ||= c?.estimated ?? false;
    a.profit = a.revenue - a.cost;
    agg.set(r.variantId, a);
  }
  return [...agg.values()].sort((a, b) => b.profit - a.profit);
}
