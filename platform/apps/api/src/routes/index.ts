import {
  AccountInput, CounterpartyInput, DocumentInput, EmployeeInput, FolderInput, LoginInput, PriceTypeInput, ProductInput,
  WarehouseInput, type ScanResult,
} from '@vordi/contracts';
import { DOC_TYPE_KEYS, isDocType, looksLikeMarkingCode, parseMarkingCode, type DocType } from '@vordi/domain';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole, user, type AppOptions } from '../app.ts';
import {
  accounts, auditLog, barcodes, counterparties, documents, employees, folders, priceTypes, products, sessions,
  settlementMoves, variants, warehouses,
} from '../db/schema.ts';
import { hashPassword, newToken, tokenHash, verifyPassword } from '../lib/auth.ts';
import { forbidden, HttpError, notFound } from '../lib/errors.ts';
import { loadProduct, loadProducts, saveProduct, searchProducts } from '../services/catalog.ts';
import {
  applyInventory, canReadDocumentType, DOC_TYPE_LIST, deleteDocument, loadDocument, saveDocument, setPosted,
} from '../services/documents.ts';
import { profitReport, settlementReport, stockReport } from '../services/reports.ts';

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const Paging = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50), offset: z.coerce.number().int().min(0).default(0) });
const SESSION_DAYS = 30;

export async function registerRoutes(app: FastifyInstance, { db, loginRateLimit = 10 }: AppOptions) {
  const anyone = requireRole();
  const managers = requireRole('admin', 'manager');
  const admins = requireRole('admin');

  // — Kimlik doğrulama
  app.post('/auth/login', { config: { rateLimit: { max: loginRateLimit, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { login, password } = LoginInput.parse(req.body);
    const [e] = await db.select().from(employees).where(eq(employees.login, login));
    // Kullanıcı yoksa da aynı sürede cevap vermek için sahte doğrulama yapılır.
    const ok = e ? await verifyPassword(password, e.passwordHash) : (await verifyPassword(password, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), false);
    if (!e || !ok || !e.active) {
      await db.insert(auditLog).values({ action: 'login_failed', entity: 'employee', data: { login, ip: req.ip } });
      return reply.status(401).send({ code: 'bad_credentials', message: 'Неверный логин или пароль' });
    }
    const token = newToken();
    await db.insert(sessions).values({ tokenHash: tokenHash(token), employeeId: e.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5) });
    await db.insert(auditLog).values({ employeeId: e.id, action: 'login', entity: 'employee', entityId: e.id, data: { ip: req.ip } });
    return { token, user: { id: e.id, login: e.login, name: e.name, role: e.role, warehouseIds: e.warehouseIds } };
  });
  app.post('/auth/logout', { preHandler: anyone }, async (req, reply) => {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(req.headers.authorization!.slice(7))));
    return reply.status(204).send();
  });
  app.get('/auth/me', { preHandler: anyone }, async (req) => user(req));

  // — Çalışanlar (Сотрудники)
  const employeeDto = (e: typeof employees.$inferSelect) =>
    ({ id: e.id, login: e.login, name: e.name, role: e.role, phone: e.phone, position: e.position, warehouseIds: e.warehouseIds, active: e.active });
  app.get('/employees', { preHandler: admins }, async () => (await db.select().from(employees).orderBy(employees.name)).map(employeeDto));
  app.post('/employees', { preHandler: admins }, async (req) => {
    const b = EmployeeInput.parse(req.body);
    if (!b.password) throw new HttpError(400, 'Пароль обязателен (не менее 8 символов)');
    const [e] = await db.insert(employees).values({ ...b, passwordHash: await hashPassword(b.password) }).returning();
    return employeeDto(e!);
  });
  app.put('/employees/:id', { preHandler: admins }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const { password, ...b } = EmployeeInput.parse(req.body);
    const [e] = await db.update(employees).set({ ...b, ...(password ? { passwordHash: await hashPassword(password) } : {}) }).where(eq(employees.id, id)).returning();
    if (!e) throw notFound('Сотрудник');
    if (!e.active || password) await db.delete(sessions).where(eq(sessions.employeeId, id));
    return employeeDto(e);
  });

  // — Referanslar
  app.get('/warehouses', { preHandler: anyone }, async () => db.select().from(warehouses).orderBy(warehouses.id));
  app.post('/warehouses', { preHandler: managers }, async (req) => (await db.insert(warehouses).values(WarehouseInput.parse(req.body)).returning())[0]);
  app.put('/warehouses/:id', { preHandler: managers }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const [w] = await db.update(warehouses).set(WarehouseInput.parse(req.body)).where(eq(warehouses.id, id)).returning();
    if (!w) throw notFound('Склад');
    return w;
  });
  app.get('/price-types', { preHandler: anyone }, async () => db.select().from(priceTypes).orderBy(priceTypes.id));
  app.post('/price-types', { preHandler: managers }, async (req) => (await db.insert(priceTypes).values(PriceTypeInput.parse(req.body)).returning())[0]);
  app.get('/accounts', { preHandler: managers }, async () => db.select().from(accounts).orderBy(accounts.id));
  app.post('/accounts', { preHandler: admins }, async (req) => (await db.insert(accounts).values(AccountInput.parse(req.body)).returning())[0]);
  app.get('/folders', { preHandler: anyone }, async () => db.select().from(folders).orderBy(folders.name));
  app.post('/folders', { preHandler: managers }, async (req) => (await db.insert(folders).values(FolderInput.parse(req.body)).returning())[0]);
  app.get('/document-types', { preHandler: anyone }, async () => DOC_TYPE_LIST);

  // — Ürünler (Товары и модификации)
  app.get('/products', { preHandler: anyone }, async (req) => {
    const q = Paging.extend({ search: z.string().max(200).optional() }).parse(req.query);
    return searchProducts(db, q);
  });
  app.get('/products/:id', { preHandler: anyone }, async (req) => loadProduct(db, IdParam.parse(req.params).id));
  app.post('/products', { preHandler: managers }, async (req) => {
    const input = ProductInput.parse(req.body);
    const id = await db.transaction((tx) => saveProduct(tx, input));
    return loadProduct(db, id);
  });
  app.put('/products/:id', { preHandler: managers }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const input = ProductInput.parse(req.body);
    await db.transaction((tx) => saveProduct(tx, input, id));
    return loadProduct(db, id);
  });

  /**
   * Barkod / DataMatrix okutma: depo uygulaması ve kasa için.
   * EAN, iç barkod, ürün kodu, artikul veya Честный знак kodu kabul eder; ürünü ve depolardaki stoğunu döndürür.
   */
  app.get('/scan/:code', { preHandler: anyone }, async (req): Promise<ScanResult> => {
    const raw = z.object({ code: z.string().min(1).max(300) }).parse(req.params).code;
    let lookup = raw.trim();
    let markingCode: ScanResult['markingCode'] = null;
    if (looksLikeMarkingCode(lookup)) {
      const p = parseMarkingCode(lookup);
      if (p) { markingCode = { cis: p.cis, gtin: p.gtin }; lookup = p.gtin; }
    }
    const candidates = [lookup];
    if (markingCode) candidates.push(lookup.replace(/^0+/, ''));
    let [hit] = await db.select({ variantId: barcodes.variantId }).from(barcodes).where(inArray(barcodes.barcode, candidates));
    if (!hit) {
      [hit] = await db.select({ variantId: variants.id }).from(variants).innerJoin(products, eq(products.id, variants.productId))
        .where(and(eq(variants.archived, false), or(eq(variants.code, lookup), eq(products.code, lookup), eq(products.article, lookup)))).limit(1);
    }
    if (!hit) throw new HttpError(404, `Товар со штрихкодом ${lookup} не найден`, 'not_found');
    const [v] = await db.select().from(variants).where(eq(variants.id, hit.variantId));
    const [product] = await loadProducts(db, [v!.productId]);
    const variant = product!.variants.find((x) => x.id === v!.id)!;
    const stock = (await stockReport(db, {})).filter((r) => r.variantId === v!.id)
      .map((r) => ({ warehouseId: r.warehouseId, stock: r.stock, reserve: r.reserve, available: r.available }));
    const { id, name, article, unit, markingType, buyPrice } = product!;
    return { variant, product: { id, name, article, unit, markingType, buyPrice }, stock, markingCode };
  });

  // — Cariler (Контрагенты)
  app.get('/counterparties', { preHandler: managers }, async (req) => {
    const q = Paging.extend({ search: z.string().max(200).optional() }).parse(req.query);
    const s = q.search?.trim();
    const where = and(eq(counterparties.archived, false),
      s ? or(ilike(counterparties.name, `%${s}%`), eq(counterparties.inn, s), ilike(counterparties.phone, `%${s}%`), ilike(counterparties.email, `%${s}%`)) : undefined);
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(counterparties).where(where);
    const rows = await db.select({ c: counterparties, balance: sql<string>`coalesce((select sum(amount) from ${settlementMoves} where counterparty_id = ${counterparties.id}), 0)` })
      .from(counterparties).where(where).orderBy(counterparties.name).limit(q.limit).offset(q.offset);
    return { total, rows: rows.map((r) => ({ ...r.c, balance: Number(r.balance) })) };
  });
  app.post('/counterparties', { preHandler: managers }, async (req) => (await db.insert(counterparties).values(CounterpartyInput.parse(req.body)).returning())[0]);
  app.put('/counterparties/:id', { preHandler: managers }, async (req) => {
    const { id } = IdParam.parse(req.params);
    const [c] = await db.update(counterparties).set(CounterpartyInput.parse(req.body)).where(eq(counterparties.id, id)).returning();
    if (!c) throw notFound('Контрагент');
    return c;
  });

  // — Belgeler (Документы)
  app.get('/documents', { preHandler: anyone }, async (req) => {
    const q = Paging.extend({ type: z.string().optional() }).parse(req.query);
    const u = user(req);
    const allowed = DOC_TYPE_KEYS.filter((t) => canReadDocumentType(u, t));
    if (q.type && !(isDocType(q.type) && allowed.includes(q.type))) throw forbidden();
    const types = q.type ? [q.type] : allowed;
    const where = and(eq(documents.deleted, false), inArray(documents.type, types),
      u.role !== 'admin' && u.role !== 'manager' && u.warehouseIds.length ? inArray(documents.warehouseId, u.warehouseIds) : undefined);
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(documents).where(where);
    const ids = await db.select({ id: documents.id }).from(documents).where(where).orderBy(desc(documents.moment), desc(documents.id)).limit(q.limit).offset(q.offset);
    return { total, rows: await Promise.all(ids.map((r) => loadDocument(db, r.id))) };
  });
  app.get('/documents/:id', { preHandler: anyone }, async (req) => {
    const d = await loadDocument(db, IdParam.parse(req.params).id);
    if (!canReadDocumentType(user(req), d.type as DocType)) throw forbidden();
    return d;
  });
  app.post('/documents', { preHandler: anyone }, async (req) => loadDocument(db, await saveDocument(db, user(req), DocumentInput.parse(req.body))));
  app.put('/documents/:id', { preHandler: anyone }, async (req) => {
    const { id } = IdParam.parse(req.params);
    await saveDocument(db, user(req), DocumentInput.parse(req.body), id);
    return loadDocument(db, id);
  });
  app.post('/documents/:id/post', { preHandler: anyone }, async (req) => {
    const { id } = IdParam.parse(req.params);
    await setPosted(db, user(req), id, true);
    return loadDocument(db, id);
  });
  app.post('/documents/:id/unpost', { preHandler: anyone }, async (req) => {
    const { id } = IdParam.parse(req.params);
    await setPosted(db, user(req), id, false);
    return loadDocument(db, id);
  });
  app.delete('/documents/:id', { preHandler: anyone }, async (req, reply) => {
    await deleteDocument(db, user(req), IdParam.parse(req.params).id);
    return reply.status(204).send();
  });
  app.post('/documents/:id/apply-inventory', { preHandler: anyone }, async (req) => applyInventory(db, user(req), IdParam.parse(req.params).id));

  // — Raporlar (Отчёты)
  app.get('/reports/stock', { preHandler: anyone }, async (req) => {
    const q = z.object({ warehouseId: z.coerce.number().int().positive().optional(), search: z.string().max(200).optional() }).parse(req.query);
    const u = user(req);
    const restricted = u.role !== 'admin' && u.role !== 'manager' && u.warehouseIds.length > 0;
    if (restricted && q.warehouseId && !u.warehouseIds.includes(q.warehouseId)) throw forbidden();
    const rows = await stockReport(db, { ...q, warehouseIds: restricted ? u.warehouseIds : undefined });
    // Maliyet bilgisi yalnızca yöneticilere.
    return restricted || u.role === 'storekeeper' || u.role === 'cashier' ? rows.map((r) => ({ ...r, costValue: 0 })) : rows;
  });
  app.get('/reports/settlements', { preHandler: managers }, async () => settlementReport(db));
  app.get('/reports/profit', { preHandler: managers }, async (req) =>
    profitReport(db, z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() }).parse(req.query)));
}
