# Vordi Platform

Toptan + perakende satış için kendi altyapımız: depo, cari, belgeler ve fişler, raporlar; üzerine yönetim paneli, depo uygulaması, kasa, perakende ve toptan siteleri, mobil uygulama ve pazaryeri entegrasyonları.

İş mantığı МойСклад'ın çalışma prensibini örnek alır — ayrıntılar: [docs/MOYSKLAD-ANALIZI.md](docs/MOYSKLAD-ANALIZI.md). Genel plan: [../docs/PLATFORM-PLANI.md](../docs/PLATFORM-PLANI.md).

## Yapı

```
apps/
  api/        Çekirdek backend (Fastify + PostgreSQL/Drizzle): belgeler, defterler, raporlar, yetki
  admin/      Yönetim paneli (React)
  depo/       Depo uygulaması — telefon veya el terminali (ТСД) ile barkodlu giriş/çıkış/transfer/sayım (PWA)
packages/
  domain/     Saf iş kuralları: belge türleri, defter kayıtları, FIFO, sayım, barkod, Честный знак
  contracts/  Paylaşılan API şemaları (zod), tipler ve API istemcisi — siteler ve mobil uygulama da bunu kullanacak
docs/         Analiz ve karar kayıtları
```

## Hızlı başlangıç (kendi bilgisayarınızda)

Gerekenler: **Node.js 22+** ve **pnpm** (`npm install -g pnpm`). Veritabanı kurmanız gerekmez: `DATABASE_URL` verilmezse gömülü PostgreSQL (PGlite) `apps/api/data/` klasöründe çalışır.

```bash
pnpm install
pnpm dev
```

- API: http://localhost:3000
- Yönetim paneli: http://localhost:5173
- Depo uygulaması: http://localhost:5174 (aynı Wi-Fi'deki telefondan bilgisayarın IP adresiyle açılabilir; kamera için HTTPS gerekir, el terminali okuyucusu HTTP'de de çalışır)

İlk giriş: **admin / admin** — hemen değiştirin (üretimde `INITIAL_ADMIN_PASSWORD` ile verin).

Gerçek PostgreSQL ile (Docker):

```bash
docker compose up -d postgres
DATABASE_URL=postgres://vordi:vordi@localhost:5432/vordi pnpm dev
```

## МойСклад'dan aktarım

МойСклад'daki her şeyi (para birimleri, tüzel kişiler, depolar, fiyat türleri, ürün grupları, cariler, çalışanlar, ürünler, hizmetler, modifikasyonlar, barkodlar, fiyatlar, satış noktaları ve 21 türde tüm belgeler) aktarır, sonra iki sistemi karşılaştırır.

1. МойСклад'da yalnızca **okuma** yetkili bir kullanıcı açın, onun için token oluşturun (Настройки → Токены).
2. Token'ı ortam değişkenine verin (dosyaya veya depoya yazmayın):

```bash
MOYSKLAD_TOKEN=... pnpm --filter @vordi/api import:moysklad --report=mutabakat.json
```

- Tekrar çalıştırmak güvenlidir: mevcut kayıtlar güncellenir, kopya oluşmaz. Geçiş döneminde her gün çalıştırılabilir.
- `--no-documents` yalnızca kartlar, `--types=demand,supply` yalnızca belirli belgeler, `--reconcile-only` yalnızca karşılaştırma.
- Mutabakat: depo bazında stok, sipariş rezervi ve cari bakiyeleri МойСклад raporlarıyla karşılaştırılır; farklar ürün/depo/cari adıyla rapora yazılır. МойСклад arşivdeki ürünlerin stokunu raporlarında göstermediği için bunlar ayrı sayılır.

İlk deneme aktarımının sonucu (10.11.2026): ~6 300 belge 5 dakikada; **stok 3 690/3 690 satır birebir**, cari bakiyeleri 89/90, sipariş rezervi 21/60 (kalan farklar 1–4 adet, inceleniyor).

## Testler

```bash
pnpm test        # alan kuralları, depo uygulaması mantığı, API uçtan uca (gömülü PostgreSQL)
pnpm typecheck
```

API testleri gerçek PostgreSQL'e karşı da çalışır: `TEST_DATABASE_URL=postgres://… pnpm --filter @vordi/api test`

## Ortam değişkenleri (API)

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantısı. Yoksa gömülü PGlite kullanılır |
| `PGLITE_DIR` | Gömülü veritabanı klasörü (varsayılan `data/pglite`) |
| `PORT`, `HOST` | Dinleme adresi (varsayılan `3000`, `0.0.0.0`) |
| `INITIAL_ADMIN_PASSWORD` | Boş veritabanında oluşturulan `admin` kullanıcısının şifresi |
| `CORS_ORIGINS` | Virgülle ayrılmış izinli kökenler |

## İlkeler

- Stok, cari ve kasa bakiyeleri **işlenmiş belgelerin defter kayıtlarından** hesaplanır; elle sayı yazılmaz.
- Tutarlar **kopek cinsinden tam sayı**.
- Şifreler scrypt ile özetlenir; oturum anahtarlarının yalnızca SHA-256 özeti saklanır; girişte hız sınırı vardır.
- Maliyet ve kâr bilgisi yalnızca yönetici rollerine gider.
- Her belge değişikliği işlem geçmişine (`audit_log`) yazılır.
