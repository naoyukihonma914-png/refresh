import { BALANCE } from '../config/balance';
import { APP_REQUIRED,sourceForSlot } from '../content/appRecipes';
import { appIsOperational } from './appAssembly';
import type { BuiltApp } from './desktopState';
import type { GameState } from './state';

export type DesktopOffer = {id:BuiltApp|'jobs';kind:'set'|'craft'|'assemble'|'jobs';cost:number};
/** Current materials and adopted sources, rather than the retired app/feature price ladder. */
export function desktopOffers(state:GameState):DesktopOffer[] {
 return BALANCE.w3.offerOrder.flatMap<DesktopOffer>(id=>{
  if(id==='jobs')return state.run.desktop.upgrades.includes('jobs')?[]:[{id,kind:'jobs' as const,cost:BALANCE.w3.jobUnlockCost}];
  if(appIsOperational(state,id))return [];
  if(!state.run.workshop.purchasedSets.includes(id))return [{id,kind:'set' as const,cost:BALANCE.workshop.setCosts[id]}];
  const ready=state.run.workshop.groupPuzzle?!!state.run.workshop.groupPuzzle.tools[id]?.completionPaid:APP_REQUIRED[id].every(role=>state.run.workshop.parts[sourceForSlot(id,role)!]?.step===4);
  return [{id,kind:ready?'assemble' as const:'craft' as const,cost:0}];
 });
}
export const nextDesktopOffer=(state:GameState)=>desktopOffers(state)[0]??null;
export const followingDesktopOffer=(state:GameState)=>desktopOffers(state)[1]??null;
