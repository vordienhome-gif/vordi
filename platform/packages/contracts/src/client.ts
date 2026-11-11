import type { CounterpartyInput, DocumentInput, EmployeeInput, ProductInput, WarehouseInput } from './schemas.ts';
import type {
  Account, Counterparty, Currency, DocumentDto, Employee, Folder, Me, Organization, Page, PriceType, Product, ScanResult, StockRow, Warehouse,
} from './types.ts';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export interface ClientOptions {
  baseUrl: string;
  getToken?: () => string | null;
  fetch?: typeof fetch;
}

/** Tipli API istemcisi: yönetim paneli, depo uygulaması, siteler ve mobil uygulama ortak kullanır. */
export function createClient({ baseUrl, getToken, fetch: f = fetch }: ClientOptions) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await f(baseUrl.replace(/\/$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText, data?.code);
    return data as T;
  }
  const qs = (q: Record<string, unknown> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return {
    login: (login: string, password: string) => call<{ token: string; user: Me }>('POST', '/auth/login', { login, password }),
    logout: () => call<null>('POST', '/auth/logout'),
    me: () => call<Me>('GET', '/auth/me'),
    changePassword: (current: string, next: string) => call<null>('POST', '/auth/password', { current, next }),
    organizations: () => call<Organization[]>('GET', '/organizations'),
    currencies: () => call<Currency[]>('GET', '/currencies'),
    accounts: () => call<Account[]>('GET', '/accounts'),
    folders: () => call<Folder[]>('GET', '/folders'),
    documentTypes: () => call<{ key: string; ru: string; tr: string; section: string }[]>('GET', '/document-types'),

    warehouses: () => call<Warehouse[]>('GET', '/warehouses'),
    createWarehouse: (w: WarehouseInput) => call<Warehouse>('POST', '/warehouses', w),
    priceTypes: () => call<PriceType[]>('GET', '/price-types'),

    products: (q: { search?: string; limit?: number; offset?: number } = {}) => call<Page<Product>>('GET', `/products${qs(q)}`),
    product: (id: number) => call<Product>('GET', `/products/${id}`),
    createProduct: (p: ProductInput) => call<Product>('POST', '/products', p),
    updateProduct: (id: number, p: ProductInput) => call<Product>('PUT', `/products/${id}`, p),
    scan: (code: string) => call<ScanResult>('GET', `/scan/${encodeURIComponent(code)}`),

    counterparties: (q: { search?: string; limit?: number } = {}) => call<Page<Counterparty>>('GET', `/counterparties${qs(q)}`),
    counterparty: (id: number) => call<Counterparty>('GET', `/counterparties/${id}`),
    createCounterparty: (c: CounterpartyInput) => call<Counterparty>('POST', '/counterparties', c),

    employees: () => call<Employee[]>('GET', '/employees'),
    createEmployee: (e: EmployeeInput) => call<Employee>('POST', '/employees', e),
    updateEmployee: (id: number, e: EmployeeInput) => call<Employee>('PUT', `/employees/${id}`, e),
    updateCounterparty: (id: number, c: CounterpartyInput) => call<Counterparty>('PUT', `/counterparties/${id}`, c),

    documents: (q: { type?: string; limit?: number; offset?: number; search?: string; from?: string; to?: string; counterpartyId?: number } = {}) => call<Page<DocumentDto>>('GET', `/documents${qs(q)}`),
    document: (id: number) => call<DocumentDto>('GET', `/documents/${id}`),
    createDocument: (d: DocumentInput) => call<DocumentDto>('POST', '/documents', d),
    updateDocument: (id: number, d: DocumentInput) => call<DocumentDto>('PUT', `/documents/${id}`, d),
    postDocument: (id: number) => call<DocumentDto>('POST', `/documents/${id}/post`),
    unpostDocument: (id: number) => call<DocumentDto>('POST', `/documents/${id}/unpost`),
    deleteDocument: (id: number) => call<null>('DELETE', `/documents/${id}`),
    applyInventory: (id: number) => call<{ enter: DocumentDto | null; loss: DocumentDto | null }>('POST', `/documents/${id}/apply-inventory`),

    stockReport: (q: { warehouseId?: number; search?: string } = {}) => call<StockRow[]>('GET', `/reports/stock${qs(q)}`),
    settlementReport: () => call<{ counterpartyId: number; name: string; balance: number }[]>('GET', '/reports/settlements'),
    profitReport: (q: { from?: string; to?: string } = {}) =>
      call<{ variantId: number; productName: string; variantName: string; qty: number; revenue: number; cost: number; profit: number; estimated: boolean }[]>('GET', `/reports/profit${qs(q)}`),
  };
}

export type ApiClient = ReturnType<typeof createClient>;
