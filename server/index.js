import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { matchRoute } from './api.js';
import { userFromToken } from './auth.js';
import { seedDemo } from './demo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};
const MAX_BODY = 5 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('İstek çok büyük'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('Geçersiz JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const cookieToken = (req) => /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1] ?? null;

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

export function createApp(db) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const match = matchRoute(req.method, url.pathname);
        if (!match) return send(res, 404, { error: 'Bulunamadı' });
        const token = cookieToken(req);
        const user = userFromToken(db, token);
        if (!match.route.public && !user) return send(res, 401, { error: 'Oturum açmanız gerekiyor' });
        const headers = {};
        const body = req.method === 'GET' ? {} : await readBody(req);
        const result = await match.route.handler({
          db, user, token, body, params: match.params, query: Object.fromEntries(url.searchParams),
          setCookie: (t) => {
            headers['Set-Cookie'] = `sid=${t}; HttpOnly; SameSite=Strict; Path=/${t ? '; Max-Age=2592000' : '; Max-Age=0'}`;
          },
        });
        return send(res, 200, result ?? null, headers);
      }

      // Statik dosyalar; bilinmeyen yollar SPA'ya (index.html) düşer.
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      let file = join(ROOT, rel || 'index.html');
      if (!file.startsWith(ROOT)) file = join(ROOT, 'index.html');
      let data;
      try { data = await readFile(file); } catch { file = join(ROOT, 'index.html'); data = await readFile(file); }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      const status = e.status ?? (e.code === 'ERR_SQLITE_ERROR' && /constraint/i.test(e.message) ? 400 : 500);
      if (status >= 500) console.error(e);
      send(res, status, { error: status >= 500 ? 'Sunucu hatası' : e.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.env.DB_FILE ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'vordi.db');
  if (file !== ':memory:') await mkdir(dirname(file), { recursive: true });
  const db = openDb(file);
  if (process.argv.includes('--demo')) seedDemo(db);
  const port = Number(process.env.PORT ?? 3000);
  createApp(db).listen(port, () => {
    console.log(`Vordi çalışıyor: http://localhost:${port}  (varsayılan giriş: admin / admin)`);
  });
}
