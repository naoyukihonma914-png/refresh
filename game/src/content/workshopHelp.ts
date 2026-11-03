import { BALANCE } from '../config/balance';
import { getWorkshopPart, partsForSet, type UiSetId, type WorkshopPartId } from './workshopCatalog';
import type { WorkshopHelpTarget } from '../systems/workshopState';

export interface WorkshopHelpRegion {x:number;y:number;width:number;height:number}
export interface WorkshopHelpPresentation {
 set:UiSetId;part?:WorkshopPartId;labelKey:string;descriptionKey:string;
 regions:readonly WorkshopPartId[];
}

/** The same named destinations drive help, catalog thumbnails and the future desktop. */
export function workshopHelpFor(set:UiSetId,part?:WorkshopPartId):WorkshopHelpPresentation {
 if(part&&getWorkshopPart(part).set!==set)throw new Error('The part does not belong to this UI set');
 return {set,...(part?{part}:{}),labelKey:part?getWorkshopPart(part).labelKey:`ws.set.${set}`,
  descriptionKey:`tp.workshop.help.${part?`part.${part}`:`set.${set}`}`,
  regions:part?[part]:partsForSet(set).map(definition=>definition.id)};
}
export const workshopHelpTarget=(set:UiSetId,part?:WorkshopPartId):WorkshopHelpTarget=>({set,...(part?{part}:{})});
export function workshopHelpRegion(part:WorkshopPartId):WorkshopHelpRegion {
 return BALANCE.workshopHelp.regions[part];
}
