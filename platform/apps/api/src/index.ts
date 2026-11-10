import { buildApp } from './app.ts';
import { createDb } from './db/index.ts';
import { ensureSeed } from './services/seed.ts';

const env = process.env;
const { db, close } = await createDb({ url: env.DATABASE_URL, dataDir: env.DATABASE_URL ? undefined : (env.PGLITE_DIR ?? 'data/pglite') });

const adminPassword = env.INITIAL_ADMIN_PASSWORD ?? 'admin';
if (await ensureSeed(db, { adminPassword })) {
  console.warn(`İlk kurulum yapıldı. Giriş: admin / ${env.INITIAL_ADMIN_PASSWORD ? '(INITIAL_ADMIN_PASSWORD)' : 'admin'} — şifreyi hemen değiştirin.`);
}

const app = await buildApp({
  db,
  logger: true,
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map((s) => s.trim()).filter(Boolean),
});
const port = Number(env.PORT ?? 3000);
await app.listen({ port, host: env.HOST ?? '0.0.0.0' });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await close();
    process.exit(0);
  });
}
