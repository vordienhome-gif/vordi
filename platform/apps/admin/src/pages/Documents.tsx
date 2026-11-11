import type { Account, Counterparty, DocumentDto, DocumentInput, Organization, PriceType, Product, Warehouse } from '@vordi/contracts';
import { DERIVES, DOC_TYPES, docType, formatRub, type DocType } from '@vordi/domain';
import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { ErrorText, Field, fromLocalInput, fromMoney, Modal, SearchSelect, Table, toLocalInput, toMoney, toNum, useLoad } from '../ui.tsx';

const PURCHASE_PRICE: DocType[] = ['purchaseorder', 'invoicein', 'supply', 'purchasereturn', 'enter', 'loss', 'move', 'inventory'];

export function DocumentsPage({ section }: { section: string }) {
  const types = (Object.keys(DOC_TYPES) as DocType[]).filter((t) => DOC_TYPES[t].section === section);
  const [type, setType] = useState<DocType>(types[0]!);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<{ id?: number; type: DocType; draft?: DocumentInput } | null>(null);
  const { data, error, reload } = useLoad(() => api.documents({ type, limit: 100, search }), [type, search]);
  const refs = useLoad(async () => ({ warehouses: await api.warehouses() }), []);
  const wh = (id: number | null) => refs.data?.warehouses.find((w) => w.id === id)?.name ?? '';
  return (
    <>
      <div className="tabs">{types.map((t) => <button key={t} className={t === type ? 'active' : ''} onClick={() => setType(t)}>{DOC_TYPES[t].ru}</button>)}</div>
      <div className="filters">
        <input placeholder="Поиск по номеру" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn" onClick={() => setOpen({ type })}>+ {DOC_TYPES[type].ru}</button>
      </div>
      <ErrorText error={error} />
      <Table head={['№', 'Время', 'Склад', 'Статус', 'Сумма', 'Позиций', 'Проведён', 'Комментарий']}>
        {data?.rows.map((d) => (
          <tr key={d.id} className="clickable" onClick={() => setOpen({ id: d.id, type: d.type })}>
            <td>{d.number}</td><td>{new Date(d.moment).toLocaleString('ru-RU')}</td><td>{wh(d.warehouseId)}</td><td>{d.status}</td>
            <td className="num">{formatRub(d.sum)}</td><td className="num">{d.lines.length}</td>
            <td>{d.posted ? '✓' : ''}</td><td className="ellipsis">{d.comment}</td>
          </tr>
        ))}
      </Table>
      {data && data.rows.length === 0 && <p className="muted">Документов нет</p>}
      {open && (
        <DocumentEditor key={`${open.type}:${open.id ?? 'new'}`} type={open.type} id={open.id} draft={open.draft}
          onClose={() => { setOpen(null); reload(); }}
          onDerive={(t, draft) => { setOpen({ type: t, draft }); }} />
      )}
    </>
  );
}

type Line = { variantId: number; name: string; qty: string; price: string; discount: string; codes: string[]; expected: number | null };
interface Refs { warehouses: Warehouse[]; organizations: Organization[]; accounts: Account[]; priceTypes: PriceType[] }

function DocumentEditor({ type, id, draft, onClose, onDerive }: {
  type: DocType; id?: number; draft?: DocumentInput; onClose: () => void; onDerive: (t: DocType, d: DocumentInput) => void;
}) {
  const def = docType(type);
  const refs = useLoad<Refs>(async () => {
    const [warehouses, organizations, accounts, priceTypes] = await Promise.all([api.warehouses(), api.organizations(), api.accounts().catch(() => []), api.priceTypes()]);
    return { warehouses: warehouses.filter((w) => !w.archived), organizations, accounts, priceTypes };
  }, []);
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [h, setH] = useState({
    moment: toLocalInput(draft?.moment ?? new Date().toISOString()), warehouseId: draft?.warehouseId ?? null, targetWarehouseId: draft?.targetWarehouseId ?? null,
    counterpartyId: draft?.counterpartyId ?? null, counterpartyName: '', accountId: draft?.accountId ?? null, organizationId: draft?.organizationId ?? null,
    status: draft?.status ?? '', comment: draft?.comment ?? '', sum: toMoney(draft?.sum ?? 0), parentId: draft?.parentId ?? null,
  });
  const [lines, setLines] = useState<Line[]>(() => (draft?.lines ?? []).map((l) => ({
    variantId: l.variantId, name: (l as { name?: string }).name ?? `#${l.variantId}`, qty: String(l.qty), price: toMoney(l.price ?? 0),
    discount: String(l.discount ?? 0), codes: l.codes ?? [], expected: null,
  })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState('');

  // Mevcut belgeyi yükle
  useEffect(() => {
    if (!id) return;
    api.document(id).then((d) => {
      setDoc(d);
      setH({ moment: toLocalInput(d.moment), warehouseId: d.warehouseId, targetWarehouseId: d.targetWarehouseId, counterpartyId: d.counterpartyId,
        counterpartyName: '', accountId: d.accountId, organizationId: d.organizationId, status: d.status ?? '', comment: d.comment ?? '',
        sum: toMoney(d.sum), parentId: d.parentId });
      setLines(d.lines.map((l) => ({ variantId: l.variantId, name: `${l.productName ?? ''}${l.variantName ? ` · ${l.variantName}` : ''}`,
        qty: String(l.qty), price: toMoney(l.price), discount: String(l.discount), codes: l.codes, expected: l.expected })));
    }).catch((e) => setError(e.message));
  }, [id]);
  // Varsayılanlar: tek depo / tek tüzel kişi / belge türüne uygun hesap
  useEffect(() => {
    if (!refs.data || id) return;
    setH((x) => ({
      ...x,
      warehouseId: x.warehouseId ?? (refs.data!.warehouses.length === 1 ? refs.data!.warehouses[0]!.id : null),
      organizationId: x.organizationId ?? refs.data!.organizations[0]?.id ?? null,
      accountId: x.accountId ?? refs.data!.accounts.find((a) => a.kind === (type.startsWith('cash') || type.startsWith('retail') ? 'cash' : 'bank'))?.id ?? null,
    }));
  }, [refs.data, id, type]);
  useEffect(() => {
    if (h.counterpartyId && !h.counterpartyName) {
      api.counterparty(h.counterpartyId).then((c) => setH((x) => ({ ...x, counterpartyName: c.name }))).catch(() => null);
    }
  }, [h.counterpartyId, h.counterpartyName]);

  const defaultPrice = (p: Product, variantId: number) => {
    if (PURCHASE_PRICE.includes(type)) return p.buyPrice;
    const v = p.variants.find((x) => x.id === variantId);
    const rub = Object.values(v?.prices ?? {}).find((x) => x.currency === 'RUB');
    return rub?.value ?? 0;
  };
  const addVariant = (p: Product, variantId: number, code?: string) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.variantId === variantId);
      if (i >= 0) {
        const l = ls[i]!;
        const codes = code ? [...l.codes, code] : l.codes;
        return ls.map((x, j) => (j === i ? { ...x, qty: String(code ? codes.length : toNum(x.qty) + 1), codes } : x));
      }
      const v = p.variants.find((x) => x.id === variantId);
      return [...ls, { variantId, name: `${p.name}${v?.name ? ` · ${v.name}` : ''}`, qty: '1', price: toMoney(defaultPrice(p, variantId)), discount: '0', codes: code ? [code] : [], expected: null }];
    });
  };
  const onScan = async () => {
    const code = scan.trim();
    if (!code) return;
    setScan('');
    try {
      const r = await api.scan(code);
      const p = await api.product(r.product.id);
      addVariant(p, r.variant.id, r.markingCode ? code : undefined);
      setError(r.alternatives?.length ? `Штрихкод есть и у других товаров: ${r.alternatives.map((a) => a.productName).join('; ')}` : '');
    } catch (e) { setError((e as Error).message); }
  };

  const total = lines.reduce((s, l) => s + Math.round(toNum(l.qty) * fromMoney(l.price) * (1 - toNum(l.discount) / 100)), 0);
  const body = (posted: boolean): DocumentInput => ({
    type, posted, moment: fromLocalInput(h.moment), warehouseId: h.warehouseId, targetWarehouseId: h.targetWarehouseId,
    counterpartyId: h.counterpartyId, accountId: h.accountId, organizationId: h.organizationId, status: h.status || null,
    comment: h.comment || null, parentId: h.parentId, sum: def.lines ? null : fromMoney(h.sum),
    lines: lines.map((l) => ({ variantId: l.variantId, qty: toNum(l.qty), price: fromMoney(l.price), discount: toNum(l.discount), codes: l.codes })),
  });
  const run = async (fn: () => Promise<unknown>, close = true) => {
    setBusy(true); setError('');
    try { await fn(); if (close) onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const save = (posted: boolean) => run(() => (id ? api.updateDocument(id, body(posted)) : api.createDocument(body(posted))));
  const derive = (t: DocType) => {
    const b = body(false);
    onDerive(t, { ...b, type: t, parentId: id ?? null, status: null, comment: null,
      lines: lines.map((l) => ({ ...b.lines!.find((x) => x.variantId === l.variantId)!, name: l.name } as never)) });
  };

  const whSelect = (value: number | null, set: (v: number | null) => void) => (
    <select value={value ?? ''} onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}>
      <option value="">—</option>{refs.data?.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );

  return (
    <Modal title={<>{def.ru} {doc ? `№ ${doc.number}` : '(новый)'} {doc?.posted && <span className="badge">проведён</span>}</>} onClose={onClose}
      footer={<>
        <ErrorText error={error} />
        {id && <button className="link danger" disabled={busy} onClick={() => confirm('Удалить документ?') && run(() => api.deleteDocument(id))}>Удалить</button>}
        {id && type === 'inventory' && doc?.posted && <button className="btn secondary" disabled={busy} onClick={() => run(() => api.applyInventory(id))}>Применить (оприходовать/списать)</button>}
        {id && (DERIVES[type] ?? []).length > 0 && (
          <select className="derive" value="" onChange={(e) => e.target.value && derive(e.target.value as DocType)}>
            <option value="">Создать на основании…</option>
            {(DERIVES[type] ?? []).map((t) => <option key={t} value={t}>{DOC_TYPES[t].ru}</option>)}
          </select>
        )}
        <button className="btn secondary" disabled={busy} onClick={() => save(false)}>{doc?.posted ? 'Отменить проведение' : 'Сохранить черновик'}</button>
        <button className="btn" disabled={busy} onClick={() => save(true)}>Провести</button>
      </>}>
      <div className="grid">
        <Field label="Время"><input type="datetime-local" value={h.moment} onChange={(e) => setH({ ...h, moment: e.target.value })} /></Field>
        {refs.data && refs.data.organizations.length > 0 && (
          <Field label="Организация">
            <select value={h.organizationId ?? ''} onChange={(e) => setH({ ...h, organizationId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>{refs.data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        {def.warehouse && <Field label={def.targetWarehouse ? 'Со склада' : 'Склад'}>{whSelect(h.warehouseId, (v) => setH({ ...h, warehouseId: v }))}</Field>}
        {def.targetWarehouse && <Field label="На склад">{whSelect(h.targetWarehouseId, (v) => setH({ ...h, targetWarehouseId: v }))}</Field>}
        {def.counterparty && (
          <Field label="Контрагент">
            <SearchSelect<Counterparty> placeholder="Найти контрагента" value={h.counterpartyName}
              search={async (q) => (await api.counterparties({ search: q, limit: 20 })).rows} label={(c) => `${c.name}${c.inn ? ` · ИНН ${c.inn}` : ''}`}
              onPick={(c) => setH({ ...h, counterpartyId: c.id, counterpartyName: c.name })} />
          </Field>
        )}
        {def.account && (
          <Field label="Счёт / касса">
            <select value={h.accountId ?? ''} onChange={(e) => setH({ ...h, accountId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>{refs.data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        {(type === 'customerorder' || type === 'purchaseorder') && <Field label="Статус"><input value={h.status} onChange={(e) => setH({ ...h, status: e.target.value })} /></Field>}
        {!def.lines && <Field label="Сумма, ₽"><input inputMode="decimal" value={h.sum} onChange={(e) => setH({ ...h, sum: e.target.value })} /></Field>}
        <Field label="Комментарий" wide><input value={h.comment} onChange={(e) => setH({ ...h, comment: e.target.value })} /></Field>
      </div>

      {def.lines && (
        <>
          <div className="row add-line">
            <SearchSelect<{ p: Product; v: Product['variants'][number] }> placeholder="Добавить товар: название, артикул, код"
              search={async (q) => (await api.products({ search: q, limit: 15 })).rows.flatMap((p) => p.variants.map((v) => ({ p, v })))}
              label={({ p, v }) => `${p.name}${v.name ? ` · ${v.name}` : ''}${p.article ? ` (${p.article})` : ''}`}
              onPick={({ p, v }) => addVariant(p, v.id)} />
            <input className="scan" placeholder="Штрихкод / DataMatrix + Enter" value={scan} onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onScan(); } }} />
          </div>
          <Table head={['Товар', ...(type === 'inventory' ? ['Расч. остаток'] : []), type === 'inventory' ? 'Факт' : 'Кол-во', 'Цена, ₽', 'Скидка, %', 'Сумма', '']}>
            {lines.map((l, i) => {
              const upd = (patch: Partial<Line>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <tr key={l.variantId}>
                  <td>{l.name}{l.codes.length > 0 && <div className="muted">кодов маркировки: {l.codes.length}</div>}</td>
                  {type === 'inventory' && <td className="num">{l.expected ?? '—'}</td>}
                  <td><input className="cell" inputMode="decimal" value={l.qty} onChange={(e) => upd({ qty: e.target.value })} /></td>
                  <td><input className="cell" inputMode="decimal" value={l.price} onChange={(e) => upd({ price: e.target.value })} /></td>
                  <td><input className="cell short" inputMode="decimal" value={l.discount} onChange={(e) => upd({ discount: e.target.value })} /></td>
                  <td className="num">{formatRub(Math.round(toNum(l.qty) * fromMoney(l.price) * (1 - toNum(l.discount) / 100)))}</td>
                  <td><button className="link danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              );
            })}
          </Table>
          <p className="total">Итого: <b>{formatRub(total)}</b> · позиций: {lines.length}</p>
        </>
      )}
    </Modal>
  );
}
