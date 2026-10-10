// Честный знак (ГИС МТ) markalama kodları.
// Bir kodun (КИ/КМ) durumu, onu içeren en son işlenmiş belgeden türetilir:
// giriş belgeleri (mal kabul, giriş, müşteri iadesi) → stokta; çıkış belgeleri → satılmış/çıkmış.
import { HttpError } from './documents.js';

export const MARKING_TYPES = ['', 'lp', 'shoes', 'perfumery', 'tires', 'water', 'milk', 'other'];
const IN_TYPES = ['supply', 'enter', 'salesreturn'];
const OUT_TYPES = ['retaildemand', 'demand', 'loss', 'purchasereturn'];
const GS = '\u001d';

// DataMatrix içeriğini ayrıştırır: (01) 14 haneli GTIN + (21) seri numarası + kripto kuyruğu (91/92/93).
// Okuyucu, gruplar arasındaki GS (0x1D) karakterini göndermelidir; gönderilmezse seri, 13 karakter kabul edilir
// (giyim, ayakkabı, parfüm, lastik). Kodun benzersiz anahtarı (CIS) = 01 + GTIN + 21 + seri.
export function parseCode(input) {
  let raw = String(input ?? '').trim().replace(/^\]d2|^\]C1/, '').replace(/\\u001d|<GS>|\{GS\}/gi, GS);
  if (raw.startsWith(GS)) raw = raw.slice(1);
  const m = /^01(\d{14})21([^\u001d]+)/.exec(raw);
  if (!m) return null;
  let serial = m[2];
  if (!raw.includes(GS) && serial.length > 13) serial = serial.slice(0, 13);
  return { raw, gtin: m[1], serial, cis: `01${m[1]}21${serial}` };
}

const normGtin = (s) => String(s ?? '').replace(/\D/g, '').padStart(14, '0');
export const gtinMatches = (barcode, gtin) => /^\d{8,14}$/.test(String(barcode ?? '')) && normGtin(barcode) === gtin;

export function lastMove(db, cis, excludeDocId = 0) {
  return db.prepare(
    `SELECT d.id, d.type, d.number, d.moment FROM line_codes c JOIN documents d ON d.id = c.document_id
     WHERE c.cis = ? AND d.posted = 1 AND d.id != ? AND d.type IN (${[...IN_TYPES, ...OUT_TYPES].map((t) => `'${t}'`).join(',')})
     ORDER BY d.moment DESC, d.id DESC LIMIT 1`,
  ).get(cis, excludeDocId) ?? null;
}

export function codeStatus(db, cis) {
  const last = lastMove(db, cis);
  if (!last) return { status: 'unknown' };
  return { status: OUT_TYPES.includes(last.type) ? 'out' : 'in_stock', document: last };
}

// Belge satırlarındaki kodları doğrular; saveDocument tarafından kayıttan önce çağrılır.
// Dönen dizi: [{ product_id, codes: [parsed] }]
export function validateLineCodes(db, type, lines, docId, { posted = true } = {}) {
  const out = [];
  const seen = new Set();
  const marked = new Set();
  for (const l of lines) {
    const p = db.prepare('SELECT id, name, barcode, marking FROM products WHERE id = ?').get(l.product_id);
    if (!p?.marking) {
      if (l.codes?.length) throw new HttpError(400, `Ürün markalı değil: ${p?.name ?? l.product_id}`);
      continue;
    }
    if (marked.has(p.id)) throw new HttpError(400, `Markalı ürün belgede bir kez yer almalı: ${p.name}`);
    marked.add(p.id);
    const codes = (l.codes ?? []).map((c) => {
      const parsed = parseCode(c);
      if (!parsed) throw new HttpError(400, `Geçersiz markalama kodu: ${String(c).slice(0, 40)}`);
      if (p.barcode && /^\d{8,14}$/.test(p.barcode) && !gtinMatches(p.barcode, parsed.gtin)) {
        throw new HttpError(400, `Kod bu ürüne ait değil (GTIN ${parsed.gtin}): ${p.name}`);
      }
      if (seen.has(parsed.cis)) throw new HttpError(400, `Kod belgede iki kez okutuldu: ${parsed.cis}`);
      seen.add(parsed.cis);
      return parsed;
    });
    const needCodes = (posted && type === 'retaildemand') || codes.length > 0;
    if (needCodes && (codes.length !== l.qty || !Number.isInteger(l.qty))) {
      throw new HttpError(400, `Markalı ürün için her adede bir kod okutulmalı (${codes.length}/${l.qty}): ${p.name}`);
    }
    if (posted && OUT_TYPES.includes(type)) {
      for (const c of codes) {
        const last = lastMove(db, c.cis, docId ?? 0);
        if (last && OUT_TYPES.includes(last.type)) {
          throw new HttpError(400, `Kod zaten satılmış veya çıkmış: ${c.cis}`);
        }
      }
    }
    out.push({ product_id: p.id, codes });
  }
  return out;
}

// Разрешительный режим: satıştan önce kodların ГИС МТ'de satılabilir olduğunu kontrol eder.
// API modu: önce cdn/info ile CDN sunucuları alınır, sonra codes/check çağrılır (markirovka.crpt.ru adresi
// 17.10.2024'ten beri bu yöntem için kapalıdır). Alan adları ГИС МТ "True API" belgesine göre ayarlanmalı ve
// gerçek token ile doğrulanmalıdır.
export async function checkCodes(settings, rawCodes, fetchImpl = fetch) {
  const codes = rawCodes.map((c) => {
    const p = parseCode(c);
    if (!p) throw new HttpError(400, `Geçersiz markalama kodu: ${String(c).slice(0, 40)}`);
    return p;
  });
  const mode = settings.cz_mode || 'off';
  if (mode === 'off') return codes.map((c) => ({ cis: c.cis, ok: true, skipped: true }));
  if (mode === 'test') {
    return codes.map((c) => (/BLOCK/i.test(c.serial)
      ? { cis: c.cis, ok: false, reason: 'Satış yasaklı (test)' }
      : { cis: c.cis, ok: true }));
  }
  if (!settings.cz_token) throw new HttpError(400, 'Честный знак API anahtarı girilmemiş');
  const headers = { 'X-API-KEY': settings.cz_token, 'Content-Type': 'application/json' };
  const info = await (await fetchImpl('https://cdn.crpt.ru/api/v4/true-api/cdn/info', { headers })).json();
  const host = info?.hosts?.[0]?.host;
  if (!host) throw new HttpError(502, 'Честный знак: CDN sunucusu alınamadı');
  const res = await fetchImpl(`${host}/api/v4/true-api/codes/check`, {
    method: 'POST', headers, body: JSON.stringify({ codes: codes.map((c) => c.raw) }),
  });
  if (!res.ok) throw new HttpError(502, `Честный знак yanıtı: HTTP ${res.status}`);
  const body = await res.json();
  const today = new Date().toISOString();
  return codes.map((c, i) => {
    const r = (body.codes ?? []).find((x) => String(x.cis ?? '').startsWith(c.cis)) ?? body.codes?.[i];
    if (!r || r.found === false) return { cis: c.cis, ok: false, reason: 'Kod ГИС МТ sisteminde bulunamadı' };
    if (r.isBlocked) return { cis: c.cis, ok: false, reason: 'Satış resmi makam kararıyla engellendi' };
    if (r.sold) return { cis: c.cis, ok: false, reason: 'Kod daha önce satılmış' };
    if (r.realizable === false) return { cis: c.cis, ok: false, reason: 'Ürün dolaşıma girmemiş' };
    if (r.utilised === false) return { cis: c.cis, ok: false, reason: 'Kod uygulanmamış' };
    if (r.expireDate && r.expireDate < today) return { cis: c.cis, ok: false, reason: 'Son kullanma tarihi geçmiş' };
    return { cis: c.cis, ok: true };
  });
}
