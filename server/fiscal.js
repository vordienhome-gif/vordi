// Rusya 54-ФЗ uyumlu kasa (ККТ) entegrasyonu.
// Fiş, kasadaki fiskal cihaz tarafından kesilir ve ОФД üzerinden ФНС'ye iletilir; Vordi yalnızca
// АТОЛ Web Server'ın JSON görev formatında (ФФД 1.2) görevi hazırlar ve sonucu belgeye kaydeder.
// АТОЛ Web Server kasiyerin bilgisayarında çalıştığı için görevi tarayıcı gönderir (bkz. public/app.js).
import { randomUUID } from 'node:crypto';
import { getDocument, HttpError } from './documents.js';

export const TAX_SYSTEMS = ['osn', 'usnIncome', 'usnIncomeOutcome', 'esn', 'patent'];
export const FISCAL_MODES = ['off', 'atol', 'test'];
const VAT_TAG = { 22: 'vat22', 20: 'vat20', 10: 'vat10', 7: 'vat7', 5: 'vat5', 0: 'vat0' };
const round2 = (v) => Math.round(v * 100) / 100;

const operator = (s) => ({ name: s.cashier_name || 'Кассир', ...(s.cashier_inn ? { vatin: s.cashier_inn } : {}) });

export function receiptTask(db, doc, kind, uuid, s) {
  const items = doc.lines.map((l) => ({
    type: 'position',
    name: String(l.product).slice(0, 128),
    price: l.price,
    quantity: l.qty,
    amount: round2(l.qty * l.price),
    tax: { type: VAT_TAG[l.vat] ?? 'none' }, // vat < 0 → "без НДС"
    paymentObject: l.is_service ? 'service' : 'commodity',
    paymentMethod: 'fullPayment',
    measurementUnit: 0, // ФФД 1.2, тег 2108: 0 = штуки
  }));
  return {
    uuid,
    request: [{
      type: kind,
      taxationType: s.tax_system || 'osn',
      operator: operator(s),
      items,
      payments: [{ type: doc.account === 'Banka' ? 'electronically' : 'cash', sum: doc.sum }],
      total: doc.sum,
    }],
  };
}

// Kasa fişi başlatır. Aynı belge+tür için bekleyen kayıt varsa aynı uuid tekrar kullanılır,
// böylece АТОЛ aynı fişi iki kez basmaz.
export function startReceipt(db, docId, kind, settings) {
  if (!['sell', 'sellReturn'].includes(kind)) throw new HttpError(400, 'Geçersiz fiş türü');
  if (settings.fiscal_mode === 'off') throw new HttpError(400, 'Kasa entegrasyonu kapalı');
  const doc = getDocument(db, docId);
  if (doc.type !== 'retaildemand') throw new HttpError(400, 'Fiş yalnızca perakende satış için kesilebilir');
  if (!doc.posted) throw new HttpError(400, 'Taslak belge için fiş kesilemez');
  const rows = doc.fiscal.filter((f) => f.kind === kind);
  if (rows.some((f) => f.status === 'done')) throw new HttpError(400, 'Bu belge için fiş zaten kesildi');
  if (kind === 'sellReturn' && !doc.fiscal.some((f) => f.kind === 'sell' && f.status === 'done')) {
    throw new HttpError(400, 'İade fişi için önce satış fişi kesilmiş olmalı');
  }
  let row = rows.find((f) => f.status === 'pending');
  if (!row) {
    const uuid = randomUUID();
    const id = Number(db.prepare('INSERT INTO fiscal_receipts (document_id, kind, uuid, total) VALUES (?, ?, ?, ?)')
      .run(docId, kind, uuid, doc.sum).lastInsertRowid);
    row = db.prepare('SELECT * FROM fiscal_receipts WHERE id = ?').get(id);
  }
  const task = receiptTask(db, doc, kind, row.uuid, settings);
  if (settings.fiscal_mode === 'test') {
    // Test modu: gerçek cihaz olmadan fiskal yanıtı taklit eder.
    const n = db.prepare("SELECT COUNT(*) AS n FROM fiscal_receipts WHERE status = 'done'").get().n + 1;
    return { mode: 'test', receipt: finishReceipt(db, row.id, { ok: true, fiscalParams: {
      fnNumber: '9999078900000001', fiscalDocumentNumber: n, fiscalDocumentSign: String(1000000000 + n),
      fiscalReceiptNumber: n, shiftNumber: 1, fiscalDocumentDateTime: new Date().toISOString(), total: doc.sum,
      fnsUrl: 'www.nalog.gov.ru',
    } }) };
  }
  return { mode: settings.fiscal_mode, receipt: row, task, atol_url: settings.atol_url };
}

export function finishReceipt(db, receiptId, { ok, fiscalParams = {}, error = '' }) {
  const row = db.prepare('SELECT * FROM fiscal_receipts WHERE id = ?').get(receiptId);
  if (!row) throw new HttpError(404, 'Fiş kaydı bulunamadı');
  if (row.status === 'done') return row;
  if (ok) {
    const f = fiscalParams;
    db.prepare(`UPDATE fiscal_receipts SET status = 'done', error = '', fn_number = ?, fd_number = ?, fpd = ?,
      receipt_number = ?, shift_number = ?, fiscal_moment = ?, fns_url = ?, total = COALESCE(?, total) WHERE id = ?`)
      .run(String(f.fnNumber ?? ''), String(f.fiscalDocumentNumber ?? ''), String(f.fiscalDocumentSign ?? ''),
        String(f.fiscalReceiptNumber ?? ''), String(f.shiftNumber ?? ''), String(f.fiscalDocumentDateTime ?? ''),
        String(f.fnsUrl ?? ''), f.total ?? null, receiptId);
  } else {
    // Hata durumunda kayıt "pending" kalır; tekrar denemede aynı uuid kullanılır.
    db.prepare('UPDATE fiscal_receipts SET error = ? WHERE id = ?').run(String(error).slice(0, 500), receiptId);
  }
  return db.prepare('SELECT * FROM fiscal_receipts WHERE id = ?').get(receiptId);
}

// Vardiya işlemleri: openShift, closeShift (Z raporu), reportX.
export function shiftTask(kind, settings) {
  if (!['openShift', 'closeShift', 'reportX'].includes(kind)) throw new HttpError(400, 'Geçersiz kasa işlemi');
  if (settings.fiscal_mode === 'off') throw new HttpError(400, 'Kasa entegrasyonu kapalı');
  return { mode: settings.fiscal_mode, atol_url: settings.atol_url, task: { uuid: randomUUID(), request: [{ type: kind, operator: operator(settings) }] } };
}
