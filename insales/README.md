# Elitmosteks — InSales teması

`theme/` klasörü, InSales mağazası **myshop-dfp694.myinsales.ru** temasının kaynak dosyalarıdır
(`templates/`, `snippets/`, `media/`). Tema ayar dosyaları (settings_data.json vb.) API'den okunamadığı için depoda yoktur.

## Yükleme

```bash
export INSALES_SHOP=myshop-dfp694.myinsales.ru INSALES_KEY=... INSALES_PASSWORD=...
python3 insales/tools/theme.py list                 # temalar
python3 insales/tools/theme.py push <TEMA_ID>        # değişen dosyaları yükler
python3 insales/tools/theme.py push <TEMA_ID> --all  # tüm dosyaları yükler
```

API anahtarı depoya yazılmaz. Önizleme: `https://myshop-dfp694.myinsales.ru/?theme_preview=<TEMA_ID>`.
Not: yeni yüklenen CSS/JS dosyaları CDN'de gecikmeyle yayınlanır.
