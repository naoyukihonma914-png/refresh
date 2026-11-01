"""Stage 6.2: real construction, recovery, layout constraints and review regressions.
Serve only game/dist at /play/ on a loopback HTTP server before running.
"""
import argparse,json,shutil,gzip
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage62'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
APPS=['files','mail','photo','bin','clock','theme','terminal','manager']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--functional-only',action='store_true');ap.add_argument('--layouts-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 checks=[];errors=[];layouts=[]
 def passed(name):checks.append(name);print('PASS',name,flush=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(name,lang='ja',size=(1920,1080),save=None):
   ctx=browser.new_context(locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo',viewport={'width':size[0],'height':size[1]});ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort())
   if save:ctx.add_init_script('if(!localStorage.getItem("refresh.save"))localStorage.setItem("refresh.save",'+json.dumps(save)+')')
   page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1'+('' if save else '&state='+name));page.locator('.debug-panel').wait_for();page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500)
   for button in page.locator('.desktop-live>.feedback-toast header>button').all():
    if button.is_visible() and name!='app-build-missing':button.click()
   return ctx,page
  def win(page,app):return page.locator(f'.desktop-live>[data-app="{app}"]')
  def open_app(page,app):
   page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator(f'.desktop-programs [data-app-launcher="{app}"]').click();return win(page,app)
  def words(lang):return WORDS['ja' if lang=='ja' else 'en']
  def set_stage(page,stage):
   settings=open_app(page,'settings');settings.locator('.settings-app>aside>button').nth(1).click();settings.locator('.appearance-setting select').select_option(str(stage));settings.locator('.window-controls button').last.click();page.clock.run_for(500)
   for close in page.locator('.appearance-guide>button').all():close.click()
  def export(page):
   with page.expect_download() as d:page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def check_parts(w):
   result=w.locator('.app-layout').evaluate('''root=>{const parts=[...root.querySelectorAll('.app-layout-part')].map(e=>({id:e.dataset.appPart,x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight}));return {width:root.clientWidth,height:root.clientHeight,parts};}''')
   for a in result['parts']:
    assert a['x']>=0 and a['y']>=0 and a['x']+a['width']<=result['width']+1 and a['y']+a['height']<=result['height']+1,result
    for b in result['parts']:
     if a!=b:assert not (a['x']<b['x']+b['width'] and a['x']+a['width']>b['x'] and a['y']<b['y']+b['height'] and a['y']+a['height']>b['y']),result
   return result
  if not args.layouts_only:
   for lang in ['ja','en','en-XA']:
    ctx,page=scene('app-build-empty',lang);b=page.locator('.app-builder');assert b.locator('[data-builder-part]').count()==0
    b.locator('.builder-toolbar button').nth(0).click();assert b.locator('[data-builder-part]').count()==4
    # Real drag beyond the document flashes red, then returns to the old position.
    part=b.locator('[data-builder-part="list"]');before=part.get_attribute('style');r=part.bounding_box();page.mouse.move(r['x']+20,r['y']+20);page.mouse.down();page.mouse.move(r['x']-120,r['y']-200,steps=5);expect(part).to_have_class(__import__('re').compile('invalid'));page.mouse.up();assert part.get_attribute('style')==before
    # An actual overlap inside the canvas must be rejected independently of its bounds.
    other=b.locator('[data-builder-part="places"]').bounding_box();r=part.bounding_box();page.mouse.move(r['x']+20,r['y']+20);page.mouse.down();page.mouse.move(other['x']+20,r['y']+20,steps=5);expect(part).to_have_class(__import__('re').compile('invalid'));page.mouse.up();assert part.get_attribute('style')==before
    # The selection overlay must leave the live app preview visible.
    assert part.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
    # Too-small resize is rejected too.
    handle=part.locator('.builder-resize');r=handle.bounding_box();page.mouse.move(r['x']+4,r['y']+4);page.mouse.down();page.mouse.move(r['x']-1200,r['y']-800,steps=5);expect(part).to_have_class(__import__('re').compile('invalid'));page.mouse.up();assert part.get_attribute('style')==before
    b.locator('[data-builder-part="list"]').click(position={'x':12,'y':12});b.locator('.builder-properties select').nth(2).select_option('32');b.locator('.builder-properties select').first.select_option('#1f3f7a');colored=part.get_attribute('style');b.locator('.builder-toolbar button').nth(1).click();assert part.get_attribute('style')!=colored;b.locator('.builder-toolbar button').nth(2).click();assert part.get_attribute('style')==colored
    page.screenshot(path=str(OUT/f'build-files-{lang}.png'));b.locator('.builder-install').click();w=win(page,'files');expect(w).to_be_visible();page.clock.run_for(500);check_parts(w)
    assert w.locator('[data-app-part=list]').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(31, 63, 122)'
    assert 32<=w.locator('[data-app-part=list] tbody tr').first.evaluate('e=>e.offsetHeight')<=33
    header=w.locator('[data-app-part=list] th').first;assert header.evaluate('e=>getComputedStyle(e).color')=='rgb(255, 255, 255)';assert header.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(31, 63, 122)'
    # A real captured layout stays blue after the live layout is rebuilt in white.
    page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();page.clock.run_for(250);w.locator('.app-rebuild').click();expect(b).to_be_visible();b.locator('[data-builder-part=list]').click(position={'x':12,'y':12});b.locator('.builder-properties select').first.select_option('#ffffff');b.locator('.builder-toolbar button').nth(3).click();assert b.locator('.builder-properties select').first.input_value()=='#1f3f7a';b.locator('.builder-properties select').first.select_option('#ffffff');b.locator('.builder-install').click();w=win(page,'files');w.locator('.files-sidebar button').last.click();w.locator('[data-file]').last.dblclick();old=w.locator('.screenshot-preview [data-app=files] [data-app-part=list]').first;assert old.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(31, 63, 122)';ctx.close()
   passed('3言語で空のひな型→配置→色→入れる→撮影→組み直し。窓外・重なりのドラッグ、最小寸法以下のリサイズを赤枠で拒み、元に戻す・やり直す・入れた形への復帰')
   for lang in ['ja','en','en-XA']:
    for stage in [0,1,2]:
     ctx,page=scene('app-build-missing',lang);set_stage(page,stage);toast=page.locator('.desktop-live>.feedback-toast');expect(toast.locator('.missing-app-part')).to_be_visible();toast.locator('.toast-actions>button').first.click();b=page.locator('.app-builder');expect(b).to_have_attribute('data-building','files');b.locator('.builder-toolbar button').nth(0).click();b.locator('.builder-install').click();w=win(page,'files');w.locator('[data-app-part=sort] select').select_option('date');expect(page.locator('.desktop-live>.feedback-toast.is-success')).to_be_visible();toast.locator('header>button').click()
     # Even a completely empty installed app keeps its outer chrome and recovery route.
     w.locator('.app-rebuild').click();remove=b.locator('.builder-parts>div>button:last-child').filter(has_text=words(lang)['builder.remove'])
     while remove.count():remove.first.click()
     b.locator('.builder-install').click();w=win(page,'files');assert w.locator('[data-app-part]').count()==0;expect(w.locator('.app-layout-empty')).to_be_visible()
     if 'is-maximized' in (w.get_attribute('class') or ''):w.locator('.window-controls button').nth(1).click()
     title=w.locator('.window-title>span').first;r=title.bounding_box();before=w.bounding_box();page.mouse.move(r['x']+15,r['y']+7);page.mouse.down();page.mouse.move(r['x']+35,r['y']+27,steps=4);page.mouse.up();after=w.bounding_box();assert abs(after['x']-before['x'])>1 or abs(after['y']-before['y'])>1
     w.locator('.window-controls button').nth(1).click();w.locator('.window-controls button').first.click();assert not w.is_visible();w=open_app(page,'files');w.locator('.window-controls button').last.click();w=open_app(page,'files');w.locator('.app-rebuild').click();b.locator('.builder-toolbar button').nth(0).click();b.locator('.builder-install').click();assert win(page,'files').locator('[data-app-part=list]').count()==1;ctx.close()
   passed('3言語×段0〜2で必要パーツの案内から依頼を完了。全パーツを消しても窓の移動・最大化・最小化・閉じる・再開・おすすめでの復旧が可能')
   ctx,page=scene('desktop-stage2');b=page.locator('.app-builder')
   for app,part in [('photo','image'),('terminal','commands')]:
    w=open_app(page,app);w.locator('.app-rebuild').click();b.locator('.builder-parts>div').filter(has=page.get_by_role('button',name=WORDS['ja']['builder.part.'+part],exact=True)).get_by_role('button',name=WORDS['ja']['builder.remove'],exact=True).click();b.locator('.builder-install').click()
   page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();conditions=page.locator('.desktop-conditions');assert conditions.locator('.condition-app-part').count()==2;assert not conditions.locator('label>input').nth(3).is_checked();assert not conditions.locator('label>input').nth(4).is_checked()
   for app in ['photo','terminal']:
    conditions.locator('[data-condition-app='+app+'] button').click();expect(b).to_have_attribute('data-building',app);b.locator('.builder-toolbar button').first.click();b.locator('.builder-install').click();page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click()
   assert conditions.locator('label>input').nth(3).is_checked() and conditions.locator('label>input').nth(4).is_checked();ctx.close()
   passed('v1.0条件も画像・命令パーツの取り外しを検知し、条件の案内から復旧できる')
   for lang in ['ja','en','en-XA']:
    ctx,page=scene('desktop-stage2',lang);s=open_app(page,'settings');row=s.locator('.desktop-skill').filter(has_text=words(lang)['desktop.skill.direct']);row.get_by_role('button').click();m=open_app(page,'mail');m.locator('.mail-app aside>button').filter(has_text=words(lang)['feedback.subject.color']).click();m.locator('[data-app-part=draft] button').click();k=win(page,'tessera').locator('.kumiki');expect(k).to_have_attribute('data-workspace','compose');expect(k.locator('.property-panel')).to_be_visible();expect(k.locator('.home-document')).to_be_visible()
    # A drawing request must return from Compose to Draw.
    m=open_app(page,'mail');m.locator('.mail-app aside>button').filter(has_text=words(lang)['feedback.subject.practice'].split('{')[0]).first.click();m.locator('[data-app-part=draft] button').click();expect(k).to_have_attribute('data-workspace','draw');expect(k.locator('canvas')).to_be_visible()
    k.locator('.persona-compose').click();w=win(page,'tessera');w.locator('.window-controls button').nth(1).click();page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();page.clock.run_for(250);f=open_app(page,'files');f.locator('.window-controls button').nth(1).click();f.locator('.files-sidebar button').filter(has_text=words(lang)['files.screenshots']).click();f.locator('[data-file]').last.dblclick();expect(f.locator('.screenshot-preview .kumiki')).to_have_attribute('data-workspace','compose');page.screenshot(path=str(OUT/f'captured-compose-{lang}.png'));ctx.close()
   passed('Gessoの通知はカラー→組む／描画→描くへ切り替わり、撮影した組むの場面も3言語で保持')
   for lang in ['ja','en','en-XA']:
    ctx,page=scene('desktop-stage0',lang);label=page.locator('.desktop-live>.desktop-taskbar .taskbar-product>span');assert label.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),label.inner_text();ctx.close()
   passed('95風の製品名は日本語・英語・試験用言語の無題名と版を全文表示')
   ctx,page=scene('app-build-files','en-XA');b=page.locator('.app-builder');b.locator('[data-builder-part=places]').click(position={'x':12,'y':12});b.locator('.builder-properties select').nth(1).select_option('16');page.clock.run_for(250);page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();page.clock.run_for(250);b.locator('.builder-properties select').nth(1).select_option('10');page.clock.run_for(250);width=b.locator('.builder-properties input[type=number]').nth(2);width.fill(width.get_attribute('min'));b.locator('.builder-install').click();f=win(page,'files');f.locator('.files-sidebar button').last.click();before=export(page)['run']['desktop']['projects'];f.locator('[data-file]').last.dblclick();expect(f.locator('.screenshot-preview .app-builder')).to_be_visible();page.clock.run_for(500);assert export(page)['run']['desktop']['projects']==before;page.screenshot(path=str(OUT/'captured-app-builder.png'));ctx.close()
   passed('組み立て中の書類も撮影して見返せる。古い大きな文字の測定で現在の小さい配置を書き換えない')
   for lang in ['ja','en','en-XA']:
    ctx,page=scene('desktop-stalled',lang);w=win(page,'photo');parts=check_parts(w);expect(w.locator('.window-content.is-stalled')).to_have_attribute('inert','');w.locator('.restart-button').click();assert not w.locator('.window-content.is-stalled').count();assert check_parts(w)==parts;ctx.close()
   passed('3言語で組んだ写真アプリ全体に応答なしを表示し、再起動後も配置を保持')
   # Real previous-release save, independent from fixed fixture memory storage.
   raw=gzip.decompress((ROOT/'game/src/systems/testdata/v10-two-shots.json.gz').read_bytes()).decode();ctx,page=scene('',save=raw);s=export(page);assert s['schemaVersion']==11;assert len(s['run']['desktop']['apps'])==8;assert all(p['installed'] for p in s['run']['desktop']['projects'].values());assert len(s['persistent']['screenshots'])==2
   f=open_app(page,'files');f.locator('.app-rebuild').click();b=page.locator('.app-builder');b.locator('.builder-parts>div').filter(has=page.get_by_role('button',name=WORDS['ja']['builder.part.list'],exact=True)).get_by_role('button',name=WORDS['ja']['builder.remove'],exact=True).click();b.get_by_role('button',name=WORDS['ja']['builder.install'],exact=True).click();saved=export(page);page.reload();page.locator('.debug-panel').evaluate("e=>e.style.display='none'");assert export(page)['run']['desktop']['projects']['files']==saved['run']['desktop']['projects']['files'];ctx.close()
   passed('第10版の実データをブラウザで移行し、8アプリと旧撮影を保持。組み直しの保存・再読み込みも一致')
  if not args.functional_only:
   for stage in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene(f'desktop-stage{stage}',lang,size);page.clock.resume()
      for app in APPS:
       w=open_app(page,app);w.locator('.window-controls button').nth(1).click()
       page.wait_for_function("""app=>{const r=document.querySelector('.desktop-live>[data-app=\"'+app+'\"] .app-layout');return r&&Math.max(...[...r.querySelectorAll('.app-layout-part')].map(p=>p.offsetLeft+p.offsetWidth))>=r.clientWidth-8}""",arg=app)
       layout=check_parts(w)
       assert max(p['x']+p['width'] for p in layout['parts'])>=layout['width']-8,layout
       cursor=w.locator('[data-layout-job]')
       if cursor.count():
        target=w.locator('[data-app-part='+{'files':'list','photo':'image','terminal':'output'}[app]+']');a=cursor.bounding_box();b=target.bounding_box();assert abs(a['x']-b['x'])<2 and abs(a['y']-b['y'])<2,(app,a,b)
       if app=='mail':
        buttons=w.locator('[data-app-part=messages] aside>button');a=buttons.nth(0).bounding_box();b=buttons.nth(1).bounding_box();assert b['y']>=a['y']+a['height']-1
       layouts.append({'stage':stage,'language':lang,'browser':size,'app':app,**layout});page.screenshot(path=str(OUT/f'app-{stage}-{lang}-{size[0]}-{app}.png'));w.locator('.window-controls button').nth(1).click();w.locator('.window-controls button').first.click();assert not w.is_visible();open_app(page,app);expect(w).to_be_visible();w.locator('.window-controls button').last.click();assert not win(page,app).count();open_app(page,app);expect(win(page,app)).to_be_visible()
      ctx.close();print('LAYOUT',stage,lang,size[0],flush=True)
   passed('3言語×段0〜2×2画面サイズ×8アプリの144画面で、配置の内側・重なりなし・最大化/復元/最小化/閉じる/再開を検査')
  assert not errors,errors;browser.close()
 name='functional-checks.json' if args.functional_only else 'layout-checks.json' if args.layouts_only else 'checks.json'
 (OUT/name).write_text(json.dumps({'checks':checks,'layouts':layouts,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'layouts':len(layouts),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
