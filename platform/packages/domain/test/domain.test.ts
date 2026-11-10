import { describe, expect, it } from 'vitest';
import {
  DomainError, documentSum, fifoCosts, runFifo, gtinCheckDigit, internalEan13, inventoryAdjustments, isValidGtin,
  lineSum, looksLikeMarkingCode, parseMarkingCode, postDocument, rub, stockBalances, vatIncluded,
} from '../src/index.ts';

const moment = '2026-11-10T10:00:00+03:00';

describe('money', () => {
  it('kopek cinsinden tam sayı ile çalışır', () => {
    expect(rub(549.99)).toBe(54999);
    expect(lineSum(3, rub(0.1))).toBe(30);
    expect(lineSum(2, rub(100), 10)).toBe(18000);
    expect(lineSum(1.25, rub(80))).toBe(10000);
  });
  it('KDV dahil tutardan KDV payını hesaplar', () => {
    expect(vatIncluded(rub(122), 22)).toBe(rub(22));
    expect(vatIncluded(rub(100), null)).toBe(0);
  });
});

describe('postDocument', () => {
  it('Приёмка: stok girer, maliyet katmanı oluşur, biz tedarikçiye borçlanırız', () => {
    const r = postDocument({ id: 1, type: 'supply', moment, warehouseId: 1, counterpartyId: 7,
      lines: [{ variantId: 10, qty: 5, price: rub(100) }, { variantId: 11, qty: 2, price: rub(50), discount: 10 }] });
    expect(r.sum).toBe(rub(590));
    expect(r.stock).toEqual([
      expect.objectContaining({ variantId: 10, warehouseId: 1, qty: 5, unitCost: rub(100) }),
      expect.objectContaining({ variantId: 11, warehouseId: 1, qty: 2, unitCost: rub(45) }),
    ]);
    expect(r.settlement).toEqual([expect.objectContaining({ counterpartyId: 7, amount: -rub(590) })]);
    expect(r.money).toEqual([]);
  });

  it('Отгрузка: stok çıkar, cari bize borçlanır', () => {
    const r = postDocument({ id: 2, type: 'demand', moment, warehouseId: 1, counterpartyId: 8, lines: [{ variantId: 10, qty: 2, price: rub(150) }] });
    expect(r.stock[0]).toMatchObject({ qty: -2, unitCost: null });
    expect(r.settlement[0]!.amount).toBe(rub(300));
  });

  it('Перемещение: kaynaktan çıkar, hedefe girer', () => {
    const r = postDocument({ id: 3, type: 'move', moment, warehouseId: 1, targetWarehouseId: 2, lines: [{ variantId: 10, qty: 4, price: 0 }] });
    expect(r.stock.map((s) => [s.warehouseId, s.qty])).toEqual([[1, -4], [2, 4]]);
  });

  it('Perakende satış kasaya para yazar, cariye yazmaz', () => {
    const r = postDocument({ id: 4, type: 'retaildemand', moment, warehouseId: 1, accountId: 3, lines: [{ variantId: 10, qty: 1, price: rub(200) }] });
    expect(r.money).toEqual([expect.objectContaining({ accountId: 3, amount: rub(200) })]);
    expect(r.settlement).toEqual([]);
  });

  it('Ödemeler: gelen ödeme cari borcunu azaltır, kasayı artırır', () => {
    const r = postDocument({ id: 5, type: 'paymentin', moment, counterpartyId: 8, accountId: 2, sum: rub(300), lines: [] });
    expect(r.settlement[0]!.amount).toBe(-rub(300));
    expect(r.money[0]!.amount).toBe(rub(300));
  });

  it('Sipariş defterlere yazmaz (yalnızca rezerv)', () => {
    const r = postDocument({ id: 6, type: 'customerorder', moment, warehouseId: 1, counterpartyId: 8, lines: [{ variantId: 10, qty: 1, price: rub(1) }] });
    expect([r.stock, r.settlement, r.money]).toEqual([[], [], []]);
  });

  it('eksik alanları ve hatalı değerleri reddeder', () => {
    expect(() => postDocument({ id: 7, type: 'supply', moment, warehouseId: 1, lines: [{ variantId: 1, qty: 1, price: 1 }] })).toThrow(DomainError);
    expect(() => postDocument({ id: 7, type: 'loss', moment, warehouseId: 1, lines: [{ variantId: 1, qty: 0, price: 1 }] })).toThrow(/Количество/);
    expect(() => postDocument({ id: 7, type: 'move', moment, warehouseId: 1, targetWarehouseId: 1, lines: [{ variantId: 1, qty: 1, price: 0 }] })).toThrow(/совпадают/);
    expect(() => postDocument({ id: 7, type: 'enter', moment, warehouseId: 1, lines: [] })).toThrow(/без позиций/);
    expect(() => postDocument({ id: 7, type: 'paymentout', moment, counterpartyId: 1, accountId: 1, sum: 0, lines: [] })).toThrow(/Сумма/);
  });

  it('documentSum satırsız belgede tutarı kullanır', () => {
    expect(documentSum({ type: 'cashin', sum: 500, lines: [] })).toBe(500);
  });
});

describe('FIFO', () => {
  it('en eski katmandan tüketir', () => {
    const r = fifoCosts([
      { key: 'in1', variantId: 1, qty: 100, unitCost: 1000 },
      { key: 'in2', variantId: 1, qty: 50, unitCost: 1200 },
      { key: 'out1', variantId: 1, qty: -120, unitCost: null },
      { key: 'out2', variantId: 1, qty: -20, unitCost: null },
    ]);
    expect(r.get('out1')).toEqual({ cost: 100 * 1000 + 20 * 1200, estimated: false });
    expect(r.get('out2')).toEqual({ cost: 20 * 1200, estimated: false });
  });

  it('varyantları ayrı tutar, maliyetsiz iadeyi son maliyetle katmanlar', () => {
    const r = fifoCosts([
      { key: 'a', variantId: 1, qty: 2, unitCost: 500 },
      { key: 'b', variantId: 2, qty: 1, unitCost: 9000 },
      { key: 'c', variantId: 1, qty: -2, unitCost: null },
      { key: 'ret', variantId: 1, qty: 1, unitCost: null },
      { key: 'd', variantId: 1, qty: -1, unitCost: null },
    ]);
    expect(r.get('c')!.cost).toBe(1000);
    expect(r.get('d')!.cost).toBe(500);
  });

  it('eksi stokta tahmini maliyet işaretler', () => {
    const r = fifoCosts([
      { key: 'a', variantId: 1, qty: 1, unitCost: 300 },
      { key: 'b', variantId: 1, qty: -3, unitCost: null },
    ]);
    expect(r.get('b')).toEqual({ cost: 900, estimated: true });
  });
});

describe('stock & inventory', () => {
  it('bakiyeleri depo-varyant bazında toplar', () => {
    const b = stockBalances([
      { variantId: 1, warehouseId: 1, qty: 5 }, { variantId: 1, warehouseId: 1, qty: -1.5 }, { variantId: 1, warehouseId: 2, qty: 1 },
    ]);
    expect(b.get('1:1')).toBe(3.5);
    expect(b.get('1:2')).toBe(1);
  });
  it('sayım farkından giriş ve zayiat satırları üretir', () => {
    const r = inventoryAdjustments([
      { variantId: 1, expected: 10, counted: 12, price: 100 },
      { variantId: 2, expected: 5, counted: 3, price: 50 },
      { variantId: 3, expected: 1, counted: 1, price: 1 },
    ]);
    expect(r.enter).toEqual([{ variantId: 1, qty: 2, price: 100 }]);
    expect(r.loss).toEqual([{ variantId: 2, qty: 2, price: 50 }]);
  });
});

describe('barkod ve markalama', () => {
  it('EAN-13 kontrol hanesi ve iç barkod', () => {
    expect(gtinCheckDigit('460000000001')).toBe(5);
    expect(isValidGtin('4600000000015')).toBe(true);
    expect(isValidGtin('4600000000017')).toBe(false);
    const code = internalEan13(42);
    expect(code).toMatch(/^20\d{11}$/);
    expect(isValidGtin(code)).toBe(true);
  });
  it('DataMatrix ayrıştırır', () => {
    const p = parseMarkingCode('010460000000001721ABCdef123456X\u001d91EE10\u001d92abc');
    expect(p).toMatchObject({ gtin: '04600000000017', serial: 'ABCdef123456X', cis: '010460000000001721ABCdef123456X' });
    expect(parseMarkingCode('010460000000001721ABCdef123456X91EE1092abc')!.serial).toBe('ABCdef123456X');
    expect(parseMarkingCode('4600000000017')).toBeNull();
    expect(looksLikeMarkingCode('010460000000001721ABC')).toBe(true);
    expect(looksLikeMarkingCode('4600000000017')).toBe(false);
  });
});

describe('FIFO kalan stok değeri ve sayım', () => {
  it('kalan katmanların değerini verir, girişleri negatif maliyet olarak yazar', () => {
    const s = runFifo([
      { key: 1, variantId: 1, qty: 10, unitCost: 100 },
      { key: 2, variantId: 1, qty: 5, unitCost: 200 },
      { key: 3, variantId: 1, qty: -12, unitCost: null },
    ]);
    expect(s.remaining.get(1)).toEqual({ qty: 3, value: 600 });
    expect(s.costs.get(1)!.cost).toBe(-1000);
  });
  it('sayımda 0 sayılan satıra izin verir', () => {
    expect(() => postDocument({ id: 1, type: 'inventory', moment, warehouseId: 1, lines: [{ variantId: 1, qty: 0, price: 0 }] })).not.toThrow();
  });
});

describe('düzeltme ve bilgi belgeleri', () => {
  it('cari düzeltmesi işaretli tutarı aynen yazar', () => {
    expect(postDocument({ id: 1, type: 'counterpartyadjustment', moment, counterpartyId: 3, sum: -500, lines: [] }).settlement[0]!.amount).toBe(-500);
    expect(() => postDocument({ id: 1, type: 'counterpartyadjustment', moment, counterpartyId: 3, sum: 0, lines: [] })).toThrow(/нулевой/);
  });
  it('vardiya ve komisyoncu raporu defterlere yazmaz', () => {
    const r = postDocument({ id: 2, type: 'retailshift', moment, lines: [] });
    expect([r.stock, r.settlement, r.money]).toEqual([[], [], []]);
  });
});
