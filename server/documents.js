import { DOC_TYPES } from './doctypes.js';
import { tx } from './db.js';
import { validateLineCodes } from './marking.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const num = (v, d = 0) => (v === '' || v == null || Number.isNaN(Number(v)) ? d : Number(v));
const idOrNull = (v) => (v === '' || v == null ? null : Number(v));
const round2 = (v) => Math.round(v * 100) / 100;

// Sunucunun yerel saati (TZ ortam değişkeni, varsayılan Europe/Moscow).
const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowMoment = (d = new Date()) => `${localDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function nextNumber(db, type) {
  const r = db.prepare(
    "SELECT MAX(CAST(number AS INTEGER)) AS n FROM documents WHERE type = ? AND number GLOB '[0-9]*'",
  ).get(type);
  return String((r.n || 0) + 1).padStart(5, '0');
}

export function stockOf(db, warehouseId, productId, excludeDocId = 0) {
  return db.prepare(
    'SELECT COALESCE(SUM(qty), 0) AS q FROM stock_moves WHERE warehouse_id = ? AND product_id = ? AND doc_id != ?',
  ).get(warehouseId, productId, excludeDocId).q;
}

export function listDocuments(db, { type, q = '', from = '', to = '', counterparty_id = '', limit = 500 } = {}) {
  const where = [];
  const p = {};
  if (type) { where.push('d.type = $type'); p.type = type; }
  if (q) {
    where.push('(d.number LIKE $q OR c.name LIKE $q OR d.comment LIKE $q)');
    p.q = `%${q}%`;
  }
  if (from) { where.push('d.moment >= $from'); p.from = from; }
  if (to) { where.push('d.moment < $to'); p.to = dayAfter(to); }
  if (counterparty_id) { where.push('d.counterparty_id = $cp'); p.cp = Number(counterparty_id); }
  p.limit = Math.min(Number(limit) || 500, 5000);
  return db.prepare(
    `SELECT d.id, d.type, d.number, d.moment, d.status, d.posted, d.sum, d.comment, d.account, d.category,
            d.counterparty_id, c.name AS counterparty, w.name AS warehouse, tw.name AS target_warehouse,
            (SELECT COALESCE(SUM(pd.sum), 0) FROM documents pd
              WHERE pd.base_id = d.id AND pd.posted = 1 AND pd.type IN ('paymentin', 'paymentout')) AS paid
     FROM documents d
     LEFT JOIN counterparties c ON c.id = d.counterparty_id
     LEFT JOIN warehouses w ON w.id = d.warehouse_id
     LEFT JOIN warehouses tw ON tw.id = d.target_warehouse_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.moment DESC, d.id DESC LIMIT $limit`,
  ).all(p);
}

export function getDocument(db, id) {
  const doc = db.prepare(
    `SELECT d.*, c.name AS counterparty, w.name AS warehouse, tw.name AS target_warehouse, u.name AS author
     FROM documents d
     LEFT JOIN counterparties c ON c.id = d.counterparty_id
     LEFT JOIN warehouses w ON w.id = d.warehouse_id
     LEFT JOIN warehouses tw ON tw.id = d.target_warehouse_id
     LEFT JOIN users u ON u.id = d.created_by
     WHERE d.id = ?`,
  ).get(id);
  if (!doc) throw new HttpError(404, 'Belge bulunamadı');
  doc.lines = db.prepare(
    `SELECT l.id, l.product_id, l.qty, l.actual_qty, l.price, l.vat, p.name AS product, p.code, p.article, p.unit,
            p.is_service, p.marking, p.barcode
     FROM document_lines l JOIN products p ON p.id = l.product_id
     WHERE l.document_id = ? ORDER BY l.position, l.id`,
  ).all(id);
  const codes = db.prepare('SELECT product_id, raw FROM line_codes WHERE document_id = ? ORDER BY id').all(id);
  for (const l of doc.lines) l.codes = codes.filter((c) => c.product_id === l.product_id).map((c) => c.raw);
  doc.fiscal = db.prepare(
    'SELECT * FROM fiscal_receipts WHERE document_id = ? ORDER BY id',
  ).all(id);
  doc.linked = db.prepare(
    `SELECT id, type, number, moment, sum, posted FROM documents
     WHERE base_id = ? OR id = ? ORDER BY moment`,
  ).all(id, doc.base_id ?? 0);
  return doc;
}

export function saveDocument(db, data, userId, id = null) {
  const existing = id ? db.prepare('SELECT * FROM documents WHERE id = ?').get(id) : null;
  if (id && !existing) throw new HttpError(404, 'Belge bulunamadı');
  const type = existing ? existing.type : data.type;
  const t = DOC_TYPES[type];
  if (!t) throw new HttpError(400, 'Bilinmeyen belge türü');

  const counterpartyId = idOrNull(data.counterparty_id);
  const warehouseId = idOrNull(data.warehouse_id);
  const targetId = idOrNull(data.target_warehouse_id);
  if (t.counterparty && !counterpartyId) throw new HttpError(400, 'Cari seçilmelidir');
  if (t.warehouse && !warehouseId) throw new HttpError(400, 'Depo seçilmelidir');
  if (t.targetWarehouse) {
    if (!targetId) throw new HttpError(400, 'Hedef depo seçilmelidir');
    if (targetId === warehouseId) throw new HttpError(400, 'Kaynak ve hedef depo aynı olamaz');
  }

  const lines = t.lines
    ? (data.lines || []).filter((l) => l && l.product_id).map((l, i) => ({
        product_id: Number(l.product_id),
        qty: num(l.qty),
        actual_qty: t.inventory ? num(l.actual_qty) : null,
        price: num(l.price),
        vat: num(l.vat),
        position: i,
        codes: Array.isArray(l.codes) ? l.codes.map(String).filter((c) => c.trim()) : [],
      }))
    : [];
  if (!t.inventory && lines.some((l) => l.qty <= 0)) throw new HttpError(400, 'Miktar sıfırdan büyük olmalıdır');
  if (lines.some((l) => l.price < 0)) throw new HttpError(400, 'Fiyat negatif olamaz');
  if (!t.lines && num(data.sum) <= 0) throw new HttpError(400, 'Tutar sıfırdan büyük olmalıdır');

  const status = t.statuses ? (t.statuses.includes(data.status) ? data.status : t.statuses[0]) : '';
  const fields = {
    number: String(data.number || '').trim() || existing?.number || nextNumber(db, type),
    moment: String(data.moment || '').trim().replace('T', ' ').slice(0, 16) || existing?.moment || nowMoment(),
    counterparty_id: counterpartyId,
    warehouse_id: t.warehouse ? warehouseId : null,
    target_warehouse_id: t.targetWarehouse ? targetId : null,
    base_id: existing ? existing.base_id : idOrNull(data.base_id),
    status,
    account: t.account ? String(data.account || 'Kasa') : '',
    category: t.category ? String(data.category || '') : '',
    posted: data.posted === undefined ? 1 : (data.posted ? 1 : 0),
    comment: String(data.comment || ''),
  };

  // Честный знак kodları: işlenmiş belgede tam doğrulama, taslakta yalnızca biçim kontrolü.
  const lineCodes = t.lines ? validateLineCodes(db, type, lines, id, { posted: !!fields.posted }) : [];

  return tx(db, () => {
    let docId = id;
    if (existing) {
      db.prepare(
        `UPDATE documents SET number=$number, moment=$moment, counterparty_id=$counterparty_id,
           warehouse_id=$warehouse_id, target_warehouse_id=$target_warehouse_id, base_id=$base_id,
           status=$status, account=$account, category=$category, posted=$posted, comment=$comment,
           updated_at=datetime('now')
         WHERE id=$id`,
      ).run({ ...fields, id });
      db.prepare('DELETE FROM document_lines WHERE document_id = ?').run(id);
      db.prepare('DELETE FROM line_codes WHERE document_id = ?').run(id);
    } else {
      docId = Number(db.prepare(
        `INSERT INTO documents (type, number, moment, counterparty_id, warehouse_id, target_warehouse_id, base_id,
           status, account, category, posted, comment, created_by)
         VALUES ($type, $number, $moment, $counterparty_id, $warehouse_id, $target_warehouse_id, $base_id,
           $status, $account, $category, $posted, $comment, $created_by)`,
      ).run({ ...fields, type, created_by: userId ?? null }).lastInsertRowid);
    }

    const ins = db.prepare(
      `INSERT INTO document_lines (document_id, product_id, qty, actual_qty, price, vat, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let sum = 0;
    for (const l of lines) {
      // Sayımda satır miktarı = sayılan - mevcut stok (fark kaydı).
      if (t.inventory) l.qty = l.actual_qty - stockOf(db, warehouseId, l.product_id, docId);
      ins.run(docId, l.product_id, l.qty, l.actual_qty, l.price, l.vat, l.position);
      sum += l.qty * l.price;
    }
    const insCode = db.prepare('INSERT INTO line_codes (document_id, product_id, cis, raw, gtin) VALUES (?, ?, ?, ?, ?)');
    for (const lc of lineCodes) for (const c of lc.codes) insCode.run(docId, lc.product_id, c.cis, c.raw, c.gtin);
    if (!t.lines) sum = num(data.sum);
    db.prepare('UPDATE documents SET sum = ? WHERE id = ?').run(round2(sum), docId);
    return getDocument(db, docId);
  });
}

export function deleteDocument(db, id) {
  const r = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'Belge bulunamadı');
}

// Bir belgeden bağlı yeni belge taslağı üretir (ör. sipariş → sevkiyat, sevkiyat → tahsilat).
export function deriveDocument(db, id, targetType) {
  const src = getDocument(db, id);
  const t = DOC_TYPES[targetType];
  if (!t || !(DOC_TYPES[src.type].derive || []).includes(targetType)) {
    throw new HttpError(400, 'Bu belgeden bu tür oluşturulamaz');
  }
  const draft = {
    type: targetType,
    base_id: src.id,
    counterparty_id: src.counterparty_id,
    warehouse_id: src.warehouse_id,
    comment: `${DOC_TYPES[src.type].single} №${src.number} esas alınarak`,
  };
  if (t.lines) {
    draft.lines = src.lines.map((l) => ({
      product_id: l.product_id, product: l.product, unit: l.unit, qty: l.qty, price: l.price, vat: l.vat,
      marking: l.marking, barcode: l.barcode, codes: l.codes,
    }));
  } else {
    const paid = db.prepare(
      "SELECT COALESCE(SUM(sum), 0) AS s FROM documents WHERE base_id = ? AND posted = 1 AND type IN ('paymentin','paymentout')",
    ).get(src.id).s;
    draft.sum = round2(Math.max(src.sum - paid, 0));
    draft.account = 'Kasa';
    draft.category = targetType === 'paymentin' ? 'Müşteri tahsilatı' : 'Tedarikçi ödemesi';
  }
  return draft;
}

export function dayAfter(day) {
  const d = new Date(`${String(day).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '9999-12-31';
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
