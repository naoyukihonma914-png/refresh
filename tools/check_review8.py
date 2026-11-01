"""PR #8: capture drawer, editor-only guides and full file labels in each era."""
import argparse,json,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/review8'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--matrix-only',action='store_true');ap.add_argument('--functional-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 errors=[];screens=[];checks=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(stage,lang,size=(1920,1080)):
   ctx=browser.new_context(locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo',viewport={'width':size[0],'height':size[1]});ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort());page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1&state=desktop-stage'+str(stage));page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500)
   for button in page.locator('.desktop-live>.feedback-toast header>button').all():button.click()
   return ctx,page
  def win(page,app):return page.locator('.desktop-live>[data-app='+app+']')
  def open_app(page,app):
   page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator('.desktop-programs [data-app-launcher='+app+']').click();return win(page,app)
  def maximize(page,w):
   if 'is-maximized' not in w.get_attribute('class'):w.locator('.window-controls button').nth(1).click()
   if w.locator('.app-layout').count():page.wait_for_function('''app=>{const r=document.querySelector('.desktop-live>[data-app="'+app+'"] .app-layout');return r&&Math.max(...[...r.querySelectorAll('.app-layout-part')].map(p=>p.offsetLeft+p.offsetWidth))>=r.clientWidth-8}''',arg=w.get_attribute('data-app'))
  def export(page):
   with page.expect_download() as d:page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def no_guides(root):
   borders=root.locator('.app-layout-part,.builder-part').evaluate_all('es=>es.filter(e=>getComputedStyle(e).borderStyle!=="none"&&parseFloat(getComputedStyle(e).borderWidth)>0).map(e=>e.className)');assert not borders,borders
  def closed(page,w):
   toggle=page.locator('.desktop-live>.screenshot-toggle');expect(toggle).to_have_attribute('aria-expanded','false');expect(page.locator('.desktop-live>.screenshot-toolbar')).to_be_hidden();r=toggle.bounding_box();desktop=page.locator('.desktop-live').bounding_box();assert abs(r['x']+r['width']/2-desktop['x']-desktop['width']/2)<1,(r,desktop);assert abs(r['y']-desktop['y'])<1,(r,desktop)
   collisions=w.evaluate('''(w,grip)=>{const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;const overlap=[];for(const e of w.querySelectorAll('.window-title>span,.window-title button,.k-menu button,.k-toolbar>span,.document-tabs button,.files-address button,[data-app-part=source] label')){const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.visibility!=='hidden'&&r.width&&r.height&&hit(r,grip))overlap.push(e.textContent);}return overlap}''',{'left':r['x'],'right':r['x']+r['width'],'top':r['y'],'bottom':r['y']+r['height']});assert not collisions,collisions
   return r
  def drawer(page):
   toggle=page.locator('.desktop-live>.screenshot-toggle');band=page.locator('.desktop-live>.screenshot-toolbar');toggle.click();expect(band).to_be_visible();result=band.evaluate('''e=>({width:e.clientWidth,scroll:e.scrollWidth,rect:e.getBoundingClientRect().toJSON(),clipped:[...e.querySelectorAll('strong,span,small,button')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent)})''');assert result['scroll']<=result['width']+1 and not result['clipped'],result;desktop=page.locator('.desktop-live').bounding_box();assert result['rect']['left']>=desktop['x'] and result['rect']['right']<=desktop['x']+desktop['width']+1;return toggle,band
  if not args.functional_only:
   for stage in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene(stage,lang,size);page.clock.resume()
      for app in ['tessera','files','photo']:
       w=open_app(page,app);maximize(page,w);grip=closed(page,w);no_guides(w);toggle,band=drawer(page);toggle.click();closed(page,w);drawer(page);bounds=w.bounding_box();page.mouse.click(bounds['x']+20,bounds['y']+bounds['height']-40);closed(page,w);drawer(page);page.keyboard.press('Escape');closed(page,w)
       if app=='files':
        assert w.locator('.file-list').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        cells=w.locator('.file-list tbody td:nth-child(2),.file-list tbody td:nth-child(3)').evaluate_all('es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({text:e.textContent,width:e.clientWidth,scroll:e.scrollWidth}))');assert not cells,cells
        sidebar=w.locator('.files-sidebar button').evaluate_all('es=>es.filter(e=>getComputedStyle(e).whiteSpace!=="nowrap"||e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)');assert not sidebar,sidebar
        w.locator('.app-rebuild').click();editor=win(page,'tessera');maximize(page,editor);closed(page,editor);guides=editor.locator('.builder-part');assert guides.count()>0;assert guides.first.evaluate('e=>getComputedStyle(e).borderStyle')=='dashed';page.screenshot(path=str(OUT/f'builder-{stage}-{lang}-{size[0]}.png'));editor.locator('.document-tabs button').first.click();w=open_app(page,'files')
       page.screenshot(path=str(OUT/f'{app}-{stage}-{lang}-{size[0]}.png'));screens.append({'era':stage,'language':lang,'viewport':size,'app':app,'grip':grip})
      toggle,band=drawer(page);page.screenshot(path=str(OUT/f'drawer-{stage}-{lang}-{size[0]}.png'));band.locator('.capture-button').click();closed(page,win(page,'photo'));last=export(page)['persistent']['screenshots'][-1]['id'];f=open_app(page,'files');f.locator('.files-sidebar button').last.click();f.locator('[data-file="shot:'+str(last)+'"]').dblclick();expect(f.locator('.screenshot-preview')).to_be_visible();no_guides(f.locator('.screenshot-preview'));assert f.locator('.screenshot-preview .screenshot-toolbar:visible').count()==0
      ctx.close();print('MATRIX',stage,lang,size[0],flush=True)
   checks.append('3時代×3言語×2画面サイズ×最大化3アプリの54通りで帯を閉じた上部の重なりなし。開閉・外側クリック・Escape・撮影で閉じる・文字幅・編集時だけの枠・撮影・日付と種類・場所名を確認')
  if not args.matrix_only:
   for stage in [0,1,2]:
    ctx,page=scene(stage,'ja');clock=open_app(page,'clock');clock.get_by_label(WORDS['ja']['clock.reserveAt'],exact=True).fill('09:02');clock.get_by_role('button',name=WORDS['ja']['clock.reserve'],exact=True).click();before=export(page);page.clock.fast_forward(120000);after=export(page);assert after['run']['desktop']['reservation']['done'];assert len(after['persistent']['screenshots'])==len(before['persistent']['screenshots'])+1;closed(page,clock)
    terminal=open_app(page,'terminal');terminal.get_by_role('button',name=WORDS['ja']['terminal.stop'],exact=True).click();terminal.get_by_role('button',name=WORDS['ja']['terminal.start'],exact=True).click();before=export(page)
    for _ in range(15):page.clock.fast_forward(4000)
    after=export(page);assert after['run']['desktop']['terminal']['executions']==before['run']['desktop']['terminal']['executions']+1;assert len(after['persistent']['screenshots'])==len(before['persistent']['screenshots'])+1;closed(page,terminal);ctx.close()
   checks.append('段0〜2で帯を閉じたまま時計の予約撮影とターミナルの定期撮影が動く')
   ctx,page=scene(0,'en-XA');page.clock.resume();f=open_app(page,'files');f.locator('.app-rebuild').click();k=win(page,'tessera');maximize(page,k);assert k.locator('.builder-part').count();before=export(page)['persistent']['screenshots'];toggle,band=drawer(page);band.locator('.capture-button').click();closed(page,k);after=export(page);assert len(after['persistent']['screenshots'])==len(before)+1;f=open_app(page,'files');maximize(page,f);f.locator('.files-sidebar button').last.click();f.locator('[data-file="shot:'+str(after['persistent']['screenshots'][-1]['id'])+'"]').dblclick();expect(f.locator('.screenshot-preview .builder-part').first).to_be_visible();no_guides(f.locator('.screenshot-preview'));page.screenshot(path=str(OUT/'captured-builder.png'));ctx.close();checks.append('組み立て中の撮影にもパーツの目安の枠とサイズ変更つまみを描かない')
  browser.close()
 assert not errors,errors
 report={'checks':checks,'screens':screens,'pageErrors':errors};name='functional-checks.json' if args.functional_only else 'matrix-checks.json' if args.matrix_only else 'checks.json';(OUT/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'screens':len(screens),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
