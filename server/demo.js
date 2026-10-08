import { saveDocument } from './documents.js';

// Boş bir veritabanına örnek ürünler, cariler ve son 30 güne yayılmış belgeler ekler.
export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n) return false;
  const ins = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid);

  const g = {
    icecek: ins('INSERT INTO product_groups (name) VALUES (?)', 'İçecek'),
    gida: ins('INSERT INTO product_groups (name) VALUES (?)', 'Gıda'),
    temizlik: ins('INSERT INTO product_groups (name) VALUES (?)', 'Temizlik'),
  };
  const products = [
    ['Türk kahvesi 100 g', 'KH-100', '8690000000017', g.icecek, 32, 55, 10, 20],
    ['Siyah çay 1 kg', 'CY-1000', '8690000000024', g.icecek, 140, 210, 10, 15],
    ['Maden suyu 200 ml', 'MS-200', '8690000000031', g.icecek, 4, 9, 10, 100],
    ['Zeytinyağı 1 L', 'ZY-1000', '8690000000048', g.gida, 260, 380, 10, 10],
    ['Bal 450 g', 'BL-450', '8690000000055', g.gida, 180, 275, 10, 8],
    ['Makarna 500 g', 'MK-500', '8690000000062', g.gida, 14, 24, 10, 50],
    ['Bulaşık deterjanı 750 ml', 'BD-750', '8690000000079', g.temizlik, 38, 65, 20, 20],
    ['Çamaşır suyu 1 L', 'CS-1000', '8690000000086', g.temizlik, 22, 39, 20, 25],
  ].map(([name, code, barcode, group, buy, sale, vat, min]) => ({
    id: ins(
      'INSERT INTO products (name, code, article, barcode, group_id, buy_price, sale_price, vat, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      name, code, code, barcode, group, buy, sale, vat, min,
    ),
    buy, sale, vat,
  }));
  ins("INSERT INTO products (name, code, unit, sale_price, vat, is_service) VALUES ('Kargo hizmeti', 'HZ-KARGO', 'hizmet', 75, 20, 1)");

  const main = 1;
  const shop = ins('INSERT INTO warehouses (name, address) VALUES (?, ?)', 'Mağaza', 'Kadıköy, İstanbul');
  const sup1 = ins("INSERT INTO counterparties (name, roles, tax_office, tax_no, phone) VALUES ('Anadolu Gıda Toptan A.Ş.', 'supplier', 'Kozyatağı', '1234567890', '0216 000 00 01')");
  const sup2 = ins("INSERT INTO counterparties (name, roles, tax_office, tax_no, phone) VALUES ('Temiz Kimya Ltd. Şti.', 'supplier', 'Ümraniye', '2345678901', '0216 000 00 02')");
  const cus1 = ins("INSERT INTO counterparties (name, roles, phone, email) VALUES ('Lezzet Kafe', 'customer', '0532 000 00 03', 'info@lezzetkafe.example')");
  const cus2 = ins("INSERT INTO counterparties (name, roles, phone) VALUES ('Yıldız Market', 'customer', '0533 000 00 04')");
  const cus3 = ins("INSERT INTO counterparties (name, kind, roles, phone) VALUES ('Ayşe Demir', 'person', 'customer', '0534 000 00 05')");
  const owner = ins("INSERT INTO counterparties (name, kind, comment) VALUES ('Mehmet Yılmaz', 'person', 'Şirket ortağı')");
  const landlord = ins("INSERT INTO counterparties (name, roles) VALUES ('Kadıköy Emlak', 'supplier')");

  const day = (offset, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.toISOString().slice(0, 10)} ${String(hour).padStart(2, '0')}:00`;
  };
  const line = (p, qty, kind = 'buy') => ({ product_id: p.id, qty, price: kind === 'buy' ? p.buy : p.sale, vat: p.vat });
  const save = (doc) => saveDocument(db, doc, 1);
  const P = products;

  save({ type: 'paymentin', moment: day(30), counterparty_id: owner, sum: 50000, account: 'Banka', category: 'Sermaye', comment: 'Ortak sermaye girişi' });
  save({ type: 'supply', moment: day(29), counterparty_id: sup1, warehouse_id: main,
    lines: [line(P[0], 60), line(P[1], 30), line(P[2], 300), line(P[3], 25), line(P[4], 20), line(P[5], 150)] });
  save({ type: 'supply', moment: day(28), counterparty_id: sup2, warehouse_id: main,
    lines: [line(P[6], 50), line(P[7], 60)] });
  save({ type: 'move', moment: day(27), warehouse_id: main, target_warehouse_id: shop,
    lines: [line(P[0], 15), line(P[2], 80), line(P[5], 40), line(P[6], 10)] });
  save({ type: 'paymentout', moment: day(25), counterparty_id: sup1, sum: 15000, account: 'Banka', category: 'Tedarikçi ödemesi' });
  save({ type: 'paymentout', moment: day(20), counterparty_id: sup2, sum: 3200, account: 'Banka', category: 'Tedarikçi ödemesi' });

  const customers = [cus1, cus2, cus3];
  for (let i = 0; i < 12; i++) {
    const offset = 26 - i * 2;
    const cp = customers[i % 3];
    const items = [line(P[i % 6], 2 + (i % 4), 'sale'), line(P[(i + 3) % 8], 1 + (i % 3), 'sale')];
    const order = save({ type: 'customerorder', moment: day(offset, 9), counterparty_id: cp, warehouse_id: main,
      status: i < 10 ? 'Teslim edildi' : 'Onaylandı', lines: items });
    if (i < 10) {
      const dem = save({ type: 'demand', moment: day(offset, 15), counterparty_id: cp, warehouse_id: main, base_id: order.id, lines: items });
      if (i % 3 !== 2) save({ type: 'paymentin', moment: day(Math.max(offset - 1, 0), 11), counterparty_id: cp, base_id: dem.id, sum: dem.sum, account: i % 2 ? 'Kasa' : 'Banka', category: 'Müşteri tahsilatı' });
    }
  }
  for (let i = 0; i < 20; i++) {
    save({ type: 'retaildemand', moment: day(i, 12 + (i % 6)), warehouse_id: shop, account: i % 2 ? 'Kasa' : 'Banka',
      counterparty_id: 1, lines: [line(P[[0, 2, 5, 6][i % 4]], 1 + (i % 3), 'sale')] });
  }
  save({ type: 'loss', moment: day(10), warehouse_id: main, comment: 'Kırık şişe', lines: [line(P[2], 6)] });
  save({ type: 'paymentout', moment: day(5), counterparty_id: landlord, sum: 12000, account: 'Banka', category: 'Kira', comment: 'Depo kirası' });
  save({ type: 'purchaseorder', moment: day(2), counterparty_id: sup1, warehouse_id: main, status: 'Onaylandı',
    lines: [line(P[3], 20), line(P[4], 15)] });
  return true;
}
