#!/usr/bin/env python3
# Önizleme temasına yükleme: CSS/JS/font adresleri yayındaki temanın çalışan CDN'ine çevrilir
import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import theme
B='https://cdn.insales-shop.ru/assets/1/3209/11627657/1791473364/'
T=int(os.environ.get("PREVIEW_THEME", "11649681"))
remote={a['inner_file_name']:a for a in theme.api('GET',f'themes/{T}/assets.json')}
for path in sys.argv[1:]:
    name=os.path.basename(path); s=open(path).read()
    s=re.sub(r"\{\{ '([\w.-]+\.(?:css|js|woff2))' \| asset_url \}\}", lambda m:B+m.group(1), s)
    typ='Asset::Template' if '/templates/' in path else 'Asset::Snippet'
    if name in remote: theme.api('PUT',f"themes/{T}/assets/{remote[name]['id']}.json",{'asset':{'content':s}})
    else: theme.api('POST',f'themes/{T}/assets.json',{'asset':{'name':name,'content':s,'type':typ}})
    print('ok',name)
