import type { WorkshopPartId } from '../content/workshopCatalog';
import { passivePixelsPerSecond, producerLedger } from './economy';
import { componentBaseRate } from './productionModel';
import type { GameState } from './state';

/** An observation of a manual completion, never saved production or extra income. */
export interface WorkshopCompletionFeedbackEvent {
 serial:number;part:WorkshopPartId;at:number;run:string;
 partRate:number;activePartRate:number;rateBefore:number;rateAfter:number;
}
export const workshopFeedbackRun=(state:GameState):string=>`${state.createdAt}:${state.run.version}:${state.run.workshop.enteredAt}`;
export function workshopVisible(state:GameState):boolean {
 const w=state.run.workshop;
 if(!w.entered||w.enterMs!==0||w.view!=='workbench')return false;
 if(state.run.world==='kumiki')return true;
 const desktop=state.run.desktop;
 return state.run.world==='desktop'&&desktop.active==='tessera'&&desktop.windows.tessera.open&&!desktop.windows.tessera.minimized;
}
export function completionFeedback(before:GameState,after:GameState,part:WorkshopPartId,serial:number,at:number):WorkshopCompletionFeedbackEvent|null {
 if(workshopFeedbackRun(before)!==workshopFeedbackRun(after)||before.run.workshop.parts[part]?.step===4||after.run.workshop.parts[part]?.step!==4)return null;
 const partRate=componentBaseRate(part),activePartRate=producerLedger(after).filter(source=>source.sourceIds.includes(part)&&source.baseRate>0).reduce((sum,source)=>sum+partRate/source.baseRate*source.perSecond,0);
 return {serial,part,at,run:workshopFeedbackRun(after),partRate,activePartRate,rateBefore:passivePixelsPerSecond(before),rateAfter:passivePixelsPerSecond(after)};
}
/** Counter motion only; callers keep rendering the authoritative state alongside it. */
export function feedbackCounterValue(event:WorkshopCompletionFeedbackEvent,progress:number):number {
 const amount=Math.max(0,Math.min(1,progress));
 return event.rateBefore+(event.rateAfter-event.rateBefore)*amount;
}
