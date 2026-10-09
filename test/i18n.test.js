// Arayüzde ve sunucu hata mesajlarında kullanılan her metnin Rusça çevirisi olmalı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import RU from '../public/lang/ru.js';
import { DOC_TYPES, ACCOUNTS, EXPENSE_CATEGORIES } from '../server/doctypes.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

function sourceKeys() {
  const keys = new Set();
  for (const m of app.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
  const block = (re) => app.match(re)?.[1] ?? '';
  const menu = block(/const MENU = \[([\s\S]*?)\n\];/);
  for (const s of menu.matchAll(/title: '([^']+)'/g)) keys.add(s[1]);
  for (const s of menu.matchAll(/\['#[^']*', '([^']+)'\]/g)) keys.add(s[1]);
  for (const re of [/ROLE_LABEL = \{([^}]*)\}/, /SHIFT_LABEL = \{([^}]*)\}/, /FISCAL_MODE_LABEL = \{([^}]*)\}/]) {
    for (const s of block(re).matchAll(/: '([^']+)'/g)) if (s[1] !== '—') keys.add(s[1]);
  }
  keys.add('KDV yok');
  for (const u of block(/\[('adet'[^\]]*)\]/).matchAll(/'([^']+)'/g)) keys.add(u[1]);
  for (const t of Object.values(DOC_TYPES)) [t.title, t.single, ...(t.statuses ?? [])].forEach((k) => keys.add(k));
  [...ACCOUNTS, ...EXPENSE_CATEGORIES].forEach((k) => keys.add(k));
  const dir = new URL('../server/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    for (const m of s.matchAll(/HttpError\(\d+, '([^']+)'/g)) keys.add(m[1]);
  }
  return keys;
}

test('tüm arayüz metinlerinin Rusça karşılığı var', () => {
  const missing = [...sourceKeys()].filter((k) => !(k in RU));
  assert.deepEqual(missing, []);
});

test('çevirilerde yer tutucular korunur', () => {
  for (const [k, v] of Object.entries(RU)) {
    const ph = (s) => (s.match(/\{\d+\}/g) ?? []).sort().join();
    assert.equal(ph(v), ph(k), `yer tutucu uyuşmuyor: ${k}`);
  }
});
