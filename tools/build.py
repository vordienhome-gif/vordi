#!/usr/bin/env python3
"""src/css/*.css dosyalarını birleştirip iki dosya üretir:

  theme/assets/vd-bundle.css  — eskiden <head> içinde olan bloklar (head'de, theme.css'ten sonra yüklenir)
  theme/assets/vd-late.css    — eskiden <body> sonunda olan bloklar (InSales widget CSS'inden SONRA
                                yüklenmeli; aksi halde widget stilleri bunları ezer)

Sıra önemlidir: dosya adındaki numara, blokların sayfadaki eski sırasıdır.
Bir dosyanın hangi gruba ait olduğu ilk satırındaki "(head)" / "(body)" işaretinden okunur.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "css"
ASSETS = ROOT / "theme" / "assets"
HEADER = "/* {} — src/css/ altından tools/build.py ile üretilir, elle düzenlemeyin */"


def main():
    groups = {"vd-bundle.css": [], "vd-late.css": []}
    for f in sorted(SRC.glob("*.css")):
        text = f.read_text(encoding="utf-8").strip()
        target = "vd-late.css" if "(body)" in text.splitlines()[0] else "vd-bundle.css"
        groups[target].append(f"\n/* ===== {f.name} ===== */\n{text}")
    ASSETS.mkdir(parents=True, exist_ok=True)
    for name, parts in groups.items():
        out = ASSETS / name
        out.write_text(HEADER.format(name) + "\n" + "\n".join(parts) + "\n", encoding="utf-8")
        print(out.relative_to(ROOT), out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
