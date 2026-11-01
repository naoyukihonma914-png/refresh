"""PR #7 re-review: complete status fields, editor names and permanent balances."""
import argparse,json,re,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'game/artifacts/review7b';EVIDENCE=ROOT/'docs/reviews/pr7-rereview'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4174');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True);checks=[];layouts=[];errors=[]
 def passed(text):checks.append(text);print('PASS:',text,flush=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(stage=0,lang='ja',size=(1920,1080),close_toast=True,fixture=None):
   ctx=browser.new_context(locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo',viewport={'width':size[0],'height':size[1]});page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort());n=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=n);page.clock.pause_at(n+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1&state='+(fixture or f'desktop-stage{stage}'),timeout=30000);page.locator('.debug-panel').wait_for();page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.fast_forward(2500)
   if close_toast and page.locator('.desktop-live>.feedback-toast header>button').count():page.locator('.desktop-live>.feedback-toast header>button').click()
   return ctx,page
  def win(page,app):return page.locator(f'.desktop-live>[data-app="{app}"]')
  def open_app(page,app):
   w=win(page,app)
   if not w.count():page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator(f'.desktop-programs [data-app-launcher="{app}"]').click()
   elif not w.is_visible() or 'is-active' not in w.get_attribute('class'):page.locator('.desktop-live>.desktop-taskbar .taskbar-apps').get_by_role('button',name=w.get_attribute('aria-label'),exact=True).click()
   return win(page,app)
  def editor(page,stage,words):
   w=open_app(page,'tessera');w.locator('.k-menu').get_by_role('button',name=re.compile(re.escape(words['k.extensions']))).click();w.locator('.appearance-setting select').select_option(str(stage));page.clock.fast_forward(2200);w.locator('.k-menu').get_by_role('button',name=re.compile(re.escape(words['k.extensions']))).click()
   for button in page.locator('.appearance-guide>button').all():
    if button.is_visible():button.click()
   page.evaluate('document.fonts.ready');page.clock.run_for(50);return w
  def status(bar):
   result=bar.evaluate('''e=>{const c=e.querySelector('.status-content'),r=c.getBoundingClientRect(),badge=e.closest('.desktop-window')?.querySelector(':scope>.working-cursors>span')?.getBoundingClientRect();return [...c.querySelectorAll(':scope>.status-field')].map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.status,text:n.textContent,complete:n.scrollWidth<=n.clientWidth+1&&b.left>=r.left-1&&b.right<=r.right+1,obscured:!!badge&&b.left<badge.right&&b.right>badge.left&&b.top<badge.bottom&&b.bottom>badge.top,overflow:getComputedStyle(n).textOverflow};});}''')
   assert all(f['complete'] and not f['obscured'] and f['overflow']!='ellipsis' and '…' not in f['text'] for f in result),result;return result
  for os in [0,1]:
   for ed in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene(os,lang,size);words=WORDS['ja' if lang=='ja' else 'en'];w=editor(page,ed,words);bar=w.locator('.k-status');expect(bar.locator('.status-content>[data-status=saved]')).to_be_visible();small=status(bar);ids=[f['id'] for f in small];priority=['position','zoom','cursors','saved'];assert sorted(ids,key=priority.index)==priority[4-len(ids):],ids
      page.screenshot(path=str(OUT/f'bar-os{os}-editor{ed}-{lang}-{size[0]}-small.png'))
      if size[0]==1920 and (os,ed,lang) in [(0,0,'ja'),(1,2,'en-XA')]:page.screenshot(path=str(EVIDENCE/f'status-os{os}-editor{ed}-{lang}.jpg'),type='jpeg',quality=80)
      w.locator('.window-controls').get_by_role('button',name=re.compile(re.escape(words['desktop.maximize'])),exact=False).click();page.clock.run_for(50);wide=status(bar);assert len(wide)>=len(small),(small,wide);page.screenshot(path=str(OUT/f'bar-os{os}-editor{ed}-{lang}-{size[0]}-wide.png'));w.locator('.window-controls').get_by_role('button',name=re.compile(re.escape(words['desktop.restore'])),exact=False).click();page.clock.run_for(50);status(bar);layouts.append({'os':os,'editor':ed,'language':lang,'browser':size,'small':small,'wide':wide});ctx.close()
  passed('段0・1×Tessera①②/Gesso③×3言語×2ブラウザの36状態で、帯を縮小・最大化・復元。72画面を撮影し、全文の項目だけが残ることと省略の優先順位を確認')
  for os in [0,1]:
   for lang in ['ja','en','en-XA']:
    ctx,page=scene(os,lang,(1366,768));words=WORDS['ja' if lang=='ja' else 'en']
    for app in ['files','note']:
     w=open_app(page,app)
     if app=='note':
      handle=w.locator('.window-resize');handle.focus();handle.press('ArrowLeft');handle.press('ArrowLeft');handle.press('ArrowLeft');handle.press('ArrowLeft')
     for bar in w.locator('footer.status-bar').all():status(bar)
     if app=='note':expect(w.locator('.language-select select')).to_be_visible()
     page.screenshot(path=str(OUT/f'{app}-os{os}-{lang}.png'))
    ctx.close()
  passed('ファイルと制作ノートも3言語・段0/1で確認。文字数などを丸ごと省き、言語選択の操作を残す')
  for lang in ['ja','en','en-XA']:
   for size in [(1920,1080),(1366,768)]:
    ctx,page=scene(2,lang,size);words=WORDS['ja' if lang=='ja' else 'en'];w=open_app(page,'photo');w.locator('.window-controls').get_by_role('button',name=re.compile(re.escape(words['desktop.maximize']))).click();button=page.locator('.desktop-live>.desktop-taskbar .taskbar-balance');expect(button).to_be_visible();assert button.locator('b').inner_text();assert button.locator('small').inner_text();assert button.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}');bar=page.locator('.desktop-live>.desktop-taskbar');a=bar.locator('.taskbar-apps').bounding_box();r=bar.locator('.taskbar-right').bounding_box();assert a['x']+a['width']<=r['x']+1;button.click();expect(page.locator('.desktop-live>.desktop-upgrades')).to_be_visible();button.click();expect(page.locator('.desktop-live>.desktop-upgrades')).not_to_be_visible();page.screenshot(path=str(OUT/f'permanent-balance-{lang}-{size[0]}.png'))
    if lang=='ja' and size[0]==1920:page.screenshot(path=str(EVIDENCE/'balance-maximized.jpg'),type='jpeg',quality=75)
    ctx.close()
  passed('段2で写真を最大化しても、時計の左のピクセル・毎秒が見えて押せる。3言語×2ブラウザでアップグレードの開閉を確認')
  for lang in ['ja','en','en-XA']:
   ctx,page=scene(2,lang,close_toast=False);words=WORDS['ja' if lang=='ja' else 'en'];toast=page.locator('.desktop-live>.feedback-toast');expect(toast.locator('.feedback-body')).to_contain_text('Gesso');assert 'Tessera' not in toast.locator('.feedback-body').inner_text();toast.locator('header>button').click();w=open_app(page,'mail');w.locator('.mail-app>aside>button').filter(has_text=re.compile(re.escape(words['feedback.subject.color']))).click();expect(w.locator('.feedback-body')).to_contain_text('Gesso');page.locator('.desktop-live>.screenshot-toolbar .capture-button').click();page.clock.run_for(250);editor(page,0,words);w=open_app(page,'mail');expect(w.locator('.feedback-body')).to_contain_text('Tessera');files=open_app(page,'files');files.locator('.window-controls').get_by_role('button',name=re.compile(re.escape(words['desktop.maximize']))).click();files.locator('.files-sidebar').get_by_role('button',name=re.compile(re.escape(words['files.screenshots']))).click();files.locator('[data-file]').last.dblclick();preview=files.locator('.screenshot-preview');expect(preview.locator('.feedback-body')).to_contain_text('Gesso');assert 'Tessera' not in preview.locator('.feedback-body').inner_text();page.screenshot(path=str(OUT/f'captured-editor-name-{lang}.png'))
   for bar in files.locator('footer.status-bar').all():status(bar)
   if lang=='ja':page.screenshot(path=str(EVIDENCE/'captured-editor-name.jpg'),type='jpeg',quality=80)
   ctx.close()
  passed('通知とメールの本文は現在の名前に追従し、Gesso→Tesseraの切り戻し後も撮影したメールはGessoを保持。3言語で確認')
  assert not errors,errors;browser.close()
 (OUT/'checks.json').write_text(json.dumps({'checks':checks,'statusLayouts':layouts,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'statusLayouts':len(layouts),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
