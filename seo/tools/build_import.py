#!/usr/bin/env python3
"""Üretilen ürün içeriklerini InSales içe aktarma tablosuna dönüştürür.

Girdi : <sonuç_klasörü>/*.json  (her biri ürün nesnelerinden oluşan dizi)
        <ürün_listesi.json>      (vordien.ru/collection/all.json sayfalarının birleşimi; mevcut ad/URL için)
Çıktı : seo/out/products_seo.xlsx  (InSales içe aktarma; sütun eşlemesi içe aktarma sihirbazında yapılır)
        seo/out/products_seo.csv   (aynı veri, UTF-8, ; ayraçlı)
        seo/out/product_issues.csv (mevcut veride bulunan hatalar — elle düzeltilecekler)

Kullanım: python3 seo/tools/build_import.py <sonuç_klasörü> <ürün_listesi.json>
"""
import csv
import glob
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "seo" / "out"
COLS = ["ID товара", "URL", "Текущее название", "Название товара", "Тег title", "Мета-тег description",
        "Полное описание", "Дополнить характеристики"]


def check(r):
    """Basit kalite kontrolleri; sorunlu satırlar raporda işaretlenir."""
    warn = []
    if not 20 <= len(r["name"]) <= 110:
        warn.append(f"ad uzunluğu {len(r['name'])}")
    if len(r["title"]) > 90:
        warn.append(f"title uzun ({len(r['title'])})")
    if not 110 <= len(r["meta_description"]) <= 175:
        warn.append(f"description uzunluğu {len(r['meta_description'])}")
    plain = re.sub(r"<[^>]+>", "", r["description_html"])
    if len(plain) < 300:
        warn.append(f"açıklama kısa ({len(plain)})")
    if re.search(r"<(script|style|iframe|img)", r["description_html"], re.I):
        warn.append("izin verilmeyen HTML")
    return warn


def main(res_dir, products_json):
    current = {str(p["id"]): p for p in json.load(open(products_json))}
    results = {}
    for f in sorted(glob.glob(f"{res_dir}/*.json")):
        if not re.fullmatch(r"(batch|pilot)_\d+\.json", pathlib.Path(f).name):
            continue
        for r in json.load(open(f)):
            results[str(r["id"])] = r
    rows, issues, warns = [], [], []
    for pid, r in results.items():
        cur = current.get(pid)
        if not cur:
            warns.append((pid, "ürün listede yok (stokta değil?)"))
            continue
        for w in check(r):
            warns.append((pid, w))
        fill = "; ".join(f"{k}: {v}" for k, v in (r.get("characteristics_fill") or {}).items())
        rows.append([pid, "https://vordien.ru" + cur["url"], cur["title"], r["name"], r["title"],
                     r["meta_description"], r["description_html"], fill])
        for i in r.get("issues") or []:
            issues.append([pid, "https://vordien.ru" + cur["url"], cur["title"], i])
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "products_seo.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLS)
        w.writerows(rows)
    with open(OUT / "product_issues.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["ID товара", "URL", "Название", "Проблема в текущих данных"])
        w.writerows(issues)
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Товары"
        ws.append(COLS)
        for row in rows:
            ws.append(row)
        ws2 = wb.create_sheet("Ошибки в данных")
        ws2.append(["ID товара", "URL", "Название", "Проблема в текущих данных"])
        for row in issues:
            ws2.append(row)
        wb.save(OUT / "products_seo.xlsx")
    except ImportError:
        print("openpyxl yok, yalnızca CSV yazıldı")
    print(f"{len(rows)} ürün satırı, {len(issues)} veri hatası, {len(warns)} kalite uyarısı")
    missing = set(current) - set(results)
    print(f"içeriği henüz üretilmemiş ürün: {len(missing)}")
    for pid, w in warns[:40]:
        print("  uyarı", pid, w)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
