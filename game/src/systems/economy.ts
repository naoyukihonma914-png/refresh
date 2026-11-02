import { globalMultiplier } from './longPlay';
import { jobsRate } from './desktopJobs';
import { BALANCE } from '../config/balance';
import type { GameState } from './state';

export function manualClickValue(state: GameState): number {
  const { built } = state.run.seed;
  const w1 = BALANCE.w1;
  const click = (w1.base_click + (built.includes('border') ? w1.border_bonus : 0))
    * (built.includes('font') ? w1.font_mult : 1);
  return click * BALANCE.spec.color[state.persistent.specs.color]!.multiplier * globalMultiplier(state);
}
export function cursorPressesPerSecond(state: GameState): number {
  return BALANCE.w1.cursor_press_per_sec
    * (state.run.seed.built.includes('color') ? BALANCE.w1.color_cursor_mult : 1)
    * BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier;
}
export function cursorPixelsPerSecond(state: GameState): number {
  return state.run.world === 'release' ? 0 : manualClickValue(state) * cursorPressesPerSecond(state);
}
export const homePixelsPerSecond = (state: GameState): number => state.run.seed.autoCursors * cursorPixelsPerSecond(state);
const productionMultiplier = (state:GameState):number => BALANCE.spec.color[state.persistent.specs.color]!.multiplier * globalMultiplier(state);
export const seedPartsPixelsPerSecond = (state:GameState):number => state.run.world==='release'?0:
  BALANCE.w1.items.reduce((n,item)=>n+(state.run.seed.built.includes(item.id)?item.perSecond:0),0)*productionMultiplier(state);
export const workshopPartsPixelsPerSecond = (state:GameState):number => state.run.world==='release'?0:
  Object.entries(state.run.workshop.parts).reduce((n,[id,p])=>n+(p?.step===4?BALANCE.workshop.partRates[id as keyof typeof BALANCE.workshop.partRates]:0),0)*productionMultiplier(state);
export const passivePixelsPerSecond = (state: GameState): number => homePixelsPerSecond(state) + seedPartsPixelsPerSecond(state) + workshopPartsPixelsPerSecond(state) + jobsRate(state);
export function advanceHomeGeneration(state: GameState, ms: number): GameState {
  if(!Number.isFinite(ms)||ms<0)throw new Error('Invalid generation duration');
  return creditPixels(state,passivePixelsPerSecond(state)*ms/BALANCE.time.millisecondsPerSecond);
}
export function creditPixels(state: GameState, pixels: number): GameState {
  if (!Number.isFinite(pixels) || pixels < 0) throw new Error('ピクセルの増分が不正です');
  const balance = state.resources.pixels + pixels;
  const total = state.run.totalPixelsGenerated + pixels;
  if (!Number.isFinite(balance) || !Number.isFinite(total)) throw new Error('ピクセルが上限を超えました');
  return { ...state, resources: { ...state.resources, pixels: balance }, run: { ...state.run, totalPixelsGenerated: total } };
}
