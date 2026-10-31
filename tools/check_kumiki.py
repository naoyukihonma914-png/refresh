"""段階3：実際の描画・配置・書き出しと、各言語の画面をChromiumで確認する。"""
import argparse
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage3'

def ready(page):
    page.locator('.kumiki').wait_for()
    page.evaluate('async()=>{await document.fonts.ready}')

def balance(page):
    return float(page.locator('.k-toolbar [data-pixels]').get_attribute('data-pixels'))

def layout(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    clipped=page.locator('.k-menu button,.k-toolbar button,.extension-row,.k-comment,.k-status span,.property-panel label').evaluate_all('''items=>items.filter(e=>e.clientWidth && e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)''')
    assert not clipped,clipped
    panels=page.locator('.k-tools,.k-parts-panel,.k-workspace,.icon-editor').all()
    bounds=[p.bounding_box() for p in panels]
    for a,b in zip(bounds,bounds[1:]):assert a['x']+a['width']<=b['x']+1,(a,b)

def folder():
    cells={}
    def box(x,y,w,h,c):
        for j in range(y,y+h):
            for i in range(x,x+w):cells[(i,j)]=0 if i==x or i==x+w-1 or j==y or j==y+h-1 else c
    box(1,3,6,3,3);box(1,5,14,9,3)
    for x in range(2,14):cells[(x,6)]=11
    return cells

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');args=ap.parse_args()
    url=args.base_url.rstrip('/')+'/play/'
    OUT.mkdir(parents=True,exist_ok=True)
    checks=[];errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        def context():
            ctx=browser.new_context(locale='ja-JP',timezone_id='Asia/Tokyo',viewport={'width':1920,'height':1080})
            ctx.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
            return ctx
        def scene(name):
            ctx=context();page=ctx.new_page()
            now=datetime(2026,10,31,tzinfo=timezone.utc)
            page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
            page.goto(url+'?state='+name);ready(page);page.clock.run_for(1400)
            return ctx,page
        def cell(page,x,y):
            rect=page.locator('canvas').bounding_box()
            size=int(page.locator('.editor-heading > span').inner_text().split('×')[0])
            page.mouse.click(rect['x']+(x+.5)*rect['width']/size,rect['y']+(y+.5)*rect['height']/size)
        ctx,page=scene('kumiki-early')
        assert page.locator('.part-list').count()==0
        assert page.locator('.property-panel').count()==0
        assert page.locator('.token-count').count()==0
        assert page.locator('.k-tools button').count()==2
        page.locator('.k-comment button').click()
        assert '最初にお願いしたいのは' in page.locator('.k-comment').inner_text()
        page.locator('.k-comment button').click()
        before=balance(page);cell(page,1,5)
        assert balance(page)==before+10
        page.get_by_role('button',name='編集',exact=True).click()
        page.get_by_role('button',name='元に戻す',exact=True).click()
        assert balance(page)==before+10
        page.get_by_role('button',name='やり直す',exact=True).click()
        assert balance(page)==before+10
        page.get_by_role('button',name='編集',exact=True).click()
        for color in [0,3,11]:
            page.locator('.palette-swatches button').nth(color).click()
            for (x,y),c in folder().items():
                if c==color:cell(page,x,y)
        assert not page.locator('.export-button').is_disabled()
        page.locator('.export-button').click()
        assert '1' in page.locator('.token-count').inner_text()
        assert page.locator('.export-button').is_disabled()
        page.locator('.editor-heading select').select_option('free')
        before=balance(page);cell(page,0,0);assert balance(page)==before
        page.get_by_role('button',name='ファイル',exact=True).click()
        with page.expect_download() as d:page.get_by_role('button',name='データを書き出す',exact=True).click()
        raw=Path(d.value.path()).read_text();state=json.loads(raw)
        assert state['schemaVersion']==3
        assert state['persistent']['artwork']['sketchbook']['frames'][0][0]>=0
        assert state['run']['kumiki']['drawings']['folder']['exported']
        ctx.close()
        restored=context();restored.add_init_script('if(location.protocol==="http:"||location.protocol==="https:"){localStorage.setItem("refresh.save",'+json.dumps(raw)+')}')
        page=restored.new_page();page.goto(url);ready(page)
        assert page.locator('.editor-heading select').input_value()=='free'
        assert page.locator('.token-count').count()==1
        restored.close()
        checks.append('入りたての簡素な姿、実際にフォルダを描いて書き出し、戻す・やり直すの二重報酬防止、自由帳の無報酬と保存・再開')

        ctx,page=scene('kumiki-mature')
        source=page.locator('.part-list button').filter(has_text='スイッチ')
        target=page.locator('[data-slot="switch"]')
        source.drag_to(target)
        target.locator('input[type=checkbox]').wait_for()
        page.get_by_label('集中モード',exact=True).check()
        before=balance(page);cursor=page.locator('.auto-cursor').first.get_attribute('style')
        page.clock.run_for(1000);assert balance(page)==before
        assert page.locator('.auto-cursor').first.get_attribute('style')==cursor
        page.get_by_text('自動カーソルは休んでいます',exact=True).wait_for()
        page.get_by_label('集中モード',exact=True).uncheck()
        page.get_by_role('button',name='選択ツール',exact=True).click()
        page.locator('.generate-button').first.click()
        page.locator('.property-panel').wait_for()
        page.locator('.property-panel select').first.select_option('#008080')
        assert page.locator('.generate-button').first.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(0, 128, 128)'
        page.locator('.property-panel input[type=range]').focus();page.keyboard.press('End')
        assert page.locator('.generate-button').first.evaluate('e=>getComputedStyle(e).borderRadius')=='16px'
        page.locator('.k-menu > button').filter(has_text='拡張機能').click()
        row=page.locator('.extension-row').filter(has_text='塗りつぶし')
        row.get_by_role('button',name='取得する',exact=True).click()
        assert row.get_by_role('button',name='取得済み',exact=True).is_disabled()
        assert page.locator('.extension-row').filter(has_text='道具を新調する').count()==0
        page.locator('.extension-tabs button').filter(has_text='ホーム画面').click()
        page.get_by_role('checkbox',name='キーボードで押す',exact=False).check()
        page.get_by_role('button',name='適用',exact=True).click()
        assert page.get_by_role('checkbox',name='キーボードで押す',exact=False).is_disabled()
        ctx.close()
        checks.append('部品をドラッグして置く、集中モード、選択ツールの配色・角の丸み、拡張機能の取得、ホーム画面の設定')

        ctx,page=scene('kumiki-wall')
        assert page.get_by_role('button',name='デスクトップとして組み立てる',exact=True).is_disabled()
        assert '256色' in page.locator('.desktop-exit').inner_text()
        page.locator('.k-menu-end button').first.click()
        assert page.locator('.k-condition-popover input:checked').count()==3
        assert page.get_by_role('button',name='リリースする',exact=True).count()==0
        assert page.locator('.kumiki').count()==1
        ctx.close()
        checks.append('16色の表示要件とv0.1の準備3条件、段階4のリリースへ進まないこと')

        ctx,page=scene('kumiki-drift')
        drift=page.locator('.part-shifted');rect=drift.bounding_box();before=balance(page)
        page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2);page.mouse.down()
        page.mouse.move(rect['x']+rect['width']/2-10,rect['y']+rect['height']/2+6,steps=4);page.mouse.up()
        assert page.locator('.part-shifted').count()==0
        assert abs(balance(page)-before-1620)<.001
        ctx.close()
        checks.append('ずれた部品を実際につまんで戻し、毎秒生成30秒分を一度だけ加算')

        ctx,page=scene('kumiki-modern')
        assert 'is-modern' in page.locator('.kumiki').get_attribute('class')
        page.get_by_role('button',name='選択ツール',exact=True).click()
        page.locator('.generate-button').first.click()
        page.locator('.selection-measure').wait_for()
        page.get_by_role('button',name='鉛筆',exact=True).click()
        page.get_by_role('button',name='コマを追加',exact=True).click()
        assert page.get_by_role('button',name='コマ 2',exact=True).count()==1
        page.get_by_role('button',name='コマ 2',exact=True).click();cell(page,0,0)
        page.locator('.editor-heading select').select_option('free')
        cell(page,1,1)
        page.get_by_role('button',name='壁紙にする',exact=True).click()
        page.get_by_text('自由帳の絵を壁紙として保存しました。',exact=True).wait_for()
        page.locator('.k-menu > button').filter(has_text='拡張機能').click()
        page.get_by_label('新調した道具の見た目',exact=True).uncheck()
        assert 'is-modern' not in page.locator('.kumiki').get_attribute('class')
        ctx.close()
        checks.append('新調した道具・2コマ目・自由帳から壁紙の保存・古い姿への切り替え')

        for language in ['ja','en','en-XA']:
            ctx=context();page=ctx.new_page()
            for fixture in ['kumiki-early','kumiki-mature','kumiki-modern']:
                page.goto(url+'?debug=1&state='+fixture);ready(page);page.wait_for_timeout(1400)
                page.locator('.debug-panel .language-select select').select_option(language)
                for width,height in [(1920,1080),(1366,768)]:
                    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
                    layout(page)
                    page.locator('.debug-panel').evaluate("e=>e.style.visibility='hidden'")
                    page.screenshot(path=str(OUT/f'{fixture}-{language}-{width}.png'))
                    page.locator('.debug-panel').evaluate("e=>e.style.visibility='visible'")
            ctx.close()
        checks.append('日本語・英語・試験用言語、入りたて・取得後・新調後を1920×1080と1366×768で撮影し、文字とパネルのはみ出し・重なりなし')

        ctx=context();page=ctx.new_page();now=datetime(2026,10,31,tzinfo=timezone.utc)
        page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
        page.goto(url+'?state=seed-motion');page.locator('.seed-page').wait_for();page.evaluate('async()=>{await document.fonts.ready}')
        for _ in range(3):page.locator('.generate-button').click()
        page.locator('.pixel-gain').nth(2).wait_for()
        boxes=[g.bounding_box() for g in page.locator('.pixel-gain').all()]
        assert len({round(box['x']) for box in boxes})==3
        button=page.locator('.generate-button').bounding_box()
        assert all(box['y']+box['height']<button['y'] for box in boxes)
        page.screenshot(path=str(OUT/'seed-gains-spread.png'))
        ctx.close();checks.append('素の画面の連打3回で加算表示の横位置がそれぞれ異なり、ボタンの上の外側にあること')
        browser.close()
    assert not errors,errors
    report={'checks':checks,'pageErrors':errors}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
