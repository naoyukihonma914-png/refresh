import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {partsForSet,type UiSetId} from '../content/workshopCatalog';
import {createFixture} from './fixtures';
import {actWorkshop} from './workshop';
import {enterDesktop} from './desktop';
import {actAppBuild,hasAppPart,ownAppBlueprint} from './appBuild';
import {adoptedPartIds,appIsOperational,getInstalledAppParts,installedAssembly,migrateAppAssemblies} from './appAssembly';
import {allAppParts,changePart,fitAppLayout,overlap,recommendedLayout,validLayout} from './appLayout';
import {decodeSave,encodeSave} from './save';
import {isGameState,type GameState} from './state';
const now=1_800_000_000_000;
function completeSet(s:GameState,set:UiSetId):GameState {
 s=actWorkshop(s,{type:'buySet',set},now);
 for(const part of partsForSet(set)){
  s=actWorkshop(s,{type:'selectPart',part:part.id},now);s=actWorkshop(s,{type:'place',part:part.id,rect:part.defaultRect},now);
  for(const element of part.elements)s=actWorkshop(s,{type:'addElement',part:part.id,element},now);
  s=actWorkshop(s,{type:'confirmAdjustment',part:part.id},now);s=actWorkshop(s,{type:'test',part:part.id,interaction:part.testInteraction},now);
 }
 return s;
}
function materials(app:UiSetId='photo'):GameState {
 let s=createFixture('stage8a-entry',now)!;s.run.version='v1';s.resources.pixels=s.run.totalPixelsGenerated=1e12;
 for(const set of ['common','foundation','files','mail',app] as UiSetId[])s=completeSet(s,set);
 s.persistent.specs.color=1;return enterDesktop(s);
}
function installed(app:'photo'|'files'='photo'):GameState {
 let s=materials(app);s=ownAppBlueprint(s,app);s=actAppBuild(s,{type:'app-edit',app});s=actAppBuild(s,{type:'app-recommend',app});return actAppBuild(s,{type:'app-install',app});
}
describe('第3版：完成素材から組み立てるアプリ',()=>{
 it('UIセットの権利からひな型を作り、配置・installの各段階を保存でき、追加料金を取らない',()=>{
  let s=materials(),wallet=structuredClone(s.resources),production=structuredClone(s.run.workshop.parts);
  s=ownAppBlueprint(s,'photo');expect(s.run.desktop.projects.photo!.draft.parts).toEqual([]);expect(adoptedPartIds(s,'photo')).toEqual([]);
  for(const action of [null,{type:'app-recommend',app:'photo'},{type:'app-install',app:'photo'}] as const){
   if(action)s=actAppBuild(s,action);
   expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);expect(s.resources).toEqual(wallet);expect(s.run.workshop.parts).toEqual(production);
  }
  expect(appIsOperational(s,'photo')).toBe(true);expect(adoptedPartIds(s,'photo')).toContain('photo-crop');
 });
 it('未完成素材をおすすめ・配置から作ったことにできず、未取得セットのひな型も作れない',()=>{
  let s=materials();s=ownAppBlueprint(s,'photo');
  const crop=s.run.workshop.parts['photo-crop']!;s.run.workshop.parts['photo-crop']={...crop,step:3,tested:false,completedAt:null,exportedAt:null};
  const before=structuredClone(s.run.workshop.parts);s=actAppBuild(s,{type:'app-recommend',app:'photo'});
  expect(s.run.desktop.projects.photo!.draftAssembly!.slots.some(slot=>slot.source==='photo-crop')).toBe(false);
  expect(actAppBuild(s,{type:'app-place',app:'photo',part:'crop'})).toBe(s);expect(s.run.workshop.parts).toEqual(before);
  expect(ownAppBlueprint(s,'terminal')).toBe(s);
 });
 it('完成したパーツの色・寸法・設定をsourceに持ち、実配置rendererにも同じsnapshotを渡す',()=>{
  let s=materials();s=actWorkshop(s,{type:'adjust',part:'photo-display',patch:{color:'#1f3f7a',radius:8,shadow:true}},now);
  const source=structuredClone(s.run.workshop.parts['photo-display']!.design);s=ownAppBlueprint(s,'photo');s=actAppBuild(s,{type:'app-recommend',app:'photo'});s=actAppBuild(s,{type:'app-install',app:'photo'});
  const view=getInstalledAppParts(s,'photo').find(p=>p.sourcePartId==='photo-display')!;expect(view.design).toEqual(source);
  const actual=installedAssembly(s,'photo')!.slots.find(p=>p.source==='photo-display')!;expect(view.rect).toEqual(actual.rect);
 });
 it('元素材を再調整しても今のアプリは変わらず、読み直してinstallした時点で反映する',()=>{
  let s=installed(),old=structuredClone(installedAssembly(s,'photo'));
  s=actWorkshop(s,{type:'adjust',part:'photo-display',patch:{color:'#1f3f7a'}},now+1);
  expect(installedAssembly(s,'photo')).toEqual(old);
  s=actAppBuild(s,{type:'app-edit',app:'photo'});s=actAppBuild(s,{type:'app-refresh',app:'photo'});expect(installedAssembly(s,'photo')).toEqual(old);
  s=actAppBuild(s,{type:'app-install',app:'photo'});expect(installedAssembly(s,'photo')!.slots.find(slot=>slot.source==='photo-display')!.design.color).toBe('#1f3f7a');
  expect(old!.slots.find(slot=>slot.source==='photo-display')!.design.color).not.toBe('#1f3f7a');
 });
 it('編集中の除去は現アプリに影響せず、installで採用sourceから外れ、おすすめで復旧する',()=>{
  let s=installed(),old=structuredClone(installedAssembly(s,'photo'));
  s=actAppBuild(s,{type:'app-remove',app:'photo',part:'crop'});expect(installedAssembly(s,'photo')).toEqual(old);expect(hasAppPart(s,'photo','crop')).toBe(true);
  s=actAppBuild(s,{type:'app-install',app:'photo'});expect(hasAppPart(s,'photo','crop')).toBe(false);expect(adoptedPartIds(s,'photo')).not.toContain('photo-crop');
  s=actAppBuild(s,{type:'app-recommend',app:'photo'});s=actAppBuild(s,{type:'app-install',app:'photo'});expect(hasAppPart(s,'photo','crop')).toBe(true);
 });
 it('同じ素材を複数slotで使ってもsource IDを重複させず、共通窓の順序も凍結する',()=>{
  let s=installed('files');const ids=adoptedPartIds(s,'files');expect(new Set(ids).size).toBe(ids.length);expect(ids.filter(id=>id==='files-back')).toHaveLength(1);
  const old=structuredClone(installedAssembly(s,'files')!.common.find(p=>p.source==='common-frame'));
  s=actWorkshop(s,{type:'addElement',part:'common-frame',element:'close',index:1,side:'start'},now+1);
  expect(installedAssembly(s,'files')!.common.find(p=>p.source==='common-frame')).toEqual(old);
  s=actAppBuild(s,{type:'app-refresh',app:'files'});s=actAppBuild(s,{type:'app-install',app:'files'});expect(installedAssembly(s,'files')!.common.find(p=>p.source==='common-frame')!.elements).toEqual(s.run.workshop.parts['common-frame']!.elements);
 });
 it('source付きの元に戻す・やり直す・installedへ戻すはpaletteや材料を失わない',()=>{
  let s=installed(),before=structuredClone(s.run.desktop.projects.photo!.draftAssembly);
  s=actAppBuild(s,{type:'app-remove',app:'photo',part:'crop'});s=actAppBuild(s,{type:'app-undo',app:'photo'});expect(s.run.desktop.projects.photo!.draftAssembly).toEqual(before);
  s=actAppBuild(s,{type:'app-redo',app:'photo'});expect(s.run.desktop.projects.photo!.draftAssembly!.slots.some(slot=>slot.role==='crop')).toBe(false);
  s=actAppBuild(s,{type:'app-revert',app:'photo'});expect(s.run.desktop.projects.photo!.draftAssembly).toEqual(before);expect(isGameState(s)).toBe(true);
 });
 it('窓外・重なり・小さすぎる値は基盤で拒否し、異なる窓寸法でも安全に収める',()=>{
  const layout=recommendedLayout('files',allAppParts('files')),part=layout.parts[0]!;
  for(const patch of [{x:-BALANCE.appBuild.grid},{width:1},{x:NaN},{x:Infinity},{x:layout.width}])expect(changePart(layout,part.id,patch)).toBe(layout);
  for(const [width,height] of [[280,180],[440,240],[784,540],[1350,696]]){
   const fitted=fitAppLayout(layout,width!,height!);expect(validLayout(fitted,'files')).toBe(true);
   for(const a of fitted.parts)for(const b of fitted.parts)if(a!==b)expect(overlap(a,b)).toBe(false);
  }
 });
 it('旧版で持っていた素材は外してinstall後も置き直せ、工房の無料完成へは変換しない',()=>{
  let s=installed();const project=s.run.desktop.projects.photo!;
  delete project.draftAssembly;delete project.installedAssembly;delete project.assemblyUndo;delete project.assemblyRedo;delete project.legacyMaterials;
  const crop=s.run.workshop.parts['photo-crop']!;s.run.workshop.parts['photo-crop']={...crop,step:0,elements:[],completedAt:null,exportedAt:null,tested:false};delete s.run.workshop.parts['photo-crop']!.fitting;delete s.run.workshop.parts['photo-crop']!.createdStage;
  s=migrateAppAssemblies(s);const wallet=structuredClone(s.resources);
  s=actAppBuild(s,{type:'app-remove',app:'photo',part:'crop'});s=actAppBuild(s,{type:'app-install',app:'photo'});expect(hasAppPart(s,'photo','crop')).toBe(false);
  s=actAppBuild(s,{type:'app-recommend',app:'photo'});s=actAppBuild(s,{type:'app-install',app:'photo'});
  expect(hasAppPart(s,'photo','crop')).toBe(true);expect(s.run.workshop.parts['photo-crop']!.step).toBe(0);expect(s.resources).toEqual(wallet);
  const restored=decodeSave(encodeSave(s));expect(restored.resources).toEqual(wallet);expect(restored.run.desktop.projects.photo).toEqual(s.run.desktop.projects.photo);
  expect(restored.run.workshop.parts['photo-crop']).toMatchObject({step:1,elements:[],completedAt:null,tested:false});
 });
 it('壊れたsource配置だけを同じアプリの安全な配置から直し、素材と財布を保持する',()=>{
  const s=installed(),raw=JSON.parse(encodeSave(s)),before=structuredClone(s.run.desktop.projects.photo!.installedAssembly);
  raw.run.desktop.projects.photo.installedAssembly.slots[0].rect.x=-BALANCE.appBuild.grid;
  const fixed=decodeSave(JSON.stringify(raw));
  expect(fixed.run.desktop.projects.photo!.installedAssembly).toEqual(before);
  expect(fixed.run.workshop.parts).toEqual(s.run.workshop.parts);expect(fixed.resources).toEqual(s.resources);
  expect(isGameState(fixed)).toBe(true);
 });
 it('旧アプリの大きな文字をcompat snapshotに保ち、保存と表示で小さくしない',()=>{
  let s=installed();const project=s.run.desktop.projects.photo!;
  project.draft.parts[0]!.fontSize=BALANCE.pageDesign.buttonFontMax;project.installed!.parts[0]!.fontSize=BALANCE.pageDesign.buttonFontMax;
  delete project.draftAssembly;delete project.installedAssembly;delete project.assemblyUndo;delete project.assemblyRedo;
  s=migrateAppAssemblies(s);expect(getInstalledAppParts(s,'photo')[0]!.design.fontSize).toBe(BALANCE.pageDesign.buttonFontMax);
  const role=s.run.desktop.projects.photo!.draft.parts[0]!.id;
  s=actAppBuild(s,{type:'app-change',app:'photo',part:role,patch:{color:'#1f3f7a'}});s=actAppBuild(s,{type:'app-install',app:'photo'});
  expect(getInstalledAppParts(s,'photo').find(part=>part.role===role)!.design.fontSize).toBe(BALANCE.pageDesign.buttonFontMax);
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('旧14のまとめられた有償機能をcompat sourceへ保全し、新しい制作済みパーツは増やさない',()=>{
  let s=installed();const old=s.run.desktop.projects.photo!;delete old.draftAssembly;delete old.installedAssembly;delete old.assemblyUndo;delete old.assemblyRedo;
  const productions=structuredClone(s.run.workshop.parts),wallet=structuredClone(s.resources),migrated=migrateAppAssemblies(s);
  expect(migrated.run.desktop.projects.photo!.installedAssembly!.legacy).toBe(true);expect(migrated.run.workshop.parts).toEqual(productions);expect(migrated.resources).toEqual(wallet);
  expect(isGameState(migrated)).toBe(true);
 });
});
