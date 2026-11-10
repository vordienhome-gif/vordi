import { DOC_TYPE_KEYS, MARKING_TYPES } from '@vordi/domain';
import { z } from 'zod';

/** API sözleşmeleri: backend, yönetim paneli, depo uygulaması, siteler ve mobil uygulama aynı şemaları kullanır. */

const id = z.number().int().positive();
const kopeks = z.number().int();
const text = (max = 255) => z.string().trim().max(max);

export const ROLES = ['admin', 'manager', 'storekeeper', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

export const LoginInput = z.object({ login: text(64).min(1), password: z.string().min(1).max(200) });

export const EmployeeInput = z.object({
  login: text(64).min(3),
  name: text().min(1),
  role: z.enum(ROLES),
  password: z.string().min(8).max(200).optional(),
  phone: text(32).optional().nullable(),
  position: text(100).optional().nullable(),
  warehouseIds: z.array(id).default([]),
  active: z.boolean().default(true),
});

export const WarehouseInput = z.object({ name: text().min(1), address: text(500).optional().nullable(), archived: z.boolean().default(false) });
export const FolderInput = z.object({ name: text().min(1), parentId: id.nullable().optional() });
export const PriceTypeInput = z.object({ name: text(100).min(1) });
export const AccountInput = z.object({ name: text().min(1), kind: z.enum(['cash', 'bank']) });

export const VariantInput = z.object({
  id: id.optional(),
  /** Özellikler: { "Размер": "M", "Цвет": "Синий" } */
  characteristics: z.record(z.string().max(100), z.string().max(100)).default({}),
  code: text(64).optional().nullable(),
  barcodes: z.array(text(64).min(1)).default([]),
  /** priceTypeId → kopek */
  prices: z.record(z.string().regex(/^\d+$/), kopeks.nonnegative()).default({}),
});

export const ProductInput = z.object({
  name: text(500).min(1),
  article: text(100).optional().nullable(),
  code: text(64).optional().nullable(),
  folderId: id.nullable().optional(),
  unit: text(20).default('шт'),
  vat: z.number().int().min(0).max(30).nullable().default(null),
  isService: z.boolean().default(false),
  markingType: z.enum(MARKING_TYPES).nullable().default(null),
  buyPrice: kopeks.nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  description: text(20000).optional().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  archived: z.boolean().default(false),
  /** Varyantı olmayan ürün için en az bir (varsayılan) varyant gönderilir. */
  variants: z.array(VariantInput).min(1),
});

export const CounterpartyInput = z.object({
  kind: z.enum(['legal', 'entrepreneur', 'individual']).default('legal'),
  name: text(500).min(1),
  inn: z.string().regex(/^(\d{10}|\d{12})$/, 'ИНН: 10 или 12 цифр').optional().nullable(),
  kpp: z.string().regex(/^\d{9}$/).optional().nullable(),
  phone: text(32).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: text(1000).optional().nullable(),
  priceTypeId: id.nullable().optional(),
  tags: z.array(text(50)).default([]),
  creditLimit: kopeks.nonnegative().nullable().default(null),
  comment: text(5000).optional().nullable(),
  archived: z.boolean().default(false),
});

export const DocumentLineInput = z.object({
  variantId: id,
  qty: z.number().nonnegative().max(1e9),
  price: kopeks.nonnegative().default(0),
  discount: z.number().min(0).max(100).default(0),
  /** Sayımda beklenen miktar (sunucu doldurur), satırlarda Честный знак kodları. */
  expected: z.number().optional(),
  codes: z.array(z.string().max(300)).default([]),
});

export const DocumentInput = z.object({
  type: z.enum(DOC_TYPE_KEYS as [string, ...string[]]),
  moment: z.string().datetime({ offset: true }).optional(),
  warehouseId: id.nullable().optional(),
  targetWarehouseId: id.nullable().optional(),
  counterpartyId: id.nullable().optional(),
  accountId: id.nullable().optional(),
  sum: kopeks.nullable().optional(),
  status: text(50).nullable().optional(),
  comment: text(5000).nullable().optional(),
  parentId: id.nullable().optional(),
  posted: z.boolean().default(false),
  lines: z.array(DocumentLineInput).default([]),
});

export type LoginInput = z.infer<typeof LoginInput>;
export type EmployeeInput = z.input<typeof EmployeeInput>;
export type WarehouseInput = z.input<typeof WarehouseInput>;
export type ProductInput = z.input<typeof ProductInput>;
export type VariantInput = z.input<typeof VariantInput>;
export type CounterpartyInput = z.input<typeof CounterpartyInput>;
export type DocumentInput = z.input<typeof DocumentInput>;
export type DocumentLineInput = z.input<typeof DocumentLineInput>;
