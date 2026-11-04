import { BALANCE } from '../config/balance';
import { commonPartIds, GROUP_IDS, GROUP_TOOLS, groupCategory, groupCost, groupTool, toolFinishReward, toolParts, toolPieceReward, toolsInGroup, type GroupCategory, type WorkshopGroupId, type WorkshopToolId } from '../content/workshopGroups';
import { getWorkshopPart, type WorkshopPartId } from '../content/workshopCatalog';
import { fittingDefinition } from '../content/workshopFitting';
import { editorStage } from './appearance';
import { creditPixels } from './economy';
import { productionCreditMultiplier } from './productionModel';
import { createComponentDesign, type ComponentDesign, type PartProduction } from './workshopState';
import { type GroupPuzzleState, type GroupToolState } from './groupPuzzleState';
import { defaultPieceSocket, emptyFitting, fittedPieces } from './workshopFitting';
import { actWorkshop } from './workshop';
import { completionCombo, workshopComboMultiplier } from './workshopExamples';
import { grantTesseraUpdateFunds } from './workshopUpdate';
import type { GameState } from './state';
import type { PiecePoint } from './workshopPuzzle';
export type GroupPuzzleAction=
 | {type:'groupBuy';group:WorkshopGroupId} | {type:'groupSelect';group:WorkshopGroupId}
 | {type:'groupCategory';category:GroupCategory}
 | {type:'groupFocus';tool:WorkshopToolId;part?:WorkshopPartId}
 | {type:'groupToggle';tool:WorkshopToolId;piece:string}
 | {type:'groupPlace';tool:WorkshopToolId;at:PiecePoint}
 | {type:'groupFit';tool:WorkshopToolId;piece:string}
 | {type:'groupStage';tool:WorkshopToolId;piece:string;at?:PiecePoint}
 | {type:'groupAdjust';tool:WorkshopToolId;part:WorkshopPartId;patch:Partial<ComponentDesign>};
export const isGroupPuzzleAction=(action:{type:string}):action is GroupPuzzleAction=>action.type.startsWith('group');
export const groupBounds=()=>BALANCE.workshop.groupPuzzle;
export function clampGroupPoint(at:PiecePoint,width:number,height:number):PiecePoint {
 const b=groupBounds();return {x:Math.max(b.inset,Math.min(b.width-b.inset-width,at.x)),y:Math.max(b.inset,Math.min(b.height-b.inset-height,at.y))};
}
const write=(s:GameState,g:GroupPuzzleState):GameState=>({...s,run:{...s.run,workshop:{...s.run.workshop,groupPuzzle:g,lastActionAt:s.elapsedMs}}});
export function materialProduction(id:WorkshopPartId,now:number,design=createComponentDesign(),complete=false,stage:0|1|2=0):PartProduction {
 const f=emptyFitting();if(complete)for(const piece of fittingDefinition(id).pieces){const seat=defaultPieceSocket(fittingDefinition(id),f,piece);if(seat){f.sockets[piece]=seat;f.spawned.push(piece);f.paid.push(piece);}}
 f.completionPaid=complete;
 const p:PartProduction={step:complete?4:1,rect:{...getWorkshopPart(id).defaultRect},fitting:f,elements:[],design:structuredClone(design),tested:complete,completedAt:complete?now:null,exportedAt:null,...(complete?{createdStage:stage}:{})};
 return {...p,elements:fittedPieces(p,id)};
}
export function initializeGroupWorkshop(s:GameState):GameState {
 if(!s.run.workshop.groupPuzzle)return s;
 const w=s.run.workshop,parts={...w.parts};for(const id of commonPartIds)parts[id]??=materialProduction(id,s.lastTickAt,undefined,true,editorStage(s));
 return {...s,run:{...s.run,workshop:{...w,parts,purchasedSets:[...new Set([...w.purchasedSets,'common' as const])],helpTarget:null}}};
}
export function canBuyGroup(s:GameState,group:WorkshopGroupId):boolean {
 const g=s.run.workshop.groupPuzzle,w=s.run.workshop;
 return !!g&&GROUP_IDS.includes(group)&&w.entered&&w.enterMs===0&&['kumiki','desktop'].includes(s.run.world)&&!g.purchased.includes(group)&&s.resources.pixels>=groupCost(group)
  &&(group!=='foundation'||['files','mail'].every(id=>g.tools[id as WorkshopToolId]?.completedAt!=null))
  &&(group!=='extras'||s.persistent.editorSkills.includes('extraParts'))
  &&(group!=='stream'||s.run.world==='desktop'&&s.run.version===BALANCE.world4.minimumVersion);
}
function allocate(g:GroupPuzzleState,group:WorkshopGroupId):GroupPuzzleState {
 const b=groupBounds(),tools=toolsInGroup(group),occupied=tools.flatMap(tool=>Object.entries(g.tools[tool.id]?.positions??{}).flatMap(([piece,pos])=>{const r=tool.pieces.find(item=>item.id===piece)!.rect;return [pos.origin,pos.at].map(point=>({...point,width:r.width,height:r.height}));}));
 let next=g;
 // Round-robin interleaving mixes tools rather than presenting one tool's complete kit first.
 for(let index=0;index<Math.max(0,...tools.map(tool=>tool.pieces.length));index++)for(const tool of (index%2===0&&index>0?[...tools].reverse():tools)){
  const piece=tool.pieces[index],current=next.tools[tool.id];if(!piece||!current||current.positions[piece.id])continue;
  const r=piece.rect;let found:PiecePoint|undefined;
  for(const y of [b.inset,...occupied.map(o=>o.y+o.height+b.gap)].sort((a,b)=>a-b)){
   if(y+r.height>b.height-b.inset)continue;let x=b.inset;
   for(const o of occupied.filter(o=>o.y<y+r.height+b.gap&&o.y+o.height+b.gap>y).sort((a,b)=>a.x-b.x))if(x<o.x+o.width+b.gap&&x+r.width+b.gap>o.x)x=o.x+o.width+b.gap;
   if(x+r.width<=b.width-b.inset){found={x,y};break;}
  }
  if(!found)throw new Error('group-piece-capacity');
  occupied.push({...found,width:r.width,height:r.height});
  next={...next,tools:{...next.tools,[tool.id]:{...current,positions:{...current.positions,[piece.id]:{origin:{...found},at:{...found}}}}}};
 }
 return next;
}
export function buyGroup(s:GameState,group:WorkshopGroupId,now:number):GameState {
 if(!canBuyGroup(s,group))return s;
 let g=s.run.workshop.groupPuzzle!;const w=s.run.workshop,parts={...w.parts},tools={...g.tools};
 if(group==='stream'){
  const legacy=actWorkshop(s,{type:'buySet',set:'stream'},now);return write(legacy,{...g,purchased:[...g.purchased,group],selected:group,category:'optional',focus:null,customPart:null});
 }
 for(const definition of toolsInGroup(group)){
  const designs:GroupToolState['designs']={};for(const id of [...commonPartIds,...toolParts(definition)])designs[id]=createComponentDesign();
  tools[definition.id]={positions:{},placed:false,locked:false,fitted:{},hidden:[],paid:[],completedAt:null,completionPaid:false,createdStage:editorStage(s),designs};
  for(const id of toolParts(definition))parts[id]??=materialProduction(id,now,designs[id]);
 }
 g=allocate({...g,tools,purchased:[...g.purchased,group],selected:group,category:groupCategory(group),focus:toolsInGroup(group)[0]?.id??null,customPart:null,assistMs:0},group);
 s={...s,resources:{...s.resources,pixels:s.resources.pixels-groupCost(group)},run:{...s.run,workshop:{...w,parts,purchasedSets:[...new Set([...w.purchasedSets,...toolsInGroup(group).map(tool=>tool.set)])],activePart:toolsInGroup(group)[0]?toolParts(toolsInGroup(group)[0]!)[0]??null:null,view:'workbench'}}};
 return write(s,g);
}
export function actGroupPuzzle(s:GameState,action:GroupPuzzleAction,now:number):GameState {
 let g=s.run.workshop.groupPuzzle;if(!g||s.run.workshop.enterMs>0)return s;
 if(action.type==='groupBuy')return buyGroup(s,action.group,now);
 if(action.type==='groupCategory')return ['required','desktop','optional'].includes(action.category)?write(s,{...g,category:action.category,selected:GROUP_IDS.find(group=>groupCategory(group)===action.category)??null,focus:null,customPart:null}):s;
 if(action.type==='groupSelect'){
  if(!GROUP_IDS.includes(action.group))return s;
  const tools={...g.tools};if(action.group!==g.selected)for(const definition of toolsInGroup(action.group)){const p=tools[definition.id];if(p&&!p.completionPaid)tools[definition.id]={...p,hidden:[]};}
  return {...write(s,{...g,tools,selected:action.group,category:groupCategory(action.group),focus:null,customPart:null,assistMs:0}),run:{...s.run,workshop:{...s.run.workshop,groupPuzzle:{...g,tools,selected:action.group,category:groupCategory(action.group),focus:null,customPart:null,assistMs:0},view:'workbench',...(action.group==='stream'?{puzzleSet:'stream',selectedParts:[]}:{}),lastActionAt:s.elapsedMs}}};
 }
 const current=g.tools[action.tool];if(!current)return s;const definition=groupTool(action.tool);if(g.selected!==definition.group)return s;
 if(action.type==='groupFocus'){
  const part=action.part??toolParts(definition)[0]??'common-frame';
  if(![...commonPartIds,...toolParts(definition)].includes(part))return s;
  return {...write(s,{...g,focus:action.tool,customPart:action.part??null,assistMs:0}),run:{...s.run,workshop:{...s.run.workshop,groupPuzzle:{...g,focus:action.tool,customPart:action.part??null,assistMs:0},activePart:part,lastActionAt:s.elapsedMs}}};
 }
 if(action.type==='groupAdjust'){
  if(![...commonPartIds,...toolParts(definition)].includes(action.part))return s;
  const p=s.run.workshop.parts[action.part];if(!p)return s;
  const before=current.designs[action.part]??createComponentDesign();
  const staged={...s,run:{...s.run,workshop:{...s.run.workshop,parts:{...s.run.workshop.parts,[action.part]:{...p,design:before}}}}};
  const adjusted=actWorkshop(staged,{type:'adjust',part:action.part,patch:action.patch},now),design=adjusted.run.workshop.parts[action.part]!.design;
  if(JSON.stringify(design)===JSON.stringify(before))return s;
  return write(adjusted,{...g,tools:{...g.tools,[action.tool]:{...current,designs:{...current.designs,[action.part]:design}}}});
 }
 if(current.completionPaid)return s;
 const id=action.type==='groupPlace'?definition.base:action.piece,piece=definition.pieces.find(piece=>piece.id===id);if(!piece)return s;
 let next={...current,positions:{...current.positions},fitted:{...current.fitted},hidden:[...current.hidden],paid:[...current.paid]};
 if(action.type==='groupToggle'){
  if(current.fitted[id]||id===definition.base&&current.placed)return s;
  next.hidden=next.hidden.includes(id)?next.hidden.filter(piece=>piece!==id):[...next.hidden,id];
 }else if(action.type==='groupPlace'){
  if(current.locked||![action.at.x,action.at.y].every(Number.isFinite))return s;
  next.placed=true;next.positions[id]={...next.positions[id]!,at:clampGroupPoint(action.at,definition.width,definition.height)};next.hidden=next.hidden.filter(piece=>piece!==id);
 }else if(action.type==='groupFit'){
  if(id===definition.base||!current.placed||current.fitted[id])return s;
  next.fitted[id]={x:piece.rect.x,y:piece.rect.y};next.locked=true;next.hidden=next.hidden.filter(piece=>piece!==id);
 }else if(action.type==='groupStage'){
  if(id===definition.base&&current.locked||action.at&&![action.at.x,action.at.y].every(Number.isFinite))return s;
  delete next.fitted[id];if(id===definition.base)next.placed=false;
  next.positions[id]={...next.positions[id]!,at:clampGroupPoint(action.at??next.positions[id]!.origin,piece.rect.width,piece.rect.height)};next.hidden=next.hidden.filter(piece=>piece!==id);
 }
 const fitting=action.type==='groupFit'||action.type==='groupPlace',first=fitting&&!current.paid.includes(id);
 if(first)next.paid.push(id);
 const complete=next.placed&&Object.keys(next.fitted).length===definition.pieces.length-1;
 if(complete)next={...next,completedAt:now,completionPaid:true};
 const lifted=`${action.tool}:${id}`,stack=g.stack.filter(key=>key!==lifted&&(!complete||!key.startsWith(`${action.tool}:`)));
 if(!fitting&&!complete)stack.push(lifted);
 g={...g,stack,tools:{...g.tools,[action.tool]:next},shelf:complete?[...g.shelf,action.tool]:g.shelf,focus:complete&&g.focus===action.tool?null:g.focus,customPart:complete?null:g.customPart};
 s=write(s,g);
 // A merged element supplies the old material identities used by the desktop and production ledger.
 if(first){const parts={...s.run.workshop.parts};for(const part of piece.parts)parts[part]=materialProduction(part,now,next.designs[part],true,editorStage(s));s={...s,run:{...s.run,workshop:{...s.run.workshop,parts}}};}
 if(first)s=creditPixels(s,toolPieceReward(definition)*(s.persistent.editorSkills.includes('efficiency')?BALANCE.workshop.efficiencyMultiplier:1)*workshopComboMultiplier(s,now)*productionCreditMultiplier(s));
 if(complete){
  const parts={...s.run.workshop.parts};for(const part of toolParts(definition))parts[part]={...parts[part]!,exportedAt:now};
  const document={id:`${s.run.version}:${definition.set}`,set:definition.set,version:s.run.version,at:now,parts:Object.fromEntries(toolParts(definition).map(id=>[id,structuredClone(parts[id]!)]))};
  s={...s,resources:{...s.resources,tokens:s.resources.tokens+definition.tokens},persistent:{...s.persistent,setDocuments:[...s.persistent.setDocuments.filter(doc=>doc.id!==document.id),document]},run:{...s.run,workshop:{...s.run.workshop,parts,tokenDiscovered:true,combo:completionCombo(s,now)}}};
  s=creditPixels(s,toolFinishReward(definition)*productionCreditMultiplier(s));s=grantTesseraUpdateFunds(s);
 }
 return s;
}
export const currentGroupTools=(g:GroupPuzzleState)=>g.selected?toolsInGroup(g.selected).filter(tool=>g.tools[tool.id]):[];
export const looseGroupPiece=(p:GroupToolState,base:string,piece:string)=>!p.completionPaid&&!p.hidden.includes(piece)&&!(piece===base?p.placed:p.fitted[piece]);

/** Route material requests from the desktop/builder back to their owning tool. */
export function focusGroupMaterial(s:GameState,part:WorkshopPartId,now:number):GameState {
 const g=s.run.workshop.groupPuzzle;if(!g)return actWorkshop(s,{type:'selectPart',part},now);
 const tool=GROUP_TOOLS.find(tool=>toolParts(tool).includes(part))??GROUP_TOOLS.find(tool=>tool.id===g.focus)??GROUP_TOOLS.find(tool=>g.tools[tool.id]);
 if(!tool||!g.tools[tool.id])return s;
 const next=actWorkshop(s,{type:'groupSelect',group:tool.group},now);
 return actWorkshop(next,{type:'groupFocus',tool:tool.id,part},now);
}
