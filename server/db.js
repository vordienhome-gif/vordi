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
  unit TEXT NOT NULL DEFAULT 'adet',
  group_id INTEGER REFERENCES product_groups(id) ON DELETE SET NULL,
  buy_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  vat REAL NOT NULL DEFAULT 20,
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
  if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) seedBase(db);
  return db;
}

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
      .run('admin', 'Yönetici', hashPassword('admin'), 'admin');
    db.prepare('INSERT INTO warehouses (name) VALUES (?)').run('Ana depo');
    db.prepare("INSERT INTO counterparties (name, kind, roles) VALUES (?, 'person', 'customer')").run('Perakende müşteri');
    const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    set.run('company_name', 'Şirketim');
    set.run('currency', '₺');
    set.run('retail_counterparty_id', '1');
  });
}
