#!/usr/bin/env python3
"""Canlı sayfanın HTML'inden Vordien'e ait inline <style> bloklarını src/css/ altına çıkarır.

Kullanım: python3 tools/extract.py sayfa.html
InSales'in kendi ürettiği bloklar (tema ayarları, widget CSS'i) atlanır; yalnızca
id'si vd-/vg-/vordien- ile başlayanlar ve bilinen küçük özel bloklar alınır.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "css"

# id'siz özel bloklar: içeriklerinin başı ile tanınır
ANON = {
    ".vd-brendy-h": "vd-brendy-h",
}


def main(path):
    html = pathlib.Path(path).read_text(encoding="utf-8", errors="ignore")
    head_end = html.find("</head>")
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.css"):
        old.unlink()
    n = 0
    for m in re.finditer(r"<style([^>]*)>(.*?)</style>", html, re.S):
        attrs, body = m.group(1), m.group(2)
        idm = re.search(r'id="([^"]+)"', attrs)
        name = idm.group(1) if idm else None
        if name and not re.match(r"(vd|vg|vordien)-", name):
            name = None
        if not name:
            name = next((v for k, v in ANON.items() if body.strip().startswith(k)), None)
        if not name:
            continue
        n += 1
        where = "head" if m.start() < head_end else "body"
        f = OUT / f"{n:02d}-{name}.css"
        f.write_text(f"/* kaynak: <style id=\"{name}\"> ({where}) */\n{body.strip()}\n", encoding="utf-8")
        print(f.name, len(body), where)


if __name__ == "__main__":
    main(sys.argv[1])
