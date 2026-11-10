import { MARKING_TYPES, type DocType, type MarkingType } from '@vordi/domain';
import type { MsRef } from './client.ts';

/** МойСклад'daki nesnenin kimliği: meta.href'in son parçası. */
export function idOf(ref: MsRef | { meta: { href: string } } | null | undefined): string | null {
  const href = ref?.meta?.href;
  if (!href) return null;
  return href.split('?')[0]!.split('/').pop() ?? null;
}

/** meta.href'ten nesne türü: .../entity/variant/<id> → 'variant'. */
export function typeOf(ref: MsRef | null | undefined): string | null {
  if (!ref?.meta) return null;
  if (ref.meta.type) return ref.meta.type;
  const parts = ref.meta.href.split('?')[0]!.split('/');
  return parts[parts.length - 2] ?? null;
}

/**
 * МойСклад tarihleri saat dilimi içermez ve hesabın saat diliminde (Moskova, UTC+3) yazılır:
 * "2025-10-14 12:34:56.000" → "2025-10-14T12:34:56.000+03:00"
 */
export function msMoment(s: string | null | undefined, offset = '+03:00'): string {
  if (!s) return new Date().toISOString();
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s.trim());
  if (!m) return new Date(s).toISOString();
  return `${m[1]}T${m[2]}${(m[3] ?? '.000').slice(0, 4)}${offset}`;
}

/** trackingType (LP_LINENS, SHOES, NOT_TRACKED …) → Vordi markalama türü. */
export function markingOf(trackingType: string | null | undefined): MarkingType | null {
  if (!trackingType || trackingType === 'NOT_TRACKED') return null;
  const t = trackingType.toLowerCase();
  return (MARKING_TYPES as readonly string[]).includes(t) ? (t as MarkingType) : 'other';
}

/** МойСклад tutarları zaten kopek/cent cinsindendir (ör. 510000.0 = 5 100 ₽). */
export const kop = (v: number | null | undefined) => Math.round(Number(v ?? 0));

/** Belge para birimi rubleden farklıysa satır fiyatını rubleye çevirir. */
export const toRubKopeks = (value: number, rate: number | null | undefined) => Math.round(value * (rate && rate > 0 ? rate : 1));

/** Barkod nesneleri: [{ ean13: '...' }, { gtin: '...' }, { code128: '...' }] → düz liste. */
export function barcodesOf(list: Record<string, string>[] | null | undefined): string[] {
  const out: string[] = [];
  for (const b of list ?? []) for (const v of Object.values(b)) if (typeof v === 'string' && v.trim()) out.push(v.trim());
  return [...new Set(out)];
}

/** Ek alanlar: [{ name, value }] → { name: value }. Referans değerler adıyla yazılır. */
export function attributesOf(list: { name: string; value: unknown }[] | null | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const a of list ?? []) {
    const v = a.value as unknown;
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[a.name] = v;
    else if (typeof v === 'object' && v && 'name' in v) out[a.name] = String((v as { name: unknown }).name);
  }
  return out;
}

export function counterpartyKind(companyType: string | null | undefined): 'legal' | 'entrepreneur' | 'individual' {
  return companyType === 'entrepreneur' ? 'entrepreneur' : companyType === 'individual' ? 'individual' : 'legal';
}

/** Aktarılan МойСклад belge türleri. Sıra önemlidir: önce bağlanılan (sipariş) belgeler gelir. */
export const MS_DOCUMENT_TYPES: { ms: string; type: DocType; parent?: string[] }[] = [
  { ms: 'purchaseorder', type: 'purchaseorder' },
  { ms: 'customerorder', type: 'customerorder' },
  { ms: 'invoicein', type: 'invoicein', parent: ['purchaseOrder'] },
  { ms: 'invoiceout', type: 'invoiceout', parent: ['customerOrder'] },
  { ms: 'inventory', type: 'inventory' },
  { ms: 'retailshift', type: 'retailshift' },
  { ms: 'supply', type: 'supply', parent: ['purchaseOrder'] },
  { ms: 'purchasereturn', type: 'purchasereturn', parent: ['supply'] },
  { ms: 'demand', type: 'demand', parent: ['customerOrder'] },
  { ms: 'salesreturn', type: 'salesreturn', parent: ['demand'] },
  { ms: 'retaildemand', type: 'retaildemand', parent: ['customerOrder'] },
  { ms: 'retailsalesreturn', type: 'retailsalesreturn', parent: ['demand'] },
  { ms: 'enter', type: 'enter', parent: ['inventory'] },
  { ms: 'loss', type: 'loss', parent: ['inventory'] },
  { ms: 'move', type: 'move' },
  { ms: 'paymentin', type: 'paymentin' },
  { ms: 'paymentout', type: 'paymentout' },
  { ms: 'cashin', type: 'cashin' },
  { ms: 'cashout', type: 'cashout' },
  { ms: 'counterpartyadjustment', type: 'counterpartyadjustment' },
  { ms: 'commissionreportin', type: 'commissionreportin' },
];
