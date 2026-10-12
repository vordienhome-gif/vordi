#!/usr/bin/env python3
"""InSales tema aracı: tema dosyalarını depo ile mağaza arasında senkronlar.

Ortam değişkenleri:
  INSALES_SHOP      myshop-dfp694.myinsales.ru
  INSALES_KEY       API anahtarı (идентификатор)
  INSALES_PASSWORD  API şifresi

Kullanım:
  theme.py list                         temaları listeler
  theme.py push THEME_ID [dosya ...]    insales/theme altındaki dosyaları temaya yükler
                                        (dosya verilmezse son push'tan beri değişenler)
  theme.py push THEME_ID --all          tüm dosyaları yükler
  theme.py publish THEME_ID             temayı yayına alır

Dosya düzeni: theme/templates/*.liquid, theme/snippets/*.liquid, theme/media/*
"""
import base64, hashlib, json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME_DIR = os.path.join(ROOT, 'theme')
STATE = os.path.join(ROOT, '.push-state.json')
TYPES = {'templates': 'Asset::Template', 'snippets': 'Asset::Snippet', 'media': 'Asset::Media'}
TEXT_EXT = ('.liquid', '.css', '.js', '.json', '.html', '.svg', '.txt')


def api(method, path, body=None):
    shop, key, pwd = (os.environ.get(k) for k in ('INSALES_SHOP', 'INSALES_KEY', 'INSALES_PASSWORD'))
    if not (shop and key and pwd):
        sys.exit('INSALES_SHOP, INSALES_KEY ve INSALES_PASSWORD tanımlı olmalı')
    cmd = ['curl', '-sS', '-m', '120', '-u', f'{key}:{pwd}', '-X', method,
           '-H', 'Content-Type: application/json', '-w', '\n%{http_code}', f'https://{shop}/admin/{path}']
    data = json.dumps(body).encode() if body is not None else None
    if data is not None:
        cmd += ['--data-binary', '@-']
    for attempt in range(6):
        r = subprocess.run(cmd, input=data, capture_output=True)
        if r.returncode == 0:
            out, _, code = r.stdout.decode().rpartition('\n')
            code = int(code)
            if code == 429 or code >= 500:
                time.sleep(2 ** attempt)
                continue
            if code >= 400:
                raise RuntimeError(f'{method} {path}: HTTP {code} {out[:500]}')
            return json.loads(out) if out.strip() else None
        time.sleep(2 ** attempt)
    raise RuntimeError(f'{method} {path}: {r.stderr.decode()[:300]}')


def local_files():
    for folder in TYPES:
        d = os.path.join(THEME_DIR, folder)
        for name in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            yield folder, name, os.path.join(d, name)


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()


def push(theme_id, names, push_all):
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    tstate = state.setdefault(str(theme_id), {})
    remote = {a['inner_file_name']: a for a in api('GET', f'themes/{theme_id}/assets.json')}
    for folder, name, path in local_files():
        h = digest(path)
        if names and name not in names:
            continue
        if not names and not push_all and tstate.get(name) == h:
            continue
        with open(path, 'rb') as f:
            raw = f.read()
        asset = {'name': name, 'type': TYPES[folder]}
        if name.endswith(TEXT_EXT):
            asset['content'] = raw.decode('utf-8')
        else:
            asset['attachment'] = base64.b64encode(raw).decode()
        old = remote.get(name)
        if old and 'content' in asset and folder != 'media':
            api('PUT', f"themes/{theme_id}/assets/{old['id']}.json", {'asset': {'content': asset['content']}})
        else:
            if old:
                api('DELETE', f"themes/{theme_id}/assets/{old['id']}.json")
            api('POST', f'themes/{theme_id}/assets.json', {'asset': asset})
        tstate[name] = h
        json.dump(state, open(STATE, 'w'), indent=1)
        print('yüklendi:', name)


def pull(theme_id, only=None):
    """Şablon ve snippet içeriklerini API'den, CSS/JS'yi mağaza sayfasındaki CDN adresinden indirir."""
    folders = {v: k for k, v in TYPES.items()}
    for a in api('GET', f'themes/{theme_id}/assets.json'):
        name, folder = a['inner_file_name'], folders.get(a['type'])
        if not folder or (only and name not in only) or folder == 'media':
            continue
        content = api('GET', f"themes/{theme_id}/assets/{a['id']}.json").get('content') or ''
        os.makedirs(os.path.join(THEME_DIR, folder), exist_ok=True)
        with open(os.path.join(THEME_DIR, folder, name), 'w') as f:
            f.write(content)
        print('indirildi:', name)


def main():
    a = sys.argv[1:]
    if not a or a[0] == 'list':
        for t in api('GET', 'themes.json'):
            print(t['id'], t['title'], 'YAYINDA' if t['is_published'] else '')
    elif a[0] == 'push':
        push(int(a[1]), set(x for x in a[2:] if x != '--all'), '--all' in a)
    elif a[0] == 'pull':
        pull(int(a[1]), set(a[2:]) or None)
    elif a[0] == 'publish':
        api('PUT', f'themes/{a[1]}.json', {'theme': {'is_published': True}})
        print('yayında:', a[1])
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
