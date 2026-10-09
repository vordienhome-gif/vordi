import { DatabaseSync } from 'node:sqlite';
import { caseBy, inList } from './doctypes.js';
import { hashPassword } from './auth.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS product_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  article TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'шт',
  group_id INTEGER REFERENCES product_groups(id) ON DELETE SET NULL,
  buy_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  vat REAL NOT NULL DEFAULT 22,
  min_stock REAL NOT NULL DEFAULT 0,
  is_service INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_barcode ON products(barcode);
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS counterparties (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'legal',
  roles TEXT NOT NULL DEFAULT '',
  tax_office TEXT NOT NULL DEFAULT '',
  tax_no TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  number TEXT NOT NULL,
  moment TEXT NOT NULL,
  counterparty_id INTEGER REFERENCES counterparties(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  target_warehouse_id INTEGER REFERENCES warehouses(id),
  base_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  posted INTEGER NOT NULL DEFAULT 1,
  sum REAL NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS documents_type_moment ON documents(type, moment);
CREATE INDEX IF NOT EXISTS documents_base ON documents(base_id);
CREATE INDEX IF NOT EXISTS documents_cp ON documents(counterparty_id);
CREATE TABLE IF NOT EXISTS document_lines (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty REAL NOT NULL DEFAULT 0,
  actual_qty REAL,
  price REAL NOT NULL DEFAULT 0,
  vat REAL NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS fiscal_receipts (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  uuid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  total REAL NOT NULL DEFAULT 0,
  fn_number TEXT NOT NULL DEFAULT '',
  fd_number TEXT NOT NULL DEFAULT '',
  fpd TEXT NOT NULL DEFAULT '',
  receipt_number TEXT NOT NULL DEFAULT '',
  shift_number TEXT NOT NULL DEFAULT '',
  fiscal_moment TEXT NOT NULL DEFAULT '',
  fns_url TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS fiscal_doc ON fiscal_receipts(document_id);
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lines_doc ON document_lines(document_id);
CREATE INDEX IF NOT EXISTS lines_product ON document_lines(product_id);

-- İşlenmiş belgelerden üretilen tüm stok hareketleri (giriş +, çıkış -).
DROP VIEW IF EXISTS stock_moves;
CREATE VIEW stock_moves AS
  SELECT d.id AS doc_id, d.type, d.moment, d.warehouse_id, l.product_id, l.price,
         l.qty * (${caseBy('stock')}) AS qty
  FROM documents d JOIN document_lines l ON l.document_id = d.id
  WHERE d.posted = 1 AND d.type IN (${inList('stock')})
  UNION ALL
  SELECT d.id, d.type, d.moment, d.warehouse_id, l.product_id, l.price, -l.qty
  FROM documents d JOIN document_lines l ON l.document_id = d.id
  WHERE d.posted = 1 AND d.type = 'move'
  UNION ALL
  SELECT d.id, d.type, d.moment, d.target_warehouse_id, l.product_id, l.price, l.qty
  FROM documents d JOIN document_lines l ON l.document_id = d.id
  WHERE d.posted = 1 AND d.type = 'move';
`;

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrate(db);
  if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) seedBase(db);
  return db;
}

// Eski veritabanlarına sonradan eklenen sütunlar.
function migrate(db) {
  const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!has('documents', 'external_id')) db.exec('ALTER TABLE documents ADD COLUMN external_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS documents_external ON documents(type, external_id) WHERE external_id IS NOT NULL');
  const def = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) def.run(k, v);
}

export const DEFAULT_SETTINGS = {
  company_name: 'Моя компания',
  currency: '₽',
  default_vat: '22',
  retail_counterparty_id: '1',
  fiscal_mode: 'off',
  atol_url: 'http://127.0.0.1:16732',
  tax_system: 'osn',
  cashier_name: '',
  cashier_inn: '',
  shop_warehouse_id: '',
};

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function seedBase(db) {
  tx(db, () => {
    db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('admin', 'Администратор', hashPassword('admin'), 'admin');
    db.prepare('INSERT INTO warehouses (name) VALUES (?)').run('Основной склад');
    db.prepare("INSERT INTO counterparties (name, kind, roles) VALUES (?, 'person', 'customer')").run('Розничный покупатель');
  });
}
