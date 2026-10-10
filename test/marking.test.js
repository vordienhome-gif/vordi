import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { saveDocument, getDocument } from '../server/documents.js';
import { parseCode, checkCodes } from '../server/marking.js';
import { receiptTask } from '../server/fiscal.js';

const GS = '\u001d';
// Ayakkabı kodu örneği: 01 + GTIN14 + 21 + 13 karakter seri + GS 91 xxxx GS 92 kripto
const code = (serial, gtin = '04600000000017') => `01${gtin}21${serial}${GS}91EE10${GS}92dGVzdGNyeXB0b3RhaWw=`;

function setup() {
  const db = openDb(':memory:');
  const pid = Number(db.prepare("INSERT INTO products (name, barcode, sale_price, buy_price, marking) VALUES ('Кроссовки', '4600000000017', 5000, 3000, 'shoes')").run().lastInsertRowid);
  const plain = Number(db.prepare("INSERT INTO products (name, sale_price) VALUES ('Носки', 100)").run().lastInsertRowid);
  return { db, pid, plain };
}

test('DataMatrix ayrıştırma: GS ile, GS olmadan ve önekli', () => {
  const a = parseCode(code('ABCDEFGHIJKLM'));
  assert.equal(a.gtin, '04600000000017');
  assert.equal(a.serial, 'ABCDEFGHIJKLM');
  assert.equal(a.cis, '010460000000001721ABCDEFGHIJKLM');
  const noGs = parseCode('010460000000001721ABCDEFGHIJKLM91EE1092dGVzdA==');
  assert.equal(noGs.cis, a.cis, 'GS yoksa seri 13 karakter kabul edilir');
  assert.equal(parseCode(`]d2${code('ABCDEFGHIJKLM')}`).cis, a.cis);
  assert.equal(parseCode('4600000000017'), null);
});

test('perakende satışta markalı ürün için her adede kod zorunlu', () => {
  const { db, pid, plain } = setup();
  const base = { type: 'retaildemand', warehouse_id: 1, account: 'Kasa' };
  assert.throws(() => saveDocument(db, { ...base, lines: [{ product_id: pid, qty: 1, price: 5000 }] }, 1), /her adede bir kod/);
  assert.throws(() => saveDocument(db, { ...base, lines: [{ product_id: pid, qty: 2, price: 5000, codes: [code('AAAAAAAAAAAA1')] }] }, 1), /1\/2/);
  assert.throws(() => saveDocument(db, { ...base, lines: [{ product_id: plain, qty: 1, price: 100, codes: [code('AAAAAAAAAAAA1')] }] }, 1), /markalı değil/);
  assert.throws(() => saveDocument(db, { ...base, lines: [{ product_id: pid, qty: 1, price: 5000, codes: [code('AAAAAAAAAAAA1', '04699999999999')] }] }, 1), /ait değil/);
  assert.throws(() => saveDocument(db, { ...base, lines: [{ product_id: pid, qty: 2, price: 5000, codes: [code('AAAAAAAAAAAA1'), code('AAAAAAAAAAAA1')] }] }, 1), /iki kez/);
  // Taslakta kod zorunlu değil.
  saveDocument(db, { ...base, posted: false, lines: [{ product_id: pid, qty: 1, price: 5000 }] }, 1);
});

test('aynı kod iki kez satılamaz; iadeden sonra tekrar satılabilir', () => {
  const { db, pid } = setup();
  const c = code('SERIAL0000001');
  saveDocument(db, { type: 'supply', counterparty_id: 1, warehouse_id: 1, moment: '2026-10-10 09:00', lines: [{ product_id: pid, qty: 1, price: 3000, codes: [c] }] }, 1);
  const sale = saveDocument(db, { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', moment: '2026-10-10 10:00', lines: [{ product_id: pid, qty: 1, price: 5000, codes: [c] }] }, 1);
  assert.deepEqual(getDocument(db, sale.id).lines[0].codes, [c]);
  assert.throws(() => saveDocument(db, { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', moment: '2026-10-10 11:00', lines: [{ product_id: pid, qty: 1, price: 5000, codes: [c] }] }, 1), /zaten satılmış/);
  // Satış belgesini yeniden kaydetmek kendi kodunu engellemez.
  saveDocument(db, { ...getDocument(db, sale.id), comment: 'düzeltme' }, 1, sale.id);
  saveDocument(db, { type: 'salesreturn', counterparty_id: 1, warehouse_id: 1, moment: '2026-10-10 12:00', lines: [{ product_id: pid, qty: 1, price: 5000, codes: [c] }] }, 1);
  saveDocument(db, { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', moment: '2026-10-10 13:00', lines: [{ product_id: pid, qty: 1, price: 5000, codes: [c] }] }, 1);
});

test('kasa fişinde her kod ayrı pozisyon ve imcParams olarak gider', () => {
  const { db, pid, plain } = setup();
  const codes = [code('SERIAL0000001'), code('SERIAL0000002')];
  const sale = saveDocument(db, { type: 'retaildemand', warehouse_id: 1, account: 'Kasa', lines: [
    { product_id: pid, qty: 2, price: 5000, vat: 22, codes }, { product_id: plain, qty: 3, price: 100, vat: 22 },
  ] }, 1);
  const task = receiptTask(db, getDocument(db, sale.id), 'sell', 'u-1', { tax_system: 'osn' });
  const items = task.request[0].items;
  assert.equal(items.length, 3);
  assert.equal(items[0].quantity, 1);
  assert.equal(items[0].paymentObject, 'commodityWithMarking');
  assert.equal(Buffer.from(items[0].imcParams.imc, 'base64').toString(), codes[0]);
  assert.equal(items[0].imcParams.itemEstimatedStatus, 'itemPieceSold');
  assert.equal(items[2].quantity, 3);
  assert.equal(items[2].imcParams, undefined);
  assert.equal(task.request[0].total, 10300);
});

test('Честный знак kontrolü: test modu ve True API yanıtının yorumlanması', async () => {
  const ok = code('GOODGOODGOOD1');
  const blocked = code('BLOCKBLOCKBL1');
  const test1 = await checkCodes({ cz_mode: 'test' }, [ok, blocked]);
  assert.deepEqual(test1.map((r) => r.ok), [true, false]);

  const calls = [];
  const fakeFetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.endsWith('/cdn/info')) return new Response(JSON.stringify({ code: 0, hosts: [{ host: 'https://cdn10.crpt.ru' }] }));
    return new Response(JSON.stringify({ code: 0, codes: [
      { cis: parseCode(ok).cis, found: true, utilised: true, realizable: true, isBlocked: false, sold: false },
      { cis: parseCode(blocked).cis, found: true, utilised: true, realizable: true, isBlocked: false, sold: true },
    ] }));
  };
  const r = await checkCodes({ cz_mode: 'api', cz_token: 'secret' }, [ok, blocked], fakeFetch);
  assert.deepEqual(r.map((x) => x.ok), [true, false]);
  assert.match(r[1].reason, /satılmış/);
  assert.equal(calls[0].opts.headers['X-API-KEY'], 'secret');
  assert.equal(calls[1].url, 'https://cdn10.crpt.ru/api/v4/true-api/codes/check');
  assert.deepEqual(JSON.parse(calls[1].opts.body).codes, [ok, blocked]);
});
