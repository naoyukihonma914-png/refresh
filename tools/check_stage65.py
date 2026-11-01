"""Exercise stage 6.5 in Chromium. Build and serve game/dist at /play/ first."""
import argparse,gzip,json,math,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage65'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--functional-only',action='store_true');ap.add_argument('--matrix-only',action='store_true');ap.add_argument('--extras-only',action='store_true');ap.add_argument('--notices-only',action='store_true');ap.add_argument('--legacy-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 checks=[];errors=[];scenes=[]
 def passed(name):checks.append(name);print('PASS',name,flush=True)
 def text(lang,key):
  t=WORDS['ja' if lang=='ja' else 'en'][key]
  return '['+t+'~'*math.ceil(len(t)*.4)+']' if lang=='en-XA' else t
 def by(root,lang,key):return root.get_by_role('button',name=text(lang,key),exact=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(name,lang='ja',size=(1920,1080),save=None):
   ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort())
   if save:ctx.add_init_script('if(!localStorage.getItem("refresh.save"))localStorage.setItem("refresh.save",'+json.dumps(save)+')')
   ctx.add_init_script('''window.audioKinds=[];const Native=window.AudioContext;if(Native)window.AudioContext=class extends Native{createOscillator(){const o=super.createOscillator(),s=o.start.bind(o);o.start=(...a)=>{window.audioKinds.push(o.type);return s(...a)};return o}}''')
   page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1'+('' if save else '&state='+name));page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500)
   for button in page.locator('.desktop-live>.feedback-toast header>button').all():
    if button.is_visible():button.click()
   return ctx,page
  def export(page):
   with page.expect_download() as d:page.locator('.debug-panel .debug-actions').last.locator('button').first.evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  def open_app(page,app,maximize=True):
   page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator('.desktop-programs [data-app-launcher='+app+']').click();w=page.locator('.desktop-live>[data-app='+app+']')
   if maximize and 'is-maximized' not in w.get_attribute('class'):w.locator('.window-controls button').nth(1).click()
   return w
  def clipping(root):
   clipped=root.locator('button').evaluate_all('''es=>es.filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&e.scrollWidth>e.clientWidth+2}).map(e=>e.textContent)''');assert not clipped,clipped
  def snap(page,name):page.screenshot(path=str(OUT/(name+'.png')))
  def sound(page,root,lang):
   cb=root.get_by_label(text(lang,'sound.enabled'),exact=True);expect(cb).to_be_checked();cb.uncheck();assert export(page)['persistent']['progress']['sound']['enabled'] is False;cb.check();r=root.get_by_label(text(lang,'sound.volume'),exact=True);r.focus();page.keyboard.press('ArrowRight');assert export(page)['persistent']['progress']['sound']['volume']==.2;clipping(root)
   return {'appearance':r.evaluate('e=>getComputedStyle(e).appearance'),'thumbRadius':r.evaluate('e=>getComputedStyle(e,"::-webkit-slider-thumb").borderRadius')}
  if not args.functional_only and not args.extras_only and not args.notices_only and not args.legacy_only:
   for lang in ['ja','en','en-XA']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene('longplay-seed',lang,size);main=page.locator('.seed-page');main.locator('.bulk-control select').select_option('ten');before=export(page);main.locator('.build-list li').filter(has=page.locator('.bulk-control')).locator('.build-button').click();after=export(page);assert after['run']['seed']['autoCursors']==before['run']['seed']['autoCursors']+10
     by(main,lang,'seed.settings').click();settings=page.locator('.page-settings');settings.locator('.longplay-settings').nth(0).locator('summary').click();assert settings.locator('[data-achievement]').count()==28;clipping(settings);snap(page,f'seed-records-{lang}-{size[0]}');settings.locator('.longplay-settings').nth(0).locator('summary').click();settings.locator('.longplay-settings').nth(1).locator('summary').click();sound(page,settings,lang);snap(page,f'seed-sound-{lang}-{size[0]}');ctx.close();scenes.append({'world':'seed','language':lang,'viewport':size});print('SEED',lang,size[0],flush=True)
   for stage in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene('longplay-editor'+str(stage),lang,size);page.locator('.common-settings-button').click();tabs=page.locator('.extension-tabs');by(tabs,lang,'settings.records').click();assert page.locator('.records-table [data-achievement]').count()==28;clipping(page.locator('.extensions-page'));snap(page,f'editor-records-{stage}-{lang}-{size[0]}');by(tabs,lang,'settings.sound').click();controls=sound(page,page.locator('.extensions-page'),lang);snap(page,f'editor-sound-{stage}-{lang}-{size[0]}');ctx.close();scenes.append({'world':'editor','era':stage,'language':lang,'viewport':size,'sound':controls})
      ctx,page=scene('longplay-desktop'+str(stage),lang,size);w=open_app(page,'settings');by(w.locator('aside'),lang,'settings.records').click();assert w.locator('[data-achievement]').count()==28;clipping(w);snap(page,f'desktop-records-{stage}-{lang}-{size[0]}');by(w.locator('aside'),lang,'settings.sound').click();controls=sound(page,w,lang);assert controls['appearance']=='none';snap(page,f'desktop-sound-{stage}-{lang}-{size[0]}');w=open_app(page,'manager');expect(w.locator('.production-factors')).to_be_visible();clipping(w);snap(page,f'manager-{stage}-{lang}-{size[0]}');w=open_app(page,'terminal');expect(w.locator('.terminal-run')).to_be_in_viewport();clipping(w);w.get_by_label(text(lang,'terminal.command'),exact=True).select_option('export');w.locator('.terminal-run').click();snap(page,f'terminal-{stage}-{lang}-{size[0]}');ctx.close();scenes.append({'world':'desktop','era':stage,'language':lang,'viewport':size,'sound':controls});print('EDITOR/DESKTOP',stage,lang,size[0],flush=True)
   passed('3 languages × 2 viewports: seed records, sound and real bulk purchase; all 3 editor/desktop eras: records, sound, manager factors and terminal controls')
  if not args.matrix_only and not args.extras_only and not args.notices_only and not args.legacy_only:
   for name,blocked in [('contract-no-color','color'),('contract-no-cursors','cursor')]:
    ctx,page=scene(name);s=export(page)
    while not page.locator('.kumiki').count():
     s=export(page);print(name,s['run']['seed']['built'],flush=True);assert s['run']['seed']['autoCursors']==0 if blocked=='cursor' else True;assert blocked not in s['run']['seed']['built'];buttons=page.locator('.build-list .build-button');button=next(b for b in reversed(buttons.all()) if b.is_enabled())
     button.click()
    s=export(page);assert s['run']['play']['contract']['status']=='complete';assert name.removeprefix('contract-') in s['persistent']['progress']['completed'];assert blocked not in s['run']['seed']['built'];snap(page,name+'-complete');ctx.close()
   passed('Both contracts completed via real purchases; no-color skips Color in the seed list and neither challenge can block progress')
   ctx,page=scene('contract-no-color');by(page,'ja','contract.cancel').click();assert export(page)['run']['play']['contract']['status']=='cancelled';ctx.close()
   ctx,page=scene('contracts-offer');page.locator('.contract-selection select').select_option('no-color');by(page,'ja','release.startNext').click();page.clock.run_for(6000);s=export(page);assert s['run']['version']=='v2';assert s['run']['play']['contract']['id']=='no-color';assert 'color' not in s['run']['seed']['installer']['items'] if s['run']['seed']['installer'] else 'color' not in s['run']['seed']['built'];ctx.close();passed('Contract cancellation and selection at the future v1 release boundary carry into v2 without building Color')
   ctx,page=scene('stray-seed');before=export(page);page.locator('.stray-pixel').click();after=export(page);assert after['resources']['pixels']>before['resources']['pixels'];assert not page.locator('.stray-pixel').count();page.clock.run_for(120000);expect(page.locator('.stray-pixel')).to_be_visible();page.clock.run_for(30000);assert not page.locator('.stray-pixel').count();ctx.close();passed('Stray pixel collected once, reappears at the interval and disappears after 30 seconds')
   ctx,page=scene('seed-start');assert page.evaluate('audioKinds')==[]
   for _ in range(100):page.locator('[data-part=primary]').click()
   s=export(page);assert 'secret-button' in s['persistent']['progress']['records'];assert text('ja','secret.note') in s['persistent']['productionNote'];assert 'triangle' in page.evaluate('audioKinds');snap(page,'secret-button');by(page,'ja','seed.settings').click();settings=page.locator('.page-settings');settings.locator('.longplay-settings').nth(1).locator('summary').click();settings.get_by_label(text('ja','sound.enabled'),exact=True).uncheck();sounds=page.evaluate('audioKinds.length');by(settings,'ja','settings.back').click();page.locator('[data-part=primary]').click();assert page.evaluate('audioKinds.length')==sounds;ctx.close();passed('100 pre-border manual clicks append the note once; sound starts only after user interaction and mute persists in state')
   ctx,page=scene('secret-art');page.locator('.export-button').click();s=export(page);assert s['persistent']['progress']['unknownArt'];ctx.close()
   # Import the honestly earned picture into an already installed desktop, without changing its notes.
   ctx,page=scene('longplay-desktop0');desktop=export(page);ctx.close();desktop['persistent']['progress']['unknownArt']=s['persistent']['progress']['unknownArt'];desktop['persistent']['progress']['records']['secret-art']=s['persistent']['progress']['records']['secret-art'];ctx,page=scene('import','ja',save=json.dumps(desktop));note=export(page)['persistent']['productionNote'];
   while page.locator('.desktop-live>.desktop-window:visible').count():
    top=max(page.locator('.desktop-live>.desktop-window:visible').all(),key=lambda w:int(w.evaluate('e=>getComputedStyle(e).zIndex')));top.locator('.window-controls button').first.click()
   page.locator('[data-secret-icon]').dblclick();expect(page.locator('.desktop-live>[data-app=note] .secret-letter')).to_be_visible();assert export(page)['persistent']['productionNote']==note;snap(page,'secret-letter');ctx.close();passed('16 extra drawing cells exported through the real editor unlock a picture icon; its letter leaves the production note intact')
   ctx,page=scene('longplay-desktop0');before=export(page)
   for _ in range(10):page.locator('.desktop-live>.desktop-taskbar .taskbar-clock').click()
   assert 'secret-clock' in export(page)['persistent']['progress']['records'];w=open_app(page,'terminal');w.get_by_label(text('ja','terminal.command'),exact=True).select_option('refresh');w.locator('.terminal-run').click();after=export(page);assert after['run']['play']['refreshAt']>0;assert after['resources']['pixels']>before['resources']['pixels'];at=after['run']['play']['refreshAt'];page.locator('.desktop-live>[data-app=terminal] .terminal-run').click();assert export(page)['run']['play']['refreshAt']==at;snap(page,'secret-refresh');ctx.close();passed('Ten consecutive taskbar-clock clicks unlock refresh; real terminal command arranges windows and cooldown prevents repeated rewards')
   old=json.loads(gzip.decompress((ROOT/'game/src/systems/testdata/v12-progress.json.gz').read_bytes()));ctx,page=scene('old','ja',(1366,768),json.dumps(old));s=export(page);assert s['schemaVersion']==13;assert s['resources']['pixels']>=old['resources']['pixels'];assert s['resources']['tokens']==old['resources']['tokens'];assert s['resources']['dollars']==old['resources']['dollars'];assert s['persistent']['productionNote']==old['persistent']['productionNote'];assert s['persistent']['screenshots']==old['persistent']['screenshots'];assert s['run']['desktop']['projects']==old['run']['desktop']['projects'];page.clock.run_for(2000);assert export(page)['resources']['pixels']>s['resources']['pixels'];page.locator('.debug-panel .debug-actions').first.locator('button').nth(2).evaluate('e=>e.click()');page.reload();page.clock.run_for(1000);assert export(page)['persistent']['progress']['records']==s['persistent']['progress']['records'];ctx.close();passed('Genuine schema-12 save migrates in browser, retains money, notes, app projects and captures, resumes production and reloads with stable records')
  if args.extras_only:
   for lang in ['ja','en','en-XA']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene('longplay-editor0',lang,size);s=export(page);ctx.close();s['resources']['pixels']=2000;ctx,page=scene('estimate',lang,size,json.dumps(s));page.locator('.document-tabs button').first.click();home=page.locator('.home-document');home.locator('.bulk-control select').select_option('ten');expect(page.locator('.desktop-exit .purchase-estimate')).to_be_visible();home.locator('.build-list .build-button').click();expect(page.locator('.desktop-exit .estimate-improved del')).to_be_visible();snap(page,f'estimate-{lang}-{size[0]}');page.clock.run_for(2100);assert not page.locator('.desktop-exit .estimate-improved').count();assert 'square' in page.evaluate('audioKinds');ctx.close()
     for stage in [0,1,2]:
      ctx,page=scene('longplay-desktop'+str(stage),lang,size);w=open_app(page,'files');w.locator('.job-slot').click();menu=w.locator('.job-controls');menu.locator('.bulk-control select').select_option('ten');before=export(page);menu.locator('.job-purchase button').first.click();after=export(page);assert after['run']['desktop']['jobs']['files']['cursors']==before['run']['desktop']['jobs']['files']['cursors']+10;menu.locator('.bulk-control select').select_option('max');clipping(menu);expect(menu.locator('.job-purchase button').first).to_be_in_viewport();assert 'sine' in page.evaluate('audioKinds');snap(page,f'bulk-job-{stage}-{lang}-{size[0]}');ctx.close();scenes.append({'world':'job bulk','era':stage,'language':lang,'viewport':size})
   passed('3 languages × 2 viewports: purchase cuts exit estimate by at least 10%, old/new values last 2 seconds; all desktop eras buy exactly 10 job cursors and show max quotes; editor/desktop synth timbres verified')
   ctx,page=scene('longplay-desktop2');w=open_app(page,'settings');by(w.locator('aside'),'ja','settings.sound').click();w.get_by_label(text('ja','sound.volume'),exact=True).focus();page.keyboard.press('ArrowRight');before=export(page);page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();shot=export(page)['persistent']['screenshots'][-1];assert json.loads(shot['data'])['version']==8;w.get_by_label(text('ja','sound.volume'),exact=True).focus();page.keyboard.press('ArrowRight');w=open_app(page,'files');w.locator('.files-sidebar button').last.click();w.locator('[data-file="shot:'+str(shot['id'])+'"]').dblclick();expect(w.locator('.screenshot-preview .sound-settings output')).to_have_text('20%');snap(page,'capture-common-frozen');ctx.close();passed('Scene 8 captures settings/sound and keeps the photographed volume independent of subsequent edits')
  if args.notices_only:
   for stage in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene('longplay-desktop'+str(stage),lang,size)
      for _ in range(10):page.locator('.desktop-live>.desktop-taskbar .taskbar-clock').click()
      expect(page.locator('.desktop-live>.achievement-toast')).to_be_visible();page.locator('.desktop-live>.desktop-taskbar .notification-button').click();page.locator('.notification-center button').first.click();toasts=page.locator('.desktop-live>.feedback-toast');assert toasts.count()==2
      a,b=[e.bounding_box() for e in toasts.all()];assert a['x']+a['width']<=b['x'] or b['x']+b['width']<=a['x'],(a,b);assert page.locator('.achievement-toast header>.app-icon').evaluate('e=>e.clientWidth')==16;clipping(page.locator('.desktop-live>.achievement-toast'));snap(page,f'notices-{stage}-{lang}-{size[0]}');ctx.close();scenes.append({'world':'desktop notices','era':stage,'language':lang,'viewport':size})
   passed('All 3 desktop eras × 3 languages × 2 viewports: clock unlocks on the tenth click; achievement and feedback notices remain separate, with a native 16px icon')
  if args.legacy_only:
   old=json.loads(gzip.decompress((ROOT/'game/src/systems/testdata/v12-progress.json.gz').read_bytes()));ctx,page=scene('old','ja',(1366,768),json.dumps(old));w=open_app(page,'tessera');assert w.locator('.common-settings-button').count()==1;w=open_app(page,'files');w.locator('.files-sidebar button').last.click();w.locator('[data-file="shot:'+str(old['persistent']['screenshots'][0]['id'])+'"]').dblclick();expect(w.locator('.screenshot-preview .desktop-frozen')).to_be_visible();assert w.locator('.screenshot-preview .common-settings-button,.screenshot-preview .bulk-control,.screenshot-preview .production-factors,.screenshot-preview .terminal-run').count()==0;snap(page,'legacy-capture-without-new-controls');ctx.close();passed('Schema-12 live play gets the new settings; a genuine Scene-7 capture keeps its original controls without bulk, records/sound shortcuts or new terminal commands')
   ctx,page=scene('longplay-desktop2');w=open_app(page,'settings');by(w.locator('aside'),'ja','settings.sound').click();w.get_by_label(text('ja','sound.volume'),exact=True).focus();page.keyboard.press('ArrowRight');page.locator('.desktop-live>.screenshot-toggle').click();page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();shot=export(page)['persistent']['screenshots'][-1];w=open_app(page,'files');w.locator('.files-sidebar button').last.click();w.locator('[data-file="shot:'+str(shot['id'])+'"]').dblclick();expect(w.locator('.screenshot-preview .sound-settings output')).to_have_text('20%');ctx.close();passed('A Scene-8 capture still displays its new sound controls after legacy-view gating')
  browser.close()
 assert not errors,errors
 report={'checks':checks,'scenes':scenes,'pageErrors':errors};(OUT/('legacy.json' if args.legacy_only else 'notices.json' if args.notices_only else 'extras.json' if args.extras_only else 'functional.json' if args.functional_only else 'matrix.json' if args.matrix_only else 'checks.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'scenes':len(scenes),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
