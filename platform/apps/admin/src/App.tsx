import type { Me, Role } from '@vordi/contracts';
import { useEffect, useState, type FormEvent } from 'react';
import { api, saveSession, session } from './api.ts';
import { CounterpartiesPage } from './pages/Counterparties.tsx';
import { DocumentsPage } from './pages/Documents.tsx';
import { EmployeesPage } from './pages/Employees.tsx';
import { ProductsPage } from './pages/Products.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { StockPage } from './pages/Stock.tsx';

/**
 * Yönetim paneli. Menü МойСклад yapısını izler; her rol yalnızca yetkili olduğu bölümleri görür.
 */
type Page = 'stock' | 'products' | 'purchase' | 'sales' | 'retail' | 'warehouse' | 'money' | 'counterparties' | 'employees' | 'settings';
const MENU: { key: Page; title: string; roles: Role[] }[] = [
  { key: 'stock', title: 'Остатки', roles: ['admin', 'manager', 'storekeeper', 'cashier'] },
  { key: 'products', title: 'Товары', roles: ['admin', 'manager', 'storekeeper'] },
  { key: 'purchase', title: 'Закупки', roles: ['admin', 'manager'] },
  { key: 'sales', title: 'Продажи', roles: ['admin', 'manager'] },
  { key: 'retail', title: 'Розница', roles: ['admin', 'manager', 'cashier'] },
  { key: 'warehouse', title: 'Склад', roles: ['admin', 'manager', 'storekeeper'] },
  { key: 'money', title: 'Деньги', roles: ['admin', 'manager'] },
  { key: 'counterparties', title: 'Контрагенты', roles: ['admin', 'manager'] },
  { key: 'employees', title: 'Сотрудники', roles: ['admin'] },
  { key: 'settings', title: 'Настройки', roles: ['admin', 'manager', 'storekeeper', 'cashier'] },
];
const SECTION: Partial<Record<Page, string>> = { purchase: 'purchase', sales: 'sales', retail: 'retail', warehouse: 'stock', money: 'money' };

const pageFromHash = (): Page => {
  const h = location.hash.slice(1) as Page;
  return MENU.some((m) => m.key === h) ? h : 'stock';
};

export function App() {
  const [user, setUser] = useState<Me | null>(session()?.user ?? null);
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const h = () => setPage(pageFromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  // Oturum sunucuda kapanmışsa (şifre değişti, kullanıcı kapatıldı) girişe dön.
  useEffect(() => { if (user) api.me().catch(() => { saveSession(null); setUser(null); }); }, [user]);

  if (!user) return <Login onLogin={(s) => { saveSession(s); setUser(s.user); }} />;
  const logout = async () => { await api.logout().catch(() => null); saveSession(null); setUser(null); };
  const menu = MENU.filter((m) => m.roles.includes(user.role));
  const current = menu.some((m) => m.key === page) ? page : menu[0]!.key;
  const manager = user.role === 'admin' || user.role === 'manager';

  return (
    <div className="layout">
      <aside>
        <div className="brand">Vordi</div>
        <nav>{menu.map((m) => <a key={m.key} href={`#${m.key}`} className={current === m.key ? 'active' : ''}>{m.title}</a>)}</nav>
        <div className="me">{user.name}<button className="link" onClick={logout}>Выйти</button></div>
      </aside>
      <main>
        {current === 'stock' && <StockPage showCost={manager} />}
        {current === 'products' && <ProductsPage canEdit={manager} />}
        {current === 'counterparties' && <CounterpartiesPage />}
        {current === 'employees' && <EmployeesPage />}
        {current === 'settings' && <SettingsPage />}
        {SECTION[current] && <DocumentsPage key={current} section={SECTION[current]!} />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (s: { token: string; user: Me }) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { onLogin(await api.login(login, password)); } catch (err) { setError((err as Error).message); }
  };
  return (
    <form className="login" onSubmit={submit}>
      <h1>Vordi</h1>
      <input placeholder="Логин" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
      <input placeholder="Пароль" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn">Войти</button>
    </form>
  );
}
