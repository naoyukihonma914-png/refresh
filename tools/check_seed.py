"""段階2の生成・購入・画面変化・ガイド・設定をChromiumで確認する。"""
import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'game/artifacts/stage2'


def ready(page):
    page.locator('.seed-page').wait_for()
    page.evaluate('async () => { await document.fonts.ready; }')


def pixels(page):
    return float(page.locator('.pixel-count').get_attribute('data-value'))


def assert_layout(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    overflow = page.locator('.seed-content, .guide-body, .build-list li, .page-settings, .skill-row, button').evaluate_all('''items => items
      .filter(item => item.clientWidth && item.scrollWidth > item.clientWidth + 2).map(item => item.textContent)''')
    assert not overflow, overflow
    # 一覧の名前と値段、隣り合う行が重ならないこと。
    assert page.locator('.build-list li').evaluate_all('''rows => rows.every(row => {
      const label = row.querySelector('span'), button = row.querySelector('button');
      return !label || label.getBoundingClientRect().right <= button.getBoundingClientRect().left;
    })''')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--chromium', default=shutil.which('chromium'))
    args = parser.parse_args()
    url = args.base_url.rstrip('/') + '/play/'
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        def context(**kwargs):
            ctx = browser.new_context(locale='ja-JP', timezone_id='Asia/Tokyo', viewport={'width':1920, 'height':1080}, **kwargs)
            ctx.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
            return ctx

        ctx = context()
        page = ctx.new_page()
        requests = []
        page.on('request', lambda req: requests.append(req.url))
        page.goto(url + '?debug=1')
        ready(page)
        assert page.locator('.guide-notices').count() == 0
        assert page.locator('.build-button').count() == 1
        assert page.locator('.build-button').is_disabled()
        page.locator('.generate-button').focus()
        page.keyboard.press('Space')
        assert pixels(page) == 0  # 素のbuttonの標準動作でも先取りできない
        page.evaluate('''() => { for(let i=0;i<10;i++) document.querySelector('.generate-button').click(); }''')
        assert pixels(page) == 10
        page.get_by_role('button', name='枠線を作る（10 ピクセル）', exact=True).click()
        assert 'has-border' in page.locator('.seed-page').get_attribute('class')
        assert page.evaluate("localStorage.getItem('refresh.save')") is None
        page.evaluate('''() => { for(let i=0;i<20;i++) document.querySelector('.generate-button').click(); }''')
        page.get_by_role('button', name='保存を作る（40 ピクセル）', exact=True).click()
        assert '保存しました' in page.locator('.save-status').inner_text()
        assert page.locator('.build-button').count() == 1
        assert page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).run.seed.built") == ['border','save']
        page.get_by_role('button', name='ピクセルを足す', exact=True).click()
        page.get_by_role('button', name='自動カーソルを作る（15 ピクセル）', exact=True).click()
        assert page.locator('.auto-cursor').count() == 1
        before = pixels(page)
        page.wait_for_timeout(1200)
        assert pixels(page) >= before + 1
        assert page.locator('.pixel-gain').count() == 0
        page.get_by_role('button', name='色を作る（200 ピクセル）', exact=True).click()
        assert 'はじめまして' in page.locator('.guide-body').inner_text()
        page.get_by_role('button', name='あとで', exact=True).click()
        assert page.locator('.guide-body').count() == 0
        page.reload(); ready(page)
        assert page.locator('.guide-body').count() == 0
        page.get_by_role('button', name='お知らせ（1）', exact=True).click()
        page.get_by_role('button', name='話を聞く', exact=True).click()
        assert '道具が要ります' in page.locator('.guide-body').inner_text()
        checks.append('手動生成、スペース解禁前の抑止、枠線・保存・最初の自動カーソル・色、保存とガイドの再開')
        assert all(req.startswith(args.base_url.rstrip('/')) for req in requests)
        ctx.close()

        ctx = context()
        page = ctx.new_page()
        for fixture in ['seed-start','seed-border','seed-saved','seed-color','seed-font','seed-layout','seed-motion','seed-complete','seed-inheriting']:
            page.goto(url + '?state=' + fixture); ready(page)
            assert page.locator('.debug-panel').count() == 0
            assert_layout(page)
            if fixture == 'seed-layout':
                assert page.locator('.build-button').count() == 3  # カーソルと2つ先
                assert page.get_by_role('button', name='組木を作る（12,000 ピクセル）', exact=True).is_disabled()
                assert '組木は' in page.locator('.guide-body').inner_text()
            if fixture == 'seed-motion':
                assert page.locator('.auto-cursor').count() == 20
                assert '24' in page.locator('.cursor-summary').inner_text()
                page.locator('.generate-button').click(position={'x':20, 'y':10})
                assert page.locator('.pixel-gain').count() == 1
                page.get_by_role('button', name='組木を作る（12,000 ピクセル）', exact=True).click()
                page.locator('.kumiki').wait_for()
                assert page.locator('.seed-page.is-embedded').count() == 1
            page.screenshot(path=str(ARTIFACTS / f'{fixture}.png'))
        # 見本を同じ同梱書体で比較する。外部書体への参照だけ検査中に止める。
        page.route('https://**/*', lambda route: route.abort())
        page.goto(args.base_url.rstrip('/') + '/01-seed.html')
        fonts = []
        for family, filename in [('Noto Serif JP','noto-serif-jp.woff2'),('Noto Sans JP','noto-sans-jp.woff2')]:
            data = base64.b64encode((ROOT / 'game/src/assets/fonts' / filename).read_bytes()).decode()
            fonts.append(f'@font-face {{font-family:"{family}";src:url(data:font/woff2;base64,{data});font-weight:100 900;}}')
        page.add_style_tag(content='\n'.join(fonts))
        page.evaluate('async () => { await document.fonts.ready; }')
        page.screenshot(path=str(ARTIFACTS / 'mockup-01.png'))
        ctx.close()
        checks.append('見本01と各購入段階の1920×1080撮影、配置後の2つ先、最大20カーソルと台数、押した位置の加算表示、組木購入済みの区切り')

        for language in ['ja','en','en-XA']:
            ctx = context()
            page = ctx.new_page()
            for fixture in ['seed-start','seed-color','seed-motion','seed-return']:
                page.goto(url + '?debug=1&state=' + fixture); ready(page)
                page.locator('.debug-panel .language-select select').select_option(language)
                if fixture == 'seed-return':
                    page.locator('.seed-content > p button.text-button').filter(has_text={'ja':'このページの設定','en':'Settings for this page','en-XA':'Settings for this page'}[language]).click()
                    page.locator('.page-settings').wait_for()
                for width,height in [(1920,1080),(1366,768)]:
                    page.set_viewport_size({'width':width,'height':height})
                    page.wait_for_timeout(100)
                    assert_layout(page)
                    # 開発用小窓は画面本体の見比べの撮影時だけ非表示にする。
                    page.locator('.debug-panel').evaluate("element => element.style.visibility='hidden'")
                    page.screenshot(path=str(ARTIFACTS / f'{fixture}-{language}-{width}.png'))
                    page.locator('.debug-panel').evaluate("element => element.style.visibility='visible'")
                for scope in ['.seed-page','.debug-panel']:
                    assert page.locator(scope+' option[value="ja"]').inner_text() == '日本語'
                    assert page.locator(scope+' option[value="en"]').inner_text() == 'English'
            ctx.close()
        checks.append('日本語・英語・試験用言語、開始・色・動き・設定を1920×1080と1366×768で確認し、はみ出し・重なりなし')

        ctx = context()
        page = ctx.new_page()
        instant = datetime(2026,10,31,0,0,tzinfo=timezone.utc)
        page.clock.install(time=instant)
        page.clock.pause_at(instant + timedelta(minutes=1))
        page.goto(url + '?debug=1&state=seed-motion'); ready(page)
        assert page.locator('.generate-button').inner_text() == 'ピクセルを4個生成する'
        cursor = page.locator('.build-button').first
        assert cursor.evaluate('element => getComputedStyle(element).backgroundColor') == 'rgb(0, 128, 128)'
        # 時計を止めて自動生成の差をなくし、表示額と支払額が同じことを確認する。
        for count in range(24, 32):
            cost = math.ceil(15 * 1.15 ** count)
            assert cursor.inner_text() == f'{cost:,} で作る'
            assert cursor.get_attribute('aria-label') == f'自動カーソルを作る（{cost:,} ピクセル）'
            before = pixels(page)
            cursor.click()
            assert pixels(page) == before - cost
        for language in ['ja','en','en-XA']:
            page.locator('.debug-panel .language-select select').select_option(language)
            for width,height in [(1920,1080),(1366,768)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(100)
                height = page.locator('.generate-button').bounding_box()['height']
                for y in [2,height - 4]:
                    page.locator('.generate-button').click(position={'x':24,'y':y})
                gains = page.locator('.pixel-gain')
                gains.nth(1).wait_for(timeout=5_000)
                assert gains.count() >= 2, (language,width,height)
                assert all('.' not in text for text in gains.all_text_contents())
                button = page.locator('.generate-button').bounding_box()
                for gain in gains.all():
                    bounds = gain.bounding_box()
                    assert bounds['y'] + bounds['height'] < button['y'], (bounds,button)
                assert_layout(page)
                page.locator('.debug-panel').evaluate("element => element.style.visibility='hidden'")
                page.screenshot(path=str(ARTIFACTS / f'review-gains-{language}-{width}.png'))
                page.locator('.debug-panel').evaluate("element => element.style.visibility='visible'")
                # 試験用言語の加算表示も、消えるまでの動きの間ずっとボタンの外にある。
                page.clock.run_for(900)
        ctx.close()
        checks.append('カーソルの整数価格と実際の支払いの一致、1,000以上の桁区切り、落ち着いた水色、3言語・2画面で整数の加算表示がボタンの上の外側にあること')

        ctx = context()
        page = ctx.new_page()
        instant = datetime(2026,10,30,18,0,tzinfo=timezone.utc)
        page.clock.install(time=instant)
        page.clock.pause_at(instant + timedelta(minutes=1))
        page.goto(url + '?state=seed-return'); ready(page)
        page.get_by_role('button', name='このページの設定', exact=True).click()
        page.get_by_role('checkbox', name='キーボードで押す', exact=False).check()
        page.get_by_role('button', name='適用', exact=True).click()
        page.get_by_role('button', name='ページに戻る', exact=True).click()
        before = pixels(page)
        page.locator('.generate-button').focus()
        page.keyboard.down('Space'); page.keyboard.down('Space')
        assert pixels(page) == before + 6
        page.keyboard.up('Space'); page.keyboard.down('Space'); page.keyboard.up('Space')
        assert pixels(page) > before + 6
        ctx.close()
        checks.append('キーボード取得後は1押下1回、キーリピートでは増えないこと')

        ctx = context()
        page = ctx.new_page()
        page.goto(url + '?state=seed-return'); ready(page)
        page.get_by_role('button', name='このページの設定', exact=True).click()
        for name in ['キーボードで押す','更新履歴','背景の模様','押しっぱなしで連打','文字を流す']:
            page.get_by_role('checkbox', name=name, exact=False).check()
        page.get_by_label('模様', exact=True).select_option('grid')
        page.get_by_role('button', name='適用', exact=True).click()
        assert '16' in page.locator('.page-settings > p').first.inner_text()
        assert page.get_by_role('checkbox', name='キーボードで押す', exact=False).is_disabled()
        page.get_by_role('button', name='ページに戻る', exact=True).click()
        assert 'pattern-grid' in page.locator('.seed-page').get_attribute('class')
        assert page.locator('.change-history li').count() > 0
        before = pixels(page)
        page.locator('.generate-button').focus()
        page.keyboard.down('Space'); page.wait_for_timeout(600); page.keyboard.up('Space')
        assert pixels(page) >= before + 18  # 3回以上の6ピクセル。自動生成とは別に加算。
        page.get_by_role('button', name='このページの設定', exact=True).click()
        page.get_by_role('checkbox', name='背景の模様', exact=False).uncheck()
        page.get_by_role('checkbox', name='文字を流す', exact=False).uncheck()
        page.get_by_role('button', name='適用', exact=True).click()
        page.get_by_role('button', name='ページに戻る', exact=True).click()
        assert 'pattern-none' in page.locator('.seed-page').get_attribute('class')
        assert 'has-marquee' not in page.locator('.seed-page').get_attribute('class')
        ctx.close()
        checks.append('設定の取得・再課金防止、履歴、模様と文字流しの切り替え、スペース押しっぱなしの生成')

        ctx = context(reduced_motion='reduce')
        page = ctx.new_page(); page.goto(url + '?state=seed-motion'); ready(page)
        page.locator('.generate-button').click()
        assert page.locator('.pixel-gain').count() == 0
        assert 'has-motion' not in page.locator('.seed-page').get_attribute('class')
        ctx.set_offline(True)
        before = pixels(page); page.locator('.generate-button').click()
        assert pixels(page) > before
        ctx.close()
        checks.append('動きを減らす設定と、読込後に通信を切った生成')
        browser.close()
    assert not errors, errors
    report = {'checks':checks,'pageErrors':errors}
    (ARTIFACTS / 'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
