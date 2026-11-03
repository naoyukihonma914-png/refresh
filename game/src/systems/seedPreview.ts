import { BALANCE } from '../config/balance';
import { PAGE_PARTS, initialPageLayout } from './pageDesign';
import type { GameState } from './state';

/** The player's own seed screen with every item built and every part fitted — the finished picture the future preview shows. The input state is never touched. */
export function completedSeedPreviewState(state: GameState): GameState {
  const next = structuredClone(state), seed = next.run.seed;
  seed.built = BALANCE.w1.items.map(item => item.id);
  seed.autoCursors = Math.max(1, seed.autoCursors);
  seed.guide = { ...seed.guide, current: null };
  seed.page = { ...seed.page, fitted: [...PAGE_PARTS], layout: seed.page.layout ?? initialPageLayout(), piecePositions: undefined };
  return next;
}
