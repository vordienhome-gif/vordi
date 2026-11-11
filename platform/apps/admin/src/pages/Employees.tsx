import { ROLES, type Employee, type EmployeeInput, type Role } from '@vordi/contracts';
import { useState } from 'react';
import { api } from '../api.ts';
import { ErrorText, Field, Modal, Table, useLoad } from '../ui.tsx';

export const ROLE_NAMES: Record<Role, string> = { admin: 'Администратор', manager: 'Менеджер', storekeeper: 'Кладовщик', cashier: 'Кассир' };

export function EmployeesPage() {
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const { data, error, reload } = useLoad(() => api.employees(), []);
  const wh = useLoad(() => api.warehouses(), []);
  const whName = (ids: number[]) => (ids.length ? ids.map((i) => wh.data?.find((w) => w.id === i)?.name ?? i).join(', ') : 'все');
  return (
    <>
      <div className="page-head">
        <h1>Сотрудники</h1>
        <button className="btn" onClick={() => setEditing('new')}>+ Сотрудник</button>
      </div>
      <ErrorText error={error} />
      <Table head={['Имя', 'Логин', 'Роль', 'Склады', 'Должность', 'Телефон', 'Доступ']}>
        {data?.map((e) => (
          <tr key={e.id} className="clickable" onClick={() => setEditing(e)}>
            <td>{e.name}</td><td>{e.login}</td><td>{ROLE_NAMES[e.role]}</td><td>{whName(e.warehouseIds)}</td>
            <td>{e.position}</td><td>{e.phone}</td><td>{e.active ? 'активен' : <span className="muted">нет входа</span>}</td>
          </tr>
        ))}
      </Table>
      <p className="muted">Сотрудники из МойСклад перенесены без доступа: задайте логин и пароль и включите «Доступ разрешён».</p>
      {editing && <EmployeeEditor emp={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function EmployeeEditor({ emp, onClose, onSaved }: { emp: Employee | null; onClose: () => void; onSaved: () => void }) {
  const wh = useLoad(() => api.warehouses(), []);
  const [f, setF] = useState({
    login: emp?.login ?? '', name: emp?.name ?? '', role: (emp?.role ?? 'storekeeper') as Role, password: '',
    phone: emp?.phone ?? '', position: emp?.position ?? '', warehouseIds: emp?.warehouseIds ?? [], active: emp?.active ?? true,
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    const body: EmployeeInput = { ...f, password: f.password || undefined, phone: f.phone || null, position: f.position || null };
    try { if (emp) await api.updateEmployee(emp.id, body); else await api.createEmployee(body); onSaved(); } catch (e) { setError((e as Error).message); }
  };
  const toggleWh = (id: number) => set('warehouseIds', f.warehouseIds.includes(id) ? f.warehouseIds.filter((x) => x !== id) : [...f.warehouseIds, id]);
  return (
    <Modal title={emp ? emp.name : 'Новый сотрудник'} onClose={onClose}
      footer={<><ErrorText error={error} /><button className="btn secondary" onClick={onClose}>Отмена</button>
        <button className="btn" disabled={!f.name || f.login.length < 3 || (!emp && f.password.length < 8)} onClick={save}>Сохранить</button></>}>
      <div className="grid">
        <Field label="Имя" wide><input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Логин"><input value={f.login} autoComplete="off" onChange={(e) => set('login', e.target.value)} /></Field>
        <Field label={emp ? 'Новый пароль (пусто — не менять)' : 'Пароль (не менее 8 символов)'}>
          <input type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        <Field label="Роль">
          <select value={f.role} onChange={(e) => set('role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}</select>
        </Field>
        <Field label="Должность"><input value={f.position} onChange={(e) => set('position', e.target.value)} /></Field>
        <Field label="Телефон"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Доступ к складам (ничего не выбрано — ко всем)" wide>
          <div className="checks">{wh.data?.filter((w) => !w.archived).map((w) => (
            <label key={w.id} className="check"><input type="checkbox" checked={f.warehouseIds.includes(w.id)} onChange={() => toggleWh(w.id)} /> {w.name}</label>
          ))}</div>
        </Field>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Доступ разрешён</label>
      </div>
      <p className="muted">Кладовщик видит только складские документы и свои склады, себестоимость ему не показывается. Кассир — только розничные продажи и возвраты.</p>
    </Modal>
  );
}
