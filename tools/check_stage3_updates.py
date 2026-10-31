"""PR #3追加分：制作ノート・用語・生成量・配色・新調後のパネルを実ブラウザで確認。"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/artifacts/stage3-updates'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    args = parser.parse_args()
    url = args.base_url.rstrip('/') + '/play/'
    OUT.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])

        def scene(fixture=None, debug=True):
            ctx = browser.new_context(locale='ja-JP', timezone_id='Asia/Tokyo', viewport={'width': 1920, 'height': 1080})
            ctx.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
            page = ctx.new_page()
            now = datetime(2026, 10, 31, tzinfo=timezone.utc)
            page.clock.install(time=now)
            page.clock.pause_at(now + timedelta(minutes=1))
            page.goto(url + '?debug=' + ('1' if debug else '0') + (('&state=' + fixture) if fixture else ''))
            page.locator('.intro-note, .foundation, .kumiki').first.wait_for()
            page.evaluate('async () => { await document.fonts.ready; }')
            return ctx, page

        ctx, page = scene()
        assert page.locator('.intro-note').count() == 1
        assert page.locator('.intro-note button').inner_text() == 'はじめる'
        assert page.locator('.foundation').count() == 0
        assert page.locator('.intro-note pre').inner_text().startswith('制作ノート.txt\n\nこの画面は、ピクセルでできている。')
        widths = page.evaluate('''() => {
          const c = document.createElement('canvas').getContext('2d'); c.font='18px "Refresh Mono"';
          return ['iiii','WWWW','漢字','abcd'].map(s => c.measureText(s).width);
        }''')
        assert abs(widths[0] - widths[1]) < .01 and abs(widths[2] - widths[3]) < .01, widths
        page.clock.run_for(300_000)
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        page.locator('.intro-note button').click()
        assert page.locator('.intro-note').count() == 0
        assert page.locator('.passive-rate').count() == 0
        assert page.locator('.guide-notices').count() == 0
        page.reload(); page.locator('.intro-note').wait_for()
        page.locator('.intro-note button').click()
        page.evaluate("() => { for(let i=0;i<10;i++) document.querySelector('.generate-button').click(); }")
        assert 'クリック +1' in page.locator('.build-button').inner_text()
        page.get_by_role('button', name='ボーダーを作る（10 ピクセル）', exact=True).click()
        assert page.locator('.purchase-effect').count() == 0  # セーブには生成効果を添えない
        page.evaluate("() => { for(let i=0;i<20;i++) document.querySelector('.generate-button').click(); }")
        page.get_by_role('button', name='セーブを作る（40 ピクセル）', exact=True).click()
        page.reload(); page.locator('.foundation').wait_for()
        assert page.locator('.intro-note').count() == 0
        checks.append('制作ノートの本文・等幅の同梱書体・一瞬の切替、開始前は進行せず、セーブ前は再表示・セーブ後は直接再開')

        page.get_by_role('button', name='ピクセルを足す', exact=True).click()
        page.get_by_role('button', name='オートカーソルを作る（15 ピクセル）', exact=True).click()
        assert page.locator('.passive-rate').inner_text() == '（毎秒 +1）'
        assert page.locator('.passive-rate').get_attribute('data-rate') == '1'
        assert 'オートカーソル ×1.5' in page.get_by_role('button', name='カラーを作る（200 ピクセル）', exact=True).inner_text()
        page.get_by_role('button', name='カラーを作る（200 ピクセル）', exact=True).click()
        assert page.locator('.passive-rate').get_attribute('data-rate') == '1.5'
        assert 'クリック ×2' in page.get_by_role('button', name='フォントを作る（700 ピクセル）', exact=True).inner_text()
        page.get_by_role('button', name='フォントを作る（700 ピクセル）', exact=True).click()
        assert page.locator('.passive-rate').get_attribute('data-rate') == '3'
        cursor = page.get_by_role('button', name='オートカーソルを作る（18 ピクセル）', exact=True)
        assert '毎秒 +3' in cursor.inner_text()
        cursor.click()
        assert page.locator('.passive-rate').get_attribute('data-rate') == '6'
        before = float(page.locator('.pixel-count').get_attribute('data-value'))
        page.clock.run_for(1000)
        after = float(page.locator('.pixel-count').get_attribute('data-value'))
        assert abs(after - before - 6) < .001, (before, after)
        ctx.close()
        checks.append('最初のオートカーソルから毎秒量を表示し、カラー・フォント・買い足し後の値と実際の1秒分が一致。生成効果のない購入には注記なし')

        expected = re.findall(r'width:20px;height:20px;background:(#[0-9a-f]{6})', (ROOT / 'docs/mockups/02-design-tool.html').read_text())[:16]
        assert len(expected) == 16
        for fixture in ['kumiki-early', 'kumiki-mature', 'kumiki-wall']:
            ctx, page = scene(fixture)
            page.clock.run_for(1400)
            colors = page.locator('.palette-swatches button').evaluate_all("items => items.map(e => e.style.backgroundColor)")
            def rgb(c): return 'rgb(' + ', '.join(str(int(c[i:i+2], 16)) for i in [1, 3, 5]) + ')'
            assert colors == [rgb(c) for c in expected], colors
            assert page.locator('.seed-content').evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(192, 192, 192)'
            assert page.locator('.generate-button').first.evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(0, 128, 128)'
            rate = page.locator('.passive-rate').get_attribute('data-rate')
            assert float(rate) > 0
            assert page.locator('.k-toolbar').inner_text().find('毎秒 +') >= 0
            if fixture == 'kumiki-mature': assert '最大 ×1.2' in page.locator('.next-component').inner_text()
            ctx.close()
        checks.append('16色パレットが見本02と同じ色・順番、Tessera内でもホーム画面は灰地・青緑の生成ボタン、毎秒量も継続表示')

        for language in ['ja', 'en', 'en-XA']:
            for fixture in ['intro', 'seed-motion', 'kumiki-mature', 'kumiki-modern']:
                ctx, page = scene(fixture)
                if fixture.startswith('kumiki'): page.clock.run_for(1400)
                page.locator('.debug-panel .language-select select').select_option(language)
                for width, height in [(1920,1080),(1366,768)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    page.wait_for_function('''() => {
                      const r = document.querySelector('.stage').getBoundingClientRect();
                      return r.left >= -.1 && r.right <= innerWidth + .1 && r.bottom <= innerHeight + .1;
                    }''')
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    overflow = page.locator('.intro-note pre,.purchase-effect,.editor-heading,.property-panel label,.layer-list button,.k-toolbar span').evaluate_all('''items => items.filter(e => e.clientWidth && e.scrollWidth > e.clientWidth+2).map(e => e.textContent)''')
                    assert not overflow, (language, fixture, overflow)
                    if fixture == 'kumiki-modern':
                        right = page.locator('.icon-editor')
                        assert right.locator('.icon-panel').count() == 1
                        assert right.locator('.property-panel').count() == 1
                        assert right.locator('.layer-list').count() == 1
                        assert page.locator('.k-parts-panel .layer-list').count() == 0
                        panels = [right.locator(s).bounding_box() for s in ['.icon-panel','.property-panel','.layer-list']]
                        assert all(a['y'] + a['height'] <= b['y'] + 1 for a,b in zip(panels, panels[1:])), panels
                        assert right.evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(47, 47, 47)'
                        assert right.locator('h2').first.evaluate('e => getComputedStyle(e).boxShadow') == 'none'
                        if language == 'ja' and width == 1920:
                            button = page.locator('.generate-button').first
                            assert right.locator('.property-panel select').first.input_value() == '#285b75'
                            assert button.evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(40, 91, 117)'
                            page.locator('.property-panel input[type=range]').fill('4')
                            assert button.evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(40, 91, 117)'
                    if language == 'ja':
                        body = page.locator('.stage').inner_text()
                        assert not re.search('組木|部品|拡張機能|下絵|自由帳|書き出|枠線|自動カーソル|集中モード', body), body
                    if language == 'en':
                        body = page.locator('.stage').inner_text().replace('日本語', '')
                        assert not re.search('[\u3040-\u9fff]|Kumiki|[Cc]omponent|[Ee]xtension|[Ss]ketchbook|automatic cursor', body), body
                    page.locator('.debug-panel').evaluate("e => e.style.visibility='hidden'")
                    page.screenshot(path=str(OUT / f'{fixture}-{language}-{width}.png'))
                    page.locator('.debug-panel').evaluate("e => e.style.visibility='visible'")
                ctx.close()
        checks.append('3言語×2画面で導入・素の画面・Tesseraを撮影。旧用語の残り、文字のはみ出し、新調後の右側3パネルの並びと細い線を確認')
        browser.close()
    assert not errors, errors
    report = {'checks': checks, 'pageErrors': errors}
    (OUT/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__': main()
