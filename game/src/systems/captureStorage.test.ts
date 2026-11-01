import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { captureStore, CAPTURE_PREFIX } from '../platform/captures';
import type { SaveStorage } from '../platform/storage';
import { createFixture } from './fixtures';
import { actDesktop,advanceDesktopTime,focusWindow,takeScreenshot } from './desktop';
import { decodeCapture,encodeCapture } from './desktopState';
import { isCaptureScene,projectCapture,readCapture } from './captureScene';
import { clearGame,decodeSave,encodeSave,loadGame,SAVE_KEYS,saveGame } from './save';
import { isGameState } from './state';
import { desktopFiles } from './desktopFiles';
import { createI18n } from '../content/i18n';
import { actKumiki,paintDrawing,targetFor } from './kumiki';
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
  expect(scene.version).toBe(4);expect(scene).not.toHaveProperty('schemaVersion');expect(scene).not.toHaveProperty('persistent');
  expect(scene).not.toHaveProperty('products');expect(scene).not.toHaveProperty('guideArchive');expect(scene.editor.picture).not.toHaveProperty('rewarded');
  expect(scene.home.rows.length).toBeLessThanOrEqual(4);expect(scene.home.history.length).toBeLessThanOrEqual(4);
  const source=structuredClone(s);source.persistent.screenshots=[];
  const before=projectCapture(source,'ja');source.persistent.products.push(...Array(40).fill(source.persistent.products[0]!));source.persistent.guideArchive.push(...Array(100).fill({kind:'seed',id:'intro',version:'v0.1'}));
  expect(projectCapture(source,'ja')).toEqual(before);
 });
 it('場面の検査はゲームの版やアプリ購入の順序を参照せず、未知の場面形式と壊れた画素は拒む',()=>{
  const scene=projectCapture(createFixture('desktop-mail',now)!,'ja');scene.desktop.apps.reverse();
  const original=[...BALANCE.w3.apps];
  try{
   (BALANCE.w3.apps as unknown as unknown[]).splice(1,0,{id:'future-sort',cost:1});
   expect(isCaptureScene(scene)).toBe(true);
   expect(readCapture({id:1,at:now,language:'ja',data:encodeCapture(scene)})).toEqual(scene);
  }finally{(BALANCE.w3.apps as unknown as unknown[]).splice(0,BALANCE.w3.apps.length,...original);}
  expect(isCaptureScene({...scene,version:999})).toBe(false);
  expect(isCaptureScene({...scene,desktop:{...scene.desktop,notice:9999999}})).toBe(false);
  const bad=structuredClone(scene);bad.editor.picture!.frames[0]![0]=999;expect(isCaptureScene(bad)).toBe(false);
 });
 it('実際の第6版の2枚入りセーブを移行し、資源・製品・窓・撮影時の本文とパレットを保つ',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v6-two-shots.json.gz',import.meta.url))).toString();
  const old=JSON.parse(raw),s=decodeSave(raw);
  expect(s.schemaVersion).toBe(10);expect(s.resources).toEqual(old.resources);expect(s.persistent.products).toEqual(old.persistent.products);expect(s.run.desktop.screen).toEqual({width:800,height:600});expect(s.run.desktop.windows.note.open).toBe(old.run.desktop.windows.note.open);
  expect(s.persistent.screenshots).toHaveLength(2);
  const oldFrame=decodeCapture(old.persistent.screenshots[0].data) as typeof s;
  const scene=readCapture(s.persistent.screenshots[0]!);expect(scene.note).toBe(oldFrame.persistent.productionNote);expect(scene.home.design).toEqual(oldFrame.run.kumiki.design);
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
 it('Tesseraのエクスポートで過去の撮影を複製せず、元の絵や資源も書き換えない',()=>{
  let source=shotState();const d=source.run.kumiki.drawings.folder!,target=targetFor(source,'folder',d.size);
  for(const color of new Set(target.filter(c=>c>=0)))source=paintDrawing(source,'folder',target.flatMap((c,i)=>c===color?[i]:[]),color);
  const original=encodeSave(source),next=actKumiki(source,{type:'export'},now);
  expect(next.persistent.screenshots).toBe(source.persistent.screenshots);
  expect(next.run.kumiki.drawings.folder!.exported).toBe(true);expect(source.run.kumiki.drawings.folder!.exported).toBe(false);
  expect(encodeSave(source)).toBe(original);
 });
 it('場面の外部参照は主データの版の移行より先に復元し、版が一致する場合だけに限定しない',()=>{
  const target=disk();saveGame(target.storage,shotState(),now);
  const stored=JSON.parse(target.storage.getItem(SAVE_KEYS.primary)!);
  // Emulate a lower game schema with the already-versioned scene reference envelope.
  stored.schemaVersion=6;
  const restored=decodeSave(JSON.stringify(stored),ref=>captureStore(target.storage).get(ref));
  expect(restored.schemaVersion).toBe(10);expect(readCapture(restored.persistent.screenshots[0]!).version).toBe(4);
 });
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
describe('小さな指摘への対応',()=>{
 it('描き直し対象を最近のものから外して順に回し、3人の差出人を使う',()=>{
  let s=createFixture('desktop-files',now)!;
  // Two already-exported current icons give the request generator multiple eligible targets.
  s.run.kumiki.exports=s.persistent.products[0]!.exports;
  const targets:string[]=[],senders:string[]=[];
  for(let i=0;i<12;i++){
   s=advanceDesktopTime(s,240000,now+i*240000);const f=s.run.desktop.feedback.at(-1)!;if(f.kind==='redraw')targets.push(f.target);senders.push(f.sender);
   s.run.desktop.feedback=s.run.desktop.feedback.map(f=>({...f,completedAt:now+i*240000}));
  }
  expect(targets[0]).not.toBe(targets[1]);expect(new Set(senders).size).toBe(3);
 });
 it('撮影の依頼から最小化・最大化・閉じた状態でも2つの窓を見える位置に出す',()=>{
  let s=createFixture('desktop-mail',now)!;const request=s.run.desktop.feedback.find(f=>f.kind==='screenshot')!;
  s=actDesktop(s,{type:'maximize',app:'tessera'},now);s=actDesktop(s,{type:'close',app:'note'},now);
  s=actDesktop(s,{type:'fix',id:request.id},now);expect(s.run.desktop.windows.tessera.open).toBe(true);expect(s.run.desktop.windows.tessera.maximized).toBe(false);expect(s.run.desktop.windows.note.open).toBe(true);expect(s.run.desktop.windows.note.minimized).toBe(false);expect(s.run.desktop.active).toBe('note');
  expect(s.run.desktop.windows.note.x).toBeGreaterThanOrEqual(s.run.desktop.windows.tessera.x+s.run.desktop.windows.tessera.width/2);
 });
 it('ホームとスケッチは実際の編集で日時を更新し、フォルダーは中身の最新日時を使い、文書名をそろえる',()=>{
  let s=createFixture('desktop-files',now)!;
  s=actKumiki(s,{type:'design',id:'primary',design:{color:'#d0523a',radius:0,textSize:'medium',shadow:false}},now+1);
  s=actKumiki(s,{type:'paint',id:'free',cells:[0],color:2,frame:0,mirror:false},now+2);
  s=takeScreenshot(s,now+3,'ja');const files=desktopFiles(s,createI18n('ja'),'root');
  expect(files.find(f=>f.id==='home')!.at).toBe(now+1);expect(files.find(f=>f.id==='sketch')!.at).toBe(now+2);expect(files.find(f=>f.id==='screenshots')!.at).toBe(now+3);
  expect(files.find(f=>f.id==='exports')!.at).toBe(Math.max(...s.persistent.products.flatMap(p=>p.exports).map(w=>w.at)));
  for(const lang of ['ja','en'])expect(createI18n(lang).t('files.home')).toBe(createI18n(lang).t('k.home'));
 });
});
