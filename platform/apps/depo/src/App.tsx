import type { Me, Warehouse } from '@vordi/contracts';
import { useEffect, useState } from 'react';
import { api, loadSession, saveSession } from './api.ts';
import type { Operation } from './draft.ts';
import { toggleLang, useT } from './i18n.ts';
import { Login } from './screens/Login.tsx';
import { Lookup } from './screens/Lookup.tsx';
import { OperationScreen } from './screens/Operation.tsx';

type Screen = { name: 'home' } | { name: 'op'; op: Operation } | { name: 'lookup' };
const OPS: Operation[] = ['enter', 'loss', 'move', 'inventory'];

export function App() {
  const t = useT();
  const [user, setUser] = useState<Me | null>(loadSession()?.user ?? null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    if (!user) return;
    api.warehouses()
      .then((ws) => setWarehouses(ws.filter((w) => !w.archived && (!user.warehouseIds.length || user.warehouseIds.includes(w.id)))))
      .catch(() => { saveSession(null); setUser(null); });
  }, [user]);

  if (!user) return <Login onLogin={(s) => { saveSession(s); setUser(s.user); }} />;

  const logout = async () => {
    await api.logout().catch(() => null);
    saveSession(null);
    setUser(null);
  };

  if (screen.name === 'op') return <OperationScreen op={screen.op} warehouses={warehouses} onBack={() => setScreen({ name: 'home' })} />;
  if (screen.name === 'lookup') return <Lookup warehouses={warehouses} onBack={() => setScreen({ name: 'home' })} />;

  return (
    <div className="page">
      <header className="bar">
        <strong>{t.appTitle}</strong>
        <span className="muted">{user.name}</span>
      </header>
      <main className="menu">
        {OPS.map((op) => (
          <button key={op} className={`tile tile-${op}`} onClick={() => setScreen({ name: 'op', op })}>
            <span className="tile-title">{t[op]}</span>
            <span className="tile-hint">{t[`${op}Hint`]}</span>
          </button>
        ))}
        <button className="tile tile-lookup" onClick={() => setScreen({ name: 'lookup' })}>
          <span className="tile-title">{t.lookup}</span>
          <span className="tile-hint">{t.lookupHint}</span>
        </button>
      </main>
      <footer className="footer">
        <button className="link" onClick={toggleLang}>{t.lang}</button>
        <button className="link" onClick={logout}>{t.signOut}</button>
      </footer>
    </div>
  );
}
