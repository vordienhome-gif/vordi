import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createApp } from '../server/index.js';
import { seedDemo } from '../server/demo.js';

let server;
let base;
let cookie = '';

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
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

before(async () => {
  server = createApp(openDb(':memory:'));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('oturum açmadan API erişimi reddedilir', async () => {
  assert.equal((await call('GET', '/api/products')).status, 401);
  assert.equal((await call('POST', '/api/login', { username: 'admin', password: 'yanlis' })).status, 401);
  await ok('POST', '/api/login', { username: 'admin', password: 'admin' });
  assert.equal((await ok('GET', '/api/me')).username, 'admin');
});

let product;
let supplier;
let customer;
let wh2;

test('ürün, cari ve depo oluşturulur', async () => {
  product = await ok('POST', '/api/products', { name: 'Test ürünü', code: 'T1', barcode: '111', buy_price: 10, sale_price: 15, vat: 20 });
  assert.equal(product.name, 'Test ürünü');
  supplier = await ok('POST', '/api/counterparties', { name: 'Tedarikçi A', roles: 'supplier' });
  customer = await ok('POST', '/api/counterparties', { name: 'Müşteri B', roles: 'customer' });
  wh2 = await ok('POST', '/api/warehouses', { name: 'Şube' });
  assert.equal((await call('POST', '/api/products', { name: '' })).status, 400);
});

const stockOf = async (warehouseId) =>
  (await ok('GET', `/api/reports/stock?warehouse_id=${warehouseId ?? ''}`)).find((r) => r.id === product.id);

test('mal kabul stoku artırır, sevkiyat azaltır, cari bakiyesi değişir', async () => {
  const supply = await ok('POST', '/api/documents', {
    type: 'supply', counterparty_id: supplier.id, warehouse_id: 1, lines: [{ product_id: product.id, qty: 10, price: 10, vat: 20 }],
  });
  assert.equal(supply.sum, 100);
  assert.equal(supply.number, '00001');
  assert.equal((await stockOf(1)).stock, 10);

  const order = await ok('POST', '/api/documents', {
    type: 'customerorder', counterparty_id: customer.id, warehouse_id: 1, lines: [{ product_id: product.id, qty: 4, price: 15, vat: 20 }],
  });
  assert.equal(order.status, 'Yeni');
  let s = await stockOf(1);
  assert.equal(s.reserve, 4);
  assert.equal(s.available, 6);

  const draft = await ok('GET', `/api/documents/${order.id}/derive/demand`);
  assert.equal(draft.base_id, order.id);
  const demand = await ok('POST', '/api/documents', draft);
  s = await stockOf(1);
  assert.equal(s.stock, 6);
  assert.equal(s.reserve, 0, 'sevk edilen sipariş rezervden düşer');

  const bal = await ok('GET', '/api/reports/settlements');
  assert.equal(bal.find((r) => r.id === supplier.id).balance, -100);
  assert.equal(bal.find((r) => r.id === customer.id).balance, 60);

  const payDraft = await ok('GET', `/api/documents/${demand.id}/derive/paymentin`);
  assert.equal(payDraft.sum, 60);
  await ok('POST', '/api/documents', payDraft);
  const bal2 = await ok('GET', '/api/reports/settlements');
  assert.equal(bal2.find((r) => r.id === customer.id).balance, 0);
  const list = await ok('GET', '/api/documents?type=demand');
  assert.equal(list[0].paid, 60);

  const profit = await ok('GET', '/api/reports/profit?from=2000-01-01&to=2100-01-01');
  const row = profit.find((r) => r.id === product.id);
  assert.equal(row.revenue, 60);
  assert.equal(row.cost, 40);
  assert.equal(row.profit, 20);
});

test('transfer, zayiat ve sayım stokları doğru günceller', async () => {
  await ok('POST', '/api/documents', {
    type: 'move', warehouse_id: 1, target_warehouse_id: wh2.id, lines: [{ product_id: product.id, qty: 2, price: 10 }],
  });
  assert.equal((await stockOf(1)).stock, 4);
  assert.equal((await stockOf(wh2.id)).stock, 2);
  assert.equal((await stockOf()).stock, 6);
  assert.equal((await call('POST', '/api/documents', { type: 'move', warehouse_id: 1, target_warehouse_id: 1, lines: [] })).status, 400);

  await ok('POST', '/api/documents', { type: 'loss', warehouse_id: 1, lines: [{ product_id: product.id, qty: 1, price: 10 }] });
  assert.equal((await stockOf(1)).stock, 3);

  const inv = await ok('POST', '/api/documents', { type: 'inventory', warehouse_id: 1, lines: [{ product_id: product.id, actual_qty: 7, price: 10 }] });
  assert.equal(inv.lines[0].qty, 4, 'sayım farkı = sayılan - mevcut');
  assert.equal((await stockOf(1)).stock, 7);
  // Sayım yeniden kaydedildiğinde fark kendi etkisi hariç tutularak hesaplanır.
  const inv2 = await ok('PUT', `/api/documents/${inv.id}`, { ...inv, lines: [{ product_id: product.id, actual_qty: 5, price: 10 }] });
  assert.equal(inv2.lines[0].qty, 2);
  assert.equal((await stockOf(1)).stock, 5);
});

test('taslak belgeler stoku etkilemez, silinen belge etkisini kaybeder', async () => {
  const d = await ok('POST', '/api/documents', { type: 'enter', warehouse_id: 1, posted: false, lines: [{ product_id: product.id, qty: 100, price: 1 }] });
  assert.equal((await stockOf(1)).stock, 5);
  await ok('PUT', `/api/documents/${d.id}`, { ...d, posted: true });
  assert.equal((await stockOf(1)).stock, 105);
  await ok('DELETE', `/api/documents/${d.id}`);
  assert.equal((await stockOf(1)).stock, 5);
});

test('perakende satış stoku düşer ve kasaya girer', async () => {
  const before = (await ok('GET', '/api/reports/money?from=2000-01-01&to=2100-01-01')).accounts.find((a) => a.account === 'Kasa')?.balance ?? 0;
  await ok('POST', '/api/documents', { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', lines: [{ product_id: product.id, qty: 2, price: 15, vat: 20 }] });
  assert.equal((await stockOf(1)).stock, 3);
  const after = (await ok('GET', '/api/reports/money?from=2000-01-01&to=2100-01-01')).accounts.find((a) => a.account === 'Kasa').balance;
  assert.equal(after - before, 30);
});

test('belgede kullanılan ürün silinmez, arşive alınır', async () => {
  const r = await ok('DELETE', `/api/products/${product.id}`);
  assert.equal(r.archived, true);
  const fresh = await ok('POST', '/api/products', { name: 'Silinecek' });
  assert.equal((await ok('DELETE', `/api/products/${fresh.id}`)).deleted, true);
});

test('geçersiz belgeler reddedilir', async () => {
  assert.equal((await call('POST', '/api/documents', { type: 'nope' })).status, 400);
  assert.equal((await call('POST', '/api/documents', { type: 'supply', warehouse_id: 1, lines: [] })).status, 400);
  assert.equal((await call('POST', '/api/documents', { type: 'paymentin', counterparty_id: customer.id, sum: 0 })).status, 400);
  assert.equal((await call('POST', '/api/documents', {
    type: 'demand', counterparty_id: customer.id, warehouse_id: 1, lines: [{ product_id: product.id, qty: -1, price: 1 }],
  })).status, 400);
  assert.equal((await call('GET', `/api/documents/1/derive/loss`)).status, 400);
});

test('CSV içe aktarma ürünleri ekler ve günceller', async () => {
  const r = await ok('POST', '/api/products/import', { rows: [
    { name: 'Yeni A', code: 'A-1', group: 'Grup X', sale_price: 5 },
    { name: 'Test ürünü güncel', code: 'T1', sale_price: 99 },
  ] });
  assert.deepEqual(r, { created: 1, updated: 1 });
  const p = await ok('GET', `/api/products/${product.id}`);
  assert.equal(p.sale_price, 99);
  assert.ok((await ok('GET', '/api/product_groups')).some((g) => g.name === 'Grup X'));
});

test('yönetici olmayan kullanıcı kullanıcı yönetemez', async () => {
  await ok('POST', '/api/users', { username: 'kasiyer', password: '1234', name: 'Kasiyer' });
  const adminCookie = cookie;
  await ok('POST', '/api/login', { username: 'kasiyer', password: '1234' });
  assert.equal((await call('GET', '/api/users')).status, 403);
  assert.equal((await call('PUT', '/api/settings', { company_name: 'x' })).status, 403);
  cookie = adminCookie;
});

test('demo verisi ve gösterge paneli', async () => {
  const db = openDb(':memory:');
  assert.equal(seedDemo(db), true);
  assert.equal(seedDemo(db), false);
  const app = createApp(db);
  await new Promise((r) => app.listen(0, r));
  const prevBase = base;
  const prevCookie = cookie;
  base = `http://127.0.0.1:${app.address().port}`;
  cookie = '';
  try {
    await ok('POST', '/api/login', { username: 'admin', password: 'admin' });
    const d = await ok('GET', '/api/dashboard');
    assert.equal(d.series.length, 30);
    assert.ok(d.salesMonth.s > 0 || d.series.some((s) => s.sum > 0));
    const stock = await ok('GET', '/api/reports/stock');
    assert.ok(stock.every((r) => r.stock >= 0), 'demo verisinde eksi stok olmamalı');
    const html = await fetch(base + '/').then((r) => r.text());
    assert.match(html, /Vordi/);
  } finally {
    app.close();
    base = prevBase;
    cookie = prevCookie;
  }
});
