# Elitmosteks — site denetimi ve B2B yol haritası (12.10.2026)

Mağaza: https://myshop-dfp694.myinsales.ru · InSales + МойСклад · 1000 ürün (834 görünür) · henüz 0 müşteri, 0 sipariş.

## Sitenin çalışma mantığı

- Ziyaretçi ürünleri ve stok durumunu görür, fiyatları göremez ("Цена после подтверждения").
- Giriş yapmış ama grubu atanmamış müşteri "заявка на рассмотрении" mesajını görür.
- Yönetici ИНН'yi kontrol eder ve müşteriyi bir müşteri grubuna atar. Gruplar: Оптовая цена, Крупный опт, Дропшиппинг, Опт рынок, Опт рынок крупный.
- Atanan grup, fiyat türünü belirler: Опт Безнал = price2, Опт. Рынок = price3, Опт. Рынок Круп. = price4.
- Onaylı müşteri yalnızca tema ayarındaki `approved_groups` listesindeki gruplar için fiyatları görür ve sipariş verir.
- Minimum sipariş 50 000 ₽'dir. `nomin_groups` listesindeki gruplar bu sınırdan muaftır.
- Mantık `snippets/vo-access.liquid` dosyasındadır.

## Bugün yapılanlar

- Yeni tasarım yayına alındı. Değişen alanlar: üst bar, başlık, ana sayfa, ürün özellikleri filtresi ve ikonlar.
- `theme.js` her sayfada `$ is not defined` hatasıyla duruyordu. Bunun sonucunda:
  - Formlar şirket/ИНН/şehir gibi ek alanları göndermiyordu.
  - 50 000 ₽ çubuğu çalışmıyordu.
  - Katalog görünümü ve "sadece stoktakiler" çalışmıyordu.
  - Canlı sitede `snippets/scripts.liquid` içine eklenen bir satırla düzeltildi. Depodaki `theme.js` dosyası da düzeltildi; CDN gecikmesi riski nedeniyle henüz yüklenmedi.
- Ürünü olmayan kategoriler artık menüde, ana sayfada ve alt bilgide gösterilmiyor (örn. "Одежда").

## Kritik — yönetici panelinden yapılması gerekenler

1. **Toptan fiyatlar herkese açık JSON'da.**
   - `/collection/all.json`, `/product/<handle>.json` ve `/search.json` adresleri giriş gerektirmeden `price2/price3/price4` değerlerini ve depo bazında stoğu veriyor. 8 istekle tüm fiyat listesi çekilebiliyor.
   - Tema ile kapatılamaz. InSales desteğine "скрыть цены для неавторизованных покупателей, в том числе в JSON" diye sorulmalı. Alternatif olarak toptan fiyatlar yalnızca fiyat listesi/kabinet üzerinden verilmeli.
2. **Minimum sipariş sunucuda zorunlu değil.**
   - `minimum_items_price` boş, hızlı sipariş (quick checkout) açık.
   - Настройки → Оформление заказа bölümünde minimum tutar girilmeli (gerekirse teslimat yöntemine göre). Hızlı sipariş ve misafir siparişi kapatılmalı.
3. **Kayıt B2B'ye uygun değil.**
   - Bireysel müşteri tipi açık, tüzel kişide ИНН zorunlu değil.
   - Bireysel tip kapatılmalı, ИНН ve şirket adı zorunlu yapılmalı.

## Yüksek

- **Yasal sayfalar:**
  - `politika`, `agreement` ve `oferta` sayfaları elitmosteks.ru alan adını anıyor, ancak site bu alan adında çalışmıyor.
  - Sitede hiç e-posta adresi yok (152-ФЗ başvuruları için gerekli).
  - Politika metni Метрика'dan söz ediyor ama sayaç kurulu değil. Sber ID ile girişten hiç söz etmiyor.
  - "Оферта и политика конфиденциальности" bağlantısı tedarik sözleşmesine (`/page/oferta`) gidiyor.
- **Ürün verisi:**

  | Sorun | Sayı |
  |---|---|
  | Görünür üründe fotoğraf yok | 393 |
  | Taban (perakende) fiyatı 0 olan varyant | 433 |
  | "Опт. Рынок" fiyatı girilmemiş varyant | 758 |
  | "Рынок Круп." fiyatı "Рынок" fiyatından yüksek | 191 |
  | Toptan fiyat perakendenin üstünde | 96 |
  | Tekrarlanan SKU | 172 |
  | SKU'su olmayan varyant | 62–114 |

  - Marka riski: "Maison Dior" ve "Versace" adlı ürünler var.
  - Konu dışı ürünler: deodorant, paspas seti.
  - Ürün özelliklerinde demo değerler var (Бренд: Apple, Parker…).
- **Analitik:** Яндекс Метрика kurulu değil.

## Orta / düşük

- **SEO:**
  - Ana sayfanın başlığı ve açıklaması sadece "Elitmosteks". Organization JSON-LD yok.
  - Kart görsellerinde `alt=""`.
  - 16 sayfada açıklama, başlıkla aynı.
- **Blog:** Demo adresler (`/blogs/blog/first…`) ve "тег 1–3" etiketleri sitemap'te.
- **Boş veya çok küçük kategoriler:** zhenskaya/muzhskaya-odezhda, domashnie-halaty, kovry-i-kovrovye-dorozhki, detskaya (3 ürün).

## Yol haritası

### Hızlı kazanımlar (1–2 gün)

1. **Panel ayarları:** minimum sipariş, quick checkout'un kapatılması, ИНН'nin zorunlu olması, bireysel müşteri tipinin kapatılması.
2. **Метрика:**
   - E-ticaret (dataLayer) açılmalı.
   - Hedefler: başvuru, fiyat listesi talebi, Telegram/WhatsApp tıklaması.
3. **Ziyaretçiye fiyat ipucu:** "опт от … ₽" veya perakende fiyat gösterilip "Узнать свою цену" çağrısı yapılmalı. Fiyatın tamamen gizlenmesi dönüşümü ve Yandex'teki ticari güveni düşürür (NN/g).
4. **Güven sayfası:** rekvizitler, ТР ТС 017/2011 beyannameleri (PDF), Balaşiha deposunun fotoğrafları, markalar, Честный ЗНАК/ЭДО politikası.
5. **İletişim:** WhatsApp ve MAX düğmeleri, geri arama formu, kabinette kişisel menajer kartı.
6. **SEO temeli:** ana sayfa başlığı/açıklaması, Organization JSON-LD, kartlarda alt metin.

### Sonraki adımlar (1–2 hafta)

1. **Hızlı sipariş:** ürün sayfasında beden × renk matrisi, katalogda tablo görünümü, kat sayısı (кратность) kuralı.
2. **Grup bazlı fiyat listesi:** МойСклад "Умный прайс" uygulamasıyla, Excel/YML formatında, e-posta veya Telegram ile otomatik gönderim.
3. **Satıcı kiti:** ürün başına fotoğraf ZIP'i; barkod/GTIN, bileşim ve ölçüleri içeren YML/Excel beslemesi.
4. **Kayıt:** "Поиск по ИНН" uygulaması (DaData), ЭДО ID ve segment alanları.
5. **Lojistik ve belgeler:** СДЭК modülü, transport şirketi hesaplayıcı bağlantısı, Диадок/СБИС (МойСклад).
6. **İçerik:** segment açılış sayfaları — "турецкое постельное бельё оптом", "полотенца для гостиниц оптом", "текстиль для селлеров WB".

### Daha sonra

- Excel/CSV'den sipariş yükleme.
- Kabinette belgeler: счёт, УПД, акт сверки, borç ve kredi limiti (МойСклад API).
- Kademeli отсрочка.
- Ticari teklif (КП) PDF'i.
- Dropship stok API'si.

## Rakip örnekleri

| Site | Öne çıkan |
|---|---|
| karven.ru | Fiyat listesi yalnızca kayıtlı kullanıcıya; sertifika galerisi |
| ivunitex.ru | Fiyatlar herkese açık; sepette minimum tutar; tek tıkla tekrar sipariş |
| bellestoreopt.ru | WB/Ozon satıcıları için FBS rezervi; 3. siparişten sonra отсрочка ve daha düşük minimum |
| sima-land.ru | Filigransız fotoğraf arşivi; satıcı hizmetleri |
| vseinstrumenti.ru/b2b | Kişisel menajer; ЭДО; şirket içi çoklu kullanıcı |
