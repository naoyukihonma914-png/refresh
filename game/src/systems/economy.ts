import { BALANCE } from '../config/balance';
import type { GameState } from './state';

// 時間処理に必要な自動生成の計算だけ。購入や手動生成は段階2で加える。
export function passivePixelsPerSecond(state: GameState): number {
  const { built, autoCursors } = state.run.seed;
  const w1 = BALANCE.w1;
  const click = (w1.base_click + (built.includes('border') ? w1.border_bonus : 0))
    * (built.includes('font') ? w1.font_mult : 1);
  const color = BALANCE.spec.color[state.persistent.specs.color]!;
  const refresh = BALANCE.spec.refresh[state.persistent.specs.refresh]!;
  return autoCursors * click * w1.cursor_press_per_sec
    * (built.includes('color') ? w1.color_cursor_mult : 1)
    * color.multiplier * refresh.multiplier;
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
