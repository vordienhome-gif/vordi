import { DomainError } from './errors.ts';
import { docType, type DocType } from './doctypes.ts';
import { lineSum, roundQty, type Kopeks } from './money.ts';

export interface DocLine {
  lineId?: number;
  variantId: number;
  qty: number;
  /** Birim fiyat, kopek. */
  price: Kopeks;
  discount?: number;
  /** Hizmet satırı: stok hareketi yazılmaz. */
  noStock?: boolean;
}

export interface PostOptions {
  /** Cari zorunlu belgede cari yoksa hata verme, yalnızca cari kaydını atla (ör. çalışandan kasa tahsilatı). */
  settlementOptional?: boolean;
}

export interface PostableDocument {
  id: number;
  type: DocType;
  moment: string;
  warehouseId?: number | null;
  targetWarehouseId?: number | null;
  counterpartyId?: number | null;
  accountId?: number | null;
  /** Satırsız belgelerde (ödemeler) tutar. */
  sum?: Kopeks | null;
  lines: DocLine[];
}

export interface StockEntry {
  documentId: number;
  lineId?: number;
  variantId: number;
  warehouseId: number;
  qty: number;
  /** Giriş belgelerinde birim maliyet (FIFO katmanı için). */
  unitCost: Kopeks | null;
  moment: string;
}
export interface SettlementEntry { documentId: number; counterpartyId: number; amount: Kopeks; moment: string }
export interface MoneyEntry { documentId: number; accountId: number; amount: Kopeks; moment: string }

export interface PostingResult {
  sum: Kopeks;
  stock: StockEntry[];
  settlement: SettlementEntry[];
  money: MoneyEntry[];
}

export function documentSum(doc: Pick<PostableDocument, 'type' | 'lines' | 'sum'>): Kopeks {
  const def = docType(doc.type);
  if (!def.lines) return doc.sum ?? 0;
  return doc.lines.reduce((s, l) => s + lineSum(l.qty, l.price, l.discount ?? 0), 0);
}

/** Belgeyi doğrular ve işlendiğinde defterlere yazılacak kayıtları üretir. Saf fonksiyon: veritabanına dokunmaz. */
export function postDocument(doc: PostableDocument, opts: PostOptions = {}): PostingResult {
  const def = docType(doc.type);
  const sum = documentSum(doc);
  const need = (cond: unknown, field: string) => {
    if (!cond) throw new DomainError(`${def.ru}: поле «${field}» обязательно`, `missing_${field}`);
  };

  if (def.warehouse) need(doc.warehouseId, 'warehouse');
  if (def.targetWarehouse) {
    need(doc.targetWarehouseId, 'targetWarehouse');
    if (doc.targetWarehouseId === doc.warehouseId) throw new DomainError('Склады отправителя и получателя совпадают', 'same_warehouse');
  }
  if (def.settle && !opts.settlementOptional) need(doc.counterpartyId, 'counterparty');
  if (def.money) need(doc.accountId, 'account');
  if (def.lines) {
    if (doc.lines.length === 0 && (def.stock || def.targetWarehouse)) throw new DomainError('Документ без позиций', 'empty_document');
    for (const l of doc.lines) {
      // Sayımda sayılan miktar 0 olabilir (ürün hiç bulunamadı); diğer belgelerde miktar > 0.
      const ok = doc.type === 'inventory' ? l.qty >= 0 : l.qty > 0;
      if (!ok) throw new DomainError('Количество должно быть больше нуля', 'bad_qty');
      if (l.price < 0) throw new DomainError('Цена не может быть отрицательной', 'bad_price');
    }
  } else if ((def.settle || def.money) && !def.signedSum && !(sum > 0)) {
    throw new DomainError('Сумма должна быть больше нуля', 'bad_sum');
  }

  const stock: StockEntry[] = [];
  const base = { documentId: doc.id, moment: doc.moment };
  const stockLines = doc.lines.filter((l) => !l.noStock);
  if (def.stock) {
    for (const l of stockLines) {
      stock.push({
        ...base, lineId: l.lineId, variantId: l.variantId, warehouseId: doc.warehouseId!,
        qty: roundQty(def.stock * l.qty),
        unitCost: def.costSource ? Math.round(l.price * (1 - (l.discount ?? 0) / 100)) : null,
      });
    }
  }
  if (def.targetWarehouse) {
    for (const l of stockLines) {
      stock.push({ ...base, lineId: l.lineId, variantId: l.variantId, warehouseId: doc.warehouseId!, qty: -roundQty(l.qty), unitCost: null });
      stock.push({ ...base, lineId: l.lineId, variantId: l.variantId, warehouseId: doc.targetWarehouseId!, qty: roundQty(l.qty), unitCost: null });
    }
  }

  const settleAmount = def.settleFromSum ? (doc.sum ?? 0) : sum;
  const settlement: SettlementEntry[] =
    def.settle && doc.counterpartyId && settleAmount !== 0 ? [{ ...base, counterpartyId: doc.counterpartyId, amount: def.settle * settleAmount }] : [];
  const money: MoneyEntry[] = def.money ? [{ ...base, accountId: doc.accountId!, amount: def.money * sum }] : [];
  return { sum, stock, settlement, money };
}
