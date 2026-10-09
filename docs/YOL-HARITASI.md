# МойСклад seviyesine giden yol haritası (Rusya)

МойСклад tek bir program değil; birbirine bağlı birçok üründen oluşan bir ekosistem: web uygulaması, mobil uygulamalar, kasa programı, fiskal cihaz entegrasyonları, devlet sistemleri (Честный знак, ЕГАИС, ЭДО), pazaryeri ve internet mağazası bağlantıları. Bunu "birebir" kopyalamak yıllar süren bir iş. Ama sizin işinizin gerçekten ihtiyaç duyduğu kısmını birkaç ayda, adım adım kurmak mümkün. Bu belge o adımları sıralıyor.

## Şu an hazır olanlar

| Alan | Durum |
|---|---|
| Depo, alış, satış, cari, para modülleri | ✅ Çalışıyor |
| Rusça + Türkçe arayüz | ✅ Dil seçici her ekranda var |
| Rusya ayarları | ✅ ₽, НДС 22/20/10/7/5/0 % ve "без НДС", ИНН/КПП, СНО (ОСН, УСН, ЕСХН, Патент) |
| Online kasa (54-ФЗ) | ✅ АТОЛ Web Server ile satış/iade fişi, vardiya açma, X ve Z raporu; cihazsız test modu |
| İnternet mağazası | ✅ Token korumalı REST API: ürün, stok, sipariş (bkz. [API.md](API.md)) |
| Mobil | ✅ PWA: telefonda "ana ekrana ekle" ile uygulama gibi açılır, telefon düzenine uyumlu |

## Gerçek kasada devreye alma (yapılması gerekenler)

Fişi Vordi değil, **kasadaki fiskal cihaz (ККТ)** keser. Bu yüzden yazılım tarafının yanında şunlar gerekir:

1. ФНС'de kayıtlı bir ККТ (ör. АТОЛ 30Ф/22Ф, Эвотор) ve içinde fiskal hafıza (ФН).
2. Bir ОФД ile sözleşme (Такском, Первый ОФД, Платформа ОФД…).
3. Kasa bilgisayarına **АТОЛ ДТО 10** sürücüsü ve **АТОЛ Web Server** kurulumu.
4. Vordi'de *Настройки → Касса и интеграции*: mod "АТОЛ Web Server", vergi sistemi, kasiyer adı ve ИНН.
5. Gerçek cihazda deneme: fiş, iade, vardiya kapatma. (Kod АТОЛ'ün JSON görev formatına göre yazıldı, ancak gerçek cihazla henüz test edilmedi. İlk kurulumda birlikte kontrol etmemiz gerekiyor.)

## Sonraki aşamalar

Süreler 2–3 geliştiricilik bir ekip için yaklaşık tahminlerdir. Sıralama sizin işinize göre değişebilir.

### Aşama 1 — Mağaza ve internet satışını tamamlamak (≈ 1–2 ay)

- **Честный знак (markalama):** kasada DataMatrix kodu okutma, kodu fişe ekleme (ФФД 1.2), satıştan önce kodun çevrim içi kontrolü (разрешительный режим). Markalı ürün (giyim, ayakkabı, su, süt ürünleri, parfüm vb.) satıyorsanız **zorunlu**.
- **Telefon kamerasıyla barkod okutma** (PWA içinde) ve Android el terminalleri (ТСД) desteği.
- **Varyantlar** (beden/renk), fiyat listeleri ve indirimler.
- **1С-Битрикс / CommerceML** değişim formatı: Bitrix, InSales gibi platformlar ek modül yazmadan bağlanır.
- Sipariş durumu değişince siteye **webhook** bildirimi.
- **СДЭК, Boxberry, Почта России** ile kargo etiketi ve takip.

### Aşama 2 — Mobil ve çoklu kanal (≈ 2–3 ay)

- **Native mobil uygulama** (Android/iOS): çevrim dışı çalışan kasa, depo sayımı, sevkiyat toplama.
- **Pazaryerleri:** Ozon, Wildberries, Яндекс Маркет; stok ve sipariş senkronizasyonu.
- **ЭДО:** Диадок / СБИС / Контур üzerinden УПД gönderme ve alma (markalı ürün kabulünde zorunlu).
- **Ödemeler:** СБП ile QR ödeme ve banka POS entegrasyonu.

### Aşama 3 — Kurumsal özellikler (≈ 3+ ay)

- **ЕГАИС** (alkol satışı için УТМ entegrasyonu), **Меркурий/ВетИС** (hayvansal ürünler).
- **1С:Бухгалтерия**'ya aktarım (muhasebeciniz için).
- Banka hesap ekstresi içe aktarma (Т-Банк, Точка, Сбер API).
- Ayrıntılı rol ve izinler, işlem geçmişi, çoklu şirket ve şube.
- Üretim (reçete), seri/parti ve son kullanma tarihi, FIFO maliyet.
- CRM, görevler ve SMS/e-posta bildirimleri.

## Yasal ve altyapı notları (önemli)

- **152-ФЗ:** Rus vatandaşlarının kişisel verileri (müşteri adı, telefon, e-posta) **Rusya'daki sunucularda** tutulmalıdır. Sunucuyu Yandex Cloud, Selectel veya VK Cloud gibi Rus bir sağlayıcıda kurmalı ve Роскомнадзор'a kişisel veri operatörü olarak bildirim yapmalısınız.
- **HTTPS zorunlu:** internet mağazası API'si ve mobil (PWA) için alan adı ve SSL sertifikası gerekir.
- **Yedekleme:** veritabanı dosyasının (`data/vordi.db`) günlük yedeği alınmalıdır.
- Saat dilimi varsayılan olarak `Europe/Moscow`'dur; farklı bölgedeyseniz `TZ` ortam değişkeniyle ayarlanır.

## Önceliği belirlemek için bilmem gerekenler

1. Hangi ürünleri satıyorsunuz? Markalı (Честный знак) veya alkol var mı?
2. Kasa cihazınız var mı, hangi marka (АТОЛ, Эвотор, Штрих-М)?
3. İnternet mağazanız hangi platformda (1С-Битрикс, Tilda, InSales, WooCommerce, özel yazılım)?
4. Ozon / Wildberries gibi pazaryerlerinde satış yapıyor musunuz?
5. Kaç mağaza, kaç depo ve kaç kullanıcı olacak?
