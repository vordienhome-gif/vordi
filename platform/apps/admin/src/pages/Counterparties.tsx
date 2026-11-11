import type { Counterparty, CounterpartyInput } from '@vordi/contracts';
import { formatRub } from '@vordi/domain';
import { useState } from 'react';
import { api } from '../api.ts';
import { ErrorText, Field, fromMoney, Modal, Table, toMoney, useLoad } from '../ui.tsx';

export function CounterpartiesPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Counterparty | 'new' | null>(null);
  const { data, error, reload } = useLoad(() => api.counterparties({ search, limit: 300 }), [search]);
  return (
    <>
      <div className="page-head">
        <h1>Контрагенты <span className="muted">{data?.total ?? ''}</span></h1>
        <button className="btn" onClick={() => setEditing('new')}>+ Контрагент</button>
      </div>
      <div className="filters"><input placeholder="Название, ИНН, телефон, e-mail" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <ErrorText error={error} />
      <Table head={['Наименование', 'ИНН', 'Телефон', 'E-mail', 'Метки', 'Баланс']}>
        {data?.rows.map((c) => (
          <tr key={c.id} className="clickable" onClick={() => setEditing(c)}>
            <td>{c.name}</td><td>{c.inn}</td><td>{c.phone}</td><td>{c.email}</td><td>{c.tags.join(', ')}</td>
            <td className={`num ${(c.balance ?? 0) < 0 ? 'neg' : ''}`}>{formatRub(c.balance ?? 0)}</td>
          </tr>
        ))}
      </Table>
      <p className="muted">Положительный баланс — контрагент должен нам, отрицательный — мы должны контрагенту.</p>
      {editing && <CounterpartyEditor cp={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function CounterpartyEditor({ cp, onClose, onSaved }: { cp: Counterparty | null; onClose: () => void; onSaved: () => void }) {
  const pts = useLoad(() => api.priceTypes(), []);
  const [f, setF] = useState({
    kind: cp?.kind ?? 'legal', name: cp?.name ?? '', inn: cp?.inn ?? '', kpp: cp?.kpp ?? '', phone: cp?.phone ?? '', email: cp?.email ?? '',
    address: cp?.address ?? '', priceTypeId: cp?.priceTypeId ?? null, tags: (cp?.tags ?? []).join(', '),
    creditLimit: cp?.creditLimit == null ? '' : toMoney(cp.creditLimit), comment: cp?.comment ?? '', archived: cp?.archived ?? false,
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    const body: CounterpartyInput = {
      kind: f.kind as CounterpartyInput['kind'], name: f.name, inn: f.inn || null, kpp: f.kpp || null, phone: f.phone || null,
      email: f.email || null, address: f.address || null, priceTypeId: f.priceTypeId, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      creditLimit: f.creditLimit === '' ? null : fromMoney(f.creditLimit), comment: f.comment || null, archived: f.archived,
    };
    try { if (cp) await api.updateCounterparty(cp.id, body); else await api.createCounterparty(body); onSaved(); } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal title={cp ? cp.name : 'Новый контрагент'} onClose={onClose}
      footer={<><ErrorText error={error} /><button className="btn secondary" onClick={onClose}>Отмена</button><button className="btn" disabled={!f.name} onClick={save}>Сохранить</button></>}>
      <div className="grid">
        <Field label="Тип">
          <select value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="legal">Юрлицо</option><option value="entrepreneur">ИП</option><option value="individual">Физлицо</option>
          </select>
        </Field>
        <Field label="Наименование" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="ИНН"><input inputMode="numeric" value={f.inn} onChange={(e) => set('inn', e.target.value)} /></Field>
        <Field label="КПП"><input inputMode="numeric" value={f.kpp} onChange={(e) => set('kpp', e.target.value)} /></Field>
        <Field label="Телефон"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="E-mail"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Адрес" wide><input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Тип цен">
          <select value={f.priceTypeId ?? ''} onChange={(e) => set('priceTypeId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>{pts.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Кредитный лимит, ₽"><input inputMode="decimal" value={f.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} placeholder="без лимита" /></Field>
        <Field label="Метки (через запятую)" wide><input value={f.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
        <Field label="Комментарий" wide><textarea rows={2} value={f.comment} onChange={(e) => set('comment', e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={f.archived} onChange={(e) => set('archived', e.target.checked)} /> В архиве</label>
      </div>
    </Modal>
  );
}
