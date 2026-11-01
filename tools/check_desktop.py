"""Stage 5: real desktop operations, persisted production files, feedback and frozen captures."""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage5'
class Checks(list):
 def append(self,value):
  super().append(value);print('PASS:',value,flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--visual-only',action='store_true');parser.add_argument('--functional-only',action='store_true');parser.add_argument('--base-url',default='http://127.0.0.1:4173');args=parser.parse_args()
 base=args.base_url.rstrip('/');url=base+'/play/'
 OUT.mkdir(parents=True,exist_ok=True);checks=Checks();errors=[];external=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture='desktop-early',language='ja',raw=None,size=(1920,1080)):
   ctx=browser.new_context(locale='ja-JP',timezone_id='Asia/Tokyo',viewport={'width':size[0],'height':size[1]})
   ctx.add_init_script("localStorage.setItem('refresh.settings',"+json.dumps(json.dumps({'language':language}))+');')
   if raw:ctx.add_init_script("if(!localStorage.getItem('refresh.save'))localStorage.setItem('refresh.save',"+json.dumps(raw)+');')
   page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith(base) else None)
   now=datetime(2026,10,31,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
   page.goto(url+'?debug=1'+('&state='+fixture if fixture else ''));page.locator('.desktop,.kumiki,.shipping-page').first.wait_for();page.evaluate('document.fonts.ready')
   page.locator('.debug-panel .language-select select').select_option(language)
   page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
   return ctx,page
  def data(page):
   page.locator('.debug-panel').evaluate("e=>e.style.display='block'")
   with page.expect_download() as d:page.locator('.debug-panel').get_by_role('button',name='データをエクスポート',exact=True).click()
   raw=Path(d.value.path()).read_text();page.locator('.debug-panel').evaluate("e=>e.style.display='none'");return raw
  def active_time(page,ms):
   while ms>0:
    step=min(ms,4000);page.clock.fast_forward(step);ms-=step
  def close(ctx):ctx.close()
  def win(page,app):return page.locator(f'.desktop-live > .desktop-window[data-app="{app}"]').first
  def task(page,app):page.locator('.desktop-live > .desktop-taskbar').get_by_role('button',name=app,exact=True).click()
  def layout(page):
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not page.locator('.screenshot-toolbar,.desktop-taskbar,.feedback-toast,.upgrade-current,.mail-app article,.files-status').evaluate_all('es=>es.filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.className)'), 'visible container overflow'
   rects=page.locator('.taskbar-apps,.taskbar-right').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,w:r.width}})')
   assert rects[0]['x']+rects[0]['w']<=rects[1]['x'],rects
  if not args.visual_only:
   ctx,page=scene();assert page.locator('.desktop-shortcut').count()==2
   assert page.locator('.taskbar-apps button').count()==1
   assert page.locator('.taskbar-pixels small').inner_text()=='毎秒 276.8'
   page.locator('.taskbar-pixels').click();assert '30万' in page.locator('.upgrade-current').inner_text();assert '38万' in page.locator('.upgrade-next').inner_text()
   page.locator('.upgrade-current button').click();assert page.locator('.desktop-shortcut').count()==3;assert win(page,'files').is_visible()
   page.locator('.taskbar-pixels').click();page.locator('.upgrade-current button').click();assert page.locator('.desktop-shortcut').count()==3;page.locator('.taskbar-pixels').click();page.locator('.upgrade-current button').click();assert page.locator('.desktop-shortcut').count()==4;assert win(page,'mail').is_visible()
   assert page.locator('.desktop-shortcut[data-shortcut="mail"] rect[fill="#8b8b8b"]').count()>0
   page.locator('.taskbar-pixels').click();assert '59万' in page.locator('.upgrade-current').inner_text()
   page.locator('.taskbar-pixels').click();layout(page);close(ctx);checks.append('初期アイコン2つ・タスクバーボタン1つ。ファイル30万→並べ替え38万→メール47万、未描画アイコンは灰色、次の機能だけを予告')

   ctx,page=scene('desktop-files');w=win(page,'files');r=w.bounding_box();page.mouse.move(r['x']+140,r['y']+16);page.mouse.down();page.mouse.move(r['x']-160,r['y']+96,steps=8);page.mouse.up();r2=w.bounding_box();assert abs(r2['x']-(r['x']-300))<2
   page.locator('[data-app="files"] .window-resize').focus();page.keyboard.press('ArrowRight');assert abs(w.bounding_box()['width']-776)<2
   w.get_by_role('button',name='最大化',exact=True).click();assert w.bounding_box()['width']==1920
   w.get_by_role('button',name='元に戻す',exact=True).click();assert abs(w.bounding_box()['x']-r2['x'])<2
   w.get_by_role('button',name='最小化',exact=True).click();assert not w.is_visible();task(page,'ファイル');assert w.is_visible()
   w.get_by_role('button',name='閉じる',exact=True).click();assert win(page,'files').count()==0;page.locator('[data-shortcut="files"]').dblclick();assert win(page,'files').is_visible()
   icon=page.locator('[data-shortcut="files"]');r=icon.bounding_box();page.mouse.move(r['x']+20,r['y']+20);page.mouse.down();page.mouse.move(r['x']+150,r['y']+250,steps=8);page.mouse.up()
   raw=data(page);saved=json.loads(raw);assert saved['run']['desktop']['windows']['files']['width']==776;assert saved['run']['desktop']['icons']['files']['x']>100
   close(ctx);ctx,page=scene(None,raw=raw);assert win(page,'files').bounding_box()['width']==776;assert page.locator('[data-shortcut="files"]').bounding_box()['x']>100;close(ctx)
   checks.append('ドラッグ・リサイズ・前面・最小化・最大化・閉じる・開き直しとアイコン位置を、実保存から再開')

   ctx,page=scene();page.locator('[data-shortcut="note"]').dblclick();note=win(page,'note').get_by_role('textbox',name='制作ノートの本文');assert 'いつかは、この画面ひとつで、何でも作れるようにしたい。' in note.input_value();note.fill('撮影前の制作ノート');note.blur()
   page.locator('.desktop-live > .screenshot-toolbar .capture-button').first.click();assert page.locator('.desktop-live > .screenshot-toolbar .capture-button').first.is_disabled()
   note.fill('撮影後に書き換えた本文');note.blur();raw=data(page);s=json.loads(raw);assert len(s['persistent']['screenshots'])==1
   # Buy Files, then preview the captured scene with the shared components.
   page.locator('.taskbar-pixels').click();page.locator('.upgrade-current button').click();w=win(page,'files')
   w.get_by_role('button',name='スクリーンショット',exact=True).first.click();w.locator('[data-file="shot:1"]').dblclick()
   frozen=w.locator('.screenshot-preview .desktop-frozen');frozen.wait_for();assert frozen.get_by_role('textbox',name='制作ノートの本文').input_value()=='撮影前の制作ノート'
   assert not frozen.locator('[data-app="files"]').count();assert '撮影後' not in frozen.inner_text()
   active_time(page,30_000);assert page.locator('.desktop-live > .screenshot-toolbar .capture-button').first.is_enabled()
   page.locator('.desktop-live > .screenshot-toolbar .capture-button').first.click();assert len(json.loads(data(page))['persistent']['screenshots'])==2
   page.screenshot(path=str(OUT/'screenshot-preview.png'));close(ctx);checks.append('撮影報酬・30秒の待ち・ファイルから撮影時の窓と本文を再描画。撮影後の編集では変わらず、再帰的な画像データは保存しない')

   ctx,page=scene('desktop-full');before=json.loads(data(page));page.locator('.desktop-live > .screenshot-toolbar .capture-button').first.click();assert '保存領域がいっぱい' in page.locator('.runtime-notice').inner_text();after=json.loads(data(page));assert len(after['persistent']['screenshots'])==50;assert after['resources']['pixels']==before['resources']['pixels'];close(ctx);checks.append('50枚の上限で古い撮影を削除せず、報酬も渡さず止める')

   ctx,page=scene();page.clock.fast_forward(240_000);assert page.locator('.feedback-toast').count()==1;assert page.locator('[data-shortcut="mail"]').count()==0
   page.get_by_role('button',name='あとで',exact=True).click();page.locator('.notification-button').click();assert page.locator('.notification-center button').count()==1;page.locator('.notification-center button').click();page.get_by_role('button',name='Tesseraで直す',exact=True).click();assert win(page,'tessera').evaluate("e=>e.classList.contains('is-active')")
   page.clock.fast_forward(480_000);assert len(json.loads(data(page))['run']['desktop']['feedback'])==3;close(ctx);checks.append('メールを作る前から4分ごとに通知、あとで閉じた依頼を再表示し、直す窓へ移動。3件で止まる')

   ctx,page=scene('desktop-mail');page.locator('.taskbar-pixels').click();page.locator('.upgrade-current button').click();w=win(page,'mail');w.locator('aside button').filter(has_text='生成ボタン').click();assert '塗りの色を変えて' in w.locator('article').inner_text();w.get_by_role('button',name='Tesseraで直す').click()
   tessera=win(page,'tessera');tessera.get_by_role('button',name='選択ツール',exact=True).click();tessera.locator('[data-part="primary"]').click();tokens=json.loads(data(page))['resources']['tokens']
   tessera.get_by_label('塗り',exact=True).select_option('#d0523a');assert 'ありがとうございました' in page.locator('.feedback-toast').inner_text();assert json.loads(data(page))['resources']['tokens']==tokens+2
   task(page,'メール');w=win(page,'mail');assert '対応済み' in w.locator('article').inner_text();raw=data(page);close(ctx);ctx,page=scene(None,raw=raw);task(page,'メール');assert '対応済み' in win(page,'mail').inner_text();close(ctx);checks.append('メールの一覧・本文・対応履歴。実際のボタン色変更だけで完了し、+2トークンを一度だけ保存')

   ctx,page=scene('desktop-wait');page.locator('.taskbar-pixels').click();assert 'スクリーンショット +' in page.locator('.desktop-upgrades').inner_text();assert '推定' in page.locator('.desktop-upgrades').inner_text()
   slider=win(page,'tessera').get_by_role('slider',name='間隔',exact=True);slider.focus();page.keyboard.press('End');assert page.locator('.desktop-upgrades .estimate-improved del').count()==1
   page.clock.run_for(2100);assert page.locator('.desktop-upgrades .estimate-improved').count()==0
   assert '毎秒 +' in win(page,'tessera').locator('.purchase-effect').inner_text();page.screenshot(path=str(OUT/'upgrade-estimate.png'));close(ctx);checks.append('タスクバーの毎秒・ホーム内の効き目・アップグレードの推定時間。倍率で1割以上短縮すると旧時間の取消線を2秒表示')

   ctx,page=scene('desktop-files');w=win(page,'files');w.get_by_role('button',name='エクスポート',exact=True).first.click();assert w.locator('[data-file^="product:"]').count()>0
   w.locator('[data-file^="product:"][data-file*="icon:folder"]').dblclick();assert w.locator('.art-preview .pixel-art rect').count()>0
   assert w.locator('.file-preview footer').inner_text();close(ctx);checks.append('ファイルには実際の出荷済みエクスポートが並び、開くと実データのアイコンを拡大表示')

  # Long translations and small viewports keep Windows dimensions on the scaled stage.
  if not args.functional_only:
   for lang in ['ja','en','en-XA']:
    for fixture in ['desktop-early','desktop-files','desktop-mail','desktop-modern']:
     ctx,page=scene(fixture,lang);layout(page)
     if fixture=='desktop-mail':task(page,'メール' if lang=='ja' else 'Mail' if lang=='en' else '[Mail~~]');layout(page)
     page.screenshot(path=str(OUT/f'{fixture}-{lang}-1920.png'))
     page.set_viewport_size({'width':1366,'height':768});page.clock.run_for(200);layout(page);page.screenshot(path=str(OUT/f'{fixture}-{lang}-1366.png'));close(ctx)
   checks.append('日本語・英語・長い試験用言語、1920×1080と1366×768で4状態を撮影。見本03と窓・一覧・タスクバーを比較')
  assert not errors,errors;assert not external,external
  browser.close()
 report={'checks':checks,'pageErrors':errors,'externalRequests':external};(OUT/('visual-checks.json' if args.visual_only else 'functional-checks.json' if args.functional_only else 'checks.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
