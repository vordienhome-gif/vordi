#!/usr/bin/env python3
"""Üretilen SEO içeriğini InSales API'si üzerinden mağazaya yükler.

Kimlik bilgileri ortam değişkenlerinden okunur (sohbete yazılmaz):
  INSALES_API_KEY, INSALES_API_PASSWORD   — InSales → Приложения → Разработчикам'da oluşturulan anahtar
  INSALES_HOST (isteğe bağlı)              — varsayılan: vordien.ru

Kullanım:
  python3 seo/tools/upload_insales.py check                     # bağlantı + alan adlarını göster, hiçbir şey yazmaz
  python3 seo/tools/upload_insales.py products --limit 5        # PROVA: ilk 5 üründe ne değişeceğini göster
  python3 seo/tools/upload_insales.py products --limit 5 --apply
  python3 seo/tools/upload_insales.py products --apply          # tüm ürünler
  python3 seo/tools/upload_insales.py restore <yedek.json> --apply

Her yazmadan önce ürünün mevcut değerleri seo/backup/ altına kaydedilir; `restore` ile geri alınır.
Ürün adresi (permalink) hiçbir zaman gönderilmez, mevcut URL'ler korunur.
"""
import argparse
import base64
import datetime
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTENT = ROOT / "seo" / "data" / "products_content.json"
BACKUP = ROOT / "seo" / "backup"
# API'ye gönderilen alanlar → üretilen içerikteki karşılığı
FIELDS = {"title": "name", "html_title": "title", "meta_description": "meta_description", "description": "description_html"}


class Api:
    def __init__(self):
        key, pwd = os.environ.get("INSALES_API_KEY"), os.environ.get("INSALES_API_PASSWORD")
        if not key or not pwd:
            sys.exit("INSALES_API_KEY ve INSALES_API_PASSWORD ortam değişkenleri tanımlı değil.")
        self.base = "https://" + os.environ.get("INSALES_HOST", "vordien.ru") + "/admin"
        self.auth = "Basic " + base64.b64encode(f"{key}:{pwd}".encode()).decode()

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(5):
            req = urllib.request.Request(self.base + path, data=data, method=method, headers={
                "Authorization": self.auth, "Content-Type": "application/json", "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < 4:  # InSales istek limiti
                    time.sleep(5 * (attempt + 1))
                    continue
                raise SystemExit(f"{method} {path} → HTTP {e.code}: {e.read()[:300]!r}")
            except (urllib.error.URLError, TimeoutError):
                if attempt == 4:
                    raise
                time.sleep(3 * (attempt + 1))


def short(v, n=90):
    v = (v or "").replace("\n", " ")
    return v if len(v) <= n else v[:n] + "…"


def cmd_check(api):
    acc = api.call("GET", "/account.json")
    print("Mağaza:", acc.get("title"), "|", acc.get("subdomain"))
    p = api.call("GET", "/products.json?per_page=1")[0]
    print("Ürün alanları:", ", ".join(sorted(p.keys())))
    missing = [f for f in FIELDS if f not in p]
    print("Beklenen ama bulunmayan alanlar:", missing or "yok")
    c = api.call("GET", "/collections.json")[:1]
    if c:
        print("Kategori alanları:", ", ".join(sorted(c[0].keys())))


def cmd_products(api, limit, apply):
    content = json.load(open(CONTENT))[: limit or None]
    BACKUP.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_file = BACKUP / f"products-{stamp}.json"
    backups, done = [], 0
    for r in content:
        cur = api.call("GET", f"/products/{r['id']}.json")
        new = {f: r[src] for f, src in FIELDS.items()}
        changed = {f: v for f, v in new.items() if (cur.get(f) or "") != v}
        print(f"\n#{r['id']}  {short(cur.get('title'), 70)}")
        for f, v in changed.items():
            print(f"   {f}:\n     şimdi: {short(cur.get(f))}\n     yeni : {short(v)}")
        if not changed:
            print("   (değişiklik yok)")
            continue
        if apply:
            backups.append({"id": r["id"], **{f: cur.get(f) for f in FIELDS}, "permalink": cur.get("permalink")})
            backup_file.write_text(json.dumps(backups, ensure_ascii=False, indent=1))
            res = api.call("PUT", f"/products/{r['id']}.json", {"product": changed})
            if res.get("permalink") != cur.get("permalink"):
                print(f"   !!! permalink değişti: {cur.get('permalink')} → {res.get('permalink')}")
            done += 1
            time.sleep(0.6)
    print(f"\n{'YAZILDI' if apply else 'PROVA (hiçbir şey yazılmadı)'}: {done if apply else len(content)} ürün")
    if apply:
        print("Yedek:", backup_file.relative_to(ROOT))


def cmd_restore(api, path, apply):
    for b in json.load(open(path)):
        body = {f: b[f] for f in FIELDS}
        print(f"#{b['id']} geri yükle → {short(b['title'], 70)}")
        if apply:
            api.call("PUT", f"/products/{b['id']}.json", {"product": body})
            time.sleep(0.6)
    print("TAMAM" if apply else "PROVA (hiçbir şey yazılmadı)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["check", "products", "restore"])
    ap.add_argument("backup", nargs="?")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    api = Api()
    if a.command == "check":
        cmd_check(api)
    elif a.command == "products":
        cmd_products(api, a.limit, a.apply)
    else:
        cmd_restore(api, a.backup, a.apply)


if __name__ == "__main__":
    main()
