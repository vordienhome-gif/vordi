#!/usr/bin/env python3
"""Kategori içeriğini (categories_out.json) InSales'e girilecek dosyalara dönüştürür.

Çıktı:
  seo/out/categories.csv          — slug, H1, title, description, metin HTML (SSS + iç bağlantılar dahil)
  seo/out/new_collections.csv     — açılması önerilen yeni kategoriler + hangi ürünlerin girileceği
  seo/out/categories_preview.html — tarayıcıda okunabilir önizleme

Kullanım: python3 seo/tools/build_categories.py <categories_out.json> [atlanacak_yeni_slug ...]
"""
import csv
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "seo" / "out"

NAMES = {}  # slug → okunur ad (bağlantı metni için)
BRANDS = {"nusa": "NUSA", "karacan": "Karacan", "pupilla": "Pupilla", "hazangulu": "Hazangülü",
          "velora-home": "Velora Home", "majoli": "Majoli", "limasso": "Limasso", "gelin-home": "Gelin Home",
          "prima-casa": "Prima Casa", "pierre-cardin-home": "Pierre Cardin Home", "zalel": "Zalel",
          "brendy": "все бренды", "mostex": "МосТекс", "lady-london": "Lady London", "turkiz": "Türkiz"}


def link_name(slug):
    return BRANDS.get(slug) or NAMES.get(slug, slug.replace("-", " "))


def full_html(c):
    parts = [c["text_html"]]
    if c.get("faq"):
        parts.append("<h2>Частые вопросы</h2>")
        for f in c["faq"]:
            parts.append(f"<h3>{html.escape(f['q'])}</h3><p>{html.escape(f['a'])}</p>")
    if c.get("links"):
        links = ", ".join(f'<a href="{l}">{html.escape(link_name(l.rsplit("/", 1)[-1]))}</a>' for l in c["links"])
        parts.append(f"<p>Смотрите также: {links}.</p>")
    return "\n".join(parts)


def faq_jsonld(c):
    if not c.get("faq"):
        return ""
    data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in c["faq"]]}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def main(path, skip):
    d = json.load(open(path))
    for c in d["collections"] + d["new_collections"]:
        NAMES[c["slug"]] = c["h1"][0].lower() + c["h1"][1:]
    links = [l for c in d["collections"] + d["new_collections"] for l in c.get("links", [])]
    for l in links:
        s = l.rsplit("/", 1)[-1]
        NAMES.setdefault(s, s.replace("-", " "))
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "categories.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["URL", "H1 (Название)", "Тег title", "Мета-тег description", "SEO-текст (HTML)", "FAQ JSON-LD", "Ключевые запросы"])
        for c in d["collections"]:
            w.writerow([f"https://vordien.ru/collection/{c['slug']}", c["h1"], c["title"], c["meta_description"],
                        full_html(c), faq_jsonld(c), ", ".join(c["primary_keywords"])])
    new = [c for c in d["new_collections"] if c["slug"] not in skip]
    with open(OUT / "new_collections.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["URL (slug)", "Название", "H1", "Тег title", "Мета-тег description", "SEO-текст (HTML)", "Какие товары добавить", "Ключевые запросы"])
        for c in new:
            w.writerow([c["slug"], c["name"], c["h1"], c["title"], c["meta_description"], full_html(c),
                        c["selection_rule"], ", ".join(c["primary_keywords"])])
    with open(OUT / "categories_preview.html", "w", encoding="utf-8") as f:
        f.write("<!doctype html><meta charset=utf-8><title>Категории — SEO</title>"
                "<style>body{font:15px/1.5 system-ui;max-width:860px;margin:24px auto;padding:0 16px}"
                "section{border-top:2px solid #b8925a;margin-top:32px}code{background:#f3ede2}</style>")
        for c in d["collections"] + new:
            f.write(f"<section><p><code>/collection/{c['slug']}</code></p><p><b>title:</b> {html.escape(c['title'])}<br>"
                    f"<b>description:</b> {html.escape(c['meta_description'])}</p><h1>{html.escape(c['h1'])}</h1>{full_html(c)}</section>")
    print(f"{len(d['collections'])} kategori, {len(new)} yeni kategori yazıldı")


if __name__ == "__main__":
    main(sys.argv[1], set(sys.argv[2:]))
