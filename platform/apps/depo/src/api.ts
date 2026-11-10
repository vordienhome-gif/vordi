import { createClient, type Me } from '@vordi/contracts';

const KEY = 'vordi.session';

export function loadSession(): { token: string; user: Me } | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}
export function saveSession(s: { token: string; user: Me } | null) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* özel pencere */ }
}

export const api = createClient({ baseUrl: import.meta.env.VITE_API_URL ?? '/api', getToken: () => loadSession()?.token ?? null });

/** Okutma sonucu için ses ve titreşim: depoda ekrana bakmadan çalışabilmek için. */
export function feedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 40 : [80, 60, 80]); } catch { /* desteklenmiyor */ }
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 300;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.35));
    o.onended = () => ctx.close();
  } catch { /* ses yok */ }
}
