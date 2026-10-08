// Vordi — tek sayfalık arayüz (bağımlılıksız).
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });
const today = () => new Date().toLocaleDateString('sv-SE');
const monthStart = () => today().slice(0, 8) + '01';
const nowLocal = () => { const d = new Date(); return `${d.toLocaleDateString('sv-SE')}T${d.toTimeString().slice(0, 5)}`; };
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

let META = null;
let ME = null;
const money = (v) => `${nf2.format(Number(v) || 0)} ${META?.settings.currency ?? '₺'}`;
const qty = (v) => nf3.format(Number(v) || 0);
const signed = (v, fmt = money) => `<span class="${v < 0 ? 'neg' : ''}">${fmt(v)}</span>`;

// ---------- API ----------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/api/login') { ME = null; renderLogin(); throw new Error('Oturum kapandı'); }
  if (!res.ok) throw new Error(data?.error ?? `Hata ${res.status}`);
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
function modal(title, inner, { okText = 'Kaydet', onOk } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${inner}<div class="actions">
      <button type="button" data-cancel>Vazgeç</button>${okText ? `<button class="primary">${esc(okText)}</button>` : ''}</div></form>`;
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
const confirmModal = (text) => modal('Onay', `<p>${esc(text)}</p>`, { okText: 'Evet' });

// ---------- Tablo ----------
// cols: [{ key, title, num, fmt(v,row) -> html, total }]
function tableHtml(cols, rows, { click = false, empty = 'Kayıt yok', footer = true } = {}) {
  if (!rows.length) return `<div class="table-wrap"><div class="empty">${esc(empty)}</div></div>`;
  const hasTotal = footer && cols.some((c) => c.total);
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.title)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r, i) => `<tr class="${click ? 'click' : ''}" data-i="${i}">${cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.nowrap ? 'nowrap' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
  ${hasTotal ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.num ? 'num' : ''}">${c.total ? (c.fmt ?? esc)(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0), {}) : i === 0 ? 'Toplam' : ''}</td>`).join('')}</tr></tfoot>` : ''}
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
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
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
  { title: 'Ayarlar', items: [['#/settings', 'Şirket ve kullanıcılar']] },
];
const SECTION_OF_TYPE = { purchase: 1, sales: 2, stock: 3, money: 5, retail: 6 };

function activeSection(hash) {
  const docType = /^#\/docs\/(\w+)/.exec(hash)?.[1] ?? window.__docType;
  if (docType && META.docTypes[docType]) return SECTION_OF_TYPE[META.docTypes[docType].section];
  if (hash.startsWith('#/products')) return 3;
  if (hash.startsWith('#/counterparties')) return 4;
  const idx = MENU.findIndex((m) => m.items.some(([h]) => hash.startsWith(h)));
  return idx < 0 ? 0 : idx;
}

function renderShell() {
  $('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/dashboard"><span class="logo">V</span>Vordi</a>
    <nav class="topnav" id="topnav"></nav>
    <div class="userbox"><span>${esc(META.settings.company_name)} · ${esc(ME.name || ME.username)}</span><button id="logout">Çıkış</button></div>
  </header>
  <nav class="subnav" id="subnav"></nav>
  <main id="main"></main>`;
  $('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); ME = null; renderLogin(); };
}
function renderNav() {
  const hash = location.hash || '#/dashboard';
  const sec = activeSection(hash);
  $('#topnav').innerHTML = MENU.map((m, i) => `<a href="${m.items[0][0]}" class="${i === sec ? 'active' : ''}">${esc(m.title)}</a>`).join('');
  const path = hash.split('?')[0];
  $('#subnav').innerHTML = MENU[sec].items.map(([h, t]) => `<a href="${h}" class="${path === h || path.startsWith(h + '/') ? 'active' : ''}">${esc(t)}</a>`).join('');
}

// ---------- Yönlendirme ----------
const ROUTES = [
  [/^#\/dashboard$/, () => viewDashboard()],
  [/^#\/docs\/(\w+)$/, (t) => viewDocList(t)],
  [/^#\/docs\/(\w+)\/new$/, (t, q) => viewDocForm({ type: t, from: q.get('from'), copy: q.get('copy') })],
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
];

async function router() {
  if (!ME) return;
  const hash = location.hash || '#/dashboard';
  const [path, query] = hash.split('?');
  window.__docType = null;
  for (const [re, fn] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      $('#main').innerHTML = '<div class="muted">Yükleniyor…</div>';
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
    <label class="field">Kullanıcı adı<input name="username" autocomplete="username" required></label>
    <label class="field">Şifre<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="primary big">Giriş yap</button>
    <div class="muted" style="font-size:12px;text-align:center">İlk kurulumda: admin / admin</div>
  </form></div>`;
  const f = $('.login form');
  f.username.focus();
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
  <div class="page-head"><h1>Göstergeler</h1><div class="spacer"></div>
    <a class="btn" href="#/pos">Perakende satış</a><a class="btn" href="#/docs/customerorder/new">+ Müşteri siparişi</a><a class="btn primary" href="#/docs/supply/new">+ Mal kabul</a></div>
  <div class="kpis">
    <div class="card kpi"><div class="label">Bugünkü satış</div><div class="value">${money(d.salesToday.s)}</div><div class="sub">${d.salesToday.n} belge</div></div>
    <div class="card kpi"><div class="label">Bu ay satış</div><div class="value">${money(d.salesMonth.s)}</div><div class="sub">${d.salesMonth.n} belge</div></div>
    <div class="card kpi"><div class="label">Bu ay brüt kâr</div><div class="value">${signed(d.profitMonth)}</div></div>
    <div class="card kpi"><div class="label">Açık müşteri siparişleri</div><div class="value">${d.openOrders.count}</div><div class="sub">${money(d.openOrders.sum)}</div></div>
    <div class="card kpi"><div class="label">Stok değeri (maliyet)</div><div class="value">${money(d.stockValue)}</div></div>
    <div class="card kpi"><div class="label">Alacaklar / Borçlar</div><div class="value pos" style="font-size:18px">${money(d.receivables)}</div><div class="value neg" style="font-size:18px;margin:0">${money(d.payables)}</div></div>
    ${d.money.map((a) => `<div class="card kpi"><div class="label">${esc(a.account)} bakiyesi</div><div class="value">${signed(a.balance)}</div></div>`).join('')}
  </div>
  <div class="card chart" style="margin-bottom:12px"><h2>Son 30 gün satışlar</h2><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg></div>
  <div class="grid cols-2">
    <div><h2>Kritik stok</h2>${tableHtml([
      { key: 'name', title: 'Ürün', fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
      { key: 'stock', title: 'Stok', num: true, fmt: (v) => signed(v, qty) },
      { key: 'min_stock', title: 'Min. stok', num: true, fmt: qty },
    ], d.lowStock, { empty: 'Kritik seviyede ürün yok', footer: false })}</div>
    <div><h2>Bu ayın en çok satanları</h2>${tableHtml([
      { key: 'name', title: 'Ürün' },
      { key: 'qty', title: 'Miktar', num: true, fmt: qty },
      { key: 'revenue', title: 'Ciro', num: true, fmt: money },
      { key: 'profit', title: 'Kâr', num: true, fmt: (v) => signed(v) },
    ], d.topProducts, { empty: 'Bu ay satış yok', footer: false })}</div>
  </div>`;
}

// ---------- Belge listesi ----------
const listState = {};
async function viewDocList(type) {
  const t = META.docTypes[type];
  if (!t) throw new Error('Bilinmeyen belge türü');
  window.__docType = type;
  const st = listState[type] ??= { q: '', from: '', to: '' };
  $('#main').innerHTML = `
  <div class="page-head"><h1>${esc(t.title)}</h1><div class="spacer"></div>
    <a class="btn primary" href="#/docs/${type}/new">+ ${esc(t.single)}</a></div>
  <div class="toolbar">
    <input id="q" placeholder="Ara: numara, cari, açıklama" value="${esc(st.q)}" style="width:260px">
    <label class="muted">Başlangıç <input type="date" id="from" value="${st.from}"></label>
    <label class="muted">Bitiş <input type="date" id="to" value="${st.to}"></label>
    <button id="csv">CSV indir</button>
  </div>
  <div id="list"></div>`;
  const cols = [
    { key: 'number', title: '№', nowrap: true },
    { key: 'moment', title: 'Zaman', nowrap: true },
    ...(t.counterparty || type === 'retaildemand' ? [{ key: 'counterparty', title: 'Cari' }] : []),
    ...(t.warehouse ? [{ key: 'warehouse', title: t.targetWarehouse ? 'Kaynak depo' : 'Depo' }] : []),
    ...(t.targetWarehouse ? [{ key: 'target_warehouse', title: 'Hedef depo' }] : []),
    ...(t.statuses ? [{ key: 'status', title: 'Durum', fmt: (v) => `<span class="badge ${t.closed?.includes(v) ? (v === 'İptal' ? 'off' : 'ok') : 'warn'}">${esc(v)}</span>` }] : []),
    ...(t.account ? [{ key: 'account', title: 'Hesap' }] : []),
    ...(t.category ? [{ key: 'category', title: 'Kategori' }] : []),
    { key: 'sum', title: 'Tutar', num: true, fmt: money, total: true },
    ...(t.lines && t.counterparty ? [{ key: 'paid', title: 'Ödenen', num: true, fmt: money, total: true }] : []),
    { key: 'posted', title: 'İşlendi', fmt: (v) => (v ? '<span class="badge ok">Evet</span>' : '<span class="badge">Taslak</span>') },
    { key: 'comment', title: 'Açıklama' },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/documents?${qs({ type, ...st })}`);
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, empty: 'Henüz belge yok' });
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
function productPicker(container, onPick, { placeholder = 'Ürün ekle: ad, kod veya barkod okutun…' } = {}) {
  container.innerHTML = `<div class="picker"><input placeholder="${esc(placeholder)}"><div class="dropdown" hidden></div></div>`;
  const input = $('input', container);
  const dd = $('.dropdown', container);
  let matches = [];
  let active = 0;
  const render = () => {
    dd.hidden = !matches.length;
    dd.innerHTML = matches.map((p, i) => `<div class="opt ${i === active ? 'active' : ''}" data-i="${i}"><span>${esc(p.name)} <span class="muted">${esc(p.code)}</span></span><span class="muted">${money(p.sale_price)}</span></div>`).join('');
  };
  const pick = (p) => { onPick(p); input.value = ''; matches = []; render(); input.focus(); };
  input.oninput = async () => {
    const s = input.value.trim().toLocaleLowerCase('tr');
    if (!s) { matches = []; return render(); }
    const all = (await refs('products')).filter((p) => !p.archived);
    matches = all.filter((p) => [p.name, p.code, p.article, p.barcode].some((v) => String(v).toLocaleLowerCase('tr').includes(s))).slice(0, 20);
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
      const exact = (await refs('products')).find((p) => s && (p.barcode === s || p.code === s || p.article === s));
      if (exact) pick(exact); else if (matches[active]) pick(matches[active]);
    }
  };
  dd.onmousedown = (e) => { const o = e.target.closest('.opt'); if (o) { e.preventDefault(); pick(matches[Number(o.dataset.i)]); } };
  input.onblur = () => setTimeout(() => { dd.hidden = true; }, 150);
  input.onfocus = () => { if (matches.length) dd.hidden = false; };
  return input;
}

// ---------- Belge formu ----------
async function viewDocForm({ id, type, from, copy }) {
  const draft = !id && copy ? sessionStorage.getItem('vordi-copy') : null;
  if (draft) {
    // Kopyala: taslak olarak yeni belge oluştur ve onu aç.
    sessionStorage.removeItem('vordi-copy');
    const saved = await api('/api/documents', { method: 'POST', body: { ...JSON.parse(draft), posted: false, moment: '' } });
    toast('Kopya taslak olarak oluşturuldu');
    history.replaceState(null, '', `#/doc/${saved.id}`);
    return viewDocForm({ id: saved.id });
  }
  let doc;
  if (id) doc = await api(`/api/documents/${id}`);
  else if (from) doc = await api(`/api/documents/${from}/derive/${type}`);
  else doc = { type, lines: [], posted: 1 };
  type = doc.type;
  const t = META.docTypes[type];
  if (!t) throw new Error('Bilinmeyen belge türü');
  window.__docType = type;
  if (!id) {
    doc.number = doc.number ?? (await api(`/api/documents/next-number/${type}`)).number;
    doc.moment = nowLocal();
    if (t.statuses) doc.status = t.statuses[0];
    if (t.account) doc.account = doc.account ?? 'Kasa';
  }
  const [warehouses, counterparties] = await Promise.all([refs('warehouses'), refs('counterparties')]);
  if (!id && t.warehouse && !doc.warehouse_id) doc.warehouse_id = warehouses[0]?.id;
  if (!id && type === 'retaildemand' && !doc.counterparty_id) doc.counterparty_id = Number(META.settings.retail_counterparty_id) || null;
  doc.lines = doc.lines ?? [];
  // Sayım: satırdaki "beklenen" stok = sayılan - fark.
  if (t.inventory) for (const l of doc.lines) l.expected = (l.actual_qty ?? 0) - (l.qty ?? 0);

  const opts = (list, sel, blank = true) => (blank ? '<option value="">— seçiniz —</option>' : '') +
    list.filter((x) => !x.archived || x.id === sel).map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

  $('#main').innerHTML = `
  <div class="page-head">
    <a href="#/docs/${type}" class="muted">← ${esc(t.title)}</a>
    <h1>${esc(t.single)} ${id ? `№${esc(doc.number)}` : '(yeni)'}</h1>
    <div class="spacer"></div>
    ${id && t.derive ? `<select id="derive"><option value="">Oluştur…</option>${t.derive.map((d) => `<option value="${d}">${esc(META.docTypes[d].single)}</option>`).join('')}</select>` : ''}
    ${id ? '<button id="print">Yazdır</button><button id="copy">Kopyala</button><button id="del" class="danger">Sil</button>' : ''}
    <button id="save" class="primary">Kaydet</button>
  </div>
  <div class="card" style="margin-bottom:12px">
    <div class="form-grid">
      <label class="field">Numara<input id="f-number" value="${esc(doc.number)}"></label>
      <label class="field">Tarih<input id="f-moment" type="datetime-local" value="${esc(String(doc.moment).replace(' ', 'T'))}"></label>
      ${t.counterparty || type === 'retaildemand' ? `<label class="field">Cari<select id="f-counterparty_id">${opts(counterparties, doc.counterparty_id)}</select></label>` : ''}
      ${t.warehouse ? `<label class="field">${t.targetWarehouse ? 'Kaynak depo' : 'Depo'}<select id="f-warehouse_id">${opts(warehouses, doc.warehouse_id)}</select></label>` : ''}
      ${t.targetWarehouse ? `<label class="field">Hedef depo<select id="f-target_warehouse_id">${opts(warehouses, doc.target_warehouse_id)}</select></label>` : ''}
      ${t.statuses ? `<label class="field">Durum<select id="f-status">${t.statuses.map((s) => `<option ${s === doc.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : ''}
      ${t.account ? `<label class="field">Hesap<select id="f-account">${META.accounts.map((a) => `<option ${a === doc.account ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>` : ''}
      ${t.category ? `<label class="field">Kategori<input id="f-category" list="cats" value="${esc(doc.category)}"><datalist id="cats">${META.categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>` : ''}
      ${!t.lines ? `<label class="field">Tutar<input id="f-sum" type="number" step="0.01" min="0" value="${esc(doc.sum ?? '')}"></label>` : ''}
      <label class="check" style="align-self:end;padding-bottom:6px"><input type="checkbox" id="f-posted" ${doc.posted ? 'checked' : ''}> İşlendi (stok/bakiye etkiler)</label>
      <label class="field wide">Açıklama<textarea id="f-comment">${esc(doc.comment)}</textarea></label>
    </div>
    ${doc.linked?.filter((l) => l.id !== doc.id).length ? `<div class="linked" style="margin-top:10px"><span class="muted">Bağlı belgeler: </span>${doc.linked.filter((l) => l.id !== doc.id).map((l) => `<a href="#/doc/${l.id}">${esc(META.docTypes[l.type].single)} №${esc(l.number)} (${money(l.sum)})</a>`).join('')}</div>` : ''}
    ${id ? `<div class="muted" style="margin-top:8px;font-size:12px">Oluşturan: ${esc(doc.author ?? '—')} · ${esc(doc.created_at)} · Son değişiklik: ${esc(doc.updated_at)}</div>` : ''}
  </div>
  ${t.lines ? `<div class="card">
    <div id="picker" style="margin-bottom:10px"></div>
    <div class="table-wrap"><table class="lines"><thead><tr>
      <th style="width:36px">#</th><th>Ürün</th>
      ${t.inventory ? '<th class="num">Beklenen</th><th class="num" style="width:110px">Sayılan</th><th class="num">Fark</th>' : '<th class="num" style="width:110px">Miktar</th>'}
      <th>Birim</th><th class="num" style="width:130px">Fiyat</th><th class="num" style="width:80px">KDV %</th><th class="num">KDV</th><th class="num">Tutar</th><th></th>
    </tr></thead><tbody id="lines"></tbody></table></div>
    <div class="doc-total" id="totals"></div>
  </div>` : ''}`;

  const field = (k) => $(`#f-${k}`);
  const lineSum = (l) => l.qty * l.price;
  const renderTotals = () => {
    const total = doc.lines.reduce((s, l) => s + lineSum(l), 0);
    const vat = doc.lines.reduce((s, l) => s + (lineSum(l) * l.vat) / (100 + l.vat), 0);
    $('#totals').innerHTML = `<span class="muted">Kalem: ${doc.lines.length}</span><span>KDV dahil: ${money(vat)}</span><span>Toplam: <b>${money(total)}</b></span>`;
  };
  const renderLines = () => {
    $('#lines').innerHTML = doc.lines.length ? doc.lines.map((l, i) => `<tr data-i="${i}">
      <td class="muted">${i + 1}</td>
      <td><a href="#/products/${l.product_id}">${esc(l.product)}</a></td>
      ${t.inventory
        ? `<td class="num">${qty(l.expected)}</td><td><input class="num" data-k="actual_qty" value="${l.actual_qty ?? ''}"></td><td class="num" data-diff>${signed(l.qty, qty)}</td>`
        : `<td><input class="num" data-k="qty" value="${l.qty}"></td>`}
      <td class="muted">${esc(l.unit)}</td>
      <td><input class="num" data-k="price" value="${l.price}"></td>
      <td><input class="num" data-k="vat" value="${l.vat}"></td>
      <td class="num" data-vat>${nf2.format((lineSum(l) * l.vat) / (100 + l.vat))}</td>
      <td class="num" data-sum>${nf2.format(lineSum(l))}</td>
      <td><button data-del title="Satırı sil">✕</button></td></tr>`).join('')
      : `<tr><td colspan="10" class="empty">Ürün eklemek için yukarıdaki alana yazın veya barkod okutun</td></tr>`;
    renderTotals();
  };
  if (t.lines) {
    $('#lines').addEventListener('input', (e) => {
      const tr = e.target.closest('tr');
      const l = doc.lines[Number(tr.dataset.i)];
      l[e.target.dataset.k] = num(e.target.value);
      if (t.inventory) { l.qty = l.actual_qty - l.expected; $('[data-diff]', tr).innerHTML = signed(l.qty, qty); }
      $('[data-sum]', tr).textContent = nf2.format(lineSum(l));
      $('[data-vat]', tr).textContent = nf2.format((lineSum(l) * l.vat) / (100 + l.vat));
      renderTotals();
    });
    $('#lines').addEventListener('click', (e) => {
      if (!e.target.closest('[data-del]')) return;
      doc.lines.splice(Number(e.target.closest('tr').dataset.i), 1);
      renderLines();
    });
    productPicker($('#picker'), async (p) => {
      const ex = doc.lines.find((l) => l.product_id === p.id);
      if (ex && !t.inventory) { ex.qty += 1; renderLines(); return; }
      if (ex) return;
      const line = { product_id: p.id, product: p.name, unit: p.unit, qty: 1, price: p[t.priceField] ?? 0, vat: p.vat };
      if (t.inventory) {
        const whId = Number(field('warehouse_id').value);
        const stocks = await api(`/api/products/${p.id}/stock`);
        line.expected = stocks.find((s) => s.id === whId)?.stock ?? 0;
        line.actual_qty = line.expected;
        line.qty = 0;
      }
      doc.lines.push(line);
      renderLines();
    });
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
      toast(`${t.single} №${saved.number} kaydedildi`);
      if (id) await viewDocForm({ id }); else history.replaceState(null, '', `#/doc/${saved.id}`), await viewDocForm({ id: saved.id });
    } catch (e) { fail(e); }
  };
  if (!id) return;
  $('#del').onclick = async () => {
    if (!(await confirmModal(`${t.single} №${doc.number} silinsin mi?`))) return;
    try { await api(`/api/documents/${id}`, { method: 'DELETE' }); toast('Belge silindi'); go(`#/docs/${type}`); } catch (e) { fail(e); }
  };
  $('#print').onclick = () => printDocument(doc);
  $('#copy').onclick = () => {
    const c = collect();
    delete c.number; delete c.base_id;
    sessionStorage.setItem('vordi-copy', JSON.stringify(c));
    go(`#/docs/${type}/new?copy=1`);
  };
  if ($('#derive')) $('#derive').onchange = (e) => e.target.value && go(`#/docs/${e.target.value}/new?from=${id}`);
}

function printDocument(doc) {
  const t = META.docTypes[doc.type];
  const s = META.settings;
  const total = doc.lines.reduce((a, l) => a + l.qty * l.price, 0);
  const vat = doc.lines.reduce((a, l) => a + (l.qty * l.price * l.vat) / (100 + l.vat), 0);
  const w = window.open('', '_blank');
  if (!w) return toast('Açılır pencere engellendi', true);
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(t.single)} ${esc(doc.number)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:13px;margin:30px;color:#000}table{border-collapse:collapse;width:100%;margin-top:14px}
  th,td{border:1px solid #444;padding:5px 7px}td.n,th.n{text-align:right}h1{font-size:18px}.row{display:flex;justify-content:space-between}
  .sign{margin-top:50px;display:flex;justify-content:space-between}</style></head><body>
  <div class="row"><div><b>${esc(s.company_name)}</b><br>${esc(s.company_address ?? '')}<br>${s.company_tax_no ? 'VKN: ' + esc(s.company_tax_no) : ''}</div>
  <div style="text-align:right">${esc(String(doc.moment).replace('T', ' '))}</div></div>
  <h1>${esc(t.single)} № ${esc(doc.number)}</h1>
  ${doc.counterparty ? `<div>Cari: <b>${esc(doc.counterparty)}</b></div>` : ''}
  ${doc.warehouse ? `<div>${doc.target_warehouse ? 'Kaynak depo' : 'Depo'}: ${esc(doc.warehouse)}</div>` : ''}
  ${doc.target_warehouse ? `<div>Hedef depo: ${esc(doc.target_warehouse)}</div>` : ''}
  ${t.lines ? `<table><thead><tr><th>#</th><th>Ürün</th><th>Kod</th><th class="n">Miktar</th><th>Birim</th><th class="n">Fiyat</th><th class="n">KDV %</th><th class="n">Tutar</th></tr></thead><tbody>
  ${doc.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.product)}</td><td>${esc(l.code)}</td><td class="n">${qty(l.qty)}</td><td>${esc(l.unit)}</td><td class="n">${nf2.format(l.price)}</td><td class="n">${l.vat}</td><td class="n">${nf2.format(l.qty * l.price)}</td></tr>`).join('')}
  </tbody></table><p style="text-align:right">KDV dahil: ${money(vat)}<br><b>Toplam: ${money(total)}</b></p>`
    : `<p style="font-size:16px">Tutar: <b>${money(doc.sum)}</b> (${esc(doc.account)})</p>`}
  ${doc.comment ? `<p>Açıklama: ${esc(doc.comment)}</p>` : ''}
  <div class="sign"><div>Teslim eden: ____________</div><div>Teslim alan: ____________</div></div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------- Ürünler ----------
const productFields = (groups) => [
  { key: 'name', label: 'Ad', required: true, wide: true },
  { key: 'code', label: 'Kod' },
  { key: 'article', label: 'Stok kodu (SKU)' },
  { key: 'barcode', label: 'Barkod' },
  { key: 'unit', label: 'Birim', default: 'adet', list: 'units' },
  { key: 'group_id', label: 'Grup', type: 'select', options: [['', '— grupsuz —'], ...groups.map((g) => [g.id, g.name])] },
  { key: 'buy_price', label: 'Alış fiyatı', type: 'number', default: 0 },
  { key: 'sale_price', label: 'Satış fiyatı', type: 'number', default: 0 },
  { key: 'vat', label: 'KDV %', type: 'select', options: [[20, '20'], [10, '10'], [1, '1'], [0, '0']], default: 20 },
  { key: 'min_stock', label: 'Minimum stok', type: 'number', default: 0 },
  { key: 'is_service', label: 'Hizmet (stok takibi yok)', type: 'checkbox' },
  { key: 'description', label: 'Açıklama', type: 'textarea' },
];
const UNITS_DL = '<datalist id="units"><option value="adet"><option value="kg"><option value="g"><option value="lt"><option value="m"><option value="paket"><option value="koli"><option value="hizmet"></datalist>';

async function viewProducts(query) {
  const groupId = query.get('group') ?? '';
  const archived = query.get('archived') === '1';
  const [groups, stock] = await Promise.all([refs('product_groups', true), api('/api/reports/stock')]);
  const all = await api(`/api/products?${qs({ archived: archived ? '1' : '0' })}`);
  const stockMap = new Map(stock.map((s) => [s.id, s]));
  let q = '';
  $('#main').innerHTML = `
  <div class="page-head"><h1>Ürünler ve hizmetler</h1><div class="spacer"></div>
    <button id="import">CSV içe aktar</button><button id="csv">CSV indir</button>
    <a class="btn primary" href="#/products/new">+ Ürün</a></div>
  <div class="with-side">
    <div class="card side">
      <a href="#/products" class="${!groupId && !archived ? 'active' : ''}">Tüm ürünler</a>
      ${groups.map((g) => `<a href="#/products?group=${g.id}" class="${String(g.id) === groupId ? 'active' : ''}" data-g="${g.id}">${esc(g.name)}</a>`).join('')}
      <a href="#/products?archived=1" class="${archived ? 'active' : ''} muted">Arşiv</a>
      <div style="margin-top:10px;display:flex;gap:6px"><button id="addg">+ Grup</button>${groupId ? '<button id="editg">Düzenle</button>' : ''}</div>
    </div>
    <div><div class="toolbar"><input id="q" placeholder="Ara: ad, kod, barkod" style="width:300px"></div><div id="list"></div></div>
  </div>`;
  const cols = [
    { key: 'name', title: 'Ad' },
    { key: 'code', title: 'Kod' },
    { key: 'article', title: 'SKU' },
    { key: 'barcode', title: 'Barkod' },
    { key: 'group_name', title: 'Grup' },
    { key: 'unit', title: 'Birim' },
    { key: 'buy_price', title: 'Alış', num: true, fmt: money },
    { key: 'sale_price', title: 'Satış', num: true, fmt: money },
    { key: 'stock', title: 'Stok', num: true, fmt: (v, r) => (r.is_service ? '<span class="muted">hizmet</span>' : `<span class="${v < 0 ? 'neg' : r.min_stock > 0 && v < r.min_stock ? 'neg' : ''}">${qty(v)}</span>`) },
  ];
  let rows = [];
  const render = () => {
    const s = q.toLocaleLowerCase('tr');
    rows = all.filter((p) => (!groupId || String(p.group_id) === groupId) && (!s || [p.name, p.code, p.article, p.barcode].some((v) => String(v).toLocaleLowerCase('tr').includes(s))))
      .map((p) => ({ ...p, stock: stockMap.get(p.id)?.stock ?? 0 }));
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, empty: 'Ürün yok', footer: false });
    bindRows($('#list'), rows, (r) => go(`#/products/${r.id}`));
  };
  $('#q').oninput = (e) => { q = e.target.value; render(); };
  $('#csv').onclick = () => downloadCsv('urunler', [...cols, { key: 'vat', title: 'KDV' }, { key: 'min_stock', title: 'Min. stok' }], rows);
  $('#addg').onclick = async () => {
    const v = await formModal('Yeni grup', [{ key: 'name', label: 'Grup adı', required: true }]);
    if (!v) return;
    try { const g = await api('/api/product_groups', { method: 'POST', body: v }); dropRefs('product_groups'); go(`#/products?group=${g.id}`); } catch (e) { fail(e); }
  };
  if ($('#editg')) $('#editg').onclick = async () => {
    const g = groups.find((x) => String(x.id) === groupId);
    const v = await modal('Grubu düzenle', formHtml([{ key: 'name', label: 'Grup adı', required: true }], g) + '<label class="check" style="margin-top:10px"><input type="checkbox" name="del"> Grubu sil (ürünler grupsuz kalır)</label>', {
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
  const res = await modal('Ürünleri CSV ile içe aktar', `
    <p class="muted">İlk satır başlık olmalıdır. Desteklenen sütunlar: <code>name</code> (Ad), <code>code</code>, <code>article</code>, <code>barcode</code>, <code>unit</code>, <code>group</code>, <code>buy_price</code>, <code>sale_price</code>, <code>vat</code>, <code>min_stock</code>.
    Aynı kod/SKU/barkoda sahip ürünler güncellenir. Türkçe başlıklar da kabul edilir (Ad, Kod, SKU, Barkod, Birim, Grup, Alış, Satış, KDV, Min. stok).</p>
    <input type="file" name="file" accept=".csv,text/csv" required>`, {
    okText: 'İçe aktar',
    onOk: async (f) => {
      const text = await f.file.files[0].text();
      const [head, ...data] = parseCsv(text.replace(/^﻿/, ''));
      const alias = { ad: 'name', kod: 'code', sku: 'article', barkod: 'barcode', birim: 'unit', grup: 'group', alış: 'buy_price', satış: 'sale_price', kdv: 'vat', 'min. stok': 'min_stock' };
      const keys = head.map((h) => { const k = h.trim().toLocaleLowerCase('tr'); return alias[k] ?? k; });
      const rows = data.map((r) => Object.fromEntries(keys.map((k, i) => [k, ['buy_price', 'sale_price', 'vat', 'min_stock'].includes(k) ? num(String(r[i] ?? '').replace(/\s/g, '')) : (r[i] ?? '').trim()])));
      return api('/api/products/import', { method: 'POST', body: { rows } });
    },
  });
  if (res) { toast(`${res.created} ürün eklendi, ${res.updated} ürün güncellendi`); dropRefs('products', 'product_groups'); router(); }
}

async function viewProductForm(id) {
  const isNew = id === 'new';
  const groups = await refs('product_groups', true);
  const p = isNew ? {} : await api(`/api/products/${id}`);
  const fields = productFields(groups);
  $('#main').innerHTML = `
  <div class="page-head"><a href="#/products" class="muted">← Ürünler</a><h1>${isNew ? 'Yeni ürün' : esc(p.name)}</h1>
    ${p.archived ? '<span class="badge off">Arşivde</span>' : ''}<div class="spacer"></div>
    ${isNew ? '' : `<button id="del" class="danger">${p.archived ? 'Arşivden çıkar' : 'Sil / Arşivle'}</button>`}
    <button id="save" class="primary">Kaydet</button></div>
  <div class="card" id="form">${formHtml(fields, p)}${UNITS_DL}</div>
  ${isNew ? '' : '<div class="grid cols-2" style="margin-top:12px"><div><h2>Depolardaki stok</h2><div id="stocks"></div></div><div><h2>Stok hareketleri</h2><div id="moves"></div></div></div>'}`;
  $('#save').onclick = async () => {
    try {
      const body = readForm($('#form'), fields);
      const saved = await api(isNew ? '/api/products' : `/api/products/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      dropRefs('products');
      toast('Ürün kaydedildi');
      if (isNew) go(`#/products/${saved.id}`); else router();
    } catch (e) { fail(e); }
  };
  if (isNew) return;
  $('#del').onclick = async () => {
    try {
      if (p.archived) { await api(`/api/products/${id}`, { method: 'PUT', body: { archived: 0 } }); dropRefs('products'); return router(); }
      if (!(await confirmModal('Ürün silinsin mi? Belgelerde kullanılmışsa arşive alınır.'))) return;
      const r = await api(`/api/products/${id}`, { method: 'DELETE' });
      dropRefs('products');
      toast(r.archived ? 'Ürün belgelerde kullanıldığı için arşive alındı' : 'Ürün silindi');
      go('#/products');
    } catch (e) { fail(e); }
  };
  const [stocks, moves] = await Promise.all([api(`/api/products/${id}/stock`), api(`/api/products/${id}/moves`)]);
  $('#stocks').innerHTML = tableHtml([
    { key: 'name', title: 'Depo' }, { key: 'stock', title: 'Stok', num: true, fmt: (v) => signed(v, qty), total: true },
  ], stocks);
  $('#moves').innerHTML = tableHtml([
    { key: 'moment', title: 'Zaman', nowrap: true },
    { key: 'type', title: 'Belge', fmt: (v, r) => `<a href="#/doc/${r.doc_id}">${esc(META.docTypes[v].single)} №${esc(r.number)}</a>` },
    { key: 'warehouse', title: 'Depo' },
    { key: 'qty', title: 'Miktar', num: true, fmt: (v) => `<span class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${qty(v)}</span>` },
  ], moves, { empty: 'Hareket yok', footer: false });
}

// ---------- Cariler ----------
const ROLE_LABEL = { customer: 'Müşteri', supplier: 'Tedarikçi', '': '—' };
const cpFields = [
  { key: 'name', label: 'Ad / Unvan', required: true, wide: true },
  { key: 'kind', label: 'Tür', type: 'select', options: [['legal', 'Tüzel kişi'], ['person', 'Şahıs']] },
  { key: 'roles', label: 'Rol', type: 'select', options: [['', '—'], ['customer', 'Müşteri'], ['supplier', 'Tedarikçi']] },
  { key: 'tax_office', label: 'Vergi dairesi' },
  { key: 'tax_no', label: 'VKN / TCKN' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'E-posta', type: 'email' },
  { key: 'address', label: 'Adres', type: 'textarea' },
  { key: 'comment', label: 'Not', type: 'textarea' },
];

async function viewCounterparties() {
  const [all, settle] = await Promise.all([api('/api/counterparties'), api('/api/reports/settlements')]);
  const bal = new Map(settle.map((s) => [s.id, s.balance]));
  let q = '';
  let role = '';
  $('#main').innerHTML = `
  <div class="page-head"><h1>Cariler</h1><div class="spacer"></div><button id="csv">CSV indir</button><a class="btn primary" href="#/counterparties/new">+ Cari</a></div>
  <div class="toolbar"><input id="q" placeholder="Ara: ad, VKN, telefon" style="width:280px">
    <select id="role"><option value="">Tüm roller</option><option value="customer">Müşteriler</option><option value="supplier">Tedarikçiler</option></select></div>
  <div id="list"></div>`;
  const cols = [
    { key: 'name', title: 'Ad / Unvan' },
    { key: 'roles', title: 'Rol', fmt: (v) => esc(ROLE_LABEL[v] ?? v) },
    { key: 'tax_no', title: 'VKN / TCKN' },
    { key: 'phone', title: 'Telefon' },
    { key: 'email', title: 'E-posta' },
    { key: 'balance', title: 'Bakiye', num: true, fmt: (v) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${money(v)}</span>` },
  ];
  let rows = [];
  const render = () => {
    const s = q.toLocaleLowerCase('tr');
    rows = all.filter((c) => (!role || c.roles === role) && (!s || [c.name, c.tax_no, c.phone, c.email].some((v) => String(v).toLocaleLowerCase('tr').includes(s))))
      .map((c) => ({ ...c, balance: bal.get(c.id) ?? 0 }));
    $('#list').innerHTML = tableHtml(cols, rows, { click: true, footer: false });
    bindRows($('#list'), rows, (r) => go(`#/counterparties/${r.id}`));
  };
  $('#q').oninput = (e) => { q = e.target.value; render(); };
  $('#role').onchange = (e) => { role = e.target.value; render(); };
  $('#csv').onclick = () => downloadCsv('cariler', cols, rows);
  render();
}

async function viewCounterpartyForm(id) {
  const isNew = id === 'new';
  const c = isNew ? { kind: 'legal' } : await api(`/api/counterparties/${id}`);
  $('#main').innerHTML = `
  <div class="page-head"><a href="#/counterparties" class="muted">← Cariler</a><h1>${isNew ? 'Yeni cari' : esc(c.name)}</h1><div class="spacer"></div>
    ${isNew ? '' : '<button id="del" class="danger">Sil / Arşivle</button>'}<button id="save" class="primary">Kaydet</button></div>
  <div class="card" id="form">${formHtml(cpFields, c)}</div>
  ${isNew ? '' : `<div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">Hesap ekstresi</h2><div class="spacer"></div>
    <a class="btn" href="#/docs/paymentin/new">+ Gelen ödeme</a><a class="btn" href="#/docs/paymentout/new">+ Giden ödeme</a></div><div id="statement"></div></div>`}`;
  $('#save').onclick = async () => {
    try {
      const saved = await api(isNew ? '/api/counterparties' : `/api/counterparties/${id}`, { method: isNew ? 'POST' : 'PUT', body: readForm($('#form'), cpFields) });
      dropRefs('counterparties');
      toast('Cari kaydedildi');
      if (isNew) go(`#/counterparties/${saved.id}`); else router();
    } catch (e) { fail(e); }
  };
  if (isNew) return;
  $('#del').onclick = async () => {
    if (!(await confirmModal('Cari silinsin mi? Belgelerde kullanılmışsa arşive alınır.'))) return;
    try {
      const r = await api(`/api/counterparties/${id}`, { method: 'DELETE' });
      dropRefs('counterparties');
      toast(r.archived ? 'Cari arşive alındı' : 'Cari silindi');
      go('#/counterparties');
    } catch (e) { fail(e); }
  };
  const st = await api(`/api/counterparties/${id}/statement`);
  const last = st.at(-1)?.balance ?? 0;
  $('#statement').innerHTML = `<p>Güncel bakiye: <b class="${last > 0 ? 'pos' : last < 0 ? 'neg' : ''}">${money(Math.abs(last))}</b>
    <span class="muted">${last > 0 ? '(cari bize borçlu)' : last < 0 ? '(biz cariye borçluyuz)' : ''}</span></p>` + tableHtml([
    { key: 'moment', title: 'Zaman', nowrap: true },
    { key: 'type', title: 'Belge', fmt: (v, r) => `<a href="#/doc/${r.id}">${esc(META.docTypes[v].single)} №${esc(r.number)}</a>` },
    { key: 'effect', title: 'Borç (bize)', num: true, fmt: (v) => (v > 0 ? money(v) : '') },
    { key: 'effect', title: 'Alacak (cariye)', num: true, fmt: (v) => (v < 0 ? money(-v) : '') },
    { key: 'balance', title: 'Bakiye', num: true, fmt: (v) => signed(v) },
  ], st, { empty: 'Hareket yok', footer: false });
}

// ---------- Depolar ----------
async function viewWarehouses() {
  const rows = await api('/api/warehouses?archived=all');
  const fields = [{ key: 'name', label: 'Depo adı', required: true, wide: true }, { key: 'address', label: 'Adres', type: 'textarea' }, { key: 'archived', label: 'Arşivde', type: 'checkbox' }];
  $('#main').innerHTML = `<div class="page-head"><h1>Depolar</h1><div class="spacer"></div><button id="add" class="primary">+ Depo</button></div><div id="list"></div>`;
  $('#list').innerHTML = tableHtml([
    { key: 'name', title: 'Ad' }, { key: 'address', title: 'Adres' },
    { key: 'archived', title: 'Durum', fmt: (v) => (v ? '<span class="badge off">Arşivde</span>' : '<span class="badge ok">Aktif</span>') },
  ], rows, { click: true, footer: false });
  const edit = async (w) => {
    const v = await formModal(w ? 'Depoyu düzenle' : 'Yeni depo', fields, w ?? {});
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
  return `<select id="wh"><option value="">Tüm depolar</option>${ws.filter((w) => !w.archived).map((w) => `<option value="${w.id}" ${String(w.id) === String(sel) ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>`;
}

async function viewStock() {
  const st = { warehouse_id: '', group_id: '', q: '', only: '' };
  const groups = await refs('product_groups');
  $('#main').innerHTML = `
  <div class="page-head"><h1>Stok bakiyeleri</h1><div class="spacer"></div><button id="csv">CSV indir</button><a class="btn" href="#/docs/inventory/new">+ Sayım</a></div>
  <div class="toolbar">${await warehouseSelect()}
    <select id="grp"><option value="">Tüm gruplar</option>${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
    <select id="only"><option value="">Tümü</option><option value="positive">Stokta olanlar</option><option value="low">Minimumun altında</option><option value="negative">Eksi stok</option></select>
    <input id="q" placeholder="Ara" style="width:220px"></div>
  <div id="list"></div>`;
  const cols = [
    { key: 'name', title: 'Ürün', fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
    { key: 'code', title: 'Kod' },
    { key: 'unit', title: 'Birim' },
    { key: 'stock', title: 'Stok', num: true, fmt: (v, r) => `<span class="${v < 0 || (r.min_stock > 0 && v < r.min_stock) ? 'neg' : ''}">${qty(v)}</span>`, total: true },
    { key: 'reserve', title: 'Rezerv', num: true, fmt: qty, total: true },
    { key: 'expected', title: 'Beklenen', num: true, fmt: qty, total: true },
    { key: 'available', title: 'Kullanılabilir', num: true, fmt: (v) => signed(v, qty), total: true },
    { key: 'cost', title: 'Birim maliyet', num: true, fmt: money },
    { key: 'stock_cost', title: 'Maliyet tutarı', num: true, fmt: money, total: true },
    { key: 'sale_price', title: 'Satış fiyatı', num: true, fmt: money },
    { key: 'stock_retail', title: 'Satış tutarı', num: true, fmt: money, total: true },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/reports/stock?${qs(st)}`);
    $('#list').innerHTML = tableHtml(cols, rows, { empty: 'Ürün yok' });
  };
  let timer;
  $('#wh').onchange = (e) => { st.warehouse_id = e.target.value; load(); };
  $('#grp').onchange = (e) => { st.group_id = e.target.value; load(); };
  $('#only').onchange = (e) => { st.only = e.target.value; load(); };
  $('#q').oninput = (e) => { st.q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#csv').onclick = () => downloadCsv('stok-bakiyeleri', cols, rows);
  await load();
}

function periodBar(st) {
  return `<label class="muted">Başlangıç <input type="date" id="from" value="${st.from}"></label>
    <label class="muted">Bitiş <input type="date" id="to" value="${st.to}"></label>`;
}

async function viewTurnover() {
  const st = { from: monthStart(), to: today(), warehouse_id: '' };
  $('#main').innerHTML = `<div class="page-head"><h1>Stok hareketleri</h1><div class="spacer"></div><button id="csv">CSV indir</button></div>
    <div class="toolbar">${periodBar(st)}${await warehouseSelect()}</div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: 'Ürün', fmt: (v, r) => `<a href="#/products/${r.id}">${esc(v)}</a>` },
    { key: 'code', title: 'Kod' }, { key: 'unit', title: 'Birim' },
    { key: 'opening', title: 'Dönem başı', num: true, fmt: qty, total: true },
    { key: 'incoming', title: 'Giriş', num: true, fmt: qty, total: true },
    { key: 'outgoing', title: 'Çıkış', num: true, fmt: qty, total: true },
    { key: 'closing', title: 'Dönem sonu', num: true, fmt: (v) => signed(v, qty), total: true },
  ];
  let rows = [];
  const load = async () => { rows = await api(`/api/reports/turnover?${qs(st)}`); $('#list').innerHTML = tableHtml(cols, rows, { empty: 'Bu dönemde hareket yok' }); };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  $('#wh').onchange = (e) => { st.warehouse_id = e.target.value; load(); };
  $('#csv').onclick = () => downloadCsv('stok-hareketleri', cols, rows);
  await load();
}

async function viewProfit() {
  const st = { from: monthStart(), to: today(), by: 'product' };
  $('#main').innerHTML = `<div class="page-head"><h1>Kârlılık</h1><div class="spacer"></div><button id="csv">CSV indir</button></div>
    <div class="toolbar">${periodBar(st)}<div class="tabs" style="margin:0"><button data-by="product" class="active">Ürünlere göre</button><button data-by="counterparty">Carilere göre</button></div></div>
    <div id="sum" class="kpis"></div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: 'Ad' },
    { key: 'qty', title: 'Satılan miktar', num: true, fmt: qty, total: true },
    { key: 'revenue', title: 'Ciro', num: true, fmt: money, total: true },
    { key: 'cost', title: 'Maliyet', num: true, fmt: money, total: true },
    { key: 'profit', title: 'Brüt kâr', num: true, fmt: (v) => signed(v), total: true },
    { key: 'margin', title: 'Marj %', num: true, fmt: (v) => `${nf2.format(v)} %` },
  ];
  let rows = [];
  const load = async () => {
    rows = await api(`/api/reports/profit?${qs(st)}`);
    const rev = rows.reduce((s, r) => s + r.revenue, 0);
    const pr = rows.reduce((s, r) => s + r.profit, 0);
    $('#sum').innerHTML = `<div class="card kpi"><div class="label">Ciro</div><div class="value">${money(rev)}</div></div>
      <div class="card kpi"><div class="label">Maliyet</div><div class="value">${money(rev - pr)}</div></div>
      <div class="card kpi"><div class="label">Brüt kâr</div><div class="value">${signed(pr)}</div></div>
      <div class="card kpi"><div class="label">Marj</div><div class="value">${nf2.format(rev ? (pr / rev) * 100 : 0)} %</div></div>`;
    $('#list').innerHTML = tableHtml(cols, rows, { empty: 'Bu dönemde satış yok' });
  };
  $('#from').onchange = (e) => { st.from = e.target.value; load(); };
  $('#to').onchange = (e) => { st.to = e.target.value; load(); };
  $$('[data-by]').forEach((b) => (b.onclick = () => {
    st.by = b.dataset.by;
    $$('[data-by]').forEach((x) => x.classList.toggle('active', x === b));
    load();
  }));
  $('#csv').onclick = () => downloadCsv('karlilik', cols, rows);
  await load();
}

async function viewSettlements() {
  let q = '';
  $('#main').innerHTML = `<div class="page-head"><h1>Cari hesaplar</h1><div class="spacer"></div><button id="csv">CSV indir</button></div>
    <div class="toolbar"><input id="q" placeholder="Cari ara" style="width:260px"></div><div id="sum" class="kpis"></div><div id="list"></div>`;
  const cols = [
    { key: 'name', title: 'Cari' },
    { key: 'phone', title: 'Telefon' },
    { key: 'receivable', title: 'Alacağımız', num: true, fmt: (v) => (v ? `<span class="pos">${money(v)}</span>` : ''), total: true },
    { key: 'payable', title: 'Borcumuz', num: true, fmt: (v) => (v ? `<span class="neg">${money(v)}</span>` : ''), total: true },
    { key: 'last_moment', title: 'Son işlem', nowrap: true },
  ];
  let rows = [];
  const load = async () => {
    rows = (await api(`/api/reports/settlements?${qs({ q })}`)).map((r) => ({ ...r, receivable: Math.max(r.balance, 0), payable: Math.max(-r.balance, 0) }));
    const rec = rows.reduce((s, r) => s + r.receivable, 0);
    const pay = rows.reduce((s, r) => s + r.payable, 0);
    $('#sum').innerHTML = `<div class="card kpi"><div class="label">Toplam alacak</div><div class="value pos">${money(rec)}</div></div>
      <div class="card kpi"><div class="label">Toplam borç</div><div class="value neg">${money(pay)}</div></div>
      <div class="card kpi"><div class="label">Net</div><div class="value">${signed(rec - pay)}</div></div>`;
    $('#list').innerHTML = tableHtml(cols, rows, { click: true });
    bindRows($('#list'), rows, (r) => go(`#/counterparties/${r.id}`));
  };
  let timer;
  $('#q').oninput = (e) => { q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#csv').onclick = () => downloadCsv('cari-hesaplar', cols, rows);
  await load();
}

async function viewMoney() {
  const st = { from: monthStart(), to: today() };
  $('#main').innerHTML = `<div class="page-head"><h1>Kasa ve banka</h1><div class="spacer"></div>
    <a class="btn" href="#/docs/paymentin/new">+ Gelen ödeme</a><a class="btn" href="#/docs/paymentout/new">+ Giden ödeme</a></div>
    <div class="toolbar">${periodBar(st)}</div><div id="out"></div>`;
  const load = async () => {
    const m = await api(`/api/reports/money?${qs(st)}`);
    $('#out').innerHTML = `<div class="kpis">
      ${m.accounts.map((a) => `<div class="card kpi"><div class="label">${esc(a.account)} (dönem sonu)</div><div class="value">${signed(a.balance)}</div></div>`).join('')}
      <div class="card kpi"><div class="label">Dönem girişleri</div><div class="value pos">${money(m.income)}</div></div>
      <div class="card kpi"><div class="label">Dönem çıkışları</div><div class="value neg">${money(m.expense)}</div></div>
      <div class="card kpi"><div class="label">Net nakit akışı</div><div class="value">${signed(m.income - m.expense)}</div></div></div>
      <h2>Kategorilere göre</h2>${tableHtml([{ key: 'category', title: 'Kategori' }, { key: 'amount', title: 'Tutar', num: true, fmt: (v) => signed(v), total: true }], m.byCategory, { empty: 'Bu dönemde hareket yok' })}`;
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
  let filter = '';
  let wh = Number(localStorage.getItem('vordi-pos-wh')) || warehouses.find((w) => !w.archived)?.id;
  $('#main').innerHTML = `
  <div class="pos-screen">
    <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
      <div class="toolbar" style="margin:0"><div id="picker" style="flex:1"></div>
        <select id="pos-wh">${warehouses.filter((w) => !w.archived).map((w) => `<option value="${w.id}" ${w.id === wh ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
      <input id="tile-filter" placeholder="Ürünleri filtrele">
      <div class="tiles" id="tiles"></div>
    </div>
    <div class="card cart">
      <h2>Sepet</h2>
      <div class="items" id="cart"></div>
      <div class="total" id="total"></div>
      <div style="display:flex;gap:8px"><button class="big" id="clear" style="flex:0">Temizle</button>
        <button class="big primary" id="cash" style="flex:1;justify-content:center">Nakit</button>
        <button class="big primary" id="card" style="flex:1;justify-content:center">Kart</button></div>
    </div>
  </div>`;
  const add = (p) => {
    const ex = cart.find((l) => l.product_id === p.id);
    if (ex) ex.qty += 1; else cart.push({ product_id: p.id, product: p.name, unit: p.unit, qty: 1, price: p.sale_price, vat: p.vat });
    renderCart();
  };
  const renderTiles = () => {
    const s = filter.toLocaleLowerCase('tr');
    const list = active.filter((p) => !s || p.name.toLocaleLowerCase('tr').includes(s) || p.barcode.includes(s)).slice(0, 120);
    $('#tiles').innerHTML = list.map((p) => `<button class="tile" data-id="${p.id}"><span>${esc(p.name)}</span>
      <span style="display:flex;justify-content:space-between;width:100%"><span class="price">${money(p.sale_price)}</span>${p.is_service ? '' : `<span class="muted">${qty(stockMap.get(p.id) ?? 0)}</span>`}</span></button>`).join('');
  };
  const total = () => cart.reduce((s, l) => s + l.qty * l.price, 0);
  const renderCart = () => {
    $('#cart').innerHTML = cart.length ? `<table><tbody>${cart.map((l, i) => `<tr data-i="${i}"><td>${esc(l.product)}<div class="muted">${money(l.price)}</div></td>
      <td><span class="qty-ctl"><button data-d="-1">−</button><input value="${l.qty}" data-q><button data-d="1">+</button></span></td>
      <td class="num">${money(l.qty * l.price)}</td><td><button data-x>✕</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Sepet boş — ürün seçin veya barkod okutun</div>';
    $('#total').textContent = money(total());
  };
  $('#tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (b) add(active.find((p) => p.id === Number(b.dataset.id))); };
  $('#cart').onclick = (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const i = Number(tr.dataset.i);
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
  const pay = async (account) => {
    if (!cart.length) return toast('Sepet boş', true);
    try {
      const doc = await api('/api/documents', { method: 'POST', body: {
        type: 'retaildemand', warehouse_id: wh, account, counterparty_id: Number(META.settings.retail_counterparty_id) || null, lines: cart,
      } });
      toast(`Satış №${doc.number} tamamlandı: ${money(doc.sum)} (${account})`);
      for (const l of cart) stockMap.set(l.product_id, (stockMap.get(l.product_id) ?? 0) - l.qty);
      cart.length = 0;
      renderCart(); renderTiles();
      $('#picker input').focus();
    } catch (e) { fail(e); }
  };
  $('#cash').onclick = () => pay('Kasa');
  $('#card').onclick = () => pay('Banka');
  productPicker($('#picker'), add, { placeholder: 'Barkod okutun veya ürün arayın…' }).focus();
  renderTiles(); renderCart();
}

// ---------- Ayarlar ----------
async function viewSettings() {
  const s = await api('/api/settings');
  const cps = await refs('counterparties', true);
  const fields = [
    { key: 'company_name', label: 'Şirket adı', required: true },
    { key: 'company_tax_no', label: 'VKN' },
    { key: 'currency', label: 'Para birimi simgesi' },
    { key: 'retail_counterparty_id', label: 'Perakende satış carisi', type: 'select', options: cps.map((c) => [c.id, c.name]) },
    { key: 'company_address', label: 'Adres', type: 'textarea' },
  ];
  $('#main').innerHTML = `
  <div class="page-head"><h1>Ayarlar</h1></div>
  <div class="grid cols-2">
    <div class="card"><h2>Şirket</h2><div id="sform">${formHtml(fields, s)}</div>
      <div style="margin-top:12px"><button id="ssave" class="primary" ${ME.role !== 'admin' ? 'disabled' : ''}>Kaydet</button></div></div>
    <div class="card"><h2>Hesabım</h2><p>${esc(ME.name)} (${esc(ME.username)}) · ${ME.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</p><button id="pw">Şifremi değiştir</button></div>
  </div>
  ${ME.role === 'admin' ? '<div style="margin-top:12px"><div class="page-head"><h2 style="margin:0">Kullanıcılar</h2><div class="spacer"></div><button id="uadd" class="primary">+ Kullanıcı</button></div><div id="users"></div></div>' : ''}`;
  $('#ssave').onclick = async () => {
    try { META.settings = await api('/api/settings', { method: 'PUT', body: readForm($('#sform'), fields) }); toast('Ayarlar kaydedildi'); renderShell(); router(); } catch (e) { fail(e); }
  };
  $('#pw').onclick = async () => {
    const v = await formModal('Şifre değiştir', [{ key: 'password', label: 'Yeni şifre', type: 'password', required: true, wide: true }]);
    if (!v) return;
    try { await api(`/api/users/${ME.id}`, { method: 'PUT', body: v }); toast('Şifre değiştirildi'); } catch (e) { fail(e); }
  };
  if (ME.role !== 'admin') return;
  const users = await api('/api/users');
  $('#users').innerHTML = tableHtml([
    { key: 'username', title: 'Kullanıcı adı' }, { key: 'name', title: 'Ad soyad' },
    { key: 'role', title: 'Rol', fmt: (v) => (v === 'admin' ? 'Yönetici' : 'Kullanıcı') },
    { key: 'archived', title: 'Durum', fmt: (v) => (v ? '<span class="badge off">Pasif</span>' : '<span class="badge ok">Aktif</span>') },
    { key: 'created_at', title: 'Oluşturulma' },
  ], users, { click: true, footer: false });
  const roleOpt = [['user', 'Kullanıcı'], ['admin', 'Yönetici']];
  bindRows($('#users'), users, async (u) => {
    const v = await formModal(`Kullanıcı: ${u.username}`, [
      { key: 'name', label: 'Ad soyad' }, { key: 'role', label: 'Rol', type: 'select', options: roleOpt },
      { key: 'password', label: 'Yeni şifre (boş bırakılabilir)', type: 'password' }, { key: 'archived', label: 'Pasif', type: 'checkbox' },
    ], u);
    if (!v) return;
    try { await api(`/api/users/${u.id}`, { method: 'PUT', body: v }); router(); } catch (e) { fail(e); }
  });
  $('#uadd').onclick = async () => {
    const v = await formModal('Yeni kullanıcı', [
      { key: 'username', label: 'Kullanıcı adı', required: true }, { key: 'name', label: 'Ad soyad' },
      { key: 'password', label: 'Şifre', type: 'password', required: true }, { key: 'role', label: 'Rol', type: 'select', options: roleOpt },
    ]);
    if (!v) return;
    try { await api('/api/users', { method: 'POST', body: v }); router(); } catch (e) { fail(e); }
  };
}

boot().then(() => { if (!ME) renderLogin(); });
