import type { UiSetId,WorkshopPartId } from '../content/workshopCatalog';
import { partsForSet } from '../content/workshopCatalog';
import type { GameState } from './state';
import { setComplete } from './workshop';

export const WORKSHOP_MAINLINE:readonly UiSetId[]=['common','foundation','files','mail'];
export type WorkshopNextTarget={kind:'set';set:UiSetId}|{kind:'part';set:UiSetId;part:WorkshopPartId}|{kind:'exit'};
export type WorkshopRowStatus='unowned'|'ready'|'complete';
/** One suggestion follows actual material progress, never the selected tab or wallet size. */
export function nextWorkshopTarget(state:GameState):WorkshopNextTarget|null {
 for(const set of WORKSHOP_MAINLINE){
  if(!state.run.workshop.purchasedSets.includes(set))return {kind:'set',set};
  const part=partsForSet(set).find(definition=>state.run.workshop.parts[definition.id]?.step!==4);
  if(part)return {kind:'part',set,part:part.id};
 }
 return state.run.world==='kumiki'?{kind:'exit'}:null;
}
export function workshopRowStatus(state:GameState,set:UiSetId,part?:WorkshopPartId):WorkshopRowStatus {
 if(!state.run.workshop.purchasedSets.includes(set))return 'unowned';
 return (part?state.run.workshop.parts[part]?.step===4:setComplete(state,set))?'complete':'ready';
}
