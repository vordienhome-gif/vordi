import { createClient, type Counterparty, type DocumentDto, type Me, type Product, type StockRow, type Warehouse } from '@vordi/contracts';
import { DOC_TYPES, formatRub, type DocType } from '@vordi/domain';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';

/**
 * Yönetim paneli — ilk iskelet. МойСклад menü yapısını izler:
 * Göstergeler · Alış · Satış · Ürünler · Depo · Para · Cariler · Raporlar · Ayarlar.
 * Şimdilik: stok raporu, ürün listesi, belge listeleri, cari bakiyeleri. Formlar sonraki adımlarda eklenecek.
 */
const SESSION = 'vordi.admin.session';
const session = (): { token: string; user: Me } | null => { try { return JSON.parse(localStorage.getItem(SESSION) ?? 'null'); } catch { return null; } };
const api = createClient({ baseUrl: import.meta.env.VITE_API_URL ?? '/api', getToken: () => session()?.token ?? null });

type Page = 'stock' | 'products' | 'counterparties' | 'purchase' | 'sales' | 'retail' | 'warehouse' | 'money';
const MENU: { key: Page; title: string }[] = [
  { key: 'stock', title: 'Остатки' },
  { key: 'products', title: 'Товары' },
  { key: 'purchase', title: 'Закупки' },
  { key: 'sales', title: 'Продажи' },
  { key: 'retail', title: 'Розница' },
  { key: 'warehouse', title: 'Склад' },
  { key: 'money', title: 'Деньги' },
  { key: 'counterparties', title: 'Контрагенты' },
];
const SECTION: Partial<Record<Page, string>> = { purchase: 'purchase', sales: 'sales', retail: 'retail', warehouse: 'stock', money: 'money' };

export function App() {
  const [user, setUser] = useState<Me | null>(session()?.user ?? null);
  const [page, setPage] = useState<Page>('stock');
  if (!user) return <Login onLogin={(s) => { localStorage.setItem(SESSION, JSON.stringify(s)); setUser(s.user); }} />;
  const logout = async () => { await api.logout().catch(() => null); localStorage.removeItem(SESSION); setUser(null); };

  return (
    <div className="layout">
      <aside>
        <div className="brand">Vordi</div>
        <nav>{MENU.map((m) => <button key={m.key} className={page === m.key ? 'active' : ''} onClick={() => setPage(m.key)}>{m.title}</button>)}</nav>
        <div className="me">{user.name}<button className="link" onClick={logout}>Выйти</button></div>
      </aside>
      <main>
        {page === 'stock' && <StockPage />}
        {page === 'products' && <ProductsPage />}
        {page === 'counterparties' && <CounterpartiesPage />}
        {page in SECTION && <DocumentsPage key={page} section={SECTION[page]!} />}
      </main>
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const run = useCallback(load, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setError(''); run().then(setData).catch((e) => setError(e.message)); }, [run]);
  return { data, error };
}

function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function StockPage() {
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const wh = useLoad<Warehouse[]>(() => api.warehouses(), []);
  const { data, error } = useLoad<StockRow[]>(() => api.stockReport({ search, warehouseId }), [search, warehouseId]);
  const name = (id: number) => wh.data?.find((w) => w.id === id)?.name ?? id;
  const total = data?.reduce((s, r) => s + r.costValue, 0) ?? 0;
  return (
    <>
      <h1>Остатки</h1>
      <div className="filters">
        <input placeholder="Поиск по названию или артикулу" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={warehouseId ?? ''} onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Все склады</option>
          {wh.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <Table head={['Товар', 'Модификация', 'Артикул', 'Склад', 'Остаток', 'Резерв', 'Ожидание', 'Доступно', 'Себестоимость']}>
        {data?.map((r) => (
          <tr key={`${r.variantId}:${r.warehouseId}`}>
            <td>{r.productName}</td><td>{r.variantName}</td><td>{r.article}</td><td>{name(r.warehouseId)}</td>
            <td className="num">{r.stock}</td><td className="num">{r.reserve}</td><td className="num">{r.expected}</td>
            <td className="num"><b>{r.available}</b></td><td className="num">{formatRub(r.costValue)}</td>
          </tr>
        ))}
      </Table>
      <p className="muted">Стоимость остатков (FIFO): <b>{formatRub(total)}</b></p>
    </>
  );
}

function ProductsPage() {
  const [search, setSearch] = useState('');
  const { data, error } = useLoad(() => api.products({ search, limit: 200 }), [search]);
  return (
    <>
      <h1>Товары <span className="muted">{data?.total ?? ''}</span></h1>
      <div className="filters"><input placeholder="Название, артикул, код или штрихкод" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {error && <p className="error">{error}</p>}
      <Table head={['Наименование', 'Артикул', 'Модификации', 'Штрихкоды', 'Закупочная цена', 'Маркировка']}>
        {data?.rows.map((p: Product) => (
          <tr key={p.id}>
            <td>{p.name}</td><td>{p.article}</td>
            <td>{p.variants.map((v) => v.name).filter(Boolean).join(', ') || '—'}</td>
            <td>{p.variants.flatMap((v) => v.barcodes).join(', ')}</td>
            <td className="num">{formatRub(p.buyPrice)}</td><td>{p.markingType ?? ''}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function CounterpartiesPage() {
  const { data, error } = useLoad(() => api.counterparties(), []);
  return (
    <>
      <h1>Контрагенты</h1>
      {error && <p className="error">{error}</p>}
      <Table head={['Наименование', 'ИНН', 'Телефон', 'E-mail', 'Баланс']}>
        {data?.rows.map((c: Counterparty) => (
          <tr key={c.id}>
            <td>{c.name}</td><td>{c.inn}</td><td>{c.phone}</td><td>{c.email}</td>
            <td className={`num ${(c.balance ?? 0) < 0 ? 'neg' : ''}`}>{formatRub(c.balance ?? 0)}</td>
          </tr>
        ))}
      </Table>
      <p className="muted">Положительный баланс — контрагент должен нам, отрицательный — мы должны контрагенту.</p>
    </>
  );
}

function DocumentsPage({ section }: { section: string }) {
  const types = (Object.keys(DOC_TYPES) as DocType[]).filter((t) => DOC_TYPES[t].section === section);
  const [type, setType] = useState<DocType>(types[0]!);
  const { data, error } = useLoad(() => api.documents({ type, limit: 100 }), [type]);
  return (
    <>
      <div className="tabs">{types.map((t) => <button key={t} className={t === type ? 'active' : ''} onClick={() => setType(t)}>{DOC_TYPES[t].ru}</button>)}</div>
      {error && <p className="error">{error}</p>}
      <Table head={['№', 'Время', 'Статус', 'Сумма', 'Позиций', 'Проведён', 'Комментарий']}>
        {data?.rows.map((d: DocumentDto) => (
          <tr key={d.id}>
            <td>{d.number}</td><td>{new Date(d.moment).toLocaleString('ru-RU')}</td><td>{d.status}</td>
            <td className="num">{formatRub(d.sum)}</td><td className="num">{d.lines.length}</td>
            <td>{d.posted ? '✓' : ''}</td><td>{d.comment}</td>
          </tr>
        ))}
      </Table>
      {data && data.rows.length === 0 && <p className="muted">Документов нет</p>}
    </>
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
