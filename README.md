# Vordi — Stok ve Ticaret Yönetimi · Склад, продажи, розница

MoySklad tarzı bulut stok/ticaret yönetim sistemlerinin iş mantığını örnek alan, bağımsız bir uygulama.
Küçük ve orta ölçekli işletmeler için alış, satış, depo, cari hesap, kasa/banka ve perakende (POS) süreçlerini tek yerde toplar.
Rusya'da kullanım için hazırlanmıştır: arayüz **Rusça ve Türkçe**, ₽ ve Rus НДС oranları, 54-ФЗ online kasa (АТОЛ) ve internet mağazası API'si.

Сервис учёта для малого бизнеса: склад, закупки, продажи, взаиморасчёты, деньги и розничная касса. Интерфейс на русском и турецком языках.

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
| **Perakende** | Barkod okuyuculu POS satış ekranı, nakit/kart ödeme, 54-ФЗ fişi (АТОЛ Web Server), vardiya açma/kapama, X/Z raporları |
| **Entegrasyonlar** | İnternet mağazası için token korumalı REST API (ürün, stok, sipariş) — bkz. [docs/API.md](docs/API.md) |
| **Rusya** | ₽, НДС 22/20/10/7/5/0 % ve "без НДС", ИНН/КПП, СНО (ОСН, УСН, ЕСХН, Патент), Moskova saati |
| **Dil ve mobil** | Rusça / Türkçe dil seçici; telefona kurulabilen PWA, telefon ekranına uyumlu düzen |
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
- `TZ` — saat dilimi (varsayılan `Europe/Moscow`)

Kasa entegrasyonunu cihaz olmadan denemek için *Ayarlar → Kasa ve entegrasyonlar* bölümünde "Test modu"nu seçin.

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
  fiscal.js     54-ФЗ kasa fişi görevleri (АТОЛ JSON, ФФД 1.2)
  publicapi.js  İnternet mağazası API'si (/api/v1) ve API anahtarları
  demo.js       Örnek veri
public/
  app.js        Bağımlılıksız tek sayfalık arayüz
  i18n.js       Çeviri katmanı; lang/ru.js Rusça sözlük
  sw.js         PWA (çevrim dışı uygulama kabuğu)
docs/           API rehberi (RU) ve yol haritası (TR)
test/           node:test ile API, entegrasyon ve çeviri testleri
```

## Yol haritası

МойСклад seviyesine giden adımlar, yasal gereklilikler (152-ФЗ, Честный знак, ЕГАИС, ЭДО) ve öncelik soruları için: [docs/YOL-HARITASI.md](docs/YOL-HARITASI.md)
