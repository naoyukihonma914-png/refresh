import { fittingPartsForSet } from '../content/workshopFitting';
import { getWorkshopPart, type UiSetId, type WorkshopPartId } from '../content/workshopCatalog';
import type { WorkshopState } from './workshopState';

export const SHELF_APPS=['foundation','files','mail'] as const;
export interface WorkshopShelfEntry {id:string;set:UiSetId;part?:WorkshopPartId;parts:WorkshopPartId[]}
/** exportedAt already belongs to this run's save; the shelf needs no second reward/history record. */
export function workshopShelf(w:WorkshopState):WorkshopShelfEntry[] {
 const exported=Object.keys(w.parts).filter(id=>w.parts[id as WorkshopPartId]?.exportedAt!=null) as WorkshopPartId[];
 const merged=new Set<UiSetId>(SHELF_APPS.filter(set=>fittingPartsForSet(set).every(part=>exported.includes(part.id))));
 const entries:WorkshopShelfEntry[]=[];
 for(const id of exported){
  const set=getWorkshopPart(id).set;
  if(merged.has(set)){
   if(!entries.some(entry=>entry.id===`app:${set}`))entries.push({id:`app:${set}`,set,parts:fittingPartsForSet(set).map(part=>part.id)});
  }else entries.push({id:`part:${id}`,set,part:id,parts:[id]});
 }
 return entries;
}
