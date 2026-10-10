// Wildberries API: marketplace-api (FBS siparişleri ve satıcı deposu stokları) + content-api (kartlar).
// Stok güncellemesi beden kimliği (chrtId) ile yapılır; bu yüzden ürünler önce eşleştirilmelidir.
import { request, chunks, required } from './http.js';

const MP = 'https://marketplace-api.wildberries.ru';
const CONTENT = 'https://content-api.wildberries.ru';
const headers = (cfg) => ({ Authorization: String(cfg.token) });
const check = (cfg) => required(cfg, ['token', 'warehouse_id']);

export default {
  type: 'wildberries',
  title: 'Wildberries',
  marketplace: true,
  fields: [
    { key: 'token', label: 'API token', secret: true },
    { key: 'warehouse_id', label: 'WB satıcı deposu ID' },
  ],

  async catalog(ctx) {
    required(ctx.cfg, ['token']);
    const out = [];
    let cursor = { limit: 100 };
    for (let i = 0; i < 200; i++) {
      const r = await request(ctx, 'POST', `${CONTENT}/content/v2/get/cards/list`, {
        headers: headers(ctx.cfg), body: { settings: { cursor, filter: { withPhoto: -1 } } },
      });
      for (const card of r?.cards ?? []) {
        for (const size of card.sizes ?? []) {
          out.push({ external_id: String(size.chrtID), sku: card.vendorCode ?? '', barcodes: size.skus ?? [] });
        }
      }
      const c = r?.cursor;
      if (!c || (c.total ?? 0) < 100) break;
      cursor = { limit: 100, updatedAt: c.updatedAt, nmID: c.nmID };
    }
    return out;
  },

  async pushStock(ctx, items) {
    check(ctx.cfg);
    for (const part of chunks(items, 1000)) {
      await request(ctx, 'PUT', `${MP}/api/v3/stocks/${encodeURIComponent(ctx.cfg.warehouse_id)}`, {
        headers: headers(ctx.cfg), body: { stocks: part.map((i) => ({ chrtId: Number(i.external_id), amount: i.available })) },
      });
    }
    return items.length;
  },

  async fetchOrders(ctx) {
    check(ctx.cfg);
    const r = await request(ctx, 'GET', `${MP}/api/v3/orders/new`, { headers: headers(ctx.cfg) });
    // WB'de her sipariş tek bir üründür; fiyat kuruş cinsindendir (×100).
    const orders = (r?.orders ?? []).map((o) => ({
      external_id: `wb:${o.id}`,
      number: String(o.id),
      status: 'new',
      comment: `Wildberries ${o.id}`,
      items: [{ external_id: String(o.chrtId ?? ''), sku: o.article, qty: 1, price: Number(o.convertedPrice ?? o.price ?? 0) / 100 }],
    }));
    return { orders };
  },
};
