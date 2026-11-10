# Toptan + Perakende Online Satış Platformu — Ana Plan

Bu belge; kendi depo, cari ve fiş/belge altyapısı olan, **yönetim paneli**, **toptan (B2B)** ve **perakende (B2C)** için ayrı uygulamalardan oluşan, kargo, ödeme ve pazaryerleriyle entegre bir satış platformunun nasıl planlanıp adım adım kurulacağını anlatır.

Amaç: büyük işi, her biri tek başına çalışan ve işe yarayan parçalara bölmek. Her aşamanın sonunda canlıya alınabilecek bir şey olmalı.

**Pazar: Rusya.** Bütün entegrasyonlar, yasal gereklilikler ve sunucu yeri buna göre seçilir.

---

## 0. Bugünkü durum ve geçiş ilkesi

| Parça | Bugün | Durumu |
|---|---|---|
| Perakende sitesi | www.vordien.ru — **InSales** | Yeni kuruldu, çalışıyor |
| Toptan sitesi | elitmosteks.ru — **InSales** | Yeni kuruldu, çalışıyor |
| Depo, alış-satış, cari | **МойСклад** | Çalışıyor, gerçek veri burada |
| Fiziksel mağaza kasası | **МойСклад Касса** + ФНС'ye kayıtlı ККТ (54-ФЗ) | Çalışıyor, fişler ОФД üzerinden vergi dairesine gidiyor |

Yani sıfırdan başlamıyoruz: **çalışan bir ticaretin altındaki sistemi değiştiriyoruz.** Bu yüzden ana ilke:

> **Hiçbir gün satış durmaz.** Parçalar birer birer, paralel çalıştırılarak ve geri dönüş yolu açık tutularak değiştirilir ("strangler" yöntemi). Önce kendi çekirdeğimiz МойСклад'ın yanında *gölge* olarak çalışır, sonuçlar karşılaştırılır, ancak tutarlı olduğu kanıtlanınca ana kaynak olur.

Değiştirme sırası riske göre belirlenir:

1. **En az riskli:** raporlama, B2B'ye özel işlevler, pazaryeri senkronizasyonu (bunlar МойСклад'ı bozmadan eklenebilir).
2. **Orta risk:** depo/cari/belge ana kaynağının МойСклад'dan kendi çekirdeğe taşınması; InSales sitelerinin kendi çekirdeğe bağlanması.
3. **En yüksek risk — en son:** fiziksel mağaza kasası (54-ФЗ, ККТ, Честный знак). Hata vergi cezası demektir; bu adım ancak her şey oturduktan sonra ve gerçek cihazda test edilerek yapılır.
4. **İsteğe bağlı:** InSales sitelerinin kendi sitelerimizle değiştirilmesi. InSales iyi çalışıyorsa perakende sitesini değiştirmeye gerek olmayabilir; toptan portalı ise InSales'in B2B sınırlarına takıldığı yerde kendi uygulamamıza taşınır.

## 1. Temel mimari kararı

**Üç ayrı uygulama, tek çekirdek.**

```
                 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                 │ Yönetim      │  │ Toptan sitesi│  │ Perakende    │
                 │ paneli       │  │ (B2B portal) │  │ sitesi (B2C) │
                 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                        │ Admin API       │ Store API       │ Store API
                 ┌──────┴─────────────────┴─────────────────┴───────┐
                 │                ÇEKİRDEK (tek backend)            │
                 │  Katalog · Fiyat · Stok/Depo · Cari · Belge/Fiş  │
                 │  Sipariş (OMS) · Müşteri · Kullanıcı/Yetki       │
                 └──────┬───────────────────────────────────┬───────┘
                        │ iş kuyruğu (outbox + worker)      │
       ┌────────────────┼────────────────┬──────────────────┼──────────────┐
   Ödeme adaptörleri  Kargo adaptörleri  Pazaryeri adaptörleri  e-Belge / muhasebe  Bildirim (SMS/e-posta)
```

Neden böyle:

- **Stok, cari ve fiyatın tek bir doğru kaynağı olmalı.** Üç uygulamanın üç ayrı veritabanı olursa stok ve bakiye mutlaka kayar. Uygulamalar ayrı, veri ve iş kuralları tek yerde.
- Toptan ve perakende siteler aynı ürünü, aynı stoku görür; fark **fiyat listesi, müşteri tipi, ödeme koşulu ve arayüz**dedir.
- Çekirdek başta **modüler monolit** olarak yazılır (tek servis, içeride net modül sınırları). Mikroservise erken bölmek bu ölçekte sadece yavaşlatır; modül sınırları doğru çizilirse ileride ayırmak kolaydır.
- Dış sistemler (kargo, ödeme, pazaryeri) **adaptör** arkasında durur. Çekirdek "Trendyol"u ya da "Yurtiçi"ni bilmez; `MarketplaceChannel`, `CarrierProvider`, `PaymentProvider` arayüzlerini bilir. Yeni entegrasyon = yeni adaptör.

## 2. Mevcut Vordi koduyla ilişkisi

Bu depodaki Vordi; МойСклад tarzı belge → stok hareketi → cari bakiye mantığını, ağırlıklı ortalama maliyeti, rezerv/beklenen stok hesabını, 54-ФЗ (АТОЛ) kasa görevlerini, Честный знак kontrolünü ve **InSales, Ozon, Wildberries, Яндекс Маркет adaptörlerini** zaten çalışır halde içeriyor — yani tam da bu işin Rusya'ya özgü parçalarının ilk sürümü.

Ancak tek süreçli Node + gömülü SQLite ve bağımlılıksız tek sayfa arayüz, **gerçek mağaza + iki site + pazaryeri trafiği** için üretim altyapısı değil (eşzamanlı yazma, yedekleme, ölçeklenme, arka plan işleri).

**Öneri:** Yeni çekirdek yeni bir monorepo'da kurulur; Vordi'nin **iş kuralları, adaptörleri ve testleri şartname olarak** taşınır. Yani kod değil, doğrulanmış mantık yeniden kullanılır. Gerçek veri bugün МойСклад'da olduğu için veri aktarımı Vordi'den değil, **МойСклад JSON API 1.2**'den yapılır.

## 3. Teknoloji önerisi

| Katman | Öneri | Gerekçe |
|---|---|---|
| Dil | **TypeScript** (her yerde) | Ön yüz ve arka yüz aynı dil, ortak tipler ve doğrulama şemaları |
| Monorepo | pnpm workspaces + Turborepo | 3 uygulama + çekirdek + ortak paketler tek depoda |
| Backend | NestJS (veya Fastify + modüller) | Modül sınırları, DI, test edilebilirlik |
| Veritabanı | **PostgreSQL** | İşlemsel bütünlük (stok/cari için şart), JSONB, raporlama |
| Kuyruk / önbellek | Redis + BullMQ | Entegrasyon işleri, yeniden deneme, zamanlanmış senkronizasyon |
| Arama | Meilisearch (ileride OpenSearch) | Ürün arama, filtre, yazım hatası toleransı |
| Perakende + Toptan site | **Next.js** | SEO (perakende için kritik), sunucu tarafı render, hızlı sayfa |
| Yönetim paneli | React (Vite) + tablo/form kütüphanesi | Yoğun veri girişi, SEO gerekmez |
| Dosya / görsel | S3 uyumlu depolama + CDN | Ürün görselleri, fatura PDF'leri |
| Çalıştırma | Docker, staging + prod ortamları, CI/CD | Her değişiklik test edilip otomatik yayına alınır |
| İzleme | Hata takibi (Sentry vb.), log, uptime | Entegrasyon hatalarını müşteriden önce görmek |

### Önerilen depo yapısı

```
apps/
  admin/          Yönetim paneli
  store-b2c/      Perakende sitesi
  store-b2b/      Toptan portalı
  api/            Çekirdek backend (Admin API + Store API)
  worker/         Kuyruk işleyici: entegrasyonlar, senkronizasyon, bildirim
packages/
  domain/         Saf iş kuralları: stok, cari, belge, fiyat (framework'süz, %100 test)
  db/             Şema, migration'lar
  integrations/   payment/*, carrier/*, marketplace/*, einvoice/*
  ui/             Ortak bileşenler (iki mağaza sitesi için)
  sdk/            API istemcisi ve ortak tipler
```

## 4. Çekirdek alan modelleri (modüller)

| Modül | İçerik |
|---|---|
| **Katalog** | Ürün, **varyant** (beden/renk), kategori, özellik setleri, marka, medya, barkod/SKU, paket/koli bilgisi, kanal bazlı içerik |
| **Fiyatlandırma** | Fiyat listeleri (perakende, toptan, bayi grupları), **kademeli fiyat** (10+ adet, 100+ adet), müşteriye özel fiyat, kampanya/kupon, para birimi, KDV |
| **Stok / Depo** | Çoklu depo, raf/lokasyon, **değişmez stok hareket defteri**, rezerv, beklenen stok, transfer, sayım, lot/seri/SKT, maliyet (ağırlıklı ortalama → ileride FIFO) |
| **Cari** | Müşteri, tedarikçi, bayi; **değişmez cari hareket defteri**, bakiye, ekstre, vade, **risk/kredi limiti**, yaşlandırma |
| **Belge / Fiş** | Sipariş, irsaliye, fatura, iade, tahsilat/tediye fişi, kasa fişi, virman, mahsup, sayım fişi; numaralama serileri; taslak → onaylı → iptal |
| **Sipariş (OMS)** | Kanal bağımsız sipariş; durum makinesi (yeni → onay → toplama → paketleme → kargoda → teslim / iade); kısmi sevk, bölünmüş sipariş |
| **Müşteri hesapları** | B2C üye/misafir; B2B **firma + alt kullanıcılar**, firma onayı, rol (sipariş veren / onaylayan / muhasebe) |
| **Kullanıcı / Yetki** | Personel rolleri, ekran ve işlem bazlı izin, depo/şube kısıtı, **işlem geçmişi (audit log)** |
| **İçerik (CMS)** | Banner, sayfa, menü, blog, SEO alanları; site bazlı |
| **Bildirim** | E-posta/SMS şablonları, sipariş ve kargo bildirimleri |
| **Raporlama** | Satış, kârlılık, stok devir, cari yaşlandırma, kanal performansı |

### Değişmeyecek iş kuralları (en baştan doğru kurulmalı)

1. **Stok ve cari bakiye bir sütun değildir; hareketlerin toplamıdır.** Her belge onaylandığında defterlere satır yazar; belge iptal edilince ters kayıt atılır, hareket silinmez. Böylece "bu stok neden 3?" sorusunun cevabı her zaman bulunur.
2. **Para tutarları kuruş cinsinden tam sayı** (veya `numeric`) tutulur, asla float değil.
3. **Her dış çağrı idempotent**: aynı pazaryeri siparişi iki kez gelse de tek sipariş oluşur; aynı ödeme bildirimi iki kez gelse de tek tahsilat yazılır.
4. **Outbox deseni**: "sipariş kaydedildi" ile "kargoya bildir" aynı işlemde kuyruğa yazılır; worker çöktüyse iş kaybolmaz, yeniden denenir.
5. **Rezerv anında, stok düşüşü sevkte.** Sitede sepet değil, onaylanmış sipariş rezerv yapar (ödeme bekleyen siparişler için süreli rezerv).
6. **Kart verisi asla bizim sunucumuza dokunmaz** — ödeme kuruluşunun barındırılan formu / tokenizasyonu kullanılır (PCI DSS yükünden kurtarır).

## 5. Üç uygulamanın kapsamı

### Yönetim paneli
- Ürün/varyant/fiyat yönetimi, toplu Excel içe-dışa aktarma
- Sipariş ekranı (tüm kanallar tek listede), toplama listesi, paketleme, kargo etiketi basma
- Depo işlemleri, sayım, transfer; el terminali/telefon için mobil uyumlu depo ekranları
- Cari kartları, ekstre, tahsilat girişi, risk limiti onayları
- Belgeler ve fişler, e-fatura gönderim durumu
- B2B firma başvurularını onaylama, bayi fiyat grubu atama
- Entegrasyon ayarları ve **entegrasyon günlüğü** (hangi istek ne döndü, yeniden dene düğmesi)
- Raporlar ve gösterge paneli, kullanıcı ve yetki yönetimi

### Toptan sitesi (B2B portal)
- Giriş zorunlu; firma başvurusu → yönetici onayı
- Firmaya özel fiyat listesi ve kademeli fiyatlar, KDV hariç gösterim
- Koli/paket katları, minimum sipariş tutarı/adedi
- **Hızlı sipariş**: SKU listesiyle, Excel yükleyerek, geçmiş siparişi tekrarlayarak
- **Açık hesap / vadeli satış**: risk limiti kontrolü, cari ekstre ve bakiye görüntüleme, online cari ödeme
- Teklif isteme, sipariş onay akışı (firmadaki onaylayıcı kullanıcı)
- Fatura ve irsaliye indirme, sipariş/kargo takibi

> Bugün iki site de InSales'te. Aşağıdaki kapsam; InSales'te kalan kısımlar için **neyin InSales'te ayarlanıp neyin çekirdekten besleneceğini**, kendi siteye geçilen kısımlar için ise yapılacak işi tanımlar.

### Perakende sitesi (B2C)
- SEO odaklı katalog, filtre, arama, ürün varyant seçimi
- Sepet, misafir alışveriş, üyelik, adres defteri
- Kartla ödeme, **СБП**, kapıda ödeme (СДЭК vb. üzerinden)
- **İnternet ödemesinde de 54-ФЗ fişi zorunlu**: ödeme sağlayıcısının bulut kasası (ör. ЮKassa чеки) veya kendi bulut ККТ'miz
- Kupon/kampanya, kargo ücreti kuralları (ör. X ₽ üstü ücretsiz), ПВЗ (teslim noktası) seçimi haritada
- Sipariş takibi, iade talebi
- Yasal sayfalar ve onay metinleri, çerez yönetimi

## 6. Entegrasyonlar (Rusya)

| Tür | Sistemler | Not |
|---|---|---|
| Mevcut sistemler | **МойСклад JSON API 1.2**, **InSales API** (iki mağaza) | Geçiş döneminde iki yönlü; Vordi'de InSales adaptörü var |
| Ödeme | ЮKassa, CloudPayments, Т-Банк эквайринг, **СБП** | İnternet satışında fiş (54-ФЗ) ödeme sağlayıcısıyla birlikte çözülmeli |
| Kargo | **СДЭК**, Boxberry, Почта России, Яндекс Доставка, Ozon/WB teslim noktaları | Etiket, takip numarası, ПВЗ listesi, kapıda ödeme tahsilatının cariye yansıması |
| Pazaryeri | **Ozon, Wildberries, Яндекс Маркет** (Vordi'de adaptör var), Мегамаркет | FBS/FBO, stok-fiyat, sipariş, iptal, etiket |
| Kasa (54-ФЗ) | ККТ: АТОЛ / Эвотор / Штрих-М; ОФД | Mağaza kasası değişimi **en son** adım |
| Markalama | **Честный знак** (True API, разрешительный режим, ЛМ ЧЗ) | Giyim/tekstil/ayakkabıda zorunlu — ürün grubunuza göre |
| ЭДО | Диадок, СБИС, Контур | Toptan müşterilere УПД; markalı ürün kabulü |
| Muhasebe | 1С:Бухгалтерия'ya aktarım | Muhasebecinin kullandığı formata göre |
| Banka | Т-Банк, Точка, Сбер API ile hesap ekstresi | Toptan tahsilatlarının cariye otomatik işlenmesi |
| Bildirim | SMS, e-posta, Telegram | Sipariş/kargo durumları |
| Yasal | **152-ФЗ** (kişisel veriler Rusya'daki sunucuda), Роскомнадзор bildirimi | Sunucu: Yandex Cloud, Selectel veya VK Cloud |

### Her entegrasyonun ortak kuralları
- Her sağlayıcı için **test (sandbox) modu** ve canlı mod ayrı ayarlanır.
- Giden istekler kuyruktan, **yeniden deneme + gecikme artışı** ile yapılır; sürekli başarısız olan iş "ölü kuyruğa" düşer ve panelde görünür.
- Gelen webhook'lar imza doğrulamasından geçer, ham haliyle kaydedilir, sonra işlenir.
- Pazaryeri: sipariş çekme, stok/fiyat gönderme, ürün eşleştirme, iptal/iade yansıtma, kargo etiketi — her pazaryeri ayrı bir mini proje olarak ele alınır (biri ~2–4 hafta).

## 7. Aşamalar ve takvim

Süreler; 1 kıdemli backend, 1–2 full-stack, 1 frontend geliştirici, yarı zamanlı tasarımcı ve test sorumlusundan oluşan bir ekip için kabaca tahmindir. Ekip küçükse süreler uzar; AI destekli geliştirme bazı kalemleri kısaltır ama entegrasyonlarda karşı tarafın onay ve test süreçleri kısalmaz.

| Aşama | Kapsam | Süre | Sonunda elde edilen | МойСклад / InSales |
|---|---|---|---|---|
| **0. Keşif** | МойСклад ve InSales'teki gerçek süreçlerin, ayarların, fiyat türlerinin, belge türlerinin çıkarılması; "neyi eksik buluyorsunuz" listesi; ККТ modeli; veri modeli; sunucu seçimi | 2–3 hafta | Onaylı kapsam ve iş listesi | Değişmez |
| **1. Gölge çekirdek** | Yeni çekirdek + yönetim paneli; МойСклад'dan **tek yönlü sürekli senkron** (ürün, stok, cari, belgeler); stok ve bakiyelerin МойСклад ile otomatik karşılaştırılması; ilk kendi raporlarımız | 8–10 hafta | Veri bizde, doğruluğu kanıtlanmış | Ana kaynak МойСклад |
| **2. Toptan güçlendirme** | elitmosteks.ru için InSales'in yapamadıklarını sağlamak: müşteriye özel fiyat, cari ekstre, risk limiti, hızlı sipariş — InSales'e eklenti/uygulama olarak veya `opt.` alt alan adında kendi B2B portalımız | 6–8 hafta | Bayiler kendi hesabını, borcunu görür | Paralel |
| **3. Ana kaynağın devri** | Depo, cari, belgeler kendi çekirdekte; iki InSales sitesi stok/fiyat/siparişi bizden alır; mağaza satışları МойСклад kasasından içe aktarılır; ödeme + СДЭК entegrasyonu | 6–8 hafta | Kendi altyapımız ana sistem | МойСклад yalnızca kasa için |
| **4. Pazaryerleri** | Ozon, WB, Яндекс Маркет — Vordi adaptörlerinden başlayarak, tek tek | 2–4 hafta / pazaryeri | Tüm kanallarda tek stok | — |
| **5. Kendi kasamız** | ККТ ile 54-ФЗ fişi, vardiya, iade, Честный знак kontrolü; önce test mağaza saatleri dışında, sonra paralel, sonra tam geçiş | 4–6 hafta | **МойСклад aboneliği kapatılabilir** | Kapanır |
| **6. İsteğe bağlı** | Perakende sitesini InSales'ten kendi Next.js sitemize taşıma (SEO yönlendirmeleri korunarak), mobil depo uygulaması, ЭДО, 1С aktarımı, CRM | sürekli | — | InSales opsiyonel |

**Toplam:** ~4–5 ayda veri ve toptan işlevleri bizde; ~7–9 ayda МойСклад'dan tamamen bağımsız.

> Her aşamanın sonunda geri dönüş mümkün olmalı: 3. aşamada sorun çıkarsa siteler yeniden МойСклад'a bağlanabilir; 5. aşamada sorun çıkarsa mağaza МойСклад kasasına döner.

## 8. Çalışma yöntemi

1. **Her aşama küçük, test edilebilir işlere bölünür** (GitHub issue'ları). Her işin kabul kriteri yazılır: "Sipariş iptal edilince rezerv kalkar ve cari hareket ters kaydedilir" gibi.
2. **Önce iş kuralı testleri**: `packages/domain` içindeki stok/cari/fiyat mantığı framework'süz yazılır ve testlerle kilitlenir. Para ve stok hatası en pahalı hatadır.
3. **Her entegrasyon için sözleşme testleri** (sağlayıcının örnek cevaplarıyla) ve sandbox'ta uçtan uca deneme.
4. **Ödeme ve sipariş akışı için uçtan uca (E2E) testler** her yayından önce otomatik çalışır.
5. Her değişiklik ayrı dal + pull request; staging'de denenmeden canlıya çıkmaz.
6. Mimari kararlar `docs/adr/` altında kısa notlar olarak tutulur (neden PostgreSQL, neden modüler monolit vb.).

## 9. Altyapı, güvenlik ve yasal hazırlık

- HTTPS, alan adları (ör. `panel.vordien.ru` yönetim, `api.vordien.ru` çekirdek; mevcut site adresleri korunur)
- **152-ФЗ:** sunucu ve veritabanı Rusya'da
- Günlük otomatik veritabanı yedeği + geri yükleme denemesi
- Kişisel veri: aydınlatma metni, açık rıza, saklama süreleri, veri sahibi talepleri (152-ФЗ)
- Yönetim paneline iki adımlı doğrulama, IP kısıtı seçeneği
- Hız sınırı (rate limit) ve bot koruması, özellikle giriş ve ödeme sayfalarında
- İzleme: hata bildirimi, yavaş sorgular, kuyruk birikmesi alarmları

## 10. Başlamadan önce netleşmesi gerekenler

1. **МойСклад'da sizi en çok ne zorluyor?** (Fiyat, eksik özellik, toptan müşteri yönetimi, rapor, hız…) — Bu, önceliği belirler; bazı ihtiyaçlar МойСклад'ı tamamen bırakmadan çözülebilir.
2. Mağazadaki **kasa cihazı hangi marka/model** (АТОЛ, Эвотор, Штрих-М)? Эвотор ise kendi yazılımla kullanım farklı yol ister.
3. Ürün grubu nedir — **Честный знак markalı** ürün (giyim, tekstil, ayakkabı…) var mı?
4. Toptanda **vadeli satış / açık hesap** var mı? Kaç farklı fiyat türü (тип цен) kullanıyorsunuz? Toptan müşteriler tüzel kişi mi (ИП/ООО), УПД/ЭДО istiyorlar mı?
5. Hangi pazaryerlerinde satış var veya planlanıyor? МойСклад'ın pazaryeri bağlantılarını kullanıyor musunuz?
6. Ödeme ve kargo bugün InSales'te hangi sağlayıcılarla çalışıyor (ЮKassa, СДЭК…)?
7. Ürün/varyant sayısı, depo sayısı, kaç kullanıcı?
8. Ekip: kendi geliştiricileriniz olacak mı, yoksa geliştirme ağırlıklı olarak burada (Claude ile) mi yürüyecek?

Bu cevaplarla Aşama 0'ın çıktısı olan ayrıntılı iş listesi (issue'lar) ve Aşama 1'in veri modeli hazırlanır. İlk teknik adım olarak **МойСклад API'sinden salt-okunur veri çekme** denenebilir — bunun için МойСклад'da yalnızca okuma yetkili ayrı bir kullanıcı ve onun API token'ı yeterli.
