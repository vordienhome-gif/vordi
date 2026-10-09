#!/usr/bin/env python3
"""Ürün JSON'larını içerik üretimi için sade JSONL partilerine böler.

Kullanım: python3 seo/tools/make_batches.py <prod_klasörü> <çıkış_klasörü> [parti_boyu] [--skip-done <sonuç_klasörü>]
Her satır: id, url, title, price, brand, characteristics, variants, current_description.
"""
import glob
import html
import json
import os
import re
import sys

SKIP_PROPS = {"Прослеживаемый (1с)", "Комиссионный", "Категория Avito", "Вид товара Avito"}


def text(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h or ""))).strip()


def compact(p):
    pmap = {x["id"]: x["title"] for x in p["properties"]}
    ch = {}
    for c in p["characteristics"]:
        name = pmap.get(c["property_id"], "?")
        if name not in SKIP_PROPS:
            ch.setdefault(name, []).append(c["title"])
    variants = sorted({v.get("title") or "" for v in p["variants"]} - {""})
    return {
        "id": p["id"], "url": p["url"], "title": p["title"], "price": p["price_min"],
        "brand": (ch.get("Бренд") or [""])[0],
        "characteristics": {k: ", ".join(v) for k, v in ch.items()},
        "variants": variants[:20], "option_names": [o.get("title") for o in p.get("option_names", [])],
        "current_description": text(p["description"])[:2500],
    }


def main():
    src, dst = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 40
    done = set()
    if "--skip-done" in sys.argv:
        for f in glob.glob(os.path.join(sys.argv[sys.argv.index("--skip-done") + 1], "*.json")):
            for r in json.load(open(f)):
                done.add(str(r["id"]))
    prods = [json.load(open(f))["product"] for f in sorted(glob.glob(f"{src}/*.json"))]
    prods = [p for p in prods if str(p["id"]) not in done]
    os.makedirs(dst, exist_ok=True)
    start = len(glob.glob(os.path.join(dst, "batch_*.jsonl")))
    n = 0
    for i in range(0, len(prods), size):
        n += 1
        with open(os.path.join(dst, f"batch_{start + n:02d}.jsonl"), "w", encoding="utf-8") as f:
            for p in prods[i:i + size]:
                f.write(json.dumps(compact(p), ensure_ascii=False) + "\n")
    print(f"{len(prods)} ürün → {n} parti ({dst})")


if __name__ == "__main__":
    main()
