import { BALANCE, type SpecKey } from '../config/balance';
import { createKumikiState } from './kumikiState';
import { flushHomeBank, prototypeConditions } from './kumiki';
import { createInitialState, type GameState } from './state';
import { createSeedVersion } from './seed';
import type { GuideRecord, ProductRecord, ProductScreen } from './releaseState';

export const SPEC_ORDER: readonly SpecKey[] = ['color', 'storage', 'memory', 'resolution', 'network', 'refresh', 'graphics'];
const uniqueExports = (state: GameState) => [...new Map(state.run.kumiki.exports.map(work => [`${work.kind}:${work.id}`, work])).values()];
export function releaseEstimate(state: GameState): number {
  const r = BALANCE.release;
  const elements = state.run.seed.built.length + state.run.kumiki.built.length + uniqueExports(state).filter(e => e.kind === 'icon').length;
  return Math.floor(r.base * ((state.run.totalPixelsGenerated + state.run.kumiki.bank) / r.pixelUnit) ** r.exponent * (1 + r.perElement * elements));
}
export function canReleasePrototype(state: GameState): boolean {
  return state.run.world === 'kumiki' && state.run.version === 'v0.1' && state.run.kumiki.exitInspected
    && state.persistent.specs.color === 0 && prototypeConditions(state).every(Boolean)
    && !state.persistent.products.some(p => p.version === 'v0.1');
}
export const canFundNextVersion = (state: GameState) => state.resources.dollars + releaseEstimate(state) >= BALANCE.spec.color[BALANCE.release.prototypeColorLevel]!.price;

export function dailySales(total: number): number[] {
  const weights = BALANCE.release.dailyWeights, sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(weight => total * weight / sum), result = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, fraction: value - result[index]! })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let n = total - result.reduce((a, b) => a + b, 0), i = 0; i < n; i++) result[order[i]!.index]!++;
  return result;
}
export function displayedSales(product: ProductRecord, elapsedMs: number): number[] {
  const progress = Math.min(1, Math.max(0, elapsedMs / BALANCE.release.animationMs)) * BALANCE.release.dailyWeights.length;
  return dailySales(product.revenue).map((amount, day) => Math.floor(amount * Math.max(0, Math.min(1, progress - day))));
}

export function archiveGuide(state: GameState, entry: GuideRecord): GameState {
  if (state.persistent.guideArchive.some(e => e.kind === entry.kind && e.id === entry.id && e.version === entry.version)) return state;
  return { ...state, persistent: { ...state.persistent, guideArchive: [...state.persistent.guideArchive, entry] } };
}
export function beginPrototypeRelease(original: GameState, now: number, reducedMotion = false): GameState {
  if (!canReleasePrototype(original) || !canFundNextVersion(original)) return original;
  const state = flushHomeBank(original);
  const k = state.run.kumiki, p = state.persistent;
  const screen: ProductScreen = structuredClone({
    page:state.run.seed.page,...(k.legacyBonus?{legacyBonus:k.legacyBonus}:{}),pixels: state.resources.pixels, built: state.run.seed.built, cursors: state.run.seed.autoCursors,
    kumikiBuilt: k.built, placed: k.placed, design: k.design, focus: k.focus, interval: k.interval, exportName: k.exportName,
    specs: p.specs, seedSkills: p.seedSkills, pattern: p.seedAppearance.pattern, marquee: p.seedAppearance.marquee,
    kumikiSkills: p.artwork.skills, modern: p.artwork.modern, log: k.generationLog, history: state.run.seed.history,
  });
  const product: ProductRecord = { id: p.products.length + 1, name: p.productName, version: 'v0.1', releasedAt: now, author: p.playerName,
    generatedPixels: state.run.totalPixelsGenerated, builtCount: screen.built.length + screen.kumikiBuilt.length,
    revenue: releaseEstimate(state), screen, exports: structuredClone(uniqueExports(state)) };
  let next: GameState = { ...state, resources: { ...state.resources, dollars: state.resources.dollars + product.revenue },
    run: { ...state.run, world: 'release', shipping: { productId: product.id, elapsedMs: reducedMotion ? BALANCE.release.animationMs : 0 } },
    persistent: { ...p, products: [...p.products, product], homeTheme: structuredClone(k.design) },
  };
  for (const id of state.run.seed.guide.seen) next = archiveGuide(next, { kind: 'seed', id, version: state.run.version });
  for (const id of k.guide.seen) next = archiveGuide(next, { kind: 'kumiki', id, version: state.run.version });
  next = archiveGuide(next, { kind: 'release', id: 'confirm', version: 'v0.1' });
  return archiveGuide(next, { kind: 'release', id: 'sales', version: 'v0.1' });
}
export function advanceShipping(state: GameState, activeMs: number): GameState {
  const shipping = state.run.shipping;
  if (state.run.world !== 'release' || !shipping) return state;
  return { ...state, run: { ...state.run, shipping: { ...shipping, elapsedMs: Math.min(BALANCE.release.animationMs, shipping.elapsedMs + activeMs) } } };
}
export const shippingComplete = (state: GameState) => state.run.world === 'release' && !!state.run.shipping && state.run.shipping.elapsedMs >= BALANCE.release.animationMs;
export const shippingProduct = (state: GameState) => state.persistent.products.find(p => p.id === state.run.shipping?.productId);

export function canBuySpec(state: GameState, key: SpecKey): boolean {
  if (!shippingComplete(state)) return false;
  const level = state.persistent.specs[key], item = BALANCE.spec[key][level + 1];
  if (!item || item.price > state.resources.dollars) return false;
  // 256色へ進めなくなる買い方を避け、先に必要な購入分を残す。
  const reserve = key !== 'color' && state.persistent.specs.color < BALANCE.release.prototypeColorLevel
    ? BALANCE.spec.color[BALANCE.release.prototypeColorLevel]!.price : 0;
  return state.resources.dollars - item.price >= reserve;
}
export function buySpec(state: GameState, key: SpecKey): GameState {
  if (!canBuySpec(state, key)) return state;
  const level = state.persistent.specs[key] + 1;
  return { ...state, resources: { ...state.resources, dollars: state.resources.dollars - BALANCE.spec[key][level]!.price },
    persistent: { ...state.persistent, specs: { ...state.persistent.specs, [key]: level } } };
}
export const canStartNextVersion = (state: GameState) => shippingComplete(state) && state.persistent.specs.color >= BALANCE.release.prototypeColorLevel;
export function startNextVersion(state: GameState, now: number): GameState {
  if (!canStartNextVersion(state)) return state;
  const next = createSeedVersion(state, 'v1', now);
  next.run.restartMs = BALANCE.release.restartMs;
  next.run.seed.guide = { seen: ['return'], current: 'return', collapsed: false };
  return next;
}
export function productPreviewState(product: ProductRecord): GameState {
  const s = product.screen, next = createInitialState(product.releasedAt);
  next.resources.pixels = s.pixels;
  next.run.totalPixelsGenerated = product.generatedPixels;
  next.run.version = product.version; next.run.world = 'kumiki';
  next.run.seed.built = [...s.built]; next.run.seed.autoCursors = s.cursors;
  next.run.seed.history = s.history;
  if(s.page)next.run.seed.page=structuredClone(s.page);
  next.run.kumiki = { ...createKumikiState(), entered: true, activeDrawing: 'free', built: s.kumikiBuilt, placed: s.placed,
    design: s.design,legacyBonus:s.legacyBonus, focus: s.focus, interval: s.interval, exportName: s.exportName, generationLog: s.log };
  next.persistent.specs = s.specs; next.persistent.seedSkills = s.seedSkills;
  next.persistent.seedAppearance = { pattern: s.pattern, marquee: s.marquee };
  next.persistent.artwork.skills = s.kumikiSkills; next.persistent.artwork.modern = s.modern;
  return next;
}
