import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { fittingDefinition, fittingPartsForSet } from '../content/workshopFitting';
import type { UiSetId, WorkshopPartId } from '../content/workshopCatalog';
import { createInitialState, isGameState, type GameState } from './state';
import { actWorkshop, advanceWorkshop, canBuyEditorSkill, enterWorkshop } from './workshop';
import { defaultPieceSocket } from './workshopFitting';
import { completedComponentSources, installedAppSources, componentBaseRate } from './productionModel';
import { creditPixels } from './economy';
import { completionFeedback } from './workshopFeedback';
import { decodeSave, encodeSave } from './save';
import { enterDesktop } from './desktop';
import { actAppBuild, ownAppBlueprint } from './appBuild';
import { encodeScene, projectCapture, readCapture } from './captureScene';
import type { BuiltApp } from './desktopState';

const now=1_800_000_000_000;
function workshop(stage:0|1|2=0):GameState {
 let state=createInitialState(now);state.run.seed.built=BALANCE.w1.items.map(item=>item.id);
 state=advanceWorkshop(enterWorkshop(creditPixels(state,1e12)),BALANCE.workshop.enterMs);
 state.persistent.editorSkills=stage===2?['update','modern']:stage===1?['update']:[];
 state.persistent.appearance.editor=stage;
 return state;
}
function fit(state:GameState,id:WorkshopPartId,piece:string):GameState {
 state=actWorkshop(state,{type:'spawnPiece',part:id,piece},now);
 const socket=defaultPieceSocket(fittingDefinition(id),state.run.workshop.parts[id]!.fitting!,piece)!;
 return actWorkshop(state,{type:'fitPiece',part:id,piece,socket},now);
}
function complete(state:GameState,id:WorkshopPartId):GameState {
 for(const piece of fittingDefinition(id).pieces)state=fit(state,id,piece);
 return state;
}
function set(state:GameState,id:UiSetId):GameState {
 state=actWorkshop(state,{type:'buySet',set:id},now);
 for(const part of fittingPartsForSet(id))state=complete(state,part.id);
 return state;
}
function install(state:GameState,app:BuiltApp):GameState {
 state=ownAppBlueprint(state,app);
 state=actAppBuild(state,{type:'app-recommend',app});
 return actAppBuild(state,{type:'app-install',app});
}
function desktop(stage:0|1|2=0):GameState {
 let state=workshop(stage);
 for(const id of ['common','foundation','files','mail'] as const)state=set(state,id);
 state.run.version='v1';state.persistent.specs.color=1;
 return enterDesktop(state);
}

describe('the workshop production era is attached to made material',()=>{
 it.each([0,1,2] as const)('records era%s on first completion and applies only its configured production multiplier',stage=>{
  let state=actWorkshop(workshop(stage),{type:'buySet',set:'common'},now);
  const before=state;
  expect(state.run.workshop.parts['common-button']!.createdStage).toBeUndefined();
  state=complete(state,'common-button');
  expect(state.run.workshop.parts['common-button']!.createdStage).toBe(stage);
  const source=completedComponentSources(state).find(item=>item.id==='common-button')!;
  expect(source.baseRate).toBeCloseTo(BALANCE.workshop.partRates['common-button']*BALANCE.workshop.eras.partRateMultipliers[stage]);
  expect(completionFeedback(before,state,'common-button',1,now)!.partRate).toBeCloseTo(source.baseRate);
 });
 it('records the completion era rather than the purchase or first-piece era',()=>{
  let state=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
  state=fit(state,'common-heading','label');
  state.persistent.editorSkills=['update'];state.persistent.appearance.editor=1;
  state=fit(state,'common-heading','separator');
  expect(state.run.workshop.parts['common-heading']!.createdStage).toBe(1);
 });
 it('does not rerate old works when the editor changes or an acquired piece is detached and fitted again',()=>{
  let state=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
  const rate=completedComponentSources(state).find(source=>source.id==='common-button')!.baseRate;
  const completedAt=state.run.workshop.parts['common-button']!.completedAt;
  state.persistent.editorSkills=['update','modern'];state.persistent.appearance.editor=2;
  state=actWorkshop(state,{type:'removePiece',part:'common-button',piece:'label'},now+1);
  state=fit(state,'common-button','label');
  expect(state.run.workshop.parts['common-button']!.createdStage).toBe(0);
  expect(state.run.workshop.parts['common-button']!.completedAt).toBe(completedAt);
  expect(completedComponentSources(state).find(source=>source.id==='common-button')!.baseRate).toBe(rate);
 });
 it('preserves era metadata in exported documents and the schema18 save roundtrip',()=>{
  let state=set(workshop(1),'common');state=actWorkshop(state,{type:'export'},now);
  for(const material of Object.values(state.persistent.setDocuments[0]!.parts))expect(material!.createdStage).toBe(1);
  expect(decodeSave(encodeSave(state))).toEqual(state);
 });
 it('treats an absent historical era as the first era',()=>{
  const state=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
  delete state.run.workshop.parts['common-button']!.createdStage;
  state.persistent.editorSkills=['update','modern'];state.persistent.appearance.editor=2;
  expect(completedComponentSources(state).find(source=>source.id==='common-button')!.baseRate).toBe(componentBaseRate('common-button'));
  expect(decodeSave(encodeSave(state)).run.workshop.parts['common-button']!.createdStage).toBeUndefined();
 });
 it('uses installed material eras instead of the current live producers, including duplicate app roles',()=>{
  let state=install(desktop(1),'files');
  const snapshot=structuredClone(state.run.desktop.projects.files!.installedAssembly!);
  expect(snapshot.slots.filter(slot=>slot.source==='files-back')).toHaveLength(2);
  for(const material of [...snapshot.common,...snapshot.slots])expect(material.createdStage).toBe(1);
  const sources=installedAppSources(state,'files');
  expect(new Set(sources.map(source=>source.id)).size).toBe(sources.length);
  for(const source of sources)expect(source.baseRate).toBeCloseTo(componentBaseRate(source.id as WorkshopPartId)*BALANCE.workshop.eras.partRateMultipliers[1]);
  for(const material of Object.values(state.run.workshop.parts))if(material)material.createdStage=2;
  state.persistent.editorSkills=['update','modern'];state.persistent.appearance.editor=2;
  expect(installedAppSources(state,'files')).toEqual(sources);
  state=actAppBuild(state,{type:'app-recommend',app:'files'});state=actAppBuild(state,{type:'app-install',app:'files'});
  expect(state.run.desktop.projects.files!.installedAssembly).toEqual(snapshot);
  expect(installedAppSources(state,'files')).toEqual(sources);
  expect(decodeSave(encodeSave(state))).toEqual(state);
 });
 it('does not infer a historical installed material era from newer live production',()=>{
  const state=install(desktop(1),'files'),assembly=state.run.desktop.projects.files!.installedAssembly!;
  for(const material of [...assembly.common,...assembly.slots])delete material.createdStage;
  for(const source of installedAppSources(state,'files'))expect(source.baseRate).toBe(componentBaseRate(source.id as WorkshopPartId));
 });
 it('freezes production and installed material eras into a screenshot independently of later live changes',()=>{
  const state=install(desktop(1),'files');state.run.desktop.windows.files.open=true;state.run.desktop.windows.files.minimized=false;
  const scene=projectCapture(state,'ja'),shot={id:1,at:now,language:'ja',data:encodeScene(scene)};
  state.run.workshop.parts['files-list']!.createdStage=2;
  state.run.desktop.projects.files!.installedAssembly!.slots.find(slot=>slot.source==='files-list')!.createdStage=2;
  const frozen=readCapture(shot);
  expect(frozen.workshop!.parts['files-list']!.createdStage).toBe(1);
  expect(frozen.appProjects!.files!.installedAssembly!.slots.find(slot=>slot.source==='files-list')!.createdStage).toBe(1);
  expect(frozen.display.rate).toBe(scene.display.rate);
 });
 it.each([-1,3,1.5,'1'])('rejects invalid production and installed material era %s',invalid=>{
  const state=install(desktop(1),'files');
  const live=JSON.parse(encodeSave(state));live.run.workshop.parts['files-list'].createdStage=invalid;
  expect(isGameState(live)).toBe(false);expect(()=>decodeSave(JSON.stringify(live))).toThrow();
  const installed=JSON.parse(encodeSave(state));installed.run.desktop.projects.files.installedAssembly.slots[0].createdStage=invalid;
  expect(isGameState(installed)).toBe(false);
  // Save loading already repairs malformed app projects; a repaired graph must not retain the invalid era.
  const repaired=decodeSave(JSON.stringify(installed));expect(isGameState(repaired)).toBe(true);
  expect(repaired.run.desktop.projects.files?.installedAssembly?.slots[0]?.createdStage).not.toBe(invalid);
 });
});

describe('editor upgrade capabilities and introduction',()=>{
 it('restricts first-era zoom gestures to fixed choices and permits advanced choices after the update',()=>{
  const state=workshop();expect(BALANCE.workshop.eras.era0ZoomOptions).toEqual([.5,.85,1]);
  for(const zoom of BALANCE.workshop.eras.era0ZoomOptions)expect(actWorkshop(state,{type:'zoom',zoom},now).run.workshop.zoom).toBe(zoom);
  for(const zoom of [.75,1.25,2])expect(actWorkshop(state,{type:'zoom',zoom},now)).toBe(state);
  const updated=workshop(1);
  for(const zoom of BALANCE.workshop.zoomOptions)expect(actWorkshop(updated,{type:'zoom',zoom},now).run.workshop.zoom).toBe(zoom);
  const historical=structuredClone(state);historical.run.workshop.zoom=1.25;
  expect(decodeSave(encodeSave(historical)).run.workshop.zoom).toBe(1.25);
 });
 it('introduces the update after the first export and does not repeat it after dismissal or reload',()=>{
  let state=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
  state=actWorkshop(state,{type:'export'},now);expect(state.run.workshop.guide.current).toBe('updateAvailable');
  expect(state.run.workshop.guide.seen.filter(id=>id==='updateAvailable')).toHaveLength(1);
  state=actWorkshop(state,{type:'guide',id:'close'},now);state=decodeSave(encodeSave(state));
  state=complete(state,'common-heading');state=actWorkshop(state,{type:'export'},now+1);
  expect(state.run.workshop.guide.current).not.toBe('updateAvailable');expect(state.run.workshop.guide.seen.filter(id=>id==='updateAvailable')).toHaveLength(1);
 });
 it('does not introduce an upgrade the player already owns',()=>{
  let state=complete(actWorkshop(workshop(1),{type:'buySet',set:'common'},now),'common-button');
  state=actWorkshop(state,{type:'export'},now);expect(state.run.workshop.guide.seen).not.toContain('updateAvailable');
 });
 it('does not treat an additional export from a historical run as its first-ever export',()=>{
  let state=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
  state.run.workshop.parts['common-button']!.exportedAt=now;state.run.workshop.tokenDiscovered=true;
  state=complete(state,'common-heading');state=actWorkshop(state,{type:'export'},now+1);
  expect(state.run.workshop.guide.seen).not.toContain('updateAvailable');
 });
 it('uses the same upgrade purchase gate and price as the skill UI',()=>{
  let state=workshop();state.resources.tokens=2;expect(canBuyEditorSkill(state,'update')).toBe(false);
  expect(actWorkshop(state,{type:'skill',id:'update'},now)).toBe(state);
  state.resources.tokens=3;expect(canBuyEditorSkill(state,'update')).toBe(true);
  state=actWorkshop(state,{type:'skill',id:'update'},now);expect(state.resources.tokens).toBe(0);expect(state.persistent.appearance.editor).toBe(1);expect(canBuyEditorSkill(state,'update')).toBe(false);
 });
 it('declares later upgrade rows without spending tokens for unsupported generations',()=>{
  const state=workshop(2);state.run.version='v2';state.resources.tokens=1000;
  for(const [id,cost] of [['gessoUpdate',40],['brio',60],['brioUpdate',90]] as const){
   expect(BALANCE.workshop.skills.find(skill=>skill.id===id)?.cost).toBe(cost);
   expect(canBuyEditorSkill(state,id)).toBe(false);expect(actWorkshop(state,{type:'skill',id},now)).toBe(state);
  }
 });
});
