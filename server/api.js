import { DOC_TYPES, ACCOUNTS, EXPENSE_CATEGORIES } from './doctypes.js';
import { tx } from './db.js';
import { hashPassword, verifyPassword, createSession } from './auth.js';
import { startReceipt, finishReceipt, shiftTask, TAX_SYSTEMS, FISCAL_MODES } from './fiscal.js';
import { publicRoutes, createToken } from './publicapi.js';
import { checkCodes, codeStatus, parseCode, MARKING_TYPES } from './marking.js';
import { channelTypes, listChannels, saveChannel, syncChannel, mapChannel, channelLog } from './channels/index.js';
import {
  HttpError, listDocuments, getDocument, saveDocument, deleteDocument, deriveDocument, nextNumber,
} from './documents.js';
import {
  stockReport, stockByWarehouse, turnoverReport, productMoves, profitReport, settlementsReport,
  counterpartyStatement, moneyReport, dashboard,
} from './reports.js';

// Basit varlıklar: izin verilen alanlar ve arama yapılacak sütunlar.
const ENTITIES = {
  products: {
    fields: {
      name: 'text', code: 'text', article: 'text', barcode: 'text', unit: 'text', group_id: 'ref', marking: 'text',
      buy_price: 'num', sale_price: 'num', vat: 'num', min_stock: 'num', is_service: 'bool',
      description: 'text', archived: 'bool',
    },
    search: ['name', 'code', 'article', 'barcode'],
    select: `SELECT t.*, g.name AS group_name FROM products t LEFT JOIN product_groups g ON g.id = t.group_id`,
    refs: [['document_lines', 'product_id']],
  },
  product_groups: { fields: { name: 'text', archived: 'bool' }, search: ['name'], refs: [] },
  warehouses: {
    fields: { name: 'text', address: 'text', archived: 'bool' }, search: ['name', 'address'],
    refs: [['documents', 'warehouse_id'], ['documents', 'target_warehouse_id']],
  },
  counterparties: {
    fields: {
      name: 'text', kind: 'text', roles: 'text', tax_office: 'text', tax_no: 'text', phone: 'text',
      email: 'text', address: 'text', comment: 'text', archived: 'bool',
    },
    search: ['name', 'tax_no', 'phone', 'email'],
    refs: [['documents', 'counterparty_id']],
  },
};

function cleanFields(spec, body, partial) {
  const out = {};
  for (const [k, type] of Object.entries(spec.fields)) {
    if (!(k in body)) {
      if (partial) continue;
      if (type === 'text') out[k] = '';
      continue;
    }
    const v = body[k];
    if (type === 'text') out[k] = String(v ?? '').trim();
    else if (type === 'num') out[k] = Number(v) || 0;
    else if (type === 'bool') out[k] = v && v !== '0' ? 1 : 0;
    else if (type === 'ref') out[k] = v === '' || v == null ? null : Number(v);
  }
  if ('name' in out && !out.name) throw new HttpError(400, 'Ad alanı zorunludur');
  return out;
}

function entityList(db, name, { q = '', archived = '0' }) {
  const spec = ENTITIES[name];
  const base = spec.select ?? `SELECT t.* FROM ${name} t`;
  const where = [];
  const p = {};
  if (archived !== 'all') { where.push('t.archived = $archived'); p.archived = archived === '1' ? 1 : 0; }
  if (q) {
    where.push('(' + spec.search.map((c) => `t.${c} LIKE $q`).join(' OR ') + ')');
    p.q = `%${q}%`;
  }
  return db.prepare(`${base} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.name`).all(p);
}

function entityGet(db, name, id) {
  const spec = ENTITIES[name];
  const row = db.prepare(`${spec.select ?? `SELECT t.* FROM ${name} t`} WHERE t.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Kayıt bulunamadı');
  return row;
}

function entitySave(db, name, body, id = null) {
  const spec = ENTITIES[name];
  const f = cleanFields(spec, body, !!id);
  const keys = Object.keys(f);
  if (id) {
    entityGet(db, name, id);
    if (keys.length) {
      db.prepare(`UPDATE ${name} SET ${keys.map((k) => `${k} = $${k}`).join(', ')} WHERE id = $id`).run({ ...f, id });
    }
    return entityGet(db, name, id);
  }
  const r = db.prepare(
    `INSERT INTO ${name} (${keys.join(', ')}) VALUES (${keys.map((k) => `$${k}`).join(', ')})`,
  ).run(f);
  return entityGet(db, name, Number(r.lastInsertRowid));
}

// Belgelerde kullanılan kayıt silinmez, arşive alınır.
function entityDelete(db, name, id) {
  const spec = ENTITIES[name];
  entityGet(db, name, id);
  const used = spec.refs.some(([table, col]) => db.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ? LIMIT 1`).get(id));
  if (used) {
    db.prepare(`UPDATE ${name} SET archived = 1 WHERE id = ?`).run(id);
    return { archived: true };
  }
  db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(id);
  return { deleted: true };
}

function importProducts(db, rows) {
  if (!Array.isArray(rows)) throw new HttpError(400, 'Geçersiz veri');
  const groups = new Map(db.prepare('SELECT id, name FROM product_groups').all().map((g) => [g.name.toLowerCase(), g.id]));
  let created = 0;
  let updated = 0;
  tx(db, () => {
    for (const raw of rows) {
      const name = String(raw.name ?? '').trim();
      if (!name) continue;
      let groupId = null;
      const gname = String(raw.group ?? '').trim();
      if (gname) {
        groupId = groups.get(gname.toLowerCase());
        if (!groupId) {
          groupId = Number(db.prepare('INSERT INTO product_groups (name) VALUES (?)').run(gname).lastInsertRowid);
          groups.set(gname.toLowerCase(), groupId);
        }
      }
      const body = { ...raw, name, group_id: groupId };
      const key = String(raw.code || raw.article || raw.barcode || '').trim();
      const existing = key
        ? db.prepare('SELECT id FROM products WHERE (code = ? AND code != \'\') OR (article = ? AND article != \'\') OR (barcode = ? AND barcode != \'\') LIMIT 1').get(key, key, key)
        : db.prepare('SELECT id FROM products WHERE name = ? LIMIT 1').get(name);
      const fields = Object.fromEntries(Object.entries(body).filter(([k, v]) => k in ENTITIES.products.fields && v !== '' && v != null));
      if (existing) { entitySave(db, 'products', fields, existing.id); updated++; } else { entitySave(db, 'products', fields); created++; }
    }
  });
  return { created, updated };
}

const maskSettings = (s) => ({ ...s, cz_token: s.cz_token ? '••••••' + s.cz_token.slice(-4) : '' });
const settingsObj = (db) => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));

function requireAdmin(user) {
  if (user.role !== 'admin') throw new HttpError(403, 'Bu işlem için yönetici yetkisi gerekir');
}

// Rota tablosu: [metot, desen, işleyici(ctx)] — ctx = { db, user, params, query, body, setCookie }
export const routes = [
  ['POST', '/api/login', ({ db, body, setCookie }) => {
    const u = db.prepare('SELECT * FROM users WHERE username = ? AND archived = 0').get(String(body.username ?? ''));
    if (!u || !verifyPassword(body.password ?? '', u.password_hash)) throw new HttpError(401, 'Kullanıcı adı veya şifre hatalı');
    setCookie(createSession(db, u.id));
    return { id: u.id, username: u.username, name: u.name, role: u.role };
  }, { public: true }],
  ['POST', '/api/logout', ({ db, token, setCookie }) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token ?? '');
    setCookie('');
    return { ok: true };
  }, { public: true }],
  ['GET', '/api/me', ({ user }) => user],
  ['GET', '/api/meta', ({ db }) => ({
    docTypes: DOC_TYPES, accounts: ACCOUNTS, categories: EXPENSE_CATEGORIES, settings: maskSettings(settingsObj(db)),
    taxSystems: TAX_SYSTEMS, fiscalModes: FISCAL_MODES, markingTypes: MARKING_TYPES, channelTypes: channelTypes(),
  })],
  ['GET', '/api/settings', ({ db }) => maskSettings(settingsObj(db))],
  ['PUT', '/api/settings', ({ db, user, body }) => {
    requireAdmin(user);
    const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if ('fiscal_mode' in body && !FISCAL_MODES.includes(body.fiscal_mode)) throw new HttpError(400, 'Geçersiz kasa modu');
    if ('tax_system' in body && !TAX_SYSTEMS.includes(body.tax_system)) throw new HttpError(400, 'Geçersiz vergi sistemi');
    for (const k of ['company_name', 'currency', 'company_address', 'company_tax_no', 'company_kpp', 'retail_counterparty_id',
      'default_vat', 'fiscal_mode', 'atol_url', 'tax_system', 'cashier_name', 'cashier_inn', 'shop_warehouse_id',
      'cz_mode', 'cz_token', 'channel_sync_minutes']) {
      if (k === 'cz_token' && String(body[k] ?? '').startsWith('••')) continue;
      if (k in body) up.run(k, String(body[k]));
    }
    return maskSettings(settingsObj(db));
  }],

  ['GET', '/api/users', ({ db, user }) => {
    requireAdmin(user);
    return db.prepare('SELECT id, username, name, role, archived, created_at FROM users ORDER BY username').all();
  }],
  ['POST', '/api/users', ({ db, user, body }) => {
    requireAdmin(user);
    if (!body.username || !body.password) throw new HttpError(400, 'Kullanıcı adı ve şifre zorunludur');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(body.username)) throw new HttpError(400, 'Bu kullanıcı adı zaten var');
    const r = db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(String(body.username), String(body.name ?? ''), hashPassword(body.password), body.role === 'admin' ? 'admin' : 'user');
    return { id: Number(r.lastInsertRowid) };
  }],
  ['PUT', '/api/users/:id', ({ db, user, body, params }) => {
    if (user.role !== 'admin' && user.id !== Number(params.id)) throw new HttpError(403, 'Yetkiniz yok');
    const id = Number(params.id);
    if (body.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(body.name), id);
    if (body.password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), id);
    if (user.role === 'admin' && body.role !== undefined && id !== user.id) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role === 'admin' ? 'admin' : 'user', id);
    }
    if (user.role === 'admin' && body.archived !== undefined && id !== user.id) {
      db.prepare('UPDATE users SET archived = ? WHERE id = ?').run(body.archived ? 1 : 0, id);
      if (body.archived) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    return { ok: true };
  }],

  ['GET', '/api/documents', ({ db, query }) => listDocuments(db, query)],
  ['GET', '/api/documents/next-number/:type', ({ db, params }) => {
    if (!DOC_TYPES[params.type]) throw new HttpError(400, 'Bilinmeyen belge türü');
    return { number: nextNumber(db, params.type) };
  }],
  ['GET', '/api/documents/:id', ({ db, params }) => getDocument(db, Number(params.id))],
  ['GET', '/api/documents/:id/derive/:type', ({ db, params }) => deriveDocument(db, Number(params.id), params.type)],
  ['POST', '/api/documents', ({ db, user, body }) => saveDocument(db, body, user.id)],
  ['PUT', '/api/documents/:id', ({ db, user, body, params }) => saveDocument(db, body, user.id, Number(params.id))],
  ['DELETE', '/api/documents/:id', ({ db, params }) => { deleteDocument(db, Number(params.id)); return { ok: true }; }],

  ['POST', '/api/marking/check', async ({ db, body }) => checkCodes(settingsObj(db), Array.isArray(body.codes) ? body.codes : [])],
  ['GET', '/api/marking/status', ({ db, query }) => {
    const p = parseCode(query.code);
    if (!p) throw new HttpError(400, `Geçersiz markalama kodu: ${String(query.code ?? '').slice(0, 40)}`);
    const product = db.prepare("SELECT id, name, barcode, marking FROM products WHERE archived = 0 AND marking != ''").all()
      .find((x) => String(x.barcode).replace(/\D/g, '').padStart(14, '0') === p.gtin) ?? null;
    return { ...p, ...codeStatus(db, p.cis), product };
  }],

  ['GET', '/api/channels', ({ db }) => listChannels(db)],
  ['POST', '/api/channels', ({ db, user, body }) => { requireAdmin(user); return saveChannel(db, body); }],
  ['PUT', '/api/channels/:id', ({ db, user, body, params }) => { requireAdmin(user); return saveChannel(db, body, Number(params.id)); }],
  ['DELETE', '/api/channels/:id', ({ db, user, params }) => {
    requireAdmin(user);
    db.prepare('DELETE FROM channels WHERE id = ?').run(Number(params.id));
    return { ok: true };
  }],
  ['POST', '/api/channels/:id/sync', ({ db, params }) => syncChannel(db, Number(params.id))],
  ['POST', '/api/channels/:id/map', ({ db, params }) => mapChannel(db, Number(params.id))],
  ['GET', '/api/channels/:id/log', ({ db, params }) => channelLog(db, Number(params.id))],

  ['POST', '/api/documents/:id/fiscal/:kind', ({ db, params }) => startReceipt(db, Number(params.id), params.kind, settingsObj(db))],
  ['POST', '/api/fiscal/:id/result', ({ db, params, body }) => finishReceipt(db, Number(params.id), body)],
  ['GET', '/api/fiscal/shift/:kind', ({ db, params }) => shiftTask(params.kind, settingsObj(db))],

  ['GET', '/api/tokens', ({ db, user }) => {
    requireAdmin(user);
    return db.prepare('SELECT id, name, last_used_at, created_at FROM api_tokens ORDER BY id').all();
  }],
  ['POST', '/api/tokens', ({ db, user, body }) => { requireAdmin(user); return createToken(db, body.name); }],
  ['DELETE', '/api/tokens/:id', ({ db, user, params }) => {
    requireAdmin(user);
    db.prepare('DELETE FROM api_tokens WHERE id = ?').run(Number(params.id));
    return { ok: true };
  }],

  ['GET', '/api/dashboard', ({ db }) => dashboard(db)],
  ['GET', '/api/reports/stock', ({ db, query }) => stockReport(db, query)],
  ['GET', '/api/reports/turnover', ({ db, query }) => turnoverReport(db, query)],
  ['GET', '/api/reports/profit', ({ db, query }) => profitReport(db, query)],
  ['GET', '/api/reports/settlements', ({ db, query }) => settlementsReport(db, query)],
  ['GET', '/api/reports/money', ({ db, query }) => moneyReport(db, query)],
  ['GET', '/api/counterparties/:id/statement', ({ db, params }) => counterpartyStatement(db, Number(params.id))],
  ['GET', '/api/products/:id/stock', ({ db, params }) => stockByWarehouse(db, Number(params.id))],
  ['GET', '/api/products/:id/moves', ({ db, params }) => productMoves(db, Number(params.id))],
  ['POST', '/api/products/import', ({ db, body }) => importProducts(db, body.rows)],

  ...Object.keys(ENTITIES).flatMap((name) => [
    ['GET', `/api/${name}`, ({ db, query }) => entityList(db, name, query)],
    ['GET', `/api/${name}/:id`, ({ db, params }) => entityGet(db, name, Number(params.id))],
    ['POST', `/api/${name}`, ({ db, body }) => entitySave(db, name, body)],
    ['PUT', `/api/${name}/:id`, ({ db, body, params }) => entitySave(db, name, body, Number(params.id))],
    ['DELETE', `/api/${name}/:id`, ({ db, params }) => entityDelete(db, name, Number(params.id))],
  ]),
  ...publicRoutes.map((r) => [...r, { token: true }]),
].map(([method, pattern, handler, opts = {}]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { method, re, keys, handler, public: !!opts.public, token: !!opts.token };
});

export function matchRoute(method, path) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(path);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
