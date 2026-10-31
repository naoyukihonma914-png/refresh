import { BALANCE, type SeedItem, type SeedSkill } from '../config/balance';
import { creditPixels, manualClickValue } from './economy';
import { createInitialState, type GameState, type GuideId } from './state';
import { enterKumiki } from './kumiki';

export function visibleSeedItems(state: GameState): SeedItem[] {
  const { built, autoCursors } = state.run.seed;
  // 最初の自動カーソルを作るまでは、それだけを次の一つとして見せる。
  if (built.includes('save') && autoCursors === 0) return [];
  return BALANCE.w1.items.filter(item => !built.includes(item.id))
    .slice(0, built.includes('layout') ? BALANCE.w1.previewItems : 1).map(item => item.id);
}

export function cursorPrice(state: GameState): number {
  return Math.ceil(BALANCE.w1.cursor_cost * BALANCE.w1.cursor_growth ** state.run.seed.autoCursors);
}

export function canBuildSeed(state: GameState, id: SeedItem | 'cursor'): boolean {
  if (state.run.world === 'release' || state.run.seed.installer || state.run.restartMs > 0) return false;
  if (id === 'cursor') return state.run.seed.built.includes('save')
    && Number.isFinite(cursorPrice(state)) && state.resources.pixels >= cursorPrice(state);
  const next = visibleSeedItems(state)[0];
  const item = BALANCE.w1.items.find(item => item.id === id)!;
  return id === next && state.resources.pixels >= item.cost;
}

function addGuide(state: GameState, id: GuideId): GameState {
  const seed = state.run.seed;
  if (seed.guide.seen.includes(id) || state.run.version !== 'v0.1') return state;
  return { ...state, run: { ...state.run, seed: { ...seed,
    guide: { seen: [...seed.guide.seen, id], current: id, collapsed: false },
  } } };
}

export function updateSeedGuide(state: GameState): GameState {
  let next = state;
  if (state.run.seed.built.includes('color')) next = addGuide(next, 'intro');
  if (visibleSeedItems(state).includes('kumiki')) next = addGuide(next, 'tool');
  if (state.run.seed.built.includes('color') && state.elapsedMs - state.run.seed.lastActionAt >= BALANCE.w1.hintAfterMs
    && !state.run.seed.built.includes('kumiki')) next = addGuide(next, 'hint');
  return next;
}

export function buildSeed(state: GameState, id: SeedItem | 'cursor', now: number): GameState {
  if (!canBuildSeed(state, id)) return state;
  const seed = state.run.seed;
  const cost = id === 'cursor' ? cursorPrice(state) : BALANCE.w1.items.find(item => item.id === id)!.cost;
  const next = updateSeedGuide({ ...state,
    resources: { ...state.resources, pixels: Math.max(0, state.resources.pixels - cost) },
    run: { ...state.run, seed: { ...seed,
      built: id === 'cursor' ? seed.built : [...seed.built, id],
      autoCursors: seed.autoCursors + (id === 'cursor' ? 1 : 0),
      history: [...seed.history, { item: id, at: now }], lastActionAt: state.elapsedMs,
    } },
  });
  return id === 'kumiki' ? enterKumiki(next) : next;
}

export interface Momentum { value: number; lastPressAt: number | null }
export const freshMomentum = (): Momentum => ({ value: 1, lastPressAt: null });

export function momentumAt(momentum: Momentum, now: number): number {
  if (momentum.lastPressAt === null) return 1;
  const remaining = Math.max(0, 1 - Math.max(0, now - momentum.lastPressAt) / BALANCE.w1.momentum.decayMs);
  return 1 + (momentum.value - 1) * remaining;
}

export function pressSeed(state: GameState, momentum: Momentum, now: number) {
  if (state.run.world === 'release' || state.run.seed.installer || state.run.restartMs > 0) return { state, momentum, pixels: 0 };
  const motion = state.run.seed.built.includes('motion');
  const decayed = motion ? momentumAt(momentum, now) : 1;
  const value = motion && momentum.lastPressAt !== null && now - momentum.lastPressAt <= BALANCE.w1.momentum.chainMs
    ? Math.min(BALANCE.w1.momentum.max, decayed + BALANCE.w1.momentum.increment) : decayed;
  const pixels = manualClickValue(state) * value;
  const next = creditPixels(state, pixels);
  return { state: { ...next, run: { ...next.run, seed: { ...next.run.seed, lastActionAt: next.elapsedMs } } },
    momentum: { value, lastPressAt: now }, pixels };
}

export function readGuide(state: GameState, id: GuideId | 'close' | 'listen'): GameState {
  if (id === 'listen') return addGuide({ ...state, run: { ...state.run, seed: { ...state.run.seed, lastActionAt: state.elapsedMs } } }, 'instructions');
  const seed = state.run.seed;
  if (id !== 'close' && !seed.guide.seen.includes(id)) return state;
  return { ...state, run: { ...state.run, seed: { ...seed,
    lastActionAt: state.elapsedMs,
    guide: { ...seed.guide, current: id === 'close' ? seed.guide.current : id, collapsed: id === 'close' },
  } } };
}

export function applySeedSkills(state: GameState, selected: readonly SeedSkill[], pattern: GameState['persistent']['seedAppearance']['pattern'], marquee: boolean): GameState {
  const skills = [...new Set(selected)];
  if (skills.some(id => !BALANCE.w1.skills.some(skill => skill.id === id))) return state;
  const additions = BALANCE.w1.skills.filter(skill => skills.includes(skill.id) && !state.persistent.seedSkills.includes(skill.id));
  if (additions.some(skill => skill.band === 2 && state.run.version === 'v0.1')) return state;
  const cost = additions.reduce((sum, skill) => sum + skill.cost, 0);
  if (cost > state.resources.tokens) return state;
  const owned = [...state.persistent.seedSkills, ...additions.map(skill => skill.id)];
  return { ...state, resources: { ...state.resources, tokens: state.resources.tokens - cost },
    run: { ...state.run, seed: { ...state.run.seed, lastActionAt: state.elapsedMs } },
    persistent: { ...state.persistent, seedSkills: owned, seedAppearance: {
      pattern: owned.includes('pattern') ? pattern : 'none', marquee: owned.includes('marquee') && marquee,
    } },
  };
}

// リリース後の作り直し。永続データを複製し、今の構成だけを初期化する。
export function createSeedVersion(previous: GameState, version: 'v1' | 'v2', now: number): GameState {
  const next = createInitialState(now);
  next.run.version = version;
  next.persistent = structuredClone(previous.persistent);
  next.resources.tokens = previous.resources.tokens;
  next.resources.dollars = previous.resources.dollars;
  if (previous.persistent.seedSkills.includes('inherit')) {
    const items = BALANCE.w1.items.filter(item => item.id !== 'kumiki' && previous.run.seed.built.includes(item.id)).map(item => item.id);
    if (items.length) next.run.seed.installer = { items, elapsedMs: 0 };
  }
  return next;
}

export function advanceSeedInstaller(state: GameState, activeMs: number): GameState {
  const installer = state.run.seed.installer;
  if (!installer) return state;
  const elapsedMs = Math.min(BALANCE.w1.inheritMs, installer.elapsedMs + activeMs);
  const count = Math.floor(elapsedMs / BALANCE.w1.inheritMs * installer.items.length);
  const built = [...new Set([...state.run.seed.built, ...installer.items.slice(0, count)])];
  const additions = built.filter(item => !state.run.seed.built.includes(item));
  return { ...state, run: { ...state.run, seed: { ...state.run.seed, built,
    history: [...state.run.seed.history, ...additions.map(item => ({ item, at: state.lastTickAt }))],
    installer: elapsedMs === BALANCE.w1.inheritMs ? null : { ...installer, elapsedMs },
  } } };
}
