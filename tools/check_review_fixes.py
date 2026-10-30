"""段階1のレビュー修正：言語・書体・時計変更を実ブラウザで確認する。"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'game/artifacts/stage1-review'


def ready(page):
    page.locator('.foundation').wait_for()
    page.evaluate('async () => { await document.fonts.ready; }')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--chromium', default=shutil.which('chromium'))
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    url = args.base_url.rstrip('/') + '/play/'
    errors = []
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])

        def context(locale='ja-JP'):
            ctx = browser.new_context(locale=locale, timezone_id='Asia/Tokyo', viewport={'width': 1920, 'height': 1080})
            ctx.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
            return ctx

        ctx = context()
        page = ctx.new_page()
        requests = []
        page.on('request', lambda request: requests.append(request.url))
        page.goto(url + '?debug=1&state=foundation-saved')
        ready(page)
        assert page.title() == 'REFRESH'
        licenses = page.locator('#font-licenses').text_content()
        assert set(json.loads(licenses)) == {'notoserifjp', 'bizudpgothic', 'dotgothic16'}
        assert all('SIL OPEN FONT LICENSE' in value for value in json.loads(licenses).values())
        page.evaluate('''async () => {
          for (const family of ['Refresh Serif', 'Refresh UI', 'Refresh Pixel']) {
            await document.fonts.load(`16px "${family}"`, '漢字ABC');
          }
        }''')
        for family in ['Refresh Serif', 'Refresh UI', 'Refresh Pixel']:
            assert page.evaluate('(family) => document.fonts.check(`16px "${family}"`, "漢字ABC")', family)
        assert all(request.startswith(args.base_url.rstrip('/')) for request in requests)
        checks.append('REFRESHの題名、3書体の読み込み、ライセンス全文、外部通信がないこと')

        for language in ['ja', 'en', 'en-XA']:
            page.locator('.debug-panel select').first.select_option(language)
            assert page.evaluate('document.documentElement.lang') == language
            for scope in ['.foundation', '.debug-panel']:
                assert page.locator(scope + ' option[value="ja"]').inner_text() == '日本語'
                assert page.locator(scope + ' option[value="en"]').inner_text() == 'English'
            if language == 'en':
                assert 'Goal:' in page.locator('.foundation').inner_text()
                # 言語の選択肢だけは各言語自身の名前を表示する。
                text = page.locator('body').inner_text().replace('日本語', '')
                assert not any('\u3040' <= char <= '\u9fff' for char in text)
            if language == 'en-XA':
                assert '~' in page.locator('.foundation').inner_text()
            for width, height in [(1920, 1080), (1366, 768)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(100)
                overflow = page.locator('.foundation p, .debug-panel, .debug-panel button, .debug-panel label').evaluate_all('''elements => elements
                  .filter(element => element.scrollWidth > element.clientWidth + 1)
                  .map(element => element.textContent)''')
                assert not overflow, overflow
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=str(ARTIFACTS / f'{language}-{width}x{height}.png'))
        ctx.close()
        checks.append('日本語・英語・約1.4倍の試験用言語を2画面サイズで確認し、はみ出しなし')

        ctx = context('fr-FR')
        page = ctx.new_page()
        page.goto(url + '?debug=1')
        ready(page)
        assert page.evaluate('document.documentElement.lang') == 'en'
        assert page.locator('.debug-panel select').first.input_value() == 'en'
        page.locator('.debug-panel select').first.select_option('ja')
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        assert page.evaluate("JSON.parse(localStorage.getItem('refresh.settings')).language") == 'ja'
        page.reload()
        ready(page)
        assert page.evaluate('document.documentElement.lang') == 'ja'
        page.locator('.debug-panel select').first.select_option('en-XA')
        page.reload()
        ready(page)
        assert page.evaluate('document.documentElement.lang') == 'ja'
        ctx.close()
        checks.append('未対応のブラウザ言語は英語、変更した言語は保存、試験用言語は次回に残さない')

        ctx = context()
        page = ctx.new_page()
        page.goto(url)
        ready(page)
        assert page.locator('.debug-panel').count() == 0
        assert page.locator('.foundation p').first.inner_text().startswith('目標：この')
        page.locator('.foundation select').select_option('en')
        assert page.locator('.foundation p').first.inner_text().startswith('Goal: Finish')
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        page.reload()
        ready(page)
        assert page.locator('.foundation select').input_value() == 'en'
        assert page.evaluate('document.documentElement.lang') == 'en'
        page.screenshot(path=str(ARTIFACTS / 'normal-language-en.png'))
        page.locator('.foundation select').select_option('ja')
        page.screenshot(path=str(ARTIFACTS / 'normal-language-ja.png'))
        ctx.close()
        checks.append('通常画面の末尾から最初から言語を選べ、即時反映と保存ができ、目標の空白もない')

        ctx = context()
        page = ctx.new_page()
        instant = datetime(2026, 10, 30, 16, 0, tzinfo=timezone.utc)
        page.clock.install(time=instant)
        page.goto(url + '?debug=1')
        ready(page)
        page.get_by_role('button', name='保存済みの状態を試す', exact=True).click()
        balance = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
        page.clock.set_fixed_time(instant - timedelta(hours=3))
        page.clock.run_for(1000)
        page.get_by_role('button', name='いま保存する', exact=True).click()
        after = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
        assert 0.9 <= after - balance <= 1.6, (balance, after)
        assert page.get_by_role('status').count() == 0
        balance = after
        # 100ms刻みの処理と、保存ボタンを押した時刻の位相差も含めて待つ。
        page.clock.run_for(10_200)
        saved = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
        assert saved >= balance + 9.9, (balance, saved)
        ctx.close()
        checks.append('端末時計を3時間戻しても毎秒生成と10秒ごとの自動保存が続く')

        for mode in ['both-clocks', 'wall-clock-only']:
            ctx = context()
            page = ctx.new_page()
            page.clock.install(time=instant)
            page.goto(url + '?debug=1')
            ready(page)
            page.get_by_role('button', name='保存済みの状態を試す', exact=True).click()
            balance = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
            if mode == 'both-clocks':
                page.clock.fast_forward(3 * 3_600_000)
            else:
                page.clock.set_fixed_time(instant + timedelta(hours=3))
                page.clock.run_for(100)
            page.get_by_text('留守の間に 2時間ぶん作業しました', exact=False).wait_for()
            saved = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
            assert 7200 <= saved - balance < 7201, (mode, balance, saved)
            page.clock.run_for(1000)
            page.get_by_role('button', name='いま保存する', exact=True).click()
            after = page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.pixels")
            assert 0.9 <= after - saved <= 1.6, (mode, saved, after)
            page.screenshot(path=str(ARTIFACTS / f'sleep-{mode}.png'))
            ctx.close()
        checks.append('開いたまま3時間処理が止まる場合と単調時計が止まる場合に、上限2時間だけ加算し能動生成へ戻る')

        ctx = context()
        page = ctx.new_page()
        page.goto(url + '?debug=1')
        ready(page)
        page.get_by_role('button', name='保存済みの状態を試す', exact=True).click()
        state = page.evaluate("JSON.parse(localStorage.getItem('refresh.save'))")
        ctx.close()
        for minutes, label in [(120, '2時間'), (192, '3時間12分')]:
            state['persistent']['specs']['storage'] = 1
            now = int(datetime.now(timezone.utc).timestamp() * 1000)
            state['createdAt'] = state['lastTickAt'] = state['lastSavedAt'] = now - minutes * 60_000
            ctx = context()
            ctx.add_init_script("if (location.protocol === 'http:' || location.protocol === 'https:') {"
                                + "localStorage.setItem('refresh.save', " + json.dumps(json.dumps(state)) + '); }')
            page = ctx.new_page()
            page.goto(url)
            ready(page)
            page.get_by_text(f'留守の間に {label}ぶん作業しました', exact=False).wait_for()
            page.screenshot(path=str(ARTIFACTS / f'offline-{minutes}min.png'))
            ctx.close()
        checks.append('留守時間の2時間・3時間12分の日本語表示')

        ctx = context()
        ctx.add_init_script('''Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('Storage unavailable', 'SecurityError'); }
        });''')
        page = ctx.new_page()
        page.goto(url)
        ready(page)
        page.get_by_text('ブラウザの保存領域を使えません。', exact=False).wait_for()
        ctx.close()
        checks.append('保存領域を拒否された場合も画面を表示し、日本語で知らせる')
        browser.close()

    assert not errors, errors
    report = {'checks': checks, 'pageErrors': errors}
    (ARTIFACTS / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
