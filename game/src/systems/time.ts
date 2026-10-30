import { BALANCE } from '../config/balance';
import { creditPixels, passivePixelsPerSecond } from './economy';
import type { GameState } from './state';

export interface TimeResult {
  state: GameState;
  elapsedMs: number;
  creditedMs: number;
  pixels: number;
  capped: boolean;
}

export function advanceTime(state: GameState, now: number, mode: 'active' | 'offline'): TimeResult {
  if (!Number.isFinite(now) || now < 0) throw new Error('時刻が不正です');
  const elapsedMs = Math.max(0, now - state.lastTickAt);
  const limit = BALANCE.spec.storage[state.persistent.specs.storage]!.offlineHours
    * BALANCE.time.millisecondsPerHour;
  const creditedMs = mode === 'offline'
    ? Math.min(elapsedMs, limit)
    : Math.floor(elapsedMs / BALANCE.time.tickMs) * BALANCE.time.tickMs;
  const pixels = passivePixelsPerSecond(state) * creditedMs / BALANCE.time.millisecondsPerSecond;
  const next = creditPixels(state, pixels);
  return {
    state: {
      ...next,
      // 上限を超えた時間を、次の再開で再び受け取れないよう消化する。
      // 時計が戻った場合は過去の時刻に巻き戻さない。
      lastTickAt: mode === 'offline' ? Math.max(state.lastTickAt, now) : state.lastTickAt + creditedMs,
      elapsedMs: state.elapsedMs + creditedMs,
    },
    elapsedMs,
    creditedMs,
    pixels,
    capped: mode === 'offline' && elapsedMs > limit,
  };
}
