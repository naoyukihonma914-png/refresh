import type { UiSetId } from '../../content/workshopCatalog';
import { getWorkshopPart } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import { nextWorkshopTarget } from '../../systems/workshopNavigation';
import { workshopExampleHand } from './WorkshopExamples';

export const WORKSHOP_CATEGORIES=['shared','required','optional'] as const;
export type WorkshopCategory=typeof WORKSHOP_CATEGORIES[number];
export const WORKSHOP_CATEGORY_SETS:Record<WorkshopCategory,readonly UiSetId[]>={
 shared:['common'],required:['foundation','files','mail'],
 optional:['photo','bin','clock','theme','terminal','manager','extras','stream'],
};
export const workshopCategoryForSet=(set:UiSetId):WorkshopCategory=>WORKSHOP_CATEGORIES.find(category=>WORKSHOP_CATEGORY_SETS[category].includes(set))!;

/** Choose the opening category from the current concrete goal, without changing production. */
export function initialWorkshopPanelSet(state:GameState):UiSetId {
 const hand=workshopExampleHand(state);
 if(hand.kind==='buySet')return hand.set;
 if('part' in hand)return getWorkshopPart(hand.part).set;
 const active=state.run.workshop.activePart;
 if(active)return getWorkshopPart(active).set;
 const next=nextWorkshopTarget(state);
 return next&&'set' in next?next.set:'common';
}
