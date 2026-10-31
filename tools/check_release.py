"""段階4：確認・出荷・性能購入・再開・作り直し・見本04と3言語の画面確認。"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/artifacts/stage4'


def ready(page):
    page.locator('.shipping-page,.kumiki,.seed-page').first.wait_for()
    page.evaluate('async () => { await document.fonts.ready; }')


def layout(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    overflow = page.locator('.shipping-header,.shipping-left > section,.shipping-right,.shipping-right td,.shipping-right th,.shipping-right button,.shipping-guide p,.shadow-setting').evaluate_all('''nodes => nodes.filter(e => e.clientWidth && e.scrollWidth > e.clientWidth+2).map(e => e.textContent)''')
    assert not overflow, overflow
    if page.locator('.shipping-columns').count():
        a = page.locator('.shipping-left').bounding_box()
        b = page.locator('.shipping-right').bounding_box()
        assert a['x']+a['width'] <= b['x']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    args = parser.parse_args()
    url = args.base_url.rstrip('/') + '/play/'
    OUT.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])

        def context(reduced='no-preference'):
            ctx = browser.new_context(locale='ja-JP', timezone_id='Asia/Tokyo', viewport={'width':1920,'height':1080}, reduced_motion=reduced)
            ctx.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
            return ctx

        def new_page(ctx):
            page = ctx.new_page()
            now = datetime(2026,10,31,tzinfo=timezone.utc)
            page.clock.install(time=now)
            page.clock.pause_at(now + timedelta(minutes=1))
            return page

        def scene(name, reduced='no-preference'):
            ctx = context(reduced)
            page = new_page(ctx)
            page.goto(url + '?debug=1&state=' + name); ready(page)
            if page.locator('.kumiki').count() and not page.locator('.shipping-page').count(): page.clock.run_for(1400)
            return ctx,page

        def fixture_data(name):
            ctx,page = scene(name)
            with page.expect_download() as download:
                page.locator('.debug-panel').get_by_role('button', name='データをエクスポート', exact=True).click()
            raw = Path(download.value.path()).read_text()
            ctx.close()
            return raw

        raw = fixture_data('release-ready')
        ctx = context()
        ctx.add_init_script("if(location.protocol === 'http:' && !localStorage.getItem('refresh.save')) localStorage.setItem('refresh.save', " + json.dumps(raw) + ");")
        page = new_page(ctx); page.goto(url + '?debug=1'); ready(page)
        page.clock.run_for(1400)
        page.locator('.k-menu-end button').first.click()
        assert page.locator('.k-condition-popover input:checked').count() == 3
        page.get_by_role('button', name='リリースする', exact=True).click()
        dialog = page.get_by_role('dialog', name='試作版のリリース', exact=True)
        assert 'ピクセルと、作ったパーツや構成は手放します' in dialog.inner_text()
        assert 'プラグインと性能、描いたアイコン' in dialog.inner_text()
        before = page.locator('.k-toolbar [data-pixels]').get_attribute('data-pixels')
        dialog.get_by_role('button', name='もう少し作る', exact=True).click()
        assert page.locator('.shipping-page').count() == 0
        assert page.locator('.k-toolbar [data-pixels]').get_attribute('data-pixels') == before
        page.get_by_role('button', name='リリースする', exact=True).click()
        dialog.get_by_label('製品の名前',exact=True).fill('私の画面')
        dialog.get_by_role('button', name='リリースする', exact=True).click()
        page.locator('.shipping-page').wait_for()
        assert '私の画面 試作版 v0.1' in page.locator('.shipping-header').inner_text()
        assert '次の版' in page.locator('.next-version-theme').inner_text()
        assert page.locator('.revenue-total').inner_text() == '0 ドル'
        assert page.locator('.spec-table tr[data-spec] button:not(:disabled)').count() == 0
        assert page.locator('.product-details').inner_text().find('Aoi') >= 0
        assert page.locator('.product-preview .home-document').count() == 1
        assert page.locator('.product-preview [inert]').count() == 1
        checks.append('3条件と手放すもの・残るものの確認、取消では構成を保ち、承認後だけ出荷。同じホーム画面を製品として縮小表示')

        page.clock.run_for(2400)
        partial = [int(x) for x in page.locator('.day-sales').evaluate_all("items => items.map(e=>e.dataset.value)")]
        assert partial[0] == 88 and partial[-1] == 0 and 0 < sum(partial) < 303
        page.reload(); ready(page)
        assert [int(x) for x in page.locator('.day-sales').evaluate_all("items=>items.map(e=>e.dataset.value)")] == partial
        assert page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).resources.dollars") == 303
        page.clock.run_for(5600)
        assert page.locator('.day-sales').evaluate_all('items => items.map(e=>Number(e.dataset.value))') == [88,61,47,38,29,22,18]
        assert page.locator('.revenue-total').inner_text() == '303 ドル'
        page.reload(); ready(page)
        assert page.locator('.revenue-total').inner_text() == '303 ドル'
        assert page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).persistent.products.length") == 1
        assert page.locator('.next-version button').is_disabled()
        checks.append('7日分を8秒で順に集計、途中の再読み込みから続き、完成後も再読み込みで二重入金しない')

        page.locator('[data-spec="color"] button').click()
        assert page.locator('.available-dollars').inner_text() == '103'
        assert '256色' in page.locator('[data-spec="color"]').inner_text()
        assert page.locator('[data-spec="color"] button').is_disabled()
        assert page.locator('.product-preview .seed-page.modern-colors').count() == 0
        page.locator('[data-spec="storage"] button').click()
        assert page.locator('.available-dollars').inner_text() == '43'
        assert page.locator('.next-version button').is_enabled()
        page.locator('.debug-panel').evaluate("e=>e.style.visibility='hidden'")
        page.locator('.next-version button').click()
        page.locator('.seed-page').wait_for()
        page.locator('.debug-panel').evaluate("e=>e.style.visibility='visible'")
        assert page.locator('.intro-note').count() == 0
        saved = page.evaluate("JSON.parse(localStorage.getItem('refresh.save'))")
        assert saved['schemaVersion'] == 8 and saved['run']['version'] == 'v1'
        assert saved['resources']['pixels'] == 0 and saved['run']['seed']['autoCursors'] == 0
        assert saved['run']['seed']['built'] == [] and saved['run']['kumiki']['placed'] == []
        assert saved['persistent']['specs']['color'] == 1 and saved['persistent']['specs']['storage'] == 1
        assert len(saved['persistent']['artwork']['icons']) == 6 and len(saved['persistent']['products']) == 1
        assert saved['persistent']['playerName'] == 'Aoi' and saved['resources']['dollars'] == 43
        page.reload(); ready(page); page.clock.run_for(1000)
        assert page.locator('.pixel-count').get_attribute('data-value') == '0'
        assert 'おかえりなさい' in page.locator('.guide-body').inner_text()
        page.evaluate("()=>{for(let i=0;i<7;i++)document.querySelector('.generate-button').click()}")
        page.get_by_role('button',name='ボーダーを作る（10 ピクセル）',exact=True).click()
        page.evaluate("()=>{for(let i=0;i<14;i++)document.querySelector('.generate-button').click()}")
        page.get_by_role('button',name='セーブを作る（40 ピクセル）',exact=True).click()
        page.evaluate("()=>{for(let i=0;i<5;i++)document.querySelector('.generate-button').click()}")
        page.get_by_role('button',name='オートカーソルを作る（15 ピクセル）',exact=True).click()
        page.locator('.debug-panel').get_by_role('button',name='ピクセルを足す',exact=True).click()
        page.get_by_role('button',name='カラーを作る（200 ピクセル）',exact=True).click()
        assert page.locator('.seed-page.modern-colors').count() == 1
        assert page.locator('.seed-page').evaluate('e=>getComputedStyle(e).backgroundColor') == 'rgb(232, 237, 241)'
        assert page.locator('.generate-button').evaluate('e=>getComputedStyle(e).backgroundColor') == 'rgb(40, 91, 117)'
        checks.append('256色200ドル・ストレージ60ドルの支払い、製品の16色は保持。リセット後も性能・絵・作者・記録を保存し、作り直したカラーは256色の配色')

        page.evaluate("()=>{const b=[...document.querySelectorAll('.debug-panel button')].find(b=>b.textContent==='ピクセルを足す');for(let i=0;i<25;i++)b.click()}")
        for name,cost in [('フォント',700),('レイアウト',2000),('アニメーション',4500),('Tessera ',12000)]:
            page.get_by_role('button',name=f'{name}を作る（{cost:,} ピクセル）',exact=True).click()
        page.locator('.kumiki').wait_for();page.clock.run_for(1400)
        assert page.locator('.palette-swatches button').count() == 256
        before = float(page.locator('.k-toolbar [data-pixels]').get_attribute('data-pixels'))
        canvas=page.locator('canvas'); r=canvas.bounding_box()
        page.mouse.click(r['x']+1.5*r['width']/16,r['y']+5.5*r['height']/16)
        assert float(page.locator('.k-toolbar [data-pixels]').get_attribute('data-pixels')) == before+15
        page.get_by_role('button',name='コメント',exact=True).click()
        assert 'これまでのやりとり' in page.locator('.comment-archive').inner_text()
        assert page.locator('.shipping-page').count() == 0
        ctx.close()
        checks.append('再訪したTesseraで前のアイコンがテンプレートになり、新しいマスは15ピクセルを得る。過去の会話も読める')

        ctx,page=scene('release-rich')
        page.locator('[data-spec="color"] button').click()
        for key in ['storage','memory','resolution','network','refresh','graphics']:
            before=float(page.locator('.available-dollars').get_attribute('data-value'))
            page.locator(f'[data-spec="{key}"] button').click()
            assert float(page.locator('.available-dollars').get_attribute('data-value')) < before
        layout(page);ctx.close()
        ctx,page=scene('release-v1-tessera')
        assert page.get_by_role('button',name='リリースする',exact=True).count() == 0
        page.get_by_role('button',name='デスクトップとして組み立てる',exact=True).click()
        assert page.locator('.kumiki').count() == 1 and page.locator('.shipping-page').count() == 0
        assert page.locator('.desktop').count() == 1
        assert page.locator('.desktop-shortcut').count() == 2
        ctx.close()
        checks.append('7項目の性能購入と残高、v1のTesseraから段階5のデスクトップへ組み立てる')

        ctx,page=scene('kumiki-modern')
        shadow=page.locator('.shadow-setting')
        gap=shadow.evaluate('''e=>{const r=document.createRange();r.selectNode(e.lastChild);return r.getBoundingClientRect().left-e.querySelector('input').getBoundingClientRect().right}''')
        assert 0 <= gap <= 12, gap
        shadow.get_by_role('checkbox').check()
        assert page.locator('.generate-button').first.evaluate('e=>getComputedStyle(e).boxShadow') != 'none'
        assert '毎秒 +6.8' in page.locator('.build-list li').inner_text()
        ctx.close()
        ctx,page=scene('release-rebuilt')
        assert page.locator('.passive-rate').get_attribute('data-rate') == '2.25'
        assert page.locator('.passive-rate').inner_text() == '（毎秒 +2.3）'
        ctx.close()
        checks.append('新調後の影のチェックと文字が隣り合い、設定も反映。毎秒の合計とカーソル1台の量は小数1桁まで')

        for language in ['ja','en','en-XA']:
            ctx=context();page=new_page(ctx)
            for fixture in ['release-complete','release-counting','release-rebuilt']:
                page.goto(url+'?debug=1&state='+fixture);ready(page)
                page.locator('.debug-panel .language-select select').select_option(language)
                for width,height in [(1920,1080),(1366,768)]:
                    page.set_viewport_size({'width':width,'height':height})
                    page.wait_for_function('''()=>{const r=document.querySelector('.stage').getBoundingClientRect();return r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1}''')
                    layout(page)
                    page.locator('.debug-panel').evaluate("e=>e.style.visibility='hidden'")
                    page.screenshot(path=str(OUT/f'{fixture}-{language}-{width}.png'))
                    page.locator('.debug-panel').evaluate("e=>e.style.visibility='visible'")
            ctx.close()
        checks.append('出荷・集計途中・作り直した画面を3言語と1920×1080／1366×768で確認し、文字・表・ボタンのはみ出しなし')

        ctx=context();page=new_page(ctx)
        page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
        page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
        page.goto(args.base_url.rstrip('/')+'/04-release.html')
        # 見本への外部書体の通信は止め、ゲームに同梱したUI書体を当てる。
        html=(ROOT/'game/dist/index.html').read_text()
        import re
        font=re.search(r'@font-face\{font-family:[\"\']?Refresh UI[\"\']?;.*?\}',html)
        if font:page.add_style_tag(content=font.group(0)+".ui{font-family:'Refresh UI',sans-serif!important}")
        page.evaluate('async()=>{await document.fonts.ready}')
        page.screenshot(path=str(OUT/'mockup-04-release.png'))
        ctx.close();browser.close()
        checks.append('見本04も1920×1080で撮影し、紙色・表・寸法・縮小した製品を見比べる')
    assert not errors, errors
    report={'checks':checks,'pageErrors':errors}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__': main()
