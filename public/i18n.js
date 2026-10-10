// Basit çeviri katmanı: kaynak dil Türkçedir, anahtar olarak Türkçe metin kullanılır.
// t('Kaydet') → seçili dil Rusça ise 'Сохранить'. Çevirisi olmayan metin olduğu gibi döner.
// Yer tutucular: t('{0} kaydedildi', 'Belge') → 'Belge kaydedildi'.
import RU from './lang/ru.js';

const DICTS = { tr: {}, ru: RU };
export const LANGS = [['ru', 'Русский'], ['tr', 'Türkçe']];

function initial() {
  try {
    const saved = localStorage.getItem('vordi-lang');
    if (saved && DICTS[saved]) return saved;
  } catch { /* depolama kapalı olabilir */ }
  return /^tr/i.test(navigator.language) ? 'tr' : 'ru';
}

let current = initial();
document.documentElement.lang = current;

export const lang = () => current;
export const locale = () => (current === 'ru' ? 'ru-RU' : 'tr-TR');
export function setLang(l) {
  if (!DICTS[l]) return;
  current = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('vordi-lang', l); } catch { /* yok say */ }
}
// Sunucudan gelen değişkenli mesajlar ("Kod zaten satılmış: 0104…") için şablon eşleştirme.
const patterns = {};
function fromPattern(s) {
  patterns[current] ??= Object.keys(DICTS[current]).filter((k) => /\{\d+\}/.test(k) && !k.startsWith('{')).map((k) => [
    new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, '(.*)') + '$', 's'), k,
  ]);
  for (const [re, k] of patterns[current]) {
    const m = re.exec(s);
    if (m) return DICTS[current][k].replace(/\{(\d+)\}/g, (_, i) => fromPattern(m[Number(i) + 1] ?? ''));
  }
  return s;
}

export function t(s, ...args) {
  if (!(s in DICTS[current]) && !args.length && typeof s === 'string') return fromPattern(s);
  const out = DICTS[current][s] ?? s;
  return args.length ? out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : out;
}
