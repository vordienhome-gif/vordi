import { useState, type FormEvent } from 'react';
import { api } from '../api.ts';
import { ErrorText, Field } from '../ui.tsx';

export function SettingsPage() {
  const [f, setF] = useState({ current: '', next: '', repeat: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (f.next !== f.repeat) return setError('Пароли не совпадают');
    try {
      await api.changePassword(f.current, f.next);
      setMsg('Пароль изменён. Остальные сеансы завершены.');
      setF({ current: '', next: '', repeat: '' });
    } catch (err) { setError((err as Error).message); }
  };
  return (
    <>
      <h1>Настройки</h1>
      <form className="card narrow" onSubmit={submit}>
        <h3>Смена пароля</h3>
        <Field label="Текущий пароль"><input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="Новый пароль (не менее 8 символов)"><input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Повторите новый пароль"><input type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} /></Field>
        <ErrorText error={error} />
        {msg && <p className="ok">{msg}</p>}
        <button className="btn" disabled={f.next.length < 8}>Сменить пароль</button>
      </form>
    </>
  );
}
