import type { Currency, Folder, PriceType, Product, ProductInput } from '@vordi/contracts';
import { formatRub, MARKING_TYPES } from '@vordi/domain';
import { useState } from 'react';
import { api } from '../api.ts';
import { ErrorText, Field, fromMoney, Modal, Table, toMoney, toNum, useLoad } from '../ui.tsx';

export function ProductsPage({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const { data, error, reload } = useLoad(() => api.products({ search, limit: 200 }), [search]);
  return (
    <>
      <div className="page-head">
        <h1>Товары <span className="muted">{data?.total ?? ''}</span></h1>
        {canEdit && <button className="btn" onClick={() => setEditing('new')}>+ Товар</button>}
      </div>
      <div className="filters"><input placeholder="Название, артикул, код или штрихкод" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <ErrorText error={error} />
      <Table head={['Наименование', 'Артикул', 'Код', 'Модификации', 'Штрихкоды', 'Закупочная цена', 'Маркировка']}>
        {data?.rows.map((p) => (
          <tr key={p.id} className={canEdit ? 'clickable' : ''} onClick={() => canEdit && setEditing(p)}>
            <td>{p.name}</td><td>{p.article}</td><td>{p.code}</td>
            <td>{p.variants.map((v) => v.name).filter(Boolean).join(', ') || '—'}</td>
            <td>{p.variants.flatMap((v) => v.barcodes).join(', ')}</td>
            <td className="num">{formatRub(p.buyPrice)}</td><td>{p.markingType ?? ''}</td>
          </tr>
        ))}
      </Table>
      {data && data.total > data.rows.length && <p className="muted">Показаны первые {data.rows.length} из {data.total}. Уточните поиск.</p>}
      {editing && <ProductEditor product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

type VariantForm = { id?: number; characteristics: string; code: string; barcodes: string; prices: Record<string, { value: string; currency: string }> };

/** "Размер=M; Цвет=Синий" ↔ { Размер: 'M', Цвет: 'Синий' } */
const charsToText = (c: Record<string, string>) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ');
const textToChars = (t: string) => Object.fromEntries(t.split(';').map((p) => p.split('=').map((x) => x.trim())).filter((p) => p[0] && p[1]) as [string, string][]);

function ProductEditor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const refs = useLoad(async () => {
    const [priceTypes, currencies, folders] = await Promise.all([api.priceTypes(), api.currencies(), api.folders()]);
    return { priceTypes, currencies, folders } as { priceTypes: PriceType[]; currencies: Currency[]; folders: Folder[] };
  }, []);
  const [f, setF] = useState({
    name: product?.name ?? '', article: product?.article ?? '', code: product?.code ?? '', folderId: product?.folderId ?? null,
    unit: product?.unit ?? 'шт', vat: product?.vat == null ? '' : String(product.vat), isService: product?.isService ?? false,
    markingType: product?.markingType ?? '', buyPrice: toMoney(product?.buyPrice), minStock: String(product?.minStock ?? 0),
    description: product?.description ?? '', archived: product?.archived ?? false,
  });
  const [variants, setVariants] = useState<VariantForm[]>(() =>
    (product?.variants.length ? product.variants : [{ characteristics: {}, code: null, barcodes: [], prices: {} } as unknown as Product['variants'][number]])
      .map((v) => ({
        id: v.id, characteristics: charsToText(v.characteristics ?? {}), code: v.code ?? '', barcodes: (v.barcodes ?? []).join(', '),
        prices: Object.fromEntries(Object.entries(v.prices ?? {}).map(([k, p]) => [k, { value: toMoney(p.value), currency: p.currency }])),
      })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  const setV = (i: number, patch: Partial<VariantForm>) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const save = async () => {
    setBusy(true);
    setError('');
    const body: ProductInput = {
      name: f.name, article: f.article || null, code: f.code || null, folderId: f.folderId, unit: f.unit || 'шт',
      vat: f.vat === '' ? null : Number(f.vat), isService: f.isService, markingType: (f.markingType || null) as ProductInput['markingType'],
      buyPrice: fromMoney(f.buyPrice), minStock: toNum(f.minStock), description: f.description || null, archived: f.archived,
      attributes: product?.attributes as ProductInput['attributes'],
      variants: variants.map((v) => ({
        id: v.id, characteristics: textToChars(v.characteristics), code: v.code || null,
        barcodes: v.barcodes.split(/[,\s]+/).map((b) => b.trim()).filter(Boolean),
        prices: Object.fromEntries(Object.entries(v.prices).filter(([, p]) => p.value !== '' && fromMoney(p.value) > 0)
          .map(([k, p]) => [k, { value: fromMoney(p.value), currency: p.currency || 'RUB' }])),
      })),
    };
    try {
      if (product) await api.updateProduct(product.id, body); else await api.createProduct(body);
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const pts = refs.data?.priceTypes ?? [];
  const curs = refs.data?.currencies ?? [{ code: 'RUB' } as Currency];
  return (
    <Modal title={product ? product.name : 'Новый товар'} onClose={onClose}
      footer={<><ErrorText error={error} /><button className="btn secondary" onClick={onClose}>Отмена</button><button className="btn" disabled={busy || !f.name} onClick={save}>Сохранить</button></>}>
      <div className="grid">
        <Field label="Наименование" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Артикул"><input value={f.article} onChange={(e) => set('article', e.target.value)} /></Field>
        <Field label="Код"><input value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Группа">
          <select value={f.folderId ?? ''} onChange={(e) => set('folderId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {refs.data?.folders.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Ед. изм."><input value={f.unit} onChange={(e) => set('unit', e.target.value)} /></Field>
        <Field label="НДС, %">
          <select value={f.vat} onChange={(e) => set('vat', e.target.value)}>
            <option value="">без НДС</option>{[0, 5, 7, 10, 20, 22].map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
        </Field>
        <Field label="Закупочная цена, ₽"><input inputMode="decimal" value={f.buyPrice} onChange={(e) => set('buyPrice', e.target.value)} /></Field>
        <Field label="Неснижаемый остаток"><input inputMode="decimal" value={f.minStock} onChange={(e) => set('minStock', e.target.value)} /></Field>
        <Field label="Маркировка (Честный знак)">
          <select value={f.markingType} onChange={(e) => set('markingType', e.target.value)}>
            <option value="">нет</option>{MARKING_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Описание" wide><textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={f.isService} onChange={(e) => set('isService', e.target.checked)} /> Услуга (без остатков)</label>
        <label className="check"><input type="checkbox" checked={f.archived} onChange={(e) => set('archived', e.target.checked)} /> В архиве</label>
      </div>

      <h3>Модификации, штрихкоды и цены</h3>
      {variants.map((v, i) => (
        <div key={i} className="variant">
          <div className="grid">
            <Field label="Характеристики (Размер=M; Цвет=Синий)" wide><input value={v.characteristics} onChange={(e) => setV(i, { characteristics: e.target.value })} placeholder="пусто — без модификаций" /></Field>
            <Field label="Штрихкоды (через запятую)" wide><input value={v.barcodes} onChange={(e) => setV(i, { barcodes: e.target.value })} /></Field>
            {pts.map((pt) => {
              const p = v.prices[String(pt.id)] ?? { value: '', currency: 'RUB' };
              return (
                <Field key={pt.id} label={pt.name}>
                  <div className="row">
                    <input inputMode="decimal" value={p.value} onChange={(e) => setV(i, { prices: { ...v.prices, [pt.id]: { ...p, value: e.target.value } } })} />
                    <select className="cur" value={p.currency} onChange={(e) => setV(i, { prices: { ...v.prices, [pt.id]: { ...p, currency: e.target.value } } })}>
                      {curs.map((c) => <option key={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                </Field>
              );
            })}
          </div>
          {variants.length > 1 && <button className="link danger" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>Удалить модификацию</button>}
        </div>
      ))}
      <button className="btn secondary" onClick={() => setVariants([...variants, { characteristics: '', code: '', barcodes: '', prices: {} }])}>+ Модификация</button>
    </Modal>
  );
}
