import { BALANCE } from '../config/balance';
import { JOB_IDS, type AppId } from './desktopState';
import { jobProduction, jobsRate } from './desktopJobs';
import { globalMultiplier } from './longPlay';
import { effectiveFitted } from './pageDesign';
import { appBasePixelsPerSecond, appUpdateMultiplier, completedComponentSources, desktopFoundationSources, editorPartSources, installedAppSources, productionColorMultiplier, productionCreditMultiplier, seedComponentSources, sourceTotal } from './productionModel';
import type { GameState } from './state';

export interface ProducerEntry {
  id:string;
  kind:'cursor'|'component'|'app'|'job';
  app?:AppId;
  sourceIds:string[];
  baseRate:number;
  count:number;
  multipliers:{color:number;global:number;refresh:number;update:number;features:number;carry:number;tools:number};
  perSecond:number;
}
export function manualClickValue(state:GameState):number {
  const built=state.run.seed.built,w1=BALANCE.w1;
  return (w1.base_click+(built.includes('border')?w1.border_bonus:0))*(built.includes('font')?w1.font_mult:1)*productionColorMultiplier(state)*globalMultiplier(state);
}
export const cursorPressesPerSecond=(s:GameState):number=>BALANCE.w1.cursor_press_per_sec*(s.run.seed.built.includes('color')?BALANCE.w1.color_cursor_mult:1)*BALANCE.spec.refresh[s.persistent.specs.refresh]!.multiplier;
export const cursorPixelsPerSecond=(s:GameState):number=>s.run.world==='release'?0:manualClickValue(s)*cursorPressesPerSecond(s);
export const homePixelsPerSecond=(s:GameState):number=>effectiveFitted(s.run.seed.page,s.persistent.examplesEnabled).includes('cursors')?s.run.seed.autoCursors*cursorPixelsPerSecond(s):0;
const componentMultiplier=productionCreditMultiplier;
export const seedPartsPixelsPerSecond=(s:GameState):number=>['seed','kumiki'].includes(s.run.world)?sourceTotal(seedComponentSources(s))*componentMultiplier(s):0;
export const workshopPartsPixelsPerSecond=(s:GameState):number=>['seed','kumiki'].includes(s.run.world)?sourceTotal(completedComponentSources(s))*componentMultiplier(s):0;

/** The authoritative passive ledger: a produced component belongs to this world's active tool layer. */
export function producerLedger(s:GameState):ProducerEntry[] {
  if(s.run.world==='release')return [];
  const color=productionColorMultiplier(s),global=globalMultiplier(s),neutral={color,global,refresh:1,update:1,features:1,carry:1,tools:1};
  const rows:ProducerEntry[]=[];
  if(s.run.seed.autoCursors>0){
    const baseRate=(BALANCE.w1.base_click+(s.run.seed.built.includes('border')?BALANCE.w1.border_bonus:0))*(s.run.seed.built.includes('font')?BALANCE.w1.font_mult:1)*BALANCE.w1.cursor_press_per_sec*(s.run.seed.built.includes('color')?BALANCE.w1.color_cursor_mult:1);
    rows.push({id:'home',kind:'cursor',app:'tessera',sourceIds:['seed:cursor'],baseRate,count:s.run.seed.autoCursors,multipliers:{...neutral,refresh:BALANCE.spec.refresh[s.persistent.specs.refresh]!.multiplier},perSecond:homePixelsPerSecond(s)});
  }
  const appendComponent=(source:{id:string;baseRate:number})=>rows.push({id:source.id,kind:'component',sourceIds:[source.id],baseRate:source.baseRate,count:1,multipliers:{...neutral},perSecond:source.baseRate*color*global});
  if(s.run.world==='desktop'&&s.run.desktop.entered){
    const foundation=desktopFoundationSources(s);
    if(foundation.length)rows.push({id:'desktop',kind:'app',sourceIds:foundation.map(source=>source.id),baseRate:sourceTotal(foundation),count:1,multipliers:{...neutral},perSecond:sourceTotal(foundation)*color*global});
    for(const app of ['tessera',...s.run.desktop.apps] as const){
      const sources=app==='tessera'?editorPartSources(s):installedAppSources(s,app);
      if(!sources.length)continue;
      const baseRate=appBasePixelsPerSecond(s,app),update=appUpdateMultiplier(s,app);
      rows.push({id:`app:${app}`,kind:'app',app,sourceIds:sources.map(source=>source.id),baseRate,count:1,multipliers:{...neutral,update},perSecond:baseRate*update*color*global});
    }
    for(const app of JOB_IDS){const production=jobProduction(s,app);if(production.perSecond>0)rows.push({id:`job:${app}`,kind:'job',app,sourceIds:app==='tessera'?editorPartSources(s).map(source=>source.id):installedAppSources(s,app).map(source=>source.id),baseRate:production.baseRate,count:production.count,multipliers:production.multipliers,perSecond:production.perSecond});}
  }else{
    for(const source of [...seedComponentSources(s),...completedComponentSources(s)])appendComponent(source);
  }
  return rows;
}
export const passivePixelsPerSecond=(s:GameState):number=>producerLedger(s).reduce((sum,source)=>sum+source.perSecond,0);
/** Kept for existing process callers; the ledger is the single source of the total. */
export { jobsRate };
export function advanceHomeGeneration(state:GameState,ms:number):GameState {
  if(!Number.isFinite(ms)||ms<0)throw new Error('Invalid generation duration');
  return creditPixels(state,passivePixelsPerSecond(state)*ms/BALANCE.time.millisecondsPerSecond);
}
export function creditPixels(state:GameState,pixels:number):GameState {
  if(!Number.isFinite(pixels)||pixels<0)throw new Error('ピクセルの増分が不正です');
  const balance=state.resources.pixels+pixels,total=state.run.totalPixelsGenerated+pixels;
  if(!Number.isFinite(balance)||!Number.isFinite(total))throw new Error('ピクセルが上限を超えました');
  return {...state,resources:{...state.resources,pixels:balance},run:{...state.run,totalPixelsGenerated:total}};
}
