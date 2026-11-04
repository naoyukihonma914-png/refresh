import { describe,it,expect } from 'vitest';
import { BALANCE } from '../config/balance';
import { GROUP_TOOLS, commonPartIds, groupTool, groupCost, toolParts, toolPieceReward, type WorkshopToolId } from '../content/workshopGroups';
import { FITTING_PARTS,fittingDefinition } from '../content/workshopFitting';
import { defaultPieceSocket } from './workshopFitting';
import { createGroupFixture } from './groupFixtures';
import { actWorkshop,canAssembleDesktop,canBuyEditorSkill,canInspectDesktopExit,advanceWorkshopAssistance } from './workshop';
import { canBuyGroup } from './groupPuzzle';
import { completedComponentSources,sourceTotal } from './productionModel';
import { createAppAssembly } from './appAssembly';
import { createSeedVersion } from './seed';
import { buyDesktopApp } from './desktop';
import { nextDesktopOffer } from './desktopOffers';
import { actAppBuild,ownAppBlueprint } from './appBuild';
import { enterDesktop } from './desktop';
import { createInitialState,isGameState } from './state';
import { decodeSave,encodeSave } from './save';
import { tesseraUpdatePending } from './workshopUpdate';
const now=1_800_000_000_000;
const entry=(era=0)=>createGroupFixture(`group-entry-era${era}`,now)!;
const act=(s:ReturnType<typeof entry>,action:Parameters<typeof actWorkshop>[1])=>actWorkshop(s,action,now);
function finish(s:ReturnType<typeof entry>,id:WorkshopToolId){
 const d=groupTool(id);s=act(s,{type:'groupSelect',group:d.group});
 s=act(s,{type:'groupPlace',tool:id,at:s.run.workshop.groupPuzzle!.tools[id]!.positions[d.base]!.at});
 for(const piece of d.pieces.filter(piece=>piece.id!==d.base))s=act(s,{type:'groupFit',tool:id,piece:piece.id});
 return s;
}
describe('schema 19 group puzzle production',()=>{
 it('has exactly 38 main pieces, preserves all 44 old feature identities and their payment totals',()=>{
  expect(GROUP_TOOLS.reduce((n,t)=>n+t.pieces.length,0)).toBe(38);
  const mapped=GROUP_TOOLS.flatMap(tool=>toolParts(tool));
  expect(new Set(mapped).size).toBe(44);
  expect([...mapped].sort()).toEqual(FITTING_PARTS.filter(part=>part.set!=='common'&&part.set!=='stream').map(part=>part.id).sort());
  for(const tool of GROUP_TOOLS)expect(toolPieceReward(tool)*tool.pieces.length).toBeCloseTo(toolParts(tool).reduce((sum,id)=>sum+BALANCE.workshop.fitting.pieceRewardTotals[FITTING_PARTS.find(part=>part.id===id)!.category],0));
 });
 it('starts with four ready-made common materials, with no common purchase or export route',()=>{
  const s=entry();for(const id of commonPartIds)expect(s.run.workshop.parts[id]!.step).toBe(4);
  expect(sourceTotal(completedComponentSources(s))).toBe(0);
  expect(act(s,{type:'buySet',set:'common'})).toBe(s);expect(act(s,{type:'export'})).toBe(s);
  expect(s.run.workshop.groupPuzzle!.shelf).toEqual([]);
 });
 it('buys Files and Mail together, mixing all nine pieces without overlapping or charging for focus',()=>{
  let s=entry(),before=s.resources.pixels;s=act(s,{type:'groupBuy',group:'required'});
  expect(s.resources.pixels).toBe(before-groupCost('required'));
  expect(Object.keys(s.run.workshop.groupPuzzle!.tools)).toEqual(['files','mail']);
  const positions=structuredClone(s.run.workshop.groupPuzzle!.tools),items=GROUP_TOOLS.filter(t=>t.group==='required').flatMap(t=>t.pieces.map(piece=>({...piece.rect,...positions[t.id]!.positions[piece.id]!.origin})));
  expect(items).toHaveLength(9);
  for(const [i,a] of items.entries())for(const b of items.slice(i+1))expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
  const resources=s.resources;s=act(s,{type:'groupFocus',tool:'mail'});expect(s.resources).toEqual(resources);expect(s.run.workshop.groupPuzzle!.tools).toEqual(positions);
  expect(sourceTotal(completedComponentSources(s))).toBe(2*45);
  expect(isGameState(s)).toBe(true);
 });
 it('does not fit elements before their own frame is placed, and locks the frame at its first fit',()=>{
  let s=act(entry(),{type:'groupBuy',group:'required'});
  expect(act(s,{type:'groupFit',tool:'files',piece:'list'})).toBe(s);
  s=act(s,{type:'groupPlace',tool:'files',at:{x:40,y:48}});
  s=act(s,{type:'groupPlace',tool:'files',at:{x:64,y:80}});
  expect(s.run.workshop.groupPuzzle!.tools.files!.positions.frame!.at).toEqual({x:64,y:80});
  s=act(s,{type:'groupFit',tool:'files',piece:'list'});
  const p=s.run.workshop.groupPuzzle!.tools.files!;expect(p.locked).toBe(true);expect(p.fitted.list).toEqual({x:8,y:224});
  expect(act(s,{type:'groupPlace',tool:'files',at:{x:400,y:400}})).toBe(s);
  expect(act(s,{type:'groupFit',tool:'mail',piece:'list'})).toBe(s);
  expect(decodeSave(encodeSave(s)).run.workshop.groupPuzzle!.tools.files).toEqual(p);
 });
 it('preserves staging and visibility through group switches and normal save/reload, without paying or activating a piece',()=>{
  let s=act(entry(),{type:'groupBuy',group:'required'}),before=s.resources;
  s=act(s,{type:'groupStage',tool:'mail',piece:'body',at:{x:300,y:900}});
  s=act(s,{type:'groupToggle',tool:'mail',piece:'body'});
  const saved=decodeSave(encodeSave(s));expect(saved.run.workshop.groupPuzzle!.stack.at(-1)).toBe('mail:body');expect(saved.run.workshop.groupPuzzle!.tools.mail!.hidden).toContain('body');
  expect(saved.resources).toEqual(before);expect(saved.run.workshop.parts['mail-body']!.step).toBe(1);
  s=act(saved,{type:'groupCategory',category:'desktop'});s=act(s,{type:'groupSelect',group:'required'});
  expect(s.run.workshop.groupPuzzle!.tools.mail!.positions.body!.at).toEqual({x:300,y:900});
  s=act(s,{type:'groupStage',tool:'mail',piece:'body'});const pos=s.run.workshop.groupPuzzle!.tools.mail!.positions.body!;expect(pos.at).toEqual(pos.origin);
 });
 it('pays a merged element once, preserves its old material identities and rate when removed and refitted',()=>{
  let s=act(entry(),{type:'groupBuy',group:'required'});s=act(s,{type:'groupPlace',tool:'files',at:{x:32,y:32}});
  s=act(s,{type:'groupFit',tool:'files',piece:'toolbar'});
  for(const id of ['files-back','files-sort','files-search'] as const)expect(s.run.workshop.parts[id]!.step).toBe(4);
  const resources=s.resources,rate=sourceTotal(completedComponentSources(s));
  s=act(s,{type:'groupStage',tool:'files',piece:'toolbar',at:{x:700,y:600}});
  expect(s.resources).toEqual(resources);expect(sourceTotal(completedComponentSources(s))).toBe(rate);
  s=act(s,{type:'groupFit',tool:'files',piece:'toolbar'});expect(s.resources).toEqual(resources);
  expect(s.run.workshop.groupPuzzle!.tools.files!.paid.filter(id=>id==='toolbar')).toHaveLength(1);
 });
 it('automatically completes Files into one saved icon, pays six tokens plus the one-time grant and unlocks after the update',()=>{
  let s=finish(act(entry(),{type:'groupBuy',group:'required'}),'files');
  expect(s.resources.tokens).toBe(9);expect(s.run.workshop.groupPuzzle!.shelf).toEqual(['files']);expect(s.run.workshop.groupPuzzle!.focus).toBeNull();
  expect(tesseraUpdatePending(s)).toBe(true);expect(canBuyEditorSkill(s,'eyedropper')).toBe(false);
  const loaded=decodeSave(encodeSave(s));expect(loaded).toEqual(s);
  expect(act(loaded,{type:'groupFit',tool:'files',piece:'display'}).resources).toEqual(s.resources);
  expect(act(loaded,{type:'export'}).resources).toEqual(s.resources);
  s=act(s,{type:'skill',id:'update'});expect(s.resources.tokens).toBe(6);expect(tesseraUpdatePending(s)).toBe(false);
  s=finish(s,'mail');expect(s.resources.tokens).toBe(11);expect(s.run.workshop.groupPuzzle!.shelf).toEqual(['files','mail']);
  expect(s.persistent.tesseraUpdateGrantReceived).toBe(true);
 });
 it('requires the desktop surface too, then opens the real world-three exit with usable materials',()=>{
  let s=act(entry(1),{type:'groupBuy',group:'required'});s=finish(finish(s,'files'),'mail');
  expect(s.resources.tokens).toBe(11);expect(canAssembleDesktop(s)).toBe(false);expect(canInspectDesktopExit(s)).toBe(false);
  expect(canBuyGroup(s,'foundation')).toBe(true);s=act(s,{type:'groupBuy',group:'foundation'});s=finish(s,'foundation');
  expect(s.resources.tokens).toBe(17);expect(canAssembleDesktop(s)).toBe(true);expect(canInspectDesktopExit(s)).toBe(true);
  const next=enterDesktop(s);expect(next.run.world).toBe('desktop');expect(next.resources.pixels).toBe(s.resources.pixels-BALANCE.w2.desktopCost);expect(isGameState(next)).toBe(true);
 });
 it('customizes an integrated target for one tool without changing the other tool',()=>{
  let s=act(entry(1),{type:'groupBuy',group:'required'}),mail=structuredClone(s.run.workshop.groupPuzzle!.tools.mail!.designs);
  s=act(s,{type:'groupAdjust',tool:'files',part:'files-search',patch:{fontSize:12}});
  expect(s.run.workshop.groupPuzzle!.tools.files!.designs['files-search']!.fontSize).toBe(12);
  expect(s.run.workshop.groupPuzzle!.tools.mail!.designs).toEqual(mail);expect(isGameState(s)).toBe(true);
 });
 it('reads schema 19 exactly and resets trial schema 18 without migrating resources, products or asset references',()=>{
  const fresh=createInitialState(now);expect(fresh.schemaVersion).toBe(19);expect(decodeSave(encodeSave(fresh))).toEqual(fresh);
  const old={schemaVersion:18,lastTickAt:now,resources:{tokens:999},persistent:{screenshots:[{sceneRef:'unavailable'}],products:[{name:'trial'}]}};
  expect(decodeSave(JSON.stringify(old))).toEqual(fresh);
  expect(()=>decodeSave(JSON.stringify({...fresh,schemaVersion:20}))).toThrow();
 });
 it('rejects fabricated shelf entries, duplicate paid pieces, out-of-range positions and shifted fitted coordinates',()=>{
  const s=act(entry(),{type:'groupBuy',group:'required'});
  const invalid=(edit:(g:NonNullable<typeof s.run.workshop.groupPuzzle>)=>void)=>{const bad=structuredClone(s);edit(bad.run.workshop.groupPuzzle!);expect(isGameState(bad)).toBe(false);};
  invalid(g=>g.shelf.push('files'));invalid(g=>g.tools.files!.paid=['frame','frame']);invalid(g=>g.tools.files!.positions.frame!.at.x=9999);
  invalid(g=>{g.tools.files!.placed=true;g.tools.files!.locked=true;g.tools.files!.paid=['frame','list'];g.tools.files!.fitted.list={x:0,y:0};});
 });
 it.each(GROUP_TOOLS.map(tool=>tool.id))('%s completes with its specified token count and remains an independent icon',id=>{
  let s=id==='files'||id==='mail'?act(entry(1),{type:'groupBuy',group:'required'}):createGroupFixture('group-catalog-era1',now)!;
  const before=s.resources.tokens;s=finish(s,id);
  expect(s.resources.tokens).toBe(before+groupTool(id).tokens);
  expect(s.run.workshop.groupPuzzle!.shelf.filter(tool=>tool===id)).toHaveLength(1);expect(isGameState(s)).toBe(true);
 });
 it('keeps each completed tool common design and creation era in the world-three recipe',()=>{
  let s=act(entry(1),{type:'groupBuy',group:'required'});
  s=act(s,{type:'groupAdjust',tool:'files',part:'common-frame',patch:{fontSize:12}});s=finish(s,'files');
  const file=createAppAssembly(s,'files'),mail=createAppAssembly(s,'mail');
  expect(file.common.find(p=>p.source==='common-frame')!.design.fontSize).toBe(12);
  expect(mail.common.find(p=>p.source==='common-frame')!.design.fontSize).not.toBe(12);
  expect(file.common.every(p=>p.createdStage===1)).toBe(true);
 });
 it('allows the Tessera job to place frames and finish all tools in the selected group exactly once',()=>{
  let s=act(entry(1),{type:'groupBuy',group:'required'});s.run.world='desktop';s.run.desktop.entered=true;
  s.run.desktop.upgrades=['jobs'];s.run.desktop.jobs.tessera={assigned:true,cursors:1,updates:0};
  const half=advanceWorkshopAssistance(s,BALANCE.workshop.assistStepMs/2,now);
  expect(half.run.workshop.groupPuzzle!.assistMs).toBe(BALANCE.workshop.assistStepMs/2);
  const restored=decodeSave(encodeSave(half)),done=advanceWorkshopAssistance(restored,1e12,now+1e12);
  expect(done.run.workshop.groupPuzzle!.shelf).toEqual(['files','mail']);expect(done.resources.tokens).toBe(11);
  expect(done.run.workshop.groupPuzzle!.assistMs).toBe(0);expect(isGameState(done)).toBe(true);
  expect(advanceWorkshopAssistance(done,1e12,now+2e12).resources).toEqual(done.resources);
 });
 it('starts the next cycle with fresh group pieces and keeps the permanent grant flag',()=>{
  const first=finish(act(entry(),{type:'groupBuy',group:'required'}),'files');
  const next=createSeedVersion(first,'v1',now+1000);
  expect(next.run.workshop.groupPuzzle!.shelf).toEqual([]);expect(next.run.workshop.groupPuzzle!.purchased).toEqual([]);
  expect(next.persistent.tesseraUpdateGrantReceived).toBe(true);expect(isGameState(next)).toBe(true);
 });

 it('routes desktop purchases and builder material requests to the new owning group',()=>{
  let s=createGroupFixture('group-catalog-era1',now)!;s=finish(s,'foundation');s=enterDesktop(s);
  // Required app materials are ready; entering their builder remains the first offer.
  expect(nextDesktopOffer(s)).toMatchObject({id:'files',kind:'assemble'});
  s=buyDesktopApp(s,'files',now);expect(s.run.desktop.editingApp).toBe('files');
  s=ownAppBlueprint(s,'photo');s=actAppBuild(s,{type:'app-craft',app:'photo',part:'image'});
  expect(s.run.desktop.editingApp).toBeNull();expect(s.run.workshop.groupPuzzle!.selected).toBe('photo');
  expect(s.run.workshop.groupPuzzle!.focus).toBe('photo');expect(s.run.workshop.activePart).toBe('photo-display');
 });

 it('keeps the v2 streaming set on its existing fitting and explicit export route',()=>{
  let s=entry(1);s.run.world='desktop';s.run.version='v2';s.run.desktop.entered=true;s.resources.pixels=s.run.totalPixelsGenerated=1e12;
  s=act(s,{type:'groupBuy',group:'stream'});expect(s.run.workshop.groupPuzzle!.purchased).toContain('stream');
  s=act(s,{type:'togglePart',part:'stream-preview'});
  for(const piece of fittingDefinition('stream-preview').pieces){
   s=act(s,{type:'spawnPiece',part:'stream-preview',piece});
   const socket=defaultPieceSocket(fittingDefinition('stream-preview'),s.run.workshop.parts['stream-preview']!.fitting!,piece)!;
   s=act(s,{type:'fitPiece',part:'stream-preview',piece,socket});
  }
  expect(s.run.workshop.parts['stream-preview']!.step).toBe(4);expect(s.resources.tokens).toBe(0);
  s=act(s,{type:'export',part:'stream-preview'});expect(s.resources.tokens).toBe(1);
  expect(s.run.workshop.groupPuzzle!.shelf).toEqual([]);expect(decodeSave(encodeSave(s))).toEqual(s);
 });

});
