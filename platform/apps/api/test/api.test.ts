import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb } from '../src/db/index.ts';
import { ensureSeed } from '../src/services/seed.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let close: () => Promise<void>;
let admin = '';

type Opts = { token?: string; body?: unknown };
async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, { token = admin, body }: Opts = {}) {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body as object });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}
const ok = async (method: Parameters<typeof call>[0], url: string, opts?: Opts) => {
  const r = await call(method, url, opts);
  if (r.status >= 300) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

const GTIN = '4600000000015';
const DM = (serial: string) => `0104600000000015${'21'}${serial}\u001d91EE10\u001d92abc`;
let main = 0, second = 0, retail = 0, wholesale = 0, cash = 0;
let shirtM = 0, shirtL = 0, cup = 0, supplier = 0, buyer = 0;

beforeAll(async () => {
  // TEST_DATABASE_URL verilirse gerçek PostgreSQL'de (CI), yoksa bellek içi PGlite'ta çalışır.
  const d = await createDb({ url: process.env.TEST_DATABASE_URL });
  close = d.close;
  await ensureSeed(d.db, { adminPassword: 'admin-pass' });
  app = await buildApp({ db: d.db, loginRateLimit: 1000 });
  admin = (await ok('POST', '/auth/login', { token: '', body: { login: 'admin', password: 'admin-pass' } })).token;

  main = (await ok('GET', '/warehouses'))[0].id;
  second = (await ok('POST', '/warehouses', { body: { name: 'Магазин' } })).id;
  [retail, wholesale] = (await ok('GET', '/price-types')).map((p: { id: number }) => p.id);
  cash = (await ok('GET', '/accounts')).find((a: { kind: string }) => a.kind === 'cash').id;

  const shirt = await ok('POST', '/products', { body: {
    name: 'Футболка', article: 'TS-01', buyPrice: 30000, markingType: 'lp', vat: 22,
    variants: [
      { characteristics: { Размер: 'M' }, barcodes: [GTIN], prices: { [retail]: 99000, [wholesale]: 60000 } },
      { characteristics: { Размер: 'L' }, barcodes: ['4600000000022'], prices: { [retail]: 99000 } },
    ] } });
  [shirtM, shirtL] = shirt.variants.map((v: { id: number }) => v.id);
  cup = (await ok('POST', '/products', { body: { name: 'Кружка', code: 'CUP', buyPrice: 10000, variants: [{ barcodes: [] }] } })).variants[0].id;
  supplier = (await ok('POST', '/counterparties', { body: { name: 'ООО Поставщик', inn: '7701234567' } })).id;
  buyer = (await ok('POST', '/counterparties', { body: { name: 'ИП Покупатель', kind: 'entrepreneur', priceTypeId: wholesale } })).id;
});
afterAll(async () => { await app.close(); await close(); });

const stockOf = async (variantId: number, warehouseId = main) =>
  (await ok('GET', `/reports/stock?warehouseId=${warehouseId}`)).find((r: { variantId: number }) => r.variantId === variantId) ?? { stock: 0, reserve: 0, available: 0 };

describe('kimlik doğrulama ve yetki', () => {
  it('yanlış şifreyi ve oturumsuz isteği reddeder', async () => {
    expect((await call('POST', '/auth/login', { token: '', body: { login: 'admin', password: 'x' } })).status).toBe(401);
    expect((await call('GET', '/products', { token: '' })).status).toBe(401);
    expect((await call('GET', '/products', { token: 'fake' })).status).toBe(401);
  });

  it('depocu ürün oluşturamaz, satış/para belgesi açamaz, yalnızca kendi deposunda çalışır', async () => {
    await ok('POST', '/employees', { body: { login: 'sklad', name: 'Кладовщик', role: 'storekeeper', password: 'sklad-pass-1', warehouseIds: [main] } });
    const t = (await ok('POST', '/auth/login', { token: '', body: { login: 'sklad', password: 'sklad-pass-1' } })).token;
    expect((await call('POST', '/products', { token: t, body: { name: 'X', variants: [{}] } })).status).toBe(403);
    expect((await call('POST', '/documents', { token: t, body: { type: 'paymentin', counterpartyId: buyer, accountId: cash, sum: 100, posted: true } })).status).toBe(403);
    expect((await call('POST', '/documents', { token: t, body: { type: 'enter', warehouseId: second, posted: true, lines: [{ variantId: cup, qty: 1 }] } })).status).toBe(403);
    expect((await call('GET', '/reports/profit', { token: t })).status).toBe(403);
    const r = await call('POST', '/documents', { token: t, body: { type: 'enter', warehouseId: main, posted: false, lines: [{ variantId: cup, qty: 1 }] } });
    expect(r.status).toBe(200);
    await ok('DELETE', `/documents/${r.body.id}`, { token: t });
  });
});

describe('ürün ve barkod', () => {
  it('modifikasyon adlarını özelliklerden üretir ve barkod tekrarını engeller', async () => {
    const p = await ok('GET', `/products?search=TS-01`);
    expect(p.rows[0].variants.map((v: { name: string }) => v.name)).toEqual(['M', 'L']);
    const dup = await call('POST', '/products', { body: { name: 'Дубль', variants: [{ barcodes: [GTIN] }] } });
    expect(dup.status).toBe(409);
  });

  it('barkod, ürün kodu ve DataMatrix ile okutur', async () => {
    expect((await ok('GET', `/scan/${GTIN}`)).variant.id).toBe(shirtM);
    expect((await ok('GET', '/scan/CUP')).variant.id).toBe(cup);
    const dm = await ok('GET', `/scan/${encodeURIComponent(DM('AAAAAAAAAAAAA'))}`);
    expect(dm.variant.id).toBe(shirtM);
    expect(dm.markingCode.cis).toBe('010460000000001521AAAAAAAAAAAAA');
    expect((await call('GET', '/scan/0000000')).status).toBe(404);
  });
});

describe('depo ve satış akışı', () => {
  it('Приёмка stok ve tedarikçi borcu yazar; Перемещение depolar arası taşır', async () => {
    const s = await ok('POST', '/documents', { body: { type: 'supply', warehouseId: main, counterpartyId: supplier, posted: true,
      lines: [{ variantId: shirtM, qty: 10, price: 30000 }, { variantId: cup, qty: 20, price: 10000 }] } });
    expect(s.number).toBe('00001');
    expect(s.sum).toBe(500000);
    expect((await stockOf(shirtM)).stock).toBe(10);

    await ok('POST', '/documents', { body: { type: 'move', warehouseId: main, targetWarehouseId: second, posted: true, lines: [{ variantId: cup, qty: 5 }] } });
    expect((await stockOf(cup)).stock).toBe(15);
    expect((await stockOf(cup, second)).stock).toBe(5);

    const bal = await ok('GET', '/reports/settlements');
    expect(bal.find((b: { counterpartyId: number }) => b.counterpartyId === supplier).balance).toBe(-500000);
  });

  it('sipariş rezerv yapar, sipariş üzerinden sevkiyat rezervi düşer; ödeme bakiyeyi kapatır', async () => {
    const order = await ok('POST', '/documents', { body: { type: 'customerorder', warehouseId: main, counterpartyId: buyer, posted: true, status: 'new',
      lines: [{ variantId: shirtM, qty: 4, price: 60000 }] } });
    expect(await stockOf(shirtM)).toMatchObject({ stock: 10, reserve: 4, available: 6 });

    const demand = await ok('POST', '/documents', { body: { type: 'demand', warehouseId: main, counterpartyId: buyer, parentId: order.id, posted: true,
      lines: [{ variantId: shirtM, qty: 3, price: 60000 }] } });
    expect(await stockOf(shirtM)).toMatchObject({ stock: 7, reserve: 1, available: 6 });
    expect(demand.sum).toBe(180000);

    await ok('POST', '/documents', { body: { type: 'paymentin', counterpartyId: buyer, accountId: cash, sum: 180000, posted: true } });
    const bal = await ok('GET', '/reports/settlements');
    expect(bal.find((b: { counterpartyId: number }) => b.counterpartyId === buyer)).toBeUndefined();
  });

  it('işlemi geri almak (unpost) defter kayıtlarını kaldırır', async () => {
    const d = await ok('POST', '/documents', { body: { type: 'loss', warehouseId: main, posted: true, lines: [{ variantId: cup, qty: 2 }] } });
    expect((await stockOf(cup)).stock).toBe(13);
    await ok('POST', `/documents/${d.id}/unpost`);
    expect((await stockOf(cup)).stock).toBe(15);
    await ok('POST', `/documents/${d.id}/post`);
    expect((await stockOf(cup)).stock).toBe(13);
    await ok('DELETE', `/documents/${d.id}`);
    expect((await stockOf(cup)).stock).toBe(15);
  });

  it('sayım beklenen stoğu doldurur ve farkları giriş/zayiat olarak uygular', async () => {
    const inv = await ok('POST', '/documents', { body: { type: 'inventory', warehouseId: main, posted: true,
      lines: [{ variantId: cup, qty: 17 }, { variantId: shirtM, qty: 6 }] } });
    expect(inv.lines.map((l: { expected: number }) => l.expected)).toEqual([15, 7]);
    const r = await ok('POST', `/documents/${inv.id}/apply-inventory`);
    expect(r.enter.lines[0]).toMatchObject({ variantId: cup, qty: 2, price: 10000 });
    expect(r.loss.lines[0]).toMatchObject({ variantId: shirtM, qty: 1 });
    expect((await stockOf(cup)).stock).toBe(17);
    expect((await stockOf(shirtM)).stock).toBe(6);
    expect((await call('POST', `/documents/${inv.id}/apply-inventory`)).status).toBe(409);
  });

  it('kârlılık raporu FIFO maliyetle hesaplar', async () => {
    await ok('POST', '/documents', { body: { type: 'supply', warehouseId: main, counterpartyId: supplier, posted: true, lines: [{ variantId: shirtL, qty: 2, price: 20000 }] } });
    await ok('POST', '/documents', { body: { type: 'supply', warehouseId: main, counterpartyId: supplier, posted: true, lines: [{ variantId: shirtL, qty: 2, price: 40000 }] } });
    await ok('POST', '/documents', { body: { type: 'retaildemand', warehouseId: main, accountId: cash, posted: true, lines: [{ variantId: shirtL, qty: 3, price: 99000 }] } });
    const row = (await ok('GET', '/reports/profit')).find((r: { variantId: number }) => r.variantId === shirtL);
    expect(row).toMatchObject({ qty: 3, revenue: 297000, cost: 2 * 20000 + 40000, profit: 297000 - 80000, estimated: false });
  });

  it('eksik alanlı belgeyi 422 ile reddeder', async () => {
    const r = await call('POST', '/documents', { body: { type: 'supply', warehouseId: main, posted: true, lines: [{ variantId: cup, qty: 1 }] } });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('missing_counterparty');
  });
});

describe('Честный знак', () => {
  it('kod stoğa girer, bir kez satılır, iki kez satılamaz; başka ürünün kodu reddedilir', async () => {
    const code = DM('SERIAL0000001');
    await ok('POST', '/documents', { body: { type: 'supply', warehouseId: main, counterpartyId: supplier, posted: true, lines: [{ variantId: shirtM, qty: 1, price: 30000, codes: [code] }] } });
    const again = await call('POST', '/documents', { body: { type: 'supply', warehouseId: main, counterpartyId: supplier, posted: true, lines: [{ variantId: shirtM, qty: 1, price: 30000, codes: [code] }] } });
    expect(again.status).toBe(409);

    await ok('POST', '/documents', { body: { type: 'retaildemand', warehouseId: main, accountId: cash, posted: true, lines: [{ variantId: shirtM, qty: 1, price: 99000, codes: [code] }] } });
    const twice = await call('POST', '/documents', { body: { type: 'retaildemand', warehouseId: main, accountId: cash, posted: true, lines: [{ variantId: shirtM, qty: 1, price: 99000, codes: [code] }] } });
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe('code_out');

    const wrong = await call('POST', '/documents', { body: { type: 'retaildemand', warehouseId: main, accountId: cash, posted: false, lines: [{ variantId: shirtL, qty: 1, price: 99000, codes: [code] }] } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('code_gtin');
  });
});

describe('panel uçları', () => {
  it('dövizli fiyat ürün güncellenince korunur', async () => {
    const p = await ok('POST', '/products', { body: { name: 'Плед', variants: [{ prices: { [retail]: 150000, [wholesale]: { value: 1500, currency: 'USD' } } }] } });
    expect(p.variants[0].prices[String(wholesale)]).toEqual({ value: 1500, currency: 'USD' });
    const u = await ok('PUT', `/products/${p.id}`, { body: { name: 'Плед 2', variants: [{ id: p.variants[0].id, prices: p.variants[0].prices }] } });
    expect(u.variants[0].prices).toEqual({ [String(retail)]: { value: 150000, currency: 'RUB' }, [String(wholesale)]: { value: 1500, currency: 'USD' } });
  });

  it('şifre değiştirme: eski şifre doğrulanır, diğer oturumlar kapanır', async () => {
    await ok('POST', '/employees', { body: { login: 'kassa', name: 'Кассир', role: 'cashier', password: 'kassa-pass-1' } });
    const t1 = (await ok('POST', '/auth/login', { token: '', body: { login: 'kassa', password: 'kassa-pass-1' } })).token;
    const t2 = (await ok('POST', '/auth/login', { token: '', body: { login: 'kassa', password: 'kassa-pass-1' } })).token;
    expect((await call('POST', '/auth/password', { token: t1, body: { current: 'wrong', next: 'new-pass-123' } })).status).toBe(400);
    expect((await call('POST', '/auth/password', { token: t1, body: { current: 'kassa-pass-1', next: 'new-pass-123' } })).status).toBe(204);
    expect((await call('GET', '/auth/me', { token: t1 })).status).toBe(200);
    expect((await call('GET', '/auth/me', { token: t2 })).status).toBe(401);
    expect((await call('POST', '/auth/login', { token: '', body: { login: 'kassa', password: 'new-pass-123' } })).status).toBe(200);
  });

  it('belge listesi numara ve cariye göre süzülür; referans listeleri gelir', async () => {
    const all = await ok('GET', '/documents?type=supply');
    const first = all.rows[0];
    const found = await ok('GET', `/documents?type=supply&search=${first.number}`);
    expect(found.rows.every((d: { number: string }) => d.number.includes(first.number))).toBe(true);
    const byCp = await ok('GET', `/documents?counterpartyId=${buyer}`);
    expect(byCp.rows.length).toBeGreaterThan(0);
    expect(byCp.rows.every((d: { counterpartyId: number }) => d.counterpartyId === buyer)).toBe(true);
    expect(Array.isArray(await ok('GET', '/organizations'))).toBe(true);
    expect(Array.isArray(await ok('GET', '/currencies'))).toBe(true);
  });
});
