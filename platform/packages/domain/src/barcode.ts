/** EAN-13 / EAN-8 / GTIN kontrol hanesi. */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/**
 * Mağaza içi EAN-13 üretir (МойСклад gibi "2" önekiyle: 2 ile başlayan kodlar iç kullanım içindir).
 * Barkodu olmayan ürünlere etiket basmak için.
 */
export function internalEan13(seq: number, prefix = '20'): string {
  const body = prefix + String(seq).padStart(12 - prefix.length, '0');
  if (body.length !== 12) throw new RangeError('sequence too large');
  return body + gtinCheckDigit(body);
}
