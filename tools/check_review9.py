"""PR #9: compare an independently built main and the reviewed branch, then edit it.
Serve their single HTML files at /play/ on --main-url and --base-url.
"""
import argparse,base64,json,math,re,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/review9'
WORDS={lang:json.loads((ROOT/f'game/src/content/locales/{lang}.json').read_text())['messages'] for lang in ['ja','en']}
METRICS='''p=>{const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {card:box(p.querySelector('.seed-content')),goal:box(p.querySelector('.goal')),notice:box(p.querySelector('.guide-notices')),button:box(p.querySelector('[data-part=primary]')),line:box(p.querySelector('.generator-line')),summary:box(p.querySelector('.cursor-summary')),upgrades:box(p.querySelector('.build-list')),cursors:[...p.querySelectorAll('.auto-cursor')].map(box)}}'''
VISIBLE='''e=>{let r=e.getBoundingClientRect();if(!r.width||!r.height)return false;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(!b.width||!b.height)continue;if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))return false;if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))return false;}return true}'''
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');ap.add_argument('--main-url',default='http://127.0.0.1:4174');ap.add_argument('--functional-only',action='store_true');ap.add_argument('--matrix-only',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);errors=[];comparisons=[];checks=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(url,name,lang,size):
   ctx=browser.new_context(viewport={'width':size[0],'height':size[1]},locale='ja-JP' if lang=='ja' else 'en-US');ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else r.abort());page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(url+'/play/?state='+name+'&debug=1');page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");page.clock.run_for(2500);return ctx,page
  def word(lang,key):
   t=WORDS['ja' if lang=='ja' else 'en'][key];return '['+t+'~'*math.ceil(len(t)*.4)+']' if lang=='en-XA' else t
  def by(root,lang,key):return root.get_by_role('button',name=word(lang,key),exact=True)
  def visible(root):
   cursors=root.locator('.auto-cursor');assert cursors.count()>0
   for c in cursors.all():assert c.evaluate(VISIBLE),c.bounding_box()
   for text in root.locator('.pixels-line,.cursor-summary').all():assert text.evaluate(VISIBLE),text.inner_text()
   button=root.locator('[data-part=primary]');assert button.evaluate('e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1'),button.evaluate('e=>({width:e.clientWidth,height:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight})')
  def compare_image(name,lang,size,paths):
   page=browser.new_page(viewport={'width':size[0]*2+24,'height':size[1]+42});figures=''.join('<figure><figcaption>'+label+'</figcaption><img src="data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()+'"></figure>' for label,path in zip(['main (e201e8e)','PR #9 — 修正後'],paths));page.set_content('<style>body{margin:0;background:#eee;font:16px sans-serif;display:flex;gap:24px}figure{margin:0}figcaption{height:42px;display:flex;align-items:center;padding-left:12px}img{display:block;width:'+str(size[0])+'px}</style>'+figures);page.screenshot(path=str(OUT/f'{name}-{lang}-{size[0]}-compare.png'));page.close()
  if not args.functional_only:
   for name in ['seed-color','seed-layout','seed-motion','seed-complete','kumiki-mature']:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      results={};paths=[]
      for label,url in [('main',args.main_url),('fixed',args.base_url)]:
       ctx,page=scene(url,name,lang,size);root=page.locator('.seed-page').first;visible(root);results[label]=root.evaluate(METRICS);path=OUT/f'{name}-{label}-{lang}-{size[0]}.png';page.screenshot(path=str(path));paths.append(path);ctx.close()
      fields=['goal','button','line'] if name=='kumiki-mature' else ['card','goal','notice','button','line','summary','upgrades']
      for field in fields:
       a,b=results['main'][field],results['fixed'][field];assert (a is None)==(b is None),(name,field,a,b)
       if a:
        for k in ['x','y','width','height']:assert abs(a[k]-b[k])<.2,(name,lang,size,field,k,a,b)
      assert len(results['main']['cursors'])==len(results['fixed']['cursors'])
      for a,b in zip(results['main']['cursors'],results['fixed']['cursors']):
       for k in ['x','y','width','height']:assert abs(a[k]-b[k])<.2,(name,lang,size,k,a,b)
      compare_image(name,lang,size,paths);comparisons.append({'scene':name,'language':lang,'viewport':size,'metrics':results});print('COMPARE',name,lang,size[0],flush=True)
   checks.append('5場面×3言語×2サイズをmainと左右に並べて撮影。素の画面はカード・見出し・通知・ボタン・生成行・台数・一覧の位置と寸法が一致。ホームは見出し・ボタン・生成行が一致。カーソルは全場面で位置・寸法・個数が一致し、切れない')
  if not args.matrix_only:
   for lang in ['ja','en','en-XA']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene(args.base_url,'seed-motion',lang,size);root=page.locator('.seed-page');by(root.locator('.guide-notices'),lang,'guide.close').click();before=root.locator('[data-part=primary]').bounding_box();by(root,lang,'page.arrange').click();part=root.locator('.page-part[data-page-part=generator]');s=size[0]/1920
     def drag(node,dx,dy):
      node.scroll_into_view_if_needed();r=node.bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+dx*s,r['y']+r['height']/2+dy*s,steps=6);page.mouse.up()
     drag(part.locator('.page-part-grip'),-160,0);after=root.locator('[data-part=primary]').bounding_box();assert abs(before['width']-after['width'])<1,(before,after)
     drag(root.locator('[data-page-part=upgrades] .page-part-grip'),0,96);drag(part.locator('.page-part-resize'),160,48);by(root,lang,'page.finish').click();page.clock.run_for(500);button=root.locator('[data-part=primary]');assert button.bounding_box()['width']>before['width']+60*s;assert button.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>16;visible(root);page.screenshot(path=str(OUT/f'edited-{lang}-{size[0]}.png'));by(root,lang,'builder.recommended').click();assert root.locator('.page-layout-flow').count()==1;visible(root);by(root,lang,'page.arrange').click();by(root,lang,'page.finish').click();assert root.locator('.page-layout-flow').count()==1;ctx.close();print('EDIT',lang,size[0],flush=True)
   checks.append('3言語×2サイズで移動だけではボタンの寸法を維持。明示した拡大ではボタンと文字が大きくなり、カーソルと台数を切らず、おすすめで元のカードへ復帰。編集を始めて閉じるだけでは標準のまま')
   for stage in [0,1,2]:
    for lang in ['ja','en','en-XA']:
     for size in [(1920,1080),(1366,768)]:
      ctx,page=scene(args.base_url,'desktop-stage'+str(stage),lang,size)
      for b in page.locator('.desktop-live>.feedback-toast header>button').all():b.click()
      page.locator('.desktop-live>.desktop-taskbar .taskbar-product').click();page.locator('.desktop-programs [data-app-launcher=photo]').click();w=page.locator('.desktop-live>[data-app=photo]');w.locator('.window-controls button').nth(1).click();slider=w.locator('.photo-adjustments input[type=range]').first;slider.focus();page.keyboard.press('ArrowRight');assert slider.input_value()=='1.05';focus=slider.evaluate('e=>{const s=getComputedStyle(e);return {style:s.outlineStyle,width:s.outlineWidth,radius:s.borderRadius}}')
      if stage==0:assert focus=={'style':'dotted','width':'1px','radius':'0px'},focus
      page.screenshot(path=str(OUT/f'photo-{stage}-{lang}-{size[0]}.png'));ctx.close()
   checks.append('3時代×3言語×2サイズで写真のスライダーをキーボード操作。95風は角丸の黒い枠を出さず、四角い点線のフォーカス枠を確認')
  browser.close()
 assert not errors,errors
 report={'mainCommit':'e201e8e','checks':checks,'comparisons':comparisons,'pageErrors':errors};name='functional-checks.json' if args.functional_only else 'matrix-checks.json' if args.matrix_only else 'checks.json';(OUT/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(checks),'comparisons':len(comparisons),'pageErrors':errors},ensure_ascii=False))
if __name__=='__main__':main()
