# Toptan + Perakende Online Satış Platformu — Ana Plan

Bu belge; kendi depo, cari ve fiş/belge altyapısı olan, **yönetim paneli**, **toptan (B2B)** ve **perakende (B2C)** için ayrı uygulamalardan oluşan, kargo, ödeme ve pazaryerleriyle entegre bir satış platformunun nasıl planlanıp adım adım kurulacağını anlatır.

Amaç: büyük işi, her biri tek başına çalışan ve işe yarayan parçalara bölmek. Her aşamanın sonunda canlıya alınabilecek bir şey olmalı.

---

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

Bu depodaki Vordi; belge → stok hareketi → cari bakiye mantığını, ağırlıklı ortalama maliyeti, rezerv/beklenen stok hesabını ve pazaryeri adaptör yapısını zaten çalışır halde içeriyor. Ancak:

- Tek süreçli Node + gömülü SQLite ve bağımlılıksız tek sayfa arayüz, **herkese açık iki web sitesi + yoğun entegrasyon trafiği** için uygun değil (eşzamanlı yazma, SEO, ölçeklenme, arka plan işleri).

**Öneri:** Yeni platform yeni bir monorepo'da sıfırdan kurulur; Vordi'nin **iş kuralları ve testleri şartname (spec) olarak** taşınır. Yani kod değil, doğrulanmış mantık yeniden kullanılır. Vordi, yeni çekirdek hazır olana kadar mevcut işi yürütmeye devam edebilir; geçişte veri aktarım betiği yazılır.

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

### Perakende sitesi (B2C)
- SEO odaklı katalog, filtre, arama, ürün varyant seçimi
- Sepet, misafir alışveriş, üyelik, adres defteri
- Kartla ödeme (3D Secure), taksit, kapıda ödeme/havale (isteğe bağlı)
- Kupon/kampanya, kargo ücreti kuralları (ör. X TL üstü ücretsiz)
- Sipariş takibi, iade talebi, e-arşiv faturayı indirme
- Yasal sayfalar ve onay metinleri, çerez yönetimi

## 6. Entegrasyonlar

Entegrasyon listesi **hangi ülkede satış yapılacağına** göre tamamen değişir. Mimari ikisinde de aynı.

| Tür | Türkiye | Rusya (Vordi'de kısmen mevcut) |
|---|---|---|
| Ödeme | iyzico, PayTR, Param, banka sanal POS'ları | ЮKassa, CloudPayments, СБП |
| Kargo | Yurtiçi, Aras, MNG/DHL eCommerce, Sürat, PTT, HepsiJet veya bir kargo entegratörü | СДЭК, Boxberry, Почта России, Яндекс Доставка |
| Pazaryeri | Trendyol, Hepsiburada, N11, Amazon TR, Çiçeksepeti, Pazarama | Ozon, Wildberries, Яндекс Маркет (+ InSales) |
| Yasal belge | **e-Fatura, e-Arşiv, e-İrsaliye** (özel entegratör üzerinden, GİB) | 54-ФЗ online kasa, ЭДО (УПД), Честный знак |
| Muhasebe | Logo, Mikro, Paraşüt'e aktarım | 1С:Бухгалтерия'ya aktarım |
| Bildirim | SMS sağlayıcısı (+ İYS kaydı), e-posta | SMS, e-posta |
| Yasal çerçeve | KVKK, ETBİS kaydı, Mesafeli Sözleşmeler Yönetmeliği, İYS | 152-ФЗ (veriler Rusya'da), 54-ФЗ |

### Her entegrasyonun ortak kuralları
- Her sağlayıcı için **test (sandbox) modu** ve canlı mod ayrı ayarlanır.
- Giden istekler kuyruktan, **yeniden deneme + gecikme artışı** ile yapılır; sürekli başarısız olan iş "ölü kuyruğa" düşer ve panelde görünür.
- Gelen webhook'lar imza doğrulamasından geçer, ham haliyle kaydedilir, sonra işlenir.
- Pazaryeri: sipariş çekme, stok/fiyat gönderme, ürün eşleştirme, iptal/iade yansıtma, kargo etiketi — her pazaryeri ayrı bir mini proje olarak ele alınır (biri ~2–4 hafta).

## 7. Aşamalar ve takvim

Süreler; 1 kıdemli backend, 1–2 full-stack, 1 frontend geliştirici, yarı zamanlı tasarımcı ve test sorumlusundan oluşan bir ekip için kabaca tahmindir. Ekip küçükse süreler uzar; AI destekli geliştirme bazı kalemleri kısaltır ama entegrasyonlarda karşı tarafın onay ve test süreçleri kısalmaz.

| Aşama | Kapsam | Süre | Sonunda elde edilen |
|---|---|---|---|
| **0. Keşif ve tasarım** | Süreç haritaları (sipariş → sevk → fatura → tahsilat), veri modeli, mimari karar kayıtları, ekran taslakları, entegrasyon sağlayıcılarının seçimi ve sözleşmeleri | 3–4 hafta | Onaylı kapsam ve iş listesi |
| **1. Çekirdek + yönetim paneli** | Katalog, varyant, fiyat listeleri, depo/stok defteri, cari defteri, belgeler/fişler, kullanıcı/yetki, raporların temeli, Vordi'den veri aktarımı | 8–10 hafta | Şirket içi ERP olarak kullanılabilir sistem |
| **2. Perakende sitesi** | B2C site, ödeme (1 sağlayıcı), kargo (1–2 firma), e-fatura/e-arşiv (veya 54-ФЗ), bildirimler, yasal sayfalar | 8–10 hafta | **İlk canlı satış** |
| **3. Toptan portalı** | B2B site, firma onayı, bayi fiyatları, hızlı sipariş, açık hesap/risk limiti, cari ekstre, online cari ödeme | 6–8 hafta | Bayilerin kendi siparişini verdiği portal |
| **4. Pazaryerleri** | Önce en çok satış yapılan 1 pazaryeri, sonra diğerleri tek tek | 2–4 hafta / pazaryeri | Tüm kanallarda tek stok |
| **5. Büyüme** | Mobil depo uygulaması (el terminali), gelişmiş WMS (raf/toplama rotası), kampanya motoru, CRM, BI raporları, çoklu şirket/şube | sürekli | — |

**Toplam:** ilk canlı satışa ~5–6 ay, B2C + B2B + ilk pazaryeri ile tam sisteme ~8–10 ay.

> Sıra işe göre değişir: Bugün gelirin çoğu toptandan geliyorsa **3. aşama 2.'den önce** yapılmalı. Ama 1. aşama her durumda ilk sıradadır, çünkü bütün kanallar stok ve cari doğruluğuna dayanır.

## 8. Çalışma yöntemi

1. **Her aşama küçük, test edilebilir işlere bölünür** (GitHub issue'ları). Her işin kabul kriteri yazılır: "Sipariş iptal edilince rezerv kalkar ve cari hareket ters kaydedilir" gibi.
2. **Önce iş kuralı testleri**: `packages/domain` içindeki stok/cari/fiyat mantığı framework'süz yazılır ve testlerle kilitlenir. Para ve stok hatası en pahalı hatadır.
3. **Her entegrasyon için sözleşme testleri** (sağlayıcının örnek cevaplarıyla) ve sandbox'ta uçtan uca deneme.
4. **Ödeme ve sipariş akışı için uçtan uca (E2E) testler** her yayından önce otomatik çalışır.
5. Her değişiklik ayrı dal + pull request; staging'de denenmeden canlıya çıkmaz.
6. Mimari kararlar `docs/adr/` altında kısa notlar olarak tutulur (neden PostgreSQL, neden modüler monolit vb.).

## 9. Altyapı, güvenlik ve yasal hazırlık

- HTTPS, alan adları (ör. `www.` perakende, `bayi.` toptan, `panel.` yönetim)
- Günlük otomatik veritabanı yedeği + geri yükleme denemesi
- Kişisel veri: aydınlatma metni, açık rıza, saklama süreleri, veri sahibi talepleri (KVKK / 152-ФЗ)
- Yönetim paneline iki adımlı doğrulama, IP kısıtı seçeneği
- Hız sınırı (rate limit) ve bot koruması, özellikle giriş ve ödeme sayfalarında
- İzleme: hata bildirimi, yavaş sorgular, kuyruk birikmesi alarmları

## 10. Başlamadan önce netleşmesi gerekenler

1. **Satış hangi ülkede?** Türkiye mi, Rusya mı, ikisi birden mi? (Ödeme, kargo, pazaryeri ve e-belge listesinin tamamı buna bağlı.)
2. Bugün gelirin ne kadarı toptan, ne kadarı perakende? (Aşama 2 ile 3'ün sırası.)
3. Ürün sayısı, varyant yapısı (beden/renk var mı), depo sayısı?
4. Toptanda **vadeli satış / açık hesap** var mı? Bayi fiyatları kaç grup?
5. Hangi pazaryerlerinde bugün satış var ve hangisi en büyük?
6. Hangi muhasebe programı kullanılıyor (muhasebeciye veri nasıl gidecek)?
7. Ekip: kendi geliştiricileriniz olacak mı, yoksa geliştirme ağırlıklı olarak burada (Claude ile) mi yürüyecek?
8. Mevcut Vordi verisi gerçek kullanımda mı (aktarım gerekiyor mu)?

Bu cevaplarla Aşama 0'ın çıktısı olan ayrıntılı iş listesi (issue'lar) ve Aşama 1'in veri modeli hazırlanır.
