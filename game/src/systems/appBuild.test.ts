import { BALANCE } from '../config/balance';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,it,expect } from 'vitest';
import { createFixture } from './fixtures';
import { actAppBuild, hasAppPart, functionalApp, missingConditionParts, appLayoutBonus } from './appBuild';
import { BUILDABLE_APPS, allAppParts, changePart, fitAppLayout, overlap, readableText, recommendedLayout, validLayout } from './appLayout';
import { actDesktop, buyDesktopApp, desktopConditions, focusWindow, takeScreenshot } from './desktop';
import { jobRate } from './desktopJobs';
import { createI18n } from '../content/i18n';
import { decodeSave, encodeSave } from './save';
import { projectCapture,readCapture,restoreScene,isCaptureScene } from './captureScene';
import { enterKumiki, exportKumiki, paintDrawing, prepareDrawing, targetFor, completeDrawing } from './kumiki';
import { createSeedVersion } from './seed';
import { paletteFor } from '../content/kumikiArt';
const now=1800000000000;
const ready=()=>createFixture('desktop-ready',now)!;
function checkLayout(layout:ReturnType<typeof recommendedLayout>){
 expect(layout.parts.every(p=>p.x>=0&&p.y>=0&&p.x+p.width<=layout.width&&p.y+p.height<=layout.height)).toBe(true);
 for(const a of layout.parts)for(const b of layout.parts)if(a!==b)expect(overlap(a,b),`${a.id}/${b.id}`).toBe(false);
}
describe('段階6.2：アプリの組み立てと詰みの防止',()=>{
 it('購入は空のひな型だけ。作って置いて入れるまで操作を解放せず、二重課金しない',()=>{
  let s=createFixture('desktop-early',now)!,before=s.resources.pixels;s=buyDesktopApp(s,'files');expect(s.resources.pixels).toBe(before-300000);expect(s.run.desktop.apps).not.toContain('files');expect(s.run.desktop.projects.files!.draft.parts).toEqual([]);expect(buyDesktopApp(s,'files')).toBe(s);
  s=actAppBuild(s,{type:'app-craft',app:'files',part:'list'});expect(hasAppPart(s,'files','list')).toBe(false);expect(s.run.desktop.projects.files!.draft.parts).toHaveLength(0);
  s=actAppBuild(s,{type:'app-place',app:'files',part:'list'});expect(hasAppPart(s,'files','list')).toBe(false);s=actAppBuild(s,{type:'app-install',app:'files'});expect(hasAppPart(s,'files','list')).toBe(true);expect(s.resources.pixels).toBe(before-300000);
 });
 it('小さな機能は作ったパーツを置いて入れて初めて働く。編集中のアプリとジョブは元のまま',()=>{
  let s=createFixture('desktop-jobs',now)!;s=buyDesktopApp(s,'manager');s=buyDesktopApp(s,'search');const rate=jobRate(s,'files');expect(hasAppPart(s,'files','search')).toBe(false);
  s=actAppBuild(s,{type:'app-recommend',app:'files'});expect(jobRate(s,'files')).toBe(rate);s=actAppBuild(s,{type:'app-install',app:'files'});expect(jobRate(s,'files')).toBeCloseTo(rate*1.25);
  const installed=s.run.desktop.projects.files!.installed,working=jobRate(s,'files');s=actAppBuild(s,{type:'app-remove',app:'files',part:'search'});expect(s.run.desktop.projects.files!.installed).toEqual(installed);expect(jobRate(s,'files')).toBe(working);
 });
 it('追加で置くパーツは既存の配置を動かさず、指定位置が重なる場合は追加しない',()=>{
  let s=createFixture('desktop-early',now)!;s=buyDesktopApp(s,'files');s=actAppBuild(s,{type:'app-craft',app:'files',part:'navigation'});s=actAppBuild(s,{type:'app-place',app:'files',part:'navigation'});const before=structuredClone(s.run.desktop.projects.files!.draft.parts[0]!);
  s=actAppBuild(s,{type:'app-craft',app:'files',part:'list'});const same=actAppBuild(s,{type:'app-place',app:'files',part:'list',rect:{x:0,y:0,width:224,height:64}});expect(same).toBe(s);s=actAppBuild(s,{type:'app-place',app:'files',part:'list'});expect(s.run.desktop.projects.files!.draft.parts[0]).toEqual(before);checkLayout(s.run.desktop.projects.files!.draft);
 });
 it('表示言語で測った幅に合わせて編集中の配置だけを広げ、フォント変更の履歴を分割しない',()=>{
  let s=ready();const original=s.run.desktop.projects.files!.installed;s=actAppBuild(s,{type:'app-change',app:'files',part:'list',patch:{fontSize:16}});const histories=s.run.desktop.projects.files!.undo.length;
  s=actAppBuild(s,{type:'app-fit',app:'files',metrics:{list:{width:520,height:80}}});expect(s.run.desktop.projects.files!.draft.parts.find(p=>p.id==='list')!.width).toBeGreaterThanOrEqual(520);expect(s.run.desktop.projects.files!.installed).toEqual(original);expect(s.run.desktop.projects.files!.undo).toHaveLength(histories);s=actAppBuild(s,{type:'app-undo',app:'files'});expect(s.run.desktop.projects.files!.draft).toEqual(original);
 });
 it('未購入の追加機能を作る操作や、ひな型のないアプリの組み立てを拒む',()=>{
  const s=createFixture('desktop-early',now)!;expect(actAppBuild(s,{type:'app-recommend',app:'files'})).toBe(s);let next=buyDesktopApp(s,'files');expect(actAppBuild(next,{type:'app-craft',app:'files',part:'search'})).toBe(next);expect(actAppBuild(next,{type:'app-place',app:'files',part:'search'})).toBe(next);
 });
 it('窓外・重なり・最小寸法未満・不正な数値は拒み、格子へそろえ、元の配置を保つ',()=>{
  const layout=recommendedLayout('files',allAppParts('files')),part=layout.parts[0]!,other=layout.parts[1]!;
  for(const patch of [{x:-8},{y:-8},{x:layout.width},{width:8},{height:8},{x:NaN},{x:Infinity},{x:other.x,y:other.y}])expect(changePart(layout,part.id,patch)).toBe(layout);
  expect(changePart(layout,part.id,{color:'#008080'}).parts[0]!.color).toBe('#008080');checkLayout(layout);
 });
 it('8アプリの全パーツを狭い窓・段0〜2・長い文字へ再配置しても、外や重なりを作らない',()=>{
  for(const app of BUILDABLE_APPS)for(const [width,height] of [[280,180],[440,240],[784,540],[1008,706],[1350,696]])for(const extra of [0,120,220]){
   const ids=allAppParts(app),metrics=Object.fromEntries(ids.map(id=>[id,{width:112+extra,height:32}]));const initial=recommendedLayout(app,ids);let layout=fitAppLayout(initial,width!,height!,metrics);checkLayout(layout);expect(validLayout(layout,app)).toBe(true);
   for(const [w,h] of [[784,540],[1008,706],[1350,696],[440,240]]){layout=fitAppLayout(layout,w!,h!,metrics);checkLayout(layout);}
  }
 });
 it('選べるすべての背景色で文字を自動選択し、4.5以上のコントラストを確保する',()=>{
  for(const color of paletteFor(3)){
   const values=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4),l=values[0]!*.2126+values[1]!*.7152+values[2]!*.0722;
   expect(readableText(color)==='#000000'?(l+.05)/.05:1.05/(l+.05)).toBeGreaterThanOrEqual(4.5);
  }
 });
 it('全パーツを外して入れても窓の外枠・座標は保持。条件は使える機能で判定し、おすすめで復旧する',()=>{
  let s=ready();const windows=structuredClone(s.run.desktop.windows);
  for(const app of BUILDABLE_APPS){for(const id of allAppParts(app))s=actAppBuild(s,{type:'app-remove',app,part:id});s=actAppBuild(s,{type:'app-install',app});expect(functionalApp(s,app)).toBe(false);}
  expect(s.run.desktop.windows).toEqual(windows);expect(desktopConditions(s)[0]).toBe(false);
  for(const app of BUILDABLE_APPS){s=actAppBuild(s,{type:'app-recommend',app});s=actAppBuild(s,{type:'app-install',app});expect(functionalApp(s,app)).toBe(true);s=focusWindow(s,app);}
  expect(desktopConditions(s)[0]).toBe(true);
 });
 it('並べ替えを外すと依頼を完了できず、直す操作はアプリの書類を開き、おすすめで直せる',()=>{
  let s=ready();s.run.desktop.feedback=[{id:1,kind:'sort',sender:'hikari',target:'',baseline:[],baselineColor:'#000000',at:now,completedAt:null}];s.run.desktop.feedbackSerial=1;s.run.desktop.notice=1;
  s=actAppBuild(s,{type:'app-remove',app:'files',part:'sort'});s=actAppBuild(s,{type:'app-install',app:'files'});s=actDesktop(s,{type:'sort',by:'date'},now);expect(s.run.desktop.feedback[0]!.completedAt).toBeNull();s=actDesktop(s,{type:'fix',id:1},now);expect(s.run.desktop.editingApp).toBe('files');expect(s.run.desktop.active).toBe('tessera');
  s=actAppBuild(s,{type:'app-recommend',app:'files'});s=actAppBuild(s,{type:'app-install',app:'files'});s=actDesktop(s,{type:'sort',by:'date'},now);expect(s.run.desktop.feedback[0]!.completedAt).toBe(now);
 });
 it('v1.0の壁紙・定期撮影条件も必要な機能が使えることを確かめ、失ったパーツを案内する',()=>{
  let s=ready();expect(desktopConditions(s).slice(3)).toEqual([true,true]);s=actAppBuild(s,{type:'app-remove',app:'photo',part:'image'});s=actAppBuild(s,{type:'app-install',app:'photo'});s=actAppBuild(s,{type:'app-remove',app:'terminal',part:'commands'});s=actAppBuild(s,{type:'app-install',app:'terminal'});const checks=desktopConditions(s);expect(checks.slice(3)).toEqual([false,false]);expect(missingConditionParts(s,checks)).toEqual(expect.arrayContaining([{app:'photo',part:'image'},{app:'terminal',part:'commands'}]));
  for(const app of ['photo','terminal'] as const){s=actAppBuild(s,{type:'app-recommend',app});s=actAppBuild(s,{type:'app-install',app});}expect(desktopConditions(s).slice(3)).toEqual([true,true]);
 });
 it('元に戻す・やり直す・前に入れた形へ戻す操作を保存し、編集中と稼働中を分離する',()=>{
  let s=ready();const installed=s.run.desktop.projects.files!.installed;s=actAppBuild(s,{type:'app-remove',app:'files',part:'list'});s=decodeSave(encodeSave(s));expect(s.run.desktop.projects.files!.installed).toEqual(installed);
  s=actAppBuild(s,{type:'app-undo',app:'files'});expect(s.run.desktop.projects.files!.draft).toEqual(installed);s=actAppBuild(s,{type:'app-redo',app:'files'});expect(s.run.desktop.projects.files!.draft.parts.some(p=>p.id==='list')).toBe(false);s=actAppBuild(s,{type:'app-revert',app:'files'});expect(s.run.desktop.projects.files!.draft).toEqual(installed);
 });
 it('実際の第10版を追加料金なく移行し、購入済みアプリ・12機能・撮影を失わない',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v10-two-shots.json.gz',import.meta.url))).toString(),old=JSON.parse(raw),s=decodeSave(raw);
  expect(s.schemaVersion).toBe(13);expect(s.resources.tokens).toBe(old.resources.tokens);expect(s.resources.dollars).toBe(old.resources.dollars);expect(s.resources.pixels).toBeGreaterThanOrEqual(old.resources.pixels);expect(s.persistent.screenshots).toEqual(old.persistent.screenshots);expect(s.run.desktop.apps).toEqual(old.run.desktop.apps);
  for(const app of BUILDABLE_APPS){expect(functionalApp(s,app)).toBe(true);expect(validLayout(s.run.desktop.projects[app]!.installed,app)).toBe(true);}
  for(const id of ['sort','search','large'])expect(hasAppPart(s,'files',id)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('壊れた配置はそのアプリだけ復旧し、資源・他の配置・写真・ノートを失わない',()=>{
  const s=ready();s.persistent.productionNote='残す';const raw=JSON.parse(encodeSave(s));raw.run.desktop.projects.files.draft.parts[0].x=99999;
  const restored=decodeSave(JSON.stringify(raw));expect(restored.resources).toEqual(s.resources);expect(restored.persistent).toEqual(s.persistent);expect(restored.run.desktop.projects.photo).toEqual(s.run.desktop.projects.photo);expect(validLayout(restored.run.desktop.projects.files!.draft,'files')).toBe(true);
  for(const broken of [null,{}, {crafted:['unknown'],draft:{}}, {...raw.run.desktop.projects.files,undo:[{}]}]){raw.run.desktop.projects.files=broken;expect(()=>decodeSave(JSON.stringify(raw))).not.toThrow();}
 });
 it('切り抜き済みの写真でパーツを外しても、残る明るさの操作と依頼を妨げない',()=>{
  let s=ready();s.run.desktop.photo.crop=15;s.run.desktop.feedback=[{id:1,kind:'bright',sender:'hikari',target:'',baseline:[],baselineColor:'#000000',at:now,completedAt:null}];s.run.desktop.feedbackSerial=1;s.run.desktop.notice=1;
  s=actAppBuild(s,{type:'app-remove',app:'photo',part:'crop'});s=actAppBuild(s,{type:'app-install',app:'photo'});s=actDesktop(s,{type:'photo',edit:{brightness:1.2}},now);expect(s.run.desktop.photo.brightness).toBe(1.2);s=actDesktop(s,{type:'wallpaper'},now);expect(s.run.desktop.feedback[0]!.completedAt).toBe(now);
 });
 it('自動仕分けの取得でフォルダーパーツを作り、置いたときだけ切り替えられる。後から買うひな型にも残す',()=>{
  let s=ready();s.run.desktop.upgrades=s.run.desktop.upgrades.filter(id=>id!=='folders');s.run.desktop.projects.mail!.crafted=s.run.desktop.projects.mail!.crafted.filter(id=>id!=='folders');s=actAppBuild(s,{type:'app-remove',app:'mail',part:'folders'});s=actAppBuild(s,{type:'app-install',app:'mail'});s=actDesktop(s,{type:'skill',id:'sortMail'},now);expect(s.run.desktop.projects.mail!.crafted).toContain('folders');expect(hasAppPart(s,'mail','folders')).toBe(false);expect(actDesktop(s,{type:'mail-folder',folder:'completed'},now)).toBe(s);
  s=actAppBuild(s,{type:'app-recommend',app:'mail'});s=actAppBuild(s,{type:'app-install',app:'mail'});s=actDesktop(s,{type:'mail-folder',folder:'completed'},now);expect(s.run.desktop.mailFolder).toBe('completed');
  let early=createFixture('desktop-early',now)!;early.resources.tokens=100;early=actDesktop(early,{type:'skill',id:'sortMail'},now);early=buyDesktopApp(early,'files');early=buyDesktopApp(early,'sort');early=buyDesktopApp(early,'mail');expect(early.run.desktop.projects.mail!.crafted).toContain('folders');
 });
 it('外観パーツを外しても、別に置いたアイコンサイズのパーツは働く',()=>{
  let s=ready();s=actAppBuild(s,{type:'app-remove',app:'theme',part:'appearance'});s=actAppBuild(s,{type:'app-install',app:'theme'});s=actDesktop(s,{type:'theme',iconSize:64},now);expect(s.persistent.desktopPrefs.iconSize).toBe(64);expect(actDesktop(s,{type:'theme',mode:'dark'},now)).toBe(s);
 });
 it('購入済みの自動仕分けで使っていたメールのフォルダーも旧データから引き継ぐ',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync(new URL('./testdata/v10-two-shots.json.gz',import.meta.url))).toString());raw.run.desktop.upgrades=raw.run.desktop.upgrades.filter((id:string)=>id!=='folders');raw.persistent.desktopPrefs.skills.push('sortMail');const s=decodeSave(JSON.stringify(raw));expect(s.run.desktop.projects.mail!.installed!.parts.some(p=>p.id==='folders')).toBe(true);expect(s.resources.tokens).toBe(raw.resources.tokens);expect(s.resources.dollars).toBe(raw.resources.dollars);expect(s.resources.pixels).toBeGreaterThanOrEqual(raw.resources.pixels);
 });
 it('行の高さを小さくした一覧では、増えた表示行も撮影に残し、40行の上限を保つ',()=>{
  const s=createFixture('desktop-stage2',now)!;s.run.desktop.windows.files={...s.run.desktop.windows.files,x:0,y:0,open:true,minimized:false,height:728};s.run.desktop.fileFolder='screenshots';s.run.desktop.projects.files!.installed!.parts.find(p=>p.id==='list')!.rowHeight=20;const shot=s.persistent.screenshots[0]!;s.persistent.screenshots=Array.from({length:50},(_,i)=>({...shot,id:i+1}));s.run.desktop.fileSelection='shot:50';const scene=projectCapture(s,'ja');expect(scene.files.length).toBeGreaterThan(25);expect(scene.files.length).toBeLessThanOrEqual(40);expect(scene.files.some(f=>f.id==='shot:50')).toBe(true);expect(isCaptureScene(scene)).toBe(true);
 });
 it('場面形式6の読み取りは将来のゲームの寸法調整に依存しない',()=>{
  const scene=projectCapture(ready(),'ja'),settings=BALANCE.appBuild as unknown as {controlMinWidth:number},old=settings.controlMinWidth;
  try{settings.controlMinWidth=9999;expect(isCaptureScene(scene)).toBe(true);}finally{settings.controlMinWidth=old;}
 });
 it('撮影した場面・アプリの配置・稼働中の色を、後の編集と外観変更から独立して保つ',()=>{
  let s=ready();s.run.kumiki.workspace='compose';s=focusWindow(s,'files');s=actAppBuild(s,{type:'app-edit',app:'files'});s=takeScreenshot(s,now,'ja');const shot=s.persistent.screenshots.at(-1)!,scene=readCapture(shot),frozen=shot.data;s=actAppBuild(s,{type:'app-remove',app:'files',part:'list'});s=actAppBuild(s,{type:'app-install',app:'files'});
  expect(scene.version).toBe(8);const restored=restoreScene(shot,s.persistent.screenshots);expect(restored.run.kumiki.workspace).toBe('compose');expect(restored.run.desktop.projects.files!.installed!.parts.some(p=>p.id==='list')).toBe(true);expect(shot.data).toBe(frozen);expect(projectCapture(restored,'ja').editingApp).toBe('files');
 });
 it('配置ボーナスは色の好みで変わらず、端にそろっていない配置には付けない',()=>{
  const s=ready(),before=appLayoutBonus(s);for(const p of Object.values(s.run.desktop.projects))for(const part of p!.installed!.parts)part.color='#008080';expect(appLayoutBonus(s)).toBe(before);
  s.run.desktop.projects.files!.installed={width:640,height:416,parts:[{id:'list',x:8,y:8,width:112,height:64,color:'#ffffff',fontSize:12,rowHeight:24,striped:false}]};expect(appLayoutBonus(s)).toBeLessThan(before);
 });
});
describe('先のレビューの回帰',()=>{
 it('全消去したフォルダを再出荷しても標準テンプレートに戻り、次のアイコンへ進める',()=>{
  let s=createFixture('release-ready',now)!;s=paintDrawing(s,'folder',Array.from({length:256},(_,i)=>i),-1);s=exportKumiki(s,now);expect(s.persistent.artwork.icons.folder!.frames[0]!.every(c=>c===-1)).toBe(true);
  s=enterKumiki(createSeedVersion(s,'v1',now));const target=targetFor(s,'folder',16);expect(target.some(c=>c>=0)).toBe(true);for(const color of new Set(target.filter(c=>c>=0)))s=paintDrawing(s,'folder',target.flatMap((c,i)=>c===color?[i]:[]),color);expect(completeDrawing(s,'folder')).toBe(true);s=exportKumiki(s,now);s.run.kumiki.built.push('button');s=prepareDrawing(s,'bin');expect(s.run.kumiki.drawings.bin).toBeDefined();
 });
 it('制作ノートの新しい導入を日本語・英語の両方で出す',()=>{
  expect(createI18n('ja').t('intro.note')).toContain('ボタン1つの画面までは、もうできている。');expect(createI18n('ja').t('intro.note')).toContain('お客さんに使ってもらう');expect(createI18n('en').t('intro.note')).toContain('already finished');
 });
});
