"""PR #5 review: real localStorage at 200/400 captures, v6 migration, labels/dates/badge and capture guidance.
Run measure_capture_save.mjs --exports game/artifacts/review5/exports before this script.
"""
import argparse,gzip,json,shutil,statistics
from datetime import datetime,timedelta,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'game/artifacts/review5'
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--base-url',default='http://127.0.0.1:4173');args=parser.parse_args();url=args.base_url.rstrip('/')+'/play/'
 OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[];measurements=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  def scene(fixture=None):
   ctx=browser.new_context(locale='ja-JP',timezone_id='Asia/Tokyo',viewport={'width':1920,'height':1080});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   now=datetime(2026,10,31,tzinfo=timezone.utc);page.clock.install(time=now);page.clock.pause_at(now+timedelta(minutes=1));page.on('dialog',lambda d:d.accept())
   page.goto(url+'?debug=1'+('&state='+fixture if fixture else ''));page.locator('.debug-panel').wait_for();page.evaluate('document.fonts.ready');return ctx,page
  def import_file(page,path):
   with page.expect_file_chooser() as chooser:page.locator('.debug-panel').get_by_role('button',name='データを読み込む',exact=True).click()
   chooser.value.set_files(str(path));page.locator('.desktop-live').wait_for()
  for count in [200,400]:
   path=OUT/f'exports/shots-{count}.json';assert path.exists(),path
   ctx,page=scene();import_file(page,path)
   assert not page.locator('.runtime-notice').count()
   core=page.evaluate("JSON.parse(localStorage.getItem('refresh.save'))");assert len(core['persistent']['screenshots'])==count;assert 'data' not in core['persistent']['screenshots'][0];assert core['schemaVersion']==8
   session=ctx.new_cdp_session(page)
   frame=session.send('Page.getFrameTree')['frameTree']['frame']['id']
   world=session.send('Page.createIsolatedWorld',{'frameId':frame,'worldName':'native-save-timing'})['executionContextId']
   page.evaluate('''()=>{window.captureWrites=[];const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.captureWrites.push(k);return write.call(this,k,v);};}''')
   # The isolated world's performance clock is unaffected by the game's simulated clock.
   expression='''(() => {
    const b=[...document.querySelectorAll('.debug-panel button')].find(b=>b.textContent==='いま保存する');
    const times=[];
    for(let i=0;i<7;i++){const start=performance.now();b.click();times.push(performance.now()-start);}

    const entries=Object.entries(localStorage),primary=localStorage.getItem('refresh.save');
    return {times,primaryChars:primary.length,backupChars:localStorage.getItem('refresh.save.backup').length,totalUtf16Bytes:entries.reduce((n,[k,v])=>n+2*(k.length+v.length),0),keys:entries.length};
   })()'''
   response=session.send('Runtime.evaluate',{'contextId':world,'expression':expression,'returnByValue':True})
   assert 'exceptionDetails' not in response,response
   report=response['result']['value'];report['assetWrites']=page.evaluate("window.captureWrites.filter(k=>k.startsWith('refresh.capture.')).length")
   assert max(report['times'])>0,'Timing clock must be real'
   assert report['assetWrites']==0;assert report['totalUtf16Bytes']<5*1024*1024
   report.update(count=count,warmMedianMs=statistics.median(report['times']),warmMaxMs=max(report['times']));measurements.append(report)
   page.reload();page.locator('.desktop-live').wait_for();assert len(page.evaluate("JSON.parse(localStorage.getItem('refresh.save')).persistent.screenshots"))==count
   page.locator('.desktop-live > .desktop-taskbar').get_by_role('button',name='ファイル',exact=True).click()
   page.locator('.desktop-live > [data-app="files"] .files-sidebar').get_by_role('button',name='スクリーンショット',exact=True).click()
   page.locator(f'.desktop-live > [data-app="files"] [data-file="shot:{count}"]').scroll_into_view_if_needed();page.locator(f'.desktop-live > [data-app="files"] [data-file="shot:{count}"]').dblclick();page.locator('.screenshot-preview .desktop-frozen').first.wait_for()
   page.screenshot(path=str(OUT/f'shots-{count}-reloaded.png'));ctx.close();print(f'PASS: browser {count} captures, {report["warmMedianMs"]:.2f}ms, {report["totalUtf16Bytes"]} bytes',flush=True)
  checks.append('200枚・400枚を実際のlocalStorageへ取り込み、通常保存7回・再読み込み・最後の画像の表示を確認。通常保存の撮影データ書き込みは0件')
  legacy=gzip.decompress((ROOT/'game/src/systems/testdata/v6-two-shots.json.gz').read_bytes()).decode();ctx,page=scene();page.evaluate('(raw)=>localStorage.setItem("refresh.save",raw)',legacy);page.reload();page.locator('.desktop-live').wait_for()
  core=page.evaluate('JSON.parse(localStorage.getItem("refresh.save"))');assert core['schemaVersion']==8 and len(core['persistent']['screenshots'])==2
  page.locator('.desktop-live > .desktop-taskbar').get_by_role('button',name='ファイル',exact=True).click();page.locator('.desktop-live > [data-app="files"] .files-sidebar').get_by_role('button',name='スクリーンショット',exact=True).click();page.locator('[data-file="shot:1"]').dblclick();assert '保存の計測 0' in page.locator('.screenshot-preview textarea').input_value();ctx.close();checks.append('実際の第6版の撮影入りセーブを起動し、第8版へ移行して旧画像の本文を表示')
  ctx,page=scene('desktop-mail');page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
  page.get_by_role('button',name='窓を並べて撮る',exact=True).click();assert page.locator('.screenshot-toolbar.shot-hint').count()==1;assert page.locator('.capture-button').first.evaluate('e=>document.activeElement===e')
  a=page.locator('.desktop-live > [data-app="tessera"]').bounding_box();b=page.locator('.desktop-live > [data-app="note"]').bounding_box();assert a['x']+a['width']<=b['x'];page.screenshot(path=str(OUT/'capture-guidance.png'))
  page.clock.fast_forward(4100)
  badge=page.locator('.notification-button small').bounding_box();bell=page.locator('.notification-button').bounding_box();assert badge['x']>=bell['x'] and badge['x']+badge['width']<=bell['x']+bell['width'];assert badge['y']>=bell['y'] and badge['y']+badge['height']<=bell['y']+bell['height']
  ctx.close();checks.append('撮影の依頼は2窓を並べ、撮影の帯を強調してボタンへフォーカス。通知件数はベルの枠内')
  ctx,page=scene('desktop-files');page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
  page.locator('.desktop-live > [data-app="files"]').get_by_role('button',name='最小化',exact=True).click()
  tessera=page.locator('.desktop-live > [data-app="tessera"]');tessera.get_by_role('button',name='選択ツール',exact=True).click();tessera.locator('[data-part="primary"]').click();tessera.get_by_label('塗り',exact=True).select_option('#d0523a')
  tessera.get_by_label('編集するドキュメント',exact=True).select_option('free') if tessera.get_by_label('編集するドキュメント',exact=True).count() else tessera.locator('.editor-heading select').select_option('free')
  tessera.get_by_role('button',name='鉛筆',exact=True).click();canvas=tessera.locator('canvas');r=canvas.bounding_box();page.mouse.click(r['x']+4,r['y']+4)
  # Inspect the actual save via the platform's export button (fixture storage is deliberately isolated).
  page.locator('.debug-panel').evaluate("e=>e.style.display='block'")
  with page.expect_download() as download:page.locator('.debug-panel').get_by_role('button',name='データをエクスポート',exact=True).click()
  saved=json.loads(Path(download.value.path()).read_text());assert saved['persistent']['homeUpdatedAt'] is not None;assert saved['persistent']['sketchUpdatedAt'] is not None
  page.locator('.debug-panel').evaluate("e=>e.style.display='none'")
  page.locator('.desktop-live > .desktop-taskbar').get_by_role('button',name='ファイル',exact=True).click();files=page.locator('.desktop-live > [data-app="files"]');assert files.locator('[data-file="home"] td').nth(1).inner_text()!='記録なし';assert files.locator('[data-file="sketch"] td').nth(1).inner_text()!='記録なし';assert files.locator('[data-file="exports"] td').nth(1).inner_text()!='記録なし';assert 'ホーム画面.ui' in files.locator('[data-file="home"]').inner_text();page.screenshot(path=str(OUT/'file-dates.png'));ctx.close();checks.append('実際のホーム編集・スケッチ描画を保存し、ファイルとフォルダーの日時・文書名を確認')
  assert not errors,errors;browser.close()
 (OUT/'browser-checks.json').write_text(json.dumps({'checks':checks,'measurements':measurements,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':checks,'measurements':measurements,'pageErrors':errors},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
