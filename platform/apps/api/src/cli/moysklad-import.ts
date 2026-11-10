/**
 * МойСклад → Vordi aktarımı (komut satırı).
 *
 *   MOYSKLAD_TOKEN=... pnpm --filter @vordi/api import:moysklad            # her şey + mutabakat
 *   ... import:moysklad --no-documents                                    # yalnızca kartlar (ürün, cari…)
 *   ... import:moysklad --types=demand,supply                             # yalnızca belirli belge türleri
 *   ... import:moysklad --reconcile-only                                  # yalnızca karşılaştırma
 *   ... import:moysklad --report=rapor.json                               # sonucu dosyaya yazar
 *
 * Veritabanı: DATABASE_URL (PostgreSQL) ya da PGLITE_DIR (gömülü, varsayılan data/pglite).
 * Tekrar çalıştırmak güvenlidir: mevcut kayıtlar güncellenir, kopya oluşmaz.
 */
import { writeFileSync } from 'node:fs';
import { createDb } from '../db/index.ts';
import { createMsClient } from '../integrations/moysklad/client.ts';
import { importMoySklad } from '../integrations/moysklad/importer.ts';
import { reconcileMoySklad } from '../integrations/moysklad/reconcile.ts';
import { ensureSeed } from '../services/seed.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const token = process.env.MOYSKLAD_TOKEN;
if (!token) {
  console.error('MOYSKLAD_TOKEN ortam değişkeni gerekli (МойСклад → Настройки → Токены, yalnızca okuma yetkili kullanıcı).');
  process.exit(1);
}

const started = Date.now();
const { db, close } = await createDb({ url: process.env.DATABASE_URL, dataDir: process.env.DATABASE_URL ? undefined : (process.env.PGLITE_DIR ?? 'data/pglite') });
await ensureSeed(db, { adminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? 'admin' });
const ms = createMsClient({ token, baseUrl: process.env.MOYSKLAD_URL });
const log = { info: (m: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${m}`), warn: (m: string) => console.warn(m) };

let summary = null;
if (!flag('reconcile-only')) {
  summary = await importMoySklad(db, ms, log, { documents: !flag('no-documents'), types: value('types')?.split(',') });
  log.info(`Aktarım bitti: ${JSON.stringify(summary.counts)}`);
  if (Object.keys(summary.warnings).length) log.info(`Uyarılar: ${JSON.stringify(summary.warnings)}`);
}
log.info('Mutabakat (stok, rezerv, cari bakiyeleri)…');
const rec = await reconcileMoySklad(db, ms);
log.info(`Stok: ${rec.stock.matched}/${rec.stock.compared} eşleşti, fark: ${rec.stock.diffs.length}`);
log.info(`Rezerv: ${rec.reserve.matched}/${rec.reserve.compared} eşleşti, fark: ${rec.reserve.diffs.length}`);
log.info(`Cari bakiyeleri: ${rec.balances.matched}/${rec.balances.compared} eşleşti, fark: ${rec.balances.diffs.length}`);

const out = value('report');
if (out) writeFileSync(out, JSON.stringify({ summary, reconcile: rec, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
await close();
