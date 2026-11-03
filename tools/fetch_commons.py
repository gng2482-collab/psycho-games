#!/usr/bin/env python3
"""Wikimedia Commons から、自由なライセンスの頭部CT画像と、その出典・ライセンスを集める。

GitHub Actions（.github/workflows/fetch-ct.yml）で動かす。結果は ct-src/ に置く:
  ct-src/<group>/<番号>.png   … 幅512pxの画像
  ct-src/manifest.json        … 各画像の出典（ページURL・作者・ライセンス・説明）
採用する画像は人が目で見て選び、ゲームのページには選んだものだけを入れる。
"""
import json, os, re, time, urllib.parse, urllib.request

UA = 'psycho-games-edu/1.0 (https://github.com/gng2482-collab/psycho-games; educational, low volume)'
API = 'https://commons.wikimedia.org/w/api.php'
OUT = 'ct-src'
OK_LIC = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?)', re.I)

# グループ名: (カテゴリ, 検索語の一覧)
GROUPS = {
    'normal_case1': ('Category:Computed tomography of normal brain in axial plane (case 1)', []),
    'csdh': (None, ['chronic subdural hematoma CT', 'subdural hematoma computed tomography', 'subdural haematoma CT scan']),
    'hydrocephalus': (None, ['normal pressure hydrocephalus CT', 'hydrocephalus CT scan', 'ventriculomegaly CT']),
    'atrophy': (None, ['cerebral atrophy CT', 'brain atrophy computed tomography', 'cerebral atrophy elderly CT']),
    'infarct': (None, ['old cerebral infarction CT', 'middle cerebral artery infarct CT', 'encephalomalacia CT', 'lacunar infarct CT']),
    'hemorrhage': (None, ['intracerebral hemorrhage CT', 'basal ganglia hemorrhage CT', 'thalamic hemorrhage CT']),
    'calcification': (None, ['basal ganglia calcification CT', 'Fahr disease CT', 'pineal gland calcification CT']),
    'whitematter': (None, ['leukoaraiosis CT', 'white matter hypodensity CT', 'small vessel disease CT brain']),
    'cerebellum': (None, ['cerebellar atrophy CT', 'alcoholic cerebellar degeneration CT']),
    'ftd': (None, ['frontotemporal dementia CT', 'frontotemporal atrophy CT']),
}
PER_QUERY = 12


def api(params, tries=5):
    params = dict(params, format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return json.load(urllib.request.urlopen(req, timeout=40))
        except Exception as e:  # 429 などは待ってやり直す
            print('retry', k, e)
            time.sleep(5 * (k + 1))
    return {}


def get(url, tries=5):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            print('retry', k, e)
            time.sleep(5 * (k + 1))
    return None


def titles_for(cat, queries):
    out = []
    if cat:
        cont = {}
        while True:
            d = api(dict({'action': 'query', 'list': 'categorymembers', 'cmtitle': cat, 'cmtype': 'file', 'cmlimit': 100}, **cont))
            out += [m['title'] for m in d.get('query', {}).get('categorymembers', [])]
            if 'continue' not in d: break
            cont = d['continue']
            time.sleep(1)
    for q in queries:
        d = api({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srlimit': PER_QUERY, 'srsearch': q + ' filetype:bitmap'})
        out += [s['title'] for s in d.get('query', {}).get('search', [])]
        time.sleep(1)
    seen, res = set(), []
    for t in out:
        if t not in seen: seen.add(t); res.append(t)
    return res


def strip(html):
    return re.sub(r'<[^>]+>', '', html or '').strip()


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for group, (cat, queries) in GROUPS.items():
        titles = titles_for(cat, queries)
        print(group, len(titles), 'candidates')
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        n = 0
        for i in range(0, len(titles), 40):
            d = api({'action': 'query', 'titles': '|'.join(titles[i:i + 40]), 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 512})
            for p in d.get('query', {}).get('pages', []):
                ii = (p.get('imageinfo') or [None])[0]
                if not ii or ii.get('mime') not in ('image/png', 'image/jpeg'): continue
                m = ii.get('extmetadata', {})
                g = lambda k: (m.get(k) or {}).get('value', '')
                lic = strip(g('LicenseShortName'))
                if not OK_LIC.match(lic): continue
                data = get(ii.get('thumburl') or ii['url'])
                if not data: continue
                n += 1
                name = '%s/%03d%s' % (group, n, '.png' if ii['mime'] == 'image/png' else '.jpg')
                with open(os.path.join(OUT, name), 'wb') as f: f.write(data)
                manifest[name] = {
                    'title': p['title'], 'page': ii.get('descriptionurl', ''), 'license': lic,
                    'license_url': strip(g('LicenseUrl')), 'artist': strip(g('Artist')), 'credit': strip(g('Credit'))[:300],
                    'description': strip(g('ImageDescription'))[:600], 'categories': strip(g('Categories'))[:400],
                    'width': ii.get('width'), 'height': ii.get('height'),
                }
                time.sleep(0.5)
            time.sleep(1)
        print(group, n, 'saved')
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print('total', len(manifest))


if __name__ == '__main__':
    main()
