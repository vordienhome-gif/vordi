import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { accounts, employees, priceTypes, warehouses } from '../db/schema.ts';
import { hashPassword } from '../lib/auth.ts';

/** Boş veritabanında ilk kurulum: yönetici, varsayılan depo, fiyat türleri, kasa ve banka hesabı. */
export async function ensureSeed(db: Db, opts: { adminPassword: string }) {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(employees);
  if (n > 0) return false;
  await db.insert(employees).values({ login: 'admin', name: 'Администратор', role: 'admin', passwordHash: await hashPassword(opts.adminPassword) });
  await db.insert(warehouses).values({ name: 'Основной склад' });
  await db.insert(priceTypes).values([{ name: 'Розничная цена' }, { name: 'Оптовая цена' }]);
  await db.insert(accounts).values([{ name: 'Касса', kind: 'cash' }, { name: 'Расчётный счёт', kind: 'bank' }]);
  return true;
}
