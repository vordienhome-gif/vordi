/**
 * Para tutarları her yerde **kopek cinsinden tam sayı** tutulur (1 ₽ = 100).
 * Float ile para hesabı yapılmaz; yuvarlama yalnızca satır tutarı hesaplanırken bir kez yapılır.
 */
export type Kopeks = number;

export const rub = (value: number): Kopeks => Math.round(value * 100);
export const toRub = (k: Kopeks): number => k / 100;

/** Miktar en fazla 3 ondalık (ör. 1.250 kg). */
export const roundQty = (q: number): number => Math.round(q * 1000) / 1000;

/** Satır tutarı: miktar × fiyat − indirim %, kopeğe yuvarlanır. */
export function lineSum(qty: number, price: Kopeks, discountPercent = 0): Kopeks {
  if (discountPercent < 0 || discountPercent > 100) throw new RangeError('discount must be 0..100');
  return Math.round(qty * price * (1 - discountPercent / 100));
}

/** KDV dahil tutardan KDV payı (НДС в т.ч.). */
export function vatIncluded(sum: Kopeks, vatPercent: number | null): Kopeks {
  if (!vatPercent) return 0;
  return Math.round((sum * vatPercent) / (100 + vatPercent));
}

export function formatRub(k: Kopeks, locale = 'ru-RU'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'RUB' }).format(k / 100);
}
