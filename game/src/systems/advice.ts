import { BALANCE } from '../config/balance';
import { desktopConditions } from './desktop';
import { canExportWorkshop, completedParts, nextWorkshopSet, prototypeConditions, canAssembleDesktop } from './workshop';
import { contractBlocks } from './longPlay';
import type { GameState } from './state';

export const ADVICE_IDS = [
  'seed-cursor', 'seed-upgrade', 'seed-kumiki',
  'editor-produce', 'editor-export', 'editor-place', 'editor-build', 'editor-prototype', 'editor-desktop',
  'desktop-apps', 'desktop-feedback', 'desktop-sets', 'desktop-wallpaper', 'desktop-automation', 'desktop-release',
] as const;
export type AdviceId = typeof ADVICE_IDS[number];
export interface AdviceState {
  seen: AdviceId[];
  current: AdviceId | null;
  fingerprint: string;
  idleMs: number;
}
export const createAdviceState = (): AdviceState => ({ seen: [], current: null, fingerprint: '', idleMs: 0 });

/** Choose an action the player can perform, rather than an unrelated generic tip. */
export function nextAdvice(state: GameState): AdviceId | null {
  const { run } = state, seed = run.seed, k = run.workshop;
  if (run.world === 'release' || run.restartMs > 0 || seed.installer) return null;
  if (run.world === 'seed') {
    // The publisher first introduces himself after Color in the prototype.
    if (run.version === 'v0.1' && !seed.built.includes('color')) return null;
    if (seed.built.includes('save') && seed.autoCursors === 0 && !contractBlocks(state, 'cursor')) return 'seed-cursor';
    if (seed.built.includes('motion')) return 'seed-kumiki';
    return 'seed-upgrade';
  }
  if (run.world === 'kumiki') {
    if (canExportWorkshop(state)) return 'editor-export';
    if (run.version === 'v0.1' && k.exitInspected && prototypeConditions(state).every(Boolean)) return 'editor-prototype';
    if (canAssembleDesktop(state)) return 'editor-desktop';
    if (k.activePart && (k.parts[k.activePart]?.step ?? 0) < 4) return 'editor-produce';
    return nextWorkshopSet(state) ? 'editor-build' : 'editor-produce';
  }
  if (run.version !== 'v1') return null;
  const missing = desktopConditions(state).findIndex(done => !done);
  return (['desktop-apps', 'desktop-feedback', 'desktop-sets', 'desktop-wallpaper', 'desktop-automation'] as const)[missing] ?? 'desktop-release';
}

function fingerprint(state: GameState, id: AdviceId | null): string {
  const run = state.run;
  const activity = run.world === 'seed' ? run.seed.lastActionAt
    : run.world === 'kumiki' ? run.workshop.lastActionAt
    : Math.max(0, Math.round(state.elapsedMs - run.desktop.idleMs));
  return JSON.stringify([run.version, run.world, id, activity, run.seed.built, run.seed.autoCursors,
    run.workshop.purchasedSets, completedParts(state), Object.values(run.workshop.parts).map(part=>[part.step,part.exportedAt]),
    run.desktop.upgrades, run.desktop.feedback.filter(work => work.completedAt !== null).length,
    state.persistent.desktopPrefs.wallpaper, run.desktop.terminal.executions]);
}

/** Call only with foreground time. Offline credit must never trigger advice. */
export function advanceAdvice(memory: AdviceState, state: GameState, activeMs: number): AdviceState {
  const id = nextAdvice(state), progress = fingerprint(state, id);
  if (progress !== memory.fingerprint || !id) {
    // Moving toward a notice or opening its history is activity too. Keep the
    // message readable until its suggested action changes or the player closes it.
    let previousId: unknown = null;
    try { previousId = JSON.parse(memory.fingerprint)[2]; } catch { /* An unprimed tracker has no prior action. */ }
    return { ...memory, fingerprint: progress, idleMs: 0, current: id && previousId === id ? memory.current : null };
  }
  const idleMs = Math.min(BALANCE.w2.hintMs, memory.idleMs + (Number.isFinite(activeMs) ? Math.max(0, activeMs) : 0));
  if (idleMs < BALANCE.w2.hintMs || memory.seen.includes(id)) return idleMs === memory.idleMs ? memory : { ...memory, idleMs };
  return { ...memory, idleMs, seen: [...memory.seen, id], current: id };
}

export function readAdvice(memory: AdviceState, id: AdviceId | null): AdviceState {
  return id !== null && !memory.seen.includes(id) ? memory : { ...memory, current: id };
}

export function isAdviceState(value: unknown): value is AdviceState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  return Array.isArray(x.seen) && new Set(x.seen).size === x.seen.length && x.seen.every(id => ADVICE_IDS.includes(id))
    && (x.current === null || x.seen.includes(x.current))
    && typeof x.fingerprint === 'string' && x.fingerprint.length <= 20_000
    && typeof x.idleMs === 'number' && Number.isFinite(x.idleMs) && x.idleMs >= 0 && x.idleMs <= BALANCE.w2.hintMs;
}
