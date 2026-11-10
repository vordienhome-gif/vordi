/* eslint-disable @typescript-eslint/no-explicit-any */
import { DomainError, docType, parseMarkingCode, postDocument, type DocType } from '@vordi/domain';
import { and, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db, DbOrTx } from '../../db/index.ts';
import {
  accounts, barcodes, counterparties, currencies, documentLines, documents, employees, externalRefs, folders, lineCodes,
  numberSequences, organizations, priceTypes, prices, products, retailPoints, variants, warehouses,
} from '../../db/schema.ts';
import { hashPassword } from '../../lib/auth.ts';
import { clearLedgers, writeLedgers } from '../../services/documents.ts';
import { variantName } from '../../services/catalog.ts';
import type { MsClient } from './client.ts';
import {
  attributesOf, barcodesOf, counterpartyKind, idOf, kop, markingOf, msMoment, MS_DOCUMENT_TYPES, toRubKopeks, typeOf,
} from './mapping.ts';

type Ms = Record<string, any>;
const SOURCE = 'moysklad';

export interface ImportLog {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

export interface ImportSummary {
  counts: Record<string, number>;
  /** Uyarı türüne göre sayılar (ör. bulunamayan ürün, işlenemeyen belge). */
  warnings: Record<string, number>;
  /** İlk birkaç uyarının ayrıntısı (kişisel veri içermez). */
  samples: string[];
}

/**
 * МойСклад'daki her şeyi Vordi'ye aktarır. Tekrar çalıştırılabilir:
 * daha önce aktarılan kayıtlar `external_refs` üzerinden bulunur ve güncellenir, kopya oluşmaz.
 */
export async function importMoySklad(db: Db, ms: MsClient, log: ImportLog, opts: { documents?: boolean; types?: string[] } = {}): Promise<ImportSummary> {
  const summary: ImportSummary = { counts: {}, warnings: {}, samples: [] };
  const count = (k: string, n = 1) => { summary.counts[k] = (summary.counts[k] ?? 0) + n; };
  const warn = (kind: string, detail: string) => {
    summary.warnings[kind] = (summary.warnings[kind] ?? 0) + 1;
    if (summary.samples.length < 50) summary.samples.push(`${kind}: ${detail}`);
  };

  // — Eşleştirme önbelleği
  const refs = new Map<string, Map<string, number>>();
  for (const r of await db.select().from(externalRefs).where(eq(externalRefs.source, SOURCE))) {
    if (!refs.has(r.entity)) refs.set(r.entity, new Map());
    refs.get(r.entity)!.set(r.externalId, r.localId);
  }
  const ref = (entity: string, id: string | null | undefined) => (id ? refs.get(entity)?.get(id) ?? null : null);
  const setRef = async (tx: DbOrTx, entity: string, id: string, localId: number) => {
    if (!refs.has(entity)) refs.set(entity, new Map());
    refs.get(entity)!.set(id, localId);
    await tx.insert(externalRefs).values({ source: SOURCE, entity, externalId: id, localId })
      .onConflictDoUpdate({ target: [externalRefs.source, externalRefs.entity, externalRefs.externalId], set: { localId, updatedAt: new Date() } });
  };
  /** Kayıt varsa günceller, yoksa ekler; yerel kimliği döndürür. */
  async function upsert<T extends { id: number }>(tx: DbOrTx, entity: string, msId: string, table: any, values: Record<string, unknown>): Promise<number> {
    const existing = ref(entity, msId);
    if (existing) {
      const res = (await tx.update(table).set(values).where(eq(table.id, existing)).returning({ id: table.id })) as T[];
      if (res.length) return existing;
    }
    const [row] = (await tx.insert(table).values(values).returning({ id: table.id })) as T[];
    await setRef(tx, entity, msId, row!.id);
    return row!.id;
  }
  const all = async (path: string, query: Record<string, string | number> = {}) => {
    const out: Ms[] = [];
    for await (const page of ms.listAll<Ms>(path, query)) out.push(...page);
    return out;
  };
  /** Arşivdekiler dahil tüm kayıtlar (МойСклад varsayılan olarak arşivi göstermez). */
  const allWithArchived = async (path: string, query: Record<string, string | number> = {}) => {
    const active = await all(path, query);
    const archived = await all(path, { ...query, filter: 'archived=true' }).catch(() => []);
    const seen = new Set(active.map((r) => r.id));
    return [...active, ...archived.filter((r) => !seen.has(r.id))];
  };

  // 1. Para birimleri
  const currencyCode = new Map<string, string>();
  for (const c of await all('/entity/currency')) {
    currencyCode.set(c.id, c.isoCode);
    await db.insert(currencies).values({ code: c.isoCode, name: c.fullName ?? c.name, rate: Number(c.rate ?? 1), isDefault: !!c.default })
      .onConflictDoUpdate({ target: currencies.code, set: { name: c.fullName ?? c.name, rate: Number(c.rate ?? 1), isDefault: !!c.default } });
    count('currencies');
  }
  const ratesByCode = new Map((await db.select().from(currencies)).map((c) => [c.code, c.rate]));
  const rateOf = (code: string) => Number(ratesByCode.get(code) ?? 1);
  const priceIn = (p: Ms | null | undefined) => {
    const code = currencyCode.get(idOf(p?.currency) ?? '') ?? 'RUB';
    return { value: kop(p?.value), currency: code };
  };
  const rubOf = (p: Ms | null | undefined) => { const x = priceIn(p); return x.currency === 'RUB' ? x.value : Math.round(x.value * rateOf(x.currency)); };
  log.info(`Валюты: ${summary.counts.currencies ?? 0}`);

  // 2. Birimler (adları)
  const uomName = new Map<string, string>();
  for (const u of await all('/entity/uom')) uomName.set(u.id, u.name);

  // 3. Tüzel kişiler, depolar, fiyat türleri
  await db.transaction(async (tx) => {
    for (const o of await allWithArchived('/entity/organization')) {
      await upsert(tx, 'organization', o.id, organizations, { name: o.name, inn: o.inn ?? null, kpp: o.kpp ?? null, address: o.legalAddress ?? o.actualAddress ?? null, archived: !!o.archived });
      count('organizations');
    }
    for (const s of await allWithArchived('/entity/store')) {
      await upsert(tx, 'store', s.id, warehouses, { name: s.name, address: s.address ?? null, archived: !!s.archived });
      count('warehouses');
    }
    for (const p of await ms.get<Ms[]>('/context/companysettings/pricetype')) {
      const existing = ref('pricetype', p.id) ?? (await tx.select().from(priceTypes).where(eq(priceTypes.name, p.name)))[0]?.id;
      if (existing) { await tx.update(priceTypes).set({ name: p.name }).where(eq(priceTypes.id, existing)); await setRef(tx, 'pricetype', p.id, existing); }
      else await setRef(tx, 'pricetype', p.id, (await tx.insert(priceTypes).values({ name: p.name }).returning())[0]!.id);
      count('priceTypes');
    }
  });
  log.info(`Юрлица: ${summary.counts.organizations ?? 0}, склады: ${summary.counts.warehouses ?? 0}, типы цен: ${summary.counts.priceTypes ?? 0}`);

  // 4. Ürün grupları (iki geçiş: önce kayıt, sonra üst grup bağlantısı)
  const folderRows = await allWithArchived('/entity/productfolder');
  await db.transaction(async (tx) => {
    for (const f of folderRows) { await upsert(tx, 'productfolder', f.id, folders, { name: f.name }); count('folders'); }
    for (const f of folderRows) {
      const parent = ref('productfolder', idOf(f.productFolder));
      await tx.update(folders).set({ parentId: parent }).where(eq(folders.id, ref('productfolder', f.id)!));
    }
  });

  // 5. Cariler
  const cps = await allWithArchived('/entity/counterparty', { expand: 'priceType' });
  for (let i = 0; i < cps.length; i += 200) {
    await db.transaction(async (tx) => {
      for (const c of cps.slice(i, i + 200)) {
        await upsert(tx, 'counterparty', c.id, counterparties, {
          kind: counterpartyKind(c.companyType), name: c.name, inn: c.inn ?? null, kpp: c.kpp ?? null, phone: c.phone ?? null,
          email: c.email ?? null, address: c.actualAddress ?? c.legalAddress ?? null, priceTypeId: ref('pricetype', idOf(c.priceType)),
          tags: c.tags ?? [], comment: c.description ?? null, archived: !!c.archived,
        });
        count('counterparties');
      }
    });
  }
  log.info(`Контрагенты: ${summary.counts.counterparties ?? 0}`);

  // 6. Çalışanlar: girişsiz (pasif) aktarılır; yönetici şifre verip etkinleştirir.
  await db.transaction(async (tx) => {
    for (const e of await allWithArchived('/entity/employee')) {
      const values = { name: e.fullName ?? e.name, phone: e.phone ?? null, email: e.email ?? null, position: e.position ?? null };
      const existing = ref('employee', e.id);
      if (existing) await tx.update(employees).set(values).where(eq(employees.id, existing));
      else {
        const [row] = await tx.insert(employees).values({ ...values, login: `ms-${e.id.slice(0, 8)}`, role: 'manager', active: false,
          passwordHash: await hashPassword(randomBytes(24).toString('base64url')) }).returning();
        await setRef(tx, 'employee', e.id, row!.id);
      }
      count('employees');
    }
  });

  // 7. Ürünler ve hizmetler. Her ürünün bir "ana" varyantı olur; modifikasyonlu üründe ana varyant arşivde kalır.
  const takenBarcodes = new Map<string, number>();
  for (const b of await db.select().from(barcodes)) takenBarcodes.set(b.barcode, b.variantId);
  const productPrices = new Map<string, Ms[]>();
  async function saveVariantData(tx: DbOrTx, variantId: number, codes: string[], salePrices: Ms[] | undefined, label: string) {
    await tx.delete(barcodes).where(eq(barcodes.variantId, variantId));
    for (const [code, owner] of takenBarcodes) if (owner === variantId) takenBarcodes.delete(code);
    for (const code of codes) {
      const owner = takenBarcodes.get(code);
      if (owner && owner !== variantId) warn('shared_barcode', `${code} (${label})`);
      await tx.insert(barcodes).values({ barcode: code, variantId }).onConflictDoNothing();
      takenBarcodes.set(code, variantId);
    }
    await tx.delete(prices).where(eq(prices.variantId, variantId));
    const rows = (salePrices ?? [])
      .map((sp) => ({ variantId, priceTypeId: ref('pricetype', idOf(sp.priceType) ?? sp.priceType?.id), ...priceIn(sp) }))
      .filter((r): r is { variantId: number; priceTypeId: number; value: number; currency: string } => !!r.priceTypeId && r.value > 0);
    if (rows.length) await tx.insert(prices).values(rows);
  }

  const productRows: Ms[] = [
    ...(await allWithArchived('/entity/product')).map((p) => ({ ...p, isService: false })),
    ...(await allWithArchived('/entity/service')).map((p) => ({ ...p, isService: true })),
  ];
  for (let i = 0; i < productRows.length; i += 200) {
    await db.transaction(async (tx) => {
      for (const p of productRows.slice(i, i + 200)) {
        const productId = await upsert(tx, 'product', p.id, products, {
          name: p.name, article: p.article ?? null, code: p.code || null,
          folderId: ref('productfolder', idOf(p.productFolder)), unit: uomName.get(idOf(p.uom) ?? '') ?? 'шт',
          vat: p.vatEnabled ? (p.vat ?? 0) : null, isService: p.isService, markingType: markingOf(p.trackingType),
          buyPrice: rubOf(p.buyPrice), minStock: Number(p.minimumBalance ?? 0), description: p.description ?? null,
          attributes: { ...attributesOf(p.attributes), ...(p.externalCode ? { 'Внешний код': p.externalCode } : {}) },
          archived: !!p.archived,
        });
        const variantId = await upsert(tx, 'product-default-variant', p.id, variants, {
          productId, name: '', characteristics: {}, code: null, archived: (p.variantsCount ?? 0) > 0,
        });
        await setRef(tx, 'assortment', p.id, variantId);
        await saveVariantData(tx, variantId, barcodesOf(p.barcodes), p.salePrices, p.name);
        productPrices.set(p.id, p.salePrices ?? []);
        count(p.isService ? 'services' : 'products');
      }
    });
    log.info(`Товары: ${Math.min(i + 200, productRows.length)} / ${productRows.length}`);
  }

  // 8. Modifikasyonlar
  const variantRows = await allWithArchived('/entity/variant');
  for (let i = 0; i < variantRows.length; i += 200) {
    await db.transaction(async (tx) => {
      for (const v of variantRows.slice(i, i + 200)) {
        const productId = ref('product', idOf(v.product));
        if (!productId) { warn('variant_without_product', v.name); continue; }
        const characteristics: Record<string, string> = Object.fromEntries((v.characteristics ?? []).map((c: Ms) => [c.name, String(c.value)]));
        const variantId = await upsert(tx, 'variant', v.id, variants, {
          productId, name: variantName(characteristics), characteristics, code: v.code ?? null, archived: !!v.archived,
        });
        await setRef(tx, 'assortment', v.id, variantId);
        // Modifikasyonun kendi fiyatı yoksa ürünün fiyatı geçerlidir (МойСклад davranışı).
        const own = (v.salePrices ?? []).filter((sp: Ms) => kop(sp.value) > 0);
        await saveVariantData(tx, variantId, barcodesOf(v.barcodes), own.length ? v.salePrices : productPrices.get(idOf(v.product)!), v.name);
        count('variants');
      }
    });
    log.info(`Модификации: ${Math.min(i + 200, variantRows.length)} / ${variantRows.length}`);
  }

  // 9. Satış noktaları ve para hesapları
  await db.transaction(async (tx) => {
    for (const r of await allWithArchived('/entity/retailstore')) {
      await upsert(tx, 'retailstore', r.id, retailPoints, {
        name: r.name, warehouseId: ref('store', idOf(r.store)), organizationId: ref('organization', idOf(r.organization)), archived: !!r.archived,
      });
      count('retailPoints');
    }
  });
  const accountId = async (name: string, kind: 'cash' | 'bank') => {
    const [a] = await db.select().from(accounts).where(and(eq(accounts.name, name), eq(accounts.kind, kind)));
    return a?.id ?? (await db.insert(accounts).values({ name, kind }).returning())[0]!.id;
  };
  const cash = await accountId('Касса', 'cash');
  const bank = await accountId('Расчётный счёт', 'bank');
  const acquiring = await accountId('Эквайринг (карты, СБП)', 'bank');

  if (opts.documents === false) return summary;

  // 10. Belgeler
  const statesCache = new Map<string, string>();
  for (const { ms: msType, type, parent } of MS_DOCUMENT_TYPES) {
    if (opts.types && !opts.types.includes(msType)) continue;
    const def = docType(type);
    try {
      const meta = await ms.get<Ms>(`/entity/${msType}/metadata`);
      for (const s of meta.states ?? []) statesCache.set(s.id, s.name);
    } catch { /* durum yok */ }

    let done = 0;
    for await (const page of ms.listAll<Ms>(`/entity/${msType}`, def.lines ? { expand: 'positions' } : {})) {
      // Satırı 1000'den fazla olan belgelerin satırları ayrıca okunur.
      for (const d of page) {
        if (def.lines && d.positions && (d.positions.meta?.size ?? 0) > (d.positions.rows?.length ?? 0)) {
          const rows: Ms[] = [];
          for await (const p of ms.listAll<Ms>(`/entity/${msType}/${d.id}/positions`)) rows.push(...p);
          d.positions.rows = rows;
        }
      }
      await db.transaction(async (tx) => {
        for (const d of page) await importDocument(tx, msType, type, parent ?? [], d);
      });
      done += page.length;
      log.info(`${def.ru}: ${done}`);
    }
  }

  async function importDocument(tx: DbOrTx, msType: string, type: DocType, parentFields: string[], d: Ms) {
    const def = docType(type);
    const rate = d.rate?.value && currencyCode.get(idOf(d.rate.currency) ?? '') !== 'RUB' ? Number(d.rate.value) : 1;
    const moment = msMoment(d.moment);
    const warehouseId = ref('store', idOf(type === 'move' ? d.sourceStore : d.store));
    const agentType = typeOf(d.agent);
    const counterpartyId = agentType === 'counterparty' ? ref('counterparty', idOf(d.agent)) : null;
    let parentId: number | null = null;
    for (const f of parentFields) {
      const p = d[f];
      const ptype = MS_DOCUMENT_TYPES.find((t) => t.ms === typeOf(p))?.ms;
      if (ptype) parentId ??= ref(`doc:${ptype}`, idOf(p));
    }
    if (!parentId && d.operations?.length) {
      for (const op of d.operations) parentId ??= ref(`doc:${typeOf(op)}`, idOf(op));
    }
    if (!parentId && msType === 'retaildemand') parentId = ref('doc:retailshift', idOf(d.retailShift));

    let account: number | null = null;
    if (def.money) {
      if (type === 'paymentin' || type === 'paymentout') account = bank;
      else if (type === 'cashin' || type === 'cashout') account = cash;
      else account = Number(d.cashSum ?? 0) >= Number(d.noCashSum ?? 0) + Number(d.qrSum ?? 0) ? cash : acquiring;
    }

    // Satırlar
    type Line = { variantId: number; qty: number; price: number; discount: number; vat: number | null; expected: number | null; reserve: number | null; codes: string[] };
    const lines: Line[] = [];
    for (const p of d.positions?.rows ?? []) {
      const variantId = ref('assortment', idOf(p.assortment));
      if (!variantId) { warn('unknown_assortment', `${msType} ${d.name}`); continue; }
      const codes: string[] = [];
      const collect = (list: Ms[] | undefined) => { for (const c of list ?? []) { if (c.cis) codes.push(c.cis); collect(c.trackingCodes); } };
      collect(p.trackingCodes);
      lines.push({
        variantId, qty: Number(p.quantity ?? 0), price: toRubKopeks(kop(p.price), rate), discount: Number(p.discount ?? 0),
        vat: p.vatEnabled === false ? null : (p.vat ?? null), expected: type === 'inventory' ? Number(p.calculatedQuantity ?? 0) : null,
        reserve: type === 'customerorder' ? Number(p.reserve ?? 0) : null, codes,
      });
    }

    const sum = def.lines ? lines.reduce((s, l) => s + Math.round(l.qty * l.price * (1 - l.discount / 100)), 0) : toRubKopeks(kop(d.sum), rate);
    const status = d.state ? (statesCache.get(idOf(d.state) ?? '') ?? null) : null;
    const values = {
      type, number: String(d.name ?? ''), moment: new Date(moment), posted: !!d.applicable, status,
      warehouseId: def.warehouse ? warehouseId : null,
      targetWarehouseId: def.targetWarehouse ? ref('store', idOf(d.targetStore)) : null,
      counterpartyId, accountId: account, sum, comment: d.description ?? null, parentId,
      organizationId: ref('organization', idOf(d.organization)), retailPointId: ref('retailstore', idOf(d.retailStore)),
      externalId: d.id, updatedAt: new Date(),
    };
    const docId = await upsert(tx, `doc:${msType}`, d.id, documents, values);
    await tx.delete(documentLines).where(eq(documentLines.documentId, docId));
    await clearLedgers(tx, docId);

    const inserted = lines.length
      ? await tx.insert(documentLines).values(lines.map((l) => ({ documentId: docId, variantId: l.variantId, qty: l.qty, price: l.price,
          discount: l.discount, expected: l.expected, reserve: l.reserve, vat: l.vat }))).returning({ id: documentLines.id })
      : [];
    const codeRows: { lineId: number; documentId: number; cis: string; raw: string }[] = [];
    const seen = new Set<string>();
    lines.forEach((l, i) => {
      for (const raw of l.codes) {
        const cis = parseMarkingCode(raw)?.cis ?? raw;
        if (seen.has(cis)) continue;
        seen.add(cis);
        codeRows.push({ lineId: inserted[i]!.id, documentId: docId, cis, raw });
      }
    });
    if (codeRows.length) await tx.insert(lineCodes).values(codeRows);

    if (d.applicable) {
      try {
        const r = postDocument({
          id: docId, type, moment, warehouseId: values.warehouseId, targetWarehouseId: values.targetWarehouseId,
          counterpartyId, accountId: account, sum,
          lines: lines.map((l, i) => ({ variantId: l.variantId, qty: l.qty, price: l.price, discount: l.discount, lineId: inserted[i]!.id })),
        });
        await writeLedgers(tx, r);
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        // İşlenemeyen belge taslak olarak aktarılır; uyarı raporunda görünür.
        await tx.update(documents).set({ posted: false }).where(eq(documents.id, docId));
        warn(`not_posted:${e.code}`, `${msType} № ${d.name}`);
      }
    }
    count(`doc:${msType}`);
  }

  // 11. Yeni belgelerin numarası МойСклад'daki en büyük numaradan devam eder.
  const maxNumbers = await db.select({ type: documents.type, max: sql<string>`max(nullif(regexp_replace(${documents.number}, '\\D', '', 'g'), '')::bigint)` })
    .from(documents).groupBy(documents.type);
  for (const m of maxNumbers) {
    const last = Math.min(Number(m.max ?? 0), 2_000_000_000);
    await db.insert(numberSequences).values({ type: m.type, last }).onConflictDoUpdate({ target: numberSequences.type, set: { last: sql`greatest(${numberSequences.last}, ${last})` } });
  }

  return summary;
}
