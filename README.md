# Vordi — Stok ve Ticaret Yönetimi

MoySklad tarzı bulut stok/ticaret yönetim sistemlerinin iş mantığını örnek alan, bağımsız bir uygulama.
Küçük ve orta ölçekli işletmeler için alış, satış, depo, cari hesap, kasa/banka ve perakende (POS) süreçlerini tek yerde toplar.

> Vordi, MoySklad'ın kodunu, tasarımını veya markasını kullanmaz; aynı türden iş akışlarını sıfırdan uygular.

## Özellikler

| Bölüm | İçerik |
|---|---|
| **Göstergeler** | Günlük/aylık satış, aylık brüt kâr, açık siparişler, stok değeri, alacak/borç, kasa-banka bakiyeleri, son 30 gün grafiği, kritik stok, en çok satanlar |
| **Satın alma** | Tedarikçi siparişi → Mal kabul → Tedarikçiye iade, beklenen stok takibi |
| **Satış** | Müşteri siparişi (durumlar + stok rezervi) → Sevkiyat → Müşteri iadesi, kârlılık raporu (ürün / cari bazında) |
| **Ürünler** | Ürün ve hizmet kartları, gruplar, barkod/SKU, alış-satış fiyatı, KDV, minimum stok, CSV içe/dışa aktarma |
| **Depo işlemleri** | Giriş, zayiat, depolar arası transfer, sayım (fark otomatik hesaplanır), çoklu depo |
| **Raporlar** | Stok bakiyeleri (stok, rezerv, beklenen, kullanılabilir, maliyet ve satış değeri), dönemsel stok hareketleri, cari hesaplar ve hesap ekstresi, kasa/banka akışı |
| **Para** | Gelen/giden ödemeler, Kasa ve Banka hesapları, gider kategorileri |
| **Perakende** | Barkod okuyuculu POS satış ekranı, nakit/kart ödeme |
| **Genel** | Belgeden bağlı belge oluşturma (sipariş → sevkiyat → tahsilat), taslak/işlendi durumu, belge kopyalama, yazdırma, çok kullanıcılı giriş (yönetici / kullanıcı) |

### İş kuralları

- Stok, **işlenmiş** belgelerden hesaplanır; taslak belgeler stoku ve bakiyeleri etkilemez. Belge silinince etkisi de kalkar.
- Maliyet, mal kabul ve giriş belgelerinden **ağırlıklı ortalama** ile hesaplanır (belge yoksa karttaki alış fiyatı).
- Cari bakiyesi: sevkiyat, tedarikçiye iade ve giden ödeme cariyi borçlandırır; mal kabul, müşteri iadesi ve gelen ödeme alacaklandırır.
- Rezerv: işlenmiş, kapanmamış ve henüz sevkiyatı yapılmamış müşteri siparişleri. Beklenen: aynı mantıkla tedarikçi siparişleri.
- Belgelerde kullanılmış ürün, cari veya depo silinmez; arşive alınır.

## Kurulum

Gereksinim: **Node.js 22.5+** (dahili `node:sqlite` kullanılır, `npm install` gerekmez).

```bash
npm start          # http://localhost:3000
npm run demo       # örnek ürün, cari ve belgelerle başlatır
npm test           # API testleri
```

İlk giriş: **admin / admin** — giriş yaptıktan sonra *Ayarlar* bölümünden şifrenizi değiştirin.

Ortam değişkenleri:

- `PORT` — dinlenecek port (varsayılan `3000`)
- `DB_FILE` — SQLite dosyası (varsayılan `data/vordi.db`)

## Mimari

```
server/
  index.js      HTTP sunucusu, statik dosyalar, oturum kontrolü
  api.js        REST uç noktaları
  db.js         SQLite şeması ve stok hareketleri görünümü (stock_moves)
  doctypes.js   Belge türleri ve stok / cari / para etkileri
  documents.js  Belge kaydetme, numaralama, bağlı belge üretimi
  reports.js    Stok, hareket, kârlılık, cari, para raporları ve göstergeler
  auth.js       scrypt ile şifreleme, oturumlar
  demo.js       Örnek veri
public/         Bağımlılıksız tek sayfalık arayüz (HTML + CSS + JS)
test/           node:test ile API testleri
```

## Yol haritası

MoySklad'ın kapsamına yaklaşmak için sıradaki adımlar:

- Ürün varyantları (beden/renk), setler ve üretim (reçete) belgeleri
- e-Fatura / e-Arşiv entegrasyonu
- Fiyat listeleri, indirimler, çoklu para birimi
- Pazaryeri ve e-ticaret entegrasyonları (Trendyol, Hepsiburada, Shopify…)
- Ayrıntılı rol/izin yönetimi, işlem geçmişi (audit log)
- Seri/parti ve son kullanma tarihi takibi, FIFO maliyet
