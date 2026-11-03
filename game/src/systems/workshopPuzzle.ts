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
/** Origins remain reserved even after hiding/fitting. A new piece never repacks existing ones. */
export function ensurePuzzlePositions(w:WorkshopState,ids:readonly WorkshopPartId[]):WorkshopState {
 const c=BALANCE.workshop.canvas,f=BALANCE.workshop.fitting,inset=f.boardInset,gap=f.puzzleGap;
 const occupied:WorkshopRect[]=Object.entries(w.parts).flatMap(([key,p])=>{
  const id=key as WorkshopPartId;if(!p||getWorkshopPart(id).set!==puzzleSet(w))return [];
  return Object.entries(p.fitting?.positions??{}).flatMap(([piece,pos])=>{
   const r=puzzlePieceRect(w,id,piece),width=id==='common-frame'&&piece==='scrollbar'?BALANCE.workshop.design.scrollbarMax:r.width;
   return [{...pos.origin,width,height:r.height},{...pos.at,width,height:r.height}];
  });
 });
 let result=w;
 for(const id of ids){
  const p=result.parts[id];if(!p?.fitting)continue;
  const positions={...p.fitting.positions};let changed=false;
  for(const piece of p.fitting.spawned){
   if(positions[piece]||p.fitting.sockets[piece]!==undefined)continue;
   const r=puzzlePieceRect(result,id,piece),width=id==='common-frame'&&piece==='scrollbar'?BALANCE.workshop.design.scrollbarMax:r.width;
   let y=c.height+f.frameTitleHeight+inset+f.pieceAreaGap,x=inset;
   for(;;){
    x=inset;
    const row=occupied.filter(o=>o.y<y+r.height+gap&&o.y+o.height+gap>y).sort((a,b)=>a.x-b.x);
    for(const o of row)if(x<o.x+o.width+gap&&x+width+gap>o.x)x=o.x+o.width+gap;
    if(x+width<=c.width+inset)break;
    y=Math.min(...row.map(o=>o.y+o.height+gap).filter(bottom=>bottom>y));
   }
   const point={x,y};positions[piece]={origin:{...point},at:{...point}};
   occupied.push({x,y,width,height:r.height});changed=true;
  }
  if(changed)result={...result,parts:{...result.parts,[id]:{...p,fitting:{...p.fitting,positions}}}};
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
