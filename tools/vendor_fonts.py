"""Google Fonts の配布元から書体とOFLを取得し、全グリフをWOFF2に圧縮する。

通常のビルドでは実行しない。更新時だけ fonttools[woff] を入れて実行する。
変換前後のチェックサムと取得元を manifest.json に残す。
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
import json
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / 'game/src/assets/fonts'
FONTS = [
    ('noto-serif-jp', 'notoserifjp', 'NotoSerifJP[wght].ttf'),
    ('biz-udpgothic-regular', 'bizudpgothic', 'BIZUDPGothic-Regular.ttf'),
    ('biz-udpgothic-bold', 'bizudpgothic', 'BIZUDPGothic-Bold.ttf'),
    ('dotgothic16', 'dotgothic16', 'DotGothic16-Regular.ttf'),
]


def fetch_font(entry):
    name, family, filename = entry
    base = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{family}/'
    url = base + quote(filename)
    with urlopen(url, timeout=60) as response:
        original = response.read()
    with urlopen(base + 'OFL.txt', timeout=30) as response:
        license_text = response.read()
    font = TTFont(BytesIO(original), recalcTimestamp=False)
    font.flavor = 'woff2'
    path = ROOT / f'{name}.woff2'
    font.save(path)
    (ROOT / f'{family}-OFL.txt').write_bytes(license_text)
    result = {
        'file': path.name, 'source': url,
        'source_sha256': sha256(original).hexdigest(),
        'woff2_sha256': sha256(path.read_bytes()).hexdigest(),
        'license': f'{family}-OFL.txt',
        'conversion': 'WOFF2 compression, all glyphs and original font metadata retained',
    }
    print(path.name, path.stat().st_size, flush=True)
    return result


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        manifest = list(pool.map(fetch_font, FONTS))
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
