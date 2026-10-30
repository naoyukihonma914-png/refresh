import { BALANCE } from '../config/balance';
import { creditPixels, passivePixelsPerSecond } from './economy';
import type { GameState } from './state';

export interface TimeResult {
  state: GameState;
  elapsedMs: number;
  creditedMs: number;
  pixels: number;
  capped: boolean;
  remainderMs: number;
}

function applyTime(state: GameState, elapsedMs: number, creditedMs: number, capped: boolean): TimeResult {
  const pixels = passivePixelsPerSecond(state) * creditedMs / BALANCE.time.millisecondsPerSecond;
  return {
    state: { ...creditPixels(state, pixels), elapsedMs: state.elapsedMs + creditedMs },
    elapsedMs, creditedMs, pixels, capped, remainderMs: 0,
  };
}

// 能動時間は端末時計も保存された時刻も参照しない。
// runtime が performance.now() の差と、前回の端数を渡す。
export function advanceActiveTime(state: GameState, elapsedMs: number): TimeResult {
  if (!Number.isFinite(elapsedMs)) throw new Error('Invalid active duration');
  const elapsed = Math.max(0, elapsedMs);
  const creditedMs = Math.floor(elapsed / BALANCE.time.tickMs) * BALANCE.time.tickMs;
  return { ...applyTime(state, elapsed, creditedMs, false), remainderMs: elapsed - creditedMs };
}

// 閉じていた・裏のタブだった時間だけ、端末時計の差で計算する。
export function advanceOfflineTime(state: GameState, wallNow: number): TimeResult {
  if (!Number.isFinite(wallNow) || wallNow < 0) throw new Error('Invalid wall time');
  const elapsedMs = Math.max(0, wallNow - state.lastTickAt);
  const limit = BALANCE.spec.storage[state.persistent.specs.storage]!.offlineHours
    * BALANCE.time.millisecondsPerHour;
  const result = applyTime(state, elapsedMs, Math.min(elapsedMs, limit), elapsedMs > limit);
  // 時計が戻った差は0にし、次回の不在は現在の時計を基準にする。
  return { ...result, state: { ...result.state, lastTickAt: wallNow } };
}
