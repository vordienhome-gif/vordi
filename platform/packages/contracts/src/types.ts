import type { DocType } from '@vordi/domain';
import type { Role } from './schemas.ts';

/** API yanıt tipleri. */
export interface Me { id: number; login: string; name: string; role: Role; warehouseIds: number[] }
export interface Warehouse { id: number; name: string; address: string | null; archived: boolean }
export interface PriceType { id: number; name: string }

export interface Variant {
  id: number;
  productId: number;
  name: string;
  characteristics: Record<string, string>;
  code: string | null;
  barcodes: string[];
  prices: Record<string, number>;
}
export interface Product {
  id: number; name: string; article: string | null; code: string | null; folderId: number | null;
  unit: string; vat: number | null; isService: boolean; markingType: string | null; buyPrice: number;
  minStock: number; description: string | null; attributes: Record<string, unknown>; archived: boolean;
  variants: Variant[];
}

/** Barkod okutunca dönen bilgi: depo uygulaması bunu kullanır. */
export interface ScanResult {
  variant: Variant;
  product: Pick<Product, 'id' | 'name' | 'article' | 'unit' | 'markingType' | 'buyPrice'>;
  stock: { warehouseId: number; stock: number; reserve: number; available: number }[];
  markingCode?: { cis: string; gtin: string } | null;
  /** Aynı barkod başka ürünlerde de varsa onlar. */
  alternatives?: { variantId: number; productName: string; variantName: string }[];
}

export interface Counterparty {
  id: number; kind: string; name: string; inn: string | null; kpp: string | null; phone: string | null;
  email: string | null; address: string | null; priceTypeId: number | null; tags: string[];
  creditLimit: number | null; comment: string | null; archived: boolean; balance?: number;
}

export interface DocumentLine {
  id: number; variantId: number; qty: number; price: number; discount: number; sum: number;
  expected: number | null; codes: string[]; variantName?: string; productName?: string;
}
export interface DocumentDto {
  id: number; type: DocType; number: string; moment: string; posted: boolean; status: string | null;
  warehouseId: number | null; targetWarehouseId: number | null; counterpartyId: number | null; accountId: number | null;
  sum: number; comment: string | null; parentId: number | null; createdBy: number | null; updatedAt: string;
  lines: DocumentLine[];
}

export interface StockRow {
  variantId: number; productId: number; productName: string; variantName: string; article: string | null;
  warehouseId: number; stock: number; reserve: number; expected: number; available: number; costValue: number;
}

export interface Page<T> { rows: T[]; total: number }
