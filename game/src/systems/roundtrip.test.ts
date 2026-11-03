import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect} from 'vitest';
import {BALANCE} from '../config/balance';
import {partsForSet,type UiSetId,type WorkshopPartId} from '../content/workshopCatalog';
import {SCHEMA_VERSION,createInitialState,isGameState,type GameState} from './state';
import {createSeedVersion,buildSeed} from './seed';
import {actWorkshop,advanceWorkshop,canAssembleDesktop,canBuyWorkshopSet,enterWorkshop,prototypeConditions} from './workshop';
import {createComponentDesign,createEditorCustomization,isCompleteSetDocument,mergeLegacyScrollbarIntoFrame} from './workshopState';
import {world4Preparation} from './world4';
import {decodeSave,encodeSave} from './save';
import {migrateStage8bSave} from './stage8bMigration';

const now=1_800_000_000_000;
function workshop(version:GameState['run']['version']='v0.1'):GameState {
 const s=createInitialState(now);s.run.version=version;s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s.resources.pixels=s.run.totalPixelsGenerated=100_000_000;
 return advanceWorkshop(enterWorkshop(s),BALANCE.workshop.enterMs);
}
function complete(s:GameState,id:WorkshopPartId):GameState {
 const descriptor=partsForSet(id.startsWith('stream-')?'stream':id.split('-')[0] as UiSetId).find(part=>part.id===id)!;
 s=actWorkshop(s,{type:'place',part:id,rect:descriptor.defaultRect},now);
 for(const element of descriptor.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
 s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);
 return actWorkshop(s,{type:'test',part:id,interaction:descriptor.testInteraction},now);
}
function completeSet(s:GameState,set:UiSetId):GameState {
 s=actWorkshop(s,{type:'buySet',set},now);
 for(const part of partsForSet(set))s=complete(s,part.id);
 return s;
}

describe('段階8b：周回は現在の版を作り直し、旧書類を保存する',()=>{
 it('旧版の完成セットは記録へ残るが、新版の必須関門や工程を満たさない',()=>{
  let previous=workshop();for(const set of ['common','foundation','files','mail'] as const)previous=completeSet(previous,set);
  const original=structuredClone(previous),next=createSeedVersion(previous,'v1',now+1_000);
  expect(previous).toEqual(original);expect(next.persistent.setDocuments).toHaveLength(4);
  expect(next.persistent.setDocuments.every(document=>document.version==='v0.1'&&isCompleteSetDocument(document))).toBe(true);
  expect(next.run.workshop.parts).toEqual({});expect(next.run.workshop.purchasedSets).toEqual([]);expect(next.run.desktop.apps).toEqual([]);expect(next.run.desktop.projects).toEqual({});
  let rebuilt=next;rebuilt.resources.pixels=100_000_000;rebuilt.run.totalPixelsGenerated=100_000_000;
  for(const item of BALANCE.w1.items)rebuilt=buildSeed(rebuilt,item.id,now+2_000);
  rebuilt=advanceWorkshop(rebuilt,BALANCE.workshop.enterMs);rebuilt.persistent.specs.color=1;
  expect(prototypeConditions(rebuilt)).toEqual([true,false,false]);expect(canAssembleDesktop(rebuilt)).toBe(false);expect(canBuyWorkshopSet(rebuilt,'mail')).toBe(false);
  rebuilt=completeSet(rebuilt,'common');expect(rebuilt.persistent.setDocuments.find(document=>document.id==='v1:common')).toBeDefined();
  expect(rebuilt.persistent.setDocuments.filter(document=>document.version==='v0.1')).toEqual(original.persistent.setDocuments);
  expect(decodeSave(encodeSave(rebuilt))).toEqual(rebuilt);
 });
 it('段の購入は残り、段が変わると配置だけ標準に戻して引継ぎの色を保つ',()=>{
  const previous=workshop('v1');previous.persistent.seedSkills=['inherit'];previous.persistent.editorSkills=['update','modern','presets'];previous.persistent.desktopPrefs.skills=['major1','major2'];
  previous.persistent.appearance.editor=2;previous.run.workshop.editorStageAtEntry=0;
  previous.persistent.editorCustomization={...createEditorCustomization(),nativeBackground:false,accent:'#e8a317',background:'#101018',grid:false,gridSpacing:24,fontSize:18,bandPosition:'bottom',panelWidth:384,docking:'right',presets:[{...createComponentDesign(),radius:8}],panelPositions:{palette:'left',tools:'right',parts:'right',info:'top'},panelWidths:{palette:384,tools:320,parts:384}};
  previous.run.seed.page.button='#e8a317';
  const next=createSeedVersion(previous,'v2',now+1_000),standard=createEditorCustomization(2);
  expect(next.persistent.editorSkills).toEqual(previous.persistent.editorSkills);expect(next.persistent.appearance.editor).toBe(2);
  expect(next.persistent.editorCustomization).toMatchObject({nativeBackground:false,accent:'#e8a317',background:'#101018',grid:false,gridSpacing:24,fontSize:18,bandPosition:standard.bandPosition,panelWidth:standard.panelWidth,panelPositions:standard.panelPositions,panelWidths:standard.panelWidths,docking:standard.docking,presets:previous.persistent.editorCustomization.presets});
  expect(next.run.seed.page.button).toBe('#e8a317');expect(next.run.seed.page.layout).toBeNull();expect(isGameState(next)).toBe(true);
 });
 it('同じ段なら引継ぎ設定を保持し、未取得でも型の記録だけは消さない',()=>{
  const previous=workshop('v1');previous.persistent.seedSkills=['inherit'];previous.persistent.editorSkills=['presets'];previous.persistent.editorCustomization.bandPosition='bottom';previous.persistent.editorCustomization.presets=[{...createComponentDesign(),radius:8}];
  const same=createSeedVersion(previous,'v2',now+1_000);expect(same.persistent.editorCustomization).toEqual(previous.persistent.editorCustomization);
  previous.persistent.seedSkills=[];const standard=createSeedVersion(previous,'v2',now+2_000);
  expect(standard.persistent.editorCustomization).toEqual({...createEditorCustomization(),presets:previous.persistent.editorCustomization.presets});
  expect(standard.run.workshop.parts).toEqual({});expect(standard.persistent.editorCustomization.presets).not.toBe(previous.persistent.editorCustomization.presets);
 });
 it('部分的なエクスポートは保持するが完成セットとは数えない',()=>{
  let previous=actWorkshop(workshop(),{type:'buySet',set:'common'},now);previous=complete(previous,'common-button');previous=actWorkshop(previous,{type:'export'},now);
  expect(previous.persistent.setDocuments).toHaveLength(1);expect(isCompleteSetDocument(previous.persistent.setDocuments[0]!)).toBe(false);
  const next=createSeedVersion(previous,'v1',now+1_000);expect(next.persistent.setDocuments).toEqual(previous.persistent.setDocuments);expect(next.run.workshop.parts).toEqual({});
 });
});

describe('段階8b：世界4は制作と格納と性能の判定まで',()=>{
 it('世界4の材料購入はv2のデスクトップだけで、購入は完成品を渡さない',()=>{
  const first=workshop('v1');first.run.world='desktop';first.run.desktop.entered=true;
  expect(canBuyWorkshopSet(first,'stream')).toBe(false);expect(actWorkshop(first,{type:'buySet',set:'stream'},now)).toBe(first);
  const early=workshop('v2');expect(canBuyWorkshopSet(early,'stream')).toBe(false);
  early.run.world='desktop';early.run.desktop.entered=true;expect(canBuyWorkshopSet(early,'stream')).toBe(true);
  const purchased=actWorkshop(early,{type:'buySet',set:'stream'},now);
  expect(early.resources.pixels-purchased.resources.pixels).toBe(BALANCE.workshop.setCosts.stream);
  expect(partsForSet('stream').every(part=>purchased.run.workshop.parts[part.id]?.step===0)).toBe(true);expect(world4Preparation(purchased).ready).toBe(false);
  const premature=structuredClone(purchased);premature.run.version='v1';expect(isGameState(premature)).toBe(false);
  const outsideDesktop=structuredClone(purchased);outsideDesktop.run.world='kumiki';outsideDesktop.run.desktop.entered=false;expect(isGameState(outsideDesktop)).toBe(false);
 });
 it('4工程で完成した現版の書類と60Hzが両方必要で、旧版書類では代替できない',()=>{
  let s=workshop('v2');s.run.world='desktop';s.run.desktop.entered=true;s=completeSet(s,'stream');
  expect(s.persistent.setDocuments.find(document=>document.id==='v2:stream')).toBeDefined();
  const low=world4Preparation(s);expect(low).toMatchObject({versionAllowed:true,desktopAvailable:true,completedSets:['stream'],storedSets:['stream'],requiredHz:60,currentHz:30,ready:false});
  s.persistent.specs.refresh=BALANCE.world4.requiredRefreshLevel;expect(world4Preparation(s).ready).toBe(true);
  expect(s.run.world).toBe('desktop');expect(decodeSave(encodeSave(s))).toEqual(s);
  const oldOnly=structuredClone(s);oldOnly.persistent.setDocuments[0]!.version='v1';oldOnly.persistent.setDocuments[0]!.id='v1:stream';
  expect(world4Preparation(oldOnly).storedSets).toEqual([]);expect(world4Preparation(oldOnly).ready).toBe(false);
  const partial=structuredClone(s);delete partial.persistent.setDocuments[0]!.parts['stream-comments'];expect(world4Preparation(partial).storedSets).toEqual([]);expect(world4Preparation(partial).ready).toBe(false);
 });
});

describe('公開済み8aの保存形式14を現形式へ移行する',()=>{
 for(const name of ['workshop','desktop','release'])it(`${name}: frozen main1f0d72aの保存を資源・制作・記録のまま読む`,()=>{
  const raw=gunzipSync(readFileSync(new URL(`./testdata/v14-stage8a-${name}.json.gz`,import.meta.url))).toString();
  const original=JSON.parse(raw),frozen=JSON.stringify(original),next=decodeSave(raw);
  expect(next.schemaVersion).toBe(SCHEMA_VERSION);expect(next.resources).toEqual(original.resources);expect(next.run.totalPixelsGenerated).toBe(original.run.totalPixelsGenerated);
  const foldedWorkshopParts=structuredClone(original.run.workshop.parts);mergeLegacyScrollbarIntoFrame(foldedWorkshopParts);
  expect(next.run.workshop).toEqual({...original.run.workshop,parts:foldedWorkshopParts,activePart:original.run.workshop.activePart==='common-scrollbar'?'common-frame':original.run.workshop.activePart,editorStageAtEntry:original.persistent.appearance.editor,helpTarget:null,combo:{count:0,lastCompletedAt:null}});expect(next.persistent.setDocuments).toEqual(original.persistent.setDocuments.map((doc:{parts:Record<string,unknown>})=>({...doc,parts:(()=>{const p=structuredClone(doc.parts);mergeLegacyScrollbarIntoFrame(p);return p;})()})));
  expect(next.run.desktop.windows).toEqual(original.run.desktop.windows);expect(next.run.desktop.jobs).toEqual(original.run.desktop.jobs);expect(next.run.desktop.apps).toEqual(original.run.desktop.apps);
  expect(next.persistent.screenshots).toEqual(original.persistent.screenshots);expect(next.persistent.products).toEqual(original.persistent.products);expect(next.persistent.productionNote).toBe(original.persistent.productionNote);
  expect(isGameState(next)).toBe(true);expect(decodeSave(encodeSave(next))).toEqual(next);
  migrateStage8bSave(original);expect(JSON.stringify(original)).toBe(frozen);
 });
});
