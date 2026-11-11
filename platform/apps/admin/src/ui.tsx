import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Veri yükleme: { data, error, reload }. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const run = useCallback(load, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => { setError(''); run().then(setData).catch((e) => setError(e.message)); }, [run]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

/** Kopek ↔ ruble metin dönüşümü (virgül de kabul edilir). */
export const toMoney = (k: number | null | undefined) => ((k ?? 0) / 100).toFixed(2);
export const fromMoney = (s: string) => Math.round((Number(String(s).replace(/\s/g, '').replace(',', '.')) || 0) * 100);
export const toNum = (s: string) => Number(String(s).replace(',', '.')) || 0;

/** <input type="datetime-local"> değeri ↔ ISO (Moskova saati, +03:00). */
export const toLocalInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 3 * 3600e3);
  return d.toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => `${v}:00+03:00`;

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field${wide ? ' wide' : ''}`}><span>{label}</span>{children}</label>;
}

export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <header><h2>{title}</h2><button className="link" onClick={onClose} aria-label="Закрыть">✕</button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

/** Yazdıkça arayan seçim kutusu (cari, ürün). */
export function SearchSelect<T>({ placeholder, search, label, onPick, value }: {
  placeholder: string; search: (q: string) => Promise<T[]>; label: (t: T) => string; onPick: (t: T) => void; value?: string;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const n = ++seq.current;
    const t = setTimeout(() => { search(q).then((r) => { if (n === seq.current) setItems(r); }).catch(() => setItems([])); }, 200);
    return () => clearTimeout(t);
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="search-select">
      <input placeholder={value || placeholder} value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && items.length > 0 && (
        <ul>{items.map((it, i) => <li key={i} onMouseDown={() => { onPick(it); setQ(''); setOpen(false); }}>{label(it)}</li>)}</ul>
      )}
    </div>
  );
}

export function ErrorText({ error }: { error: string }) {
  return error ? <p className="error">{error}</p> : null;
}
