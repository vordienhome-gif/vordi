import type { DocumentDto, DocumentInput as DocumentSchema, Me } from '@vordi/contracts';
import {
  DOC_TYPES, DomainError, docType, gtinMatches, inventoryAdjustments, isDocType, parseMarkingCode, postDocument,
  WAREHOUSE_DOC_TYPES, type DocType,
} from '@vordi/domain';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db, DbOrTx, Tx } from '../db/index.ts';
import {
  auditLog, barcodes, documentLines, documents, lineCodes, moneyMoves, numberSequences, products, settlementMoves,
  stockMoves, variants,
} from '../db/schema.ts';
import { forbidden, HttpError, notFound } from '../lib/errors.ts';

export type DocumentData = z.output<typeof DocumentSchema>;

const IN_TYPES: DocType[] = ['supply', 'enter', 'salesreturn', 'retailsalesreturn'];
const OUT_TYPES: DocType[] = ['demand', 'retaildemand', 'loss', 'purchasereturn'];

/** Rol bazlı belge yetkisi. Depocu yalnızca depo belgelerini ve kendi depolarını görür. */
export function canWriteDocument(user: Me, type: DocType, warehouseIds: (number | null | undefined)[] = []): boolean {
  if (user.role === 'admin' || user.role === 'manager') return true;
  const own = (ids: (number | null | undefined)[]) =>
    user.warehouseIds.length === 0 || ids.every((w) => w == null || user.warehouseIds.includes(w));
  if (user.role === 'storekeeper') return WAREHOUSE_DOC_TYPES.includes(type) && own(warehouseIds);
  if (user.role === 'cashier') return (type === 'retaildemand' || type === 'retailsalesreturn') && own(warehouseIds);
  return false;
}
export const canReadDocumentType = (user: Me, type: DocType) => canWriteDocument(user, type);

async function nextNumber(tx: Tx, type: DocType): Promise<string> {
  const [row] = await tx
    .insert(numberSequences).values({ type, last: 1 })
    .onConflictDoUpdate({ target: numberSequences.type, set: { last: sql`${numberSequences.last} + 1` } })
    .returning({ last: numberSequences.last });
  return String(row!.last).padStart(5, '0');
}

/** Bir depodaki varyant stokları (işlenmiş hareketlerden). */
export async function stockAt(db: DbOrTx, warehouseId: number, variantIds: number[]): Promise<Map<number, number>> {
  if (!variantIds.length) return new Map();
  const rows = await db
    .select({ variantId: stockMoves.variantId, qty: sql<string>`sum(${stockMoves.qty})` })
    .from(stockMoves)
    .where(and(eq(stockMoves.warehouseId, warehouseId), inArray(stockMoves.variantId, variantIds)))
    .groupBy(stockMoves.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.qty)]));
}

/** Честный знак: kodları ayrıştırır, ürüne ait olduğunu ve durumunu (stokta / çıkmış) kontrol eder. */
async function validateCodes(tx: Tx, type: DocType, data: DocumentData, docId: number) {
  const result: { index: number; codes: { cis: string; raw: string }[] }[] = [];
  const seen = new Set<string>();
  for (const [index, line] of data.lines.entries()) {
    if (!line.codes.length) continue;
    const [v] = await tx
      .select({ markingType: products.markingType, name: products.name })
      .from(variants).innerJoin(products, eq(products.id, variants.productId)).where(eq(variants.id, line.variantId));
    if (!v) throw new HttpError(400, `Модификация ${line.variantId} не найдена`, 'bad_variant');
    if (!v.markingType) throw new HttpError(400, `Товар не маркируется: ${v.name}`, 'not_marked');
    const bcs = (await tx.select().from(barcodes).where(eq(barcodes.variantId, line.variantId))).map((b) => b.barcode);
    const codes = line.codes.map((raw) => {
      const p = parseMarkingCode(raw);
      if (!p) throw new HttpError(400, `Неверный код маркировки: ${raw.slice(0, 40)}`, 'bad_code');
      if (bcs.length && !bcs.some((b) => gtinMatches(b, p.gtin))) throw new HttpError(400, `Код не относится к товару ${v.name} (GTIN ${p.gtin})`, 'code_gtin');
      if (seen.has(p.cis)) throw new HttpError(400, `Код указан дважды: ${p.cis}`, 'code_duplicate');
      seen.add(p.cis);
      return { cis: p.cis, raw: p.raw };
    });
    if (codes.length > line.qty) throw new HttpError(400, `Кодов больше, чем количество: ${v.name}`, 'code_count');
    if (data.posted && (IN_TYPES.includes(type) || OUT_TYPES.includes(type))) {
      for (const c of codes) {
        const [last] = await tx
          .select({ type: documents.type, number: documents.number })
          .from(lineCodes).innerJoin(documents, eq(documents.id, lineCodes.documentId))
          .where(and(eq(lineCodes.cis, c.cis), eq(documents.posted, true), ne(documents.id, docId),
            inArray(documents.type, [...IN_TYPES, ...OUT_TYPES])))
          .orderBy(desc(documents.moment), desc(documents.id)).limit(1);
        const lastOut = last && OUT_TYPES.includes(last.type as DocType);
        if (OUT_TYPES.includes(type) && lastOut) throw new HttpError(409, `Код уже выбыл (${last.number}): ${c.cis}`, 'code_out');
        if (IN_TYPES.includes(type) && last && !lastOut) throw new HttpError(409, `Код уже на складе (${last.number}): ${c.cis}`, 'code_in_stock');
      }
    }
    result.push({ index, codes });
  }
  return result;
}

export async function saveDocument(db: Db, user: Me, data: DocumentData, id?: number): Promise<number> {
  if (!isDocType(data.type)) throw new HttpError(400, 'Неизвестный тип документа');
  const type = data.type;
  const def = docType(type);
  if (!canWriteDocument(user, type, [data.warehouseId, data.targetWarehouseId])) throw forbidden();

  return db.transaction(async (tx) => {
    let number: string;
    if (id) {
      const [existing] = await tx.select().from(documents).where(and(eq(documents.id, id), eq(documents.deleted, false)));
      if (!existing) throw notFound('Документ');
      if (existing.type !== type) throw new HttpError(400, 'Тип документа нельзя изменить');
      if (!canWriteDocument(user, type, [existing.warehouseId, existing.targetWarehouseId])) throw forbidden();
      number = existing.number;
    } else {
      number = await nextNumber(tx, type);
    }

    const lines = def.lines ? data.lines : [];
    if (lines.length) {
      const found = await tx.select({ id: variants.id }).from(variants).where(inArray(variants.id, lines.map((l) => l.variantId)));
      if (found.length !== new Set(lines.map((l) => l.variantId)).size) throw new HttpError(400, 'Модификация не найдена', 'bad_variant');
    }
    // Sayım: beklenen miktar kayıt anındaki stoktur.
    const expected = type === 'inventory' && data.warehouseId ? await stockAt(tx, data.warehouseId, lines.map((l) => l.variantId)) : null;

    const moment = data.moment ?? new Date().toISOString();
    const posting = data.posted
      ? postDocument({ id: id ?? 0, type, moment, warehouseId: data.warehouseId, targetWarehouseId: data.targetWarehouseId,
          counterpartyId: data.counterpartyId, accountId: data.accountId, sum: data.sum, lines })
      : null;
    const sum = posting?.sum ?? (def.lines ? lines.reduce((s, l) => s + Math.round(l.qty * l.price * (1 - l.discount / 100)), 0) : (data.sum ?? 0));

    const values = {
      type, number, moment: new Date(moment), posted: data.posted, status: data.status ?? null,
      warehouseId: def.warehouse ? (data.warehouseId ?? null) : null,
      targetWarehouseId: def.targetWarehouse ? (data.targetWarehouseId ?? null) : null,
      counterpartyId: data.counterpartyId ?? null, accountId: data.accountId ?? null, sum,
      comment: data.comment ?? null, parentId: data.parentId ?? null, updatedAt: new Date(),
    };
    if (id) {
      await tx.update(documents).set(values).where(eq(documents.id, id));
      await tx.delete(documentLines).where(eq(documentLines.documentId, id));
      await clearLedgers(tx, id);
    } else {
      id = (await tx.insert(documents).values({ ...values, createdBy: user.id }).returning({ id: documents.id }))[0]!.id;
    }
    const docId = id;

    const codes = await validateCodes(tx, type, { ...data, lines }, docId);
    const lineIds: number[] = [];
    for (const l of lines) {
      const [row] = await tx.insert(documentLines).values({
        documentId: docId, variantId: l.variantId, qty: l.qty, price: l.price, discount: l.discount,
        expected: expected ? (expected.get(l.variantId) ?? 0) : null,
      }).returning({ id: documentLines.id });
      lineIds.push(row!.id);
    }
    for (const c of codes) {
      for (const code of c.codes) await tx.insert(lineCodes).values({ lineId: lineIds[c.index]!, documentId: docId, ...code });
    }

    if (data.posted) {
      const r = postDocument({ id: docId, type, moment, warehouseId: data.warehouseId, targetWarehouseId: data.targetWarehouseId,
        counterpartyId: data.counterpartyId, accountId: data.accountId, sum: data.sum,
        lines: lines.map((l, i) => ({ ...l, lineId: lineIds[i] })) });
      const m = new Date(moment);
      if (r.stock.length) await tx.insert(stockMoves).values(r.stock.map((s) => ({ ...s, lineId: s.lineId ?? null, moment: m })));
      if (r.settlement.length) await tx.insert(settlementMoves).values(r.settlement.map((s) => ({ ...s, moment: m })));
      if (r.money.length) await tx.insert(moneyMoves).values(r.money.map((s) => ({ ...s, moment: m })));
    }
    await tx.insert(auditLog).values({ employeeId: user.id, action: data.posted ? 'save_posted' : 'save_draft', entity: 'document', entityId: docId, data: { type, number, sum } });
    return docId;
  });
}

async function clearLedgers(tx: DbOrTx, id: number) {
  await tx.delete(stockMoves).where(eq(stockMoves.documentId, id));
  await tx.delete(settlementMoves).where(eq(settlementMoves.documentId, id));
  await tx.delete(moneyMoves).where(eq(moneyMoves.documentId, id));
}

export async function loadDocument(db: DbOrTx, id: number): Promise<DocumentDto> {
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.deleted, false)));
  if (!d) throw notFound('Документ');
  const lines = await db
    .select({ line: documentLines, variantName: variants.name, productName: products.name })
    .from(documentLines)
    .innerJoin(variants, eq(variants.id, documentLines.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(documentLines.documentId, id))
    .orderBy(documentLines.id);
  const codes = await db.select().from(lineCodes).where(eq(lineCodes.documentId, id));
  return {
    id: d.id, type: d.type as DocType, number: d.number, moment: d.moment.toISOString(), posted: d.posted, status: d.status,
    warehouseId: d.warehouseId, targetWarehouseId: d.targetWarehouseId, counterpartyId: d.counterpartyId, accountId: d.accountId,
    sum: d.sum, comment: d.comment, parentId: d.parentId, createdBy: d.createdBy, updatedAt: d.updatedAt.toISOString(),
    lines: lines.map(({ line, variantName, productName }) => ({
      id: line.id, variantId: line.variantId, qty: line.qty, price: line.price, discount: line.discount,
      sum: Math.round(line.qty * line.price * (1 - line.discount / 100)), expected: line.expected,
      codes: codes.filter((c) => c.lineId === line.id).map((c) => c.raw), variantName, productName,
    })),
  };
}

/** Mevcut belgeyi aynı içerikle yeniden kaydeder; yalnızca "işlendi" durumu değişir. */
export async function setPosted(db: Db, user: Me, id: number, posted: boolean) {
  const d = await loadDocument(db, id);
  await saveDocument(db, user, toInput(d, { posted }), id);
}

export function toInput(d: DocumentDto, patch: Partial<DocumentData> = {}): DocumentData {
  return {
    type: d.type, moment: d.moment, warehouseId: d.warehouseId, targetWarehouseId: d.targetWarehouseId,
    counterpartyId: d.counterpartyId, accountId: d.accountId, sum: d.sum, status: d.status, comment: d.comment,
    parentId: d.parentId, posted: d.posted,
    lines: d.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, price: l.price, discount: l.discount, codes: l.codes })),
    ...patch,
  };
}

export async function deleteDocument(db: Db, user: Me, id: number) {
  const d = await loadDocument(db, id);
  if (!canWriteDocument(user, d.type, [d.warehouseId, d.targetWarehouseId])) throw forbidden();
  await db.transaction(async (tx) => {
    await clearLedgers(tx, id);
    await tx.update(documents).set({ deleted: true, posted: false, updatedAt: new Date() }).where(eq(documents.id, id));
    await tx.insert(auditLog).values({ employeeId: user.id, action: 'delete', entity: 'document', entityId: id, data: { type: d.type, number: d.number } });
  });
}

/** Sayım sonucunu uygular: fazlalar için Оприходование, eksikler için Списание (işlenmiş, sayıma bağlı). */
export async function applyInventory(db: Db, user: Me, id: number) {
  const inv = await loadDocument(db, id);
  if (inv.type !== 'inventory') throw new HttpError(400, 'Это не инвентаризация');
  if (!inv.warehouseId) throw new DomainError('Не указан склад');
  const children = await db.select({ id: documents.id }).from(documents)
    .where(and(eq(documents.parentId, id), eq(documents.deleted, false), inArray(documents.type, ['enter', 'loss'])));
  if (children.length) throw new HttpError(409, 'Инвентаризация уже применена', 'already_applied');

  const costs = new Map((await db.select({ id: variants.id, buyPrice: products.buyPrice }).from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(variants.id, inv.lines.length ? inv.lines.map((l) => l.variantId) : [0]))).map((r) => [r.id, r.buyPrice]));
  const adj = inventoryAdjustments(inv.lines.map((l) => ({ variantId: l.variantId, expected: l.expected ?? 0, counted: l.qty, price: costs.get(l.variantId) ?? 0 })));

  const make = async (type: 'enter' | 'loss', lines: typeof adj.enter) =>
    lines.length
      ? loadDocument(db, await saveDocument(db, user, {
          type, posted: true, warehouseId: inv.warehouseId, parentId: id, comment: `По инвентаризации № ${inv.number}`,
          lines: lines.map((l) => ({ ...l, discount: 0, codes: [] })),
        }))
      : null;
  return { enter: await make('enter', adj.enter), loss: await make('loss', adj.loss) };
}

export const DOC_TYPE_LIST = Object.entries(DOC_TYPES).map(([key, d]) => ({ key, ...d }));
