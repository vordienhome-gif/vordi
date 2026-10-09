# Vordien Home — ürün kartı içerik kuralları

Bu kurallar `seo/out/products_seo.csv` içindeki her ürün için yeni ad, title, meta description ve
açıklama üretilirken uygulanır. Dil: **Rusça**. Hedef: Yandex ve Google'da ticari sorgulardan trafik
ve karttan satın almaya dönüşüm.

## Mutlak kurallar
1. **Uydurma yok.** Yalnızca ürün verisinde (mevcut ad, mevcut açıklama, özellikler, varyantlar,
   fiyat, marka) geçen olguları kullan. Verilerde olmayan yoğunluk (г/м²), boyut, bileşim, ülke,
   sertifika, garanti, "ручная работа", "премиум" gibi iddiaları **ekleme**.
   Ülke yalnızca ürünün kendi verisinde (özellik "Страна производства" ya da mevcut açıklama/ad)
   geçiyorsa yazılır; markadan ülke çıkarımı yapma.
2. Mevcut açıklamadaki **çelişkileri düzelt** ve `issues` alanına yaz: yanlış marka ("Бренд: Exclusive"
   gibi), adla çelişen renk, banyo paspası olmayan ürüne "для ванной" denmesi, yanlış oda vb.
3. Fiyat, indirim, stok, teslim süresi açıklamaya yazılmaz (değişir). Genel mağaza vaatleri
   (ПВЗ'ye 3 000 ₽ üzeri ücretsiz teslimat, СБП/SberPay) en fazla bir cümle, sonda.
4. Aynı kalıp cümleyi ürünler arasında tekrar etme; her açıklama o ürünün tipine, ölçüsüne, rengine,
   kumaşına ve kullanım senaryosuna özgü olsun. Ama "su gibi akan" pazarlama dolgusu da yok.

## Ürün adı (H1, `name`)
Formül: **[Ürün tipi] [cinsiyet/oda/amaç] [ana özellik: kumaş] [Marka] [model/koleksiyon «…»], [ölçü], [renk]**
- Rusça ürün tipiyle başla (aranan kelime en başta): "Халат женский махровый NUSA 7260",
  "Набор банных полотенец Karacan «Tokyo» 70×140 см, 4 шт", "Зубная паста CNS …".
- Latin harfli Korece/İngilizce adlar Rusça tipe çevrilir, marka Latin kalır.
- 40–90 karakter. Ölçüde `×` kullan, "см" ekle. Artikel kodu ancak varyantları ayırt etmek için.
- Marka adı tutarlı yazılır: NUSA, Pierre Cardin Home, Karacan, Pupilla, Hazangülü, Velora Home,
  Gelin Home, Limasso, Majoli, Prima Casa, Zalel, TAÇ, МосТекс, Bosch.

## Title (`title`, ≤ 70 karakter tercihen)
`{Ad (gerekirse kısaltılmış)} — купить в интернет-магазине Vordien Home`
Ad 45 karakteri aşıyorsa sonek: ` — купить | Vordien Home`.

## Meta description (`meta_description`, 140–160 karakter)
Ürünün 1–2 somut özelliği + fayda + mağaza vaadi. Örnek:
"Махровый женский халат NUSA 7260 из Турции: мягкий хлопок, запах на поясе. Доставка по России,
в ПВЗ бесплатно от 3 000 ₽, оплата СБП." Uydurma özellik yok; veri azsa ürün tipi + marka + ölçü/renk.

## Açıklama (`description_html`)
Basit HTML: `<p>`, `<ul><li>`, `<h3>`, `<a href="/collection/...">`. Uzunluk: tekstilde 700–1300 karakter,
diğer kategorilerde 400–900. Yapı:
1. `<p>` 2–3 cümle: ne olduğu, kimin için, hangi durumda (banyo sonrası, misafir, hediye, yazlık…),
   ürün tipine özgü ana fayda. Ana anahtar kelime ilk cümlede, doğal biçimde.
2. `<h3>Характеристики</h3><ul>` — yalnızca veride olan değerler (Бренд, Состав/Ткань, Размер(ы),
   Комплектация, Цвет, Страна производства, Пол).
3. `<h3>Уход</h3>` yalnızca ürün tipine göre genel, güvenli öneriler (ör. махра: 40 °C, без кондиционера
   для лучшей впитываемости) — markaya özgü talimat uydurma. Elektronik/kozmetikte bu bölüm yok.
4. Bir cümle iç bağlantı: ilgili 1–2 kategoriye `<a>` (aşağıdaki listeden), ör. halat → полотенца.

## İç bağlantı için kategori adresleri
/collection/mahrovye-polotentsa, /collection/nabor-polotenets, /collection/bannye-polotentsa-70x140,
/collection/polotentsa-50x90, /collection/polotentse-dlya-spa-sauny, /collection/kuhonnye-polotentsa,
/collection/halaty, /collection/zhenskie-halaty, /collection/muzhskie-halaty, /collection/halaty-s-kapyushonom,
/collection/mahrovye-halaty, /collection/postelnoe-belie, /collection/postelnoe-belie-evro,
/collection/postelnoe-belie-semeynoe, /collection/postelnoe-belie-1-5-spalnoe, /collection/postelnoe-belie-satin,
/collection/postelnoe-belie-ranfors, /collection/prostynya-na-rezinke, /collection/pledy-i-pokryvala,
/collection/podushki-i-odeyala, /collection/kovriki-dlya-vannoy, /collection/kovriki-pridvernye,
/collection/kovry-i-kovriki, /collection/skaterti, /collection/podarochnye-nabory, /collection/domashnie-halaty,
/collection/nochnye-sorochki, /collection/dzhempery-i-svitery, /collection/kuhonnaya-tehnika,
/collection/uhod-za-volosami, /collection/uhod-za-litsom, /collection/bytovaya-himiya-i-gigiena

## Özellik doldurma (`characteristics_fill`)
Verilerde açıkça geçen ama "Характеристики" alanında eksik olan değerleri öner: Бренд, Цвет, Размер,
Состав, Ткань, Пол, Страна производства. Emin değilsen boş bırak.
