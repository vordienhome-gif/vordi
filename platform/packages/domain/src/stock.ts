import { roundQty } from './money.ts';

export interface StockMoveLike { variantId: number; warehouseId: number; qty: number }

/** Stok bakiyesi = işlenmiş hareketlerin toplamı. Anahtar: `${variantId}:${warehouseId}` */
export function stockBalances(moves: Iterable<StockMoveLike>): Map<string, number> {
  const m = new Map<string, number>();
  for (const mv of moves) {
    const k = `${mv.variantId}:${mv.warehouseId}`;
    m.set(k, roundQty((m.get(k) ?? 0) + mv.qty));
  }
  return m;
}

/**
 * МойСклад terimleri:
 *  остаток (stock)   — depodaki fiziksel miktar
 *  резерв (reserve)  — işlenmiş, sevk edilmemiş müşteri siparişleri
 *  ожидание (expected) — işlenmiş, kabul edilmemiş tedarikçi siparişleri
 *  доступно (available) = stock − reserve
 */
export function availability(stock: number, reserve: number, expected = 0) {
  return { stock, reserve, expected, available: roundQty(stock - reserve) };
}
