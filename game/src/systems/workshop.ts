import { BALANCE, type EditorSkill } from '../config/balance';
import { paletteFor } from '../content/palette';
import { WORKSHOP_PARTS, SET_IDS, getWorkshopPart, partsForSet, type UiSetId, type WorkshopPartId, type WorkshopRect, type TestInteraction } from '../content/workshopCatalog';
import { editorStage, canSwitchEditor, setEditorStage } from './appearance';
import { creditPixels } from './economy';
import { productionCreditMultiplier } from './productionModel';
import type { GameState } from './state';
import { adjustComponentDesign, createComponentDesign, isComponentDesign, isEditorCustomization, isWorkshopRect, workshopPairValid, workshopRectOnGrid, minimumPartSize, type ComponentDesign, type EditorCustomization, type PartProduction, type WorkshopGuideId, type WorkshopHelpTarget, isWorkshopHelpTarget } from './workshopState';

export type WorkshopAction =
  | {type:'help';target:WorkshopHelpTarget|null}
  | {type:'buySet';set:UiSetId} | {type:'selectPart';part:WorkshopPartId}
  | {type:'place';part?:WorkshopPartId;rect:WorkshopRect}
  | {type:'addElement';part?:WorkshopPartId;element:string;index?:number;side?:'start'|'end'}
  | {type:'adjust';part?:WorkshopPartId;patch:Partial<ComponentDesign>}
  | {type:'confirmAdjustment';part?:WorkshopPartId}
  | {type:'test';part?:WorkshopPartId;interaction:TestInteraction}
  | {type:'export';part?:WorkshopPartId}
  | {type:'customize';patch:Partial<EditorCustomization>}
  | {type:'skill';id:EditorSkill}
  | {type:'view';view:'workbench'|'settings'|'exports'} | {type:'zoom';zoom:number}
  | {type:'exit'} | {type:'guide';id:WorkshopGuideId|'close'};

export const defaultComponentDesign = (_state?:GameState):ComponentDesign => createComponentDesign();
export const completedParts = (s:GameState):WorkshopPartId[] => WORKSHOP_PARTS.filter(d=>s.run.workshop.parts[d.id]?.step===4).map(d=>d.id);
export const setComplete = (s:GameState,set:UiSetId):boolean => partsForSet(set).every(d=>s.run.workshop.parts[d.id]?.step===4);
export const completedSets = (s:GameState):UiSetId[] => SET_IDS.filter(id=>id!=='extras'&&setComplete(s,id));
const mainline:readonly UiSetId[]=['common','foundation','files','mail'];
export const nextWorkshopSet = (s:GameState):UiSetId|null => mainline.find(id=>!s.run.workshop.purchasedSets.includes(id))??null;
export function canBuyWorkshopSet(s:GameState,set:UiSetId):boolean {
  const w=s.run.workshop,index=mainline.indexOf(set);
  return w.entered&&['kumiki','desktop'].includes(s.run.world)&&w.enterMs===0&&SET_IDS.includes(set)
    && !w.purchasedSets.includes(set)&&s.resources.pixels>=BALANCE.workshop.setCosts[set]
    && (index<1||setComplete(s,mainline[index-1]!))
    && (set!=='extras'||s.persistent.editorSkills.includes('extraParts'))
    && (set!=='stream'||s.run.world==='desktop'&&s.run.version===BALANCE.world4.minimumVersion);
}
export const canExportWorkshop = (s:GameState):boolean => completedParts(s).some(id=>s.run.workshop.parts[id]!.exportedAt===null);
export const prototypeConditions = (s:GameState):[boolean,boolean,boolean] => [s.run.workshop.entered,completedParts(s).length>=BALANCE.release.prototypeParts,completedParts(s).some(id=>s.run.workshop.parts[id]!.exportedAt!==null)];
export const canInspectDesktopExit = (s:GameState):boolean => s.run.world==='kumiki'&&s.run.workshop.entered&&s.run.workshop.enterMs===0&&setComplete(s,'files')&&setComplete(s,'mail');
export const canAssembleDesktop = (s:GameState):boolean => s.run.world==='kumiki'&&s.run.workshop.entered&&s.run.workshop.enterMs===0
  &&setComplete(s,'files')&&setComplete(s,'mail')&&s.resources.pixels>=BALANCE.w2.desktopCost
  &&s.persistent.specs.color>=BALANCE.release.prototypeColorLevel;
export const workshopPlacementGrid=(s:GameState):number=>BALANCE.workshop.canvas.resolutionGrid[s.persistent.specs.resolution]!;
export function partMinimumSize(s:GameState,id:WorkshopPartId,design?:ComponentDesign):{width:number;height:number} {
  const min=minimumPartSize(id,design??s.run.workshop.parts[id]?.design),grid=workshopPlacementGrid(s);
  return {width:Math.ceil(min.width/grid)*grid,height:Math.ceil(min.height/grid)*grid};
}
/** Snap valid user gestures to the current resolution without ever paying for area. */
export function normalizeWorkshopRect(s:GameState,id:WorkshopPartId,rect:WorkshopRect):WorkshopRect|null {
  if(!rect||!WORKSHOP_PARTS.some(d=>d.id===id)||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))return null;
  const c=BALANCE.workshop.canvas,min=partMinimumSize(s,id),grid=workshopPlacementGrid(s);
  const snap=(value:number)=>Math.round(value/grid)*grid;
  const width=Math.max(Math.ceil(min.width/grid)*grid,Math.min(Math.floor((c.width-c.inset*2)/grid)*grid,snap(rect.width)));
  const height=Math.max(Math.ceil(min.height/grid)*grid,Math.min(Math.floor((c.height-c.inset*2)/grid)*grid,snap(rect.height)));
  return {x:Math.max(c.inset,Math.min(c.width-c.inset-width,snap(rect.x))),y:Math.max(c.inset,Math.min(c.height-c.inset-height,snap(rect.y))),width,height};
}
export function partRectValid(s:GameState,id:WorkshopPartId,rect:WorkshopRect,design?:ComponentDesign):boolean {
  if(!isWorkshopRect(rect)||!workshopRectOnGrid(rect,s.persistent.specs.resolution)||!WORKSHOP_PARTS.some(d=>d.id===id))return false;
  const definition=getWorkshopPart(id),set=definition.set;
  const min=partMinimumSize(s,id,design);
  if(rect.width<min.width||rect.height<min.height)return false;
  return !Object.entries(s.run.workshop.parts).some(([other,p])=>other!==id&&p&&p.step>0&&getWorkshopPart(other as WorkshopPartId).set===set&&!workshopPairValid(id,rect,other as WorkshopPartId,p.rect));
}
function showGuide(s:GameState,id:WorkshopGuideId):GameState {
  const g=s.run.workshop.guide;
  if(g.seen.includes(id))return s;
  return {...s,run:{...s.run,workshop:{...s.run.workshop,guide:{seen:[...g.seen,id],current:id,collapsed:false}}}};
}
function showFirstSetHelp(s:GameState,set:UiSetId):GameState {
  if(s.persistent.testplay.helpSeen.includes(set))return s;
  return {...s,persistent:{...s.persistent,testplay:{...s.persistent.testplay,helpSeen:[...s.persistent.testplay.helpSeen,set]}},run:{...s.run,workshop:{...s.run.workshop,helpTarget:{set}}}};
}
function grantExtraMaterials(s:GameState):GameState {
  const w=s.run.workshop;
  if(!w.entered||!s.persistent.editorSkills.includes('extraParts'))return s;
  const definitions=partsForSet('extras');
  if(w.purchasedSets.includes('extras')&&definitions.every(d=>w.parts[d.id]))return s;
  const parts={...w.parts};
  for(const d of definitions)if(!parts[d.id])parts[d.id]={step:0,rect:{...d.defaultRect},elements:[],design:defaultComponentDesign(s),completedAt:null,exportedAt:null,tested:false};
  return showFirstSetHelp({...s,run:{...s.run,workshop:{...w,purchasedSets:w.purchasedSets.includes('extras')?w.purchasedSets:[...w.purchasedSets,'extras'],parts,activePart:w.activePart??definitions[0]!.id}}},'extras');
}
export function enterWorkshop(s:GameState):GameState {
  if(s.run.workshop.entered)return grantExtraMaterials(s);
  const next:GameState={...s,run:{...s.run,world:'kumiki',workshop:{...s.run.workshop,editorStageAtEntry:editorStage(s),entered:true,enteredAt:s.lastTickAt,enterMs:BALANCE.workshop.enterMs,lastActionAt:s.elapsedMs}}};
  return showGuide(grantExtraMaterials(next),'entered');
}
function writePart(s:GameState,id:WorkshopPartId,part:PartProduction):GameState {
  return {...s,run:{...s.run,workshop:{...s.run.workshop,parts:{...s.run.workshop.parts,[id]:part}}}};
}
function snapshotSet(s:GameState,set:UiSetId,now:number,preserveDate=false):GameState {
  const parts:Partial<Record<WorkshopPartId,PartProduction>>={};
  for(const d of partsForSet(set)) { const p=s.run.workshop.parts[d.id];if(p?.step===4)parts[d.id]=structuredClone(p); }
  if(Object.keys(parts).length===0)return s;
  const id=`${s.run.version}:${set}`,documents=s.persistent.setDocuments,previous=documents.findIndex(d=>d.id===id);
  const setDocument={id,set,version:s.run.version,at:preserveDate&&previous>=0?documents[previous]!.at:now,parts};
  return {...s,persistent:{...s.persistent,setDocuments:previous<0?[...documents,setDocument]:documents.map((d,i)=>i===previous?setDocument:d)}};
}
/** Freeze the complete works of this version before its production state is reset. */
export function archiveCompletedSets(state:GameState,now:number):GameState {
  let next=state;
  for(const set of SET_IDS)if(setComplete(state,set))next=snapshotSet(next,set,now,true);
  return next;
}
const paletteAllows=(s:GameState,color:string):boolean=>/^#[\da-f]{6}$/i.test(color)&&(s.persistent.specs.color>=2||paletteFor(s.persistent.specs.color).includes(color.toLowerCase()));
function designAllowed(s:GameState,d:ComponentDesign):boolean {
  return isComponentDesign(d)&&paletteAllows(s,d.color)&&paletteAllows(s,d.textColor)
    &&Object.values(d.controlColors).every(c=>paletteAllows(s,c))
    &&(editorStage(s)>=2||d.motion==='plain');
}
function payStep(s:GameState,id:WorkshopPartId,index:0|1|2|3,finish=false):GameState {
  const category=getWorkshopPart(id).category,efficiency=s.persistent.editorSkills.includes('efficiency')?BALANCE.workshop.efficiencyMultiplier:1;
  return creditPixels(s,(BALANCE.workshop.categoryStepRewards[category][index]*efficiency+(finish?BALANCE.workshop.finishRewards[category]:0))*productionCreditMultiplier(s));
}
function buySkill(s:GameState,id:EditorSkill):GameState {
  const skill=BALANCE.workshop.skills.find(p=>p.id===id);
  if(!skill||s.persistent.editorSkills.includes(id)||s.resources.tokens<skill.cost||skill.band===2&&s.run.version==='v0.1'&&id!=='modern')return s;
  // The environment unlock is persistent even when the player displays an older desktop.
  if(id==='modern'&&!canSwitchEditor(s))return s;
  let next:GameState={...s,resources:{...s.resources,tokens:s.resources.tokens-skill.cost},persistent:{...s.persistent,editorSkills:[...s.persistent.editorSkills,id]}};
  if(id==='update')next=setEditorStage(next,1);
  if(id==='modern'){
    next=setEditorStage(next,2);
    next={...next,persistent:{...next.persistent,editorCustomization:{...next.persistent.editorCustomization,panelPositions:{palette:'right',tools:'left',parts:'left',info:'bottom'}}}};
  }
  return grantExtraMaterials(next);
}
function customize(s:GameState,patch:Partial<EditorCustomization>):GameState {
  const original=s.persistent.editorCustomization;
  const next={...original,...patch,...(patch.nativeBackground===true?{background:patch.background??BALANCE.workshop.customization.background}:Object.hasOwn(patch,'background')?{nativeBackground:false}:{}),panelPositions:{...original.panelPositions,...patch.panelPositions},panelWidths:{...original.panelWidths,...patch.panelWidths}};
  if(!isEditorCustomization(next)||!paletteAllows(s,next.accent)||!paletteAllows(s,next.background))return s;
  if(editorStage(s)===0){
    const advanced: (keyof EditorCustomization)[]=['docking','panelPositions'];
    if(advanced.some(k=>JSON.stringify(next[k])!==JSON.stringify(original[k])))return s;
  }
  if(JSON.stringify(next.presets)!==JSON.stringify(original.presets)&&(!s.persistent.editorSkills.includes('presets')||!next.presets.every(p=>designAllowed(s,p))))return s;
  return {...s,persistent:{...s.persistent,editorCustomization:structuredClone(next)}};
}
export function actWorkshop(state:GameState,action:WorkshopAction,now:number):GameState {
  if(!Number.isFinite(now)||now<0||!state.run.workshop.entered||!['kumiki','desktop'].includes(state.run.world))return state;
  state=grantExtraMaterials(state);
  let s=state;
  const w=s.run.workshop;
  if(action.type==='help'){
    if(action.target!==null&&!isWorkshopHelpTarget(action.target))return s;
    return {...s,run:{...s.run,workshop:{...w,helpTarget:action.target?{...action.target}:null}}};
  }
  if(action.type==='guide'){
    if(action.id==='close')return {...s,run:{...s.run,workshop:{...w,guide:{...w.guide,current:null,collapsed:true}}}};
    if(!w.guide.seen.includes(action.id))return s;
    return {...s,run:{...s.run,workshop:{...w,guide:{...w.guide,current:action.id,collapsed:false}}}};
  }
  if(w.enterMs>0)return s;
  if(action.type==='buySet'){
    if(!canBuyWorkshopSet(s,action.set))return s;
    const parts={...w.parts};
    for(const d of partsForSet(action.set))parts[d.id]={step:0,rect:{...d.defaultRect},elements:[],design:defaultComponentDesign(s),completedAt:null,exportedAt:null,tested:false};
    s={...s,resources:{...s.resources,pixels:s.resources.pixels-BALANCE.workshop.setCosts[action.set]},run:{...s.run,workshop:{...w,purchasedSets:[...w.purchasedSets,action.set],parts,activePart:partsForSet(action.set)[0]!.id,view:'workbench'}}};
    s=showGuide(s,'place');
    s=showFirstSetHelp(s,action.set);
  }else if(action.type==='selectPart'){
    if(!w.parts[action.part])return s;
    s={...s,run:{...s.run,workshop:{...w,activePart:action.part,view:'workbench'}}};
  }else if(action.type==='skill')s=buySkill(s,action.id);
  else if(action.type==='customize')s=customize(s,action.patch);
  else if(action.type==='view'){
    if(!['workbench','settings','exports'].includes(action.view))return s;
    s={...s,run:{...s.run,workshop:{...w,view:action.view}}};
  }else if(action.type==='zoom'){
    if(!Number.isFinite(action.zoom)||action.zoom<BALANCE.workshop.zoomMin||action.zoom>BALANCE.workshop.zoomMax)return s;
    s={...s,run:{...s.run,workshop:{...w,zoom:action.zoom}}};
  }else if(action.type==='exit'){
    if(!canInspectDesktopExit(s))return s;
    if(s.persistent.specs.color>=BALANCE.release.prototypeColorLevel)return s;
    s=showGuide({...s,run:{...s.run,workshop:{...w,exitInspected:true}}},'wall');
  }else if(action.type==='export'){
    const ids=completedParts(s).filter(id=>(!action.part||id===action.part)&&w.parts[id]!.exportedAt===null);
    if(ids.length===0)return s;
    for(const id of ids)s=writePart(s,id,{...s.run.workshop.parts[id]!,exportedAt:Math.max(now,s.run.workshop.parts[id]!.completedAt!)});
    s={...s,resources:{...s.resources,tokens:s.resources.tokens+ids.length*BALANCE.workshop.exportTokens},run:{...s.run,workshop:{...s.run.workshop,tokenDiscovered:true}}};
    for(const set of new Set(ids.map(id=>getWorkshopPart(id).set)))s=snapshotSet(s,set,now);
    s=showGuide(s,'export');
  }else{
    const id=action.part??w.activePart;if(!id||!w.parts[id])return s;
    const p=w.parts[id]!,descriptor=getWorkshopPart(id);
    if(action.type==='place'){
      const rect=normalizeWorkshopRect(s,id,action.rect);
      if(!rect||!partRectValid(s,id,rect))return s;
      s=writePart(s,id,{...p,rect,step:p.step===0?1:p.step});
      if(p.step===0)s=showGuide(payStep(s,id,0),'elements');
    }else if(action.type==='addElement'){
      if(p.step===0||!descriptor.elements.includes(action.element)||action.side!==undefined&&!['start','end'].includes(action.side)||action.index!==undefined&&(!Number.isSafeInteger(action.index)||action.index<0||action.index>descriptor.elements.length))return s;
      const elements=p.elements.filter(e=>e!==action.element),index=action.index??elements.length;
      elements.splice(Math.min(index,elements.length),0,action.element);
      const design=action.side&&['minimize','maximize','close'].includes(action.element)?{...p.design,controlSides:{...p.design.controlSides,[action.element]:action.side}}:p.design;
      const ready=descriptor.elements.every(e=>elements.includes(e)),nextStep=p.step===1&&ready?2:p.step;
      s=writePart(s,id,{...p,elements,design,step:nextStep});
      if(p.step===1&&ready)s=showGuide(payStep(s,id,1),'adjust');
    }else if(action.type==='adjust'){
      if(p.step<2)return s;
      const design=adjustComponentDesign(p.design,action.patch,paletteFor(s.persistent.specs.color));
      if(!design||!designAllowed(s,design)||!partRectValid(s,id,p.rect,design))return s;
      s=writePart(s,id,{...p,design:structuredClone(design)});
    }else if(action.type==='confirmAdjustment'){
      if(p.step!==2)return s;
      s=showGuide(payStep(writePart(s,id,{...p,step:3}),id,2),'test');
    }else if(action.type==='test'){
      if(p.step!==3||action.interaction!==descriptor.testInteraction&&!descriptor.testAlternatives.includes(action.interaction))return s;
      s=payStep(writePart(s,id,{...p,step:4,completedAt:now,tested:true}),id,3,true);
      if(setComplete(s,descriptor.set))s=snapshotSet(s,descriptor.set,now);
      s=showGuide(s,'complete');
    }
    // A completed set document is the current version's work, while released products stay frozen.
    if(s!==state&&p.step===4&&['place','addElement','adjust'].includes(action.type)&&setComplete(s,descriptor.set))s=snapshotSet(s,descriptor.set,now,true);
  }
  if(s===state)return state;
  const active=s.run.workshop.activePart;
  const resetAssistance=active!==state.run.workshop.activePart||active!==null&&(s.run.workshop.parts[active]?.step??0)>=3;
  return {...s,run:{...s.run,workshop:{...s.run.workshop,lastActionAt:s.elapsedMs,
    ...(resetAssistance?{assistance:{part:active,elapsedMs:0}}:{})}}};
}
/** A job may prepare three stages; the fourth remains a real human inspection. */
export function advanceWorkshopAssistance(state:GameState,ms:number,now:number):GameState {
  if(!Number.isFinite(ms)||ms<=0||!Number.isFinite(now)||now<0)return state;
  const w=state.run.workshop,id=w.activePart,part=id?w.parts[id]:undefined,job=state.run.desktop.jobs.tessera;
  const writeBudget=(s:GameState,elapsedMs:number):GameState=>{
    const current=s.run.workshop.assistance;
    if(current?.part===id&&current.elapsedMs===elapsedMs)return s;
    return {...s,run:{...s.run,workshop:{...s.run.workshop,assistance:{part:id,elapsedMs}}}};
  };
  if(state.run.world!=='desktop'||!state.run.desktop.entered||!w.entered||w.enterMs>0
    ||!state.run.desktop.upgrades.includes('jobs')||!job.assigned||job.cursors<=0||!id||!part||part.step>=3)return writeBudget(state,0);
  const stepMs=BALANCE.workshop.assistStepMs;
  const speed=job.cursors*BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier*BALANCE.w3.updateMultiplier**job.updates;
  if(!Number.isFinite(speed)||speed<=0)return writeBudget(state,0);
  // More time cannot spill into another component or finish the current one.
  const available=3-part.step,cappedMs=Math.min(ms,stepMs*available);
  let budget=Math.min(stepMs*available,(w.assistance?.part===id?w.assistance.elapsedMs:0)+cappedMs*speed),next=state;
  while(budget>=stepMs){
    const current=next.run.workshop.parts[id]!;
    if(current.step>=3)return writeBudget(next,0);
    const before=next;
    if(current.step===0){
      if(!partRectValid(next,id,current.rect))return writeBudget(next,0);
      next=actWorkshop(next,{type:'place',part:id,rect:current.rect},now);
    }else if(current.step===1){
      const missing=getWorkshopPart(id).elements.filter(element=>!current.elements.includes(element));
      if(missing.length)for(const element of missing)next=actWorkshop(next,{type:'addElement',part:id,element},now);
      else next=actWorkshop(next,{type:'addElement',part:id,element:current.elements[0]!,index:0},now);
    }else next=actWorkshop(next,{type:'confirmAdjustment',part:id},now);
    if(next===before||next.run.workshop.parts[id]!.step<=current.step)return writeBudget(next,0);
    budget-=stepMs;
    if(next.run.workshop.parts[id]!.step>=3)return writeBudget(next,0);
  }
  return writeBudget(next,budget);
}
export function advanceWorkshop(s:GameState,ms:number):GameState {
  if(!Number.isFinite(ms)||ms<0||!s.run.workshop.entered)return s;
  s=grantExtraMaterials(s);
  const w=s.run.workshop,enterMs=Math.max(0,w.enterMs-ms);
  let next=enterMs===w.enterMs?s:{...s,run:{...s.run,workshop:{...w,enterMs}}};
  if(next.run.world==='kumiki'&&next.elapsedMs-next.run.workshop.lastActionAt>=BALANCE.workshop.hintMs)next=showGuide(next,'hint');
  return next;
}
