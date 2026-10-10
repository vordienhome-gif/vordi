// Satış kanalları: gerçek API'ler yerine istekleri kaydeden sahte bir fetch kullanılır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { saveDocument, getDocument } from '../server/documents.js';
import { saveChannel, syncChannel, mapChannel, listChannels } from '../server/channels/index.js';
import { stockReport } from '../server/reports.js';

function setup() {
  const db = openDb(':memory:');
  const add = (name, article, barcode, price) => Number(db.prepare(
    'INSERT INTO products (name, article, barcode, sale_price, buy_price) VALUES (?, ?, ?, ?, ?)',
  ).run(name, article, barcode, price, price / 2).lastInsertRowid);
  const a = add('Футболка', 'TS-1', '4600000000101', 1000);
  const b = add('Кепка', 'CAP-1', '4600000000118', 500);
  saveDocument(db, { type: 'enter', warehouse_id: 1, lines: [{ product_id: a, qty: 10, price: 500 }, { product_id: b, qty: 4, price: 250 }] }, 1);
  return { db, a, b };
}

// routes: [[method, urlRegex, handler(url, body) => json]]
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body, headers: opts.headers });
    const r = routes.find(([m, re]) => m === method && re.test(url));
    if (!r) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(r[2](url, body) ?? {}), { status: 200 });
  };
  fn.calls = calls;
  return fn;
}
const now = new Date('2026-10-10T12:00:00Z');

test('Ozon: sipariş içe aktarılır, rezerv düşülmüş stok gönderilir, iptal yansır', async () => {
  const { db, a } = setup();
  const ch = saveChannel(db, { type: 'ozon', config: { client_id: '123', api_key: 'secret-key', warehouse_id: '2200' } });
  assert.match(ch.config.api_key, /^••/, 'API anahtarı maskelenir');
  assert.ok(db.prepare("SELECT 1 FROM counterparties WHERE name = 'Ozon'").get(), 'pazaryeri carisi oluşturulur');

  let status = 'awaiting_packaging';
  const f = fakeFetch([
    ['POST', /\/v3\/posting\/fbs\/list$/, () => ({ result: { has_next: false, postings: [
      { posting_number: '0001-1', status, products: [{ offer_id: 'TS-1', quantity: 3, price: '990.0000' }] },
    ] } })],
    ['POST', /\/v2\/products\/stocks$/, () => ({ result: [] })],
  ]);
  const r = await syncChannel(db, ch.id, { fetchImpl: f, now });
  assert.equal(r.created, 1);
  const order = db.prepare("SELECT * FROM documents WHERE external_id = 'ozon:0001-1'").get();
  assert.equal(order.type, 'customerorder');
  assert.equal(order.sum, 2970);

  const stockCall = f.calls.find((c) => c.url.endsWith('/v2/products/stocks'));
  assert.equal(stockCall.headers['Client-Id'], '123');
  assert.equal(stockCall.headers['Api-Key'], 'secret-key');
  assert.deepEqual(stockCall.body.stocks.find((s) => s.offer_id === 'TS-1'), { offer_id: 'TS-1', stock: 7, warehouse_id: 2200 });

  // Tekrar senkronizasyon aynı siparişi ikinci kez açmaz.
  assert.equal((await syncChannel(db, ch.id, { fetchImpl: f, now })).created, 0);
  status = 'cancelled';
  assert.equal((await syncChannel(db, ch.id, { fetchImpl: f, now })).cancelled, 1);
  assert.equal(db.prepare('SELECT status FROM documents WHERE id = ?').get(order.id).status, 'İptal');
  assert.equal(stockReport(db).find((x) => x.id === a).available, 10, 'iptal sonrası rezerv kalkar');
});

test('Wildberries: kartlar chrtId ile eşleştirilir, stok chrtId ile gönderilir, fiyat kuruştan çevrilir', async () => {
  const { db, a, b } = setup();
  const ch = saveChannel(db, { type: 'wildberries', config: { token: 'wb-token', warehouse_id: '555' } });
  const f = fakeFetch([
    ['POST', /content\/v2\/get\/cards\/list$/, () => ({ cards: [
      { vendorCode: 'TS-1', sizes: [{ chrtID: 9001, skus: ['2000000000011'] }] },
      { vendorCode: 'OTHER', sizes: [{ chrtID: 9002, skus: ['4600000000118'] }] },
      { vendorCode: 'NOPE', sizes: [{ chrtID: 9003, skus: ['1'] }] },
    ], cursor: { total: 3 } })],
    ['GET', /\/api\/v3\/orders\/new$/, () => ({ orders: [{ id: 777, article: 'TS-1', chrtId: 9001, price: 120000, convertedPrice: 120000 }] })],
    ['PUT', /\/api\/v3\/stocks\/555$/, () => null],
  ]);
  assert.deepEqual(await mapChannel(db, ch.id, { fetchImpl: f, now }), { mapped: 2, unmatched: 1 });
  const r = await syncChannel(db, ch.id, { fetchImpl: f, now });
  assert.equal(r.created, 1);
  const doc = getDocument(db, db.prepare("SELECT id FROM documents WHERE external_id = 'wb:777'").get().id);
  assert.equal(doc.lines[0].product_id, a);
  assert.equal(doc.lines[0].price, 1200);
  const put = f.calls.find((c) => c.method === 'PUT');
  assert.equal(put.headers.Authorization, 'wb-token');
  assert.deepEqual(put.body.stocks.sort((x, y) => x.chrtId - y.chrtId), [{ chrtId: 9001, amount: 9 }, { chrtId: 9002, amount: 4 }]);
  assert.equal(listChannels(db)[0].mapped, 2);
  assert.ok(b);
});

test('Яндекс Маркет: SKU = артикул, stok PUT campaigns/offers/stocks', async () => {
  const { db } = setup();
  const ch = saveChannel(db, { type: 'yandex', config: { api_key: 'ym-key', campaign_id: '42' } });
  const f = fakeFetch([
    ['GET', /\/v2\/campaigns\/42\/orders\?/, () => ({ orders: [{ id: 5001, status: 'PROCESSING', items: [{ offerId: 'CAP-1', count: 2, buyerPrice: 450 }] }], pager: { pagesCount: 1 } })],
    ['PUT', /\/v2\/campaigns\/42\/offers\/stocks$/, () => ({ status: 'OK' })],
  ]);
  await syncChannel(db, ch.id, { fetchImpl: f, now });
  const get = f.calls.find((c) => c.method === 'GET');
  assert.match(get.url, /fromDate=07-10-2026/);
  assert.equal(get.headers['Api-Key'], 'ym-key');
  const put = f.calls.find((c) => c.method === 'PUT');
  const cap = put.body.skus.find((s) => s.sku === 'CAP-1');
  assert.equal(cap.items[0].count, 2);
  assert.ok(cap.items[0].updatedAt);
});

test('InSales: müşteri oluşturulur, varyant id ile stok gönderilir, imleç ilerler', async () => {
  const { db } = setup();
  const ch = saveChannel(db, { type: 'insales', config: { domain: 'https://shop.myinsales.ru/', api_id: 'id', api_password: 'pw' } });
  const f = fakeFetch([
    ['GET', /\/admin\/products\.json\?page=1&/, () => [{ variants: [{ id: 11, sku: 'TS-1' }, { id: 12, sku: '', barcode: '4600000000118' }] }]],
    ['GET', /\/admin\/products\.json\?page=2&/, () => []],
    ['GET', /\/admin\/orders\.json\?/, (url) => (url.includes('page=1') ? [{
      id: 300, number: 1001, updated_at: '2026-10-10T11:00:00+03:00', fulfillment_status: 'new',
      client: { name: 'Анна', surname: 'Смирнова', phone: '+7 900 000-00-01', email: 'anna@example.ru' },
      order_lines: [{ variant_id: 11, sku: 'TS-1', quantity: 2, sale_price: 950 }],
    }] : [])],
    ['PUT', /variants_group_update\.json$/, () => [{ id: 11, status: 'ok' }]],
  ]);
  await mapChannel(db, ch.id, { fetchImpl: f, now });
  const r = await syncChannel(db, ch.id, { fetchImpl: f, now });
  assert.equal(r.created, 1);
  const call = f.calls.find((c) => c.method === 'PUT');
  assert.equal(call.url, 'https://shop.myinsales.ru/admin/products/variants_group_update.json');
  assert.equal(call.headers.Authorization, `Basic ${Buffer.from('id:pw').toString('base64')}`);
  assert.deepEqual(call.body.variants.sort((x, y) => x.id - y.id), [{ id: 11, quantity: 8 }, { id: 12, quantity: 4 }]);
  assert.ok(db.prepare("SELECT 1 FROM counterparties WHERE email = 'anna@example.ru'").get());
  assert.equal(db.prepare('SELECT orders_since FROM channels WHERE id = ?').get(ch.id).orders_since, '2026-10-10T11:00:00+03:00');
});

test('bilinmeyen ürünlü sipariş atlanır, API hatası kanala yazılır', async () => {
  const { db } = setup();
  const ch = saveChannel(db, { type: 'yandex', config: { api_key: 'k', campaign_id: '1' } });
  const f = fakeFetch([
    ['GET', /orders/, () => ({ orders: [{ id: 1, status: 'PROCESSING', items: [{ offerId: 'YOK', count: 1, buyerPrice: 1 }] }] })],
    ['PUT', /stocks/, () => ({})],
  ]);
  assert.equal((await syncChannel(db, ch.id, { fetchImpl: f, now })).errors, 1);
  const bad = fakeFetch([]);
  await assert.rejects(syncChannel(db, ch.id, { fetchImpl: bad, now }), /HTTP 404/);
  assert.match(listChannels(db)[0].last_error, /HTTP 404/);
  const eksik = saveChannel(db, { type: 'ozon', config: { client_id: '1' } });
  await assert.rejects(syncChannel(db, eksik.id, { fetchImpl: bad, now }), /Eksik ayar: api_key, warehouse_id/);
});
