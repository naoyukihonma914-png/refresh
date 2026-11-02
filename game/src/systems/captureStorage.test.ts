import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyCapturePreview } from '../worlds/LegacyCapturePreview';
import { createI18n } from '../content/i18n';
import { isProductRecord, normalizeArchivedProduct } from './releaseState';
import { BALANCE } from '../config/balance';
import { captureStore, CAPTURE_PREFIX } from '../platform/captures';
import type { SaveStorage } from '../platform/storage';
import { createFixture } from './fixtures';
import { actDesktop,focusWindow,takeScreenshot } from './desktop';
import { decodeCapture,encodeCapture } from './desktopState';
import { isCaptureScene,projectCapture,readCapture } from './captureScene';
import { clearGame,decodeSave,encodeSave,loadGame,SAVE_KEYS,saveGame } from './save';
import { isGameState } from './state';
import { actWorkshop } from './workshop';
const now=1800000000000;
function disk(limit=Infinity){
 const entries=new Map<string,string>(),writes:string[]=[],reads:string[]=[];
 const storage:SaveStorage={getItem:key=>{reads.push(key);return entries.get(key)??null;},removeItem:key=>{entries.delete(key);},setItem:(key,value)=>{const chars=[...entries].filter(([k])=>k!==key).reduce((n,[k,v])=>n+k.length+v.length,key.length+value.length);if(chars*2>limit)throw new Error('Quota exceeded');writes.push(key);entries.set(key,value);}};
 return {entries,writes,reads,storage};
}
const shotState=()=>takeScreenshot(focusWindow(createFixture('desktop-files',now)!,'note'),now,'ja');
describe('場面の保存形式と独立した記録',()=>{
 it('表示に必要な場面だけを持ち、製品・報酬台帳・過去の会話・全生成履歴をコピーしない',()=>{
  const s=shotState(),scene=readCapture(s.persistent.screenshots[0]!);
  expect(scene.version).toBe(10);expect(scene).not.toHaveProperty('schemaVersion');expect(scene).not.toHaveProperty('persistent');
  expect(scene).not.toHaveProperty('products');expect(scene).not.toHaveProperty('guideArchive');expect(scene).not.toHaveProperty('editor');expect(scene).not.toHaveProperty('home');expect(scene).not.toHaveProperty('wallpaper');
  expect(scene.workshop).toEqual(s.run.workshop);expect(JSON.stringify(scene)).not.toContain('frames');
  const source=structuredClone(s);source.persistent.screenshots=[];
  const before=projectCapture(source,'ja');source.persistent.products.push(...Array(40).fill(source.persistent.products[0]!));source.persistent.guideArchive.push(...Array(100).fill({kind:'seed',id:'intro',version:'v0.1'}));
  expect(projectCapture(source,'ja')).toEqual(before);
 });
 it('場面の検査はゲームの版やアプリ購入の順序を参照せず、未知の場面形式と壊れたパーツは拒む',()=>{
  const scene=projectCapture(createFixture('desktop-mail',now)!,'ja');scene.desktop.apps.reverse();
  const original=[...BALANCE.w3.apps];
  try{
   (BALANCE.w3.apps as unknown as unknown[]).splice(1,0,{id:'future-sort',cost:1});
   expect(isCaptureScene(scene)).toBe(true);
   expect(readCapture({id:1,at:now,language:'ja',data:encodeCapture(scene)})).toEqual(scene);
  }finally{(BALANCE.w3.apps as unknown as unknown[]).splice(0,BALANCE.w3.apps.length,...original);}
  expect(isCaptureScene({...scene,version:999})).toBe(false);
  expect(isCaptureScene({...scene,desktop:{...scene.desktop,notice:9999999}})).toBe(false);
  const bad=structuredClone(scene);bad.workshop.parts['common-frame']!.rect.x=-1;expect(isCaptureScene(bad)).toBe(false);
 });
 it('実際の第6版の2枚入りセーブを移行し、資源・製品・窓・撮影時の本文とパレットを保つ',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v6-two-shots.json.gz',import.meta.url))).toString();
  const old=JSON.parse(raw),s=decodeSave(raw);
  expect(s.schemaVersion).toBe(14);expect(s.resources.tokens).toBe(old.resources.tokens);expect(s.resources.dollars).toBe(old.resources.dollars);expect(s.resources.pixels).toBeGreaterThanOrEqual(old.resources.pixels);expect(s.persistent.products.map(p=>[p.id,p.revenue,p.generatedPixels])).toEqual(old.persistent.products.map((p:{id:number;revenue:number;generatedPixels:number})=>[p.id,p.revenue,p.generatedPixels]));expect(s.run.desktop.screen).toEqual({width:800,height:600});expect(s.run.desktop.windows.note.open).toBe(old.run.desktop.windows.note.open);
  expect(s.persistent.screenshots).toHaveLength(2);
  const oldFrame=decodeCapture(old.persistent.screenshots[0].data) as typeof s;
  const scene=readCapture(s.persistent.screenshots[0]!);expect(scene.note).toBe(oldFrame.persistent.productionNote);expect(scene).not.toHaveProperty('home');expect(scene).not.toHaveProperty('editor');
  expect(scene.desktop.windows).toEqual(oldFrame.run.desktop.windows);expect(scene.palette).toHaveLength(256);
  expect(s.run.desktop.feedback.every(f=>f.sender==='hikari')).toBe(true);
  const target=disk();expect(saveGame(target.storage,s,now).kind).toBe('saved');expect(loadGame(target.storage).kind).toBe('loaded');
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('保存本体と予備には参照だけを置き、通常保存では画像の書き直しと読み直しをしない',()=>{
  const s=shotState(),target=disk();expect(saveGame(target.storage,s,now).kind).toBe('saved');
  const core=JSON.parse(target.storage.getItem(SAVE_KEYS.primary)!);expect(core.persistent.screenshots[0].data).toBeUndefined();expect(core.persistent.screenshots[0].sceneRef).toMatch(/^refresh.capture\./);
  target.writes.length=0;target.reads.length=0;expect(saveGame(target.storage,s,now+1).kind).toBe('saved');
  expect(target.writes).toEqual([SAVE_KEYS.backup,SAVE_KEYS.primary]);expect(target.reads.filter(k=>k.startsWith(CAPTURE_PREFIX)&&k!==CAPTURE_PREFIX+'index')).toEqual([]);
  const loaded=loadGame(target.storage);expect(loaded.kind).toBe('loaded');if(loaded.kind==='loaded')expect(loaded.state).toEqual({...s,lastSavedAt:now+1});
 });
 it('工房のエクスポートは過去の撮影を複製せず、凍結したパーツと資源を書き換えない',()=>{
  const source=shotState();source.run.workshop.parts['common-frame']!.exportedAt=null;
  const original=encodeSave(source),recording=source.persistent.screenshots[0]!.data,next=actWorkshop(source,{type:'export',part:'common-frame'},now);
  expect(next.persistent.screenshots).toBe(source.persistent.screenshots);
  expect(next.run.workshop.parts['common-frame']!.exportedAt).toBe(now);expect(source.run.workshop.parts['common-frame']!.exportedAt).toBeNull();
  expect(next.persistent.screenshots[0]!.data).toBe(recording);expect(encodeSave(source)).toBe(original);
 });
 it('場面の外部参照を単独で復元でき、同じ形式の読み取り専用文書になる',()=>{
  const target=disk(),s=shotState();saveGame(target.storage,s,now);
  const stored=JSON.parse(target.storage.getItem(SAVE_KEYS.primary)!);
  const reference=stored.persistent.screenshots[0];
  const restored={...reference,data:captureStore(target.storage).get(reference.sceneRef)};
  expect(readCapture(restored)).toEqual(readCapture(s.persistent.screenshots[0]!));
 });
 it('パーツ49個と毎回変わる累積記録があっても400枚を5MiBへ保存できる',()=>{
  let s=createFixture('desktop-files',now)!;s.persistent.specs.storage=3;
  for(let i=0;i<400;i++){s.run.desktop.cooldownMs=0;s.persistent.progress.counts.shots=i;s=takeScreenshot(s,now+i,'ja');}
  const target=disk(5*1024*1024);expect(saveGame(target.storage,s,now).kind).toBe('saved');
  const loaded=loadGame(target.storage);expect(loaded.kind).toBe('loaded');if(loaded.kind==='loaded')expect(readCapture(loaded.state.persistent.screenshots[399]!).workshop).toEqual(s.run.workshop);
 },45000);
 it('新しい画像の書き込みが途中で失敗しても元の記録を保ち、追加した未参照データだけを片付けて再試行できる',()=>{
  const target=disk(),s=shotState();saveGame(target.storage,s,now);const before=new Map(target.entries);
  let next=actDesktop(s,{type:'note',text:'新しい場面'},now+1);next.run.desktop.cooldownMs=0;next=takeScreenshot(next,now+1,'ja');
  const write=target.storage.setItem;let count=0;
  target.storage.setItem=(key,value)=>{if(key.startsWith(CAPTURE_PREFIX)&&++count===2)throw new Error('Quota exceeded');write(key,value);};
  expect(saveGame(target.storage,next,now+1).kind).toBe('failed');expect(target.entries).toEqual(before);
  target.storage.setItem=write;expect(saveGame(target.storage,next,now+1).kind).toBe('saved');expect(loadGame(target.storage).kind).toBe('loaded');
 });
 it('主データの書き込みだけが失敗しても元の予備と画像を戻し、両方の世代を保持する',()=>{
  const target=disk(),first=shotState();saveGame(target.storage,first,now);const s=actDesktop(first,{type:'note',text:'2世代目'},now+1);saveGame(target.storage,s,now+1);
  const before=new Map(target.entries);s.run.desktop.cooldownMs=0;const next=takeScreenshot(s,now+2,'ja');const write=target.storage.setItem;
  target.storage.setItem=(key,value)=>{if(key===SAVE_KEYS.primary)throw new Error('Quota');write(key,value);};
  expect(saveGame(target.storage,next,now+2).kind).toBe('failed');expect(target.entries).toEqual(before);target.storage.setItem=write;expect(loadGame(target.storage).kind).toBe('loaded');
 });
 it('全データの初期化では別保存した場面と共有データも取り除く',()=>{
  const target=disk();saveGame(target.storage,shotState(),now);expect(target.entries.size).toBeGreaterThan(2);
  expect(clearGame(target.storage)).toBe(true);expect(target.entries.size).toBe(0);expect(loadGame(target.storage).kind).toBe('empty');
 });
 it('最新の1枚の記録が失われたときは、その画像を含まない予備へ戻せる',()=>{
  const target=disk(),s=shotState();saveGame(target.storage,s,now);
  s.run.desktop.cooldownMs=0;const next=takeScreenshot(s,now+1,'ja');saveGame(target.storage,next,now+1);
  const ref=JSON.parse(target.storage.getItem(SAVE_KEYS.primary)!).persistent.screenshots[1].sceneRef;target.storage.removeItem(ref);
  const loaded=loadGame(target.storage);expect(loaded.kind).toBe('recovered');if(loaded.kind==='recovered')expect(loaded.state.persistent.screenshots).toHaveLength(1);
 });
 it('200枚・400枚をUTF-16で5MiBの保存領域に収め、本体と予備・エクスポート・取り込みを往復できる',()=>{
  for(const count of [200,400]){
   let s=createFixture('desktop-files',now)!;s.persistent.specs.storage=count===200?2:3;
   for(let i=0;i<count;i++){s.run.desktop.cooldownMs=0;s=actDesktop(s,{type:'note',text:`記録 ${i}`},now+i);s=takeScreenshot(s,now+i,'ja');}
   const target=disk(5*1024*1024);expect(saveGame(target.storage,s,now).kind).toBe('saved');expect(saveGame(target.storage,s,now+1).kind).toBe('saved');
   const loaded=loadGame(target.storage);expect(loaded.kind).toBe('loaded');if(loaded.kind==='loaded'){expect(loaded.state.persistent.screenshots).toHaveLength(count);expect(isGameState(loaded.state)).toBe(true);}
   const imported=decodeSave(encodeSave(s)),other=disk(5*1024*1024);expect(saveGame(other.storage,imported,now).kind).toBe('saved');expect(loadGame(other.storage).kind).toBe('loaded');
   expect(target.entries.size).toBeLessThan(count*4+40);
  }
 },15000);
});

describe('凍結した旧撮影の読み取り境界',()=>{
 it.each(['v7-two-shots','v8-two-shots','v9-two-shots','v10-two-shots','v11-home-controls','v12-progress'])('%sを現行カタログから独立して読み、古い編集状態を返さない',name=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/${name}.json.gz`,import.meta.url))).toString());
  const shots=raw.persistent.screenshots as import('./desktopState').Screenshot[];
  expect(shots.length).toBeGreaterThan(0);
  const original=[...BALANCE.w3.apps];
  try{
   (BALANCE.w3.apps as unknown as unknown[]).splice(0,BALANCE.w3.apps.length,{id:'new-catalog-only',cost:1});
   for(const shot of shots){
    const data=shot.data,source=decodeCapture(data);
    expect(isCaptureScene(source)).toBe(true);
    const scene=readCapture(shot);
    expect(scene.archived).toBe(true);expect(scene.note).toBe((source as {note:string}).note);
    expect(scene).not.toHaveProperty('home');expect(scene).not.toHaveProperty('editor');expect(scene).not.toHaveProperty('secretArt');
    expect(scene.files.every(file=>!Object.hasOwn(file,'picture'))).toBe(true);expect(shot.data).toBe(data);
   }
  }finally{(BALANCE.w3.apps as unknown as unknown[]).splice(0,BALANCE.w3.apps.length,...original);}
 });
 it('未知の版・壊れた旧画素・自分や未来を指す参照を拒む',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./testdata/v12-progress.json.gz',import.meta.url))).toString());
  const shot=raw.persistent.screenshots[0] as import('./desktopState').Screenshot;
  const legacy=decodeCapture(shot.data) as {version:number;editor:{picture:{frames:number[][]}}};
  expect(isCaptureScene({...legacy,version:999})).toBe(false);
  const broken=structuredClone(legacy);broken.editor.picture.frames[0]![0]=999;
  expect(isCaptureScene(broken)).toBe(false);
  const scene=projectCapture(createFixture('desktop-files',now)!,'ja');
  scene.view.photo.source='shot:2';
  expect(()=>readCapture({id:2,at:now,language:'ja',data:encodeCapture(scene)})).toThrow();
  scene.view.photo.source='coast';scene.files.push({id:'shot:2',name:'saved',kind:'shot',at:now,bytes:0,shotId:2});
  expect(()=>readCapture({id:2,at:now,language:'ja',data:encodeCapture(scene)})).toThrow();
 });
});

describe('製品と入れ子の撮影の静的表示',()=>{
 it('旧製品の未知の旧IDと売上を保ち、描画フレームとホーム配置を捨てる',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./testdata/v12-progress.json.gz',import.meta.url))).toString());
  const old=raw.persistent.products[0];old.screen.built=['retired-editor-item'];old.exports[0].id='retired-export-id';
  const product=normalizeArchivedProduct(old);
  expect(isProductRecord(product)).toBe(true);expect(product.revenue).toBe(old.revenue);expect(product.generatedPixels).toBe(old.generatedPixels);
  expect(product.screen.built).toEqual(['retired-editor-item']);expect(product.exports[0]!.id).toBe('retired-export-id');
  expect(product.screen).not.toHaveProperty('drawings');expect(product.screen).not.toHaveProperty('homeTheme');expect(product.screen).not.toHaveProperty('placed');
  expect(product.exports.every(work=>!Object.hasOwn(work,'frames'))).toBe(true);
 });
 it('同じ撮影が写真と壁紙の両方に入っても表示の展開を制限し、全記録を残す',()=>{
  const state=createFixture('desktop-files',now)!;state.run.desktop.windows.photo.open=true;state.run.desktop.windows.photo.minimized=false;
  const catalog:import('./desktopState').Screenshot[]=[];
  for(let id=1;id<=12;id++){
   const source=id===1?'coast':`shot:${id-1}`;
   state.run.desktop.photo={source,brightness:1,tone:0,crop:0};state.persistent.desktopPrefs.wallpaper={...state.run.desktop.photo};
   catalog.push({id,at:now+id,language:'ja',data:encodeCapture(projectCapture(state,'ja'))});
  }
  const before=catalog.map(shot=>shot.data),markup=renderToStaticMarkup(createElement(LegacyCapturePreview,{shot:catalog.at(-1)!,catalog,i18n:createI18n('ja')}));
  expect(markup.match(/data-preview-shot=/g)?.length).toBeLessThanOrEqual(2**BALANCE.w3.capturePreviewDepth-1);
  expect(markup).toContain('data-capture-reference=');expect(catalog.map(shot=>shot.data)).toEqual(before);
 });
});
