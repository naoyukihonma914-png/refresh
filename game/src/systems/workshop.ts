import { BALANCE, type EditorSkill } from '../config/balance';
import { paletteFor } from '../content/palette';
import { WORKSHOP_PARTS, SET_IDS, getWorkshopPart, type UiSetId, type WorkshopPartId, type WorkshopRect, type TestInteraction } from '../content/workshopCatalog';
import { editorStage, canSwitchEditor, setEditorStage } from './appearance';
import { creditPixels } from './economy';
import { clampPuzzlePoint, puzzlePieceRect, clearPuzzleSelection, ensurePuzzlePositions, puzzleParts, selectPuzzlePart, type PiecePoint } from './workshopPuzzle';
import { productionCreditMultiplier } from './productionModel';
import { grantTesseraUpdateFunds, tesseraUpdatePending } from './workshopUpdate';
import type { GameState } from './state';
import { completionCombo, workshopComboMultiplier } from './workshopExamples';
import { FITTING_PARTS, fittingDefinition, fittingPartsForSet as partsForSet } from '../content/workshopFitting';
import { canFitPiece, defaultPieceSocket, emptyFitting, fittedPieces, fittingComplete, migrateFittingProduction, pieceReward } from './workshopFitting';
import { adjustComponentDesign, createComponentDesign, isComponentDesign, isEditorCustomization, isWorkshopRect, workshopPairValid, workshopRectOnGrid, minimumPartSize, type ComponentDesign, type EditorCustomization, type PartProduction, type WorkshopGuideId, type WorkshopHelpTarget, isWorkshopHelpTarget } from './workshopState';

export type WorkshopAction =
  | {type:'help';target:WorkshopHelpTarget|null}
  | {type:'clearPartSelection';set?:UiSetId} | {type:'togglePart'|'focusPart';part:WorkshopPartId}
  | {type:'togglePiece';part:WorkshopPartId;piece:string} | {type:'stagePiece';part:WorkshopPartId;piece:string;at?:PiecePoint}
  | {type:'buySet';set:UiSetId} | {type:'selectPart';part:WorkshopPartId}
  | {type:'spawnPiece'|'removePiece';part?:WorkshopPartId;piece:string}
  | {type:'fitPiece';part?:WorkshopPartId;piece:string;socket:string}
  | {type:'place';part?:WorkshopPartId;rect:WorkshopRect;example?:boolean}
  | {type:'addElement';part?:WorkshopPartId;element:string;index?:number;side?:'start'|'end'}
  | {type:'adjust';part?:WorkshopPartId;patch:Partial<ComponentDesign>}
  | {type:'confirmAdjustment';part?:WorkshopPartId} | {type:'useExample';part?:WorkshopPartId}
  | {type:'test';part?:WorkshopPartId;interaction:TestInteraction}
  | {type:'export';part?:WorkshopPartId}
  | {type:'customize';patch:Partial<EditorCustomization>}
  | {type:'skill';id:EditorSkill}
  | {type:'view';view:'workbench'|'settings'|'exports'} | {type:'zoom';zoom:number}
  | {type:'exit'} | {type:'guide';id:WorkshopGuideId|'close'};

export const defaultComponentDesign = (_state?:GameState):ComponentDesign => createComponentDesign();
export const completedParts = (s:GameState):WorkshopPartId[] => FITTING_PARTS.filter(d=>s.run.workshop.parts[d.id]?.step===4).map(d=>d.id);
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
  for(const d of definitions)if(!parts[d.id])parts[d.id]={step:1,rect:{...d.defaultRect},elements:[],fitting:emptyFitting(),design:defaultComponentDesign(s),completedAt:null,exportedAt:null,tested:false};
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
function payPiece(s:GameState,id:WorkshopPartId,now:number,firstFit:boolean,finish:boolean,amount=pieceReward(id)):GameState {
  const category=getWorkshopPart(id).category,efficiency=s.persistent.editorSkills.includes('efficiency')?BALANCE.workshop.efficiencyMultiplier:1;
  const reward=(firstFit?amount*efficiency*workshopComboMultiplier(s,now):0)+(finish?BALANCE.workshop.finishRewards[category]:0);
  return reward>0?creditPixels(s,reward*productionCreditMultiplier(s)):s;
}
export function canBuyEditorSkill(s:GameState,id:EditorSkill):boolean {
  const skill=BALANCE.workshop.skills.find(p=>p.id===id);
  return !!skill&&(id==='update'||!tesseraUpdatePending(s))&&!['batch','dimensions','layers','snap','gessoUpdate','brio','brioUpdate'].includes(id)&&!s.persistent.editorSkills.includes(id)&&s.resources.tokens>=skill.cost
    &&!(skill.band>=2&&s.run.version==='v0.1'&&id!=='modern')&&(id!=='modern'||canSwitchEditor(s));
}
function buySkill(s:GameState,id:EditorSkill):GameState {
  if(!canBuyEditorSkill(s,id))return s;
  const skill=BALANCE.workshop.skills.find(p=>p.id===id)!;
  let next:GameState={...s,resources:{...s.resources,tokens:s.resources.tokens-skill.cost},persistent:{...s.persistent,editorSkills:[...s.persistent.editorSkills,id]}};
  if(id==='update'){
    next=setEditorStage(next,1);
    if(next.run.workshop.guide.current==='updateAvailable')next={...next,run:{...next.run,workshop:{...next.run.workshop,guide:{...next.run.workshop.guide,current:null,collapsed:true}}}};
  }
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
  state=grantTesseraUpdateFunds(grantExtraMaterials(state));
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
  if(action.type==='clearPartSelection'&&action.set!==undefined&&!SET_IDS.includes(action.set))return s;
  if(action.type==='clearPartSelection')return {...s,run:{...s.run,workshop:clearPuzzleSelection(w,action.set)}};
  if(action.type==='togglePart')return {...s,run:{...s.run,workshop:selectPuzzlePart(w,action.part,true)}};
  if(action.type==='focusPart')return puzzleParts(w).includes(action.part)?{...s,run:{...s.run,workshop:{...w,activePart:action.part}}}:s;
  if(action.type==='buySet'){
    if(!canBuyWorkshopSet(s,action.set))return s;
    const parts={...w.parts};
    for(const d of partsForSet(action.set))parts[d.id]={step:1,rect:{...d.defaultRect},elements:[],fitting:emptyFitting(),design:defaultComponentDesign(s),completedAt:null,exportedAt:null,tested:false};
    s={...s,resources:{...s.resources,pixels:s.resources.pixels-BALANCE.workshop.setCosts[action.set]},run:{...s.run,workshop:{...w,purchasedSets:[...w.purchasedSets,action.set],parts,activePart:partsForSet(action.set)[0]!.id,view:'workbench'}}};
    s={...s,run:{...s.run,workshop:selectPuzzlePart(s.run.workshop,partsForSet(action.set)[0]!.id)}};
    s=showGuide(s,'place');
    s=showFirstSetHelp(s,action.set);
  }else if(action.type==='selectPart'){
    if(!w.parts[action.part])return s;
    s={...s,run:{...s.run,workshop:selectPuzzlePart(w,action.part)}};
  }else if(action.type==='skill')s=buySkill(s,action.id);
  else if(action.type==='customize')s=customize(s,action.patch);
  else if(action.type==='view'){
    if(!['workbench','settings','exports'].includes(action.view))return s;
    s={...s,run:{...s.run,workshop:{...w,view:action.view}}};
  }else if(action.type==='zoom'){
    if(!Number.isFinite(action.zoom)||action.zoom<BALANCE.workshop.zoomMin||action.zoom>BALANCE.workshop.zoomMax)return s;
    const options=editorStage(s)===0?BALANCE.workshop.eras.era0ZoomOptions:BALANCE.workshop.zoomOptions;
    if(!options.some(value=>value===action.zoom))return s;
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
    s=grantTesseraUpdateFunds(s);
  }else{
    const id=action.part??w.activePart;if(!id||!w.parts[id])return s;
    const p=w.parts[id]!,descriptor=getWorkshopPart(id);
    const current=migrateFittingProduction(p,id,now),definition=fittingDefinition(id);
    if(!current.fitting)return s;
    if(current!==p)s=writePart(s,id,current);
    const fitting=current.fitting;
    if(action.type==='togglePiece'){
      if(!definition.pieces.includes(action.piece)||fitting.sockets[action.piece]!==undefined)return s;
      const hidden=fitting.hidden??[],visible=fitting.spawned.includes(action.piece)&&!hidden.includes(action.piece);
      s=writePart(s,id,{...current,fitting:{...fitting,spawned:fitting.spawned.includes(action.piece)?fitting.spawned:[...fitting.spawned,action.piece],hidden:visible?[...hidden,action.piece]:hidden.filter(piece=>piece!==action.piece)}});
      s={...s,run:{...s.run,workshop:ensurePuzzlePositions(s.run.workshop,[id])}};
    }else if(action.type==='stagePiece'){
      if(!definition.pieces.includes(action.piece)||action.at&&![action.at.x,action.at.y].every(value=>Number.isFinite(value)&&value>=0))return s;
      const sockets={...fitting.sockets};delete sockets[action.piece];
      const f={...fitting,sockets,spawned:fitting.spawned.includes(action.piece)?fitting.spawned:[...fitting.spawned,action.piece],hidden:(fitting.hidden??[]).filter(piece=>piece!==action.piece)};
      s=writePart(s,id,{...current,fitting:f,elements:fittedPieces({...current,fitting:f},id)});
      let next:GameState['run']['workshop']={...s.run.workshop,puzzleSet:getWorkshopPart(id).set,selectedParts:[...new Set([...puzzleParts(s.run.workshop).filter(other=>getWorkshopPart(other).set===getWorkshopPart(id).set),id])],activePart:id};
      next=ensurePuzzlePositions(next,[id]);
      const p=next.parts[id]!,positions={...p.fitting!.positions},previous=positions[action.piece]!;
      positions[action.piece]={...previous,at:clampPuzzlePoint(action.at??previous.origin,puzzlePieceRect(next,id,action.piece))};
      s={...s,run:{...s.run,workshop:{...next,parts:{...next.parts,[id]:{...p,fitting:{...p.fitting!,positions}}}}}};
    }else if(action.type==='spawnPiece'){
      if(!definition.pieces.includes(action.piece)||fitting.spawned.includes(action.piece))return s;
      s=writePart(s,id,{...current,fitting:{...fitting,spawned:[...fitting.spawned,action.piece]}});
    }else if(action.type==='fitPiece'||action.type==='addElement'){
      // addElement remains a developer-fixture alias; the visible flow always spawns then drags.
      const piece=action.type==='fitPiece'?action.piece:action.element;
      const socket=action.type==='fitPiece'?action.socket:defaultPieceSocket(definition,fitting,piece);
      if(!socket||!definition.pieces.includes(piece)||action.type==='fitPiece'&&!fitting.spawned.includes(piece)||!canFitPiece(id,fitting,piece,socket)||fitting.sockets[piece]===socket)return s;
      const firstFit=!fitting.paid.includes(piece);
      const nextFitting={...fitting,sockets:{...fitting.sockets,[piece]:socket},spawned:fitting.spawned.includes(piece)?fitting.spawned:[...fitting.spawned,piece],paid:firstFit?[...fitting.paid,piece]:fitting.paid};
      const prepaid=firstFit?Math.min(pieceReward(id),fitting.prepaid??0):0;
      if(fitting.prepaid!==undefined)nextFitting.prepaid=fitting.prepaid-prepaid;
      let next:PartProduction={...current,fitting:nextFitting};
      next={...next,elements:fittedPieces(next,id)};
      // Older development fixtures iterate the original four frame elements.
      // Convert that fixture call into the integrated scrollbar without exposing a legacy UI path.
      if(action.type==='addElement'&&id==='common-frame'&&descriptor.elements.every(element=>next.elements.includes(element))&&!nextFitting.sockets.scrollbar){
        s=writePart(s,id,next);
        s=payPiece(s,id,now,firstFit,false,pieceReward(id)-prepaid);
        s=actWorkshop(s,{type:'spawnPiece',part:id,piece:'scrollbar'},now);
        return actWorkshop(s,{type:'fitPiece',part:id,piece:'scrollbar',socket:'scrollbar'},now);
      }
      const finish=!fitting.completionPaid&&fittingComplete(next,id);
      if(finish)next={...next,step:4,tested:true,completedAt:now,createdStage:editorStage(s),fitting:{...nextFitting,completionPaid:true}};
      s=payPiece(writePart(s,id,next),id,now,firstFit,finish,pieceReward(id)-prepaid);
      if(fittingComplete(next,id))s={...s,run:{...s.run,workshop:{...s.run.workshop,selectedParts:puzzleParts(s.run.workshop).filter(part=>part!==id)}}};
      if(finish){
        s={...s,run:{...s.run,workshop:{...s.run.workshop,combo:completionCombo(s,now)}}};
        if(s.run.workshop.guide.current==='updateAvailable')s={...s,run:{...s.run,workshop:{...s.run.workshop,guide:{...s.run.workshop.guide,current:null,collapsed:true}}}};
        if(setComplete(s,descriptor.set))s=snapshotSet(s,descriptor.set,now);
        s=showGuide(s,'complete');
      }
    }else if(action.type==='removePiece'){
      if(!Object.hasOwn(fitting.sockets,action.piece))return s;
      const sockets={...fitting.sockets};delete sockets[action.piece];
      const next={...current,fitting:{...fitting,sockets}};
      s=writePart(s,id,{...next,elements:fittedPieces(next,id)});
    }else if(action.type==='adjust'||action.type==='useExample'){
      // Appearance is optional at every point; socket placement owns control order and side.
      const patch=action.type==='useExample'?defaultComponentDesign(s):{...action.patch,controlSide:current.design.controlSide,controlSides:current.design.controlSides};
      const design=adjustComponentDesign(current.design,patch,paletteFor(s.persistent.specs.color));
      if(!design||!designAllowed(s,design)||!partRectValid(s,id,current.rect,design))return s;
      s=writePart(s,id,{...current,design:structuredClone(design)});
    }
    // A completed set document is the current version's work, while released products stay frozen.
    if(s!==state&&p.step===4&&['fitPiece','removePiece','addElement','adjust','useExample'].includes(action.type)&&setComplete(s,descriptor.set))s=snapshotSet(s,descriptor.set,now,true);
  }
  if(s===state)return state;
  const active=s.run.workshop.activePart;
  const resetAssistance=active!==state.run.workshop.activePart||active!==null&&s.run.workshop.parts[active]?.step===4;
  return {...s,run:{...s.run,workshop:{...s.run.workshop,lastActionAt:s.elapsedMs,
    ...(resetAssistance?{assistance:{part:active,elapsedMs:0}}:{})}}};
}
/** A cursor fits one missing piece at a time; exporting remains an explicit action. */
export function advanceWorkshopAssistance(state:GameState,ms:number,now:number):GameState {
  if(!Number.isFinite(ms)||ms<=0||!Number.isFinite(now)||now<0)return state;
  const w=state.run.workshop,id=w.activePart,part=id?w.parts[id]:undefined,job=state.run.desktop.jobs.tessera;
  const writeBudget=(s:GameState,elapsedMs:number):GameState=>{
    const current=s.run.workshop.assistance;
    if(current?.part===id&&current.elapsedMs===elapsedMs)return s;
    return {...s,run:{...s.run,workshop:{...s.run.workshop,assistance:{part:id,elapsedMs}}}};
  };
  if(state.run.world!=='desktop'||!state.run.desktop.entered||!w.entered||w.enterMs>0||!state.run.desktop.upgrades.includes('jobs')||!job.assigned||job.cursors<=0||!id||!part||part.step===4)return writeBudget(state,0);
  const interval=BALANCE.workshop.assistStepMs,speed=job.cursors*BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier*BALANCE.w3.updateMultiplier**job.updates;
  if(!Number.isFinite(speed)||speed<=0)return writeBudget(state,0);
  const definition=fittingDefinition(id),missing=definition.pieces.filter(piece=>!part.elements.includes(piece));
  let budget=Math.min(interval*missing.length,(w.assistance?.part===id?w.assistance.elapsedMs:0)+ms*speed),next=state;
  for(const piece of missing){
    if(budget<interval)break;
    next=actWorkshop(next,{type:'spawnPiece',part:id,piece},now);
    const fitting=next.run.workshop.parts[id]?.fitting;
    const socket=fitting?defaultPieceSocket(definition,fitting,piece):null;
    if(!socket)break;
    const before=next;next=actWorkshop(next,{type:'fitPiece',part:id,piece,socket},now);
    if(next===before)break;
    budget-=interval;
  }
  return writeBudget(next,next.run.workshop.parts[id]?.step===4?0:budget%interval);
}
export function advanceWorkshop(s:GameState,ms:number):GameState {
  if(!Number.isFinite(ms)||ms<0||!s.run.workshop.entered)return s;
  s=grantTesseraUpdateFunds(grantExtraMaterials(s));
  const w=s.run.workshop,enterMs=Math.max(0,w.enterMs-ms);
  let next=enterMs===w.enterMs?s:{...s,run:{...s.run,workshop:{...w,enterMs}}};
  if(next.run.world==='kumiki'&&!tesseraUpdatePending(next)&&next.elapsedMs-next.run.workshop.lastActionAt>=BALANCE.workshop.hintMs)next=showGuide(next,'hint');
  return next;
}
