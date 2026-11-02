"""Recheck the first world in three languages and both sizes, blocking external requests."""
import argparse,json,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:4173');args=parser.parse_args();base=args.base_url.rstrip('/')+'/'
root=Path(__file__).resolve().parents[1];out=root/'game/artifacts/stage7';checks=[];errors=[];external=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 for lang in ['ja','en','en-XA']:
  for width,height in [(1920,1080),(1366,768)]:
   for scene in ['intro','seed-border','seed-saved','seed-color','seed-font','seed-layout','seed-motion']:
    ctx=browser.new_context(viewport={'width':width,'height':height},locale='ja-JP' if lang=='ja' else 'en-US',offline=False)
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(base) else None)
    now=datetime(2026,11,2,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
    page.goto(base+'play/?debug=1&state='+scene);page.locator('.debug-panel select').first.select_option(lang);page.evaluate('document.fonts.ready');page.locator('.debug-panel').evaluate('e=>e.style.display="none"')
    if scene=='intro':
     expect(page.locator('.intro-note')).to_be_visible();page.locator('.intro-note button').click();expect(page.locator('.seed-page')).to_be_visible();page.locator('.generate-button').click()
    else:
     expect(page.locator('.seed-page')).to_be_visible();page.locator('.generate-button').click()
    bad=page.locator('.seed-page button,.intro-note button').evaluate_all("es=>es.filter(e=>e.getBoundingClientRect().width&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)");assert not bad,(lang,width,scene,bad)
    if lang=='ja' and scene in ['intro','seed-color','seed-motion']:page.screenshot(path=str(out/f'first-{scene}-{lang}-{width}.png'))
    checks.append({'scene':scene,'language':lang,'viewport':[width,height]});ctx.close()
 browser.close()
assert not errors,errors
assert not external,external
(out/'first-worlds.json').write_text(json.dumps({'scenes':checks,'pageErrors':errors,'externalRequests':external},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'scenes':len(checks),'pageErrors':errors,'externalRequests':external}))
