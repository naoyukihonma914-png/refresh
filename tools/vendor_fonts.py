"""配布元の書体を、常用漢字・かな・ラテン文字・記号・翻訳で使う文字に絞る。

更新時だけ fonttools[woff] を用意して実行する。通常のビルドでは通信しない。
--check は取得せず、絞り込んだ書体・文字集合・チェックサムを確認する。
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import tempfile
from urllib.parse import quote
from urllib.request import urlopen

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / 'game/src/assets/fonts'
LOCALES = PROJECT / 'game/src/content/locales'
SUBSETS = PROJECT / 'tools/font_subsets'
SOURCE_REF = '6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec'
FONTS = [
    ('noto-serif-jp', 'notoserifjp', 'NotoSerifJP[wght].ttf'),
    ('noto-sans-jp', 'notosansjp', 'NotoSansJP[wght].ttf'),
    ('biz-udpgothic-regular', 'bizudpgothic', 'BIZUDPGothic-Regular.ttf'),
    ('biz-udpgothic-bold', 'bizudpgothic', 'BIZUDPGothic-Bold.ttf'),
    ('biz-udgothic-regular', 'bizudgothic', 'BIZUDGothic-Regular.ttf'),
    ('mplus1p-regular', 'mplus1p', 'MPLUS1p-Regular.ttf'),
    ('dotgothic16', 'dotgothic16', 'DotGothic16-Regular.ttf'),
]
# DotGothic16には𥝱がない。CSSで次に指定した同梱BIZ UDPGothicへ任せる。
FALLBACKS = {'mplus1p-regular': {'𥝱':'biz-udpgothic-regular.woff2'}, 'dotgothic16': {'𥝱': 'biz-udpgothic-regular.woff2'}}
# 全漢字の範囲は含めない。かな・通常の句読点・記号とラテン文字を明示する。
RANGES = [
    (0x0020, 0x007E), (0x00A0, 0x017F),  # ASCII、Latin-1、Latin Extended-A
    (0x2000, 0x206F), (0x20A0, 0x20CF),  # 句読点、通貨
    (0x2190, 0x22FF), (0x2500, 0x257F), (0x25A0, 0x25FF),  # 矢印、数式、罫線、図形
    (0x3000, 0x30FF), (0x31F0, 0x31FF), (0xFF00, 0xFFEF),  # 和文記号、かな、全角・半角
]


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def character_set():
    joyo = ''.join(line for line in (SUBSETS / 'joyo.txt').read_text(encoding='utf-8').splitlines() if not line.startswith('#'))
    translated = ''
    for path in sorted(LOCALES.iterdir()):
        if path.suffix == '.json':
            translated += ''.join(strings(json.loads(path.read_text(encoding='utf-8'))))
        elif path.suffix == '.md':
            translated += path.read_text(encoding='utf-8')
    characters = set(joyo + translated)
    for start, end in RANGES:
        characters.update(chr(point) for point in range(start, end + 1))
    ordered = ''.join(sorted(characters))
    return characters, set(translated), sha256(ordered.encode()).hexdigest()


def read_source(url, cache):
    path = cache / sha256(url.encode()).hexdigest()
    if not path.exists():
        with urlopen(url, timeout=90) as response:
            data = response.read()
        # 同じOFLを複数の書体が同時に使っても、途中のキャッシュを読まない。
        with tempfile.NamedTemporaryFile(dir=cache, delete=False) as temporary:
            temporary.write(data)
            temporary_path = Path(temporary.name)
        temporary_path.replace(path)
    return path.read_bytes()


def build_font(entry, characters, locale_characters, charset_hash, cache):
    name, family, filename = entry
    base = f'https://raw.githubusercontent.com/google/fonts/{SOURCE_REF}/ofl/{family}/'
    url = base + quote(filename)
    original = read_source(url, cache)
    license_text = read_source(base + 'OFL.txt', cache)
    assert b'SIL OPEN FONT LICENSE' in license_text
    font = TTFont(BytesIO(original), recalcTimestamp=False)
    source_characters = set(font.getBestCmap())
    options = subset.Options()
    options.layout_features = ['ccmp', 'locl', 'liga', 'kern']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.recalc_timestamp = False
    options.drop_tables += ['meta']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=sorted(ord(char) for char in characters))
    subsetter.subset(font)
    font.flavor = 'woff2'
    path = ROOT / f'{name}.woff2'
    font.save(path)
    (ROOT / f'{family}-OFL.txt').write_bytes(license_text)
    result = {
        'file': path.name, 'source': url, 'source_sha256': sha256(original).hexdigest(),
        'woff2_sha256': sha256(path.read_bytes()).hexdigest(), 'license': f'{family}-OFL.txt',
        'conversion': 'WOFF2 subset: Joyo kanji, kana, Latin, symbols, locale files and glossary',
        'charset_sha256': charset_hash, 'fonttools_version': fontTools.__version__,
        'source_codepoints': len(source_characters), 'subset_codepoints': len(font.getBestCmap()),
    }
    missing = [char for char in locale_characters if not char.isspace() and ord(char) not in font.getBestCmap()]
    if missing and any(char not in FALLBACKS.get(name, {}) for char in missing):
        raise ValueError(f'{name}: locale characters missing: {sorted(missing)}')
    result['fallbacks'] = {char: FALLBACKS[name][char] for char in missing} if missing else {}
    print(path.name, path.stat().st_size, result['subset_codepoints'], flush=True)
    return result


def check_fonts(characters, locale_characters, charset_hash):
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    for entry in manifest:
        path = ROOT / entry['file']
        assert sha256(path.read_bytes()).hexdigest() == entry['woff2_sha256'], path.name
        assert charset_hash == entry['charset_sha256'], 'Translations changed: regenerate fonts'
        font = TTFont(path)
        cmap = set(font.getBestCmap())
        assert all(chr(point) in characters for point in cmap), path.name
        fallbacks = entry.get('fallbacks', {})
        assert all(char.isspace() or ord(char) in cmap or char in fallbacks for char in locale_characters), path.name
        for char, fallback in fallbacks.items():
            assert FALLBACKS.get(path.stem, {}).get(char) == fallback
            assert ord(char) in TTFont(ROOT / fallback).getBestCmap(), (char, fallback)
        assert 'SIL OPEN FONT LICENSE' in (ROOT / entry['license']).read_text(encoding='utf-8')
    print('Subset checks passed:', len(characters), 'requested codepoints')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--cache-dir', type=Path, default=Path(tempfile.gettempdir()) / 'refresh-font-sources')
    args = parser.parse_args()
    characters, locale_characters, charset_hash = character_set()
    if args.check:
        check_fonts(characters, locale_characters, charset_hash)
    else:
        ROOT.mkdir(parents=True, exist_ok=True)
        args.cache_dir.mkdir(parents=True, exist_ok=True)
        with ThreadPoolExecutor(max_workers=4) as pool:
            manifest = list(pool.map(lambda entry: build_font(entry, characters, locale_characters, charset_hash, args.cache_dir), FONTS))
        (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
