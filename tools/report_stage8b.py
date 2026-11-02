"""Combine stage8b acceptance runs and render unedited screenshot contact sheets."""
import argparse
import html
import json
import shutil
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from types import SimpleNamespace
from playwright.sync_api import sync_playwright
from check_stage8b import ROOT, Review

SOURCES=['game/artifacts/stage8b-economy','game/artifacts/stage8b-capture','game/artifacts/stage8b-roundtrip','game/artifacts/stage8b-migration','game/artifacts/stage8b-release','game/artifacts/stage8b-custom','game/artifacts/stage8b-photo']
SCREENS={
 '8b1':('8b1-era0-ja-1920','8b-1：稼ぎの統合モデル',[
  ('desktop-before','desktop-before','パーツを増やす前'),('desktop-after','desktop-after','制作したパーツを採用した後'),('producer-breakdown','producer-breakdown','毎秒の内訳')]),
 '8b2':('8b2-era0-ja-1920','8b-2：実際に写っているパーツだけを数える',[
  ('capture-overlap','capture-overlap','窓が重なった状態の撮影'),('capture-evaluation','capture-evaluation','保存した写真の内容の評価')]),
 '8b3':('8b3-era2-ja-1920','8b-3：セットを作り直す周回と、次の世界の制作',[
  ('files-current-archive','files-versions','この版と旧バージョンのセット書類'),('production-note','production-note','最初から置かれている制作ノート.txt'),('desktop-editor','desktop-editor','世界3で開くエディタのアプリ'),('world4-crafting','world4-crafting','世界3で次の世界のパーツを制作'),('world4-ready','world4-ready','格納とスペックの進行条件'),('second-workshop-rebuild','second-workshop','2周目の世界2で今の版のセットを作り直す')]),
}

def main():
 a=argparse.ArgumentParser();a.add_argument('--source',action='append');a.add_argument('--output-dir',default='game/artifacts/stage8b');a.add_argument('--pr-dir',default='docs/reviews/stage8b');args=a.parse_args()
 out=ROOT/args.output_dir;out.mkdir(parents=True,exist_ok=True)
 cases={}
 for source in args.source or SOURCES:
  directory=ROOT/source
  for case in json.loads((directory/'summary.json').read_text())['cases']:
   assert case['status']=='passed',case['id']
   for screenshot in case['images']:shutil.copyfile(directory/screenshot['file'],out/screenshot['file'])
   cases[case['id']]=case
 assert not any(c['pageErrors'] or c['console'] or c['externalRequests'] for c in cases.values())
 review=Review(SimpleNamespace(output_dir=args.output_dir,resume=False),None);review.report={'cases':list(cases.values())};review.persist()
 pr=ROOT/args.pr_dir;pr.mkdir(parents=True,exist_ok=True)
 manifest=[]
 style='body{margin:24px;font:16px/1.4 sans-serif;background:#eee;color:#222}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 18px}.screens{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}figure{margin:0;background:#fff;border:1px solid #aaa}a{display:block}img{display:block;width:100%;height:auto}figcaption{padding:8px 10px;font-weight:bold}'
 for step,(identity,title,entries) in SCREENS.items():
  assert identity in cases,identity
  cards=[]
  for source_suffix,target_suffix,label in entries:
   source=identity+'-'+source_suffix+'.png';name=step+'-'+target_suffix+'.png'
   shutil.copyfile(out/source,pr/name)
   manifest.append({'step':step,'label':label,'file':str((pr/name).relative_to(ROOT)),'source':source,'case':identity})
   cards.append('<figure><a href="'+html.escape(source)+'"><img src="'+html.escape(source)+'"></a><figcaption>'+html.escape(label)+'</figcaption></figure>')
  note='日本語・1920×1080の一次スクリーンショットを、そのまま並べています。画像を押すと元の大きさで開きます。'
  (out/(step+'-contact.html')).write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><title>'+title+'</title><style>'+style+'</style><h1>'+title+'</h1><p>'+note+'</p><div class="screens">'+''.join(cards)+'</div></html>')
 (out/'primary-screenshots.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 class QuietHandler(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(out)))
 thread=Thread(target=server.serve_forever,daemon=True);thread.start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1600,'height':1080},device_scale_factor=1)
   for step in SCREENS:
    page.goto(f'http://127.0.0.1:{server.server_port}/{step}-contact.html');page.evaluate('document.fonts.ready');height=int(page.locator('.screens').evaluate('node=>node.getBoundingClientRect().bottom')+25);page.set_viewport_size({'width':1600,'height':height});page.screenshot(path=str(out/(step+'-contact.png')),full_page=True)
   browser.close()
 finally:server.shutdown();server.server_close()
 with zipfile.ZipFile(out/'stage8b-screens.zip','w',zipfile.ZIP_DEFLATED) as archive:
  files=['index.html','8b1.html','8b2.html','8b3.html','summary.json','primary-screenshots.json']
  files.extend(step+suffix for step in SCREENS for suffix in ['-contact.html','-contact.png'])
  files.extend(s['file'] for c in cases.values() for s in c['images'])
  for file in dict.fromkeys(files):archive.write(out/file,file)
 print(json.dumps({key:review.report[key] for key in ['passed','failed','pageErrors','externalRequests','console']},ensure_ascii=False))
 print(str(out/'index.html'));print(str(out/'stage8b-screens.zip'))

if __name__=='__main__':main()
