import { BALANCE, type DesktopSkill, type DesktopUpgrade } from '../config/balance';
import { adoptedFeaturePartIds, appIsOperational } from './appAssembly';
import { featureApp } from './appLayout';
import { hasAppPart } from './appBuild';
import { bulkQuote } from './bulk';
import { JOB_IDS, type AppId, type JobId } from './desktopState';
import { globalMultiplier, previousWorldMultiplier } from './longPlay';
import { appUpdateMultiplier, installedToolCount, productionColorMultiplier } from './productionModel';
import type { GameState } from './state';

export function hasUpgrade(s:GameState,id:DesktopUpgrade):boolean {
  const app=featureApp(id);
  if(!app)return s.run.desktop.upgrades.includes(id);
  return hasAppPart(s,app,id)&&(!['sort','search','large'].includes(id)||hasAppPart(s,'files','list'))&&(!['crop','compare'].includes(id)||hasAppPart(s,'photo','image'));
}
export const hasDesktopSkill=(s:GameState,id:DesktopSkill)=>s.persistent.desktopPrefs?.skills.includes(id)&&!s.persistent.desktopPrefs.disabled.includes(id);
export const FEATURE_APPS={sort:'files',draft:'mail',search:'files',large:'files',crop:'photo',compare:'photo',undo:'bin',folders:'mail',timer:'clock',calendar:'clock',slideshow:'theme',iconSize:'theme'} as const;
/** Features belong to the installed source graph, not purchased flags or duplicate slots. */
export const featureCount=(s:GameState,app:AppId):number=>app==='tessera'||app==='note'||app==='settings'?0:[...new Set(adoptedFeaturePartIds(s,app))].length;
export const jobCapacity=(s:GameState)=>BALANCE.spec.memory[s.persistent.specs.memory]!.posts+(hasDesktopSkill(s,'posts')?BALANCE.w3.extraPosts:0);
export const jobCursorQuote=(s:GameState,id:JobId)=>bulkQuote(s,BALANCE.w3.jobs[id].cost,BALANCE.w3.cursorGrowth,s.run.desktop.jobs[id].cursors);
export const jobCursorCost=(s:GameState,id:JobId)=>Math.ceil(BALANCE.w3.jobs[id].cost*BALANCE.w3.cursorGrowth**s.run.desktop.jobs[id].cursors);
export const jobUpdateCost=(s:GameState,id:JobId)=>Math.ceil(BALANCE.w3.jobs[id].cost*BALANCE.w3.updateBase*BALANCE.w3.updateGrowth**s.run.desktop.jobs[id].updates);
export interface JobProduction {
  baseRate:number;
  count:number;
  multipliers:{color:number;global:number;refresh:number;update:number;features:number;carry:number;tools:number};
  perCursor:number;
  perSecond:number;
}
export function jobProduction(s:GameState,id:JobId):JobProduction {
  const job=s.run.desktop.jobs[id];
  const multipliers={color:productionColorMultiplier(s),global:globalMultiplier(s),refresh:BALANCE.spec.refresh[s.persistent.specs.refresh]!.multiplier,update:appUpdateMultiplier(s,id),features:BALANCE.w3.featureMultiplier**featureCount(s,id),carry:previousWorldMultiplier(s),tools:installedToolCount(s)};
  const baseRate=BALANCE.w3.jobs[id].rate,operational=id==='tessera'?s.run.workshop.entered:appIsOperational(s,id);
  const perCursor=operational?Object.values(multipliers).reduce((product,factor)=>product*factor,baseRate):0;
  return {baseRate,count:job.cursors,multipliers,perCursor,perSecond:s.run.world==='desktop'&&s.run.desktop.entered&&job.assigned?job.cursors*perCursor:0};
}
export const jobCursorRate=(s:GameState,id:JobId)=>jobProduction(s,id).perCursor;
export const jobRate=(s:GameState,id:JobId)=>jobProduction(s,id).perSecond;
export const jobsRate=(s:GameState)=>JOB_IDS.reduce((sum,id)=>sum+jobRate(s,id),0);
