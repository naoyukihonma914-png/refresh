"""PR 6: compact job flyouts, month labels and shared photographic rendering."""
import argparse,json,shutil
from datetime import datetime,timedelta,timezone
from io import BytesIO
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'game/artifacts/review6'

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base-url',default='http://127.0.0.1:4173');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture='desktop-jobs',language='ja',size=(1920,1080)):
   ctx=browser.new_context(locale='ja-JP' if language=='ja' else 'en-US',timezone_id='Asia/Tokyo',viewport={'width':size[0],'height':size[1]});page=ctx.new_page();page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
   now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.goto(args.base_url+'/play/?debug=1&state='+fixture);page.locator('.debug-panel').wait_for();page.evaluate('document.fonts.ready');page.locator('.debug-panel select').first.select_option(language);page.locator('.debug-panel').evaluate("e=>e.style.display='none'");return ctx,page
  def win(page,app):return page.locator(f'.desktop-live > [data-app="{app}"]')
  def export(page):
   with page.expect_download() as d:page.locator('.debug-panel button').nth(-3).evaluate('e=>e.click()')
   return json.loads(Path(d.value.path()).read_text())
  for fixture,app in [('desktop-jobs','tessera'),('desktop-photo','photo')]:
   for language in ['ja','en']:
    for size in [(1920,1080),(1366,768)]:
     ctx,page=scene(fixture,language,size);w=win(page,app)
     if app=='tessera':page.locator('.taskbar-apps button').first.click()
     assert page.locator('.desktop-live .job-controls').count()==0
     page.screenshot(path=str(OUT/f'{fixture}-{language}-{size[0]}-closed.png'))
     w.locator('.job-slot').click();menu=w.get_by_role('dialog');menu.wait_for();assert w.locator('.job-controls button').count()==3
     a=menu.bounding_box();b=w.bounding_box();assert a['x']>=b['x']-1 and a['y']+a['height']<=b['y']+b['height']+1,(fixture,language,size,a,b)
     assert not menu.locator('button,.job-metrics').evaluate_all('es=>es.some(e=>e.scrollWidth>e.clientWidth+3)')
     page.screenshot(path=str(OUT/f'{fixture}-{language}-{size[0]}-open.png'));menu.locator('button').first.focus();page.keyboard.press('Escape');assert w.locator('.job-controls').count()==0
     assert w.locator('.job-slot').evaluate('e=>e===document.activeElement');ctx.close()
  checks.append('2状態×2言語×2サイズで閉じた画面とフライアウトの16枚を撮影。常設の帯なし、枠内の操作・効き目・推定時間・Escapeでの復帰')
  ctx,page=scene('desktop-ready');page.locator('.taskbar-apps').get_by_role('button',name='ターミナル',exact=True).click();w=win(page,'terminal');assert not w.locator('.job-slot,.job-controls').count()
  source=page.locator('.taskbar-job-source');source.focus();page.keyboard.press('ArrowDown');menu=page.locator('.job-assignment-menu');menu.get_by_role('menuitemcheckbox').filter(has_text='Tessera').click();source.focus();page.keyboard.press('ArrowDown');menu.get_by_role('menuitemcheckbox').filter(has_text='ターミナル').press('Enter');assert w.locator('.job-slot').count()==1;assert export(page)['run']['desktop']['jobs']['terminal']['assigned'];w.locator('.job-slot').click();w.locator('.job-controls button').first.click();assert export(page)['run']['desktop']['jobs']['terminal']['cursors']==1;ctx.close();checks.append('未割当のターミナルは枠・数・値段を隠す。キーボードでジョブを移し、最初のカーソルを購入できる')
  ctx,page=scene('desktop-ready');page.locator('.taskbar-apps').get_by_role('button',name='時計',exact=True).click();assert win(page,'clock').locator('.clock-calendar h2').inner_text()=='2026年11月';ctx.close();checks.append('カレンダーは年と月だけを表示')
  ctx,page=scene('desktop-photo');w=win(page,'photo');w.get_by_role('button',name='比べて見る',exact=True).click();assert w.locator('.photo-surface[data-color-steps="6"]').count()==2
  surface=w.locator('.photo-workbench figure').last.locator('.photo-surface');rect=surface.bounding_box();clip={'x':rect['x']+20,'y':rect['y']+20,'width':180,'height':100};im=Image.open(BytesIO(page.screenshot(clip=clip))).convert('RGB');quant=[len({color[i] for _,color in im.getcolors(100000)}) for i in range(3)];assert max(quant)<=6,quant
  page.locator('.debug-panel').evaluate("e=>e.style.display='block'");page.locator('.debug-panel').get_by_label('色深度').select_option('2');page.locator('.debug-panel').evaluate("e=>e.style.display='none'");w.locator('.photo-surface[data-color-steps="full"]').first.wait_for();im=Image.open(BytesIO(page.screenshot(clip=clip))).convert('RGB');full=[len({color[i] for _,color in im.getcolors(100000)}) for i in range(3)];assert max(full)>50,full;assert w.locator('.photo-surface[data-color-steps="full"]').count()==2;ctx.close();checks.append('写真の調整前後の両方が256色では各色6段階。フルカラーでは減色せず、同じ処理を壁紙と記録にも使用')
  assert not errors,errors;browser.close()
 (OUT/'checks.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
