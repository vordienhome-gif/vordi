# Satış kanalları ve Честный знак — kurulum

Ayarların hepsi **Настройки → Касса и интеграции** ekranındadır.

## Nasıl çalışır?

1. Kanaldaki yeni siparişler Vordi'ye **müşteri siparişi** olarak gelir ve stok ayırır (rezerv).
2. Vordi her ürünün **kullanılabilir stokunu** (stok − rezerv) bütün kanallara gönderir.
3. Böylece bir üründen son 1 adet kaldıysa ve Ozon'da satıldıysa, Wildberries, Яндекс ve InSales'te de stok 0 olur.

Senkronizasyon her 10 dakikada bir otomatik yapılır (aralık ayarlanabilir); kanal kartındaki **Синхронизировать** düğmesiyle elle de başlatılabilir. Her işlem kanalın **Журнал** kaydına yazılır.

Pazaryeri siparişlerinde cari, pazaryerinin kendisidir ("Ozon", "Wildberries", "Яндекс Маркет" carileri otomatik oluşturulur). InSales siparişlerinde gerçek müşteri e-posta/telefona göre bulunur veya oluşturulur.

## Ürün eşleştirme

| Kanal | Eşleştirme |
|---|---|
| Ozon | Gerekmez. `offer_id` = ürünün **артикул**'u (yoksa kodu) |
| Яндекс Маркет | Gerekmez. SKU = ürünün **артикул**'u, katalogdakiyle birebir aynı yazılmalı |
| Wildberries | **Сопоставить товары** düğmesi: WB kartının `vendorCode`'u артикул ile ya da barkodla eşleşir; stok beden kimliğiyle (`chrtId`) gönderilir |
| InSales | **Сопоставить товары** düğmesi: varyantın SKU'su артикул ile ya da barkodla eşleşir |

Yeni ürün eklediğinizde WB ve InSales için eşleştirmeyi tekrar çalıştırın.

## API anahtarları nereden alınır?

- **Ozon:** Seller kabineti → Настройки → Seller API → anahtar oluştur. *Client-Id* ve *Api-Key* gerekir. FBS deposunun ID'si: Логистика → Склады.
- **Wildberries:** Kabinet → Настройки → Доступ к API → token oluştur; "Маркетплейс" ve "Контент" kategorileri seçili olmalı. Satıcı deposunun ID'si: Маркетплейс → Мои склады.
- **Яндекс Маркет:** Kabinet → Настройки → API и модули → Api-Key oluştur (stok güncelleme ve siparişler için gerekli izinlerle). *campaignId* aynı sayfada yazar.
- **InSales:** Yönetim paneli → Приложения → Разработчикам → Создать новый ключ доступа. Bu ekran *identifier* ve *пароль* verir; anahtara siparişleri okuma ve ürünleri değiştirme izni verilmelidir.

## Честный знак (markalama)

1. Ürün kartında **Маркировка** alanında ürün türünü seçin (обувь, одежда…). Ürünün barkodu GTIN olmalıdır.
2. Kasada markalı ürün eklenince sistem DataMatrix ister. Doğrudan DataMatrix okutursanız ürün GTIN'den otomatik bulunur.
3. Her kod satıştan önce kontrol edilir:
   - Vordi içinde: kod daha önce satıldıysa satış engellenir (iade edilen kod tekrar satılabilir).
   - **Разрешительный режим:** "True API" modunda kod Честный знак'a sorulur. Engellenmiş, satılmış, dolaşıma girmemiş veya son kullanma tarihi geçmiş kod satılamaz. Bunun için ГИС МТ kişisel kabinetinden alınan API anahtarı (X-API-KEY) gerekir.
4. Kodlar kasa fişine eklenir; her kod ayrı satır olarak basılır (ФФД 1.2).
5. Mal kabulde, sevkiyatta ve iadelerde de kodlar okutulabilir (🏷 düğmesi). Perakende satışta okutmak zorunludur.

**Okuyucu ayarı:** Barkod okuyucu DataMatrix'teki GS (0x1D) ayırıcısını göndermelidir. Göndermezse sistem seri numarasını 13 karakter kabul eder; bu giyim, ayakkabı, parfüm ve lastik için doğrudur, diğer türlerde okuyucuyu GS gönderecek şekilde ayarlayın.

## Henüz gerçek hesapla denenmeyenler

Kod, platformların belgelerine göre yazıldı ve sahte sunucularla test edildi. Gerçek uç noktalar sahte anahtarla yoklandı ve hepsi var ve yetki istiyor. InSales sipariş alanları gerçek demo mağaza verisiyle karşılaştırıldı. Yine de canlıya geçmeden önce her kanalı **gerçek anahtarla** birlikte denememiz gerekiyor. Özellikle:

- **Яндекс Маркет:** Kabinetinizde depo grupları yoksa Yandex, stok için `v3/businesses/{businessId}/offers/stocks/update` yöntemini öneriyor. Gerekirse eklenecek.
- **Wildberries:** Şimdilik yalnızca yeni siparişler alınıyor; WB tarafındaki iptallerin Vordi'ye yansıması sonraki adım.
- **Kasa fişi:** Markalama kodu için `imcParams` alanları АТОЛ'ün JSON formatına göre yazıldı. ККТ tarafındaki kod doğrulaması gerçek cihazda test edilmeli.
- **Pazaryeri sevkiyatlarında markalama kodları** (Ozon/WB FBS siparişlerine kod bildirme) henüz yok.
- 2025'ten itibaren birçok perakendeci için **yerel modül (ЛМ ЧЗ)** üzerinden kontrol zorunlu. Kasa cihazınız belli olunca ona göre eklenecek.
