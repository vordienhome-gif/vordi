// Satış kanalları senkronizasyonu: siparişleri içeri alır, stokları dışarı gönderir.
// Akış: siparişler → Vordi'de "müşteri siparişi" (stok rezerve eder) → kullanılabilir stok kanallara gönderilir.
import insales from './insales.js';
import ozon from './ozon.js';
import wildberries from './wildberries.js';
import yandex from './yandex.js';
import { HttpError, saveDocument } from '../documents.js';
import { stockReport } from '../reports.js';
import { findOrCreateCustomer } from '../publicapi.js';
import { DOC_TYPES } from '../doctypes.js';

export const ADAPTERS = Object.fromEntries([insales, ozon, wildberries, yandex].map((a) => [a.type, a]));
const LOOKBACK_DAYS = 3;
const MASK = '••••••';

export function channelTypes() {
  return Object.values(ADAPTERS).map((a) => ({
    type: a.type, title: a.title, marketplace: a.marketplace, fields: a.fields, needsMapping: !!a.catalog,
  }));
}

const getChannel = (db, id) => {
  const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  if (!ch) throw new HttpError(404, 'Kanal bulunamadı');
  return { ...ch, config: JSON.parse(ch.config || '{}') };
};

// Gizli alanlar (API anahtarları) arayüze maskelenmiş döner.
function publicView(db, ch) {
  const a = ADAPTERS[ch.type];
  const config = { ...ch.config };
  for (const f of a?.fields ?? []) if (f.secret && config[f.key]) config[f.key] = MASK + String(config[f.key]).slice(-4);
  const mapped = db.prepare('SELECT COUNT(*) AS n FROM channel_offers WHERE channel_id = ?').get(ch.id).n;
  return { ...ch, config, mapped, title: a?.title ?? ch.type };
}

export function listChannels(db) {
  return db.prepare('SELECT * FROM channels ORDER BY id').all()
    .map((c) => publicView(db, { ...c, config: JSON.parse(c.config || '{}') }));
}

export function saveChannel(db, body, id = null) {
  const old = id ? getChannel(db, id) : null;
  const type = old?.type ?? body.type;
  const a = ADAPTERS[type];
  if (!a) throw new HttpError(400, 'Bilinmeyen kanal türü');
  const config = { ...(old?.config ?? {}) };
  for (const f of a.fields) {
    const v = body.config?.[f.key];
    if (v === undefined || (f.secret && String(v).startsWith(MASK))) continue;
    config[f.key] = String(v).trim();
  }
  let counterpartyId = body.counterparty_id ? Number(body.counterparty_id) : old?.counterparty_id ?? null;
  // Pazaryeri siparişlerinin carisi pazaryerinin kendisidir (ör. "Ozon").
  if (!counterpartyId && a.marketplace) {
    counterpartyId = db.prepare('SELECT id FROM counterparties WHERE name = ? AND archived = 0').get(a.title)?.id
      ?? Number(db.prepare("INSERT INTO counterparties (name, roles, comment) VALUES (?, 'customer', 'Pazaryeri')").run(a.title).lastInsertRowid);
  }
  const row = {
    name: String(body.name ?? old?.name ?? a.title).trim() || a.title,
    enabled: body.enabled === undefined ? (old?.enabled ?? 1) : (body.enabled ? 1 : 0),
    config: JSON.stringify(config),
    warehouse_id: body.warehouse_id ? Number(body.warehouse_id) : old?.warehouse_id ?? null,
    counterparty_id: counterpartyId,
  };
  if (old) {
    db.prepare(`UPDATE channels SET name = $name, enabled = $enabled, config = $config, warehouse_id = $warehouse_id,
      counterparty_id = $counterparty_id WHERE id = $id`).run({ ...row, id });
    return publicView(db, getChannel(db, id));
  }
  const newId = Number(db.prepare(`INSERT INTO channels (type, name, enabled, config, warehouse_id, counterparty_id)
    VALUES ($type, $name, $enabled, $config, $warehouse_id, $counterparty_id)`).run({ ...row, type }).lastInsertRowid);
  return publicView(db, getChannel(db, newId));
}

const log = (db, channelId, message, level = 'info') =>
  db.prepare('INSERT INTO channel_log (channel_id, level, message) VALUES (?, ?, ?)').run(channelId, level, String(message).slice(0, 1000));

export const channelLog = (db, id) =>
  db.prepare('SELECT level, message, created_at FROM channel_log WHERE channel_id = ? ORDER BY id DESC LIMIT 200').all(id);

const productKey = (p) => p.article || p.code;

// Kanal kataloğunu Vordi ürünleriyle артикул/SKU veya barkod üzerinden eşleştirir.
export async function mapChannel(db, id, { fetchImpl = fetch, now = new Date() } = {}) {
  const ch = getChannel(db, id);
  const a = ADAPTERS[ch.type];
  if (!a.catalog) return { mapped: 0, unmatched: 0, note: 'Bu kanal eşleştirme gerektirmez (артикул kullanılır)' };
  const catalog = await a.catalog({ cfg: ch.config, fetch: fetchImpl, now });
  const products = db.prepare('SELECT id, article, code, barcode FROM products WHERE archived = 0').all();
  const byKey = new Map();
  for (const p of products) {
    for (const k of [p.article, p.code, p.barcode]) if (k) byKey.set(String(k), p.id);
  }
  const up = db.prepare('INSERT INTO channel_offers (channel_id, product_id, external_id) VALUES (?, ?, ?) ON CONFLICT(channel_id, product_id) DO UPDATE SET external_id = excluded.external_id');
  let mapped = 0;
  let unmatched = 0;
  for (const item of catalog) {
    const pid = [item.sku, item.barcode, ...(item.barcodes ?? [])].filter(Boolean).map(String).map((k) => byKey.get(k)).find(Boolean);
    if (pid) { up.run(ch.id, pid, item.external_id); mapped++; } else unmatched++;
  }
  log(db, ch.id, `Eşleştirme: ${mapped} ürün eşleşti, ${unmatched} kanal ürünü eşleşmedi`);
  return { mapped, unmatched };
}

function importOrder(db, ch, a, order) {
  const existing = db.prepare("SELECT id, status FROM documents WHERE type = 'customerorder' AND external_id = ?").get(order.external_id);
  if (existing) {
    if (order.status === 'cancelled' && !DOC_TYPES.customerorder.closed.includes(existing.status)) {
      db.prepare("UPDATE documents SET status = 'İptal', updated_at = datetime('now') WHERE id = ?").run(existing.id);
      log(db, ch.id, `Sipariş iptal edildi: ${order.external_id}`);
      return 'cancelled';
    }
    return 'exists';
  }
  if (order.status === 'cancelled') return 'skipped';

  const byExternal = new Map(db.prepare('SELECT product_id, external_id FROM channel_offers WHERE channel_id = ?').all(ch.id)
    .map((r) => [r.external_id, r.product_id]));
  const lines = [];
  for (const it of order.items) {
    let pid = it.external_id ? byExternal.get(String(it.external_id)) : undefined;
    if (!pid && it.sku) {
      pid = db.prepare("SELECT id FROM products WHERE archived = 0 AND (article = ? OR code = ? OR barcode = ?) LIMIT 1")
        .get(String(it.sku), String(it.sku), String(it.sku))?.id;
    }
    if (!pid) {
      log(db, ch.id, `Sipariş ${order.external_id} atlandı: ürün bulunamadı (${it.sku || it.external_id})`, 'error');
      return 'error';
    }
    const p = db.prepare('SELECT vat, sale_price FROM products WHERE id = ?').get(pid);
    const ex = lines.find((l) => l.product_id === pid);
    if (ex) ex.qty += it.qty; else lines.push({ product_id: pid, qty: it.qty, price: Number.isFinite(it.price) && it.price > 0 ? it.price : p.sale_price, vat: p.vat });
  }
  const counterpartyId = a.marketplace ? ch.counterparty_id : (ch.counterparty_id ?? findOrCreateCustomer(db, order.customer));
  const warehouseId = ch.warehouse_id ?? db.prepare('SELECT id FROM warehouses WHERE archived = 0 ORDER BY id LIMIT 1').get()?.id;
  const doc = saveDocument(db, { type: 'customerorder', counterparty_id: counterpartyId, warehouse_id: warehouseId, comment: order.comment, lines }, null);
  db.prepare('UPDATE documents SET external_id = ? WHERE id = ?').run(order.external_id, doc.id);
  return 'created';
}

export async function syncChannel(db, id, { fetchImpl = fetch, now = new Date() } = {}) {
  const ch = getChannel(db, id);
  const a = ADAPTERS[ch.type];
  const ctx = { cfg: ch.config, fetch: fetchImpl, now };
  const result = { created: 0, cancelled: 0, errors: 0, stock: 0 };
  try {
    // 1) Siparişler. Pazaryerlerinde iptalleri yakalamak için son birkaç gün tekrar okunur (içe aktarma idempotenttir).
    const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 86400000).toISOString();
    const since = a.marketplace ? lookback : (ch.orders_since || lookback);
    const { orders, cursor } = await a.fetchOrders(ctx, since);
    for (const o of orders) {
      const r = importOrder(db, ch, a, o);
      if (r === 'created') result.created++;
      if (r === 'cancelled') result.cancelled++;
      if (r === 'error') result.errors++;
    }
    if (cursor) db.prepare('UPDATE channels SET orders_since = ? WHERE id = ?').run(cursor, ch.id);

    // 2) Stoklar: kanalın deposundaki kullanılabilir miktar (stok − rezerv), negatifse 0.
    const offers = new Map(db.prepare('SELECT product_id, external_id FROM channel_offers WHERE channel_id = ?').all(ch.id)
      .map((r) => [r.product_id, r.external_id]));
    const items = stockReport(db, { warehouse_id: ch.warehouse_id ?? '' })
      .map((r) => ({ product_id: r.id, external_id: a.catalog ? offers.get(r.id) : productKey(r), available: Math.max(0, Math.floor(r.available)) }))
      .filter((i) => i.external_id);
    result.stock = items.length ? await a.pushStock(ctx, items) : 0;

    db.prepare("UPDATE channels SET last_sync_at = datetime('now'), last_error = '' WHERE id = ?").run(ch.id);
    log(db, ch.id, `Senkronizasyon: ${result.created} yeni sipariş, ${result.cancelled} iptal, ${result.errors} hatalı, ${result.stock} ürün stoğu gönderildi`,
      result.errors ? 'error' : 'info');
  } catch (e) {
    db.prepare("UPDATE channels SET last_sync_at = datetime('now'), last_error = ? WHERE id = ?").run(String(e.message).slice(0, 500), ch.id);
    log(db, ch.id, e.message, 'error');
    throw new HttpError(502, `Kanal hatası: ${e.message}`);
  }
  return result;
}

export async function syncAll(db, opts) {
  for (const { id } of db.prepare('SELECT id FROM channels WHERE enabled = 1').all()) {
    try { await syncChannel(db, id, opts); } catch { /* hata kanal kaydına yazıldı */ }
  }
}
