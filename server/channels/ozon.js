// Ozon Seller API (FBS — satıcı deposundan): https://api-seller.ozon.ru, başlıklar Client-Id + Api-Key.
// Ürün eşleştirme gerekmez: offer_id = Vordi ürününün артикул'u (yoksa kodu).
import { request, chunks, required } from './http.js';

const BASE = 'https://api-seller.ozon.ru';
const headers = (cfg) => ({ 'Client-Id': String(cfg.client_id), 'Api-Key': String(cfg.api_key) });
const check = (cfg) => required(cfg, ['client_id', 'api_key', 'warehouse_id']);

export default {
  type: 'ozon',
  title: 'Ozon',
  marketplace: true,
  fields: [
    { key: 'client_id', label: 'Client-Id' },
    { key: 'api_key', label: 'Api-Key', secret: true },
    { key: 'warehouse_id', label: 'Ozon depo ID (FBS)' },
  ],

  async pushStock(ctx, items) {
    check(ctx.cfg);
    // Ozon: istek başına en fazla 100 ürün.
    for (const part of chunks(items, 100)) {
      await request(ctx, 'POST', `${BASE}/v2/products/stocks`, {
        headers: headers(ctx.cfg),
        body: { stocks: part.map((i) => ({ offer_id: i.external_id, stock: i.available, warehouse_id: Number(ctx.cfg.warehouse_id) })) },
      });
    }
    return items.length;
  },

  async fetchOrders(ctx, since) {
    check(ctx.cfg);
    const orders = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const r = await request(ctx, 'POST', `${BASE}/v3/posting/fbs/list`, {
        headers: headers(ctx.cfg),
        body: { dir: 'ASC', filter: { since, to: ctx.now.toISOString() }, limit: 100, offset, with: {} },
      });
      const postings = r?.result?.postings ?? [];
      for (const p of postings) {
        orders.push({
          external_id: `ozon:${p.posting_number}`,
          number: p.posting_number,
          status: p.status === 'cancelled' ? 'cancelled' : 'new',
          comment: `Ozon ${p.posting_number}`,
          items: (p.products ?? []).map((x) => ({ sku: x.offer_id, qty: Number(x.quantity), price: Number(x.price) })),
        });
      }
      if (!r?.result?.has_next) break;
    }
    return { orders };
  },
};
