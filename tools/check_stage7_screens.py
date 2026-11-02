"""Exercise all software release-page layouts in the built, offline game.

Screenshots, a JSON summary, and a browsable gallery stay under game/artifacts.
Use --resume to keep successful cases and --generation/--screen/--language/
--width to repeat the conditions affected by a correction.
--mode semantic compares identical product data in all three layouts;
--mode reference captures the classic layout beside the pre-rework build.
"""
import argparse
import base64
import html
import json
import math
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/artifacts/stage7-layouts'


def baseline_values():
    source = subprocess.run(['git', 'show', 'origin/main:game/src/config/balance.ts'], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    number = lambda key: float(re.search(r'\b' + key + r':\s*([\d_]+(?:\.\d+)?)', source).group(1).replace('_', ''))
    weights = [int(value.strip().replace('_', '')) for value in re.search(r'dailyWeights:\s*\[([^]]+)\]', source).group(1).split(',')]
    prices = {}
    for key in ['color', 'refresh']:
        block = re.search(r'\b' + key + r':\s*\[([\s\S]*?)\],', source).group(1)
        prices[key] = [int(value.replace('_', '')) for value in re.findall(r'price:\s*([\d_]+)', block)]
    return {'downloadsPerDollar': number('storeDownloadsPerDollar'), 'unitPrice': number('storeUnitPrice'), 'weights': weights, 'prices': prices}


def daily_sales(revenue, weights):
    exact = [revenue * weight / sum(weights) for weight in weights]
    result = [math.floor(value) for value in exact]
    remainder = revenue - sum(result)
    order = sorted(range(len(weights)), key=lambda index: (-(exact[index] - result[index]), index))
    for index in order[:remainder]:
        result[index] += 1
    return result


def write_gallery(report):
    groups = []
    for case in report['scenes']:
        pictures = ''.join('<a href="' + html.escape(image['file']) + '"><img loading="lazy" src="' + html.escape(image['file']) + '" alt="' + html.escape(image['label']) + '"><span>' + html.escape(image['label']) + '</span></a>' for image in case.get('images', []))
        label = f"{case['screen']} · {case['variant']} · {case['language']} · {case['viewport'][0]}×{case['viewport'][1]}"
        groups.append('<section data-screen="' + case['screen'] + '" data-variant="' + case['variant'] + '" data-language="' + case['language'] + '"><h2>' + html.escape(label) + ' — ' + case['status'] + '</h2>' + ('<pre>' + html.escape(case['error']) + '</pre>' if case.get('error') else '') + '<div class="pictures">' + pictures + '</div></section>')
    document = '''<!doctype html><html lang="ja"><meta charset="utf-8"><title>段階7：製品ページと出荷の画面</title><style>
body{margin:24px;font:14px/1.5 sans-serif;background:#f1f1f1;color:#222}header{position:sticky;top:0;background:#fff;padding:12px;border:1px solid #bbb;z-index:1}h1{font-size:20px;margin:0 0 6px}h2{font-size:16px}label{margin-right:16px}section{border-top:1px solid #aaa;padding:12px 0}.pictures{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px}.pictures a{color:#222;display:block;background:#fff;border:1px solid #bbb;padding:5px}.pictures img{width:100%;height:auto;display:block}.pictures span{display:block;padding:5px}pre{white-space:pre-wrap;color:#9a2222}
</style><header><h1>段階7：製品ページ・出荷画面の3世代</h1><p>3言語・2サイズ。画像を押すと元の大きさで開きます。参考サービスの画像は含みません。</p>
<label>画面 <select id="screen"><option value="">すべて</option><option>store</option><option>sales</option></select></label><label>様式 <select id="variant"><option value="">すべて</option><option>gen1</option><option>gen2</option><option>gen3</option><option>freeware</option></select></label><label>言語 <select id="language"><option value="">すべて</option><option>ja</option><option>en</option><option>en-XA</option></select></label></header>'''
    document += '<p><a href="comparison-store.html">製品ページ3世代の横並び</a> · <a href="comparison-sales.html">出荷画面3世代の横並び</a> · <a href="semantic.json">同じ製品の情報集合</a> · <a href="reference-comparison.html">第1世代の旧版比較</a></p>'
    document += ''.join(groups) + '''<script>for(const field of document.querySelectorAll('select'))field.onchange=()=>{for(const item of document.querySelectorAll('section'))item.hidden=[...document.querySelectorAll('select')].some(control=>control.value&&item.dataset[control.id]!==control.value)};</script></html>'''
    (OUT / 'index.html').write_text(document)


def comparison_boards(browser):
    """Lay out our own unmodified screenshots as three browser-rendered thumbnails."""
    outputs = []
    for screen, title in [('store', '製品ページ'), ('sales', '出荷・売上報告')]:
        pictures = [OUT / f'{screen}-gen{generation}-ja-1920.png' for generation in [1, 2, 3]]
        if not all(path.exists() for path in pictures):
            continue
        before = '<!doctype html><html lang="ja"><meta charset="utf-8"><title>' + title + '：3世代比較</title><style>body{margin:20px;background:#ececec;color:#222;font:16px sans-serif}h1{font-size:22px;margin:0 0 12px}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;background:#fff;border:1px solid #aaa;padding:8px}figcaption{font-weight:bold;margin:0 0 8px}img{display:block;width:100%;height:auto}</style><h1>' + title + ' — 同じ表示サイズでの3世代比較</h1><div class="row">'
        images = []
        inline_images = []
        for generation, path in enumerate(pictures, 1):
            label = f'第{generation}世代'
            images.append(f'<figure><figcaption>{label}</figcaption><a href="{path.name}"><img src="{path.name}" alt="{label}"></a></figure>')
            data = base64.b64encode(path.read_bytes()).decode()
            inline_images.append(f'<figure><figcaption>{label}</figcaption><img src="data:image/png;base64,{data}" alt="{label}"></figure>')
        after = '</div></html>'
        (OUT / f'comparison-{screen}.html').write_text(before + ''.join(images) + after)
        page = browser.new_page(viewport={'width': 1540, 'height': 380})
        page.set_content(before + ''.join(inline_images) + after)
        page.locator('img').last.wait_for()
        page.evaluate('Promise.all([...document.images].map(image=>image.decode()))')
        page.screenshot(path=str(OUT / f'comparison-{screen}.png'), full_page=True)
        page.close()
        outputs.append(f'comparison-{screen}.png')
    return outputs


def write_archive(report):
    paths = {'index.html', 'summary.json'}
    for case in report['scenes']:
        paths.update(image['file'] for image in case.get('images', []))
    for screen in ['store', 'sales']:
        paths.update([f'comparison-{screen}.png', f'comparison-{screen}.html'])
    for name in ['semantic.json', 'reference.json', 'reference-comparison.html']:
        paths.add(name)
    for case in report.get('referenceComparison', {}).get('scenes', []):
        paths.update(case['files'])
    archive = OUT / 'stage7-layouts-screens.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as package:
        for name in sorted(paths):
            if (OUT / name).is_file():
                package.write(OUT / name, name)
    return archive


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--reference-url', default='http://127.0.0.1:4191')
    parser.add_argument('--mode', choices=['matrix', 'semantic', 'reference', 'artifacts'], default='matrix')
    parser.add_argument('--generation', type=int, choices=[1, 2, 3], action='append')
    parser.add_argument('--screen', choices=['store', 'sales'], action='append')
    parser.add_argument('--language', choices=['ja', 'en', 'en-XA'], action='append')
    parser.add_argument('--width', type=int, choices=[1920, 1366], action='append')
    parser.add_argument('--freeware-only', action='store_true')
    parser.add_argument('--skip-freeware', action='store_true')
    parser.add_argument('--include-freeware', action='store_true')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--recheck', action='store_true')
    parser.add_argument('--keep-going', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    locales = {lang: json.loads((ROOT / f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja', 'en']}
    baseline = baseline_values()
    report = json.loads((OUT / 'summary.json').read_text()) if (args.resume or args.mode != 'matrix') and (OUT / 'summary.json').exists() else {'scenes': [], 'pageErrors': [], 'externalRequests': [], 'baseline': baseline}
    scenes = report['scenes']
    languages = args.language or ['ja', 'en', 'en-XA']
    widths = args.width or [1920, 1366]
    variants = [] if args.freeware_only else ['gen' + str(number) for number in args.generation or [1, 2, 3]]
    if not args.skip_freeware and (args.freeware_only or args.include_freeware or not args.generation):
        variants.append('freeware')

    if args.mode != 'matrix':
        variants = []

    def persist():
        report['passed'] = sum(scene['status'] == 'passed' for scene in scenes)
        report['failed'] = sum(scene['status'] == 'failed' for scene in scenes)
        (OUT / 'summary.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        write_gallery(report)

    def translation(language, key):
        value = locales['ja' if language == 'ja' else 'en'][key]
        if language == 'en-XA':
            value = '[' + re.sub(r'\{\w+\}|[^{}]+', lambda match: match[0] if match[0].startswith('{') else match[0] + '~' * math.ceil(len(match[0]) * .4), value) + ']'
        return value

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])

        def open_scene(name, language, width, case, save=None, base_url=None):
            base_url = base_url or args.base_url
            height = 1080 if width == 1920 else 768
            context = browser.new_context(viewport={'width': width, 'height': height}, locale='ja-JP' if language == 'ja' else 'en-US', timezone_id='Asia/Tokyo')
            def route(request):
                if request.request.url.startswith(base_url):
                    request.continue_()
                else:
                    report['externalRequests'].append(request.request.url)
                    request.abort()
            context.route('**/*', route)
            if save is not None:
                context.add_init_script('if(!localStorage.getItem("refresh.save"))localStorage.setItem("refresh.save",' + json.dumps(json.dumps(save)) + ')')
            page = context.new_page()
            page.set_default_timeout(12000)
            page.on('pageerror', lambda error: (case['pageErrors'].append(str(error)), report['pageErrors'].append(str(error))))
            now = datetime(2026, 11, 2, tzinfo=timezone.utc)
            page.clock.install(time=now)
            page.clock.pause_at(now + timedelta(minutes=1))
            page.goto(base_url + '/play/?debug=1' + ('' if save is not None else '&state=' + name))
            page.locator('.debug-panel select').first.select_option(language)
            page.evaluate('document.fonts.ready')
            page.locator('.debug-panel').evaluate('element=>element.style.display="none"')
            page.clock.run_for(2500)
            return context, page

        def export(page):
            with page.expect_download() as download:
                page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('element=>element.click()')
            return json.loads(Path(download.value.path()).read_text())

        def product(state):
            return next(item for item in state['persistent']['products'] if item['id'] == state['run']['shipping']['productId'])

        def capture(page, case, label, suffix=''):
            filename = case['id'] + ('-' + suffix if suffix else '') + '.png'
            page.screenshot(path=str(OUT / filename))
            case['images'].append({'file': filename, 'label': label})

        def clipping(page, root):
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal viewport overflow'
            assert root.evaluate('element=>element.scrollWidth<=element.clientWidth+2'), 'Horizontal page overflow'
            values = root.locator('button,th,td,label,h1,h2,h3,p').evaluate_all('''elements=>elements.flatMap(element=>{
              const style=getComputedStyle(element),rect=element.getBoundingClientRect();
              if(element.closest('[inert]')||style.display==='none'||style.visibility==='hidden'||rect.width<=0||rect.height<=0)return [];
              const horizontal=element.clientWidth>0&&element.scrollWidth>element.clientWidth+2;
              const vertical=element.clientHeight>0&&element.scrollHeight>element.clientHeight+2&&!['auto','scroll'].includes(style.overflowY);
              return horizontal||vertical?[{tag:element.tagName,class:element.className,text:element.textContent,horizontal,vertical}]:[];
            })''')
            assert not values, values

        def scroll_capture(page, root, case):
            candidates = root.evaluate('''root=>[root,...root.querySelectorAll('*')].flatMap((element,index)=>{
              if(element.closest('[inert]')||element.clientHeight<=140||element.scrollHeight<=element.clientHeight+5)return [];
              const style=getComputedStyle(element),rect=element.getBoundingClientRect();
              return rect.width>0&&rect.height>0&&['auto','scroll'].includes(style.overflowY)?[{index,height:element.clientHeight,total:element.scrollHeight}]:[];
            })''')
            for index, metrics in enumerate(candidates):
                item = root if metrics['index'] == 0 else root.locator('*').nth(metrics['index'] - 1)
                positions = sorted(set([round((metrics['total'] - metrics['height']) / 2), metrics['total'] - metrics['height']]))
                for step, offset in enumerate(positions):
                    item.evaluate('(element,offset)=>element.scrollTop=offset', offset)
                    page.clock.run_for(20)
                    clipping(page, root)
                    capture(page, case, 'ページ途中' if step == 0 else 'ページ下部', f'scroll-{index + 1}-{step + 1}')
                item.evaluate('element=>element.scrollTop=0')

        def typography(page, root, case):
            values = root.evaluate('element=>({font:getComputedStyle(element).fontFamily,size:getComputedStyle(element).fontSize,lineHeight:getComputedStyle(element).lineHeight})')
            generation = 1 if case['variant'] == 'freeware' else int(case['variant'][-1])
            if generation == 1:
                assert 'MS PGothic' in values['font'] and 'Noto' not in values['font'] and 'Refresh' not in values['font'], values
                size = float(values['size'].removesuffix('px'))
                assert 12 <= size <= 13, values
                assert 1.4 <= float(values['lineHeight'].removesuffix('px')) / size <= 1.5, values
                if case['screen'] == 'store':
                    width = root.locator('.store-shell').evaluate('element=>element.offsetWidth')
                    assert 850 <= width <= 862, width
                    values['contentWidth'] = width
                session = page.context.new_cdp_session(page)
                session.send('DOM.enable')
                session.send('CSS.enable')
                document = session.send('DOM.getDocument', {'depth': 0})
                selector = '.store-page h1' if case['screen'] == 'store' else '.shipping-page h1'
                node = session.send('DOM.querySelector', {'nodeId': document['root']['nodeId'], 'selector': selector})
                values['headingPlatformFonts'] = session.send('CSS.getPlatformFontsForNode', {'nodeId': node['nodeId']})['fonts']
                assert values['headingPlatformFonts'] and all(not font['isCustomFont'] and 'noto' not in font['familyName'].lower() and 'refresh' not in font['familyName'].lower() for font in values['headingPlatformFonts']), values
                session.detach()
            return values

        def sales_checks(page, root, case, state):
            record = product(state)
            generation = 1 if case['variant'] == 'freeware' else int(case['variant'][-1])
            assert root.get_attribute('data-generation') == str(generation)
            assert int(root.locator('.revenue-total').get_attribute('data-total')) == record['revenue']
            assert int(root.locator('.available-dollars').get_attribute('data-value')) == state['resources']['dollars']
            expected = daily_sales(record['revenue'], baseline['weights'])
            displayed = [int(item.get_attribute('data-value')) for item in root.locator('.day-sales').all()]
            assert displayed == expected, (displayed, expected)
            cumulative = [int(item.get_attribute('data-cumulative')) for item in root.locator('[data-cumulative]').all()]
            assert cumulative == [sum(expected[:index + 1]) for index in range(7)], cumulative
            assert root.locator('.shipping-daily-table tfoot').count() == 1
            daily = root.locator('.shipping-daily-table')
            assert int(daily.get_attribute('data-first-day')) == expected[0]
            assert int(daily.get_attribute('data-last-day')) == expected[-1]
            case['sales'] = {'revenue': record['revenue'], 'daily': displayed, 'cumulative': cumulative, 'dollars': state['resources']['dollars']}

        def finish_release(page, root, case, state):
            original_product = product(state)
            prototype = original_product['version'] == 'v0.1'
            key = 'color' if prototype else 'refresh'
            old_level = state['persistent']['specs'][key]
            price = baseline['prices'][key][old_level + 1]
            buy = root.locator(f'[data-spec={key}] button')
            expect(buy).to_be_enabled()
            buy.click()
            bought = export(page)
            assert bought['persistent']['specs'][key] == old_level + 1
            assert bought['resources']['dollars'] == state['resources']['dollars'] - price
            selected = None if prototype or case['variant'] == 'gen1' else 'no-cursors' if case['variant'] == 'gen2' else 'no-color'
            if not prototype:
                root.locator('.contract-selection select').select_option(selected or '')
            next_version = root.locator('.next-version button')
            expect(next_version).to_be_enabled()
            next_version.scroll_into_view_if_needed()
            clipping(page, root)
            capture(page, case, '性能購入後・次版の開始', 'ready-next')
            next_version.click()
            page.clock.run_for(12000)
            after = export(page)
            assert after['run']['version'] == ('v1' if prototype else 'v2') and after['run']['world'] == 'seed'
            assert after['resources']['dollars'] == bought['resources']['dollars']
            assert after['resources']['tokens'] == bought['resources']['tokens']
            assert after['persistent']['products'][-1] == original_product
            contract = after['run']['play']['contract']
            assert contract is None if selected is None else contract['id'] == selected
            case['flow'] = {'nextVersion': after['run']['version'], 'spec': key, 'paid': price, 'contract': selected, 'productUnchanged': True}

        def semantic_checks():
            check = {'scenes': [], 'sameInformation': True}
            holder = {'pageErrors': []}
            context, page = open_scene('stage7-store-gen1', 'ja', 1920, holder)
            base = export(page)
            context.close()
            for screen in ['store', 'sales']:
                maps = []
                layouts = []
                for generation in [1, 2, 3]:
                    state = json.loads(json.dumps(base))
                    record = product(state)
                    record['presentation'] = {'medium': 'software', 'desktopStage': (generation - 1) * 2, 'generation': generation}
                    if screen == 'sales':
                        state['run']['shipping'].update({'phase': 'shipping', 'elapsedMs': int(baseline_values_animation())})
                    case = {'pageErrors': []}
                    context, page = open_scene('same-product', 'ja', 1920, case, save=state)
                    page.clock.run_for(8500 if screen == 'sales' else 3200)
                    root = page.locator('.store-page' if screen == 'store' else '.shipping-page')
                    attribute = 'data-store-info' if screen == 'store' else 'data-report-info'
                    entries = root.locator('[' + attribute + ']').evaluate_all(r'''(nodes,attribute)=>nodes.map(node=>{
                      const raw=node.getAttribute(attribute+'-value');
                      const clone=node.cloneNode(true);for(const frozen of clone.querySelectorAll('[inert]'))frozen.remove();
                      return [node.getAttribute(attribute),raw===null?clone.textContent.replace(/\s+/g,' ').trim():JSON.parse(raw)];
                    })''', attribute)
                    mapping = dict(entries)
                    assert len(mapping) == len(entries), entries
                    assert len(mapping) >= 10, mapping
                    assert not case['pageErrors'], case['pageErrors']
                    maps.append(mapping)
                    layouts.append(root.get_attribute('data-store-layout' if screen == 'store' else 'data-report-layout'))
                    scene = {'screen': screen, 'generation': generation, 'layout': layouts[-1], 'information': mapping}
                    if screen == 'sales' and generation == 3:
                        jumps = []
                        workspace = root.locator('.shipping-app-workspace')
                        for button in root.locator('[data-report-jump]').all():
                            target = button.get_attribute('data-report-jump')
                            button.click()
                            expect(button).to_have_attribute('aria-current', 'location')
                            assert root.locator('[data-report-jump][aria-current=location]').count() == 1
                            focused = page.evaluate('''()=>{
                              const target=document.activeElement,view=document.querySelector('.shipping-app-workspace');
                              const rect=target.getBoundingClientRect(),bounds=view.getBoundingClientRect();
                              return {tag:target.tagName,visible:rect.bottom>bounds.top&&rect.top<bounds.bottom};
                            }''')
                            assert focused == {'tag': 'SECTION', 'visible': True}, focused
                            clipping(page, root)
                            jumps.append(target)
                        workspace.evaluate('element=>element.scrollTop=0')
                        scene['navigation'] = jumps
                    check['scenes'].append(scene)
                    context.close()
                assert len(set(layouts)) == 3, layouts
                assert maps[0] == maps[1] == maps[2], {key: [mapping.get(key) for mapping in maps] for key in set().union(*maps) if not maps[0].get(key) == maps[1].get(key) == maps[2].get(key)}
            report['semantic'] = check
            (OUT / 'semantic.json').write_text(json.dumps(check, ensure_ascii=False, indent=2) + '\n')
            print('PASS Same product, different presentations: both screens retain an identical information set', flush=True)

        def baseline_values_animation():
            source = subprocess.run(['git', 'show', 'origin/main:game/src/config/balance.ts'], cwd=ROOT, check=True, capture_output=True, text=True).stdout
            return int(re.search(r'\banimationMs:\s*([\d_]+)', source).group(1).replace('_', ''))

        def reference_checks():
            from PIL import Image, ImageChops
            comparisons = {'scenes': []}
            for variant in ['gen1', 'freeware']:
                for screen in ['store', 'sales']:
                    for width in [1920, 1366]:
                        identity = f'{screen}-{variant}-ja-{width}'
                        fixture = 'stage7-freeware' + ('-sales' if screen == 'sales' else '') if variant == 'freeware' else f'stage7-{screen}-{variant}'
                        files = []
                        for label, address in [('before', args.reference_url), ('after', args.base_url)]:
                            holder = {'pageErrors': []}
                            context, page = open_scene(fixture, 'ja', width, holder, base_url=address)
                            page.clock.run_for(8500 if screen == 'sales' else 3200)
                            filename = f'reference-{identity}-{label}.png'
                            page.screenshot(path=str(OUT / filename))
                            assert not holder['pageErrors'], holder['pageErrors']
                            files.append(filename)
                            context.close()
                        with Image.open(OUT / files[0]) as a, Image.open(OUT / files[1]) as b:
                            assert a.size == b.size
                            diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
                            red, green, blue = diff.split()
                            histogram = ImageChops.lighter(ImageChops.lighter(red, green), blue).histogram()
                            total = a.width * a.height
                            changed = total - histogram[0]
                            bounds = diff.getbbox()
                        comparisons['scenes'].append({'id': identity, 'files': files, 'changedPixels': changed, 'totalPixels': total, 'changedRatio': changed / total, 'bounds': bounds})
                        print('REFERENCE', identity, changed, '/', total, flush=True)
            report['referenceComparison'] = comparisons
            (OUT / 'reference.json').write_text(json.dumps(comparisons, ensure_ascii=False, indent=2) + '\n')
            rows = []
            for case in comparisons['scenes']:
                figures = ''.join('<figure><figcaption>' + label + '</figcaption><img src="' + file + '"></figure>' for label, file in zip(['変更前', '変更後'], case['files']))
                rows.append('<section><h2>' + case['id'] + ' — 差分 ' + str(case['changedPixels']) + ' pixels</h2><div>' + figures + '</div></section>')
            (OUT / 'reference-comparison.html').write_text('<!doctype html><meta charset="utf-8"><title>第1世代の変更前後</title><style>body{font:14px sans-serif;background:#eee}section>div{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%}</style><h1>第1世代・旧ビルドとの比較</h1>' + ''.join(rows))

        for variant in variants:
            for screen in args.screen or ['store', 'sales']:
                for language in languages:
                    for width in widths:
                        identity = f'{screen}-{variant}-{language}-{width}'
                        previous = next((case for case in scenes if case['id'] == identity), None)
                        if args.resume and not args.recheck and previous and previous['status'] == 'passed':
                            continue
                        case = {'id': identity, 'screen': screen, 'variant': variant, 'language': language, 'viewport': [width, 1080 if width == 1920 else 768], 'status': 'running', 'images': [], 'pageErrors': []}
                        scenes[:] = [item for item in scenes if item['id'] != identity]
                        scenes.append(case)
                        context = None
                        try:
                            fixture = 'stage7-freeware' + ('-sales' if screen == 'sales' else '') if variant == 'freeware' else f'stage7-{screen}-{variant}'
                            context, page = open_scene(fixture, language, width, case)
                            selector = '.store-page' if screen == 'store' else '.shipping-page'
                            root = page.locator(selector)
                            expect(root).to_be_visible()
                            page.clock.run_for(8500 if screen == 'sales' else 3200)
                            initial = export(page)
                            record = product(initial)
                            case['typography'] = typography(page, root, case)
                            case['layout'] = root.get_attribute('data-store-layout' if screen == 'store' else 'data-report-layout')
                            assert case['layout'] in (['classic', 'portal', 'modern'] if screen == 'store' else ['register-inquiry', 'publisher-portal', 'partner-console'])
                            clipping(page, root)
                            capture(page, case, '製品ページ' if screen == 'store' else '出荷・売上報告')
                            scroll_capture(page, root, case)
                            if screen == 'store':
                                generation = 1 if variant == 'freeware' else int(variant[-1])
                                assert root.get_attribute('data-store-generation') == str(generation)
                                if generation == 3:
                                    controls = root.locator('.store-modern-carousel .desktop-era-3 .window-controls button').evaluate_all('''buttons=>buttons.map(button=>{
                                      const style=getComputedStyle(button);
                                      return {width:parseFloat(style.width),inlineSize:parseFloat(style.inlineSize),close:button.classList.contains('window-close')};
                                    })''')
                                    assert controls, 'Modern media must contain the frozen desktop window controls'
                                    assert all(item['width'] == item['inlineSize'] == (46 if item['close'] else 29) for item in controls), controls
                                    case['mediaWindowButtons'] = controls
                                assert int(root.locator('[data-store-downloads]').get_attribute('data-store-downloads')) == math.floor(record['revenue'] * baseline['downloadsPerDollar'])
                                if record['version'] != 'v0.1':
                                    assert int(root.locator('[data-store-purchases]').get_attribute('data-store-purchases')) == math.floor(record['revenue'] / baseline['unitPrice'])
                                thumbnails = root.locator('[data-store-photo-choices] > button')
                                if thumbnails.count() > 1:
                                    thumbnails.nth(1).click()
                                    expect(thumbnails.nth(1)).to_have_attribute('aria-pressed', 'true')
                                    assert root.locator('[data-store-photo-choices] > button[aria-pressed=true]').count() == 1
                                    assert export(page)['persistent']['products'][-1] == record
                                    capture(page, case, '写真を選択', 'selected-photo')
                                root.locator('.store-view-sales').click()
                                root = page.locator('.shipping-page')
                                expect(root).to_be_visible()
                                page.clock.run_for(8100)
                                after_store = export(page)
                                assert product(after_store) == record
                                sales_checks(page, root, case, after_store)
                                finish_release(page, root, case, after_store)
                            else:
                                sales_checks(page, root, case, initial)
                                finish_release(page, root, case, initial)
                            assert not case['pageErrors'], case['pageErrors']
                            case['status'] = 'passed'
                            print('PASS', identity, flush=True)
                        except Exception as error:
                            case['status'] = 'failed'
                            case['error'] = str(error)
                            if context:
                                try:
                                    capture(page, case, '検出した問題', 'failure')
                                except Exception:
                                    pass
                            print('FAIL', identity, str(error), flush=True)
                            persist()
                            if not args.keep_going:
                                raise
                        finally:
                            if context:
                                context.close()
                            persist()
        if args.mode == 'semantic':
            semantic_checks()
        if args.mode == 'reference':
            reference_checks()
        report['comparisonBoards'] = comparison_boards(browser)
        browser.close()
    persist()
    print(json.dumps({'passed': report['passed'], 'failed': report['failed'], 'pageErrors': report['pageErrors'], 'externalRequests': report['externalRequests'], 'report': str(OUT / 'summary.json'), 'gallery': str(OUT / 'index.html')}, ensure_ascii=False))
    assert not report['failed'] and not report['pageErrors'] and not report['externalRequests']
    if report['passed'] == 48:
        print('ARCHIVE', str(write_archive(report)))


if __name__ == '__main__':
    main()
