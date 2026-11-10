import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, index, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Veri modeli — МойСклад yapısını örnek alır:
 *   Сотрудники, Склады, Группы товаров, Товары → Модификации (variants) → Штрихкоды, Типы цен,
 *   Контрагенты, Счета (kasa/banka), Документы + позиции, ve değişmez defterler (stok, взаиморасчёты, деньги).
 *
 * Stok ve bakiyeler sütunda tutulmaz; işlenmiş belgelerin defter kayıtlarından hesaplanır.
 */

const kopeks = (name: string) => bigint(name, { mode: 'number' });
const qty = (name: string) => numeric(name, { precision: 15, scale: 3, mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  login: text('login').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  email: text('email'),
  position: text('position'),
  warehouseIds: integer('warehouse_ids').array().notNull().default(sql`'{}'`),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** Para birimleri. Kur = 1 birimin ruble karşılığı. Varsayılan (RUB) kur 1'dir. */
export const currencies = pgTable('currencies', {
  code: text('code').primaryKey(),
  name: text('name'),
  rate: numeric('rate', { precision: 18, scale: 6, mode: 'number' }).notNull().default(1),
  isDefault: boolean('is_default').notNull().default(false),
});

/** Kendi şirketlerimiz (юрлица / ИП): belgeler bunlardan biri adına düzenlenir. */
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  inn: text('inn'),
  kpp: text('kpp'),
  address: text('address'),
  archived: boolean('archived').notNull().default(false),
});

/**
 * Dış sistem eşleştirmesi: МойСклад, pazaryerleri, siteler.
 * Aynı kayıt tekrar aktarıldığında yeni kayıt açılmaz, mevcut kayıt güncellenir.
 */
export const externalRefs = pgTable('external_refs', {
  source: text('source').notNull(),
  entity: text('entity').notNull(),
  externalId: text('external_id').notNull(),
  localId: integer('local_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.source, t.entity, t.externalId] }), index('external_refs_local_idx').on(t.source, t.entity, t.localId)]);

export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  archived: boolean('archived').notNull().default(false),
});

export const folders = pgTable('product_folders', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id'),
  name: text('name').notNull(),
});

export const priceTypes = pgTable('price_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

/** Satış noktaları (точки продаж): mağaza kasaları. */
export const retailPoints = pgTable('retail_points', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  organizationId: integer('organization_id').references(() => organizations.id),
  archived: boolean('archived').notNull().default(false),
});

export const accounts = pgTable('money_accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // cash | bank
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  folderId: integer('folder_id').references(() => folders.id),
  name: text('name').notNull(),
  article: text('article'),
  code: text('code'),
  unit: text('unit').notNull().default('шт'),
  vat: integer('vat'),
  isService: boolean('is_service').notNull().default(false),
  markingType: text('marking_type'),
  buyPrice: kopeks('buy_price').notNull().default(0),
  minStock: qty('min_stock').notNull().default(0),
  description: text('description'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
  archived: boolean('archived').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index('products_article_idx').on(t.article), index('products_code_idx').on(t.code)]);

export const variants = pgTable('variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  characteristics: jsonb('characteristics').$type<Record<string, string>>().notNull().default({}),
  code: text('code'),
  archived: boolean('archived').notNull().default(false),
}, (t) => [index('variants_product_idx').on(t.productId)]);

/** Barkodlar. МойСклад'daki gibi aynı barkod birden fazla üründe olabilir (ör. bir takımın renkleri); okutmada uyarı verilir. */
export const barcodes = pgTable('barcodes', {
  barcode: text('barcode').notNull(),
  variantId: integer('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.barcode, t.variantId] }), index('barcodes_variant_idx').on(t.variantId)]);

export const prices = pgTable('prices', {
  variantId: integer('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
  priceTypeId: integer('price_type_id').notNull().references(() => priceTypes.id),
  /** Fiyat, para biriminin en küçük biriminde (kopek, cent). */
  value: kopeks('value').notNull(),
  currency: text('currency').notNull().default('RUB'),
}, (t) => [primaryKey({ columns: [t.variantId, t.priceTypeId] })]);

export const counterparties = pgTable('counterparties', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull().default('legal'),
  name: text('name').notNull(),
  inn: text('inn'),
  kpp: text('kpp'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  priceTypeId: integer('price_type_id').references(() => priceTypes.id),
  tags: text('tags').array().notNull().default(sql`'{}'`),
  creditLimit: kopeks('credit_limit'),
  comment: text('comment'),
  archived: boolean('archived').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index('counterparties_inn_idx').on(t.inn)]);

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  number: text('number').notNull(),
  moment: timestamp('moment', { withTimezone: true }).notNull(),
  posted: boolean('posted').notNull().default(false),
  status: text('status'),
  organizationId: integer('organization_id').references(() => organizations.id),
  retailPointId: integer('retail_point_id').references(() => retailPoints.id),
  warehouseId: integer('warehouse_id').references(() => warehouses.id),
  targetWarehouseId: integer('target_warehouse_id').references(() => warehouses.id),
  counterpartyId: integer('counterparty_id').references(() => counterparties.id),
  accountId: integer('account_id').references(() => accounts.id),
  sum: kopeks('sum').notNull().default(0),
  comment: text('comment'),
  parentId: integer('parent_id'),
  externalId: text('external_id'),
  createdBy: integer('created_by').references(() => employees.id),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => [
  index('documents_type_number_idx').on(t.type, t.number),
  index('documents_type_moment_idx').on(t.type, t.moment),
  index('documents_parent_idx').on(t.parentId),
]);

export const documentLines = pgTable('document_lines', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').notNull().references(() => variants.id),
  qty: qty('qty').notNull(),
  price: kopeks('price').notNull().default(0),
  discount: numeric('discount', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  expected: qty('expected'),
  /** Müşteri siparişinde ayrılan miktar. Boşsa satırın tamamı rezerv sayılır. */
  reserve: qty('reserve'),
  vat: integer('vat'),
}, (t) => [index('document_lines_doc_idx').on(t.documentId)]);

/** Честный знак kodları (КИ), belge satırına bağlı. */
export const lineCodes = pgTable('line_codes', {
  lineId: integer('line_id').notNull().references(() => documentLines.id, { onDelete: 'cascade' }),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  cis: text('cis').notNull(),
  raw: text('raw').notNull(),
}, (t) => [primaryKey({ columns: [t.documentId, t.cis] }), index('line_codes_cis_idx').on(t.cis)]);

// — Değişmez defterler: yalnızca belge işlenince yazılır, işlem geri alınınca belgeyle birlikte silinir.
export const stockMoves = pgTable('stock_moves', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  lineId: integer('line_id'),
  variantId: integer('variant_id').notNull().references(() => variants.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  qty: qty('qty').notNull(),
  unitCost: kopeks('unit_cost'),
  moment: timestamp('moment', { withTimezone: true }).notNull(),
}, (t) => [index('stock_moves_variant_wh_idx').on(t.variantId, t.warehouseId), index('stock_moves_moment_idx').on(t.moment)]);

export const settlementMoves = pgTable('settlement_moves', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  counterpartyId: integer('counterparty_id').notNull().references(() => counterparties.id),
  amount: kopeks('amount').notNull(),
  moment: timestamp('moment', { withTimezone: true }).notNull(),
}, (t) => [index('settlement_moves_cp_idx').on(t.counterpartyId)]);

export const moneyMoves = pgTable('money_moves', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: integer('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  amount: kopeks('amount').notNull(),
  moment: timestamp('moment', { withTimezone: true }).notNull(),
});

export const numberSequences = pgTable('number_sequences', {
  type: text('type').primaryKey(),
  last: integer('last').notNull().default(0),
});

/** İşlem geçmişi: kim, ne zaman, neyi değiştirdi. Yalnızca eklenir. */
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  employeeId: integer('employee_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  data: jsonb('data'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
