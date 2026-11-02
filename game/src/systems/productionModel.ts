import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, type WorkshopPartId } from '../content/workshopCatalog';
import { adoptedPartIds, appIsOperational } from './appAssembly';
import { JOB_IDS, type AppId, type BuiltApp } from './desktopState';
import { globalMultiplier } from './longPlay';
import type { GameState } from './state';

/** A source is a produced component identity, never a rectangle or a screenshot. */
export interface ComponentSource { id:string; baseRate:number }
export const componentBaseRate=(id:WorkshopPartId):number=>BALANCE.workshop.partRates[id as keyof typeof BALANCE.workshop.partRates]??0;
export const seedComponentSources=(s:GameState):ComponentSource[]=>BALANCE.w1.items.flatMap(item=>s.run.seed.built.includes(item.id)?[{id:`seed:${item.id}`,baseRate:item.perSecond}]:[]);
export const completedComponentSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>s.run.workshop.parts[part.id]?.step===4?[{id:part.id,baseRate:componentBaseRate(part.id)}]:[]);
const commonSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>part.set==='common'&&s.run.workshop.parts[part.id]?.step===4?[{id:part.id,baseRate:componentBaseRate(part.id)}]:[]);
export const editorPartSources=(s:GameState):ComponentSource[]=>[...seedComponentSources(s),...commonSources(s)];
export const desktopFoundationSources=(s:GameState):ComponentSource[]=>WORKSHOP_PARTS.flatMap(part=>part.set==='foundation'&&s.run.workshop.parts[part.id]?.step===4?[{id:part.id,baseRate:componentBaseRate(part.id)}]:[]);
export const installedAppSources=(s:GameState,app:BuiltApp):ComponentSource[]=>appIsOperational(s,app)?[...new Set(adoptedPartIds(s,app))].map(id=>({id,baseRate:componentBaseRate(id)})):[];
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
