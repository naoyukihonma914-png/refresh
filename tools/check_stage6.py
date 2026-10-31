"""Stage 6 desktop interactions, old-save migration and native-window layout.
Run after npm --prefix game run build, using the local preview server on port 4173.
"""
import argparse,gzip,json,re,shutil
from pathlib import Path
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/artifacts/stage6'
class Checks(list):
 def append(self,value):
  super().append(value);print('PASS:',value,flush=True)
JA=json.loads((ROOT/'game/src/content/locales/ja.json').read_text())['messages']

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:4173');parser.add_argument('--visual-only',action='store_true');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True);checks=Checks();errors=[];layouts=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture='desktop-ready',language='ja',viewport=(1920,1080)):
   ctx=browser.new_context(locale='ja-JP' if language=='ja' else 'en-US',timezone_id='Asia/Tokyo',viewport={'width':viewport[0],'height':viewport[1]});page=ctx.new_page();page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   now=datetime(2026,11,1,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1))
   page.goto(args.base_url.rstrip('/')+'/play/?debug=1'+('&state='+fixture if fixture else ''));page.locator('.debug-panel').wait_for();page.evaluate('document.fonts.ready')
   if language!='ja':page.locator('.debug-panel select').first.select_option(language)
   page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
   return ctx,page
  def state(page):
   with page.expect_download() as event:page.locator('.debug-panel button').nth(-3).evaluate('e=>e.click()')
   return json.loads(Path(event.value.path()).read_text())
  def win(page,app):return page.locator(f'.desktop-live > [data-app="{app}"]')
  def open_app(page,app):
   page.locator('.desktop-live > .desktop-taskbar .taskbar-apps').get_by_role('button',name=JA['desktop.app.'+app],exact=True).click()
   win(page,app).wait_for(state='visible');return win(page,app)
  def maximize(page,app):
   w=win(page,app)
   if 'is-maximized' not in w.get_attribute('class'):w.locator('.window-controls').get_by_role('button',name='最大化',exact=True).click()
   return w
  def set_range(locator,n=1):
   locator.focus()
   for _ in range(n):locator.press('ArrowRight')
  if not args.visual_only:
   ctx,page=scene('desktop-early');assert not page.locator('.taskbar-clock').count();assert not page.locator('.job-slot').count()
   page.locator('.desktop-live > .desktop-taskbar .taskbar-tokens').click();assert win(page,'settings').is_visible();assert win(page,'settings').locator('.desktop-skill').count()==9;ctx.close();checks.append('初期状態には未解放の操作を出さず、トークンから設定を開ける')
   ctx,page=scene();w=open_app(page,'tessera');slot=w.locator('.job-slot');slot.click();assert not state(page)['run']['desktop']['jobs']['tessera']['assigned']
   page.locator('.desktop-live > .desktop-taskbar .taskbar-job-source').drag_to(slot);assert state(page)['run']['desktop']['jobs']['tessera']['assigned']
   before=state(page);w.locator('.job-controls button').nth(1).click();after=state(page);assert after['run']['desktop']['jobs']['tessera']['cursors']==9
   assert after['resources']['pixels']<before['resources']['pixels'];assert w.locator('.working-cursors > svg').count()==5
   w.locator('.job-controls button').nth(2).click();assert state(page)['run']['desktop']['jobs']['tessera']['updates']==2
   ctx.close();checks.append('ジョブのドラッグ割当・台数購入・更新・最大5カーソル表示')
   ctx,page=scene();w=open_app(page,'files');w=maximize(page,'files')
   w.get_by_role('button',name='更新日時で並べ替え',exact=True).click();assert state(page)['run']['desktop']['fileSort']=='date'
   w.get_by_role('searchbox').fill('ホーム画面.ui');assert w.locator('[data-file]').count()==1;w.get_by_role('searchbox').fill('')
   w.get_by_role('button',name='大きいアイコン',exact=True).click();assert w.locator('.large-file-icons').count();w.get_by_role('button',name='一覧',exact=True).click()
   w.locator('.window-controls').get_by_role('button',name='元に戻す',exact=True).click()
   w.locator('.files-sidebar').get_by_role('button',name='スクリーンショット',exact=True).click();row=w.locator('[data-file]').first;shotid=row.get_attribute('data-file')
   row.drag_to(page.locator('.desktop-live > [data-shortcut="bin"]'));assert state(page)['run']['desktop']['trash'][0]['id']==shotid
   binwin=open_app(page,'bin');binwin.get_by_role('button',name='元に戻す',exact=True).click();assert len(state(page)['run']['desktop']['trash'])==0
   ctx.close();checks.append('ファイルの並べ替え・検索・大きいアイコン・ドラッグでごみ箱・元に戻す')
   ctx,page=scene();w=win(page,'photo');w.get_by_label('写真を開く',exact=True).select_option('night');set_range(w.get_by_role('slider').nth(0),3);set_range(w.get_by_role('slider').nth(2),5)
   w.get_by_role('button',name='比べて見る',exact=True).click();assert w.locator('.photo-workbench figure').count()==2
   w.get_by_role('button',name='壁紙にする',exact=True).click();s=state(page);assert s['persistent']['desktopPrefs']['wallpaper']['source']=='night';assert s['persistent']['desktopPrefs']['wallpaper']['brightness']>1
   w=open_app(page,'theme');w.get_by_label('モード',exact=True).select_option('dark');w.get_by_label('アイコンの大きさ',exact=True).select_option('64');w.get_by_label('壁紙のスライドショー',exact=False).check()
   assert page.locator('.desktop-live.desktop-dark').count();s=state(page);assert s['persistent']['desktopPrefs']['iconSize']==64;assert s['persistent']['desktopPrefs']['slideshow']
   ctx.close();checks.append('写真の選択・明るさ・切り抜き・比較・壁紙、暗いテーマ・アイコン寸法・スライドショー')
   ctx,page=scene();w=open_app(page,'clock');w.get_by_label('撮影する時刻',exact=True).fill('09:02');w.get_by_role('button',name='撮影を予約',exact=True).click();before=state(page)
   page.clock.fast_forward(120000);after=state(page);assert after['run']['desktop']['reservation']['done'];assert len(after['persistent']['screenshots'])==len(before['persistent']['screenshots'])+1
   w=open_app(page,'terminal');w.get_by_role('button',name='停止',exact=True).click();w.get_by_role('button',name='実行する',exact=True).click();before=state(page)['run']['desktop']['terminal']['executions']
   for _ in range(15):page.clock.fast_forward(4000)
   assert state(page)['run']['desktop']['terminal']['executions']==before+1
   w=open_app(page,'manager');assert w.locator('.native-table tbody tr').count()>=5;w.get_by_role('button',name='パフォーマンス',exact=True).click();assert w.locator('.native-table tbody tr').count()==7
   ctx.close();checks.append('時計の不在予約・ターミナルの能動時間実行・タスクマネージャーの内訳と7スペック')
   ctx,page=scene();page.locator('.taskbar-tokens').click();w=win(page,'settings');w=maximize(page,'settings')
   for key in ['snap','direct','virtual','screensaver','sortMail']:
    row=w.locator('.desktop-skill').filter(has_text=JA['desktop.skill.'+key]);row.get_by_role('button',name='取得する',exact=True).click()
   w.locator('.window-controls').get_by_role('button',name='閉じる',exact=True).click()
   page.locator('.taskbar-workspaces button').nth(1).click();assert page.locator('.desktop-live > [data-app]:visible').count()==0
   page.locator('.taskbar-workspaces button').nth(0).click();w=open_app(page,'tessera');rect=w.locator('.window-title').bounding_box();page.mouse.move(rect['x']+80,rect['y']+16);page.mouse.down();page.mouse.move(20,rect['y']+16,steps=12);page.mouse.up()
   s=state(page);assert s['run']['desktop']['windows']['tessera']['x']==0;assert s['run']['desktop']['windows']['tessera']['width']==960
   w.locator('.workspace-move').click();assert state(page)['run']['desktop']['workspaces']['tessera']==1
   for _ in range(31):page.clock.fast_forward(4000)
   assert page.locator('.desktop-live > .desktop-screensaver').count();page.mouse.move(1400,900);assert not page.locator('.desktop-live > .desktop-screensaver').count()
   ctx.close();checks.append('スキル購入・左右スナップ・窓の移動・仮想デスクトップ・スクリーンセーバーと復帰')
   ctx,page=scene('desktop-stalled');w=win(page,'photo');before=state(page)['resources']['pixels'];w.get_by_role('button',name='再起動',exact=True).click();after=state(page);assert after['run']['desktop']['stalled'] is None;assert after['resources']['pixels']>before
   ctx.close();checks.append('応答なしを再起動して報酬を受け取り、ジョブは維持する')
   legacy=OUT/'v7-import.json';legacy.write_bytes(gzip.decompress((ROOT/'game/src/systems/testdata/v7-two-shots.json.gz').read_bytes()))
   ctx,page=scene(None)
   with page.expect_file_chooser() as chooser:page.locator('.debug-panel button').nth(-2).evaluate('e=>e.click()')
   chooser.value.set_files(str(legacy));page.locator('.desktop-live').wait_for();s=state(page);assert s['schemaVersion']==8;assert len(s['persistent']['screenshots'])==2;assert json.loads(s['persistent']['screenshots'][0]['data'])['version']==1
   ctx.close();checks.append('ブラウザでも旧第7版とV1撮影を取り込み、第8版へ移行')
  (OUT/'functional-checks.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n')
  # Native controls and translated text at the reference and smaller viewport sizes.
  for language in ['ja','en','en-XA']:
   for viewport in [(1920,1080),(1280,720)]:
    ctx,page=scene(language=language,viewport=viewport);page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
    live=page.locator('.desktop-live');assert live.is_visible()
    for app in ['photo','manager','settings','clock','terminal','theme','bin']:
     if app!='photo':
      label=JA['desktop.app.'+app] if language=='ja' else json.loads((ROOT/'game/src/content/locales/en.json').read_text())['messages']['desktop.app.'+app]
      if app=='settings':page.locator('.desktop-live > .desktop-taskbar .taskbar-tokens').click()
      else:page.locator('.desktop-live > .desktop-taskbar .taskbar-apps').get_by_role('button',name=re.compile(re.escape(label))).click()
     win(page,app).wait_for(state='visible')
     page.clock.run_for(50)
     bar=page.locator('.desktop-live > .desktop-taskbar');icons=bar.locator('.taskbar-apps').bounding_box();resources=bar.locator('.taskbar-right').bounding_box();assert icons['x']+icons['width']<=resources['x']+1,(language,viewport,app,icons,resources)
     title=win(page,app).locator('.window-title').bounding_box();expected=32*viewport[0]/1920;assert abs(title['height']-expected)<2
     overflows=win(page,app).locator('.win-button,select').evaluate_all("nodes=>nodes.filter(n=>n.clientWidth&&n.scrollWidth>n.clientWidth+3).map(n=>n.textContent)")
     layouts.append({'language':language,'viewport':viewport,'app':app,'overflows':overflows})
     page.screenshot(path=str(OUT/f'{app}-{language}-{viewport[0]}.png'))
    ctx.close()
  assert not errors,errors
  (OUT/'checks.json').write_text(json.dumps({'checks':checks,'layouts':layouts,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({'checks':len(checks),'layouts':len(layouts),'pageErrors':errors,'overflowCount':sum(len(r['overflows']) for r in layouts)},ensure_ascii=False))
  browser.close()
if __name__=='__main__':main()
