import type { Me } from '@vordi/contracts';
import { useState, type FormEvent } from 'react';
import { api } from '../api.ts';
import { toggleLang, useT } from '../i18n.ts';

export function Login({ onLogin }: { onLogin: (s: { token: string; user: Me }) => void }) {
  const t = useT();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(login, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="page login" onSubmit={submit}>
      <h1>Vordi · {t.appTitle}</h1>
      <label>{t.login}<input autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required /></label>
      <label>{t.password}<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn wide" disabled={busy}>{t.signIn}</button>
      <button type="button" className="link" onClick={toggleLang}>{t.lang}</button>
    </form>
  );
}
