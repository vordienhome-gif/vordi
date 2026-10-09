import { saveDocument, localDay } from './documents.js';

// Boş bir veritabanına örnek ürünler, cariler ve son 30 güne yayılmış belgeler ekler.
export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n) return false;
  const ins = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid);

  const g = {
    icecek: ins('INSERT INTO product_groups (name) VALUES (?)', 'Напитки'),
    gida: ins('INSERT INTO product_groups (name) VALUES (?)', 'Продукты'),
    temizlik: ins('INSERT INTO product_groups (name) VALUES (?)', 'Бытовая химия'),
  };
  const products = [
    ['Кофе молотый 250 г', 'KF-250', '4600000000017', g.icecek, 320, 549, 22, 20],
    ['Чай чёрный турецкий 1 кг', 'CH-1000', '4600000000024', g.icecek, 690, 1090, 22, 15],
    ['Минеральная вода 0,5 л', 'MV-500', '4600000000031', g.icecek, 38, 79, 22, 100],
    ['Оливковое масло 1 л', 'OM-1000', '4600000000048', g.gida, 890, 1390, 10, 10],
    ['Мёд цветочный 450 г', 'MD-450', '4600000000055', g.gida, 420, 690, 10, 8],
    ['Макароны 500 г', 'MK-500', '4600000000062', g.gida, 65, 119, 10, 50],
    ['Средство для посуды 750 мл', 'SP-750', '4600000000079', g.temizlik, 140, 249, 22, 20],
    ['Отбеливатель 1 л', 'OT-1000', '4600000000086', g.temizlik, 95, 169, 22, 25],
  ].map(([name, code, barcode, group, buy, sale, vat, min]) => ({
    id: ins(
      'INSERT INTO products (name, code, article, barcode, group_id, buy_price, sale_price, vat, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      name, code, code, barcode, group, buy, sale, vat, min,
    ),
    buy, sale, vat,
  }));
  ins("INSERT INTO products (name, code, unit, sale_price, vat, is_service) VALUES ('Доставка', 'US-DOST', 'услуга', 350, 22, 1)");

  const main = 1;
  const shop = ins('INSERT INTO warehouses (name, address) VALUES (?, ?)', 'Магазин', 'Москва, ул. Тверская, 1');
  const sup1 = ins("INSERT INTO counterparties (name, roles, tax_office, tax_no, phone) VALUES ('ООО «Анатолия Трейд»', 'supplier', '770101001', '7701234567', '+7 495 000-00-01')");
  const sup2 = ins("INSERT INTO counterparties (name, roles, tax_office, tax_no, phone) VALUES ('ООО «ЧистоХим»', 'supplier', '500101001', '5001234567', '+7 495 000-00-02')");
  const cus1 = ins("INSERT INTO counterparties (name, roles, phone, email) VALUES ('Кафе «Лезет»', 'customer', '+7 916 000-00-03', 'info@lezzet.example')");
  const cus2 = ins("INSERT INTO counterparties (name, roles, phone) VALUES ('Магазин «Звезда»', 'customer', '+7 916 000-00-04')");
  const cus3 = ins("INSERT INTO counterparties (name, kind, roles, phone) VALUES ('Иванова Анна', 'person', 'customer', '+7 916 000-00-05')");
  const owner = ins("INSERT INTO counterparties (name, kind, comment) VALUES ('Йылмаз Мехмет', 'person', 'Учредитель')");
  const landlord = ins("INSERT INTO counterparties (name, roles) VALUES ('ИП Арендодатель', 'supplier')");

  const day = (offset, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${localDay(d)} ${String(hour).padStart(2, '0')}:00`;
  };
  const line = (p, qty, kind = 'buy') => ({ product_id: p.id, qty, price: kind === 'buy' ? p.buy : p.sale, vat: p.vat });
  const save = (doc) => saveDocument(db, doc, 1);
  const P = products;

  save({ type: 'paymentin', moment: day(30), counterparty_id: owner, sum: 500000, account: 'Banka', category: 'Sermaye', comment: 'Взнос учредителя' });
  save({ type: 'supply', moment: day(29), counterparty_id: sup1, warehouse_id: main,
    lines: [line(P[0], 60), line(P[1], 30), line(P[2], 300), line(P[3], 25), line(P[4], 20), line(P[5], 150)] });
  save({ type: 'supply', moment: day(28), counterparty_id: sup2, warehouse_id: main,
    lines: [line(P[6], 50), line(P[7], 60)] });
  save({ type: 'move', moment: day(27), warehouse_id: main, target_warehouse_id: shop,
    lines: [line(P[0], 15), line(P[2], 80), line(P[5], 40), line(P[6], 10)] });
  save({ type: 'paymentout', moment: day(25), counterparty_id: sup1, sum: 80000, account: 'Banka', category: 'Tedarikçi ödemesi' });
  save({ type: 'paymentout', moment: day(20), counterparty_id: sup2, sum: 12000, account: 'Banka', category: 'Tedarikçi ödemesi' });

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
  save({ type: 'loss', moment: day(10), warehouse_id: main, comment: 'Бой бутылок', lines: [line(P[2], 6)] });
  save({ type: 'paymentout', moment: day(5), counterparty_id: landlord, sum: 120000, account: 'Banka', category: 'Kira', comment: 'Аренда склада' });
  save({ type: 'purchaseorder', moment: day(2), counterparty_id: sup1, warehouse_id: main, status: 'Onaylandı',
    lines: [line(P[3], 20), line(P[4], 15)] });
  return true;
}
