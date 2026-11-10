import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/index.ts';
import type { MsClient } from '../src/integrations/moysklad/client.ts';
import { importMoySklad } from '../src/integrations/moysklad/importer.ts';
import { barcodesOf, idOf, markingOf, msMoment, toRubKopeks, typeOf } from '../src/integrations/moysklad/mapping.ts';
import { reconcileMoySklad } from '../src/integrations/moysklad/reconcile.ts';
import { stockReport } from '../src/services/reports.ts';
import { ensureSeed } from '../src/services/seed.ts';

const B = 'https://api.moysklad.ru/api/remap/1.2';
const m = (type: string, id: string) => ({ meta: { href: `${B}/entity/${type}/${id}`, type } });
const RUB = m('currency', 'rub');
const USD = m('currency', 'usd');
const PT_RETAIL = { meta: { href: `${B}/context/companysettings/pricetype/pt1`, type: 'pricetype' }, id: 'pt1', name: 'Цена продажи' };
const PT_USD = { meta: { href: `${B}/context/companysettings/pricetype/pt2`, type: 'pricetype' }, id: 'pt2', name: 'Опт $$' };

describe('МойСклад dönüştürme yardımcıları', () => {
  it('kimlik, tür, tarih, markalama, barkod ve kur', () => {
    expect(idOf({ meta: { href: `${B}/entity/product/abc?expand=x` } })).toBe('abc');
    expect(typeOf({ meta: { href: `${B}/entity/variant/abc` } })).toBe('variant');
    expect(msMoment('2025-10-14 12:34:56.123')).toBe('2025-10-14T12:34:56.123+03:00');
    expect(new Date(msMoment('2025-10-14 00:30:00.000')).toISOString()).toBe('2025-10-13T21:30:00.000Z');
    expect(markingOf('LP_LINENS')).toBe('lp_linens');
    expect(markingOf('NOT_TRACKED')).toBeNull();
    expect(markingOf('SOMETHING_NEW')).toBe('other');
    expect(barcodesOf([{ ean13: '2000000033136' }, { gtin: '04600000000015' }, { ean13: '2000000033136' }])).toEqual(['2000000033136', '04600000000015']);
    expect(toRubKopeks(1000, 86)).toBe(86000);
  });
});

/** Sahte МойСклад: yol → satırlar. */
function fakeMs(data: Record<string, unknown[]>, extra: Record<string, unknown> = {}): MsClient {
  return {
    async get<T>(path: string) {
      if (path in extra) return extra[path] as T;
      if (path.endsWith('/metadata')) return { states: [{ id: 'st1', name: 'Новый', stateType: 'Regular' }, { id: 'st2', name: 'Доставлен', stateType: 'Successful' }] } as T;
      throw new Error(`unexpected GET ${path}`);
    },
    async *listAll<T>(path: string, query: Record<string, string | number> = {}) {
      const rows = query.filter === 'archived=true' ? [] : ((data[path] ?? []) as T[]);
      yield rows;
    },
  };
}

const store1 = { ...m('store', 's1'), id: 's1', name: 'Склад 141' };
const store2 = { ...m('store', 's2'), id: 's2', name: 'Магазин 141' };
const product = {
  ...m('product', 'p1'), id: 'p1', name: 'КПБ Majoli', article: 'MJ-1', code: '614209', trackingType: 'LP_LINENS', variantsCount: 2,
  uom: m('uom', 'u1'), vatEnabled: false, buyPrice: { value: 300000, currency: RUB },
  salePrices: [{ value: 510000, currency: RUB, priceType: PT_RETAIL }, { value: 4500, currency: USD, priceType: PT_USD }],
  barcodes: [], attributes: [{ name: 'Комиссионный', value: false }],
};
const plain = { ...m('product', 'p2'), id: 'p2', name: 'Коврик', code: '614209', variantsCount: 0, buyPrice: { value: 10000, currency: RUB },
  salePrices: [{ value: 25000, currency: RUB, priceType: PT_RETAIL }], barcodes: [{ ean13: '2000000000015' }] };
const vWhite = { ...m('variant', 'v1'), id: 'v1', product: m('product', 'p1'), characteristics: [{ name: 'Цвет', value: 'Белый' }],
  barcodes: [{ ean13: '8697436840373' }], salePrices: [{ value: 0, currency: RUB, priceType: PT_RETAIL }] };
const vGrey = { ...m('variant', 'v2'), id: 'v2', product: m('product', 'p1'), characteristics: [{ name: 'Цвет', value: 'Серый' }],
  barcodes: [{ ean13: '8697436840373' }], salePrices: [{ value: 520000, currency: RUB, priceType: PT_RETAIL }] };
const supplier = { ...m('counterparty', 'c1'), id: 'c1', name: 'ООО Текстиль', companyType: 'legal', inn: '7700000000' };
const pos = (assortment: object, quantity: number, price: number, extra = {}) => ({ assortment, quantity, price, discount: 0, vat: 0, ...extra });
const doc = (type: string, id: string, extra: object) => ({ ...m(type, id), id, name: id.toUpperCase(), moment: '2026-01-10 10:00:00.000', applicable: true, rate: { currency: RUB }, ...extra });

const data: Record<string, unknown[]> = {
  '/entity/currency': [{ id: 'rub', isoCode: 'RUB', rate: 1, default: true, name: 'руб' }, { id: 'usd', isoCode: 'USD', rate: 86, name: 'доллар' }],
  '/entity/uom': [{ id: 'u1', name: 'компл' }],
  '/entity/organization': [{ id: 'o1', name: 'ИП Vordi', inn: '770000000001' }],
  '/entity/store': [store1, store2],
  '/entity/productfolder': [{ id: 'f1', name: 'Текстиль' }],
  '/entity/counterparty': [supplier],
  '/entity/employee': [{ id: 'e1e1e1e1-0000', fullName: 'Иванов Иван' }],
  '/entity/product': [product, plain],
  '/entity/variant': [vWhite, vGrey],
  '/entity/retailstore': [{ id: 'r1', name: 'Касса 141', store: m('store', 's2'), organization: m('organization', 'o1') }],
  '/entity/supply': [doc('supply', 'sup1', { store: m('store', 's1'), agent: m('counterparty', 'c1'), organization: m('organization', 'o1'),
    positions: { meta: { size: 2 }, rows: [pos(m('variant', 'v1'), 10, 300000), pos(m('product', 'p2'), 5, 10000)] } })],
  '/entity/move': [doc('move', 'mv1', { sourceStore: m('store', 's1'), targetStore: m('store', 's2'), positions: { meta: { size: 1 }, rows: [pos(m('variant', 'v1'), 4, 0)] } })],
  '/entity/retaildemand': [doc('retaildemand', 'rd1', { store: m('store', 's2'), agent: m('counterparty', 'c1'), cashSum: 0, noCashSum: 510000,
    retailStore: m('retailstore', 'r1'), positions: { meta: { size: 1 }, rows: [pos(m('variant', 'v1'), 1, 510000, { trackingCodes: [{ cis: '010869743684037321ABCDEFGHIJKLM' }] })] } })],
  '/entity/customerorder': [doc('customerorder', 'co2', { store: m('store', 's1'), agent: m('counterparty', 'c1'), state: { meta: { href: `${B}/entity/customerorder/metadata/states/st2` } },
    positions: { meta: { size: 1 }, rows: [pos(m('product', 'p2'), 7, 25000, { reserve: 7 })] } }), doc('customerorder', 'co1', { store: m('store', 's1'), agent: m('counterparty', 'c1'), state: { meta: { href: `${B}/entity/customerorder/metadata/states/st1` } },
    positions: { meta: { size: 1 }, rows: [pos(m('product', 'p2'), 3, 25000, { reserve: 2 })] } })],
  '/entity/service': [{ ...m('service', 'sv1'), id: 'sv1', name: 'Доставка', salePrices: [], buyPrice: { value: 0, currency: RUB } }],
  '/entity/demand': [doc('demand', 'dm1', { store: m('store', 's1'), agent: m('counterparty', 'c1'),
    positions: { meta: { size: 2 }, rows: [pos(m('product', 'p2'), 1, 25000), pos(m('service', 'sv1'), 1, 30000)] } })],
  '/entity/cashin': [doc('cashin', 'ci1', { agent: m('employee', 'e1e1e1e1-0000'), sum: 50000 })],
  '/entity/commissionreportin': [doc('commissionreportin', 'cr1', { agent: m('counterparty', 'c1'), sum: 100000, commitentSum: 94000,
    positions: { meta: { size: 1 }, rows: [pos(m('product', 'p2'), 1, 100000)] } })],
  '/entity/loss': [doc('loss', 'ls1', { store: m('store', 's1'), positions: { meta: { size: 0 }, rows: [] } })],
  '/entity/paymentout': [doc('paymentout', 'po1', { agent: m('counterparty', 'c1'), sum: 100000 })],
  // Mutabakat raporları
  '/report/stock/bystore': [
    { meta: { href: `${B}/entity/variant/v1` }, stockByStore: [{ meta: { href: `${B}/entity/store/s1` }, stock: 6, reserve: 0 }, { meta: { href: `${B}/entity/store/s2` }, stock: 3, reserve: 0 }] },
    { meta: { href: `${B}/entity/product/p2` }, stockByStore: [{ meta: { href: `${B}/entity/store/s1` }, stock: 4, reserve: 2 }] },
  ],
  '/report/counterparty': [{ counterparty: m('counterparty', 'c1'), balance: 3110000 }],
};
const extra = { '/context/companysettings/pricetype': [PT_RETAIL, PT_USD] };

describe('МойСклад aktarımı (sahte veriyle)', () => {
  it('kartları, belgeleri ve defterleri aktarır; tekrar çalıştırınca kopya oluşturmaz; mutabakat farkları gösterir', async () => {
    const { db, close } = await createDb();
    await ensureSeed(db, { adminPassword: 'x' });
    const quiet = { info: () => {}, warn: () => {} };
    const s = await importMoySklad(db, fakeMs(data, extra), quiet);

    expect(s.counts).toMatchObject({ warehouses: 2, products: 2, variants: 2, counterparties: 1, 'doc:supply': 1, 'doc:move': 1, 'doc:retaildemand': 1 });
    expect(s.warnings.shared_barcode).toBe(1); // iki renk aynı barkodu paylaşıyor
    expect(s.warnings['not_posted:empty_document']).toBe(1); // satırsız zayiat taslak olarak gelir

    const rows = await stockReport(db, {});
    const find = (name: string, variant: string, wh: string) => rows.find((r) => r.productName === name && r.variantName === variant && r.warehouseId === (wh === 's1' ? 2 : 3));
    // Seed "Основной склад" = 1; aktarılan depolar 2 ve 3
    expect(find('КПБ Majoli', 'Белый', 's1')).toMatchObject({ stock: 6 });
    expect(find('КПБ Majoli', 'Белый', 's2')).toMatchObject({ stock: 3 });
    expect(find('Коврик', '', 's1')).toMatchObject({ stock: 4, reserve: 2 }); // kapanmış sipariş (Доставлен) rezerv tutmaz
    expect(rows.find((r) => r.productName === 'Доставка')).toBeUndefined(); // hizmet stoğa girmez
    expect(s.warnings['not_posted:missing_counterparty']).toBeUndefined(); // çalışandan kasa tahsilatı işlenir

    // İkinci çalıştırma: aynı sayılar, kopya yok
    await importMoySklad(db, fakeMs(data, extra), quiet);
    expect((await stockReport(db, {})).length).toBe(rows.length);

    const rec = await reconcileMoySklad(db, fakeMs(data, extra));
    expect(rec.stock.diffs).toEqual([]);
    expect(rec.reserve.diffs).toEqual([]);
    // Cari: −3 050 000 (mal kabul) + 100 000 (ödeme) + 55 000 (sevkiyat) + 100 000 (komisyoncu raporu: satış − iade) = −2 795 000
    expect(rec.balances.diffs).toEqual([{ counterparty: 'ООО Текстиль', moysklad: 3110000 * (rec.balances.signFlipped ? -1 : 1), vordi: -2795000 }]);
    await close();
  });
});
