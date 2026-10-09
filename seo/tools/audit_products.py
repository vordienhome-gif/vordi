#!/usr/bin/env python3
"""Ürün kartlarının SEO denetimi.

Girdi: ürün detay JSON'larının bulunduğu klasör (vordien.ru/product/<handle>.json çıktıları).
Çıktı: seo/out/audit_products.csv ve ekrana özet.

Kullanım: python3 seo/tools/audit_products.py <prod_klasörü>
"""
import collections
import csv
import glob
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "seo" / "out"


def text(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h or ""))).strip()


def chars(p):
    pmap = {x["id"]: x["title"] for x in p["properties"]}
    out = collections.defaultdict(list)
    for c in p["characteristics"]:
        out[pmap.get(c["property_id"], "?")].append(c["title"])
    return out


def sentences(t):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if len(s.strip()) > 25]


def main(folder):
    prods = [json.load(open(f))["product"] for f in sorted(glob.glob(f"{folder}/*.json"))]
    # kalıp cümle tespiti: 20+ üründe birebir geçen cümleler
    sent_count = collections.Counter()
    for p in prods:
        for s in set(sentences(text(p["description"]))):
            sent_count[s] += 1
    boiler = {s for s, n in sent_count.items() if n >= 20}

    rows = []
    for p in prods:
        d = text(p["description"])
        ch = chars(p)
        sents = sentences(d)
        uniq = [s for s in sents if s not in boiler]
        issues = []
        if len(d) < 300:
            issues.append("açıklama çok kısa")
        if sents and len(uniq) / len(sents) < 0.5:
            issues.append("açıklamanın çoğu kalıp cümle")
        if "Бренд" not in ch:
            issues.append("Бренд özelliği yok")
        if "Цвет" not in ch and re.search(r"(бел|сер|беж|крем|голуб|син|зел|черн|чёрн|коричн|розов|бордов|антрацит)", p["title"], re.I):
            issues.append("renk adda var, Цвет özelliği yok")
        if "Состав" not in ch and "Ткань" not in ch and "Материал" not in ch:
            issues.append("Состав/Ткань yok")
        if len(p["title"]) < 25:
            issues.append("ad çok kısa / bilgisiz")
        if re.match(r"^[A-Za-z0-9\s\-\.]+\b[A-Za-z]{4,}", p["title"]) and not re.search(r"[а-яё]", p["title"].split()[0], re.I):
            if re.search(r"(Toothpaste|Toothbrush|HAND|Shampoo|Cream)", p["title"]):
                issues.append("ad Latin/İngilizce, Rusça ürün tipi yok")
        imgs = p["images"]
        if len(imgs) < 3:
            issues.append(f"az görsel ({len(imgs)})")
        alts = sum(1 for i in imgs if i.get("title"))
        if alts < len(imgs):
            issues.append(f"görsel alt eksik ({len(imgs) - alts}/{len(imgs)})")
        brand_ch = ch.get("Бренд", [""])[0]
        m = re.search(r"Бренд:\s*([A-Za-zА-Яа-яЁёÇçÜüĞğŞşÖöİı\.\- ]+?)(?:\s{1,}[А-Я]|$)", d)
        if m and brand_ch and m.group(1).strip().lower() not in brand_ch.lower() and brand_ch.lower() not in m.group(1).strip().lower():
            issues.append(f"açıklamadaki marka ({m.group(1).strip()}) ≠ özellik ({brand_ch})")
        if re.search(r"ванн", d, re.I) and re.search(r"(придверн|комнатн|прихож|Кольчуга|кухн|скатерт)", p["title"], re.I):
            issues.append("açıklama 'ванная' diyor, ürün banyo için değil")
        rows.append({
            "id": p["id"], "url": "https://vordien.ru" + p["url"], "title": p["title"],
            "price": p["price_min"], "desc_len": len(d), "unique_sent_ratio": round(len(uniq) / len(sents), 2) if sents else 0,
            "images": len(imgs), "brand": brand_ch, "issues": "; ".join(issues),
        })
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "audit_products.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    c = collections.Counter(i.split(" (")[0] for r in rows for i in r["issues"].split("; ") if i)
    print(f"{len(rows)} ürün denetlendi; kalıp cümle sayısı: {len(boiler)}")
    for k, v in c.most_common():
        print(f"  {v:4d}  {k}")
    print("en sık kalıp cümleler:")
    for s, n in sent_count.most_common(8):
        print(f"  {n:4d}  {s[:110]}")


if __name__ == "__main__":
    main(sys.argv[1])
