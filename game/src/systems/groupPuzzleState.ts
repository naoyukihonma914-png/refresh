import { BALANCE } from '../config/balance';
import { GROUP_IDS, GROUP_TOOLS, commonPartIds, groupCategory, groupTool, toolParts, type GroupCategory, type WorkshopGroupId, type WorkshopToolId } from '../content/workshopGroups';
import type { ComponentDesign } from './workshopState';
import type { WorkshopPartId } from '../content/workshopCatalog';
import type { LoosePiecePosition, PiecePoint } from './workshopPuzzle';
export interface GroupToolState {
 positions:Record<string,LoosePiecePosition>; placed:boolean; locked:boolean;
 fitted:Record<string,PiecePoint>; hidden:string[]; paid:string[];
 completedAt:number|null; completionPaid:boolean; createdStage:0|1|2;
 designs:Partial<Record<WorkshopPartId,ComponentDesign>>;
}
export interface GroupPuzzleState {
 purchased:WorkshopGroupId[];category:GroupCategory;selected:WorkshopGroupId|null;
 focus:WorkshopToolId|null;customPart:WorkshopPartId|null;
 tools:Partial<Record<WorkshopToolId,GroupToolState>>;shelf:WorkshopToolId[];stack:string[];assistMs:number;
}
export const createGroupPuzzleState=():GroupPuzzleState=>({purchased:[],category:'required',selected:'required',focus:null,customPart:null,tools:{},shelf:[],stack:[],assistMs:0});
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const amount=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const point=(x:unknown):x is PiecePoint=>record(x)&&amount(x.x)&&amount(x.y);
const list=(x:unknown,allowed:readonly string[]):x is string[]=>Array.isArray(x)&&new Set(x).size===x.length&&x.every(id=>allowed.includes(id));
export function isGroupPuzzleState(x:unknown,isDesign:(x:unknown)=>boolean):x is GroupPuzzleState {
 if(!record(x)||!list(x.purchased,GROUP_IDS)||!['required','desktop','optional'].includes(x.category as string)
  ||x.selected!==null&&(!GROUP_IDS.includes(x.selected as WorkshopGroupId)||groupCategory(x.selected as WorkshopGroupId)!==x.category)
  ||!record(x.tools)||!list(x.shelf,GROUP_TOOLS.map(tool=>tool.id))||!list(x.stack,GROUP_TOOLS.flatMap(tool=>tool.pieces.map(piece=>`${tool.id}:${piece.id}`)))||!amount(x.assistMs)||x.assistMs>=BALANCE.workshop.assistStepMs)return false;
 if(x.focus!==null&&(!GROUP_TOOLS.some(tool=>tool.id===x.focus)||!x.tools[x.focus as string]))return false;
 if(x.focus!==null&&groupTool(x.focus as WorkshopToolId).group!==x.selected)return false;
 if(x.customPart!==null&&(typeof x.customPart!=='string'||x.focus===null||![...commonPartIds,...toolParts(groupTool(x.focus as WorkshopToolId))].includes(x.customPart as WorkshopPartId)))return false;
 for(const [id,value] of Object.entries(x.tools)){
  if(!GROUP_TOOLS.some(tool=>tool.id===id)||!record(value))return false;
  const tool=groupTool(id as WorkshopToolId),ids=tool.pieces.map(piece=>piece.id),designIds=[...commonPartIds,...toolParts(tool)];
  if(!x.purchased.includes(tool.group)||typeof value.placed!=='boolean'||typeof value.locked!=='boolean'||typeof value.completionPaid!=='boolean'
   ||!record(value.positions)||!Object.entries(value.positions).every(([id,p])=>{const r=tool.pieces.find(piece=>piece.id===id)?.rect;return r&&record(p)&&[p.origin,p.at].every(at=>point(at)&&at.x+r.width<=BALANCE.workshop.groupPuzzle.width&&at.y+r.height<=BALANCE.workshop.groupPuzzle.height);})||Object.keys(value.positions).length!==ids.length||!Object.entries(value.positions).every(([piece,pos])=>ids.includes(piece)&&record(pos)&&point(pos.origin)&&point(pos.at))
   ||!record(value.fitted)||!Object.entries(value.fitted).every(([id,p])=>id!==tool.base&&ids.includes(id)&&point(p)&&p.x===tool.pieces.find(piece=>piece.id===id)!.rect.x&&p.y===tool.pieces.find(piece=>piece.id===id)!.rect.y)
   ||!list(value.hidden,ids)||!list(value.paid,ids)||!record(value.designs)||Object.keys(value.designs).length!==designIds.length||!Object.entries(value.designs).every(([id,d])=>designIds.includes(id as WorkshopPartId)&&isDesign(d))
   ||![0,1,2].includes(value.createdStage as number)||value.completedAt!==null&&!amount(value.completedAt))return false;
  if(Object.keys(value.fitted).length&&(!value.placed||!value.locked))return false;
  if(value.placed&&!value.paid.includes(tool.base)||Object.keys(value.fitted).some(piece=>!(value.paid as string[]).includes(piece)))return false;
  const complete=value.placed&&Object.keys(value.fitted).length===ids.length-1;
  if(complete!==(value.completedAt!==null)||complete!==value.completionPaid||complete!==(x.shelf as string[]).includes(id))return false;
 }
 if((x.stack as string[]).some(key=>!(x.tools as Record<string,unknown>)[key.split(':')[0]!]))return false;
 return (x.purchased as string[]).every(group=>GROUP_TOOLS.filter(tool=>tool.group===group).every(tool=>!!(x.tools as Record<string,unknown>)[tool.id]))
  &&(x.shelf as string[]).every(id=>!!(x.tools as Record<string,unknown>)[id]);
}
