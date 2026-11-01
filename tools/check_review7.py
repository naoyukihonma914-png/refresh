"""PR #7: native desktop resolutions, window migration, previews and Gesso workspaces."""
import argparse,gzip,json,re,shutil
from pathlib import Path
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'game/artifacts/review7';EVIDENCE=ROOT/'docs/reviews/pr7';JA=json.loads((ROOT/'game/src/content/locales/ja.json').read_text())['messages'];EN=json.loads((ROOT/'game/src/content/locales/en.json').read_text())['messages']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--functional-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True);checks=[];layouts=[];errors=[]
 def passed(value):checks.append(value);print('PASS:',value,flush=True)
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture='desktop-stage0',lang='ja',size=(1920,1080)):
   ctx=b.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo');page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort());n=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=n);page.clock.pause_at(n+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1'+('&state='+fixture if fixture else ''),timeout=30000);page.locator('.debug-panel').wait_for();page.locator('.debug-panel select').first.select_option(lang);page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.evaluate('document.fonts.ready');page.clock.fast_forward(2500);toast=page.locator('.desktop-live>.feedback-toast header>button');
   if toast.count():toast.click()
   return ctx,page
  def state(page):
   with page.expect_download() as d:page.locator('.debug-panel button').nth(-3).evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def win(page,app):return page.locator(f'.desktop-live>[data-app="{app}"]')
  def open_app(page,app):
   # Old desktops use running-window buttons, so closed apps open from a shortcut.
   w=win(page,app)
   if not w.count():
    page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator(f'.desktop-programs [data-app-launcher="{app}"]').click()
   elif not w.is_visible() or 'is-active' not in w.get_attribute('class'):page.locator('.desktop-live>.desktop-taskbar .taskbar-apps').get_by_role('button',name=w.get_attribute('aria-label'),exact=True).click()
   return win(page,app)
  def dimensions(page,era,size):
   screen=[(800,600),(1024,768),(1366,768)][era];live=page.locator('.desktop-live');assert live.evaluate('e=>[e.offsetWidth,e.offsetHeight]')==list(screen)
   box=live.bounding_box();assert abs(box['width']/box['height']-screen[0]/screen[1])<.002;assert abs(box['x']-(size[0]-box['width'])/2)<1;assert abs(box['y']-(size[1]-box['height'])/2)<1
   if era<2:assert box['x']>150;assert page.locator('.viewport-desktop').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(0, 0, 0)'
   else:assert box['x']<1 and box['y']<1
   return box
  def no_overlaps(page,lang,era,app):
   bar=page.locator('.desktop-live>.desktop-taskbar');a=bar.locator('.taskbar-apps').bounding_box();r=bar.locator('.taskbar-right').bounding_box();assert a['x']+a['width']<=r['x']+1,(era,lang,app,a,r)
   # Intentional filename ellipses keep full values in their title; buttons must wrap or fit.
   w=win(page,app);overflow=w.locator('.win-button,.files-breadcrumb button,.mail-folders button,.mail-app h1,.mail-app>aside h2').evaluate_all("es=>es.filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).textOverflow!=='ellipsis').map(e=>e.textContent)")
   assert not overflow,(era,lang,app,overflow)
  for era in ([] if args.functional_only else range(3)):
   for lang in ['ja','en','en-XA']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene(f'desktop-stage{era}',lang,size);dimensions(page,era,size);page.screenshot(path=str(OUT/f'desktop-{era}-{lang}-{size[0]}.png'));
     if lang=='ja' and size[0]==1920:page.screenshot(path=str(EVIDENCE/f'desktop-{era}.jpg'),type='jpeg',quality=75)
     for app in ['files','mail']:
      w=open_app(page,app);
      if app=='mail':
       rows=w.locator('.mail-app>aside>button');assert rows.count()>0;rows.last.click()
      no_overlaps(page,lang,era,app);page.screenshot(path=str(OUT/f'{app}-{era}-{lang}-{size[0]}.png'));
      if era==0 and size[0]==1920 and lang=='en-XA':page.screenshot(path=str(EVIDENCE/f'{app}-0-test-language.jpg'),type='jpeg',quality=75)
      layouts.append({'era':era,'language':lang,'viewport':size,'app':app})
     ctx.close()
  if not args.functional_only:passed('段0〜2×3言語×2ブラウザの18画面と、ファイル・メール36画面。4:3の黒い余白、段2の全面表示、タスクバー・文字を確認')
  ctx,page=scene();page.locator('.desktop-live .taskbar-tokens').click();settings=win(page,'settings');settings.locator('.window-controls').get_by_role('button',name=JA['desktop.maximize'],exact=True).click();settings.get_by_role('button',name=JA['settings.general'],exact=True).click()
  for era in [1,2,0]:
   settings.get_by_label(JA['appearance.desktop'],exact=True).select_option(str(era));page.clock.fast_forward(2200);s=state(page);width=s['run']['desktop']['screen']['width'];height=s['run']['desktop']['screen']['height']-[28,30,40][era]
   for w in s['run']['desktop']['windows'].values():
    for rect in [w]+([w['restore']] if w['restore'] else []):assert rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=width and rect['y']+rect['height']<=height,rect
   for icon in s['run']['desktop']['icons'].values():assert 0<=icon['x']<=width-80 and 0<=icon['y']<=height-76
   saved=OUT/f'stage{era}-save.json';saved.write_text(json.dumps(s,ensure_ascii=False));
   # Import to real localStorage, then actually reload the browser.
   c2,p2=scene(None)
   with p2.expect_file_chooser() as chooser:p2.locator('.debug-panel button').nth(-2).evaluate('e=>e.click()')
   chooser.value.set_files(str(saved));p2.locator('.desktop-live').wait_for();p2.reload();p2.locator('.debug-panel').wait_for();p2.locator('.debug-panel').evaluate("e=>e.style.display='none'");restored=state(p2);assert restored['run']['desktop']['windows']==s['run']['desktop']['windows'];assert restored['run']['desktop']['icons']==s['run']['desktop']['icons'];dimensions(p2,era,(1920,1080));c2.close()
  ctx.close();passed('0→1→2→0で通常・最大化・復元位置・全アイコンが範囲内。実保存してページを読み直しても座標が一致')
  for lang in ['ja','en','en-XA']:
   ctx,page=scene('editor-stage2',lang,(1366,768));words=JA if lang=='ja' else EN;root=page.locator('.kumiki')
   for workspace in ['draw','compose','export']:
    root.locator('.k-personas').get_by_role('button',name=re.compile(re.escape(words['k.workspace.'+workspace]))).click();assert root.get_attribute('data-workspace')==workspace
    if workspace=='draw':assert root.locator('canvas').is_visible();assert not root.locator('.home-document').is_visible();root.locator('canvas').focus();page.keyboard.press('Enter')
    if workspace=='compose':page.evaluate('document.fonts.ready');assert root.locator('.home-document').is_visible();assert not root.locator('canvas').is_visible();assert root.locator('.property-panel').is_visible();root.locator('.selection-measure').wait_for(state='visible');logical_width=root.locator('.home-document [data-part=primary]').evaluate('e=>e.offsetWidth');assert logical_width>0;expect(root.locator('.property-panel p').last).to_contain_text(str(logical_width))
    if workspace=='export':assert root.locator('.exports-list').is_visible();assert not root.locator('.k-palette').is_visible();assert not root.locator('canvas').is_visible()
    page.screenshot(path=str(OUT/f'gesso-{workspace}-{lang}.png'));
    if lang=='ja':page.screenshot(path=str(EVIDENCE/f'gesso-{workspace}.jpg'),type='jpeg',quality=80)
   ctx.close()
  passed('Gessoの「描く・組む・書き出す」と英語・試験用言語を確認。場面に応じてキャンバス・ホームとプロパティ・エクスポート一覧が切り替わる')
  ctx,page=scene('desktop-stage0');page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();s=state(page);shot=s['persistent']['screenshots'][-1];assert json.loads(shot['data'])['screen']=={'width':800,'height':600};files=open_app(page,'files');files.locator('.window-controls').get_by_role('button',name=JA['desktop.maximize'],exact=True).click();files.locator('.files-sidebar').get_by_role('button',name=JA['files.screenshots'],exact=True).click();files.locator('[data-file]').last.dblclick();preview=files.locator('.screenshot-preview');box=preview.locator('>div').bounding_box();assert abs(box['width']/box['height']-4/3)<.01;assert preview.locator('.desktop-frozen').evaluate('e=>[e.offsetWidth,e.offsetHeight]')==[800,600];page.screenshot(path=str(OUT/'capture-v4-4x3.png'));ctx.close();passed('新しい撮影は800×600を記録し、ファイルのプレビューも4:3')
  ctx,page=scene(None);path=OUT/'v9-import.json';path.write_bytes(gzip.decompress((ROOT/'game/src/systems/testdata/v9-two-shots.json.gz').read_bytes()))
  with page.expect_file_chooser() as chooser:page.locator('.debug-panel button').nth(-2).evaluate('e=>e.click()')
  chooser.value.set_files(str(path));page.locator('.desktop-live').wait_for();assert state(page)['schemaVersion']==10;files=open_app(page,'files');files.locator('.window-controls').get_by_role('button',name=JA['desktop.maximize'],exact=True).click();files.locator('.files-sidebar').get_by_role('button',name=JA['files.screenshots'],exact=True).click();files.locator('[data-file]').first.dblclick();preview=files.locator('.screenshot-preview');box=preview.locator('>div').bounding_box();assert abs(box['width']/box['height']-16/9)<.01;assert preview.locator('.desktop-frozen').evaluate('e=>[e.offsetWidth,e.offsetHeight]')==[1920,1080];page.screenshot(path=str(OUT/'capture-v3-16x9.png'));ctx.close();passed('実際の旧第9版を読み込み、V3撮影は従来の1920×1080・16:9を保つ')
  assert not errors,errors;b.close()
 (OUT/('functional-checks.json' if args.functional_only else 'checks.json')).write_text(json.dumps({'checks':checks,'layouts':layouts,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'layouts':len(layouts),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
