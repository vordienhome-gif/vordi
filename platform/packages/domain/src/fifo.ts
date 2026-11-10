import type { Kopeks } from './money.ts';

/**
 * FIFO maliyet hesabı (МойСклад'ın kârlılık raporundaki yöntem).
 *
 * Hareketler tarih sırasıyla verilir. Her ürün (varyant) için alış katmanları kuyruğu tutulur:
 * giriş → kuyruğun sonuna katman eklenir; çıkış → en eski katmandan tüketilir.
 * Depolar arası transfer maliyeti değiştirmez, bu yüzden buraya verilmez.
 *
 * Maliyetsiz girişler (müşteri iadesi, sayım fazlası) o anki son bilinen birim maliyetle katman olur.
 * Stok eksiye düşerse (önce satış, sonra kabul girildiyse) eksik kısım son bilinen maliyetle hesaplanır
 * ve `estimated` işaretlenir.
 */
export interface FifoMove {
  key: string | number;
  variantId: number;
  /** + giriş, − çıkış */
  qty: number;
  unitCost: Kopeks | null;
}

export interface FifoResult {
  /** Çıkışta tüketilen maliyet (pozitif). Girişte eklenen değer negatif yazılır (iade kârlılıktan maliyeti düşer). */
  cost: Kopeks;
  estimated: boolean;
}

export interface FifoState {
  costs: Map<FifoMove['key'], FifoResult>;
  /** Varyant bazında kalan katmanların miktarı ve toplam değeri (stok değeri raporu). */
  remaining: Map<number, { qty: number; value: Kopeks }>;
}

export function runFifo(moves: Iterable<FifoMove>): FifoState {
  const layers = new Map<number, { qty: number; unitCost: number }[]>();
  const lastCost = new Map<number, number>();
  const costs = new Map<FifoMove['key'], FifoResult>();

  for (const m of moves) {
    const queue = layers.get(m.variantId) ?? [];
    layers.set(m.variantId, queue);
    if (m.qty > 0) {
      const unit = m.unitCost ?? lastCost.get(m.variantId) ?? 0;
      queue.push({ qty: m.qty, unitCost: unit });
      if (m.unitCost != null) lastCost.set(m.variantId, m.unitCost);
      costs.set(m.key, { cost: -Math.round(m.qty * unit), estimated: false });
      continue;
    }
    let remaining = -m.qty;
    let cost = 0;
    while (remaining > 1e-9 && queue.length > 0) {
      const layer = queue[0]!;
      const take = Math.min(layer.qty, remaining);
      cost += take * layer.unitCost;
      layer.qty -= take;
      remaining -= take;
      lastCost.set(m.variantId, layer.unitCost);
      if (layer.qty <= 1e-9) queue.shift();
    }
    const estimated = remaining > 1e-9;
    if (estimated) cost += remaining * (lastCost.get(m.variantId) ?? 0);
    costs.set(m.key, { cost: Math.round(cost), estimated });
  }

  const rest = new Map<number, { qty: number; value: Kopeks }>();
  for (const [variantId, queue] of layers) {
    const qty = queue.reduce((s, l) => s + l.qty, 0);
    const value = Math.round(queue.reduce((s, l) => s + l.qty * l.unitCost, 0));
    rest.set(variantId, { qty, value });
  }
  return { costs, remaining: rest };
}

export const fifoCosts = (moves: Iterable<FifoMove>) => runFifo(moves).costs;
