// vd-bundle.css'in eski inline <style> bloklarıyla birebir aynı sonucu verdiğini canlı sitede doğrular.
//
// Her sayfa bir kez açılır (site JS'i normal çalışır), tüm elementlerin hesaplanmış stilleri ve
// konumları ölçülür. Sonra AYNI sayfada özel <style> blokları silinir, yerine theme/assets/vd-bundle.css
// ve vd-late.css içerikleri eski yerlerine eklenir ve tekrar ölçülür. Aynı DOM kullanıldığı için rastgele ürün
// önerileri vb. sonucu etkilemez; fark çıkarsa nedeni yalnızca CSS'tir.
//
// Kullanım: NODE_PATH=$(npm root -g) node tools/verify.js [yol ...]
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// src/css dosyası -> blok id'si; ilk satırdaki (head)/(body) işareti hangi pakete gittiğini söyler
const SRC = fs.readdirSync(path.join(ROOT, 'src/css')).sort().map(f => ({
  id: f.replace(/^\d+-/, '').replace(/\.css$/, ''),
  late: read('src/css/' + f).split('\n')[0].includes('(body)'),
}));
const GROUPS = [
  { ids: SRC.filter(s => !s.late).map(s => s.id), css: read('theme/assets/vd-bundle.css') },
  { ids: SRC.filter(s => s.late).map(s => s.id), css: read('theme/assets/vd-late.css') },
];
const ORIGIN = 'https://vordien.ru';
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/collection/all', '/collection/halaty', '/product/halat-nusa-7260', '/cart_items',
  '/blogs/blog/razmery-polotenets-kakoe-dlya-chego', '/page/contacts', '/page/opt', '/collection/brendy',
];
const PROPS = ['display', 'position', 'visibility', 'opacity', 'color', 'background-color', 'background-image',
  'font-family', 'font-size', 'font-weight', 'line-height', 'text-transform', 'text-align', 'margin-top',
  'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border-top-width', 'border-top-color', 'border-radius', 'box-shadow', 'width', 'height', 'z-index', 'gap',
  'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'overflow-x', 'filter', 'transform',
  'pointer-events', 'content-visibility', 'top', 'bottom', 'left', 'right', 'cursor', 'white-space'];

function measure(PROPS) {
  const skip = { SCRIPT: 1, STYLE: 1, LINK: 1, NOSCRIPT: 1 };
  const els = [...document.querySelectorAll('html, body, body *')].filter(e => !skip[e.tagName] && !e.closest('[data-vd-test]'));
  const out = els.map(e => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
      (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    return [name, PROPS.map(k => cs.getPropertyValue(k)), [r.x, r.y, r.width, r.height].map(Math.round).join(',')];
  });
  for (const pseudo of ['::before', '::after']) {
    els.forEach((e, i) => { const c = getComputedStyle(e, pseudo).content; out[i][1].push(c); });
  }
  return out;
}

// Her grubun bloklarını siler, paket içeriğini o grubun ilk bloğunun yerine koyar
// (canlıda <link> ile yüklenecek dosyanın cascade'deki yerini taklit eder).
function swap(GROUPS) {
  const all = [...document.querySelectorAll('style')];
  const isAnon = s => !s.id && s.textContent.trim().startsWith('.vd-brendy-h');
  return GROUPS.map(g => {
    let anchor = null;
    all.forEach(s => {
      if (g.ids.includes(s.id) || (isAnon(s) && g.ids.includes('vd-brendy-h'))) {
        if (!anchor) { anchor = document.createElement('style'); anchor.setAttribute('data-vd-test', '1'); anchor.textContent = g.css; s.before(anchor); }
        s.remove();
      }
    });
    return !!anchor;
  }).every(Boolean);
}

(async () => {
  const browser = await chromium.launch();
  const shots = path.join(ROOT, 'verify-shots');
  fs.mkdirSync(shots, { recursive: true });
  let total = 0, checked = 0;
  for (const url of PAGES) {
    for (const [dname, dev] of [['mobile', devices['iPhone 13']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
      const ctx = await browser.newContext({ ...dev, locale: 'ru-RU' });
      await ctx.route(/mc\.yandex|google-analytics|googletagmanager|counter\.insales/, r => r.abort());
      const p = await ctx.newPage();
      try {
        await p.goto(ORIGIN + url, { waitUntil: 'load', timeout: 90000 });
      } catch (e) { console.log(url, dname, 'AÇILAMADI:', e.message.split('\n')[0]); await ctx.close(); continue; }
      await p.waitForTimeout(4000);
      // öneri kutuları vb. asenkron dolar: iskelet kartlar kaybolup element sayısı sabitlenene kadar bekle
      await p.waitForFunction(() => !document.querySelector('.is-skel'), null, { timeout: 20000 }).catch(() => {});
      await p.waitForFunction(() => {
        const n = document.getElementsByTagName('*').length;
        const ok = window.__vdN === n; window.__vdN = n; return ok;
      }, null, { polling: 1000, timeout: 20000 }).catch(() => {});
      // animasyonları durdur ki ölçüm anı sonucu etkilemesin
      await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      await p.waitForTimeout(300);
      const slug = (url.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home') + '_' + dname;
      const a = await p.evaluate(measure, PROPS);
      await p.screenshot({ path: path.join(shots, slug + '_A.png') });
      const ok = await p.evaluate(swap, GROUPS);
      if (!ok) { console.log(url, dname, 'özel blok bulunamadı'); await ctx.close(); continue; }
      await p.waitForTimeout(500);
      const b = await p.evaluate(measure, PROPS);
      await p.screenshot({ path: path.join(shots, slug + '_B.png') });
      await ctx.close();
      const diffs = [];
      if (a.length !== b.length) diffs.push(`element sayısı farklı: ${a.length} / ${b.length}`);
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const [na, sa, ra] = a[i], [, sb, rb] = b[i];
        const keys = PROPS.concat(['::before content', '::after content']);
        const which = keys.filter((k, j) => sa[j] !== sb[j]).map(k => `${k}: ${sa[keys.indexOf(k)]} → ${sb[keys.indexOf(k)]}`);
        if (which.length) diffs.push(`${na}  ${which.join('; ')}`);
        else if (ra !== rb) diffs.push(`${na}  konum ${ra} → ${rb}`);
      }
      checked++;
      total += diffs.length;
      console.log(`${url} [${dname}] elementler=${a.length} fark=${diffs.length}`);
      diffs.slice(0, 15).forEach(d => console.log('   ', d.slice(0, 240)));
    }
    await new Promise(r => setTimeout(r, 2500));
  }
  await browser.close();
  console.log(`${checked} sayfa görünümü kontrol edildi. ` + (total ? `TOPLAM FARK: ${total}` : 'TAMAM: hiçbir fark yok'));
  process.exitCode = total || !checked ? 1 : 0;
})();
