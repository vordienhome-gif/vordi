// Kanal adaptörleri için ortak HTTP yardımcıları.
export class ChannelError extends Error {}

export async function request(ctx, method, url, { headers = {}, body } = {}) {
  const res = await ctx.fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new ChannelError(`${method} ${new URL(url).pathname}: HTTP ${res.status} ${text.slice(0, 300)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const required = (cfg, keys) => {
  const miss = keys.filter((k) => !String(cfg[k] ?? '').trim());
  if (miss.length) throw new ChannelError(`Eksik ayar: ${miss.join(', ')}`);
};
