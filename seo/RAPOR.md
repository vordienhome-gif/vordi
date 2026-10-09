# Vordien Home — trafik ve SEO raporu

*Tarih: 9 Ekim 2026 · Kapsam: vordien.ru'daki 725 aktif ürün, 74 kategori, teknik SEO, arama talebi*

## 1. Kısa sonuç

Site teknik olarak sağlam, ama trafik getirmesi için üç şey eksik:

1. **Site çok yeni.** Ürünler Ağustos–Ekim 2026'da eklenmiş, yani mağaza yaklaşık 2 aylık.
   Yandex yeni ticari sitelere birkaç ay boyunca az trafik verir. Bu süreyi kısaltmanın yolu
   ürün feed'i, Yandex Business ve reklam gibi hızlı kanallar (bölüm 6).
2. **Ürün kartları zayıf.** Açıklamalar bir şablondan çoğaltılmış (374 üründe metnin çoğu kalıp
   cümle). Marka, kumaş ve renk özellikleri büyük ölçüde boş, bazı açıklamalarda da olgu hatası var.
   Yandex bu tür sayfaları "düşük değerli" sayar.
3. **Güven sinyali yok.** 725 üründe yalnızca 1 yorum var. Yandex, ticari sitelerde yorumlara,
   iletişim bilgisine ve teslimat/iade koşullarına çok önem veriyor.

Bu rapordaki dosyalar (bölüm 5) 2. sorunu doğrudan çözüyor: 725 ürünün tamamı için yeni ad, title,
meta description, açıklama ve doldurulacak özellikler. Ayrıca 30 kategori için yeni metinler ve
5 yeni açılış sayfası var.

## 2. Teknik SEO — durum

| Konu | Durum |
|---|---|
| HTTPS, www → ana alan adı 301 | ✅ doğru |
| robots.txt (Yandex için ayrı blok, Clean-param) | ✅ iyi |
| sitemap.xml (877 ürün + kategoriler + blog) | ✅ var; ama 152 ürün stokta yok ve katalogda gizli (bkz. aşağı) |
| canonical, sayfalama (`?page=2` → noindex,follow + canonical) | ✅ kabul edilebilir |
| Ürün yapısal verisi (Product, Offer, Breadcrumb) | ⚠️ var, ama `brand: null` (257 üründe marka özelliği boş), `color`/`size` null, offer URL göreli |
| og:type ürün sayfasında `website` | ⚠️ `product` olmalı |
| Breadcrumb ürünlerde "Бренды → NUSA" üzerinden gidiyor | ⚠️ kategori yolu (Халаты → Женские халаты) daha alakalı; InSales'te ürünün "kanonik kategori"si seçilmeli |
| Kategori H1'leri | ⚠️ "… — купить в интернет-магазине Vordien Home" kalıbında; title'ı tekrarlıyor, hub sayfalarda BÜYÜK HARF |
| Görsel alt metinleri | ❌ 4.283 görselin yalnızca 262'sinde alt var (714/725 üründe eksik) |
| Mobil hız | ⚠️ ölçümde ilk içerik ~8,9 sn (Rusya dışından ölçüldü); 18 inline CSS bloğu ayrı dosyaya taşındı, bkz. `theme/` |
| Kopya kategori | ⚠️ `dzhempery-i-svitery` ve `dzhempery-i-svitery-2` |
| Sayfa başlığına sabit fiyat | ⚠️ bazı ürünlerin title'ında "купить за 9 980 ₽" sabit yazılmış; fiyat değişince yanlış kalır |
| Yandex Webmaster / Google Search Console doğrulaması | ❓ sayfada doğrulama meta etiketi yok (DNS/dosya ile yapılmış olabilir) — **lütfen kontrol edin** |

**Stokta olmayan 152 ürün:** Sayfaları açık, sitemap'te duruyorlar, "OutOfStock" olarak işaretli,
ama katalogda görünmüyorlar. Tekrar gelecek ürünler kalsın (sayfada "benzer ürünler" bloğu olsun).
Bir daha gelmeyecekler en yakın kategoriye 301 ile yönlendirilsin.

## 3. Ürün kartları — denetim (725 ürün)

| Sorun | Ürün sayısı |
|---|---|
| Görsel alt metni eksik | 714 |
| Состав / Ткань (bileşim/kumaş) özelliği yok | 456 |
| Açıklamanın çoğu kalıp cümle | 374 |
| Бренд (marka) özelliği yok → yapısal veride `brand: null` | 257 |
| Açıklama çok kısa (< 300 karakter) | 180 |
| Renk adda var, Цвет özelliği yok | 125 |
| 3'ten az görsel | 118 |
| Ad Latin harfli, Rusça ürün tipi yok ("CNS Toothpaste …") | 29 |
| Ad çok kısa / bilgisiz ("Халат NUSA 7260") | 21 |
| Açıklama "ванная" diyor ama ürün banyo için değil (kapı paspası, oda halısı) | 16 |

En sık tekrar eden kalıp cümleler 100–220 üründe birebir aynı geçiyor ("Оплата онлайн: СБП…",
"Рекомендации по уходу общие…"). Ürün bazında hata listesi `seo/out/product_issues.csv` dosyasında.
Örnekler:
- Блендер Bosch: özelliklerde "Материал: Лён".
- Velur halat: bileşim toplamı %120.
- Limasso ürünü: "Бренд: Exclusive".
- Vantuzlu küvet paspası "мягкий ворс, впитывает влагу" diye anlatılmış.

## 4. Arama talebi (Yandex/Google öneri sorguları)

Ahrefs hesabınızın planı API erişimine izin vermediği için hacim rakamı yok. Bunun yerine Yandex ve
Google otomatik tamamlama önerilerinden 5.037 gerçek sorgu toplandı (`seo/data/keywords.json`).
Bunlar popülerlik sırasıyla geliyor. Öne çıkanlar:

- **Havlu:** "махровые полотенца", "турецкие полотенца", "полотенце банное", "полотенце 70х140",
  "набор полотенец подарочный / в коробке", "пештемаль", "полотенце для хамама".
- **Halat:** "халат махровый женский", "турецкий халат женский", "халат мужской махровый турция",
  "халат с капюшоном", "халат вафельный женский турция".
- **Nevresim:** "турецкое постельное белье", "постельное белье евро / сатин / семейное",
  "постельное белье турция бренды" (TAÇ, Arya gibi rakip markalar aranıyor).
- **Diğer:** "покрывало с наволочками", "коврик для ванной хлопок", "набор ковриков для ванной и туалета",
  "придверный коврик в прихожую".

**Sonuç:** Talep ürün tipi + "Турция" + ölçü üzerine. Yeni ürün adları bu sırayla kuruldu
(tip → amaç → kumaş → marka → model → ölçü → renk). Arama sonuçlarında Ozon/WB çok güçlü. Bu
yüzden genel sorgularda kısa vadede rekabet zor; **marka + model** ve **ölçü + kumaş** sorgularında
şans daha yüksek.

## 5. Hazırlanan dosyalar ve uygulama

| Dosya | Ne | Nasıl uygulanır |
|---|---|---|
| `seo/out/products_seo.xlsx` (ve `.csv`) | 725 ürün: yeni ad, title, meta description, açıklama (HTML), doldurulacak özellikler | InSales → Товары → Импорт. Eşleştirme alanı "ID товара". Sütunları sihirbazda ilgili alanlara eşleyin. **Önce 5 ürünle deneyin.** |
| `seo/out/product_issues.csv` | Mevcut verideki olgu hataları (yanlış marka, çelişen renk/bileşim…) | Elle düzeltin. Özellikle "Бренд", "Цвет", "Состав" alanları yapısal veriye ve filtrelere gidiyor |
| `seo/out/categories.csv` + `categories_preview.html` | 30 kategori: yeni H1, title, description, SEO metni + SSS + iç bağlantılar + FAQ JSON-LD | InSales → Каталог → kategori → SEO alanları ve açıklama |
| `seo/out/new_collections.csv` | 5 yeni açılış sayfası: покрывала с наволочками, постельное бельё из варёного хлопка, хлопковые коврики, пляжные полотенца, наборы халатов для двоих | Yeni kategori açıp metni yapıştırın. "Какие товары добавить" sütununa göre ürünleri ekleyin |
| `seo/out/audit_products.csv` | Ürün bazında denetim tablosu | Takip için |
| `theme/assets/vd-bundle.css`, `vd-late.css` | Temadaki 18 inline CSS bloğunun birleşik hali (HTML her sayfada ~41 KB küçülür) | `README.md`'deki adımlar |

**Önemli notlar:**
- İçe aktarmada URL/permalink sütununu **eşlemeyin**: mevcut adresler korunmalı (adres değişirse eski sayfalar 404 olur). 5 ürünlük denemeden sonra adreslerin değişmediğini kontrol edin.
- Açıklamalarda fiyat ve stok yok, bilerek. Title'lara sabit fiyat yazmayın.
- Metinler yalnızca mevcut veriden yazıldı. Veri çelişkiliyse çelişen bilgi metne alınmadı ve
  `product_issues.csv`'ye yazıldı.
- Görsel alt metinleri: ürün JSON'undaki görsellerin `title` alanı 4.283 görselin yalnızca 262'sinde dolu; tema büyük olasılıkla alt metni buradan alıyor. Toplu
  doldurmak için en pratik yol ürün adını alt olarak vermek. Temadaki mevcut JS bunu tarayıcıda
  yapıyor, ama arama motorları için sunucu tarafında (veride) olması daha iyi.

## 6. Trafik planı (kanal kanal)

### İlk 2 hafta — hızlı kanallar
1. **Yandex Webmaster:** site doğrulama, sitemap gönderme, "Переобход страниц" ile yeni ürün ve
   kategori sayfalarını yeniden taratma, bölge (Россия) ayarı.
2. **Yandex Товары (ücretsiz):** Webmaster'a ürün feed'i (YML) yükleyin. InSales'te Yandex Market
   için YML çıktısı oluşturup o bağlantıyı kullanın. Ürünler arama sonuçlarındaki ürün bloğunda
   ücretsiz görünür. Bunun için marka, renk, bileşim özelliklerinin dolu olması önemli; bu
   dosyadaki özellik önerileri tam bunun için.
3. **Yandex Business (Яндекс Бизнес) / Карты:** mağaza kartı. Adres yoksa "online mağaza" olarak.
   Yorumları buraya da toplayın.
4. **Yorum toplama:** teslimattan 5–7 gün sonra e-posta/SMS ile yorum isteyin (InSales'te ürün
   yorumları açık). Hedef: ilk 2 ayda en çok satan 30 ürüne en az 1–2 yorum. %7 kod yerine
   "yorum için bir sonraki siparişe indirim" de olur.

### 1. ay — reklam ve pazar yerleri
5. **Yandex Direct, ürün kampanyası (Товарная кампания):** aynı YML feed'iyle. Küçük bütçeyle
   başlayıp yalnızca marka + model ve "турецкие полотенца / халат махровый женский турция" gibi
   ticari sorgulara gidin. Retargeting'i Metrika hedefleriyle kurun; tema kodunda `ym(…,'reachGoal')`
   zaten var.
6. **Pazar yerleri:** Ozon / Wildberries / Yandex Market. Rusya'da aramaların önemli kısmı doğrudan
   pazar yerinde yapılıyor (öneri sorgularında "на озоне", "на вайлдберриз" çok sık). Verilerde
   Ozon/WB bağlantısı boş, yani şu an orada satış yok. Avito özellikleri doldurulmuş; Avito
   kullanılıyorsa trafiği siteye de yönlendirin.

### 2.–3. ay — içerik ve marka
7. **Blog:** mevcut 20 yazı iyi konularda. Yeni konular öneri sorgularından: "пештемаль что это и
   как выбрать", "сколько весит полотенце 70×140", "ранфорс или сатин", "как выбрать халат по
   плотности", "турецкие бренды постельного белья (TAÇ, Karacan…)". Her yazı 4–6 ürüne ve ilgili
   kategoriye bağlansın.
8. **Яндекс Дзен, VK, Telegram:** blog yazılarının kısa versiyonları ve ürün fotoğrafları. Dzen,
   Yandex ekosisteminde trafik getiriyor.
9. **Marka sorguları:** "nusa халат женский", "karacan полотенца", "pupilla", "gelin home постельное
   белье" sorguları aranıyor. Marka sayfalarınız (`/collection/nusa` vb.) zaten var; metinleri bu
   sorgulara göre güçlendirin. Bu sorgularda rekabet daha düşük.

### Konumlandırma notu
Ana sayfanın title'ı "посуда и техника" diyor. Katalogda Bosch ev aletleri, Kore kozmetiği, deterjan,
pil de var. SEO bütçesini/emeğini **Türk ev tekstiline** (havlu, halat, nevresim, pike, paspas)
yoğunlaştırın. Diğer kategorilerde Ozon/WB ile arama sonuçlarında rekabet etmek çok zor.

## 7. Yapamadıklarım / sizden gerekenler

- **InSales paneline erişimim yok.** Değişiklikleri siteye ben yükleyemedim. Dosyalar içe
  aktarmaya hazır.
- **Ahrefs:** planınız API'ye izin vermiyor. Hacim rakamları için Yandex Wordstat'a bakın.
- **Yandex Webmaster / Metrika verisine erişimim yok.** Erişim verirseniz gerçek sorgu ve tıklama
  verisiyle önceliklendirme yapabilirim.
- **GitHub push:** repoya erişim yok (403). Commit'ler yerelde duruyor.
