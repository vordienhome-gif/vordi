# Sunucu kurulumu

## Önerilen sağlayıcı: Selectel

| Neden | |
|---|---|
| Rusya'da veri merkezleri (Moskova, St. Petersburg) | 152-ФЗ: kişisel veriler Rusya'da kalır |
| DDoS koruması fiyata dahil | Siteler ve panel saldırıya karşı korunur |
| Aynı hesapta S3 uyumlu depolama, yönetilen PostgreSQL | İleride büyümek kolay |
| ИП / ООО olarak faturalı ödeme (безнал) | Muhasebeye uygun |
| Saatlik ücretlendirme, sunucuyu panelden büyütme | Gerektiği kadar ödersiniz |

Daha ucuz alternatif: **Timeweb Cloud** (benzer özellikler, genellikle daha düşük fiyat). Kurulum adımları aynıdır.

### Başlangıç sunucusu

- **Bulut sunucu (Облачный сервер)**, bölge: Moskova
- **Ubuntu 24.04 LTS**
- **2 vCPU, 4 GB RAM, 50 GB SSD** — bugünkü hacim (yaklaşık 4 000 ürün, yılda birkaç bin belge) için yeterli. Siteler ve mobil uygulama eklenince panelden 4 vCPU / 8 GB'a büyütülür.
- Genel (public) IP adresi

Fiyatlar sık değişir; sipariş anında sağlayıcının sitesinden kontrol edin. Bu boyut kabaca ayda 1 500–2 500 ₽, 4 vCPU / 8 GB kabaca 4 500–6 000 ₽ bandındadır.

## Kurulum adımları

### 1. Alan adları (DNS)

vordien.ru'nun DNS yönetiminde iki **A kaydı** ekleyin (değer: sunucunun IP adresi):

| Ad | Tür | Değer |
|---|---|---|
| `panel` | A | sunucu IP |
| `depo` | A | sunucu IP |

Ana site (www.vordien.ru, InSales) bundan etkilenmez.

### 2. Sunucuda kurulum

Selectel panelinde sunucuyu açın → **Консоль** (tarayıcıdan terminal) veya SSH ile bağlanın, root olarak:

```bash
git clone https://github.com/vordienhome-gif/vordi.git /opt/vordi
```

```bash
bash /opt/vordi/platform/deploy/install.sh
```

Depo özel (private) ise `git clone` GitHub kullanıcı adı ve şifre yerine **token** ister: GitHub → Settings → Developer settings → Fine-grained tokens → yalnızca bu depo, yalnızca **Contents: Read** yetkisiyle bir token oluşturun ve şifre yerine onu girin.

Betik alan adlarını ve e-postayı sorar, şifreleri kendisi üretir ve **yönetici şifresini bir kez ekrana yazar** — hemen kaydedin.

Kurulumdan sonra:

- Yönetim paneli: `https://panel.vordien.ru`
- Depo uygulaması: `https://depo.vordien.ru` (telefonda açıp "Ana ekrana ekle")

### 3. МойСклад verilerini aktarma

```bash
bash /opt/vordi/platform/deploy/import-moysklad.sh
```

Token sorulur (ekranda görünmez). Bitince mutabakat raporu `deploy/reports/` klasörüne yazılır. Geçiş döneminde her gün tekrar çalıştırılabilir; kopya oluşturmaz.

### 4. Güncelleme

```bash
bash /opt/vordi/platform/deploy/update.sh
```

Önce yedek alır, sonra yeni kodu çekip yeniden başlatır.

## Güvenlik

`install.sh` şunları yapar:

- Güvenlik duvarı: yalnızca SSH (22), HTTP (80) ve HTTPS (443) açık. Veritabanı internete kapalı.
- `fail2ban`: SSH'ye kaba kuvvet denemelerini engeller.
- Otomatik güvenlik güncellemeleri (`unattended-upgrades`).
- HTTPS sertifikaları Let's Encrypt'ten otomatik alınır ve yenilenir; HTTP istekleri HTTPS'e yönlendirilir; güvenlik başlıkları (HSTS, X-Frame-Options vb.) açık.
- Veritabanı ve yönetici şifreleri rastgele üretilir ve yalnızca sunucudaki `.env` dosyasında (yalnızca root okuyabilir) durur.

Ek olarak önerilen:

- SSH'ye şifre yerine **anahtarla** girin ve şifreyle girişi kapatın.
- Yönetim paneline ilk girişte yönetici şifresini değiştirin; her çalışana ayrı kullanıcı açın.

## Yedekler

- Her gün otomatik yedek alınır: `deploy/backups/` (son 14 gün).
- **Sunucu dışına kopya şarttır** (sunucu kaybı veya fidye yazılımına karşı). Önerilen: farklı bir sağlayıcıda nesne depolama (ör. Yandex Object Storage) ve `rclone` ile günlük kopya. Bu adım sunucu açıldıktan sonra birlikte kurulacak.
- Geri yükleme denemesi: ayda bir yedek, ayrı bir veritabanına açılıp kontrol edilmelidir.

Geri yükleme (örnek):

```bash
cd /opt/vordi/platform/deploy
docker compose exec -T postgres createdb -U vordi restore_test
docker compose exec -T postgres pg_restore -U vordi -d restore_test < backups/vordi-YYYY-MM-DD-HHMM.dump
```

## Faydalı komutlar

```bash
cd /opt/vordi/platform/deploy
docker compose ps          # servislerin durumu
docker compose logs -f api # API kayıtları
docker compose restart api # API'yi yeniden başlat
```
