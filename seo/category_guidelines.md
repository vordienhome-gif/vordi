# Vordien Home — kategori sayfası kuralları

Dil: Rusça. Her kategori için: H1, title, meta description, SEO metni (HTML), SSS (FAQ) ve
ilgili kategorilere iç bağlantılar. Kaynak: `keywords.json` (Yandex/Google öneri sorguları,
popülerlik sırasına göre) ve mevcut kategori verisi (`collections.json`).

## H1
- Yalın, anahtar kelimeli, mağaza adı ve "купить" yok: "Махровые полотенца из Турции",
  "Женские махровые халаты", "Постельное бельё евро".
- Şu an H1'ler "… — купить в интернет-магазине Vordien Home" kalıbında ve title'ı tekrarlıyor;
  hub sayfalarında BÜYÜK HARF ("ОДЕЖДА", "ТЕХНИКА") — ikisi de düzeltilecek.

## Title (≤ 70 karakter)
`[Ana sorgu] — купить [ikincil sorgu/özellik] | Vordien Home`, H1'den farklı olsun, ticari kelime
("купить", "цена", "в интернет-магазине") içersin. Örnek:
"Турецкие махровые полотенца — купить банные и для лица | Vordien Home".

## Meta description (140–170 karakter)
Çeşitlilik (ölçüler, markalar — yalnızca kategoride gerçekten olanlar) + mağaza vaadi
(доставка по России, в ПВЗ бесплатно от 3 000 ₽, промокод на первый заказ −7%).

## SEO metni (`text_html`)
- Ana tekstil kategorileri: 1 500–2 500 karakter; diğerleri: 600–1 200.
- Yapı: kısa giriş (ana sorgu + 2–3 ikincil sorgu doğal biçimde) → `<h2>Как выбрать …</h2>` (ölçü,
  kumaş, yoğunluk vb. — yalnızca genel, doğru bilgiler) → `<h2>…</h2>` markalar/çeşitler (yalnızca
  mevcut verideki markalar) → teslimat/ödeme tek cümle.
- Sorgu listesindeki gürültüyü (pazaryeri adları, şehirler, "своими руками" vb.) kullanma.
- Satılmayan şeyleri vaat etme: kategoride ürün yoksa o çeşidi yazma.
- Mevcut metinde iyi olan kısımları koru; tekrar eden kalıp cümleleri çıkar.

## SSS (`faq`)
3–5 soru-cevap; sorular, sorgu listesindeki bilgi amaçlı sorgulardan ("как стирать", "какой размер",
"что такое ранфорс") seçilir. Cevaplar 1–3 cümle, doğru ve genel.

## İç bağlantılar (`links`)
3–6 ilgili kategori adresi (yalnızca var olan /collection/... adresleri).
