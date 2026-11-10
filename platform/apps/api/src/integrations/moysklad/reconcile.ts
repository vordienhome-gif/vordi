/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.ts';
import { counterparties, externalRefs, products, settlementMoves, stockMoves, variants, warehouses } from '../../db/schema.ts';
import { stockReport } from '../../services/reports.ts';
import type { MsClient } from './client.ts';
import { idOf, kop } from './mapping.ts';

type Ms = Record<string, any>;

export interface StockDiff { product: string; variant: string; warehouse: string; moysklad: number; vordi: number }
export interface BalanceDiff { counterparty: string; moysklad: number; vordi: number }

export interface ReconcileResult {
  stock: { compared: number; matched: number; diffs: StockDiff[]; archivedSkipped: number };
  reserve: { compared: number; matched: number; diffs: StockDiff[] };
  balances: { compared: number; matched: number; diffs: BalanceDiff[]; signFlipped: boolean };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * İki sistemi karşılaştırır: depo bazında stok ve rezerv (МойСклад "Остатки по складам" raporu)
 * ve cari bakiyeleri ("Взаиморасчёты" raporu). Farklar ürün/depo/cari adıyla listelenir.
 */
export async function reconcileMoySklad(db: Db, ms: MsClient): Promise<ReconcileResult> {
  const refRows = await db.select().from(externalRefs).where(eq(externalRefs.source, 'moysklad'));
  const ref = new Map(refRows.map((r) => [`${r.entity}:${r.externalId}`, r.localId]));

  // Vordi tarafı
  const ourStock = new Map<string, number>();
  for (const r of await db.select({ v: stockMoves.variantId, w: stockMoves.warehouseId, q: sql<string>`sum(${stockMoves.qty})` })
    .from(stockMoves).groupBy(stockMoves.variantId, stockMoves.warehouseId)) ourStock.set(`${r.v}:${r.w}`, Number(r.q));
  const ourReserve = new Map<string, number>();
  for (const r of await stockReport(db, {})) if (r.reserve) ourReserve.set(`${r.variantId}:${r.warehouseId}`, r.reserve);

  // Ürünün "ana" varyantı (modifikasyonlu üründe arşivde tutulur) ürün düzeyindeki stoktur; arşiv sayılmaz.
  const defaultVariants = new Set(refRows.filter((r) => r.entity === 'product-default-variant').map((r) => r.localId));
  const names = new Map((await db.select({ id: variants.id, p: products.name, v: variants.name, pa: products.archived, va: variants.archived, service: products.isService })
    .from(variants).innerJoin(products, eq(products.id, variants.productId)))
    .map((r) => [r.id, { ...r, archived: r.pa || (r.va && !defaultVariants.has(r.id)) }]));
  // МойСклад stok raporları arşivdeki ürünleri hiç göstermez; bunlar ayrı sayılır.
  let archivedSkipped = 0;
  for (const k of [...ourStock.keys()]) {
    const n = names.get(Number(k.split(':')[0]));
    if (n?.archived || n?.service) { ourStock.delete(k); ourReserve.delete(k); if (n.archived) archivedSkipped++; }
  }
  const whNames = new Map((await db.select().from(warehouses)).map((w) => [w.id, w.name]));
  const label = (variantId: number, warehouseId: number) => ({
    product: names.get(variantId)?.p ?? `#${variantId}`, variant: names.get(variantId)?.v ?? '', warehouse: whNames.get(warehouseId) ?? `#${warehouseId}`,
  });

  // МойСклад tarafı
  const msStock = new Map<string, number>();
  const msReserve = new Map<string, number>();
  for await (const page of ms.listAll<Ms>('/report/stock/bystore')) {
    for (const row of page) {
      const variantId = ref.get(`assortment:${idOf(row as { meta: { href: string } })}`);
      if (!variantId) continue;
      for (const s of row.stockByStore ?? []) {
        const warehouseId = ref.get(`store:${idOf(s)}`);
        if (!warehouseId) continue;
        const k = `${variantId}:${warehouseId}`;
        if (Number(s.stock)) msStock.set(k, Number(s.stock));
        if (Number(s.reserve)) msReserve.set(k, Number(s.reserve));
      }
    }
  }

  const compare = (a: Map<string, number>, b: Map<string, number>) => {
    const keys = new Set([...a.keys(), ...b.keys()]);
    const diffs: StockDiff[] = [];
    for (const k of keys) {
      const x = a.get(k) ?? 0;
      const y = b.get(k) ?? 0;
      if (!near(x, y)) {
        const [v, w] = k.split(':').map(Number) as [number, number];
        diffs.push({ ...label(v, w), moysklad: x, vordi: y });
      }
    }
    diffs.sort((p, q) => Math.abs(q.moysklad - q.vordi) - Math.abs(p.moysklad - p.vordi));
    return { compared: keys.size, matched: keys.size - diffs.length, diffs };
  };

  // Cari bakiyeleri
  const ours = new Map<number, number>();
  for (const r of await db.select({ c: settlementMoves.counterpartyId, s: sql<string>`sum(${settlementMoves.amount})` })
    .from(settlementMoves).groupBy(settlementMoves.counterpartyId)) ours.set(r.c, Number(r.s));
  const cpNames = new Map((await db.select({ id: counterparties.id, name: counterparties.name }).from(counterparties)).map((c) => [c.id, c.name]));
  const theirs = new Map<number, number>();
  for await (const page of ms.listAll<Ms>('/report/counterparty')) {
    for (const row of page) {
      const id = ref.get(`counterparty:${idOf(row.counterparty)}`);
      if (id && kop(row.balance)) theirs.set(id, kop(row.balance));
    }
  }
  // МойСклад raporunda işaret yönü bizimkinin tersi olabilir; hangisi daha çok eşleşiyorsa o kullanılır.
  const score = (sign: number) => [...new Set([...ours.keys(), ...theirs.keys()])].filter((k) => (ours.get(k) ?? 0) === sign * (theirs.get(k) ?? 0)).length;
  const sign = score(-1) > score(1) ? -1 : 1;
  const keys = new Set([...ours.keys(), ...theirs.keys()]);
  const balanceDiffs: BalanceDiff[] = [];
  for (const k of keys) {
    const x = sign * (theirs.get(k) ?? 0);
    const y = ours.get(k) ?? 0;
    if (Math.abs(x - y) > 1) balanceDiffs.push({ counterparty: cpNames.get(k) ?? `#${k}`, moysklad: x, vordi: y });
  }

  return {
    stock: { ...compare(msStock, ourStock), archivedSkipped },
    reserve: compare(msReserve, ourReserve),
    balances: { compared: keys.size, matched: keys.size - balanceDiffs.length, diffs: balanceDiffs, signFlipped: sign === -1 },
  };
}

