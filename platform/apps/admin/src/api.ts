import { createClient, type Me } from '@vordi/contracts';

const SESSION = 'vordi.admin.session';

export function session(): { token: string; user: Me } | null {
  try { return JSON.parse(localStorage.getItem(SESSION) ?? 'null'); } catch { return null; }
}
export function saveSession(s: { token: string; user: Me } | null) {
  try { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); } catch { /* özel pencere */ }
}

export const api = createClient({ baseUrl: import.meta.env.VITE_API_URL ?? '/api', getToken: () => session()?.token ?? null });
