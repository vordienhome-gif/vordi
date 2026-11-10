import type { ScanResult } from '@vordi/contracts';
import { describe, expect, it } from 'vitest';
import { applyScan, emptyDraft, setQty, toDocument } from '../src/draft.ts';
import { WedgeBuffer } from '../src/wedge.ts';

const scan = (variantId: number, opts: { marked?: boolean; cis?: string } = {}): ScanResult => ({
  variant: { id: variantId, productId: 1, name: 'M', characteristics: {}, code: null, barcodes: [], prices: {} },
  product: { id: 1, name: `Товар ${variantId}`, article: null, unit: 'шт', markingType: opts.marked ? 'lp' : null, buyPrice: 500 },
  stock: [],
  markingCode: opts.cis ? { cis: opts.cis, gtin: '04600000000015' } : null,
});

describe('donanım okuyucu (klavye kaması)', () => {
  it('hızlı vuruşları kod olarak alır, yavaş yazılanı almaz', () => {
    const codes: string[] = [];
    const w = new WedgeBuffer((c) => codes.push(c));
    let t = 1000;
    for (const ch of '4600000000015') w.key(ch, (t += 10));
    expect(w.key('Enter', (t += 10))).toBe(true);
    expect(codes).toEqual(['4600000000015']);

    for (const ch of '1234') w.key(ch, (t += 300));
    expect(w.key('Enter', (t += 300))).toBe(false);
    expect(codes).toHaveLength(1);
  });

  it('DataMatrix GS ayırıcısını (F8) korur', () => {
    const codes: string[] = [];
    const w = new WedgeBuffer((c) => codes.push(c));
    let t = 0;
    for (const k of ['0', '1', '2', '3', 'F8', '9', '1', 'Enter']) w.key(k, (t += 5));
    expect(codes).toEqual(['0123\u001d91']);
  });
});

describe('taslak belge', () => {
  it('aynı ürünü tekrar okutunca miktarı artırır, son okutulanı üste alır', () => {
    let d = emptyDraft('enter', 1);
    d = applyScan(d, scan(1), 'a').draft;
    d = applyScan(d, scan(2), 'b').draft;
    const r = applyScan(d, scan(1), 'a');
    expect(r.outcome.kind).toBe('incremented');
    expect(r.draft.lines.map((l) => [l.variantId, l.qty])).toEqual([[1, 2], [2, 1]]);
  });

  it('markalı üründe DataMatrix ister, aynı kodu iki kez almaz', () => {
    let d = emptyDraft('loss', 1);
    expect(applyScan(d, scan(1, { marked: true }), 'ean').outcome.kind).toBe('need_code');
    const code = '010460000000001521SERIAL0000001\u001d91EE10';
    d = applyScan(d, scan(1, { marked: true, cis: '010460000000001521SERIAL0000001' }), code).draft;
    expect(applyScan(d, scan(1, { marked: true, cis: '010460000000001521SERIAL0000001' }), code).outcome.kind).toBe('duplicate_code');
    d = applyScan(d, scan(1, { marked: true, cis: '010460000000001521SERIAL0000002' }), '010460000000001521SERIAL0000002').draft;
    expect(d.lines[0]).toMatchObject({ qty: 2, codes: [code, '010460000000001521SERIAL0000002'] });
    // Kodlu satırda miktar elle değişmez.
    expect(setQty(d, 1, 10).lines[0]!.qty).toBe(2);
  });

  it('sayımda markalı ürün kod istemez; belgeye 0 sayılan satır da gider', () => {
    let d = emptyDraft('inventory', 1);
    d = applyScan(d, scan(1, { marked: true }), 'ean').draft;
    d = setQty(d, 1, 0);
    expect(toDocument(d, true)).toMatchObject({ type: 'inventory', posted: true, lines: [{ variantId: 1, qty: 0 }] });
  });

  it('transferde hedef depoyu belgeye yazar', () => {
    const d = { ...applyScan(emptyDraft('move', 1), scan(1), 'x').draft, targetWarehouseId: 2 };
    expect(toDocument(d, false)).toMatchObject({ type: 'move', warehouseId: 1, targetWarehouseId: 2, posted: false });
  });
});
