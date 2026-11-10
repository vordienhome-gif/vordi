/**
 * Честный знак (ГИС МТ) DataMatrix ayrıştırma.
 * (01) 14 haneli GTIN + (21) seri + kripto kuyruğu (91/92/93). Gruplar arası GS (0x1D) ayırıcıdır.
 * Kodun benzersiz anahtarı (КИ / CIS) = 01 + GTIN + 21 + seri.
 */
/**
 * Честный знак ürün grupları. МойСклад'daki trackingType değerlerinin küçük harfli karşılığı
 * (LP_CLOTHES → lp_clothes, LP_LINENS → lp_linens …). 'lp' eski genel giyim değeridir.
 */
export const MARKING_TYPES = [
  'lp', 'lp_clothes', 'lp_linens', 'shoes', 'perfumery', 'tires', 'electronics', 'cosmetics', 'water', 'milk', 'beer',
  'otp', 'bicycle', 'wheelchairs', 'food_supplement', 'medical_devices', 'bio', 'other',
] as const;
export type MarkingType = (typeof MARKING_TYPES)[number];

const GS = '\u001d';

export interface ParsedCode { raw: string; gtin: string; serial: string; cis: string }

export function parseMarkingCode(input: string): ParsedCode | null {
  let raw = String(input ?? '').trim().replace(/^\]d2|^\]C1/, '').replace(/\\u001d|<GS>|\{GS\}/gi, GS);
  if (raw.startsWith(GS)) raw = raw.slice(1);
  const m = /^01(\d{14})21([^\u001d]+)/.exec(raw);
  if (!m) return null;
  let serial = m[2]!;
  // Okuyucu GS göndermezse giyim/ayakkabı/parfüm için seri 13 karakterdir.
  if (!raw.includes(GS) && serial.length > 13) serial = serial.slice(0, 13);
  return { raw, gtin: m[1]!, serial, cis: `01${m[1]}21${serial}` };
}

/** Ürün barkodu (EAN-13 vb.) ile DataMatrix GTIN'i aynı ürünü mü gösteriyor? */
export const gtinMatches = (barcode: string | null | undefined, gtin: string) =>
  /^\d{8,14}$/.test(String(barcode ?? '')) && String(barcode).padStart(14, '0') === gtin;

/** Okutulan şey DataMatrix mi, sıradan barkod mu? */
export const looksLikeMarkingCode = (s: string) => /^(\]d2|\]C1)?\u001d?01\d{14}21/.test(s.trim());
