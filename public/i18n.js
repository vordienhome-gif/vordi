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
export function t(s, ...args) {
  const out = DICTS[current][s] ?? s;
  return args.length ? out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : out;
}
