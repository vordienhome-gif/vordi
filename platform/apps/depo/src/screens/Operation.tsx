import type { Warehouse } from '@vordi/contracts';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, feedback } from '../api.ts';
import { applyScan, emptyDraft, removeLine, setQty, toDocument, totalQty, type Draft, type Operation } from '../draft.ts';
import { useT } from '../i18n.ts';
import { CameraScanner, useHardwareScanner } from '../scanner.tsx';

const draftKey = (op: Operation) => `vordi.draft.${op}`;

/** Taslak cihazda saklanır: sayfa yenilense veya şarj bitse bile okutulanlar kaybolmaz. */
function loadDraft(op: Operation, warehouses: Warehouse[]): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(op)) ?? 'null') as Draft | null;
    if (d?.op === op) return d;
  } catch { /* yok */ }
  return emptyDraft(op, warehouses.length === 1 ? warehouses[0]!.id : null);
}

export function OperationScreen({ op, warehouses, onBack }: { op: Operation; warehouses: Warehouse[]; onBack: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(op, warehouses));
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyScan = useRef(Promise.resolve());

  useEffect(() => {
    try { localStorage.setItem(draftKey(op), JSON.stringify(draft)); } catch { /* özel pencere */ }
  }, [op, draft]);

  const say = (ok: boolean, text: string) => { setMessage({ ok, text }); feedback(ok); };

  // Okutmalar sırayla işlenir: hızlı art arda okutmada satırlar karışmasın.
  const scan = (code: string) => {
    busyScan.current = busyScan.current.then(async () => {
      try {
        const res = await api.scan(code);
        setDraft((d) => {
          const r = applyScan(d, res, code);
          if (r.outcome.kind === 'need_code') say(false, `${t.needCode}: ${r.outcome.productName}`);
          else if (r.outcome.kind === 'duplicate_code') say(false, t.duplicateCode);
          else if (res.alternatives?.length) say(false, `${r.outcome.line.productName} ${r.outcome.line.variantName} · ${r.outcome.line.qty}. ${t.sharedBarcode}: ${res.alternatives.map((a) => `${a.productName} ${a.variantName}`.trim()).join('; ')}`);
          else say(true, `${r.outcome.line.productName} ${r.outcome.line.variantName} · ${r.outcome.line.qty}`);
          return r.draft;
        });
      } catch (e) {
        say(false, (e as Error).message || t.notFound);
      }
    });
  };
  useHardwareScanner(scan, !camera);

  const save = async (posted: boolean) => {
    if (!draft.warehouseId) return say(false, t.needWarehouse);
    if (op === 'move' && !draft.targetWarehouseId) return say(false, t.needTarget);
    setBusy(true);
    try {
      const doc = await api.createDocument(toDocument(draft, posted));
      if (op === 'inventory' && posted) await api.applyInventory(doc.id);
      say(true, `${posted ? (op === 'inventory' ? t.inventoryApplied : t.posted) : t.saved} · № ${doc.number}`);
      setDraft(emptyDraft(op, draft.warehouseId));
    } catch (e) {
      say(false, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const select = (value: number | null, onChange: (v: number | null) => void, exclude?: number | null) => (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{t.choose}</option>
      {warehouses.filter((w) => w.id !== exclude).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );

  return (
    <div className="page">
      <header className="bar">
        <button className="link" onClick={onBack}>← {t.back}</button>
        <strong>{t[op]}</strong>
        <button className="link" disabled={!draft.lines.length} onClick={() => confirm(t.confirmClear) && setDraft(emptyDraft(op, draft.warehouseId))}>{t.clear}</button>
      </header>

      <div className="fields">
        <label>{t.warehouse}{select(draft.warehouseId, (v) => setDraft({ ...draft, warehouseId: v }))}</label>
        {op === 'move' && <label>{t.targetWarehouse}{select(draft.targetWarehouseId, (v) => setDraft({ ...draft, targetWarehouseId: v }), draft.warehouseId)}</label>}
      </div>

      {camera ? <Suspense fallback={<p className="muted center">…</p>}><CameraScanner onScan={scan} onClose={() => setCamera(false)} /></Suspense> : (
        <div className="scanbox">
          <p className="muted">{t.scanHint}</p>
          <button className="btn wide" onClick={() => setCamera(true)}>{t.camera}</button>
          <ManualEntry onSubmit={scan} />
        </div>
      )}

      {message && <p className={message.ok ? 'ok' : 'error'}>{message.text}</p>}

      <section className="lines">
        {draft.lines.length === 0 && <p className="muted center">{t.empty}</p>}
        {draft.lines.map((l) => (
          <div key={l.variantId} className="line">
            <div className="line-name">
              <b>{l.productName}</b> {l.variantName && <span>· {l.variantName}</span>}
              {l.article && <div className="muted">{l.article}</div>}
              {l.codes.length > 0 && <div className="muted">{t.codes}: {l.codes.length}</div>}
            </div>
            <div className="qty">
              {l.codes.length === 0 ? (
                <>
                  <button onClick={() => setDraft(setQty(draft, l.variantId, l.qty - 1))}>−</button>
                  <input inputMode="decimal" value={l.qty} onChange={(e) => setDraft(setQty(draft, l.variantId, Number(e.target.value.replace(',', '.')) || 0))} />
                  <button onClick={() => setDraft(setQty(draft, l.variantId, l.qty + 1))}>+</button>
                </>
              ) : <span className="qty-fixed">{l.qty}</span>}
              <button className="remove" onClick={() => setDraft(removeLine(draft, l.variantId))}>×</button>
            </div>
          </div>
        ))}
      </section>

      <label className="fields">{t.comment}<input value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} /></label>

      <footer className="actions">
        <span>{t.items}: {draft.lines.length} · {t.total}: {totalQty(draft)}</span>
        <div className="row">
          <button className="btn secondary" disabled={busy || !draft.lines.length} onClick={() => save(false)}>{t.saveDraft}</button>
          <button className="btn" disabled={busy || !draft.lines.length} onClick={() => save(true)}>{op === 'inventory' ? t.apply : t.post}</button>
        </div>
      </footer>
    </div>
  );
}

export function ManualEntry({ onSubmit }: { onSubmit: (code: string) => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) onSubmit(code.trim());
    setCode('');
  };
  return (
    <form className="row" onSubmit={submit}>
      <input placeholder={t.manual} value={code} onChange={(e) => setCode(e.target.value)} inputMode="text" />
      <button className="btn secondary">{t.add}</button>
    </form>
  );
}
