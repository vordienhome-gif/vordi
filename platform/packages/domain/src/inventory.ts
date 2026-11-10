import { roundQty } from './money.ts';

export interface InventoryLine { variantId: number; expected: number; counted: number; price: number }

/**
 * Sayım (Инвентаризация) stoğu doğrudan değiştirmez; farklardan
 * fazla için Оприходование (enter), eksik için Списание (loss) belgesi oluşturulur.
 */
export function inventoryAdjustments(lines: InventoryLine[]) {
  const enter: { variantId: number; qty: number; price: number }[] = [];
  const loss: { variantId: number; qty: number; price: number }[] = [];
  for (const l of lines) {
    const diff = roundQty(l.counted - l.expected);
    if (diff > 0) enter.push({ variantId: l.variantId, qty: diff, price: l.price });
    if (diff < 0) loss.push({ variantId: l.variantId, qty: -diff, price: l.price });
  }
  return { enter, loss };
}
