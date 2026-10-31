import { BALANCE } from '../config/balance';
import { createInitialState, type GameState } from './state';
import { createSeedVersion, updateSeedGuide } from './seed';

export const FIXTURE_NAMES = [
  'foundation-start', 'foundation-saved', 'foundation-offline-capped',
  'seed-start', 'seed-border', 'seed-saved', 'seed-color', 'seed-font',
  'seed-layout', 'seed-motion', 'seed-complete', 'seed-return', 'seed-inheriting',
] as const;

// 実セーブと混ざらないよう、ランタイムは固定状態ではメモリ内の保存領域を使う。
export function createFixture(name: string | null, now: number): GameState | null {
  if (!FIXTURE_NAMES.some(item => item === name)) return null;
  const state = createInitialState(now);
  if (name?.startsWith('seed-')) {
    if (name === 'seed-start') { state.resources.pixels = state.run.totalPixelsGenerated = 7; return state; }
    const end = name === 'seed-border' ? 'border' : name === 'seed-saved' ? 'save'
      : name === 'seed-color' ? 'color' : name === 'seed-font' ? 'font'
        : name === 'seed-layout' ? 'layout' : name === 'seed-complete' ? 'kumiki' : 'motion';
    state.run.seed.built = BALANCE.w1.items.slice(0, BALANCE.w1.items.findIndex(item => item.id === end) + 1).map(item => item.id);
    state.run.seed.history = state.run.seed.built.map((item, index) => ({ item, at: now - (10 - index) * 60_000 }));
    state.run.seed.autoCursors = end === 'border' || end === 'save' ? 0 : name === 'seed-motion' ? 24 : 8;
    state.resources.pixels = 12_000;
    state.run.totalPixelsGenerated = 40_000;
    state.lastSavedAt = now;
    if (name === 'seed-return' || name === 'seed-inheriting') {
      state.run.version = 'v1';
      state.persistent.specs.color = 1;
      state.resources.tokens = 40;
      if (name === 'seed-inheriting') {
        state.persistent.seedSkills = ['inherit'];
        return createSeedVersion(state, 'v2', now);
      }
    }
    return updateSeedGuide(state);
  }
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
