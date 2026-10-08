// Belge türleri ve her türün stok, cari ve para üzerindeki etkisi.
//   stock:  +1 depoya giriş, -1 depodan çıkış (move: kaynaktan çıkış + hedefe giriş)
//   settle: cari bakiyesine etkisi (+ cari bize borçlanır, - biz cariye borçlanırız)
//   money:  kasa/banka bakiyesine etkisi
//   sale:   satış gelirine etkisi (kârlılık raporları)
export const DOC_TYPES = {
  purchaseorder: {
    section: 'purchase', title: 'Tedarikçi siparişleri', single: 'Tedarikçi siparişi', prefix: 'TS',
    lines: true, counterparty: true, warehouse: true, priceField: 'buy_price',
    statuses: ['Yeni', 'Onaylandı', 'Kabul edildi', 'İptal'], closed: ['Kabul edildi', 'İptal'],
    expect: true, derive: ['supply', 'paymentout'],
  },
  supply: {
    section: 'purchase', title: 'Mal kabulleri', single: 'Mal kabul', prefix: 'MK',
    lines: true, counterparty: true, warehouse: true, priceField: 'buy_price',
    stock: 1, settle: -1, derive: ['paymentout', 'purchasereturn'],
  },
  purchasereturn: {
    section: 'purchase', title: 'Tedarikçiye iadeler', single: 'Tedarikçiye iade', prefix: 'TI',
    lines: true, counterparty: true, warehouse: true, priceField: 'buy_price',
    stock: -1, settle: 1, derive: ['paymentin'],
  },
  customerorder: {
    section: 'sales', title: 'Müşteri siparişleri', single: 'Müşteri siparişi', prefix: 'MS',
    lines: true, counterparty: true, warehouse: true, priceField: 'sale_price',
    statuses: ['Yeni', 'Onaylandı', 'Toplanıyor', 'Sevk edildi', 'Teslim edildi', 'İptal'],
    closed: ['Sevk edildi', 'Teslim edildi', 'İptal'],
    reserve: true, derive: ['demand', 'paymentin'],
  },
  demand: {
    section: 'sales', title: 'Sevkiyatlar', single: 'Sevkiyat', prefix: 'SV',
    lines: true, counterparty: true, warehouse: true, priceField: 'sale_price',
    stock: -1, settle: 1, sale: 1, derive: ['paymentin', 'salesreturn'],
  },
  salesreturn: {
    section: 'sales', title: 'Müşteri iadeleri', single: 'Müşteri iadesi', prefix: 'MI',
    lines: true, counterparty: true, warehouse: true, priceField: 'sale_price',
    stock: 1, settle: -1, sale: -1, derive: ['paymentout'],
  },
  retaildemand: {
    section: 'retail', title: 'Perakende satışlar', single: 'Perakende satış', prefix: 'PS',
    lines: true, warehouse: true, priceField: 'sale_price', account: true,
    stock: -1, money: 1, sale: 1,
  },
  enter: {
    section: 'stock', title: 'Girişler', single: 'Giriş', prefix: 'GR',
    lines: true, warehouse: true, priceField: 'buy_price', stock: 1,
  },
  loss: {
    section: 'stock', title: 'Zayiatlar', single: 'Zayiat', prefix: 'ZY',
    lines: true, warehouse: true, priceField: 'buy_price', stock: -1,
  },
  move: {
    section: 'stock', title: 'Transferler', single: 'Transfer', prefix: 'TR',
    lines: true, warehouse: true, targetWarehouse: true, priceField: 'buy_price',
  },
  inventory: {
    section: 'stock', title: 'Sayımlar', single: 'Sayım', prefix: 'SY',
    lines: true, warehouse: true, inventory: true, priceField: 'buy_price', stock: 1,
  },
  paymentin: {
    section: 'money', title: 'Gelen ödemeler', single: 'Gelen ödeme', prefix: 'GO',
    counterparty: true, account: true, category: true, settle: -1, money: 1,
  },
  paymentout: {
    section: 'money', title: 'Giden ödemeler', single: 'Giden ödeme', prefix: 'ÇO',
    counterparty: true, account: true, category: true, settle: 1, money: -1,
  },
};

export const ACCOUNTS = ['Kasa', 'Banka'];
export const EXPENSE_CATEGORIES = ['Tedarikçi ödemesi', 'Müşteri tahsilatı', 'Sermaye', 'Kira', 'Maaş', 'Vergi', 'Kargo', 'Pazarlama', 'Diğer'];

const typesWith = (key) => Object.entries(DOC_TYPES).filter(([, t]) => t[key]).map(([k]) => k);

// SQL ifadesi içinde güvenle kullanılabilecek CASE parçaları (tür adları sabittir).
export const caseBy = (key) =>
  'CASE d.type ' + typesWith(key).map((k) => `WHEN '${k}' THEN ${DOC_TYPES[k][key]}`).join(' ') + ' ELSE 0 END';

export const inList = (key) => typesWith(key).map((k) => `'${k}'`).join(',');
