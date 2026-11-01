"""Stage 6.3: edit the real page, home heading, old save and era photo controls.
Build first and serve game/dist only at /play/ on a loopback server.
"""
import argparse,gzip,json,re,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage63'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 errors=[];checks=[];screens=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(name,lang,size,save=None):
   ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort())
   if save:ctx.add_init_script('if(!localStorage.getItem("refresh.save"))localStorage.setItem("refresh.save",'+json.dumps(save)+')')
   page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1'+('' if save else '&state='+name));page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500)
   for b in page.locator('.desktop-live>.feedback-toast header>button').all():b.click()
   return ctx,page
  def export(page):
   with page.expect_download() as d:page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def text(lang,key):
   t=WORDS['ja' if lang=='ja' else 'en'][key]
   return '['+t+'~'*int(__import__('math').ceil(len(t)*.4))+']' if lang=='en-XA' else t
  def by(root,lang,key):return root.get_by_role('button',name=text(lang,key),exact=True)
  def check_layout(root):
   result=root.locator('.page-layout-canvas').evaluate('''e=>({width:e.clientWidth,height:e.clientHeight,parts:[...e.querySelectorAll(':scope>.page-part')].map(p=>({id:p.dataset.pagePart,x:p.offsetLeft,y:p.offsetTop,width:p.offsetWidth,height:p.offsetHeight}))})''')
   for a in result['parts']:
    assert a['x']>=0 and a['y']>=0 and a['width']>=320 and a['x']+a['width']<=result['width'] and a['y']+a['height']<=result['height'],result
    for b in result['parts']:
     if a!=b:assert not(a['x']<b['x']+b['width'] and a['x']+a['width']>b['x'] and a['y']<b['y']+b['height'] and a['y']+a['height']>b['y']),result
   return result
  def no_clipping(root):
   clipped=root.locator('button,input,select').evaluate_all('''es=>es.filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2}).map(e=>e.textContent)''');assert not clipped,clipped
  def drag(page,node,dx,dy,invalid=False):
   node.scroll_into_view_if_needed();r=node.bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+dx,r['y']+r['height']/2+dy,steps=6)
   if invalid:expect(node.locator('xpath=..')).to_have_class(re.compile('invalid'))
   page.mouse.up()
  def open_app(page,app):
   page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator('.desktop-programs [data-app-launcher='+app+']').click();w=page.locator('.desktop-live>[data-app='+app+']');
   if 'is-maximized' not in w.get_attribute('class'):w.locator('.window-controls button').nth(1).click()
   return w
  for lang in ['ja','en','en-XA']:
   for size in [(1920,1080),(1366,768)]:
    ctx,page=scene('seed-color',lang,size);main=page.locator('.seed-page');by(main,lang,'seed.settings').click();settings=page.locator('.page-settings');assert settings.locator('.page-design-settings fieldset').count()==1
    settings.get_by_label(text(lang,'page.color.background'),exact=True).select_option('#1f3f7a');expect(settings.get_by_label(text(lang,'page.color.text'),exact=True).locator('option[value="#1f3f7a"]')).to_have_attribute('disabled','');settings.get_by_label(text(lang,'page.color.button'),exact=True).select_option('#7a2e2a');no_clipping(settings);by(settings,lang,'settings.back').click();page.screenshot(path=str(OUT/f'color-{lang}-{size[0]}.png'))
    # Buy the next three unlocks using real purchase buttons; debug only adds funds.
    for _ in range(10):page.locator('.debug-panel .debug-actions').first.locator('button').first.evaluate('e=>e.click()')
    main.locator('.build-list li').last.locator('button').click();by(main,lang,'seed.settings').click();settings.get_by_label(text(lang,'page.headingFont'),exact=True).select_option('serif');settings.get_by_label(text(lang,'page.bodyFont'),exact=True).select_option('mono');assert settings.locator('.page-design-settings fieldset').count()==2;by(settings,lang,'settings.back').click()
    main.locator('.build-list li').last.locator('button').click();assert main.locator('.page-layout-surface').count()==1;check_layout(main);page.screenshot(path=str(OUT/f'layout-{lang}-{size[0]}.png'))
    by(main,lang,'page.arrange').click();part=main.locator('[data-page-part=generator]');before=part.get_attribute('style');drag(page,part.locator('.page-part-grip'),-150*size[0]/1920,0);assert part.get_attribute('style')!=before;placed=part.get_attribute('style');drag(page,part.locator('.page-part-grip'),-2000,0,True);assert part.get_attribute('style')==placed
    drag(page,part.locator('.page-part-grip'),0,-190*size[0]/1920,True);assert part.get_attribute('style')==placed
    drag(page,part.locator('.page-part-resize'),-1000,0,True);assert part.get_attribute('style')==placed
    drag(page,part.locator('.page-part-resize'),40*size[0]/1920,0);assert part.get_attribute('style')!=placed;check_layout(main);by(main,lang,'page.finish').click();before=export(page);main.locator('[data-part=primary]').click();after=export(page);assert after['resources']['pixels']>before['resources']['pixels'];assert after['run']['seed']['page']==before['run']['seed']['page'];no_clipping(main)
    main.locator('.build-list li').nth(1).locator('button').click();by(main,lang,'seed.settings').click();settings.get_by_label(text(lang,'page.motion'),exact=True).select_option('fade');assert settings.locator('.page-design-settings fieldset').count()==3;by(settings,lang,'settings.back').click();expect(main).to_have_attribute('data-page-motion','fade');state=export(page);assert state['run']['seed']['page']['button']=='#7a2e2a';by(main,lang,'builder.recommended').click();assert export(page)['run']['seed']['page']['button']=='#7a2e2a';page.screenshot(path=str(OUT/f'motion-{lang}-{size[0]}.png'));by(main,lang,'page.reset').click();assert export(page)['run']['seed']['page']['button'] is None;check_layout(main);ctx.close();print('SEED',lang,size[0],flush=True);screens.append({'screen':'seed','language':lang,'viewport':size})
  checks.append('3言語×2サイズでカラー→フォント→レイアウト→アニメーションを実購入。配色・文字のガード・書体・動き・ドラッグ・拡大縮小・窓外/重なり/最小寸法の拒否・生成・おすすめ・標準へ戻すを実操作')
  for stage in [0,1,2]:
   for lang in ['ja','en','en-XA']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene('desktop-stage'+str(stage),lang,size);k=open_app(page,'tessera');k.locator('.document-tabs button').first.click();home=k.locator('.home-document');expect(home).to_be_visible();assert home.locator('[data-slot=switch],[data-slot=slider],input[type=range],input[type=checkbox]').count()==0;check_layout(home)
     original=export(page);field=home.get_by_label(text(lang,'page.homeHeading'),exact=True);field.fill('私のホーム画面' if lang=='ja' else 'My own home screen');after=export(page);assert after['run']['seed']['page']['heading']==field.input_value();assert after['run']['kumiki']['exportName']==original['run']['kumiki']['exportName'];assert after['persistent']['playerName']==original['persistent']['playerName'];expect(home.locator('.home-heading')).to_have_text(field.input_value());no_clipping(home);page.screenshot(path=str(OUT/f'home-{stage}-{lang}-{size[0]}.png'))
     by(home,lang,'seed.settings').click();home.get_by_label(text(lang,'page.headingFont'),exact=True).select_option('pixel');home.get_by_label(text(lang,'page.color.button'),exact=True).select_option('#7a2e2a');by(home,lang,'settings.back').click();by(k.locator('.k-tools'),lang,'k.tool.select').click();home.locator('[data-part=primary]').click();expect(k.locator('.property-panel').get_by_label(text(lang,'k.fillColor'),exact=True)).to_have_value('#7a2e2a');k.locator('.property-panel').get_by_label(text(lang,'k.fillColor'),exact=True).select_option('#1f3f7a');assert export(page)['run']['seed']['page']['button']=='#1f3f7a';assert 'Refresh Pixel' in home.locator('.home-heading').evaluate('e=>getComputedStyle(e).fontFamily');check_layout(home)
     photo=open_app(page,'photo');ranges=photo.locator('.photo-adjustments input[type=range]');assert ranges.count()>=2;old=export(page)['run']['desktop']['photo']['brightness'];ranges.first.focus();page.keyboard.press('ArrowRight');assert export(page)['run']['desktop']['photo']['brightness']>old
     assert ranges.first.evaluate('e=>getComputedStyle(e).appearance')=='none';no_clipping(photo);toggle=page.locator('.desktop-live>.screenshot-toggle');expect(toggle).to_have_attribute('aria-expanded','false');r=toggle.bounding_box();title=photo.locator('.window-title').bounding_box();assert r['y']+r['height']<=title['y']+title['height'];page.screenshot(path=str(OUT/f'photo-{stage}-{lang}-{size[0]}.png'));ctx.close();print('HOME/PHOTO',stage,lang,size[0],flush=True);screens.append({'screen':'home/photo','era':stage,'language':lang,'viewport':size})
  checks.append('3時代×3言語×2サイズでホームの見出し入力・作者名/作品名の独立・設定共有・取り外した部品の不在・配置の収まり、写真のスライダー操作と時代ごとの見た目を確認')
  old=json.loads(gzip.decompress((ROOT/'game/src/systems/testdata/v11-home-controls.json.gz').read_bytes()));ctx,page=scene('old','ja',(1366,768),json.dumps(old));s=export(page);assert s['schemaVersion']==12;assert s['resources']['pixels']>=old['resources']['pixels']+52120.5;assert s['persistent']['productionNote']==old['persistent']['productionNote'];assert s['run']['kumiki']['legacyBonus']=={'auto':1.2,'drawing':2};assert s['run']['desktop']['projects']==old['run']['desktop']['projects'];assert s['persistent']['screenshots']==old['persistent']['screenshots'];start=s['resources']['pixels'];page.clock.run_for(2000);assert export(page)['resources']['pixels']>start
  k=open_app(page,'tessera');k.locator('.document-tabs button').first.click();home=k.locator('.home-document');assert home.locator('[data-slot=switch],[data-slot=slider]').count()==0;home.get_by_label(WORDS['ja']['page.homeHeading'],exact=True).fill('移行後のホーム');page.locator('.debug-panel .debug-actions').first.locator('button').nth(2).evaluate('e=>e.click()');page.reload();page.clock.run_for(1000);assert export(page)['run']['seed']['page']['heading']=='移行後のホーム';k=open_app(page,'tessera');k.locator('.document-tabs button').first.click();home=k.locator('.home-document');page.clock.run_for(30000);page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();shot=export(page)['persistent']['screenshots'][-1];assert json.loads(shot['data'])['version']==7;home.get_by_label(WORDS['ja']['page.homeHeading'],exact=True).fill('撮影の後で変更');f=open_app(page,'files');f.locator('.files-sidebar button').last.click();f.locator('[data-file="shot:'+str(shot['id'])+'"]').dblclick();expect(f.locator('.screenshot-preview .home-heading')).to_have_text('移行後のホーム');page.screenshot(path=str(OUT/'capture-frozen.png'));ctx.close();checks.append('本物の第11版セーブをブラウザで移行。返金・未受け取り・倍率・ノート・アプリ・旧撮影の保持、自動生成の再開、見出し編集と保存再読み込み、場面形式7の撮影を後の変更から独立して表示することを確認')
  browser.close()
 assert not errors,errors
 (OUT/'checks.json').write_text(json.dumps({'checks':checks,'screens':screens,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'scenes':len(screens),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
