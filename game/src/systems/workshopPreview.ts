import { WORKSHOP_PARTS, type WorkshopPartId } from '../content/workshopCatalog';
import type { GameState } from './state';

export interface WorkshopPreviewObservation { run:string;completed:Partial<Record<WorkshopPartId,number>> }
export function workshopPreviewObservation(state:GameState):WorkshopPreviewObservation {
 const completed:WorkshopPreviewObservation['completed']={};
 for(const definition of WORKSHOP_PARTS){const part=state.run.workshop.parts[definition.id];if(part?.step===4)completed[definition.id]=part.completedAt??0;}
 return {run:`${state.createdAt}:${state.run.version}:${state.run.workshop.enteredAt}`,completed};
}
/** Mounting a save paints its existing work; only new completions receive a trial animation. */
export function newlyCompletedPreviewParts(before:WorkshopPreviewObservation|null,after:WorkshopPreviewObservation):WorkshopPartId[] {
 if(!before||before.run!==after.run)return [];
 return WORKSHOP_PARTS.map(definition=>definition.id).filter(id=>after.completed[id]!==undefined&&before.completed[id]===undefined)
  .sort((a,b)=>after.completed[a]!-after.completed[b]!||WORKSHOP_PARTS.findIndex(definition=>definition.id===a)-WORKSHOP_PARTS.findIndex(definition=>definition.id===b));
}
