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

export function passivePixelsPerSecond(state: GameState): number {
  return state.run.seed.autoCursors * manualClickValue(state) * cursorPressesPerSecond(state);
}

export function creditPixels(state: GameState, pixels: number): GameState {
  if (!Number.isFinite(pixels) || pixels < 0) throw new Error('ピクセルの増分が不正です');
  const balance = state.resources.pixels + pixels;
  const total = state.run.totalPixelsGenerated + pixels;
  if (!Number.isFinite(balance) || !Number.isFinite(total)) throw new Error('ピクセルが上限を超えました');
  return {
    ...state,
    resources: { ...state.resources, pixels: balance },
    run: { ...state.run, totalPixelsGenerated: total },
  };
}
