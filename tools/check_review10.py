"""PR #10: clock content, real reservations and minimum custom parts in every era/language/viewport.
Build game first and serve its single HTML at /play/ on --base-url.
"""
import argparse,json,math,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/review10'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
# Text ranges exclude margins; compare them with the actual scroll viewport, including scrollbar space.
FIT='''root=>{const failures=[],r=root.getBoundingClientRect(),scale=r.width/root.offsetWidth,left=r.left+root.clientLeft*scale,top=r.top+root.clientTop*scale,right=left+root.clientWidth*scale,bottom=top+root.clientHeight*scale;for(const e of root.querySelectorAll('h2,p,label,button,.clock-time')){for(const n of e.childNodes){if(n.nodeType!==Node.TEXT_NODE||!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const b of range.getClientRects())if(b.left<left-.7||b.right>right+.7||b.top<top-.7||b.bottom>bottom+.7)failures.push({text:n.textContent,box:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},viewport:{left,right,top,bottom}});}if(e.tagName==='BUTTON'){const b=e.getBoundingClientRect();if(b.left<left-.7||b.right>right+.7||b.top<top-.7||b.bottom>bottom+.7||e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)failures.push({button:e.textContent});}}return {width:root.clientWidth,height:root.clientHeight,scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight,failures}}'''
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--era',type=int);ap.add_argument('--language');ap.add_argument('--width',type=int);args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);errors=[];checks=[]
 def word(lang,key):
  t=WORDS['ja' if lang=='ja' else 'en'][key];return '['+t+'~'*math.ceil(len(t)*.4)+']' if lang=='en-XA' else t
 def by(root,lang,key):return root.get_by_role('button',name=word(lang,key),exact=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for era in ([args.era] if args.era is not None else [0,1,2]):
   for lang in ([args.language] if args.language else ['ja','en','en-XA']):
    for size in ([(args.width,1080 if args.width==1920 else 768)] if args.width else [(1920,1080),(1366,768)]):
     ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US',timezone_id='Asia/Tokyo');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(args.base_url) else r.abort());page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?state=longplay-desktop'+str(era)+'&debug=1');page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500)
     for close in page.locator('.desktop-live>.feedback-toast header>button').all():close.click()
     page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator('.desktop-programs [data-app-launcher=clock]').click();w=page.locator('.desktop-live>[data-app=clock]');time=w.locator('[data-app-part=time]');timer=w.locator('[data-app-part=timer]')
     def check(mode):
      results={}
      for part in [time,timer]:
       part.evaluate('e=>{e.scrollTop=0;e.scrollLeft=0}');result=part.evaluate(FIT);assert not result['failures'],(era,lang,size,mode,result);assert result['scrollWidth']<=result['width']+1,(mode,result);assert result['scrollHeight']<=result['height']+1,(mode,result);results[part.get_attribute('data-app-part')]=result
      for node in [time.locator('.clock-face>p'),by(timer,lang,'clock.reserve')]:
       assert node.evaluate('''e=>{const r=e.getBoundingClientRect();for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(!b.width||!b.height)continue;if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))return false;if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))return false;}return true}'''),(era,lang,size,mode,node.inner_text())
      field=timer.locator('input');assert field.evaluate('''e=>{const s=getComputedStyle(e),c=document.createElement('canvas').getContext('2d');c.font=s.fontSize+' '+s.fontFamily;return c.measureText(e.placeholder).width<=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)+1}'''),(mode,field.get_attribute('placeholder'))
      # A viewport can scroll through the calendar log; the face and booking controls remain whole.
      checks.append({'era':era,'language':lang,'viewport':size,'mode':mode,'parts':results});page.screenshot(path=str(OUT/f'clock-{era}-{lang}-{size[0]}-{mode}.png'))
     def reserve():
      field=timer.get_by_label(word(lang,'clock.reserveAt'),exact=True);field.fill('09:30');button=by(timer,lang,'clock.reserve');expect(button).to_be_enabled();button.click();expect(by(timer,lang,'clock.cancel')).to_be_visible();check('reserved');by(timer,lang,'clock.cancel').click();expect(by(timer,lang,'clock.cancel')).to_have_count(0)
     def builder():
      w.locator('.app-rebuild').click();k=page.locator('.desktop-live>[data-app=tessera]')
      if 'is-maximized' not in k.get_attribute('class'):k.locator('.window-controls button').nth(1).click()
      return k.locator('.app-builder[data-building=clock]')
     check('standard');reserve();b=builder();by(b,lang,'builder.recommended').click();b.locator('.builder-install').click();check('recommended')
     # Use the real property controls to select every offered font and shrink the parts to measured minima.
     for font in [10,12,14,16]:
      b=builder()
      for id in ['time','timer']:
       b.locator('[data-builder-part='+id+']').click(position={'x':10,'y':10});b.locator('.builder-properties select').nth(1).select_option(str(font));expect(b.locator('.builder-properties select').nth(1)).to_have_value(str(font));page.wait_for_timeout(60)
       for key in ['width','height']:
        field=b.get_by_label(word(lang,'builder.'+key),exact=True);minimum=field.get_attribute('min');field.fill(minimum);field.press('Tab');expect(field).to_have_value(minimum)
      b.locator('[data-builder-part=time]').click(position={'x':10,'y':10})
      for key in ['x','y']:
       field=b.get_by_label(word(lang,'builder.'+key),exact=True);field.fill('8');field.press('Tab');expect(field).to_have_value('8')
      b.locator('.builder-install').click();check('minimum-font'+str(font));reserve()
     # Attempt to shrink the actual clock window too. Native content minima may grow it back.
     if 'is-maximized' in w.get_attribute('class'):w.locator('.window-controls button').nth(1).click()
     grip=w.locator('.window-resize');grip.focus()
     for _ in range(28):page.keyboard.press('ArrowLeft');page.keyboard.press('ArrowUp')
     page.wait_for_timeout(100);check('minimum-window');ctx.close();print('PASS',era,lang,size[0],flush=True)
  browser.close()
 assert not errors,errors
 name='checks.json' if args.era is None and not args.language and not args.width else 'partial-checks.json'
 report='{\n  "checks": [\n'+',\n'.join('    '+json.dumps(c,ensure_ascii=False) for c in checks)+'\n  ],\n  "pageErrors": '+json.dumps(errors)+'\n}\n'
 (OUT/name).write_text(report);print(json.dumps({'checks':len(checks),'pageErrors':errors}))
if __name__=='__main__':main()
