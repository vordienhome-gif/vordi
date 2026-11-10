import { useSyncExternalStore } from 'react';

const ru = {
  appTitle: 'Склад',
  login: 'Логин', password: 'Пароль', signIn: 'Войти', signOut: 'Выйти',
  enter: 'Оприходование', loss: 'Списание', move: 'Перемещение', inventory: 'Инвентаризация', lookup: 'Проверить товар',
  enterHint: 'Приход товара на склад', lossHint: 'Расход, брак, недостача', moveHint: 'Между складами', inventoryHint: 'Пересчёт остатков', lookupHint: 'Остатки по штрихкоду',
  warehouse: 'Склад', targetWarehouse: 'Склад-получатель', choose: 'Выберите…',
  scanHint: 'Сканируйте штрихкод сканером или камерой', camera: 'Камера', closeCamera: 'Закрыть камеру', manual: 'Ввести код вручную', add: 'Добавить',
  items: 'Позиций', total: 'Всего', comment: 'Комментарий',
  saveDraft: 'Сохранить черновик', post: 'Провести', apply: 'Провести и применить',
  saved: 'Документ сохранён', posted: 'Документ проведён', notFound: 'Товар не найден', needCode: 'Отсканируйте код маркировки (DataMatrix)',
  duplicateCode: 'Этот код уже отсканирован', back: 'Назад', clear: 'Очистить', confirmClear: 'Удалить все позиции?',
  stock: 'Остаток', reserve: 'Резерв', available: 'Доступно', counted: 'Посчитано', codes: 'Кодов',
  empty: 'Пока ничего не отсканировано', needWarehouse: 'Выберите склад', needTarget: 'Выберите склад-получатель',
  inventoryApplied: 'Излишки оприходованы, недостачи списаны', cameraError: 'Нет доступа к камере (нужен HTTPS и разрешение)',
  lang: 'Türkçe',
};
type Dict = typeof ru;
const tr: Dict = {
  appTitle: 'Depo',
  login: 'Kullanıcı adı', password: 'Şifre', signIn: 'Giriş', signOut: 'Çıkış',
  enter: 'Stok girişi', loss: 'Stok çıkışı / zayiat', move: 'Depolar arası transfer', inventory: 'Sayım', lookup: 'Ürün sorgula',
  enterHint: 'Depoya mal girişi', lossHint: 'Çıkış, fire, eksik', moveHint: 'Depodan depoya', inventoryHint: 'Stok sayımı', lookupHint: 'Barkoddan stok bilgisi',
  warehouse: 'Depo', targetWarehouse: 'Hedef depo', choose: 'Seçin…',
  scanHint: 'Barkodu okuyucuyla veya kamerayla okutun', camera: 'Kamera', closeCamera: 'Kamerayı kapat', manual: 'Kodu elle gir', add: 'Ekle',
  items: 'Kalem', total: 'Toplam', comment: 'Not',
  saveDraft: 'Taslak kaydet', post: 'İşle', apply: 'İşle ve uygula',
  saved: 'Belge kaydedildi', posted: 'Belge işlendi', notFound: 'Ürün bulunamadı', needCode: 'Markalama kodunu (DataMatrix) okutun',
  duplicateCode: 'Bu kod zaten okutuldu', back: 'Geri', clear: 'Temizle', confirmClear: 'Tüm kalemler silinsin mi?',
  stock: 'Stok', reserve: 'Rezerv', available: 'Kullanılabilir', counted: 'Sayılan', codes: 'Kod',
  empty: 'Henüz bir şey okutulmadı', needWarehouse: 'Depo seçin', needTarget: 'Hedef depoyu seçin',
  inventoryApplied: 'Fazlalar girildi, eksikler düşüldü', cameraError: 'Kameraya erişilemiyor (HTTPS ve izin gerekli)',
  lang: 'Русский',
};

type Lang = 'ru' | 'tr';
let lang: Lang = (() => { try { return (localStorage.getItem('lang') as Lang) || 'ru'; } catch { return 'ru'; } })();
const listeners = new Set<() => void>();

export function toggleLang() {
  lang = lang === 'ru' ? 'tr' : 'ru';
  try { localStorage.setItem('lang', lang); } catch { /* özel pencere */ }
  listeners.forEach((l) => l());
}

export function useT(): Dict {
  const l = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => lang);
  return l === 'tr' ? tr : ru;
}
