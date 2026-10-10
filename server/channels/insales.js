// InSales: https://{domain}/admin/*.json, Basic auth (API identifier + parola).
// Ürün eşleştirme: InSales varyant id ↔ Vordi ürünü (SKU/артикул veya barkod ile).
import { request, chunks, required } from './http.js';

const base = (cfg) => `https://${String(cfg.domain).replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
const auth = (cfg) => ({ Authorization: `Basic ${Buffer.from(`${cfg.api_id}:${cfg.api_password}`).toString('base64')}` });
const check = (cfg) => required(cfg, ['domain', 'api_id', 'api_password']);

export default {
  type: 'insales',
  title: 'InSales',
  marketplace: false,
  fields: [
    { key: 'domain', label: 'Mağaza adresi (ör. myshop.myinsales.ru)' },
    { key: 'api_id', label: 'API identifier' },
    { key: 'api_password', label: 'API parola', secret: true },
  ],

  async catalog(ctx) {
    check(ctx.cfg);
    const out = [];
    for (let page = 1; page <= 100; page++) {
      const products = await request(ctx, 'GET', `${base(ctx.cfg)}/admin/products.json?page=${page}&per_page=250`, { headers: auth(ctx.cfg) });
      if (!Array.isArray(products) || !products.length) break;
      for (const p of products) for (const v of p.variants ?? []) out.push({ external_id: String(v.id), sku: v.sku ?? '', barcode: v.barcode ?? '' });
    }
    return out;
  },

  async pushStock(ctx, items) {
    check(ctx.cfg);
    for (const part of chunks(items, 100)) {
      await request(ctx, 'PUT', `${base(ctx.cfg)}/admin/products/variants_group_update.json`, {
        headers: auth(ctx.cfg), body: { variants: part.map((i) => ({ id: Number(i.external_id), quantity: i.available })) },
      });
    }
    return items.length;
  },

  async fetchOrders(ctx, since) {
    check(ctx.cfg);
    const orders = [];
    let cursor = since;
    for (let page = 1; page <= 50; page++) {
      const list = await request(ctx, 'GET',
        `${base(ctx.cfg)}/admin/orders.json?updated_since=${encodeURIComponent(since)}&per_page=100&page=${page}`, { headers: auth(ctx.cfg) });
      if (!Array.isArray(list) || !list.length) break;
      for (const o of list) {
        if (o.updated_at && o.updated_at > cursor) cursor = o.updated_at;
        const c = o.client ?? {};
        orders.push({
          external_id: `insales:${o.id}`,
          number: o.number,
          status: ['declined', 'returned'].includes(o.fulfillment_status) ? 'cancelled' : 'new',
          customer: { name: [c.surname, c.name, c.middlename].filter(Boolean).join(' ') || c.name || `InSales #${o.number}`, phone: c.phone, email: c.email },
          comment: [`InSales №${o.number}`, o.comment].filter(Boolean).join('\n'),
          items: (o.order_lines ?? []).map((l) => ({ external_id: String(l.variant_id), sku: l.sku, qty: Number(l.quantity), price: Number(l.sale_price) })),
        });
      }
      if (list.length < 100) break;
    }
    return { orders, cursor };
  },
};
