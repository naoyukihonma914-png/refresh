import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, type WorkshopPartId } from '../content/workshopCatalog';
import { installedAssembly, appIsOperational } from './appAssembly';
import { JOB_IDS, type AppId, type BuiltApp } from './desktopState';
import { globalMultiplier } from './longPlay';
import type { GameState } from './state';

/** A source is a produced component identity, never a rectangle or a screenshot. */
export interface ComponentSource { id:string; baseRate:number }
export const componentBaseRate=(id:WorkshopPartId,createdStage:0|1|2=0):number=>(BALANCE.workshop.partRates[id as keyof typeof BALANCE.workshop.partRates]??0)*BALANCE.workshop.eras.partRateMultipliers[createdStage]!;
// Historical standalone scrollbars stop producing separately once their new frame is acquired.
const activeComponent=(s:GameState,id:WorkshopPartId):boolean=>s.run.workshop.parts[id]?.step===4&&!(id==='common-scrollbar'&&s.run.workshop.parts['common-frame']?.fitting&&s.run.workshop.parts['common-frame']?.step===4);
export const seedComponentSources=(s:GameState):ComponentSource[]=>BALANCE.w1.items.flatMap(item=>s.run.seed.built.includes(item.id)?[{id:`seed:${item.id}`,baseRate:item.perSecond}]:[]);
export const completedComponentSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>activeComponent(s,part.id)?[{id:part.id,baseRate:componentBaseRate(part.id,s.run.workshop.parts[part.id]?.createdStage)}]:[]);
const commonSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>part.set==='common'&&activeComponent(s,part.id)?[{id:part.id,baseRate:componentBaseRate(part.id,s.run.workshop.parts[part.id]?.createdStage)}]:[]);
export const editorPartSources=(s:GameState):ComponentSource[]=>[...seedComponentSources(s),...commonSources(s)];
export const desktopFoundationSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>part.set==='foundation'&&s.run.workshop.parts[part.id]?.step===4?[{id:part.id,baseRate:componentBaseRate(part.id,s.run.workshop.parts[part.id]?.createdStage)}]:[]);
export function installedAppSources(s:GameState,app:BuiltApp):ComponentSource[]{
 if(!appIsOperational(s,app))return [];
 const assembly=installedAssembly(s,app);if(!assembly)return [];
 const integrated=assembly.common.some(material=>material.source==='common-frame'&&material.fitting);
 const sources=new Map<string,ComponentSource>();
 for(const material of [...assembly.common,...assembly.slots]){
  if(sources.has(material.source)||integrated&&material.source==='common-scrollbar')continue;
  // Frozen older frames and separate scrollbars retain their original combined rate.
  const base=material.source==='common-frame'&&!material.fitting
   ?(BALANCE.workshop.partRates['common-frame']-BALANCE.workshop.partRates['common-scrollbar'])*BALANCE.workshop.eras.partRateMultipliers[material.createdStage??0]!
   :componentBaseRate(material.source,material.createdStage);
  sources.set(material.source,{id:material.source,baseRate:base});
 }
 return [...sources.values()];
}
export const sourceTotal=(sources:readonly ComponentSource[]):number=>sources.reduce((sum,source)=>sum+source.baseRate,0);
export const productionColorMultiplier=(s:GameState):number=>BALANCE.spec.color[s.persistent.specs.color]!.multiplier;
export const productionGlobalMultiplier=(s:GameState):number=>globalMultiplier(s);
export const productionCreditMultiplier=(s:GameState):number=>productionColorMultiplier(s)*productionGlobalMultiplier(s);
export const appUpdateMultiplier=(s:GameState,app:AppId):number=>BALANCE.w3.updateMultiplier**(JOB_IDS.includes(app as typeof JOB_IDS[number])?s.run.desktop.jobs[app as typeof JOB_IDS[number]].updates:0);
export const appBasePixelsPerSecond=(s:GameState,app:AppId):number=>app==='tessera'?sourceTotal(editorPartSources(s)):s.run.desktop.apps.includes(app as BuiltApp)?sourceTotal(installedAppSources(s,app as BuiltApp)):0;
export const desktopAppPixelsPerSecond=(s:GameState,app:AppId):number=>s.run.world==='desktop'&&s.run.desktop.entered?appBasePixelsPerSecond(s,app)*appUpdateMultiplier(s,app)*productionColorMultiplier(s)*productionGlobalMultiplier(s):0;
/** The shell is one production source; each installed app may reuse the common material. */
export const desktopFoundationPixelsPerSecond=(s:GameState):number=>s.run.world==='desktop'&&s.run.desktop.entered?sourceTotal(desktopFoundationSources(s))*productionColorMultiplier(s)*productionGlobalMultiplier(s):0;
export const installedToolCount=(s:GameState):number=>s.run.desktop.entered?(editorPartSources(s).length>0?1:0)+s.run.desktop.apps.filter(app=>appIsOperational(s,app)).length:0;
export const desktopToolsPixelsPerSecond=(s:GameState):number=>desktopFoundationPixelsPerSecond(s)+desktopAppPixelsPerSecond(s,'tessera')+s.run.desktop.apps.reduce((sum,app)=>sum+desktopAppPixelsPerSecond(s,app),0);
