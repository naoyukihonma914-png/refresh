"""Stage 6.1: six visual stages, acquisition, rollback, painting and legacy scenes.
Run after npm --prefix game run build with the game served at /play/.
"""
import argparse,gzip,json,re,shutil
from pathlib import Path
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'game/artifacts/stage61'
MESSAGES={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
JA=MESSAGES['ja']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--functional-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[];layouts=[]
 def passed(text):checks.append(text);print('PASS:',text,flush=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture='desktop-ready',lang='ja',size=(1920,1080)):
   ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo');page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   # The shipped game must operate without requests to another origin.
   ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(args.base_url) else route.abort())
   n=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=n);page.clock.pause_at(n+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1'+('&state='+fixture if fixture else ''),timeout=30000);page.locator('.debug-panel').wait_for();page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.fast_forward(2500);return ctx,page
  def state(page):
   with page.expect_download() as d:page.locator('.debug-panel button').nth(-3).evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def win(page,app):return page.locator(f'.desktop-live > [data-app="{app}"]')
  def open_app(page,app):
   if app=='settings':page.locator('.desktop-live > .desktop-resources .taskbar-tokens,.desktop-live > .desktop-taskbar .taskbar-tokens').click()
   else:page.locator('.desktop-live > .desktop-taskbar .taskbar-apps').get_by_role('button',name=JA['desktop.app.'+app],exact=True).click()
   w=win(page,app);w.wait_for(state='visible');return w
  def maximize(w):
   if 'is-maximized' not in w.get_attribute('class'):w.locator('.window-controls').get_by_role('button',name=JA['desktop.maximize'],exact=True).click()
  def plugins(w):w.locator('.k-menu').get_by_role('button',name=JA['k.extensions'],exact=True).click()
  def editor_row(w,key):return w.locator('.extension-row').filter(has_text=JA[key])
  def settle(page):page.clock.fast_forward(2200)
  # Literal stage dimensions in the common 1920 x 1080 canvas.
  for group in ([] if args.functional_only else ['editor','desktop']):
   for era in range(3):
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene(f'{group}-stage{era}',lang,size);root=page.locator('.kumiki').first if group=='editor' else page.locator('.desktop-live')
      if group=='editor':
       boxes={k:root.locator(k).bounding_box() for k in ['.k-palette','.k-tools','.k-workspace']}
       assert boxes['.k-palette']['x']<boxes['.k-workspace']['x']<boxes['.k-tools']['x'] if era<2 else boxes['.k-tools']['x']<boxes['.k-workspace']['x']<boxes['.k-palette']['x']
       assert root.locator('.k-layer-strip').count()==(1 if era==1 else 0)
       assert root.locator('canvas').is_visible();assert root.locator('.home-document .text-button').first.evaluate("e=>getComputedStyle(e).backgroundColor")=='rgba(0, 0, 0, 0)';assert not root.locator('.k-menu,.k-toolbar,.k-status').evaluate_all('es=>es.some(e=>e.scrollWidth>e.clientWidth+2)')
       assert root.locator('.app-name').inner_text()==('Gesso' if era==2 else 'Tessera') if lang!='en-XA' else True
      else:
       bar=root.locator(':scope>.desktop-taskbar');a=bar.locator('.taskbar-apps').bounding_box();r=bar.locator('.taskbar-right').bounding_box();assert a['x']+a['width']<=r['x']+1,(era,lang,size,a,r)
       assert root.locator('.taskbar-pixels small').first.is_visible();title=win(page,'photo').locator('.window-title').bounding_box();scale=size[0]/1920;assert abs(title['height']-[18,26,30][era]*scale)<2,(era,title)
       assert abs(bar.bounding_box()['height']-[28,30,40][era]*scale)<2
       if era==2:assert root.locator('.desktop-resources').bounding_box()['y']<500*scale
       assert not page.locator('.desktop-live>.screenshot-toolbar').evaluate('e=>e.scrollWidth>e.clientWidth+2')
      layouts.append({'group':group,'era':era,'language':lang,'viewport':size});page.screenshot(path=str(OUT/f'{group}-{era}-{lang}-{size[0]}.png'));ctx.close()
  if not args.functional_only:passed('Tessera①②・Gesso③・デスクトップ0〜2を3言語×2画面サイズの36枚で確認。配置・タイトル寸法・タスクバー・毎秒表示を検査')
  references=['02-1-tessera-aseprite-old.html','02-2-tessera-aseprite-new.html','02-3-gesso-affinity-old.html','03-0-desktop-earliest.html','03-1-desktop-2000s.html','03-2-desktop-glass.html']
  for name in ([] if args.functional_only else references):
   ctx=browser.new_context(viewport={'width':1920,'height':1080});ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(args.base_url) else route.abort());page=ctx.new_page();page.goto(args.base_url+'/docs/mockups/'+name);page.screenshot(path=str(OUT/f'reference-{name}.png'));ctx.close()
  if not args.functional_only:passed('見本02-1〜02-3・03-0〜03-2の6枚も同寸法で撮影して比較')
  ctx,page=scene('kumiki-wall');w=page.locator('.kumiki');plugins(w);row=editor_row(w,'k.skill.update');before=state(page);row.get_by_role('button').click();assert page.locator('.kumiki.editor-era-1.is-renewing').count();assert state(page)['resources']['tokens']==before['resources']['tokens']-3;settle(page);assert not page.locator('.is-renewing').count();w.get_by_label(JA['appearance.editor'],exact=True).select_option('0');settle(page);assert page.locator('.editor-era-0').count();ctx.close();passed('v0.1の1周目で3トークンのTessera更新、約2秒の演出、以前の見た目への復帰')
  ctx,page=scene();w=open_app(page,'tessera');maximize(w);plugins(w);editor_row(w,'k.skill.update').get_by_role('button').click();settle(page);gesso=editor_row(w,'k.skill.modern');assert gesso.get_by_role('button').is_disabled();assert JA['appearance.requirement'].split('（')[0] in gesso.inner_text()
  w.locator('.window-controls').get_by_role('button',name=JA['desktop.minimize'],exact=True).click();settings=open_app(page,'settings');maximize(settings);before=state(page);rects=before['run']['desktop']['windows'];settings.locator('.desktop-skill').filter(has_text=JA['desktop.skill.major1']).get_by_role('button').click();assert page.locator('.desktop-live.desktop-era-1.desktop-updating').count();settle(page);settings.locator('.desktop-skill').filter(has_text=JA['desktop.skill.major2']).get_by_role('button').click();settle(page);after=state(page);assert after['resources']['tokens']==before['resources']['tokens']-24;assert after['run']['desktop']['windows']==rects
  settings.get_by_role('button',name=JA['settings.general'],exact=True).click();settings.get_by_label(JA['appearance.desktop'],exact=True).select_option('0');settle(page);assert page.locator('.desktop-live.desktop-era-0').count();settings.locator('.window-controls').get_by_role('button',name=JA['desktop.close'],exact=True).click();w=open_app(page,'tessera');gesso=editor_row(w,'k.skill.modern');assert gesso.get_by_role('button').is_enabled();before=state(page);gesso.get_by_role('button').click();settle(page);after=state(page);assert after['resources']['tokens']==before['resources']['tokens']-25;assert w.locator('.window-title>span').inner_text().startswith('Gesso');assert page.locator('.taskbar-apps').get_by_role('button',name='Gesso',exact=True).count();assert after['run']['kumiki']['drawings']==before['run']['kumiki']['drawings'];assert after['run']['desktop']['jobs']==before['run']['desktop']['jobs']
  for era in ['0','1','2']:w.get_by_label(JA['appearance.editor'],exact=True).select_option(era);settle(page)
  assert state(page)['persistent']['appearance']=={'editor':2,'desktop':0};plugins(w);w.get_by_label(JA['k.document'],exact=True).select_option('free');canvas=w.locator('canvas');before=state(page);canvas.focus();page.keyboard.press('Enter');assert state(page)['persistent']['artwork']['sketchbook']['frames']!=before['persistent']['artwork']['sketchbook']['frames'];w.locator('.k-palette .panel-tabs').get_by_role('button',name=JA['k.history'],exact=True).click();w.locator('.drawing-history').get_by_role('button',name=JA['k.undo'],exact=True).click();assert state(page)['persistent']['artwork']['sketchbook']['frames']==before['persistent']['artwork']['sketchbook']['frames'];w.locator('.drawing-history').get_by_role('button',name=JA['k.redo'],exact=True).click();a=canvas.bounding_box();w.locator('.editor-navigator select').select_option('2');b=canvas.bounding_box();assert b['width']>a['width']*1.9,(a,b)
  page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();shot=state(page)['persistent']['screenshots'][-1];assert json.loads(shot['data'])['appearance']=={'editor':2,'desktop':0};ctx.close();passed('大型更新4・20、取得済み環境でのGesso購入25、名前とタスクバー、切り戻し、窓・絵・ジョブの保持、描画・履歴・倍率・V3撮影')
  ctx,page=scene('desktop-early');assert page.locator('.desktop-live>.photo-surface').count()==0;assert page.locator('.desktop-live>.photo-wallpaper').count()==0;assert page.locator('.desktop-live').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(0, 128, 128)';ctx.close();passed('最初のデスクトップは青緑の単色。自分で選ぶまで写真を壁紙にしない')
  ctx,page=scene('desktop-stage2');theme=open_app(page,'theme');maximize(theme);theme.get_by_label(JA['theme.nativeRadius'],exact=True).uncheck();slider=theme.get_by_label(JA['theme.radius'],exact=True);slider.fill('3');assert state(page)['persistent']['desktopPrefs']['radiusCustom'];assert win(page,'theme').evaluate('e=>getComputedStyle(e).borderTopLeftRadius')=='3px';theme.get_by_label(JA['theme.nativeRadius'],exact=True).check();assert win(page,'theme').evaluate('e=>getComputedStyle(e).borderTopLeftRadius')=='7px';
  for icon_size in ['32','64']:
   theme.get_by_label(JA['theme.iconSize'],exact=True).select_option(icon_size);assert page.locator('.desktop-live>[data-shortcut=tessera]>.app-icon').evaluate('e=>getComputedStyle(e).width')==icon_size+'px'
  page.locator('.desktop-live>.desktop-taskbar .taskbar-apps').get_by_role('button',name=JA['desktop.app.settings'],exact=True).click();assert win(page,'settings').is_visible();ctx.close();passed('角の丸みとアイコン寸法を設定できる。標準の角へ戻り、最大化中もタスクバーから設定を開ける')
  ctx,page=scene(None);legacy=OUT/'v8-import.json';legacy.write_bytes(gzip.decompress((ROOT/'game/src/systems/testdata/v8-two-shots.json.gz').read_bytes()))
  with page.expect_file_chooser() as chooser:page.locator('.debug-panel button').nth(-2).evaluate('e=>e.click()')
  chooser.value.set_files(str(legacy));page.locator('.desktop-live').wait_for();s=state(page);assert s['schemaVersion']==9;assert len(s['persistent']['screenshots'])==2;assert json.loads(s['persistent']['screenshots'][0]['data'])['version']==2
  files=open_app(page,'files');maximize(files);files.locator('.files-sidebar').get_by_role('button',name=JA['files.screenshots'],exact=True).click();files.locator('[data-file]').first.dblclick();files.locator('.screenshot-preview .desktop-frozen').wait_for();assert files.locator('.screenshot-preview .desktop-frozen').evaluate("e=>!e.className.includes('desktop-era-')");ctx.close();passed('第8版をブラウザで取り込み、第9版へ移行。V2記録は従来の姿で開く')
  assert not errors,errors;browser.close()
 (OUT/('functional-checks.json' if args.functional_only else 'checks.json')).write_text(json.dumps({'checks':checks,'layouts':layouts,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'screens':len(layouts),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
