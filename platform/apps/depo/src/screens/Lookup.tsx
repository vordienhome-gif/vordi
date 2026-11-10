import type { ScanResult, Warehouse } from '@vordi/contracts';
import { Suspense, useState } from 'react';
import { api, feedback } from '../api.ts';
import { useT } from '../i18n.ts';
import { CameraScanner, useHardwareScanner } from '../scanner.tsx';
import { ManualEntry } from './Operation.tsx';

/** Barkodu okutup ürünün depolardaki stoğunu gösterir. */
export function Lookup({ warehouses, onBack }: { warehouses: Warehouse[]; onBack: () => void }) {
  const t = useT();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);

  const scan = async (code: string) => {
    setError('');
    try {
      setResult(await api.scan(code));
      feedback(true);
    } catch (e) {
      setResult(null);
      setError((e as Error).message || t.notFound);
      feedback(false);
    }
  };
  useHardwareScanner(scan, !camera);
  const name = (id: number) => warehouses.find((w) => w.id === id)?.name ?? `#${id}`;

  return (
    <div className="page">
      <header className="bar"><button className="link" onClick={onBack}>← {t.back}</button><strong>{t.lookup}</strong><span /></header>
      {camera ? <Suspense fallback={<p className="muted center">…</p>}><CameraScanner onScan={(c) => { setCamera(false); scan(c); }} onClose={() => setCamera(false)} /></Suspense> : (
        <div className="scanbox">
          <p className="muted">{t.scanHint}</p>
          <button className="btn wide" onClick={() => setCamera(true)}>{t.camera}</button>
          <ManualEntry onSubmit={scan} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && (
        <section className="card">
          <h2>{result.product.name}{result.variant.name ? ` · ${result.variant.name}` : ''}</h2>
          {result.product.article && <p className="muted">{result.product.article}</p>}
          <table className="table">
            <thead><tr><th>{t.warehouse}</th><th>{t.stock}</th><th>{t.reserve}</th><th>{t.available}</th></tr></thead>
            <tbody>
              {result.stock.map((s) => (
                <tr key={s.warehouseId}><td>{name(s.warehouseId)}</td><td>{s.stock}</td><td>{s.reserve}</td><td><b>{s.available}</b></td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
