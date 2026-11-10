/**
 * МойСклад JSON API 1.2 istemcisi — yalnızca okuma.
 *
 * Kurallar (МойСклад limitleri): 3 saniyede en fazla 45 istek, aynı anda en fazla 5 istek.
 * 429 yanıtında X-Lognex-Retry-After-Ms kadar beklenip tekrar denenir.
 * Liste uçları sayfa sayfa (offset/limit) okunur; expand kullanıldığında limit en fazla 100'dür.
 */
export interface MsMeta { href: string; type?: string; size?: number; limit?: number; offset?: number }
export interface MsRef { meta: MsMeta; id?: string; name?: string }
export interface MsList<T> { meta: MsMeta; rows: T[] }

export interface MsClient {
  get<T = unknown>(path: string, query?: Record<string, string | number>): Promise<T>;
  listAll<T = unknown>(path: string, query?: Record<string, string | number>, onPage?: (done: number, total: number) => void): AsyncGenerator<T[]>;
}

export interface MsClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** İki istek arası en az bekleme (ms). 45 istek / 3 sn ≈ 67 ms. */
  minIntervalMs?: number;
}

export const MS_BASE_URL = 'https://api.moysklad.ru/api/remap/1.2';

export function createMsClient({ token, baseUrl = MS_BASE_URL, fetch: f = fetch, minIntervalMs = 80 }: MsClientOptions): MsClient {
  let last = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(path.startsWith('http') ? path : baseUrl + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    for (let attempt = 0; ; attempt++) {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res: Response;
      try {
        res = await f(url, { headers: { authorization: `Bearer ${token}`, 'accept-encoding': 'gzip', accept: 'application/json;charset=utf-8' } });
      } catch (e) {
        if (attempt < 4) { await sleep(1000 * 2 ** attempt); continue; }
        throw e;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 6) {
          const retry = Number(res.headers.get('x-lognex-retry-after-ms')) || 1000 * 2 ** attempt;
          await sleep(retry);
          continue;
        }
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = body?.errors?.map((e: { error: string }) => e.error).join('; ') ?? res.statusText;
        throw new Error(`МойСклад ${res.status} ${url.pathname}: ${msg}`);
      }
      return body as T;
    }
  }

  async function* listAll<T>(path: string, query: Record<string, string | number> = {}, onPage?: (done: number, total: number) => void) {
    const limit = query.expand ? 100 : 1000;
    for (let offset = 0; ; offset += limit) {
      const page = await get<MsList<T>>(path, { ...query, limit, offset });
      yield page.rows;
      const total = page.meta.size ?? page.rows.length;
      onPage?.(Math.min(offset + page.rows.length, total), total);
      if (page.rows.length < limit || offset + limit >= total) return;
    }
  }

  return { get, listAll };
}
