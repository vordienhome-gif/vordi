/**
 * Belge türleri — МойСклад'daki belge yapısını örnek alır.
 *
 * Her belge türü, **işlendiğinde (проведён)** üç deftere ne yazacağını tanımlar:
 *   stock:  stok defteri. +1 depoya giriş, -1 çıkış. 'move' kaynak depodan çıkış + hedef depoya giriş.
 *   settle: cari defteri (взаиморасчёты). + cari bize borçlanır, - biz cariye borçlanırız.
 *   money:  kasa/banka defteri. + para girişi, - para çıkışı.
 *   revenue: satış gelirine etkisi (kârlılık raporu).
 *
 * Etkisi olmayan belgeler (sipariş, fatura/счёт, sayım) yalnızca bilgi taşır;
 * siparişler rezerv (müşteri) ve beklenen stok (tedarikçi) hesabına girer.
 */
export const DOC_TYPES = {
  // — Alış (Закупки)
  purchaseorder: { section: 'purchase', ru: 'Заказ поставщику', tr: 'Tedarikçi siparişi', prefix: 'ЗП', lines: true, counterparty: true, warehouse: true, expected: true },
  invoicein: { section: 'purchase', ru: 'Счёт поставщика', tr: 'Tedarikçi faturası (счёт)', prefix: 'СП', lines: true, counterparty: true },
  supply: { section: 'purchase', ru: 'Приёмка', tr: 'Mal kabul', prefix: 'ПР', lines: true, counterparty: true, warehouse: true, stock: 1, settle: -1, costSource: true },
  purchasereturn: { section: 'purchase', ru: 'Возврат поставщику', tr: 'Tedarikçiye iade', prefix: 'ВП', lines: true, counterparty: true, warehouse: true, stock: -1, settle: 1 },

  // — Satış (Продажи)
  customerorder: { section: 'sales', ru: 'Заказ покупателя', tr: 'Müşteri siparişi', prefix: 'ЗК', lines: true, counterparty: true, warehouse: true, reserve: true },
  invoiceout: { section: 'sales', ru: 'Счёт покупателю', tr: 'Müşteriye fatura (счёт)', prefix: 'СЧ', lines: true, counterparty: true },
  demand: { section: 'sales', ru: 'Отгрузка', tr: 'Sevkiyat', prefix: 'ОТ', lines: true, counterparty: true, warehouse: true, stock: -1, settle: 1, revenue: 1 },
  salesreturn: { section: 'sales', ru: 'Возврат покупателя', tr: 'Müşteri iadesi', prefix: 'ВК', lines: true, counterparty: true, warehouse: true, stock: 1, settle: -1, revenue: -1 },

  // — Perakende (Розница)
  retaildemand: { section: 'retail', ru: 'Розничная продажа', tr: 'Perakende satış', prefix: 'РП', lines: true, warehouse: true, account: true, stock: -1, money: 1, revenue: 1 },
  retailsalesreturn: { section: 'retail', ru: 'Розничный возврат', tr: 'Perakende iade', prefix: 'РВ', lines: true, warehouse: true, account: true, stock: 1, money: -1, revenue: -1 },

  // — Depo (Склад)
  enter: { section: 'stock', ru: 'Оприходование', tr: 'Stok girişi', prefix: 'ОП', lines: true, warehouse: true, stock: 1, costSource: true },
  loss: { section: 'stock', ru: 'Списание', tr: 'Zayiat / çıkış', prefix: 'СН', lines: true, warehouse: true, stock: -1 },
  move: { section: 'stock', ru: 'Перемещение', tr: 'Depolar arası transfer', prefix: 'ПМ', lines: true, warehouse: true, targetWarehouse: true },
  inventory: { section: 'stock', ru: 'Инвентаризация', tr: 'Sayım', prefix: 'ИН', lines: true, warehouse: true },

  // — Para (Деньги)
  paymentin: { section: 'money', ru: 'Входящий платёж', tr: 'Gelen ödeme (banka)', prefix: 'ВХ', counterparty: true, account: true, settle: -1, money: 1 },
  paymentout: { section: 'money', ru: 'Исходящий платёж', tr: 'Giden ödeme (banka)', prefix: 'ИС', counterparty: true, account: true, settle: 1, money: -1 },
  cashin: { section: 'money', ru: 'Приходный ордер', tr: 'Kasa tahsilat fişi', prefix: 'ПКО', counterparty: true, account: true, settle: -1, money: 1 },
  cashout: { section: 'money', ru: 'Расходный ордер', tr: 'Kasa tediye fişi', prefix: 'РКО', counterparty: true, account: true, settle: 1, money: -1 },
} as const satisfies Record<string, DocTypeDef>;

export interface DocTypeDef {
  section: 'purchase' | 'sales' | 'retail' | 'stock' | 'money';
  ru: string;
  tr: string;
  prefix: string;
  lines?: boolean;
  counterparty?: boolean;
  warehouse?: boolean;
  targetWarehouse?: boolean;
  account?: boolean;
  stock?: 1 | -1;
  settle?: 1 | -1;
  money?: 1 | -1;
  revenue?: 1 | -1;
  reserve?: boolean;
  expected?: boolean;
  /** Bu belgedeki fiyat, FIFO maliyet katmanı oluşturur (alış fiyatı). */
  costSource?: boolean;
}

export type DocType = keyof typeof DOC_TYPES;
export const DOC_TYPE_KEYS = Object.keys(DOC_TYPES) as DocType[];

export const docType = (t: DocType): DocTypeDef => DOC_TYPES[t];
export const isDocType = (t: string): t is DocType => t in DOC_TYPES;

/** Depo personelinin (depocu rolü) oluşturabileceği belgeler. */
export const WAREHOUSE_DOC_TYPES: DocType[] = ['supply', 'enter', 'loss', 'move', 'inventory', 'demand'];

/** Bir belgeden hangi belgeler türetilebilir (на основании). */
export const DERIVES: Partial<Record<DocType, DocType[]>> = {
  purchaseorder: ['supply', 'invoicein', 'paymentout'],
  invoicein: ['supply', 'paymentout'],
  supply: ['purchasereturn', 'paymentout'],
  customerorder: ['demand', 'invoiceout', 'paymentin', 'cashin'],
  invoiceout: ['demand', 'paymentin', 'cashin'],
  demand: ['salesreturn', 'paymentin', 'cashin'],
  salesreturn: ['paymentout', 'cashout'],
  retaildemand: ['retailsalesreturn'],
  inventory: ['enter', 'loss'],
};
