// Яндекс Маркет Partner API: https://api.partner.market.yandex.ru, başlık Api-Key.
// Stok: PUT /v2/campaigns/{campaignId}/offers/stocks (depo grubu olan kabinetler için;
// grup yoksa Yandex v3 businesses/{businessId}/offers/stocks/update yöntemini önerir).
// SKU = Vordi ürününün артикул'u (yoksa kodu), katalogdakiyle birebir aynı olmalı.
import { request, chunks, required } from './http.js';

const BASE = 'https://api.partner.market.yandex.ru';
const headers = (cfg) => ({ 'Api-Key': String(cfg.api_key) });
const check = (cfg) => required(cfg, ['api_key', 'campaign_id']);
const ruDate = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

export default {
  type: 'yandex',
  title: 'Яндекс Маркет',
  marketplace: true,
  fields: [
    { key: 'api_key', label: 'Api-Key', secret: true },
    { key: 'campaign_id', label: 'Kampanya (mağaza) ID — campaignId' },
  ],

  async pushStock(ctx, items) {
    check(ctx.cfg);
    const updatedAt = ctx.now.toISOString();
    for (const part of chunks(items, 2000)) {
      await request(ctx, 'PUT', `${BASE}/v2/campaigns/${encodeURIComponent(ctx.cfg.campaign_id)}/offers/stocks`, {
        headers: headers(ctx.cfg),
        body: { skus: part.map((i) => ({ sku: i.external_id, items: [{ count: i.available, updatedAt }] })) },
      });
    }
    return items.length;
  },

  async fetchOrders(ctx, since) {
    check(ctx.cfg);
    const orders = [];
    const from = ruDate(new Date(since));
    for (let page = 1; page <= 50; page++) {
      const r = await request(ctx, 'GET',
        `${BASE}/v2/campaigns/${encodeURIComponent(ctx.cfg.campaign_id)}/orders?fromDate=${from}&page=${page}`, { headers: headers(ctx.cfg) });
      for (const o of r?.orders ?? []) {
        orders.push({
          external_id: `yandex:${o.id}`,
          number: String(o.id),
          status: o.status === 'CANCELLED' ? 'cancelled' : 'new',
          comment: `Яндекс Маркет ${o.id}`,
          items: (o.items ?? []).map((x) => ({ sku: x.offerId, qty: Number(x.count), price: Number(x.buyerPrice ?? x.price ?? 0) })),
        });
      }
      if (!r?.pager || page >= (r.pager.pagesCount ?? 1)) break;
    }
    return { orders };
  },
};
