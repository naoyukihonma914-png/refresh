import type { GameState } from './state';

export type SeedEra = 0 | 1;

export const seedEra = (state: GameState): SeedEra => state.persistent.seedAppearance.era ?? 0;
export const unlockedSeedEra = (state: GameState): SeedEra => state.persistent.seedAppearance.availableEra ?? 0;

/** The page changes its era on returning to it, rather than while it is nested in the desktop. */
export function seedAppearanceForNewVersion(state: GameState): GameState['persistent']['seedAppearance'] {
  const current = state.persistent.seedAppearance;
  if (state.persistent.desktopPrefs.skills.includes('major1') && unlockedSeedEra(state) === 0) {
    return { ...current, era: 1, availableEra: 1 };
  }
  return { ...current };
}

export function setSeedEra(state: GameState, era: SeedEra): GameState {
  if (![0, 1].includes(era) || era > unlockedSeedEra(state) || era === seedEra(state)) return state;
  return { ...state, persistent: { ...state.persistent, seedAppearance: { ...state.persistent.seedAppearance, era } } };
}
