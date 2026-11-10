import type { Product, Variant } from '@vordi/contracts';
import { and, eq, ilike, inArray, notInArray, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/index.ts';
import { barcodes, prices, products, variants } from '../db/schema.ts';
import { HttpError, notFound } from '../lib/errors.ts';
import type { z } from 'zod';
import type { ProductInput as ProductSchema } from '@vordi/contracts';

type ProductData = z.output<typeof ProductSchema>;

/** Modifikasyon adı МойСклад'daki gibi özelliklerden oluşur: "M / Синий". */
export const variantName = (ch: Record<string, string>) => Object.values(ch).filter(Boolean).join(' / ');

export async function loadProducts(db: DbOrTx, ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const vrows = await db.select().from(variants).where(and(inArray(variants.productId, ids), eq(variants.archived, false))).orderBy(variants.id);
  const vids = vrows.map((v) => v.id);
  const brows = vids.length ? await db.select().from(barcodes).where(inArray(barcodes.variantId, vids)) : [];
  const prows = vids.length ? await db.select().from(prices).where(inArray(prices.variantId, vids)) : [];

  const vmap = new Map<number, Variant[]>();
  for (const v of vrows) {
    const variant: Variant = {
      id: v.id, productId: v.productId, name: v.name, characteristics: v.characteristics, code: v.code,
      barcodes: brows.filter((b) => b.variantId === v.id).map((b) => b.barcode),
      prices: Object.fromEntries(prows.filter((p) => p.variantId === v.id).map((p) => [String(p.priceTypeId), p.value])),
    };
    vmap.set(v.productId, [...(vmap.get(v.productId) ?? []), variant]);
  }
  const byId = new Map(rows.map((p) => [p.id, { ...p, variants: vmap.get(p.id) ?? [] } as Product]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
}

export async function loadProduct(db: DbOrTx, id: number): Promise<Product> {
  const [p] = await loadProducts(db, [id]);
  if (!p) throw notFound('Товар');
  return p;
}

export async function searchProducts(db: DbOrTx, q: { search?: string; limit: number; offset: number }) {
  const s = q.search?.trim();
  const where = and(
    eq(products.archived, false),
    s
      ? or(
          ilike(products.name, `%${s}%`), ilike(products.article, `%${s}%`), eq(products.code, s),
          sql`exists (select 1 from ${variants} v join ${barcodes} b on b.variant_id = v.id where v.product_id = ${products.id} and b.barcode = ${s})`,
        )
      : undefined,
  );
  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(where);
  const ids = (await db.select({ id: products.id }).from(products).where(where).orderBy(products.name).limit(q.limit).offset(q.offset)).map((r) => r.id);
  return { rows: await loadProducts(db, ids), total };
}

export async function saveProduct(tx: DbOrTx, input: ProductData, id?: number): Promise<number> {
  const values = {
    name: input.name, article: input.article ?? null, code: input.code || null, folderId: input.folderId ?? null,
    unit: input.unit, vat: input.vat, isService: input.isService, markingType: input.markingType, buyPrice: input.buyPrice,
    minStock: input.minStock, description: input.description ?? null, attributes: input.attributes, archived: input.archived,
  };
  if (id) {
    const res = await tx.update(products).set(values).where(eq(products.id, id)).returning({ id: products.id });
    if (!res.length) throw notFound('Товар');
  } else {
    id = (await tx.insert(products).values(values).returning({ id: products.id }))[0]!.id;
  }

  const keep: number[] = [];
  for (const v of input.variants) {
    const vals = { productId: id, name: variantName(v.characteristics), characteristics: v.characteristics, code: v.code ?? null, archived: false };
    let vid = v.id;
    if (vid) {
      const res = await tx.update(variants).set(vals).where(and(eq(variants.id, vid), eq(variants.productId, id))).returning({ id: variants.id });
      if (!res.length) throw new HttpError(400, `Модификация ${vid} не принадлежит товару`, 'bad_variant');
    } else {
      vid = (await tx.insert(variants).values(vals).returning({ id: variants.id }))[0]!.id;
    }
    keep.push(vid);

    await tx.delete(barcodes).where(eq(barcodes.variantId, vid));
    for (const code of new Set(v.barcodes)) {
      const [taken] = await tx.select().from(barcodes).where(eq(barcodes.barcode, code));
      if (taken) throw new HttpError(409, `Штрихкод ${code} уже используется`, 'barcode_taken');
      await tx.insert(barcodes).values({ barcode: code, variantId: vid });
    }
    await tx.delete(prices).where(eq(prices.variantId, vid));
    const priceRows = Object.entries(v.prices).map(([pt, value]) => ({ variantId: vid!, priceTypeId: Number(pt), value }));
    if (priceRows.length) await tx.insert(prices).values(priceRows);
  }
  // Belgelerde kullanılmış olabileceği için silinmez, arşivlenir.
  await tx.update(variants).set({ archived: true }).where(and(eq(variants.productId, id), notInArray(variants.id, keep)));
  return id;
}

