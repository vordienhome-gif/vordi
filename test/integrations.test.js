import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/index.js';

let server;
let base;
let cookie = '';
let apiKey = '';

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', cookie, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json() };
}
const ok = async (...a) => {
  const r = await call(...a);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};
const shop = (method, path, body) => call(method, path, body, { cookie: '', Authorization: `Bearer ${apiKey}` });

let product;

before(async () => {
  server = createApp(openDb(':memory:'));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  await ok('POST', '/api/login', { username: 'admin', password: 'admin' });
  product = await ok('POST', '/api/products', { name: 'Чай', code: 'CH-1', barcode: '4600000000001', buy_price: 100, sale_price: 200, vat: 22 });
  await ok('POST', '/api/documents', { type: 'enter', warehouse_id: 1, lines: [{ product_id: product.id, qty: 10, price: 100 }] });
});
after(() => server.close());

test('Rusya varsayılanları: ruble ve %22 KDV', async () => {
  const meta = await ok('GET', '/api/meta');
  assert.equal(meta.settings.currency, '₽');
  assert.equal(meta.settings.fiscal_mode, 'off');
  assert.ok(meta.taxSystems.includes('usnIncome'));
  assert.equal((await ok('POST', '/api/products', { name: 'X' })).vat, 22);
});

test('API anahtarı olmadan /api/v1 reddedilir, oturum çerezi yetmez', async () => {
  assert.equal((await call('GET', '/api/v1/products')).status, 401);
  assert.equal((await call('GET', '/api/v1/products', null, { Authorization: 'Bearer vrd_yanlis' })).status, 401);
});

test('internet mağazası ürünleri, stoğu okur ve sipariş gönderir', async () => {
  const created = await ok('POST', '/api/tokens', { name: 'shop.example.ru' });
  apiKey = created.token;
  assert.match(apiKey, /^vrd_/);
  assert.ok(!JSON.stringify(await ok('GET', '/api/tokens')).includes(apiKey), 'anahtar tekrar gösterilmemeli');

  const products = (await shop('GET', '/api/v1/products')).data;
  const p = products.find((x) => x.code === 'CH-1');
  assert.equal(p.stock, 10);
  assert.equal(p.price, 200);

  const order = { external_id: 'WEB-1001', customer: { name: 'Петров Пётр', phone: '+7 (916) 111-22-33', email: 'Petrov@example.ru' },
    items: [{ barcode: '4600000000001', qty: 3 }], comment: 'Доставка курьером' };
  const r1 = await shop('POST', '/api/v1/orders', order);
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.equal(r1.data.created, true);
  assert.equal(r1.data.order.status, 'new');
  assert.equal(r1.data.order.sum, 600);

  // Aynı external_id ikinci kez gönderilirse yeni sipariş açılmaz.
  const r2 = await shop('POST', '/api/v1/orders', order);
  assert.equal(r2.data.created, false);
  assert.equal(r2.data.order.id, r1.data.order.id);

  // Aynı müşteri (telefon farklı yazılmış) tekrar oluşturulmaz.
  await shop('POST', '/api/v1/orders', { ...order, external_id: 'WEB-1002', customer: { name: 'П. Петров', phone: '+79161112233' } });
  const cps = await ok('GET', '/api/counterparties');
  assert.equal(cps.filter((c) => c.name.includes('Петров')).length, 1);

  const stock = (await shop('GET', '/api/v1/stock')).data.find((x) => x.code === 'CH-1');
  assert.equal(stock.reserve, 6);
  assert.equal(stock.available, 4);

  assert.equal((await shop('POST', '/api/v1/orders', { external_id: 'WEB-X', customer: { name: 'A' }, items: [{ code: 'YOK' }] })).status, 400);

  const cancelled = await shop('POST', '/api/v1/orders/WEB-1002/cancel');
  assert.equal(cancelled.data.status, 'cancelled');
  assert.equal((await shop('GET', '/api/v1/stock')).data.find((x) => x.code === 'CH-1').reserve, 3);

  const st = await shop('GET', '/api/v1/orders/WEB-1001');
  assert.equal(st.data.shipped, false);
  assert.equal((await shop('GET', '/api/v1/orders/YOK')).status, 404);
});

test('kasa: test modunda satış ve iade fişi kesilir, ikinci kez kesilmez', async () => {
  const sale = await ok('POST', '/api/documents', { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', lines: [{ product_id: product.id, qty: 1, price: 200, vat: 22 }] });
  assert.equal((await call('POST', `/api/documents/${sale.id}/fiscal/sell`)).status, 400, 'kasa kapalıyken fiş kesilmez');

  await ok('PUT', '/api/settings', { fiscal_mode: 'test', cashier_name: 'Иванов И.', tax_system: 'usnIncome' });
  assert.equal((await call('POST', `/api/documents/${sale.id}/fiscal/sellReturn`)).status, 400, 'satış fişinden önce iade olmaz');
  const r = await ok('POST', `/api/documents/${sale.id}/fiscal/sell`);
  assert.equal(r.receipt.status, 'done');
  assert.ok(r.receipt.fpd);
  assert.equal((await call('POST', `/api/documents/${sale.id}/fiscal/sell`)).status, 400);
  await ok('POST', `/api/documents/${sale.id}/fiscal/sellReturn`);
  const doc = await ok('GET', `/api/documents/${sale.id}`);
  assert.deepEqual(doc.fiscal.map((f) => [f.kind, f.status]), [['sell', 'done'], ['sellReturn', 'done']]);
});

test('kasa: АТОЛ modunda görev ФФД 1.2 formatında hazırlanır, tekrar denemede aynı uuid', async () => {
  await ok('PUT', '/api/settings', { fiscal_mode: 'atol', atol_url: 'http://127.0.0.1:16732' });
  const sale = await ok('POST', '/api/documents', { type: 'retaildemand', warehouse_id: 1, account: 'Banka', lines: [
    { product_id: product.id, qty: 2, price: 200, vat: 22 },
  ] });
  const s1 = await ok('POST', `/api/documents/${sale.id}/fiscal/sell`);
  const req = s1.task.request[0];
  assert.equal(req.type, 'sell');
  assert.equal(req.taxationType, 'usnIncome');
  assert.deepEqual(req.operator, { name: 'Иванов И.' });
  assert.equal(req.items[0].tax.type, 'vat22');
  assert.equal(req.items[0].amount, 400);
  assert.deepEqual(req.payments, [{ type: 'electronically', sum: 400 }]);

  await ok('POST', `/api/fiscal/${s1.receipt.id}/result`, { ok: false, error: 'Нет бумаги' });
  const s2 = await ok('POST', `/api/documents/${sale.id}/fiscal/sell`);
  assert.equal(s2.task.uuid, s1.task.uuid, 'hata sonrası aynı uuid ile tekrar denenir');
  const done = await ok('POST', `/api/fiscal/${s2.receipt.id}/result`, { ok: true, fiscalParams: {
    fnNumber: '7380440800000001', fiscalDocumentNumber: 15, fiscalDocumentSign: '2873445217', fiscalDocumentDateTime: '2026-10-09T12:00:00+03:00',
  } });
  assert.equal(done.status, 'done');
  assert.equal(done.fd_number, '15');

  const shift = await ok('GET', '/api/fiscal/shift/closeShift');
  assert.equal(shift.task.request[0].type, 'closeShift');
});
