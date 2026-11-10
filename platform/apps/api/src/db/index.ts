import { PGlite } from '@electric-sql/pglite';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as schema from './schema.ts';

export { schema };
export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type DbOrTx = Db | Tx;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * DATABASE_URL verilmişse gerçek PostgreSQL'e bağlanır (üretim, Docker).
 * Verilmemişse gömülü PostgreSQL (PGlite) kullanılır: geliştirme ve testler için kurulum gerektirmez.
 *   dataDir = undefined → bellek içi (testler), 'data/pglite' → dosyada kalıcı.
 */
export async function createDb(opts: { url?: string; dataDir?: string } = {}): Promise<{ db: Db; close: () => Promise<void> }> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  const client = new PGlite(opts.dataDir);
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close() };
}
