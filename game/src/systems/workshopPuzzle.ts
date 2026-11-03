import { BALANCE } from '../config/balance';
import { getWorkshopPart, type UiSetId, type WorkshopPartId, type WorkshopRect } from '../content/workshopCatalog';
import { fittingDefinition } from '../content/workshopFitting';
import { fittingSocketRects } from '../content/workshopFittingGeometry';
import type { WorkshopState } from './workshopState';
import { emptyFitting } from './workshopFitting';

export interface PiecePoint {x:number;y:number}
export interface LoosePiecePosition {origin:PiecePoint;at:PiecePoint}
export const puzzleParts=(w:WorkshopState):WorkshopPartId[]=>w.selectedParts??(w.activePart&&w.activePart!=='common-scrollbar'?[w.activePart]:[]);
export const puzzleSet=(w:WorkshopState):UiSetId=>w.puzzleSet??(w.activePart?getWorkshopPart(w.activePart).set:'common');
export function puzzlePieceVisible(w:WorkshopState,id:WorkshopPartId,piece:string):boolean {
 const f=w.parts[id]?.fitting;
 return puzzleParts(w).includes(id)&&!!f?.spawned.includes(piece)&&!f.hidden?.includes(piece)&&f.sockets[piece]===undefined;
}
export function puzzlePieceRect(w:WorkshopState,id:WorkshopPartId,piece:string):WorkshopRect {
 const part=getWorkshopPart(id),p=w.parts[id],f=p?.fitting,d=fittingDefinition(id);
 const seat=f?.sockets[piece]??d.sockets.find(socket=>socket.accepts.includes(piece))!.id;
 return fittingSocketRects(part,p?.rect??part.defaultRect,p?.design.scrollbarWidth)[seat]!;
}
export const puzzleBounds=()=>({width:BALANCE.workshop.fitting.boardWidth,height:BALANCE.workshop.fitting.boardHeight});
export function puzzlePointInside(point:PiecePoint,r:Pick<WorkshopRect,'width'|'height'>):boolean {
 const bounds=puzzleBounds();return point.x>=0&&point.y>=0&&point.x+r.width<=bounds.width&&point.y+r.height<=bounds.height;
}
export function clampPuzzlePoint(point:PiecePoint,r:Pick<WorkshopRect,'width'|'height'>):PiecePoint {
 const bounds=puzzleBounds();return {x:Math.max(0,Math.min(bounds.width-r.width,point.x)),y:Math.max(0,Math.min(bounds.height-r.height,point.y))};
}
/** Preserve in-range positions, reserving origins even after hiding/fitting. */
export function ensurePuzzlePositions(w:WorkshopState,ids:readonly WorkshopPartId[],repairOnly=false):WorkshopState {
 const c=BALANCE.workshop.canvas,f=BALANCE.workshop.fitting,inset=f.boardInset,gap=f.puzzleGap,bounds=puzzleBounds();
 const set=ids[0]?getWorkshopPart(ids[0]).set:puzzleSet(w);
 const entries=Object.entries(w.parts).filter(([key,p])=>p&&getWorkshopPart(key as WorkshopPartId).set===set) as [WorkshopPartId,NonNullable<WorkshopState['parts'][WorkshopPartId]>][];
 const size=(id:WorkshopPartId,piece:string)=>{const r=puzzlePieceRect(w,id,piece);return {...r,width:id==='common-frame'&&piece==='scrollbar'?BALANCE.workshop.design.scrollbarMax:r.width};};
 const occupied:WorkshopRect[]=entries.flatMap(([id,p])=>Object.entries(p.fitting?.positions??{}).flatMap(([piece,pos])=>{
  const r=size(id,piece),actual=puzzlePieceRect(w,id,piece);return [pos.origin,pos.at].flatMap((point,index)=>puzzlePointInside(point,actual)?[{...point,width:index===0?r.width:actual.width,height:r.height}]:[]);
 }));
 const free=(r:WorkshopRect):PiecePoint=>{
  const start=c.height+f.frameTitleHeight+inset+f.pieceAreaGap;
  const ys=[start,...occupied.map(o=>o.y+o.height+gap)].filter(y=>y>=start&&y+r.height<=bounds.height-inset).sort((a,b)=>a-b);
  for(const y of ys){
   let x=inset;
   for(const o of occupied.filter(o=>o.y<y+r.height+gap&&o.y+o.height+gap>y).sort((a,b)=>a.x-b.x))if(x<o.x+o.width+gap&&x+r.width+gap>o.x)x=o.x+o.width+gap;
   if(x+r.width<=bounds.width-inset)return {x,y};
  }
  // Old free placements may fragment the lower area: use an empty margin beside the destination.
  for(const y of [inset,...occupied.map(o=>o.y+o.height+gap)].sort((a,b)=>a-b)){
   const x=c.width+inset*2;if(y+r.height>bounds.height-inset||x+r.width>bounds.width-inset)continue;
   if(occupied.every(o=>x+r.width+gap<=o.x||o.x+o.width+gap<=x||y+r.height+gap<=o.y||o.y+o.height+gap<=y))return {x,y};
  }
  // A densely edited legacy layout can be recovered by the bounded canonical allocation below.
  throw new Error('puzzle-layout-capacity');
 };
 let result=w;
 try{
  for(const [id,p] of entries){
   if(!p.fitting)continue;
   const positions={...p.fitting.positions};let changed=false;
   const pieces=repairOnly||!ids.includes(id)?Object.keys(positions):p.fitting.spawned;
   for(const piece of pieces){
    const previous=positions[piece],r=size(id,piece),actual=puzzlePieceRect(w,id,piece);
    if(!previous&&p.fitting.sockets[piece]!==undefined)continue;
    if(previous&&puzzlePointInside(previous.origin,actual)&&puzzlePointInside(previous.at,actual))continue;
    const origin=previous&&puzzlePointInside(previous.origin,actual)?previous.origin:free(r);
    const at=previous&&puzzlePointInside(previous.at,actual)?previous.at:origin;
    positions[piece]={origin:{...origin},at:{...at}};occupied.push({...origin,width:r.width,height:r.height},{...at,width:r.width,height:r.height});changed=true;
   }
   if(changed)result={...result,parts:{...result.parts,[id]:{...p,fitting:{...p.fitting,positions}}}};
  }
 }catch(error){
  if(!(error instanceof Error)||error.message!=='puzzle-layout-capacity')throw error;
  // Only when an imported layout leaves no contiguous space, restore its origins to compact rows.
  let x=inset,y=c.height+f.frameTitleHeight+inset+f.pieceAreaGap,row=0;
  for(const [id,p] of entries){
   if(!p.fitting)continue;
   const positions={...p.fitting.positions};
   for(const piece of new Set([...Object.keys(positions),...(!repairOnly&&ids.includes(id)?p.fitting.spawned:[])])){
    const r=size(id,piece);if(x+r.width>bounds.width-inset){x=inset;y+=row+gap;row=0;}
    const origin={x,y},at=positions[piece]?.at;
    positions[piece]={origin,at:at&&puzzlePointInside(at,puzzlePieceRect(w,id,piece))?at:{...origin}};x+=r.width+gap;row=Math.max(row,r.height);
   }
   result={...result,parts:{...result.parts,[id]:{...p,fitting:{...p.fitting,positions}}}};
  }
 }
 return result;
}
/** Repair only coordinates already present in a live save, without touching frozen documents. */
export function repairPuzzlePositions(w:WorkshopState):WorkshopState {
 let result=w;
 for(const set of new Set(Object.keys(w.parts).map(id=>getWorkshopPart(id as WorkshopPartId).set))){
  const ids=Object.keys(w.parts).filter(id=>getWorkshopPart(id as WorkshopPartId).set===set) as WorkshopPartId[];
  result=ensurePuzzlePositions(result,ids,true);
 }
 return result;
}
export function clearPuzzleSelection(w:WorkshopState,set:UiSetId=puzzleSet(w)):WorkshopState {
 return {...w,selectedParts:[],puzzleSet:set,activePart:null};
}
export function selectPuzzlePart(w:WorkshopState,id:WorkshopPartId,toggle=false):WorkshopState {
 const p=w.parts[id];if(!p||id==='common-scrollbar')return w;
 const set=getWorkshopPart(id).set,current=puzzleSet(w)===set?puzzleParts(w):[];
 const selected=toggle?(current.includes(id)?current.filter(part=>part!==id):[...current,id]):[id];
 let result:WorkshopState={...w,puzzleSet:set,selectedParts:selected,activePart:selected.includes(id)?id:selected.at(-1)??null,view:'workbench'};
 if(selected.includes(id)){
  const fitting=p.fitting??emptyFitting();
  result={...result,parts:{...result.parts,[id]:{...p,fitting:{...fitting,spawned:[...fittingDefinition(id).pieces],hidden:[]}}}};
  result=ensurePuzzlePositions(result,[id]);
 }
 return result;
}
