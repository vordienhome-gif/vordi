// Vordi — tek sayfalık arayüz (bağımlılıksız).
import { t, lang, setLang, locale, LANGS } from './i18n.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let nf2;
let nf3;
const setFormats = () => {
  nf2 = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  nf3 = new Intl.NumberFormat(locale(), { maximumFractionDigits: 3 });
};
setFormats();
const today = () => new Date().toLocaleDateString('sv-SE');
const monthStart = () => today().slice(0, 8) + '01';
const nowLocal = () => { const d = new Date(); return `${d.toLocaleDateString('sv-SE')}T${d.toTimeString().slice(0, 5)}`; };
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vatOf = (sum, rate) => (rate > 0 ? (sum * rate) / (100 + rate) : 0);
const VAT_RATES = [[22, '22%'], [20, '20%'], [10, '10%'], [7, '7%'], [5, '5%'], [0, '0%'], [-1, 'KDV yok']];
const vatLabel = (v) => (v < 0 ? t('KDV yok') : `${v}%`);

let META = null;
let ME = null;
const money = (v) => `${nf2.format(Number(v) || 0)} ${META?.settings.currency ?? '₽'}`;
const qty = (v) => nf3.format(Number(v) || 0);
const signed = (v, fmt = money) => `<span class="${v < 0 ? 'neg' : ''}">${fmt(v)}</span>`;
const dt = (type) => META.docTypes[type];

// ---------- API ----------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/api/login') { ME = null; renderLogin(); throw new Error(t('Oturum kapandı')); }
  if (!res.ok) throw new Error(t(data?.error ?? `Hata ${res.status}`));
  return data;
}
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

const refCache = {};
async function refs(name, force = false) {
  if (force || !refCache[name]) refCache[name] = await api(`/api/${name}`);
  return refCache[name];
}
const dropRefs = (...names) => names.forEach((n) => delete refCache[n]);

// ---------- Bildirim, modal ----------
function toast(msg, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), error ? 6000 : 3000);
}
const fail = (e) => toast(e.message, true);

// fields: [{ key, label, type: text|number|select|textarea|password|checkbox, options:[[v,l]], wide }]
function formHtml(fields, values = {}) {
  return `<div class="form-grid">${fields.map((f) => {
    const v = values[f.key] ?? f.default ?? '';
    const cls = f.wide || f.type === 'textarea' ? 'field wide' : 'field';
    if (f.type === 'checkbox') return `<label class="check ${f.wide ? 'wide' : ''}"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    let input;
    if (f.type === 'select') input = `<select name="${f.key}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v ?? '') ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea name="${f.key}">${esc(v)}</textarea>`;
    else input = `<input name="${f.key}" type="${f.type ?? 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v)}" ${f.required ? 'required' : ''} ${f.list ? `list="${f.list}"` : ''}>`;
    return `<label class="${cls}">${esc(f.label)}${input}</label>`;
  }).join('')}</div>`;
}
function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    const el = root.querySelector(`[name="${f.key}"]`);
    if (!el) continue;
    out[f.key] = f.type === 'checkbox' ? (el.checked ? 1 : 0) : f.type === 'number' ? num(el.value) : el.value;
  }
  return out;
}
function modal(title, inner, { okText = t('Kaydet'), onOk } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${inner}<div class="actions">
      <button type="button" data-cancel>${esc(t('Vazgeç'))}</button>${okText ? `<button class="primary">${esc(okText)}</button>` : ''}</div></form>`;
    document.body.append(back);
    const close = (v) => { back.remove(); resolve(v); };
    $('[data-cancel]', back).onclick = () => close(null);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
    $('form', back).onsubmit = async (e) => {
      e.preventDefault();
      try { close(onOk ? await onOk($('form', back)) : true); } catch (err) { fail(err); }
    };
    $('input, select, textarea', back)?.focus();
  });
}
const formModal = (title, fields, values) => modal(title, formHtml(fields, values), { onOk: (f) => readForm(f, fields) });
const confirmModal = (text) => modal(t('Onay'), `<p>${esc(text)}</p>`, { okText: t('Evet') });

// ---------- Tablo ----------
// cols: [{ key, title, num, fmt(v,row) -> html, total }]
function tableHtml(cols, rows, { click = false, empty = t('Kayıt yok'), footer = true } = {}) {
  if (!rows.length) return `<div class="table-wrap"><div class="empty">${esc(empty)}</div></div>`;
  const hasTotal = footer && cols.some((c) => c.total);
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.title)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r, i) => `<tr class="${click ? 'click' : ''}" data-i="${i}">${cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.nowrap ? 'nowrap' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
  ${hasTotal ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.num ? 'num' : ''}">${c.total ? (c.fmt ?? esc)(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0), {}) : i === 0 ? esc(t('Toplam')) : ''}</td>`).join('')}</tr></tfoot>` : ''}
  </table></div>`;
}
function bindRows(root, rows, fn) {
  $$('tbody tr.click', root).forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input')) return;
    fn(rows[Number(tr.dataset.i)]);
  }));
}
function downloadCsv(name, cols, rows) {
  const cell = (v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.map((c) => cell(c.title)).join(';'), ...rows.map((r) => cols.map((c) => {
    const v = r[c.key];
    return cell(typeof v === 'number' ? String(v).replace('.', ',') : v);
  }).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function parseCsv(text) {
  const head = text.split('\n')[0];
  const sep = (head.match(/;/g) || []).length >= (head.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [''];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { row[row.length - 1] += '"'; i++; } else if (c === '"') q = false; else row[row.length - 1] += c;
    } else if (c === '"') q = true;
    else if (c === sep) row.push('');
    else if (c === '\n') { rows.push(row); row = ['']; } else if (c !== '\r') row[row.length - 1] += c;
  }
  if (row.length > 1 || row[0]) rows.push(row);
  return rows;
}

// ---------- Menü ----------
const MENU = [
  { title: 'Göstergeler', items: [['#/dashboard', 'Göstergeler']] },
  { title: 'Satın Alma', items: [['#/docs/purchaseorder', 'Tedarikçi siparişleri'], ['#/docs/supply', 'Mal kabulleri'], ['#/docs/purchasereturn', 'Tedarikçiye iadeler'], ['#/reports/settlements', 'Cari hesaplar']] },
  { title: 'Satış', items: [['#/docs/customerorder', 'Müşteri siparişleri'], ['#/docs/demand', 'Sevkiyatlar'], ['#/docs/salesreturn', 'Müşteri iadeleri'], ['#/reports/profit', 'Kârlılık']] },
  { title: 'Ürünler', items: [['#/products', 'Ürünler ve hizmetler'], ['#/docs/enter', 'Girişler'], ['#/docs/loss', 'Zayiatlar'], ['#/docs/move', 'Transferler'], ['#/docs/inventory', 'Sayımlar'], ['#/reports/stock', 'Stok bakiyeleri'], ['#/reports/turnover', 'Stok hareketleri'], ['#/warehouses', 'Depolar']] },
  { title: 'Cariler', items: [['#/counterparties', 'Cari kartları'], ['#/reports/settlements', 'Cari hesaplar']] },
  { title: 'Para', items: [['#/reports/money', 'Kasa ve banka'], ['#/docs/paymentin', 'Gelen ödemeler'], ['#/docs/paymentout', 'Giden ödemeler']] },
  { title: 'Perakende', items: [['#/pos', 'Satış ekranı (POS)'], ['#/docs/retaildemand', 'Perakende satışlar']] },
  { title: 'Ayarlar', items: [['#/settings', 'Şirket ve kullanıcılar'], ['#/settings/integrations', 'Kasa ve entegrasyonlar']] },
];
const SECTION_OF_TYPE = { purchase: 1, sales: 2, stock: 3, money: 5, retail: 6 };
let currentDocType = null;

function activeSection(hash) {
  const docType = /^#\/docs\/(\w+)/.exec(hash)?.[1] ?? currentDocType;
  if (docType && dt(docType)) return SECTION_OF_TYPE[dt(docType).section];
  if (hash.startsWith('#/products')) return 3;
  if (hash.startsWith('#/counterparties')) return 4;
  let best = 0;
  let bestLen = 0;
  MENU.forEach((m, i) => m.items.forEach(([h]) => { if (hash.startsWith(h) && h.length > bestLen) { best = i; bestLen = h.length; } }));
  return best;
}

const langSwitch = () => `<select class="lang" aria-label="Language">${LANGS.map(([k, l]) => `<option value="${k}" ${k === lang() ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
function bindLangSwitch(root, after) {
  $('.lang', root).onchange = (e) => { setLang(e.target.value); setFormats(); after(); };
}

function renderShell() {
  $('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/dashboard"><span class="logo">V</span>Vordi</a>
    <nav class="topnav" id="topnav"></nav>
    <div class="userbox">${langSwitch()}<span class="who">${esc(META.settings.company_name)} · ${esc(ME.name || ME.username)}</span><button id="logout">${esc(t('Çıkış'))}</button></div>
  </header>
  <nav class="subnav" id="subnav"></nav>
  <main id="main"></main>`;
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); ME = null; renderLogin(); };
  bindLangSwitch($('.topbar'), () => { renderShell(); router(); });
}
function renderNav() {
  const hash = location.hash || '#/dashboard';
  const sec = activeSection(hash);
  $('#topnav').innerHTML = MENU.map((m, i) => `<a href="${m.items[0][0]}" class="${i === sec ? 'active' : ''}">${esc(t(m.title))}</a>`).join('');
  const path = hash.split('?')[0];
  $('#subnav').innerHTML = MENU[sec].items.map(([h, title]) => `<a href="${h}" class="${path === h || path.startsWith(h + '/') ? 'active' : ''}">${esc(t(title))}</a>`).join('');
}

// ---------- Yönlendirme ----------
const ROUTES = [
  [/^#\/dashboard$/, () => viewDashboard()],
  [/^#\/docs\/(\w+)$/, (type) => viewDocList(type)],
  [/^#\/docs\/(\w+)\/new$/, (type, q) => viewDocForm({ type, from: q.get('from'), copy: q.get('copy') })],
  [/^#\/doc\/(\d+)$/, (id) => viewDocForm({ id })],
  [/^#\/products$/, (q) => viewProducts(q)],
  [/^#\/products\/(new|\d+)$/, (id) => viewProductForm(id)],
  [/^#\/counterparties$/, () => viewCounterparties()],
  [/^#\/counterparties\/(new|\d+)$/, (id) => viewCounterpartyForm(id)],
  [/^#\/warehouses$/, () => viewWarehouses()],
  [/^#\/reports\/stock$/, () => viewStock()],
  [/^#\/reports\/turnover$/, () => viewTurnover()],
  [/^#\/reports\/profit$/, () => viewProfit()],
  [/^#\/reports\/settlements$/, () => viewSettlements()],
  [/^#\/reports\/money$/, () => viewMoney()],
  [/^#\/pos$/, () => viewPos()],
  [/^#\/settings$/, () => viewSettings()],
  [/^#\/settings\/integrations$/, () => viewIntegrations()],
];

async function router() {
  if (!ME || !META) return;
  const hash = location.hash || '#/dashboard';
  const [path, query] = hash.split('?');
  currentDocType = null;
  for (const [re, fn] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      $('#main').innerHTML = `<div class="muted">${esc(t('Yükleniyor…'))}</div>`;
      try {
        renderNav();
        await fn(...m.slice(1), new URLSearchParams(query ?? ''));
        renderNav();
      } catch (e) {
        $('#main').innerHTML = `<div class="card neg">${esc(e.message)}</div>`;
      }
      return;
    }
  }
  location.hash = '#/dashboard';
}
const go = (h) => { location.hash = h; };

// ---------- Giriş ----------
function renderLogin() {
  $('#app').innerHTML = `<div class="login"><form>
    <div class="brand"><span class="logo" style="color:#fff">V</span>Vordi</div>
    <label class="field">${esc(t('Kullanıcı adı'))}<input name="username" autocomplete="username" required></label>
    <label class="field">${esc(t('Şifre'))}<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="primary big">${esc(t('Giriş yap'))}</button>
    <div class="muted" style="font-size:12px;text-align:center">${esc(t('İlk kurulumda: admin / admin'))}</div>
    <div style="text-align:center">${langSwitch()}</div>
  </form></div>`;
  const f = $('.login form');
  f.username.focus();
  bindLangSwitch(f, renderLogin);
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      ME = await api('/api/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } });
      await boot();
    } catch (err) { fail(err); }
  };
}

async function boot() {
  try { ME = await api('/api/me'); } catch { return; }
  META = await api('/api/meta');
  renderShell();
  await router();
}
window.addEventListener('hashchange', router);

// ---------- Göstergeler ----------
async function viewDashboard() {
  const d = await api('/api/dashboard');
  const max = Math.max(...d.series.map((s) => s.sum), 1);
  const W = 900; const H = 180; const bw = W / d.series.length;
  const bars = d.series.map((s, i) => {
    const h = Math.max((s.sum / max) * (H - 20), s.sum ? 2 : 0);
    return `<rect class="bar" x="${i * bw + 2}" y="${H - 16 - h}" width="${bw - 4}" height="${h}" rx="2"><title>${s.day}: ${money(s.sum)}</title></rect>
      ${i % 5 === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 2}" text-anchor="middle">${s.day.slice(8, 10)}.${s.day.slice(5, 7)}</text>` : ''}`;
  }).join('');
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Göstergeler'))}</h1><div class="spacer"></div>
    <a class="btn" href="#/pos">${esc(t('Perakende satış'))}</a><a class="btn" href="#/docs/customerorder/new">+ ${esc(t('Müşteri siparişi'))}</a><a class="btn primary" href="#/docs/supply/new">+ ${esc(t('Mal kabul'))}</a></div>
  <div class="kpis">
    <div class="card kpi"><div class="label">${esc(t('Bugünkü satış'))}</div><div class="value">${money(d.salesToday.s)}</div><div class="sub">${esc(t('{0} belge', d.salesToday.n))}</div></div>
    <div class="card kpi"><div class="label">${esc(t('Bu ay satış'))}</div><div class="value">${money(d.salesMonth.s)}</div><div class="sub">${esc(t('{0} belge', d.salesMonth.n))}</div></div>
    <div class="card kpi"><div class="label">${esc(t('Bu ay brüt kâr'))}</div><div class="value">${signed(d.profitMonth)}</div></div>
    <div class="card kpi"><div class="label">${esc(t('Açık müşteri siparişleri'))}</div><div class="value">${d.openOrders.count}</div><div class="sub">${money(d.openOrders.sum)}</div></div>
    <div class="card kpi"><div class="label">${esc(t('Stok değeri (maliyet)'))}</div><div class="value">${money(d.stockValue)}</div></div>
    <div class="card kpi"><div class="label">${esc(t('Alacaklar / Borçlar'))}</div><div class="value pos" style="font-size:18px">${money(d.receivables)}</div><div class="value neg" style="font-size:18px;margin:0">${money(d.payables)}</div></div>
    ${d.money.map((a) => `<div class="card kpi"><div class="label">${esc(t('{0} bakiyesi', t(a.account)))}</div><div class="value">${signed(a.balance)}</div></div>`).join('')}
  </div>
  <div class="card chart" style="margin-bottom:12px"><h2>${esc(t('Son 30 gün satışlar'))}</h2><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg></div>
  <div class="grid cols-2">
    <div><h2>${esc(t('Kritik stok'))}</h2>${tableHtml([
      { key: 'name', title: t('Ürün'), fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
      { key: 'stock', title: t('Stok'), num: true, fmt: (v) => signed(v, qty) },
      { key: 'min_stock', title: t('Min. stok'), num: true, fmt: qty },
    ], d.lowStock, { empty: t('Kritik seviyede ürün yok'), footer: false })}</div>
    <div><h2>${esc(t('Bu ayın en çok satanları'))}</h2>${tableHtml([
      { key: 'name', title: t('Ürün') },
      { key: 'qty', title: t('Miktar'), num: true, fmt: qty },
      { key: 'revenue', title: t('Ciro'), num: true, fmt: money },
      { key: 'profit', title: t('Kâr'), num: true, fmt: (v) => signed(v) },
    ], d.topProducts, { empty: t('Bu ay satış yok'), footer: false })}</div>
  </div>`;
}

// ---------- Belge listesi ----------
const listState = {};
const statusBadge = (type, v) => {
  const closed = dt(type).closed ?? [];
  return `<span class="badge ${closed.includes(v) ? (v === 'İptal' ? 'off' : 'ok') : 'warn'}">${esc(t(v))}</span>`;
};
async function viewDocList(type) {
  const ty = dt(type);
  if (!ty) throw new Error(t('Bilinmeyen belge türü'));
  currentDocType = type;
  const st = listState[type] ??= { q: '', from: '', to: '' };
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t(ty.title))}</h1><div class="spacer"></div>
    <a class="btn primary" href="#/docs/${type}/new">+ ${esc(t(ty.single))}</a></div>
  <div class="toolbar">
    <input id="q" placeholder="${esc(t('Ara: numara, cari, açıklama'))}" value="${esc(st.q)}" style="width:260px">
    <label class="muted">${esc(t('Başlangıç'))} <input type="date" id="from" value="${st.from}"></label>
    <label class="muted">${esc(t('Bitiş'))} <input type="date" id="to" value="${st.to}"></label>
    <button id="csv">${esc(t('CSV indir'))}</button>
  </div>
  <div id="list"></div>`;
  const cols = [
    { key: 'number', title: '№', nowrap: true },
    { key: 'moment', title: t('Zaman'), nowrap: true },
    ...(ty.counterparty || type === 'retaildemand' ? [{ key: 'counterparty', title: t('Cari') }] : []),
    ...(ty.warehouse ? [{ key: 'warehouse', title: ty.targetWarehouse ? t('Kaynak depo') : t('Depo') }] : []),
    ...(ty.targetWarehouse ? [{ key: 'target_warehouse', title: t('Hedef depo') }] : []),
    ...(ty.statuses ? [{ key: 'status', title: t('Durum'), fmt: (v) => statusBadge(type, v) }] : []),
    ...(ty.account ? [{ key: 'account', title: t('Hesap'), fmt: (v) => esc(t(v)) }] : []),
    ...(ty.category ? [{ key: 'category', title: t('Kategori'), fmt: (v) => esc(t(v)) }] : []),
    { key: 'sum', title: t('Tutar'), num: true, fmt: money, total: true },
    ...(ty.lines && ty.counterparty ? [{ key: 'paid', title: t('Ödenen'), num: true, fmt: money, total: true }] : []),
    { key: 'posted', title: t('İşlendi'), fmt: (v) => (v ? `<span class="badge ok">${esc(t('Evet'))}</span>` : `<span class="badge">${esc(t('Taslak'))}</span>`) },
    { key: 'comment', title: t('Açıklama') },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/documents?${qs({ type, ...st })}`);
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, empty: t('Henüz belge yok') });
    bindRows($('#list'), rows, (r) => go(`#/doc/${r.id}`));
  };
  let timer;
  $('#q').oninput = (e) => { st.q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  $('#csv').onclick = () => downloadCsv(type, cols, rows);
  await load();
}

// ---------- Ürün seçici ----------
function productPicker(container, onPick, { placeholder = t('Ürün ekle: ad, kod veya barkod okutun…'), onCode = null } = {}) {
  container.innerHTML = `<div class="picker"><input placeholder="${esc(placeholder)}"><div class="dropdown" hidden></div></div>`;
  const input = $('input', container);
  const dd = $('.dropdown', container);
  let matches = [];
  let active = 0;
  const lc = (v) => String(v).toLocaleLowerCase(locale());
  const render = () => {
    dd.hidden = !matches.length;
    dd.innerHTML = matches.map((p, i) => `<div class="opt ${i === active ? 'active' : ''}" data-i="${i}"><span>${esc(p.name)} <span class="muted">${esc(p.code)}</span></span><span class="muted">${money(p.sale_price)}</span></div>`).join('');
  };
  const pick = (p) => { onPick(p); input.value = ''; matches = []; render(); input.focus(); };
  input.oninput = async () => {
    const s = lc(input.value.trim());
    if (!s) { matches = []; return render(); }
    const all = (await refs('products')).filter((p) => !p.archived);
    matches = all.filter((p) => [p.name, p.code, p.article, p.barcode].some((v) => lc(v).includes(s))).slice(0, 20);
    active = 0;
    render();
  };
  input.onkeydown = async (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    if (e.key === 'Escape') { matches = []; render(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const s = input.value.trim();
      if (onCode && looksLikeMark(s)) { input.value = ''; matches = []; render(); onCode(s); return; }
      const exact = (await refs('products')).find((p) => s && (p.barcode === s || p.code === s || p.article === s));
      if (exact) pick(exact); else if (matches[active]) pick(matches[active]);
    }
  };
  dd.onmousedown = (e) => { const o = e.target.closest('.opt'); if (o) { e.preventDefault(); pick(matches[Number(o.dataset.i)]); } };
  input.onblur = () => setTimeout(() => { dd.hidden = true; }, 150);
  input.onfocus = () => { if (matches.length) dd.hidden = false; };
  return input;
}

// ---------- Честный знак ----------
const MARKING_LABEL = { '': 'Markalama yok', lp: 'Giyim ve tekstil', shoes: 'Ayakkabı', perfumery: 'Parfüm', tires: 'Lastik', water: 'Su', milk: 'Süt ürünleri', other: 'Diğer markalı ürün' };
// DataMatrix içeriği mi? (01) + 14 haneli GTIN + (21) seri
const looksLikeMark = (s) => /^(\]d2|\]C1)?\u001d?01\d{14}21./.test(s) && s.length >= 25;
const scanCodeModal = (name) => modal(t('Markalama kodu'),
  `<p>${esc(t('{0} için DataMatrix kodunu okutun', name))}</p><input name="code" autocomplete="off" style="width:100%">`,
  { okText: t('Ekle'), onOk: (f) => f.code.value.trim() });
// Kodu yerel kayıtlara ve (ayarlıysa) Честный знак'a karşı kontrol eder.
async function verifyCode(raw, productId, { online = true } = {}) {
  const st = await api(`/api/marking/status?code=${encodeURIComponent(raw)}`);
  if (productId && st.product && st.product.id !== productId) throw new Error(t('Kod bu ürüne ait değil'));
  if (st.status === 'out') throw new Error(t('Kod zaten satılmış veya çıkmış: {0}', st.cis));
  if (online) {
    const [r] = await api('/api/marking/check', { method: 'POST', body: { codes: [raw] } });
    if (!r.ok) throw new Error(t('Satış yasak: {0}', t(r.reason)));
  }
  return st;
}

// ---------- Kasa (АТОЛ Web Server) ----------
// Görev tarayıcıdan kasiyerin bilgisayarındaki АТОЛ Web Server'a gönderilir ve sonucu sorgulanır.
async function runAtol(url, task) {
  const base = String(url).replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(`${base}/api/v2/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) });
  } catch {
    return { ok: false, error: t('Kasaya bağlanılamadı ({0}). АТОЛ Web Server çalışıyor mu?', base) };
  }
  if (!res.ok && res.status !== 409) return { ok: false, error: t('Kasa hatası: {0}', res.status) };
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const s = await fetch(`${base}/api/v2/requests/${task.uuid}`).then((r) => r.json()).catch(() => null);
    const r = s?.results?.[0];
    if (!r || ['wait', 'inProgress'].includes(r.status)) continue;
    if (r.status === 'ready') return { ok: true, fiscalParams: r.result?.fiscalParams ?? {} };
    return { ok: false, error: r.errorDescription || r.status };
  }
  return { ok: false, error: t('Kasa yanıt vermedi') };
}

async function fiscalize(docId, kind = 'sell') {
  const start = await api(`/api/documents/${docId}/fiscal/${kind}`, { method: 'POST' });
  let receipt = start.receipt;
  if (start.mode !== 'test') {
    const result = await runAtol(start.atol_url, start.task);
    receipt = await api(`/api/fiscal/${receipt.id}/result`, { method: 'POST', body: result });
    if (!result.ok) throw new Error(t('Fiş kesilemedi: {0}', result.error));
  }
  toast(t('Fiş kesildi: ФД №{0}, ФП {1}', receipt.fd_number, receipt.fpd));
  return receipt;
}

const SHIFT_LABEL = { openShift: 'Vardiya aç', reportX: 'X raporu', closeShift: 'Vardiyayı kapat (Z raporu)' };
async function shiftAction(kind) {
  try {
    const s = await api(`/api/fiscal/shift/${kind}`);
    if (s.mode === 'test') { toast(t('Test modu: {0} gönderildi', t(SHIFT_LABEL[kind]))); return; }
    const r = await runAtol(s.atol_url, s.task);
    if (!r.ok) throw new Error(r.error);
    toast(t('{0} tamamlandı', t(SHIFT_LABEL[kind])));
  } catch (e) { fail(e); }
}

// ---------- Belge formu ----------
async function viewDocForm({ id, type, from, copy }) {
  const draft = !id && copy ? sessionStorage.getItem('vordi-copy') : null;
  if (draft) {
    // Kopyala: taslak olarak yeni belge oluştur ve onu aç.
    sessionStorage.removeItem('vordi-copy');
    const saved = await api('/api/documents', { method: 'POST', body: { ...JSON.parse(draft), posted: false, moment: '' } });
    toast(t('Kopya taslak olarak oluşturuldu'));
    history.replaceState(null, '', `#/doc/${saved.id}`);
    return viewDocForm({ id: saved.id });
  }
  let doc;
  if (id) doc = await api(`/api/documents/${id}`);
  else if (from) doc = await api(`/api/documents/${from}/derive/${type}`);
  else doc = { type, lines: [], posted: 1 };
  type = doc.type;
  const ty = dt(type);
  if (!ty) throw new Error(t('Bilinmeyen belge türü'));
  currentDocType = type;
  if (!id) {
    doc.number = doc.number ?? (await api(`/api/documents/next-number/${type}`)).number;
    doc.moment = nowLocal();
    if (ty.statuses) doc.status = ty.statuses[0];
    if (ty.account) doc.account = doc.account ?? 'Kasa';
  }
  const [warehouses, counterparties] = await Promise.all([refs('warehouses'), refs('counterparties')]);
  if (!id && ty.warehouse && !doc.warehouse_id) doc.warehouse_id = warehouses[0]?.id;
  if (!id && type === 'retaildemand' && !doc.counterparty_id) doc.counterparty_id = Number(META.settings.retail_counterparty_id) || null;
  doc.lines = doc.lines ?? [];
  // Sayım: satırdaki "beklenen" stok = sayılan - fark.
  if (ty.inventory) for (const l of doc.lines) l.expected = (l.actual_qty ?? 0) - (l.qty ?? 0);

  const opts = (list, sel) => `<option value="">${esc(t('— seçiniz —'))}</option>` +
    list.filter((x) => !x.archived || x.id === sel).map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const fiscalOn = type === 'retaildemand' && META.settings.fiscal_mode !== 'off';
  const fiscalDone = (kind) => (doc.fiscal ?? []).some((f) => f.kind === kind && f.status === 'done');

  $('#main').innerHTML = `
  <div class="page-head">
    <a href="#/docs/${type}" class="muted">← ${esc(t(ty.title))}</a>
    <h1>${esc(t(ty.single))} ${id ? `№${esc(doc.number)}` : esc(t('(yeni)'))}</h1>
    <div class="spacer"></div>
    ${id && ty.derive ? `<select id="derive"><option value="">${esc(t('Oluştur…'))}</option>${ty.derive.map((d) => `<option value="${d}">${esc(t(dt(d).single))}</option>`).join('')}</select>` : ''}
    ${id && fiscalOn && !fiscalDone('sell') ? `<button id="fiscal-sell">${esc(t('Fiş kes'))}</button>` : ''}
    ${id && fiscalOn && fiscalDone('sell') && !fiscalDone('sellReturn') ? `<button id="fiscal-return">${esc(t('İade fişi'))}</button>` : ''}
    ${id ? `<button id="print">${esc(t('Yazdır'))}</button><button id="copy">${esc(t('Kopyala'))}</button><button id="del" class="danger">${esc(t('Sil'))}</button>` : ''}
    <button id="save" class="primary">${esc(t('Kaydet'))}</button>
  </div>
  <div class="card" style="margin-bottom:12px">
    <div class="form-grid">
      <label class="field">${esc(t('Numara'))}<input id="f-number" value="${esc(doc.number)}"></label>
      <label class="field">${esc(t('Tarih'))}<input id="f-moment" type="datetime-local" value="${esc(String(doc.moment).replace(' ', 'T'))}"></label>
      ${ty.counterparty || type === 'retaildemand' ? `<label class="field">${esc(t('Cari'))}<select id="f-counterparty_id">${opts(counterparties, doc.counterparty_id)}</select></label>` : ''}
      ${ty.warehouse ? `<label class="field">${esc(ty.targetWarehouse ? t('Kaynak depo') : t('Depo'))}<select id="f-warehouse_id">${opts(warehouses, doc.warehouse_id)}</select></label>` : ''}
      ${ty.targetWarehouse ? `<label class="field">${esc(t('Hedef depo'))}<select id="f-target_warehouse_id">${opts(warehouses, doc.target_warehouse_id)}</select></label>` : ''}
      ${ty.statuses ? `<label class="field">${esc(t('Durum'))}<select id="f-status">${ty.statuses.map((s) => `<option value="${esc(s)}" ${s === doc.status ? 'selected' : ''}>${esc(t(s))}</option>`).join('')}</select></label>` : ''}
      ${ty.account ? `<label class="field">${esc(t('Hesap'))}<select id="f-account">${META.accounts.map((a) => `<option value="${esc(a)}" ${a === doc.account ? 'selected' : ''}>${esc(t(a))}</option>`).join('')}</select></label>` : ''}
      ${ty.category ? `<label class="field">${esc(t('Kategori'))}<input id="f-category" list="cats" value="${esc(t(doc.category ?? ''))}"><datalist id="cats">${META.categories.map((c) => `<option value="${esc(t(c))}">`).join('')}</datalist></label>` : ''}
      ${!ty.lines ? `<label class="field">${esc(t('Tutar'))}<input id="f-sum" type="number" step="0.01" min="0" value="${esc(doc.sum ?? '')}"></label>` : ''}
      <label class="check" style="align-self:end;padding-bottom:6px"><input type="checkbox" id="f-posted" ${doc.posted ? 'checked' : ''}> ${esc(t('İşlendi (stok/bakiye etkiler)'))}</label>
      <label class="field wide">${esc(t('Açıklama'))}<textarea id="f-comment">${esc(doc.comment)}</textarea></label>
    </div>
    ${doc.linked?.filter((l) => l.id !== doc.id).length ? `<div class="linked" style="margin-top:10px"><span class="muted">${esc(t('Bağlı belgeler:'))} </span>${doc.linked.filter((l) => l.id !== doc.id).map((l) => `<a href="#/doc/${l.id}">${esc(t(dt(l.type).single))} №${esc(l.number)} (${money(l.sum)})</a>`).join('')}</div>` : ''}
    ${doc.fiscal?.length ? `<div style="margin-top:10px">${doc.fiscal.map((f) => `<div class="${f.status === 'done' ? '' : 'neg'}">🧾 ${esc(t(f.kind === 'sell' ? 'Satış fişi' : 'İade fişi'))}: ${f.status === 'done'
      ? `ФН ${esc(f.fn_number)} · ФД №${esc(f.fd_number)} · ФП ${esc(f.fpd)} · ${esc(f.fiscal_moment)}`
      : `${esc(t('kesilmedi'))} ${esc(f.error)}`}</div>`).join('')}</div>` : ''}
    ${id ? `<div class="muted" style="margin-top:8px;font-size:12px">${esc(t('Oluşturan:'))} ${esc(doc.author ?? '—')} · ${esc(doc.created_at)} · ${esc(t('Son değişiklik:'))} ${esc(doc.updated_at)}</div>` : ''}
  </div>
  ${ty.lines ? `<div class="card">
    <div id="picker" style="margin-bottom:10px"></div>
    <div class="table-wrap"><table class="lines"><thead><tr>
      <th style="width:36px">#</th><th>${esc(t('Ürün'))}</th>
      ${ty.inventory ? `<th class="num">${esc(t('Beklenen'))}</th><th class="num" style="width:110px">${esc(t('Sayılan'))}</th><th class="num">${esc(t('Fark'))}</th>` : `<th class="num" style="width:110px">${esc(t('Miktar'))}</th>`}
      <th>${esc(t('Birim'))}</th><th class="num" style="width:130px">${esc(t('Fiyat'))}</th><th class="num" style="width:110px">${esc(t('KDV %'))}</th><th class="num">${esc(t('KDV'))}</th><th class="num">${esc(t('Tutar'))}</th><th></th>
    </tr></thead><tbody id="lines"></tbody></table></div>
    <div class="doc-total" id="totals"></div>
  </div>` : ''}`;

  const field = (k) => $(`#f-${k}`);
  const lineSum = (l) => l.qty * l.price;
  const vatSelect = (v) => `<select data-k="vat">${VAT_RATES.map(([r, l]) => `<option value="${r}" ${Number(v) === r ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select>`;
  const renderTotals = () => {
    const total = doc.lines.reduce((s, l) => s + lineSum(l), 0);
    const vat = doc.lines.reduce((s, l) => s + vatOf(lineSum(l), l.vat), 0);
    $('#totals').innerHTML = `<span class="muted">${esc(t('Kalem: {0}', doc.lines.length))}</span><span>${esc(t('KDV dahil:'))} ${money(vat)}</span><span>${esc(t('Toplam:'))} <b>${money(total)}</b></span>`;
  };
  const renderLines = () => {
    $('#lines').innerHTML = doc.lines.length ? doc.lines.map((l, i) => `<tr data-i="${i}">
      <td class="muted">${i + 1}</td>
      <td><a href="#/products/${l.product_id}">${esc(l.product)}</a></td>
      ${ty.inventory
        ? `<td class="num">${qty(l.expected)}</td><td><input class="num" data-k="actual_qty" value="${l.actual_qty ?? ''}"></td><td class="num" data-diff>${signed(l.qty, qty)}</td>`
        : `<td><span style="display:flex;gap:4px"><input class="num" data-k="qty" value="${l.qty}" ${l.marking && l.codes?.length ? 'readonly' : ''}>${l.marking ? `<button data-codes title="${esc(t('Markalama kodları'))}">🏷 ${l.codes?.length ?? 0}</button>` : ''}</span></td>`}
      <td class="muted">${esc(l.unit)}</td>
      <td><input class="num" data-k="price" value="${l.price}"></td>
      <td>${vatSelect(l.vat)}</td>
      <td class="num" data-vat>${nf2.format(vatOf(lineSum(l), l.vat))}</td>
      <td class="num" data-sum>${nf2.format(lineSum(l))}</td>
      <td><button data-del title="${esc(t('Satırı sil'))}">✕</button></td></tr>`).join('')
      : `<tr><td colspan="10" class="empty">${esc(t('Ürün eklemek için yukarıdaki alana yazın veya barkod okutun'))}</td></tr>`;
    renderTotals();
  };
  if (ty.lines) {
    const onEdit = (e) => {
      const tr = e.target.closest('tr');
      if (!e.target.dataset.k || !tr) return;
      const l = doc.lines[Number(tr.dataset.i)];
      l[e.target.dataset.k] = num(e.target.value);
      if (ty.inventory) { l.qty = l.actual_qty - l.expected; $('[data-diff]', tr).innerHTML = signed(l.qty, qty); }
      $('[data-sum]', tr).textContent = nf2.format(lineSum(l));
      $('[data-vat]', tr).textContent = nf2.format(vatOf(lineSum(l), l.vat));
      renderTotals();
    };
    $('#lines').addEventListener('input', onEdit);
    $('#lines').addEventListener('change', onEdit);
    $('#lines').addEventListener('click', async (e) => {
      if (e.target.closest('[data-codes]')) {
        const l = doc.lines[Number(e.target.closest('tr').dataset.i)];
        const v = await modal(t('Markalama kodları: {0}', l.product),
          `<p class="muted">${esc(t('Her satıra bir DataMatrix kodu okutun.'))}</p><textarea name="codes" style="min-height:220px;font-family:monospace">${esc((l.codes ?? []).join('\n'))}</textarea>`,
          { onOk: (f) => f.codes.value.split('\n').map((x) => x.trim()).filter(Boolean) });
        if (!v) return;
        l.codes = v;
        if (v.length || type === 'retaildemand') l.qty = v.length;
        renderLines();
        return;
      }
      if (!e.target.closest('[data-del]')) return;
      doc.lines.splice(Number(e.target.closest('tr').dataset.i), 1);
      renderLines();
    });
    productPicker($('#picker'), async (p) => {
      const ex = doc.lines.find((l) => l.product_id === p.id);
      if (ex && !ty.inventory) { ex.qty += 1; renderLines(); return; }
      if (ex) return;
      const line = { product_id: p.id, product: p.name, unit: p.unit, qty: 1, price: p[ty.priceField] ?? 0, vat: p.vat, marking: p.marking, codes: [] };
      if (ty.inventory) {
        const whId = Number(field('warehouse_id').value);
        const stocks = await api(`/api/products/${p.id}/stock`);
        line.expected = stocks.find((s) => s.id === whId)?.stock ?? 0;
        line.actual_qty = line.expected;
        line.qty = 0;
      }
      doc.lines.push(line);
      renderLines();
    }, { onCode: async (raw) => {
      // DataMatrix okutuldu: ürünü GTIN'den bul, satıra kodu ekle.
      try {
        const st = await verifyCode(raw, null, { online: false });
        if (!st.product) throw new Error(t('Bu koda ait markalı ürün bulunamadı (GTIN {0})', st.gtin));
        if (['retaildemand', 'demand'].includes(type) && st.status === 'unknown') toast(t('Uyarı: kod bu sistemde stok girişi olarak kayıtlı değil'));
        let l = doc.lines.find((x) => x.product_id === st.product.id);
        if (!l) {
          const p = (await refs('products')).find((x) => x.id === st.product.id);
          l = { product_id: p.id, product: p.name, unit: p.unit, qty: 0, price: p[ty.priceField] ?? 0, vat: p.vat, marking: p.marking, codes: [] };
          doc.lines.push(l);
        }
        l.codes = l.codes ?? [];
        if (l.codes.includes(raw)) throw new Error(t('Kod belgede iki kez okutuldu: {0}', st.cis));
        l.codes.push(raw);
        l.qty = l.codes.length;
        renderLines();
      } catch (e) { fail(e); }
    } });
    renderLines();
  }

  const collect = () => ({
    type,
    base_id: doc.base_id,
    number: field('number').value,
    moment: field('moment').value,
    counterparty_id: field('counterparty_id')?.value,
    warehouse_id: field('warehouse_id')?.value,
    target_warehouse_id: field('target_warehouse_id')?.value,
    status: field('status')?.value,
    account: field('account')?.value,
    category: field('category')?.value,
    sum: field('sum')?.value,
    posted: field('posted').checked,
    comment: field('comment').value,
    lines: doc.lines,
  });
  $('#save').onclick = async () => {
    try {
      const saved = await api(id ? `/api/documents/${id}` : '/api/documents', { method: id ? 'PUT' : 'POST', body: collect() });
      toast(t('{0} №{1} kaydedildi', t(ty.single), saved.number));
      if (!id) history.replaceState(null, '', `#/doc/${saved.id}`);
      await viewDocForm({ id: saved.id });
    } catch (e) { fail(e); }
  };
  if (!id) return;
  $('#del').onclick = async () => {
    if (!(await confirmModal(t('{0} №{1} silinsin mi?', t(ty.single), doc.number)))) return;
    try { await api(`/api/documents/${id}`, { method: 'DELETE' }); toast(t('Belge silindi')); go(`#/docs/${type}`); } catch (e) { fail(e); }
  };
  $('#print').onclick = () => printDocument(doc);
  $('#copy').onclick = () => {
    const c = collect();
    delete c.number; delete c.base_id;
    sessionStorage.setItem('vordi-copy', JSON.stringify(c));
    go(`#/docs/${type}/new?copy=1`);
  };
  if ($('#derive')) $('#derive').onchange = (e) => e.target.value && go(`#/docs/${e.target.value}/new?from=${id}`);
  const fiscalBtn = async (kind) => {
    try { await fiscalize(id, kind); } catch (e) { fail(e); }
    await viewDocForm({ id });
  };
  if ($('#fiscal-sell')) $('#fiscal-sell').onclick = () => fiscalBtn('sell');
  if ($('#fiscal-return')) $('#fiscal-return').onclick = () => fiscalBtn('sellReturn');
}

function printDocument(doc) {
  const ty = dt(doc.type);
  const s = META.settings;
  const total = doc.lines.reduce((a, l) => a + l.qty * l.price, 0);
  const vat = doc.lines.reduce((a, l) => a + vatOf(l.qty * l.price, l.vat), 0);
  const w = window.open('', '_blank');
  if (!w) return toast(t('Açılır pencere engellendi'), true);
  w.document.write(`<!doctype html><html lang="${lang()}"><head><meta charset="utf-8"><title>${esc(t(ty.single))} ${esc(doc.number)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:13px;margin:30px;color:#000}table{border-collapse:collapse;width:100%;margin-top:14px}
  th,td{border:1px solid #444;padding:5px 7px}td.n,th.n{text-align:right}h1{font-size:18px}.row{display:flex;justify-content:space-between}
  .sign{margin-top:50px;display:flex;justify-content:space-between}</style></head><body>
  <div class="row"><div><b>${esc(s.company_name)}</b><br>${esc(s.company_address ?? '')}<br>${s.company_tax_no ? esc(t('VKN / TCKN')) + ': ' + esc(s.company_tax_no) : ''} ${s.company_kpp ? esc(t('Vergi dairesi')) + ': ' + esc(s.company_kpp) : ''}</div>
  <div style="text-align:right">${esc(String(doc.moment).replace('T', ' '))}</div></div>
  <h1>${esc(t(ty.single))} № ${esc(doc.number)}</h1>
  ${doc.counterparty ? `<div>${esc(t('Cari'))}: <b>${esc(doc.counterparty)}</b></div>` : ''}
  ${doc.warehouse ? `<div>${esc(doc.target_warehouse ? t('Kaynak depo') : t('Depo'))}: ${esc(doc.warehouse)}</div>` : ''}
  ${doc.target_warehouse ? `<div>${esc(t('Hedef depo'))}: ${esc(doc.target_warehouse)}</div>` : ''}
  ${ty.lines ? `<table><thead><tr><th>#</th><th>${esc(t('Ürün'))}</th><th>${esc(t('Kod'))}</th><th class="n">${esc(t('Miktar'))}</th><th>${esc(t('Birim'))}</th><th class="n">${esc(t('Fiyat'))}</th><th class="n">${esc(t('KDV %'))}</th><th class="n">${esc(t('Tutar'))}</th></tr></thead><tbody>
  ${doc.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.product)}</td><td>${esc(l.code)}</td><td class="n">${qty(l.qty)}</td><td>${esc(l.unit)}</td><td class="n">${nf2.format(l.price)}</td><td class="n">${esc(vatLabel(l.vat))}</td><td class="n">${nf2.format(l.qty * l.price)}</td></tr>`).join('')}
  </tbody></table><p style="text-align:right">${esc(t('KDV dahil:'))} ${money(vat)}<br><b>${esc(t('Toplam:'))} ${money(total)}</b></p>`
    : `<p style="font-size:16px">${esc(t('Tutar'))}: <b>${money(doc.sum)}</b> (${esc(t(doc.account))})</p>`}
  ${doc.comment ? `<p>${esc(t('Açıklama'))}: ${esc(doc.comment)}</p>` : ''}
  <div class="sign"><div>${esc(t('Teslim eden'))}: ____________</div><div>${esc(t('Teslim alan'))}: ____________</div></div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------- Ürünler ----------
const productFields = (groups) => [
  { key: 'name', label: t('Ad'), required: true, wide: true },
  { key: 'code', label: t('Kod') },
  { key: 'article', label: t('Stok kodu (SKU)') },
  { key: 'barcode', label: t('Barkod') },
  { key: 'unit', label: t('Birim'), default: t('adet'), list: 'units' },
  { key: 'group_id', label: t('Grup'), type: 'select', options: [['', t('— grupsuz —')], ...groups.map((g) => [g.id, g.name])] },
  { key: 'buy_price', label: t('Alış fiyatı'), type: 'number', default: 0 },
  { key: 'sale_price', label: t('Satış fiyatı'), type: 'number', default: 0 },
  { key: 'vat', label: t('KDV %'), type: 'select', options: VAT_RATES.map(([r, l]) => [r, t(l)]), default: Number(META.settings.default_vat ?? 22) },
  { key: 'min_stock', label: t('Minimum stok'), type: 'number', default: 0 },
  { key: 'marking', label: t('Markalama (Честный знак)'), type: 'select', options: META.markingTypes.map((m) => [m, t(MARKING_LABEL[m])]) },
  { key: 'is_service', label: t('Hizmet (stok takibi yok)'), type: 'checkbox' },
  { key: 'description', label: t('Açıklama'), type: 'textarea' },
];
const unitsDatalist = () => `<datalist id="units">${['adet', 'kg', 'g', 'lt', 'm', 'paket', 'koli', 'hizmet'].map((u) => `<option value="${esc(t(u))}">`).join('')}</datalist>`;

async function viewProducts(query) {
  const groupId = query.get('group') ?? '';
  const archived = query.get('archived') === '1';
  const [groups, stock] = await Promise.all([refs('product_groups', true), api('/api/reports/stock')]);
  const all = await api(`/api/products?${qs({ archived: archived ? '1' : '0' })}`);
  const stockMap = new Map(stock.map((s) => [s.id, s]));
  let q = '';
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Ürünler ve hizmetler'))}</h1><div class="spacer"></div>
    <button id="import">${esc(t('CSV içe aktar'))}</button><button id="csv">${esc(t('CSV indir'))}</button>
    <a class="btn primary" href="#/products/new">+ ${esc(t('Ürün'))}</a></div>
  <div class="with-side">
    <div class="card side">
      <a href="#/products" class="${!groupId && !archived ? 'active' : ''}">${esc(t('Tüm ürünler'))}</a>
      ${groups.map((g) => `<a href="#/products?group=${g.id}" class="${String(g.id) === groupId ? 'active' : ''}">${esc(g.name)}</a>`).join('')}
      <a href="#/products?archived=1" class="${archived ? 'active' : ''} muted">${esc(t('Arşiv'))}</a>
      <div style="margin-top:10px;display:flex;gap:6px"><button id="addg">+ ${esc(t('Grup'))}</button>${groupId ? `<button id="editg">${esc(t('Düzenle'))}</button>` : ''}</div>
    </div>
    <div><div class="toolbar"><input id="q" placeholder="${esc(t('Ara: ad, kod, barkod'))}" style="width:300px"></div><div id="list"></div></div>
  </div>`;
  const cols = [
    { key: 'name', title: t('Ad') },
    { key: 'code', title: t('Kod') },
    { key: 'article', title: 'SKU' },
    { key: 'barcode', title: t('Barkod') },
    { key: 'group_name', title: t('Grup') },
    { key: 'unit', title: t('Birim') },
    { key: 'buy_price', title: t('Alış fiyatı'), num: true, fmt: money },
    { key: 'sale_price', title: t('Satış fiyatı'), num: true, fmt: money },
    { key: 'stock', title: t('Stok'), num: true, fmt: (v, r) => (r.is_service ? `<span class="muted">${esc(t('hizmet'))}</span>` : `<span class="${v < 0 || (r.min_stock > 0 && v < r.min_stock) ? 'neg' : ''}">${qty(v)}</span>`) },
  ];
  let rows = [];
  const lc = (v) => String(v).toLocaleLowerCase(locale());
  const render = () => {
    const s = lc(q);
    rows = all.filter((p) => (!groupId || String(p.group_id) === groupId) && (!s || [p.name, p.code, p.article, p.barcode].some((v) => lc(v).includes(s))))
      .map((p) => ({ ...p, stock: stockMap.get(p.id)?.stock ?? 0 }));
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, empty: t('Ürün yok'), footer: false });
    bindRows($('#list'), rows, (r) => go(`#/products/${r.id}`));
  };
  $('#q').oninput = (e) => { q = e.target.value; render(); };
  $('#csv').onclick = () => downloadCsv('products', [...cols, { key: 'vat', title: t('KDV %') }, { key: 'min_stock', title: t('Min. stok') }], rows);
  $('#addg').onclick = async () => {
    const v = await formModal(t('Yeni grup'), [{ key: 'name', label: t('Grup adı'), required: true }]);
    if (!v) return;
    try { const g = await api('/api/product_groups', { method: 'POST', body: v }); dropRefs('product_groups'); go(`#/products?group=${g.id}`); } catch (e) { fail(e); }
  };
  if ($('#editg')) $('#editg').onclick = async () => {
    const g = groups.find((x) => String(x.id) === groupId);
    const v = await modal(t('Grubu düzenle'), formHtml([{ key: 'name', label: t('Grup adı'), required: true }], g) + `<label class="check" style="margin-top:10px"><input type="checkbox" name="del"> ${esc(t('Grubu sil (ürünler grupsuz kalır)'))}</label>`, {
      onOk: (f) => ({ name: f.name.value, del: f.del.checked }),
    });
    if (!v) return;
    try {
      if (v.del) { await api(`/api/product_groups/${g.id}`, { method: 'DELETE' }); go('#/products'); } else { await api(`/api/product_groups/${g.id}`, { method: 'PUT', body: { name: v.name } }); router(); }
      dropRefs('product_groups', 'products');
    } catch (e) { fail(e); }
  };
  $('#import').onclick = importProductsDialog;
  render();
}

async function importProductsDialog() {
  const res = await modal(t('Ürünleri CSV ile içe aktar'), `
    <p class="muted">${esc(t('İlk satır başlık olmalıdır. Sütunlar: name, code, article, barcode, unit, group, buy_price, sale_price, vat, min_stock. Aynı kod/SKU/barkoda sahip ürünler güncellenir.'))}</p>
    <input type="file" name="file" accept=".csv,text/csv" required>`, {
    okText: t('İçe aktar'),
    onOk: async (f) => {
      const text = await f.file.files[0].text();
      const [head, ...data] = parseCsv(text.replace(/^﻿/, ''));
      const alias = {
        ad: 'name', kod: 'code', sku: 'article', barkod: 'barcode', birim: 'unit', grup: 'group', alış: 'buy_price', satış: 'sale_price', kdv: 'vat', 'min. stok': 'min_stock',
        наименование: 'name', код: 'code', артикул: 'article', штрихкод: 'barcode', 'ед. изм.': 'unit', группа: 'group', 'закупочная цена': 'buy_price', 'цена продажи': 'sale_price', ндс: 'vat',
      };
      const keys = head.map((h) => { const k = h.trim().toLocaleLowerCase(locale()); return alias[k] ?? k; });
      const rows = data.map((r) => Object.fromEntries(keys.map((k, i) => [k, ['buy_price', 'sale_price', 'vat', 'min_stock'].includes(k) ? num(String(r[i] ?? '').replace(/\s/g, '')) : (r[i] ?? '').trim()])));
      return api('/api/products/import', { method: 'POST', body: { rows } });
    },
  });
  if (res) { toast(t('{0} ürün eklendi, {1} ürün güncellendi', res.created, res.updated)); dropRefs('products', 'product_groups'); router(); }
}

async function viewProductForm(id) {
  const isNew = id === 'new';
  const groups = await refs('product_groups', true);
  const p = isNew ? {} : await api(`/api/products/${id}`);
  const fields = productFields(groups);
  $('#main').innerHTML = `
  <div class="page-head"><a href="#/products" class="muted">← ${esc(t('Ürünler'))}</a><h1>${isNew ? esc(t('Yeni ürün')) : esc(p.name)}</h1>
    ${p.archived ? `<span class="badge off">${esc(t('Arşivde'))}</span>` : ''}<div class="spacer"></div>
    ${isNew ? '' : `<button id="del" class="danger">${esc(p.archived ? t('Arşivden çıkar') : t('Sil / Arşivle'))}</button>`}
    <button id="save" class="primary">${esc(t('Kaydet'))}</button></div>
  <div class="card" id="form">${formHtml(fields, p)}${unitsDatalist()}</div>
  ${isNew ? '' : `<div class="grid cols-2" style="margin-top:12px"><div><h2>${esc(t('Depolardaki stok'))}</h2><div id="stocks"></div></div><div><h2>${esc(t('Stok hareketleri'))}</h2><div id="moves"></div></div></div>`}`;
  $('#save').onclick = async () => {
    try {
      const body = readForm($('#form'), fields);
      const saved = await api(isNew ? '/api/products' : `/api/products/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      dropRefs('products');
      toast(t('Ürün kaydedildi'));
      if (isNew) go(`#/products/${saved.id}`); else router();
    } catch (e) { fail(e); }
  };
  if (isNew) return;
  $('#del').onclick = async () => {
    try {
      if (p.archived) { await api(`/api/products/${id}`, { method: 'PUT', body: { archived: 0 } }); dropRefs('products'); return router(); }
      if (!(await confirmModal(t('Ürün silinsin mi? Belgelerde kullanılmışsa arşive alınır.')))) return;
      const r = await api(`/api/products/${id}`, { method: 'DELETE' });
      dropRefs('products');
      toast(r.archived ? t('Ürün belgelerde kullanıldığı için arşive alındı') : t('Ürün silindi'));
      go('#/products');
    } catch (e) { fail(e); }
  };
  const [stocks, moves] = await Promise.all([api(`/api/products/${id}/stock`), api(`/api/products/${id}/moves`)]);
  $('#stocks').innerHTML = tableHtml([
    { key: 'name', title: t('Depo') }, { key: 'stock', title: t('Stok'), num: true, fmt: (v) => signed(v, qty), total: true },
  ], stocks);
  $('#moves').innerHTML = tableHtml([
    { key: 'moment', title: t('Zaman'), nowrap: true },
    { key: 'type', title: t('Belge'), fmt: (v, r) => `<a href="#/doc/${r.doc_id}">${esc(t(dt(v).single))} №${esc(r.number)}</a>` },
    { key: 'warehouse', title: t('Depo') },
    { key: 'qty', title: t('Miktar'), num: true, fmt: (v) => `<span class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${qty(v)}</span>` },
  ], moves, { empty: t('Hareket yok'), footer: false });
}

// ---------- Cariler ----------
const ROLE_LABEL = { customer: 'Müşteri', supplier: 'Tedarikçi', '': '—' };
const cpFields = () => [
  { key: 'name', label: t('Ad / Unvan'), required: true, wide: true },
  { key: 'kind', label: t('Tür'), type: 'select', options: [['legal', t('Tüzel kişi')], ['person', t('Şahıs')]] },
  { key: 'roles', label: t('Rol'), type: 'select', options: [['', '—'], ['customer', t('Müşteri')], ['supplier', t('Tedarikçi')]] },
  { key: 'tax_no', label: t('VKN / TCKN') },
  { key: 'tax_office', label: t('Vergi dairesi') },
  { key: 'phone', label: t('Telefon') },
  { key: 'email', label: t('E-posta'), type: 'email' },
  { key: 'address', label: t('Adres'), type: 'textarea' },
  { key: 'comment', label: t('Not'), type: 'textarea' },
];

async function viewCounterparties() {
  const [all, settle] = await Promise.all([api('/api/counterparties'), api('/api/reports/settlements')]);
  const bal = new Map(settle.map((s) => [s.id, s.balance]));
  let q = '';
  let role = '';
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Cariler'))}</h1><div class="spacer"></div><button id="csv">${esc(t('CSV indir'))}</button><a class="btn primary" href="#/counterparties/new">+ ${esc(t('Cari'))}</a></div>
  <div class="toolbar"><input id="q" placeholder="${esc(t('Ara: ad, VKN, telefon'))}" style="width:280px">
    <select id="role"><option value="">${esc(t('Tüm roller'))}</option><option value="customer">${esc(t('Müşteriler'))}</option><option value="supplier">${esc(t('Tedarikçiler'))}</option></select></div>
  <div id="list"></div>`;
  const cols = [
    { key: 'name', title: t('Ad / Unvan') },
    { key: 'roles', title: t('Rol'), fmt: (v) => esc(t(ROLE_LABEL[v] ?? v)) },
    { key: 'tax_no', title: t('VKN / TCKN') },
    { key: 'phone', title: t('Telefon') },
    { key: 'email', title: t('E-posta') },
    { key: 'balance', title: t('Bakiye'), num: true, fmt: (v) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${money(v)}</span>` },
  ];
  let rows = [];
  const lc = (v) => String(v).toLocaleLowerCase(locale());
  const render = () => {
    const s = lc(q);
    rows = all.filter((c) => (!role || c.roles === role) && (!s || [c.name, c.tax_no, c.phone, c.email].some((v) => lc(v).includes(s))))
      .map((c) => ({ ...c, balance: bal.get(c.id) ?? 0 }));
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, footer: false });
    bindRows($('#list'), rows, (r) => go(`#/counterparties/${r.id}`));
  };
  $('#q').oninput = (e) => { q = e.target.value; render(); };
  $('#role').onchange = (e) => { role = e.target.value; render(); };
  $('#csv').onclick = () => downloadCsv('counterparties', cols, rows);
  render();
}

async function viewCounterpartyForm(id) {
  const isNew = id === 'new';
  const c = isNew ? { kind: 'legal' } : await api(`/api/counterparties/${id}`);
  const fields = cpFields();
  $('#main').innerHTML = `
  <div class="page-head"><a href="#/counterparties" class="muted">← ${esc(t('Cariler'))}</a><h1>${isNew ? esc(t('Yeni cari')) : esc(c.name)}</h1><div class="spacer"></div>
    ${isNew ? '' : `<button id="del" class="danger">${esc(t('Sil / Arşivle'))}</button>`}<button id="save" class="primary">${esc(t('Kaydet'))}</button></div>
  <div class="card" id="form">${formHtml(fields, c)}</div>
  ${isNew ? '' : `<div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">${esc(t('Hesap ekstresi'))}</h2><div class="spacer"></div>
    <a class="btn" href="#/docs/paymentin/new">+ ${esc(t('Gelen ödeme'))}</a><a class="btn" href="#/docs/paymentout/new">+ ${esc(t('Giden ödeme'))}</a></div><div id="statement"></div></div>`}`;
  $('#save').onclick = async () => {
    try {
      const saved = await api(isNew ? '/api/counterparties' : `/api/counterparties/${id}`, { method: isNew ? 'POST' : 'PUT', body: readForm($('#form'), fields) });
      dropRefs('counterparties');
      toast(t('Cari kaydedildi'));
      if (isNew) go(`#/counterparties/${saved.id}`); else router();
    } catch (e) { fail(e); }
  };
  if (isNew) return;
  $('#del').onclick = async () => {
    if (!(await confirmModal(t('Cari silinsin mi? Belgelerde kullanılmışsa arşive alınır.')))) return;
    try {
      const r = await api(`/api/counterparties/${id}`, { method: 'DELETE' });
      dropRefs('counterparties');
      toast(r.archived ? t('Cari arşive alındı') : t('Cari silindi'));
      go('#/counterparties');
    } catch (e) { fail(e); }
  };
  const st = await api(`/api/counterparties/${id}/statement`);
  const last = st.at(-1)?.balance ?? 0;
  $('#statement').innerHTML = `<p>${esc(t('Güncel bakiye:'))} <b class="${last > 0 ? 'pos' : last < 0 ? 'neg' : ''}">${money(Math.abs(last))}</b>
    <span class="muted">${last > 0 ? esc(t('(cari bize borçlu)')) : last < 0 ? esc(t('(biz cariye borçluyuz)')) : ''}</span></p>` + tableHtml([
    { key: 'moment', title: t('Zaman'), nowrap: true },
    { key: 'type', title: t('Belge'), fmt: (v, r) => `<a href="#/doc/${r.id}">${esc(t(dt(v).single))} №${esc(r.number)}</a>` },
    { key: 'effect', title: t('Borç (bize)'), num: true, fmt: (v) => (v > 0 ? money(v) : '') },
    { key: 'effect', title: t('Alacak (cariye)'), num: true, fmt: (v) => (v < 0 ? money(-v) : '') },
    { key: 'balance', title: t('Bakiye'), num: true, fmt: (v) => signed(v) },
  ], st, { empty: t('Hareket yok'), footer: false });
}

// ---------- Depolar ----------
async function viewWarehouses() {
  const rows = await api('/api/warehouses?archived=all');
  const fields = [{ key: 'name', label: t('Depo adı'), required: true, wide: true }, { key: 'address', label: t('Adres'), type: 'textarea' }, { key: 'archived', label: t('Arşivde'), type: 'checkbox' }];
  $('#main').innerHTML = `<div class="page-head"><h1>${esc(t('Depolar'))}</h1><div class="spacer"></div><button id="add" class="primary">+ ${esc(t('Depo'))}</button></div><div id="list"></div>`;
  $('#list').innerHTML = tableHtml([
    { key: 'name', title: t('Ad') }, { key: 'address', title: t('Adres') },
    { key: 'archived', title: t('Durum'), fmt: (v) => (v ? `<span class="badge off">${esc(t('Arşivde'))}</span>` : `<span class="badge ok">${esc(t('Aktif'))}</span>`) },
  ], rows, { click: true, footer: false });
  const edit = async (w) => {
    const v = await formModal(w ? t('Depoyu düzenle') : t('Yeni depo'), fields, w ?? {});
    if (!v) return;
    try {
      await api(w ? `/api/warehouses/${w.id}` : '/api/warehouses', { method: w ? 'PUT' : 'POST', body: v });
      dropRefs('warehouses');
      router();
    } catch (e) { fail(e); }
  };
  bindRows($('#list'), rows, edit);
  $('#add').onclick = () => edit(null);
}

// ---------- Raporlar ----------
async function warehouseSelect(sel = '') {
  const ws = await refs('warehouses');
  return `<select id="wh"><option value="">${esc(t('Tüm depolar'))}</option>${ws.filter((w) => !w.archived).map((w) => `<option value="${w.id}" ${String(w.id) === String(sel) ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>`;
}

async function viewStock() {
  const st = { warehouse_id: '', group_id: '', q: '', only: '' };
  const groups = await refs('product_groups');
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Stok bakiyeleri'))}</h1><div class="spacer"></div><button id="csv">${esc(t('CSV indir'))}</button><a class="btn" href="#/docs/inventory/new">+ ${esc(t('Sayım'))}</a></div>
  <div class="toolbar">${await warehouseSelect()}
    <select id="grp"><option value="">${esc(t('Tüm gruplar'))}</option>${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
    <select id="only"><option value="">${esc(t('Tümü'))}</option><option value="positive">${esc(t('Stokta olanlar'))}</option><option value="low">${esc(t('Minimumun altında'))}</option><option value="negative">${esc(t('Eksi stok'))}</option></select>
    <input id="q" placeholder="${esc(t('Ara'))}" style="width:220px"></div>
  <div id="list"></div>`;
  const cols = [
    { key: 'name', title: t('Ürün'), fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
    { key: 'code', title: t('Kod') },
    { key: 'unit', title: t('Birim') },
    { key: 'stock', title: t('Stok'), num: true, fmt: (v, r) => `<span class="${v < 0 || (r.min_stock > 0 && v < r.min_stock) ? 'neg' : ''}">${qty(v)}</span>`, total: true },
    { key: 'reserve', title: t('Rezerv'), num: true, fmt: qty, total: true },
    { key: 'expected', title: t('Beklenen'), num: true, fmt: qty, total: true },
    { key: 'available', title: t('Kullanılabilir'), num: true, fmt: (v) => signed(v, qty), total: true },
    { key: 'cost', title: t('Birim maliyet'), num: true, fmt: money },
    { key: 'stock_cost', title: t('Maliyet tutarı'), num: true, fmt: money, total: true },
    { key: 'sale_price', title: t('Satış fiyatı'), num: true, fmt: money },
    { key: 'stock_retail', title: t('Satış tutarı'), num: true, fmt: money, total: true },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/reports/stock?${qs(st)}`);
    $('#list').innerHTML = tableHtml(cols, rows, { empty: t('Ürün yok') });
  };
  let timer;
  $('#wh').onchange = (e) => { st.warehouse_id = e.target.value; load(); };
  $('#grp').onchange = (e) => { st.group_id = e.target.value; load(); };
  $('#only').onchange = (e) => { st.only = e.target.value; load(); };
  $('#q').oninput = (e) => { st.q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#csv').onclick = () => downloadCsv('stock', cols, rows);
  await load();
}

function periodBar(st) {
  return `<label class="muted">${esc(t('Başlangıç'))} <input type="date" id="from" value="${st.from}"></label>
    <label class="muted">${esc(t('Bitiş'))} <input type="date" id="to" value="${st.to}"></label>`;
}

async function viewTurnover() {
  const st = { from: monthStart(), to: today(), warehouse_id: '' };
  $('#main').innerHTML = `<div class="page-head"><h1>${esc(t('Stok hareketleri'))}</h1><div class="spacer"></div><button id="csv">${esc(t('CSV indir'))}</button></div>
    <div class="toolbar">${periodBar(st)}${await warehouseSelect()}</div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: t('Ürün'), fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
    { key: 'code', title: t('Kod') }, { key: 'unit', title: t('Birim') },
    { key: 'opening', title: t('Dönem başı'), num: true, fmt: qty, total: true },
    { key: 'incoming', title: t('Giren'), num: true, fmt: qty, total: true },
    { key: 'outgoing', title: t('Çıkan'), num: true, fmt: qty, total: true },
    { key: 'closing', title: t('Dönem sonu'), num: true, fmt: (v) => signed(v, qty), total: true },
  ];
  let rows = [];
  const load = async () => { rows = await api(`/api/reports/turnover?${qs(st)}`); $('#list').innerHTML = tableHtml(cols, rows, { empty: t('Bu dönemde hareket yok') }); };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  $('#wh').onchange = (e) => { st.warehouse_id = e.target.value; load(); };
  $('#csv').onclick = () => downloadCsv('turnover', cols, rows);
  await load();
}

async function viewProfit() {
  const st = { from: monthStart(), to: today(), by: 'product' };
  $('#main').innerHTML = `<div class="page-head"><h1>${esc(t('Kârlılık'))}</h1><div class="spacer"></div><button id="csv">${esc(t('CSV indir'))}</button></div>
    <div class="toolbar">${periodBar(st)}<div class="tabs" style="margin:0"><button data-by="product" class="active">${esc(t('Ürünlere göre'))}</button><button data-by="counterparty">${esc(t('Carilere göre'))}</button></div></div>
    <div id="sum" class="kpis"></div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: t('Ad'), fmt: (v) => esc(t(v)) },
    { key: 'qty', title: t('Satılan miktar'), num: true, fmt: qty, total: true },
    { key: 'revenue', title: t('Ciro'), num: true, fmt: money, total: true },
    { key: 'cost', title: t('Maliyet'), num: true, fmt: money, total: true },
    { key: 'profit', title: t('Brüt kâr'), num: true, fmt: (v) => signed(v), total: true },
    { key: 'margin', title: t('Marj %'), num: true, fmt: (v) => `${nf2.format(v)} %` },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/reports/profit?${qs(st)}`);
    const rev = rows.reduce((s, r) => s + r.revenue, 0);
    const pr = rows.reduce((s, r) => s + r.profit, 0);
    $('#sum').innerHTML = `<div class="card kpi"><div class="label">${esc(t('Ciro'))}</div><div class="value">${money(rev)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Maliyet'))}</div><div class="value">${money(rev - pr)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Brüt kâr'))}</div><div class="value">${signed(pr)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Marj'))}</div><div class="value">${nf2.format(rev ? (pr / rev) * 100 : 0)} %</div></div>`;
    $('#list').innerHTML = tableHtml(cols, rows, { empty: t('Bu dönemde satış yok') });
  };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  $$('[data-by]').forEach((b) => (b.onclick = () => {
    st.by = b.dataset.by;
    $$('[data-by]').forEach((x) => x.classList.toggle('active', x === b));
    load();
  }));
  $('#csv').onclick = () => downloadCsv('profit', cols, rows);
  await load();
}

async function viewSettlements() {
  let q = '';
  $('#main').innerHTML = `<div class="page-head"><h1>${esc(t('Cari hesaplar'))}</h1><div class="spacer"></div><button id="csv">${esc(t('CSV indir'))}</button></div>
    <div class="toolbar"><input id="q" placeholder="${esc(t('Cari ara'))}" style="width:260px"></div><div id="sum" class="kpis"></div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: t('Cari') },
    { key: 'phone', title: t('Telefon') },
    { key: 'receivable', title: t('Alacağımız'), num: true, fmt: (v) => (v ? `<span class="pos">${money(v)}</span>` : ''), total: true },
    { key: 'payable', title: t('Borcumuz'), num: true, fmt: (v) => (v ? `<span class="neg">${money(v)}</span>` : ''), total: true },
    { key: 'last_moment', title: t('Son işlem'), nowrap: true },
  ];
  let rows = [];
  const load = async () => {
    rows = (await api(`/api/reports/settlements?${qs({ q })}`)).map((r) => ({ ...r, receivable: Math.max(r.balance, 0), payable: Math.max(-r.balance, 0) }));
    const rec = rows.reduce((s, r) => s + r.receivable, 0);
    const pay = rows.reduce((s, r) => s + r.payable, 0);
    $('#sum').innerHTML = `<div class="card kpi"><div class="label">${esc(t('Toplam alacak'))}</div><div class="value pos">${money(rec)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Toplam borç'))}</div><div class="value neg">${money(pay)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Net'))}</div><div class="value">${signed(rec - pay)}</div></div>`;
    $('#list').innerHTML = tableHtml(cols, rows, { click: true });
    bindRows($('#list'), rows, (r) => go(`#/counterparties/${r.id}`));
  };
  let timer;
  $('#q').oninput = (e) => { q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#csv').onclick = () => downloadCsv('settlements', cols, rows);
  await load();
}

async function viewMoney() {
  const st = { from: monthStart(), to: today() };
  $('#main').innerHTML = `<div class="page-head"><h1>${esc(t('Kasa ve banka'))}</h1><div class="spacer"></div>
    <a class="btn" href="#/docs/paymentin/new">+ ${esc(t('Gelen ödeme'))}</a><a class="btn" href="#/docs/paymentout/new">+ ${esc(t('Giden ödeme'))}</a></div>
    <div class="toolbar">${periodBar(st)}</div><div id="out"></div>`;
  const load = async () => {
    const m = await api(`/api/reports/money?${qs(st)}`);
    $('#out').innerHTML = `<div class="kpis">
      ${m.accounts.map((a) => `<div class="card kpi"><div class="label">${esc(t('{0} (dönem sonu)', t(a.account)))}</div><div class="value">${signed(a.balance)}</div></div>`).join('')}
      <div class="card kpi"><div class="label">${esc(t('Dönem girişleri'))}</div><div class="value pos">${money(m.income)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Dönem çıkışları'))}</div><div class="value neg">${money(m.expense)}</div></div>
      <div class="card kpi"><div class="label">${esc(t('Net nakit akışı'))}</div><div class="value">${signed(m.income - m.expense)}</div></div></div>
      <h2>${esc(t('Kategorilere göre'))}</h2>${tableHtml([{ key: 'category', title: t('Kategori'), fmt: (v) => esc(t(v)) }, { key: 'amount', title: t('Tutar'), num: true, fmt: (v) => signed(v), total: true }], m.byCategory, { empty: t('Bu dönemde hareket yok') })}`;
  };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  await load();
}

// ---------- Perakende kasa (POS) ----------
async function viewPos() {
  const [products, warehouses, stock] = await Promise.all([refs('products', true), refs('warehouses'), api('/api/reports/stock')]);
  const stockMap = new Map(stock.map((s) => [s.id, s.stock]));
  const active = products.filter((p) => !p.archived);
  const cart = [];
  const fiscalOn = META.settings.fiscal_mode !== 'off';
  let filter = '';
  let wh;
  try { wh = Number(localStorage.getItem('vordi-pos-wh')); } catch { /* yok say */ }
  if (!warehouses.some((w) => w.id === wh && !w.archived)) wh = warehouses.find((w) => !w.archived)?.id;
  $('#main').innerHTML = `
  <div class="pos-screen">
    <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
      <div class="toolbar" style="margin:0"><div id="picker" style="flex:1;min-width:200px"></div>
        <select id="pos-wh">${warehouses.filter((w) => !w.archived).map((w) => `<option value="${w.id}" ${w.id === wh ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
      ${fiscalOn ? `<div class="toolbar" style="margin:0"><span class="badge ${META.settings.fiscal_mode === 'test' ? 'warn' : 'ok'}">${esc(t('Kasa'))}: ${esc(META.settings.fiscal_mode === 'test' ? t('test modu') : 'АТОЛ')}</span>
        ${Object.entries(SHIFT_LABEL).map(([k, l]) => `<button data-shift="${k}">${esc(t(l))}</button>`).join('')}</div>` : ''}
      <input id="tile-filter" placeholder="${esc(t('Ürünleri filtrele'))}">
      <div class="tiles" id="tiles"></div>
    </div>
    <div class="card cart">
      <h2>${esc(t('Sepet'))}</h2>
      <div class="items" id="cart"></div>
      <div class="total" id="total"></div>
      <div style="display:flex;gap:8px"><button class="big" id="clear" style="flex:0">${esc(t('Temizle'))}</button>
        <button class="big primary" id="cash" style="flex:1;justify-content:center">${esc(t('Nakit'))}</button>
        <button class="big primary" id="card" style="flex:1;justify-content:center">${esc(t('Kart'))}</button></div>
    </div>
  </div>`;
  const lineOf = (p) => {
    let l = cart.find((x) => x.product_id === p.id);
    if (!l) { l = { product_id: p.id, product: p.name, unit: p.unit, qty: 0, price: p.sale_price, vat: p.vat, marking: p.marking, codes: [], cis: [] }; cart.push(l); }
    return l;
  };
  // Markalı ürün: her adet için DataMatrix okutulur ve satıştan önce kontrol edilir.
  const addCode = async (p, raw) => {
    const st = await verifyCode(raw, p.id);
    if (cart.some((l) => l.cis.includes(st.cis))) throw new Error(t('Kod belgede iki kez okutuldu: {0}', st.cis));
    const l = lineOf(p);
    l.codes.push(raw);
    l.cis.push(st.cis);
    l.qty = l.codes.length;
    renderCart();
  };
  const add = async (p) => {
    if (p.marking) {
      const raw = await scanCodeModal(p.name);
      if (!raw) return;
      try { await addCode(p, raw); } catch (e) { fail(e); }
      return;
    }
    lineOf(p).qty += 1;
    renderCart();
  };
  const onCode = async (raw) => {
    try {
      const st = await api(`/api/marking/status?code=${encodeURIComponent(raw)}`);
      const p = st.product && active.find((x) => x.id === st.product.id);
      if (!p) throw new Error(t('Bu koda ait markalı ürün bulunamadı (GTIN {0})', st.gtin));
      await addCode(p, raw);
    } catch (e) { fail(e); }
  };
  const lc = (v) => String(v).toLocaleLowerCase(locale());
  const renderTiles = () => {
    const s = lc(filter);
    const list = active.filter((p) => !s || lc(p.name).includes(s) || p.barcode.includes(s)).slice(0, 120);
    $('#tiles').innerHTML = list.map((p) => `<button class="tile" data-id="${p.id}"><span>${esc(p.name)}</span>
      <span style="display:flex;justify-content:space-between;width:100%"><span class="price">${money(p.sale_price)}</span>${p.is_service ? '' : `<span class="muted">${qty(stockMap.get(p.id) ?? 0)}</span>`}</span></button>`).join('');
  };
  const total = () => cart.reduce((s, l) => s + l.qty * l.price, 0);
  const renderCart = () => {
    $('#cart').innerHTML = cart.length ? `<table><tbody>${cart.map((l, i) => `<tr data-i="${i}"><td>${esc(l.product)}<div class="muted">${money(l.price)}</div></td>
      <td>${l.marking ? `<span class="qty-ctl"><button data-d="-1">−</button><span class="badge">🏷 ${l.qty}</span></span>`
        : `<span class="qty-ctl"><button data-d="-1">−</button><input value="${l.qty}" data-q><button data-d="1">+</button></span>`}</td>
      <td class="num">${money(l.qty * l.price)}</td><td><button data-x>✕</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">${esc(t('Sepet boş — ürün seçin veya barkod okutun'))}</div>`;
    $('#total').textContent = money(total());
  };
  $('#tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (b) add(active.find((p) => p.id === Number(b.dataset.id))); };
  $('#cart').onclick = (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const i = Number(tr.dataset.i);
    if (e.target.dataset.d && cart[i].marking) { cart[i].codes.pop(); cart[i].cis.pop(); cart[i].qty = cart[i].codes.length; if (!cart[i].qty) cart.splice(i, 1); renderCart(); return; }
    if (e.target.dataset.d) { cart[i].qty = Math.max(cart[i].qty + Number(e.target.dataset.d), 0); if (!cart[i].qty) cart.splice(i, 1); renderCart(); }
    if (e.target.dataset.x !== undefined) { cart.splice(i, 1); renderCart(); }
  };
  $('#cart').onchange = (e) => {
    if (e.target.dataset.q === undefined) return;
    const i = Number(e.target.closest('tr').dataset.i);
    cart[i].qty = num(e.target.value);
    if (cart[i].qty <= 0) cart.splice(i, 1);
    renderCart();
  };
  $('#tile-filter').oninput = (e) => { filter = e.target.value; renderTiles(); };
  $('#pos-wh').onchange = (e) => { wh = Number(e.target.value); try { localStorage.setItem('vordi-pos-wh', wh); } catch { /* yok say */ } };
  $('#clear').onclick = () => { cart.length = 0; renderCart(); };
  $$('[data-shift]').forEach((b) => (b.onclick = () => shiftAction(b.dataset.shift)));
  let busy = false;
  const pay = async (account) => {
    if (!cart.length) return toast(t('Sepet boş'), true);
    if (busy) return;
    busy = true;
    try {
      const doc = await api('/api/documents', { method: 'POST', body: {
        type: 'retaildemand', moment: nowLocal(), warehouse_id: wh, account, counterparty_id: Number(META.settings.retail_counterparty_id) || null, lines: cart,
      } });
      toast(t('Satış №{0} tamamlandı: {1}', doc.number, money(doc.sum)));
      for (const l of cart) stockMap.set(l.product_id, (stockMap.get(l.product_id) ?? 0) - l.qty);
      cart.length = 0;
      renderCart(); renderTiles();
      if (fiscalOn) {
        try { await fiscalize(doc.id, 'sell'); } catch (e) { toast(t('Satış kaydedildi ama fiş kesilemedi. Belgeden tekrar deneyin: {0}', e.message), true); }
      }
      $('#picker input').focus();
    } catch (e) { fail(e); } finally { busy = false; }
  };
  $('#cash').onclick = () => pay('Kasa');
  $('#card').onclick = () => pay('Banka');
  productPicker($('#picker'), add, { placeholder: t('Barkod / DataMatrix okutun veya ürün arayın…'), onCode }).focus();
  renderTiles(); renderCart();
}

// ---------- Ayarlar ----------
async function viewSettings() {
  const s = await api('/api/settings');
  const cps = await refs('counterparties', true);
  const fields = [
    { key: 'company_name', label: t('Şirket adı'), required: true },
    { key: 'company_tax_no', label: t('VKN / TCKN') },
    { key: 'company_kpp', label: t('Vergi dairesi') },
    { key: 'currency', label: t('Para birimi simgesi') },
    { key: 'default_vat', label: t('Varsayılan KDV'), type: 'select', options: VAT_RATES.map(([r, l]) => [r, t(l)]) },
    { key: 'retail_counterparty_id', label: t('Perakende satış carisi'), type: 'select', options: cps.map((c) => [c.id, c.name]) },
    { key: 'company_address', label: t('Adres'), type: 'textarea' },
  ];
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Ayarlar'))}</h1></div>
  <div class="grid cols-2">
    <div class="card"><h2>${esc(t('Şirket'))}</h2><div id="sform">${formHtml(fields, s)}</div>
      <div style="margin-top:12px"><button id="ssave" class="primary" ${ME.role !== 'admin' ? 'disabled' : ''}>${esc(t('Kaydet'))}</button></div></div>
    <div class="card"><h2>${esc(t('Hesabım'))}</h2><p>${esc(ME.name)} (${esc(ME.username)}) · ${esc(ME.role === 'admin' ? t('Yönetici') : t('Kullanıcı'))}</p>
      <div style="display:flex;gap:8px;align-items:center"><button id="pw">${esc(t('Şifremi değiştir'))}</button> ${esc(t('Dil'))}: ${langSwitch()}</div></div>
  </div>
  ${ME.role === 'admin' ? `<div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">${esc(t('Kullanıcılar'))}</h2><div class="spacer"></div><button id="uadd" class="primary">+ ${esc(t('Kullanıcı'))}</button></div><div id="users"></div></div>` : ''}`;
  bindLangSwitch($('#main'), () => { renderShell(); router(); });
  $('#ssave').onclick = async () => {
    try { META.settings = await api('/api/settings', { method: 'PUT', body: readForm($('#sform'), fields) }); toast(t('Ayarlar kaydedildi')); renderShell(); router(); } catch (e) { fail(e); }
  };
  $('#pw').onclick = async () => {
    const v = await formModal(t('Şifre değiştir'), [{ key: 'password', label: t('Yeni şifre'), type: 'password', required: true, wide: true }]);
    if (!v) return;
    try { await api(`/api/users/${ME.id}`, { method: 'PUT', body: v }); toast(t('Şifre değiştirildi')); } catch (e) { fail(e); }
  };
  if (ME.role !== 'admin') return;
  const users = await api('/api/users');
  $('#users').innerHTML = tableHtml([
    { key: 'username', title: t('Kullanıcı adı') }, { key: 'name', title: t('Ad soyad') },
    { key: 'role', title: t('Rol'), fmt: (v) => esc(v === 'admin' ? t('Yönetici') : t('Kullanıcı')) },
    { key: 'archived', title: t('Durum'), fmt: (v) => (v ? `<span class="badge off">${esc(t('Pasif'))}</span>` : `<span class="badge ok">${esc(t('Aktif'))}</span>`) },
    { key: 'created_at', title: t('Oluşturulma') },
  ], users, { click: true, footer: false });
  const roleOpt = [['user', t('Kullanıcı')], ['admin', t('Yönetici')]];
  bindRows($('#users'), users, async (u) => {
    const v = await formModal(t('Kullanıcı: {0}', u.username), [
      { key: 'name', label: t('Ad soyad') }, { key: 'role', label: t('Rol'), type: 'select', options: roleOpt },
      { key: 'password', label: t('Yeni şifre (boş bırakılabilir)'), type: 'password' }, { key: 'archived', label: t('Pasif'), type: 'checkbox' },
    ], u);
    if (!v) return;
    try { await api(`/api/users/${u.id}`, { method: 'PUT', body: v }); router(); } catch (e) { fail(e); }
  });
  $('#uadd').onclick = async () => {
    const v = await formModal(t('Yeni kullanıcı'), [
      { key: 'username', label: t('Kullanıcı adı'), required: true }, { key: 'name', label: t('Ad soyad') },
      { key: 'password', label: t('Şifre'), type: 'password', required: true }, { key: 'role', label: t('Rol'), type: 'select', options: roleOpt },
    ]);
    if (!v) return;
    try { await api('/api/users', { method: 'POST', body: v }); router(); } catch (e) { fail(e); }
  };
}

const TAX_SYSTEM_LABEL = { osn: 'ОСН', usnIncome: 'УСН (доходы)', usnIncomeOutcome: 'УСН (доходы − расходы)', esn: 'ЕСХН', patent: 'Патент' };
const FISCAL_MODE_LABEL = { off: 'Kapalı', atol: 'АТОЛ Web Server', test: 'Test modu (cihazsız)' };

async function viewIntegrations() {
  const s = await api('/api/settings');
  const ws = await refs('warehouses', true);
  const isAdmin = ME.role === 'admin';
  const fiscalFields = [
    { key: 'fiscal_mode', label: t('Kasa modu'), type: 'select', options: META.fiscalModes.map((m) => [m, t(FISCAL_MODE_LABEL[m])]) },
    { key: 'atol_url', label: t('АТОЛ Web Server adresi') },
    { key: 'tax_system', label: t('Vergi sistemi (СНО)'), type: 'select', options: META.taxSystems.map((x) => [x, TAX_SYSTEM_LABEL[x]]) },
    { key: 'cashier_name', label: t('Kasiyer adı') },
    { key: 'cashier_inn', label: t('Kasiyer ИНН') },
  ];
  const czFields = [
    { key: 'cz_mode', label: t('Kontrol modu'), type: 'select', options: [['off', t('Kapalı')], ['test', t('Test modu (cihazsız)')], ['api', 'True API (ГИС МТ)']] },
    { key: 'cz_token', label: t('Честный знак API anahtarı (X-API-KEY)'), type: 'password' },
  ];
  const syncFields = [
    { key: 'channel_sync_minutes', label: t('Senkronizasyon aralığı (dakika, 0 = kapalı)'), type: 'number' },
  ];
  const shopFields = [
    { key: 'shop_warehouse_id', label: t('İnternet siparişleri deposu'), type: 'select', options: [['', t('— ilk depo —')], ...ws.filter((w) => !w.archived).map((w) => [w.id, w.name])] },
  ];
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t('Kasa ve entegrasyonlar'))}</h1></div>
  <div class="grid cols-2">
    <div class="card"><h2>${esc(t('Online kasa (54-ФЗ)'))}</h2>
      <p class="muted">${esc(t('Fişler kasadaki fiskal cihazda (ККТ) kesilir ve ОФД üzerinden vergi dairesine gider. Kasiyerin bilgisayarında АТОЛ Web Server (АТОЛ ДТО 10) kurulu olmalıdır.'))}</p>
      <div id="fform">${formHtml(fiscalFields, s)}</div>
      <div style="margin-top:12px;display:flex;gap:8px"><button id="fsave" class="primary" ${isAdmin ? '' : 'disabled'}>${esc(t('Kaydet'))}</button><button id="ftest">${esc(t('Bağlantıyı test et'))}</button></div></div>
    <div class="card"><h2>${esc(t('İnternet mağazası API'))}</h2>
      <p class="muted">${esc(t('Siteniz bu API ile ürünleri ve stokları okur, siparişleri müşteri siparişi olarak gönderir. İstekte başlık: Authorization: Bearer <anahtar>'))}</p>
      <div id="shform">${formHtml(shopFields, s)}</div>
      <div style="margin-top:12px"><button id="shsave" class="primary" ${isAdmin ? '' : 'disabled'}>${esc(t('Kaydet'))}</button></div>
      <pre class="code">GET  /api/v1/products
GET  /api/v1/stock?warehouse_id=1
POST /api/v1/orders
GET  /api/v1/orders/{external_id}
POST /api/v1/orders/{external_id}/cancel</pre>
    </div>
  </div>
  <div class="grid cols-2" style="margin-top:12px">
    <div class="card"><h2>Честный знак</h2>
      <p class="muted">${esc(t('Satıştan önce her markalama kodu kontrol edilir (разрешительный режим). Kodlar kasa fişine eklenir.'))}</p>
      <div id="czform">${formHtml(czFields, s)}</div>
      <div style="margin-top:12px"><button id="czsave" class="primary" ${isAdmin ? '' : 'disabled'}>${esc(t('Kaydet'))}</button></div></div>
    <div class="card"><h2>${esc(t('Otomatik senkronizasyon'))}</h2>
      <p class="muted">${esc(t('Siparişler kanallardan alınır, kullanılabilir stok (stok − rezerv) kanallara gönderilir.'))}</p>
      <div id="syncform">${formHtml(syncFields, s)}</div>
      <div style="margin-top:12px"><button id="syncsave" class="primary" ${isAdmin ? '' : 'disabled'}>${esc(t('Kaydet'))}</button></div></div>
  </div>
  <div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">${esc(t('Satış kanalları'))}</h2><div class="spacer"></div>
    ${isAdmin ? `<button id="chadd" class="primary">+ ${esc(t('Kanal ekle'))}</button>` : ''}</div><div id="channels"></div></div>
  ${isAdmin ? `<div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">${esc(t('API anahtarları'))}</h2><div class="spacer"></div><button id="tadd" class="primary">+ ${esc(t('Anahtar oluştur'))}</button></div><div id="tokens"></div></div>` : ''}`;
  const saveSettings = (root, fields) => async () => {
    try { META.settings = await api('/api/settings', { method: 'PUT', body: readForm(root, fields) }); toast(t('Ayarlar kaydedildi')); } catch (e) { fail(e); }
  };
  $('#fsave').onclick = saveSettings($('#fform'), fiscalFields);
  $('#shsave').onclick = saveSettings($('#shform'), shopFields);
  $('#czsave').onclick = saveSettings($('#czform'), czFields);
  $('#syncsave').onclick = saveSettings($('#syncform'), syncFields);
  await renderChannels(ws, isAdmin);
  $('#ftest').onclick = async () => {
    const url = $('#fform [name=atol_url]').value.replace(/\/+$/, '');
    try {
      const r = await fetch(`${url}/api/v2/devices`);
      toast(t('АТОЛ Web Server yanıt verdi (HTTP {0})', r.status));
    } catch { toast(t('Kasaya bağlanılamadı ({0}). АТОЛ Web Server çalışıyor mu?', url), true); }
  };
  if (!isAdmin) return;
  const tokens = await api('/api/tokens');
  $('#tokens').innerHTML = tableHtml([
    { key: 'name', title: t('Ad') }, { key: 'created_at', title: t('Oluşturulma') }, { key: 'last_used_at', title: t('Son kullanım') },
    { key: 'id', title: '', fmt: (v) => `<button data-del-token="${v}" class="danger">${esc(t('Sil'))}</button>` },
  ], tokens, { empty: t('Henüz anahtar yok'), footer: false });
  $$('[data-del-token]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal(t('Anahtar silinsin mi? Bu anahtarı kullanan site erişimini kaybeder.')))) return;
    try { await api(`/api/tokens/${b.dataset.delToken}`, { method: 'DELETE' }); router(); } catch (e) { fail(e); }
  }));
  $('#tadd').onclick = async () => {
    const v = await formModal(t('Yeni API anahtarı'), [{ key: 'name', label: t('Ad (ör. site adı)'), required: true, wide: true }]);
    if (!v) return;
    try {
      const r = await api('/api/tokens', { method: 'POST', body: v });
      await modal(t('Anahtar oluşturuldu'), `<p>${esc(t('Bu anahtarı şimdi kopyalayın, tekrar gösterilmeyecek:'))}</p><pre class="code">${esc(r.token)}</pre>`, { okText: t('Tamam') });
      router();
    } catch (e) { fail(e); }
  };
}

// ---------- Satış kanalları ----------
async function renderChannels(warehouses, isAdmin) {
  const list = await api('/api/channels');
  const types = Object.fromEntries(META.channelTypes.map((c) => [c.type, c]));
  $('#channels').innerHTML = list.length ? `<div class="grid cols-2">${list.map((c) => `<div class="card">
    <div class="page-head" style="margin-bottom:6px"><h2 style="margin:0">${esc(c.name)}</h2><span class="badge">${esc(c.title)}</span>
      ${c.enabled ? '' : `<span class="badge off">${esc(t('Pasif'))}</span>`}<div class="spacer"></div></div>
    <div class="muted" style="font-size:13px">${esc(t('Depo'))}: ${esc(warehouses.find((w) => w.id === c.warehouse_id)?.name ?? t('— ilk depo —'))}
      ${types[c.type]?.needsMapping ? ` · ${esc(t('Eşleşen ürün: {0}', c.mapped))}` : ''}<br>
      ${esc(t('Son senkronizasyon:'))} ${esc(c.last_sync_at || '—')}</div>
    ${c.last_error ? `<div class="neg" style="font-size:13px;margin-top:6px">${esc(c.last_error)}</div>` : ''}
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button data-ch-sync="${c.id}" class="primary">${esc(t('Şimdi senkronize et'))}</button>
      ${types[c.type]?.needsMapping ? `<button data-ch-map="${c.id}">${esc(t('Ürünleri eşleştir'))}</button>` : ''}
      <button data-ch-log="${c.id}">${esc(t('Kayıtlar'))}</button>
      ${isAdmin ? `<button data-ch-edit="${c.id}">${esc(t('Düzenle'))}</button><button data-ch-del="${c.id}" class="danger">${esc(t('Sil'))}</button>` : ''}
    </div></div>`).join('')}</div>`
    : `<div class="card empty">${esc(t('Henüz kanal yok. InSales, Ozon, Wildberries veya Яндекс Маркет ekleyin.'))}</div>`;

  const editChannel = async (c) => {
    let type = c?.type;
    if (!type) {
      type = await modal(t('Kanal ekle'), formHtml([{ key: 'type', label: t('Kanal türü'), type: 'select', options: META.channelTypes.map((x) => [x.type, x.title]) }]),
        { okText: t('Devam'), onOk: (f) => f.type.value });
      if (!type) return;
    }
    const ct = types[type];
    const fields = [
      { key: 'name', label: t('Ad'), required: true, default: ct.title },
      { key: 'warehouse_id', label: t('Depo'), type: 'select', options: [['', t('— ilk depo —')], ...warehouses.filter((w) => !w.archived).map((w) => [w.id, w.name])] },
      { key: 'enabled', label: t('Etkin'), type: 'checkbox', default: 1 },
      ...ct.fields.map((f) => ({ key: `cfg_${f.key}`, label: t(f.label), type: f.secret ? 'password' : 'text' })),
    ];
    const values = c ? { ...c, ...Object.fromEntries(Object.entries(c.config).map(([k, v]) => [`cfg_${k}`, v])) } : {};
    const v = await formModal(c ? t('Kanalı düzenle') : ct.title, fields, values);
    if (!v) return;
    const body = { type, name: v.name, warehouse_id: v.warehouse_id, enabled: v.enabled, config: {} };
    for (const f of ct.fields) body.config[f.key] = v[`cfg_${f.key}`];
    try { await api(c ? `/api/channels/${c.id}` : '/api/channels', { method: c ? 'PUT' : 'POST', body }); toast(t('Kanal kaydedildi')); router(); } catch (e) { fail(e); }
  };
  if ($('#chadd')) $('#chadd').onclick = () => editChannel(null);
  const busy = (b, fn) => async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { fail(e); } finally { b.disabled = false; }
  };
  $$('[data-ch-sync]').forEach((b) => (b.onclick = busy(b, async () => {
    const r = await api(`/api/channels/${b.dataset.chSync}/sync`, { method: 'POST' });
    toast(t('{0} yeni sipariş, {1} iptal, {2} ürün stoğu gönderildi', r.created, r.cancelled, r.stock));
    router();
  })));
  $$('[data-ch-map]').forEach((b) => (b.onclick = busy(b, async () => {
    const r = await api(`/api/channels/${b.dataset.chMap}/map`, { method: 'POST' });
    toast(t('{0} ürün eşleşti, {1} kanal ürünü eşleşmedi', r.mapped, r.unmatched));
    router();
  })));
  $$('[data-ch-log]').forEach((b) => (b.onclick = async () => {
    const rows = await api(`/api/channels/${b.dataset.chLog}/log`);
    modal(t('Kayıtlar'), tableHtml([
      { key: 'created_at', title: t('Zaman'), nowrap: true },
      { key: 'message', title: '', fmt: (v, r) => `<span class="${r.level === 'error' ? 'neg' : ''}">${esc(t(v))}</span>` },
    ], rows, { footer: false, empty: t('Kayıt yok') }), { okText: '' });
  }));
  $$('[data-ch-edit]').forEach((b) => (b.onclick = () => editChannel(list.find((c) => c.id === Number(b.dataset.chEdit)))));
  $$('[data-ch-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal(t('Kanal silinsin mi? Daha önce aktarılan siparişler kalır.')))) return;
    try { await api(`/api/channels/${b.dataset.chDel}`, { method: 'DELETE' }); router(); } catch (e) { fail(e); }
  }));
}

// Mobil cihazlarda ana ekrana eklenebilir uygulama (PWA).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

boot().then(() => { if (!ME) renderLogin(); });
