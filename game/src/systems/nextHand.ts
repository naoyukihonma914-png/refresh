import {BALANCE,type SeedItem} from '../config/balance';
import {functionalApp,hasAppPart} from './appBuild';
import {desktopConditions,installedApps} from './desktop';
import {nextDesktopOffer,type DesktopOffer} from './desktopOffers';
import type {AppId,BuiltApp} from './desktopState';
import {visibleSeedItems} from './seed';
import type {GameState} from './state';

export type SeedNextHand={kind:'seed-generate'|'seed-buy';item:SeedItem;missing:number}|{kind:'seed-launch'};
/** Pure presentation guidance: no rewards, prices, layout scores, or game state changes. */
export function nextSeedHand(state:GameState):SeedNextHand|null {
 if(state.run.world!=='seed'||!state.persistent.examplesEnabled)return null;
 if(state.run.seed.installer||state.run.restartMs>0)return {kind:'seed-launch'};
 const item=visibleSeedItems(state)[0];if(!item)return {kind:'seed-launch'};
 const missing=Math.max(0,BALANCE.w1.items.find(candidate=>candidate.id===item)!.cost-state.resources.pixels);
 return {kind:missing>0?'seed-generate':'seed-buy',item,missing};
}
export type DesktopNextHand=
 |{kind:'desktop-offer';offer:DesktopOffer}
 |{kind:'desktop-open';app:AppId}
 |{kind:'desktop-finishApp';app:BuiltApp}
 |{kind:'desktop-feedback';request:number|null}
 |{kind:'desktop-wallpaper'|'desktop-automation'|'desktop-sets'|'desktop-release'|'desktop-world4'};
export function nextDesktopHand(state:GameState):DesktopNextHand|null {
 if(state.run.world!=='desktop'||!state.persistent.examplesEnabled)return null;
 const d=state.run.desktop;
 if(d.editingApp)return {kind:'desktop-finishApp',app:d.editingApp};
 const checks=desktopConditions(state);
 if(state.run.version==='v2')return {kind:'desktop-world4'};
 if(!checks[0]){
  const closed=installedApps(state).find(app=>!['note','settings'].includes(app)&&!d.windows[app].open&&(app==='tessera'||functionalApp(state,app as BuiltApp)));
  if(closed)return {kind:'desktop-open',app:closed};
  const offer=nextDesktopOffer(state);if(offer)return {kind:'desktop-offer',offer};
 }
 if(!checks[2])return {kind:'desktop-sets'};
 // Make the tool needed by a condition before asking the player to use it.
 if(!checks[3]&&(!hasAppPart(state,'photo','image')||!hasAppPart(state,'photo','wallpaper'))){
  const offer=nextDesktopOffer(state);if(offer)return {kind:'desktop-offer',offer};
 }
 if(!checks[3])return {kind:'desktop-wallpaper'};
 if(!checks[4]&&!functionalApp(state,'terminal')){
  const offer=nextDesktopOffer(state);if(offer)return {kind:'desktop-offer',offer};
 }
 if(!checks[4])return {kind:'desktop-automation'};
 if(!checks[1])return {kind:'desktop-feedback',request:d.feedback.find(request=>request.completedAt===null)?.id??null};
 return {kind:'desktop-release'};
}
