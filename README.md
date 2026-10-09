# Vordien Home — InSales tema özelleştirmeleri

vordien.ru'nun InSales temasına eklenen özel CSS'in düzenli, sürümlü kaynağı.

Önceden bu CSS, temanın içine yapıştırılmış **18 ayrı inline `<style>` bloğu** olarak duruyordu
(`vd-fix1`, `vd-conv-style`, `vd-mob-css`, … `vordien-style2-css`) ve her sayfanın HTML'ine
yaklaşık 41 KB ekliyordu. Burada her blok kendi dosyasında; build betiği bunları iki tema
dosyasında birleştirir. JS tarafı zaten `vd-bundle.js` olarak temaya taşınmış durumda
(`src/js-snapshot/` altında yalnızca referans kopyası var).

## Klasörler

| Yol | Ne |
|---|---|
| `src/css/NN-ad.css` | Her özel blok ayrı dosyada. Numara = sayfadaki eski sıra (sıra önemli). İlk satırdaki `(head)` / `(body)` hangi pakete gideceğini belirler. **Düzenlemeleri burada yapın.** |
| `theme/assets/vd-bundle.css` | Üretilen dosya: eskiden `<head>` içindeki 17 blok. |
| `theme/assets/vd-late.css` | Üretilen dosya: eskiden sayfa sonunda, `theme.css`'ten sonra gelen `vordien-style2-css`. |
| `src/js-snapshot/vd-bundle.js` | Canlıdaki `vd-bundle.js`'in kopyası (referans; kaynağı InSales'teki tema). |
| `tools/extract.py` | Canlı sayfanın HTML'inden özel blokları `src/css/`'e çıkarır. |
| `tools/build.py` | `src/css/` → `theme/assets/*.css`. |
| `tools/verify.js` | Paketlerin eski bloklarla **birebir aynı** sonucu verdiğini canlı sitede kontrol eder. |

## Temaya kurulum (InSales yönetim paneli → Сайт → Шаблоны → Редактор кода)

> Önce temanın bir kopyasını alın (Шаблоны → ⋯ → Копировать). Sorun çıkarsa kopyaya dönersiniz.

1. **Dosyaları yükleyin:** `theme/assets/vd-bundle.css` ve `theme/assets/vd-late.css`'i temanın
   *Файлы / assets* bölümüne yükleyin.
2. **Head kısmı** (`vd-bundle.js`'i eklediğiniz `head.liquid` / layout dosyası):
   `<style id="vd-fix1">` ile `<style id="vd-cart-style">` arasındaki 17 bloğu silin
   (`vordien-custom-base`, `vg-style`, `vordien-enhance-css`, `vd-reco-style`, `vd-conv-style`,
   `vd-chat-style`, `vd-filter-style`, `vd-cmp-style`, `vd-polish-style`, `vd-404-style`,
   `vd-mob-css`, `vd-seo-ux`, `vd-brands-css`, `vd-opt-css`, id'siz `.vd-brendy-h` bloğu dahil).
   **`media="screen"` olan `content-visibility` bloğu temanındır, ona dokunmayın.**
   Silinen ilk bloğun yerine şunu yazın:
   ```liquid
   <link rel="stylesheet" href="{{ 'vd-bundle.css' | asset_url }}">
   ```
3. **Sayfa sonu:** `theme.css` bağlantısının hemen arkasındaki `<style id="vordien-style2-css">`
   bloğunu silip yerine şunu yazın:
   ```liquid
   <link rel="stylesheet" href="{{ 'vd-late.css' | asset_url }}">
   ```
   Bu dosya mutlaka `theme.css`'ten ve InSales widget stillerinden **sonra** gelmeli; head'e
   taşınırsa katalogdaki indirim etiketleri ve eski fiyatlar bozulur (test sırasında görüldü).
4. Siteyi açıp ana sayfa, katalog, ürün ve sepet sayfalarına bakın. İsterseniz aşağıdaki testi
   tekrar çalıştırın: kurulumdan sonra bloklar artık sayfada olmadığı için betik
   "özel blok bulunamadı" der; bu beklenen davranıştır.

## Değişiklik yapma akışı

```bash
# 1) src/css/ altındaki ilgili dosyayı düzenleyin (yeni kural için yeni numaralı dosya da açabilirsiniz)
python3 tools/build.py                          # 2) paketleri üret
NODE_PATH=$(npm root -g) node tools/verify.js   # 3) (kurulumdan önce) eşdeğerlik testi
git commit -am "..."                            # 4) kaydet, sonra theme/assets/*.css'i InSales'e yükle
```

`verify.js` her sayfayı bir kez açar, tüm elementlerin hesaplanmış stillerini ve konumlarını ölçer,
sonra aynı sayfada eski blokları paketlerle değiştirip tekrar ölçer. 9 sayfa × (mobil + masaüstü)
= 18 görünümde **0 fark** ile geçti (ana sayfa, `/collection/all`, `/collection/halaty`, ürün,
sepet, blog yazısı, iletişim, toptan, markalar).

## Bilinen eksikler / sonraki adımlar

- Paketlerde 179 `!important` hâlâ duruyor. Çoğu, InSales widget stillerini ezmek için gerekli.
  Bunları temizlemek için ilgili kuralları tema şablonlarının kendisine taşımak gerekir; bu
  aşamada davranış birebir korunsun diye dokunulmadı.
- Görsel düzeltmeler (masaüstünde slider'ın ortalanmaması, mobilde sohbet düğmesinin slayt
  metnine binmesi, "АКЦИИ" başlığı) ayrı bir commit olarak `src/css/` altına eklenecek.

## SEO paketi (`seo/`)

Rapor: [`seo/RAPOR.md`](seo/RAPOR.md). InSales'e yüklenecek dosyalar `seo/out/` altında.

| Araç | Ne yapar |
|---|---|
| `seo/tools/audit_products.py <prod_klasörü>` | Ürün JSON'larını denetler → `seo/out/audit_products.csv` |
| `seo/tools/make_batches.py` | Ürünleri içerik üretimi için partilere böler |
| `seo/tools/build_import.py <sonuç_klasörü> <products.json>` | Üretilen içerikten `products_seo.xlsx/csv` ve `product_issues.csv` üretir |
| `seo/tools/build_categories.py seo/data/categories_out.json velyurovye-halaty` | Kategori dosyalarını üretir |

İçerik kuralları: `seo/guidelines.md` (ürün), `seo/category_guidelines.md` (kategori).
Ürün verisi `https://vordien.ru/collection/all.json` ve `https://vordien.ru/product/<handle>.json`
uçlarından alınır.
