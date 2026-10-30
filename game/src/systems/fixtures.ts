import { BALANCE } from '../config/balance';
import { createInitialState, type GameState } from './state';

export const FIXTURE_NAMES = ['foundation-start', 'foundation-saved', 'foundation-offline-capped'] as const;

// 実セーブと混ざらないよう、ランタイムは固定状態ではメモリ内の保存領域を使う。
export function createFixture(name: string | null, now: number): GameState | null {
  if (!FIXTURE_NAMES.some(item => item === name)) return null;
  const state = createInitialState(now);
  if (name === 'foundation-start') return state;
  state.run.seed.built = ['border', 'save'];
  state.run.seed.autoCursors = 1;
  state.lastSavedAt = now;
  if (name === 'foundation-offline-capped') {
    state.lastTickAt -= BALANCE.debug.offlineFixtureHours * BALANCE.time.millisecondsPerHour;
    state.createdAt = state.lastTickAt;
    state.lastSavedAt = state.lastTickAt;
  }
  return state;
}
