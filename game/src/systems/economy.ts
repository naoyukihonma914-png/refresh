import { jobsRate } from './desktopJobs';
import { BALANCE } from '../config/balance';
import type { GameState } from './state';

export function manualClickValue(state: GameState): number {
  const { built } = state.run.seed;
  const w1 = BALANCE.w1;
  const click = (w1.base_click + (built.includes('border') ? w1.border_bonus : 0))
    * (built.includes('font') ? w1.font_mult : 1);
  const color = BALANCE.spec.color[state.persistent.specs.color]!;
  return click * color.multiplier;
}

export function cursorPressesPerSecond(state: GameState): number {
  return BALANCE.w1.cursor_press_per_sec
    * (state.run.seed.built.includes('color') ? BALANCE.w1.color_cursor_mult : 1)
    * BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier;
}

export function cursorPixelsPerSecond(state: GameState): number {
  if (state.run.world === 'release') return 0;
  const k = state.run.kumiki;
  if (['kumiki','desktop'].includes(state.run.world) && k.placed.includes('switch') && k.focus) return 0;
  const button = k.placed.includes('button') ? BALANCE.w2.buttonMultiplier : 1;
  const slider = k.placed.includes('slider') ? 1 + (k.interval - BALANCE.w2.intervalMin) / (BALANCE.w2.intervalMax - BALANCE.w2.intervalMin) * (BALANCE.w2.sliderMultiplier - 1) : 1;
  return manualClickValue(state) * cursorPressesPerSecond(state) * button * slider;
}

export const homePixelsPerSecond = (state: GameState): number => state.run.seed.autoCursors * cursorPixelsPerSecond(state);
export const passivePixelsPerSecond = (state: GameState): number => homePixelsPerSecond(state) + jobsRate(state);

export function advanceHomeGeneration(state: GameState, ms: number): GameState {
  state = creditPixels(state,jobsRate(state)*ms/BALANCE.time.millisecondsPerSecond);
  const k = state.run.kumiki;
  const rate = homePixelsPerSecond(state);
  if (!k.placed.includes('slider') || rate === 0) return creditPixels(state, rate * ms / BALANCE.time.millisecondsPerSecond);
  const period = k.interval * BALANCE.time.millisecondsPerSecond;
  const until = period - k.batchMs;
  const remainder = ms < until ? k.batchMs + ms : (ms - until) % period;
  const pixels = ms < until ? 0 : k.bank + rate * (ms - remainder) / BALANCE.time.millisecondsPerSecond;
  const bank = ms < until ? k.bank + rate * ms / BALANCE.time.millisecondsPerSecond : rate * remainder / BALANCE.time.millisecondsPerSecond;
  const next = creditPixels(state, pixels);
  return { ...next, run: { ...next.run, kumiki: { ...next.run.kumiki, bank, batchMs: remainder } } };
}

export function creditPixels(state: GameState, pixels: number): GameState {
  if (!Number.isFinite(pixels) || pixels < 0) throw new Error('ピクセルの増分が不正です');
  const balance = state.resources.pixels + pixels;
  const total = state.run.totalPixelsGenerated + pixels;
  if (!Number.isFinite(balance) || !Number.isFinite(total)) throw new Error('ピクセルが上限を超えました');
  return {
    ...state,
    resources: { ...state.resources, pixels: balance },
    run: { ...state.run, totalPixelsGenerated: total,
      kumiki: pixels > 0 && state.run.kumiki.placed.includes('table')
        ? { ...state.run.kumiki, generationLog: [...state.run.kumiki.generationLog.slice(-(BALANCE.w2.generationLogLimit - 1)), { at: state.lastTickAt, pixels }] } : state.run.kumiki,
    },
  };
}
