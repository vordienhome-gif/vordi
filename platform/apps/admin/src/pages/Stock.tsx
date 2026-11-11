import { formatRub } from '@vordi/domain';
import { useState } from 'react';
import { api } from '../api.ts';
import { ErrorText, Table, useLoad } from '../ui.tsx';

export function StockPage({ showCost }: { showCost: boolean }) {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [nonZero, setNonZero] = useState(true);
  const wh = useLoad(() => api.warehouses(), []);
  const { data, error } = useLoad(() => api.stockReport({ search, warehouseId }), [search, warehouseId]);
  const name = (id: number) => wh.data?.find((w) => w.id === id)?.name ?? id;
  const rows = (data ?? []).filter((r) => !nonZero || r.stock !== 0 || r.reserve !== 0 || r.expected !== 0);
  const total = rows.reduce((s, r) => s + r.costValue, 0);
  return (
    <>
      <h1>Остатки</h1>
      <div className="filters">
        <input placeholder="Поиск по названию или артикулу" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={warehouseId ?? ''} onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Все склады</option>
          {wh.data?.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={nonZero} onChange={(e) => setNonZero(e.target.checked)} /> Только ненулевые</label>
      </div>
      <ErrorText error={error} />
      <Table head={['Товар', 'Модификация', 'Артикул', 'Склад', 'Остаток', 'Резерв', 'Ожидание', 'Доступно', ...(showCost ? ['Себестоимость'] : [])]}>
        {rows.slice(0, 1000).map((r) => (
          <tr key={`${r.variantId}:${r.warehouseId}`}>
            <td>{r.productName}</td><td>{r.variantName}</td><td>{r.article}</td><td>{name(r.warehouseId)}</td>
            <td className={`num ${r.stock < 0 ? 'neg' : ''}`}>{r.stock}</td><td className="num">{r.reserve}</td><td className="num">{r.expected}</td>
            <td className="num"><b>{r.available}</b></td>{showCost && <td className="num">{formatRub(r.costValue)}</td>}
          </tr>
        ))}
      </Table>
      <p className="muted">Строк: {rows.length}{rows.length > 1000 ? ' (показаны первые 1000)' : ''}{showCost && <> · стоимость остатков (FIFO): <b>{formatRub(total)}</b></>}</p>
    </>
  );
}
