import type { DocumentInput, ScanResult } from '@vordi/contracts';

/** Depoda yapılabilen işlemler (МойСклад belge türleri). */
export type Operation = 'enter' | 'loss' | 'move' | 'inventory';

export interface DraftLine {
  variantId: number;
  productName: string;
  variantName: string;
  article: string | null;
  marked: boolean;
  qty: number;
  price: number;
  codes: string[];
}

export interface Draft {
  op: Operation;
  warehouseId: number | null;
  targetWarehouseId: number | null;
  comment: string;
  lines: DraftLine[];
}

export const emptyDraft = (op: Operation, warehouseId: number | null = null): Draft =>
  ({ op, warehouseId, targetWarehouseId: null, comment: '', lines: [] });

export type ScanOutcome =
  | { kind: 'added'; line: DraftLine }
  | { kind: 'incremented'; line: DraftLine }
  | { kind: 'duplicate_code' }
  | { kind: 'need_code'; productName: string };

/**
 * Okutulan ürünü taslağa ekler.
 * - Sıradan ürün: aynı ürün tekrar okutulursa miktar 1 artar.
 * - Честный знак'lı ürün: her adet için DataMatrix okutulmalıdır; aynı kod iki kez eklenmez,
 *   miktar = okutulan kod sayısı. (Sayım ve iç transferde kod istenmez.)
 */
export function applyScan(draft: Draft, scan: ScanResult, rawCode: string): { draft: Draft; outcome: ScanOutcome } {
  const marked = !!scan.product.markingType;
  const needsCodes = marked && (draft.op === 'enter' || draft.op === 'loss');
  if (needsCodes && !scan.markingCode) return { draft, outcome: { kind: 'need_code', productName: scan.product.name } };

  const idx = draft.lines.findIndex((l) => l.variantId === scan.variant.id);
  const code = needsCodes && scan.markingCode ? rawCode : null;
  if (code && draft.lines.some((l) => l.codes.some((c) => sameCis(c, scan.markingCode!.cis)))) {
    return { draft, outcome: { kind: 'duplicate_code' } };
  }

  const lines = [...draft.lines];
  if (idx >= 0) {
    const prev = lines[idx]!;
    const codes = code ? [...prev.codes, code] : prev.codes;
    const line = { ...prev, codes, qty: code ? codes.length : prev.qty + 1 };
    lines.splice(idx, 1);
    lines.unshift(line); // son okutulan en üstte
    return { draft: { ...draft, lines }, outcome: { kind: 'incremented', line } };
  }
  const line: DraftLine = {
    variantId: scan.variant.id, productName: scan.product.name, variantName: scan.variant.name, article: scan.product.article,
    marked, qty: 1, price: scan.product.buyPrice, codes: code ? [code] : [],
  };
  return { draft: { ...draft, lines: [line, ...lines] }, outcome: { kind: 'added', line } };
}

// Kod karşılaştırması: kripto kuyruğu olmadan, yalnızca 01+GTIN+21+seri.
const sameCis = (raw: string, cis: string) => raw.replace(/^\]d2|^\]C1|^\u001d/, '').startsWith(cis);

export function setQty(draft: Draft, variantId: number, qty: number): Draft {
  return { ...draft, lines: draft.lines.map((l) => (l.variantId === variantId && !l.codes.length ? { ...l, qty: Math.max(0, qty) } : l)) };
}

export function removeLine(draft: Draft, variantId: number): Draft {
  return { ...draft, lines: draft.lines.filter((l) => l.variantId !== variantId) };
}

export function toDocument(draft: Draft, posted: boolean): DocumentInput {
  return {
    type: draft.op,
    posted,
    warehouseId: draft.warehouseId,
    targetWarehouseId: draft.op === 'move' ? draft.targetWarehouseId : null,
    comment: draft.comment || null,
    lines: draft.lines
      .filter((l) => draft.op === 'inventory' || l.qty > 0)
      .map((l) => ({ variantId: l.variantId, qty: l.qty, price: l.price, discount: 0, codes: l.codes })),
  };
}

export const totalQty = (d: Draft) => Math.round(d.lines.reduce((s, l) => s + l.qty, 0) * 1000) / 1000;
