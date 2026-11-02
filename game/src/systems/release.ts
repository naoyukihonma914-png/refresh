import { BALANCE,type SpecKey } from '../config/balance';
import { editorStage } from './appearance';
import { encodeScene,projectCapture,readCapture } from './captureScene';
import { activeScreenshots,desktopConditions } from './desktop';
import type { Screenshot } from './desktopState';
import { reconcileProgress } from './longPlay';
import { presentationAtRelease } from './releasePresentation';
import type { GuideRecord,ProductRecord,ProductScreen } from './releaseState';
import { createSeedVersion } from './seed';
import { createInitialState,type GameState } from './state';
import { completedParts,prototypeConditions,setComplete } from './workshop';

export const SPEC_ORDER: readonly SpecKey[] = ['color', 'storage', 'memory', 'resolution', 'network', 'refresh', 'graphics'];
const uniqueExports = (state:GameState) => Object.entries(state.run.workshop.parts).flatMap(([id,part])=>part.exportedAt===null?[]:[{kind:'part' as const,id,name:null,at:part.exportedAt}]);
export const v1Conditions = (state: GameState): boolean[] => desktopConditions(state);
export function selectedReleaseScreenshots(state: GameState, selectedIds?: readonly number[]): Screenshot[] {
  const available = activeScreenshots(state);
  const selected = selectedIds?.length ? selectedIds.flatMap(id => available.find(shot => shot.id === id) ?? []) : [...available].reverse();
  return [...new Map(selected.map(shot => [shot.id, shot])).values()].slice(0, state.run.version === 'v0.1' ? 2 : BALANCE.release.storeMaxScreenshots);
}
function captureDependencies(roots: Screenshot[], catalog: Screenshot[]): Screenshot[] {
  const included = new Set(roots.map(shot => shot.id)), dependencies = new Map<number, Screenshot>();
  const visit = (shot: Screenshot) => {
    const scene = readCapture(shot), refs = scene.files.flatMap(file => file.shotId === undefined ? [] : [file.shotId]);
    if (scene.version !== 1) for (const source of [scene.view.photo.source, scene.view.preferences.wallpaper?.source]) {
      if (source?.startsWith('shot:')) refs.push(Number(source.slice(5)));
    }
    for (const id of refs) {
      if (included.has(id)) continue;
      const dependency = catalog.find(shot => shot.id === id);
      if (!dependency) continue;
      included.add(id); dependencies.set(id, dependency); visit(dependency);
    }
  };
  for (const shot of roots) visit(shot);
  return structuredClone([...dependencies.values()].sort((a, b) => a.id - b.id));
}
export function releaseScreenshotBonus(state: GameState, selectedIds?: readonly number[]): number {
  const r = BALANCE.release;
  return selectedReleaseScreenshots(state, selectedIds).reduce((best, shot) => {
    const scene = readCapture(shot), windows = Object.values(scene.desktop.windows).filter(w => w.open && !w.minimized);
    const screen = 'screen' in scene ? scene.screen : { width: 1920, height: 1080 };
    const fits = windows.length ? windows.filter(w => w.x >= 0 && w.y >= 0 && w.x + w.width <= screen.width && w.y + w.height <= screen.height).length / windows.length : 0;
    const quality = Math.min(1, scene.display.parts / r.screenshotQualityParts) * r.screenshotQualityWeights.parts
      + Math.min(1, windows.length / r.screenshotQualityApps) * r.screenshotQualityWeights.apps + fits * r.screenshotQualityWeights.placement;
    return Math.max(best, Math.min(r.screenshotBonusMax, quality * r.screenshotBonusMax));
  }, 0);
}
export function releaseEstimate(state: GameState, selectedIds?: readonly number[]): number {
  const r = BALANCE.release;
  const elements = state.run.seed.built.length + completedParts(state).length
    + (state.run.version === 'v0.1' ? 0 : state.run.desktop.upgrades.length);
  return Math.floor(r.base * (state.run.totalPixelsGenerated / r.pixelUnit) ** r.exponent * (1 + r.perElement * elements) * (1 + releaseScreenshotBonus(state, selectedIds)));
}
export function canReleasePrototype(state: GameState): boolean {
  return state.run.world === 'kumiki' && state.run.version === 'v0.1' && state.run.workshop.exitInspected
    && state.persistent.specs.color === 0 && setComplete(state,'files') && setComplete(state,'mail') && prototypeConditions(state).every(Boolean)
    && !state.persistent.products.some(p => p.version === 'v0.1');
}
export function canReleaseV1(state: GameState): boolean {
  return state.run.world === 'desktop' && state.run.version === 'v1' && v1Conditions(state).every(Boolean)
    && !state.persistent.products.some(p => p.version === 'v1.0');
}
export const canRelease = (state: GameState) => canReleasePrototype(state) || canReleaseV1(state);
const nextVersionRequirements = (state: GameState): [SpecKey, number][] => state.run.version === 'v0.1'
  ? [['color', BALANCE.release.prototypeColorLevel]]
  : [['color', BALANCE.release.prototypeColorLevel], ['refresh', BALANCE.release.v1RefreshLevel]];
function requiredSpecBudget(state: GameState, buying?: SpecKey): number {
  return nextVersionRequirements(state).reduce((sum, [key, goal]) => sum + BALANCE.spec[key].slice(state.persistent.specs[key] + (buying === key ? 2 : 1), goal + 1).reduce((price, step) => price + step.price, 0), 0);
}
export const canFundNextVersion = (state: GameState, selectedIds?: readonly number[]) => state.resources.dollars + releaseEstimate(state, selectedIds) >= requiredSpecBudget(state);

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
function createReleasedProduct(original: GameState, now: number, reducedMotion: boolean, store: boolean, language: string, selectedIds?: readonly number[]): GameState {
  if (!(store ? canRelease(original) : canReleasePrototype(original)) || !canFundNextVersion(original, selectedIds)) return original;
  const state = original;
  const k = state.run.workshop, p = state.persistent;
  const screen: ProductScreen = structuredClone({
    pixels:state.resources.pixels,built:state.run.seed.built,cursors:state.run.seed.autoCursors,specs:p.specs,
    workshop:k,editorCustomization:p.editorCustomization,editorStage:editorStage(state),
  });
  const product: ProductRecord = { presentation: presentationAtRelease(state), id: Math.max(0, ...p.products.map(p => p.id)) + 1, name: p.productName, version: state.run.version === 'v0.1' ? 'v0.1' : 'v1.0', releasedAt: now, author: p.playerName,
    generatedPixels: state.run.totalPixelsGenerated, builtCount: screen.built.length + completedParts(state).length + (state.run.version === 'v0.1' ? 0 : state.run.desktop.upgrades.length),
    revenue: releaseEstimate(state, selectedIds), screen, exports: structuredClone(uniqueExports(state)),
    ...(store ? { screenshots: structuredClone(selectedReleaseScreenshots(state, selectedIds)), screenshotBonus: releaseScreenshotBonus(state, selectedIds) } : {}),
    ...(store && state.run.world === 'desktop' ? { capture: { id: Math.max(p.desktopPrefs.lastShotId, p.screenshots.at(-1)?.id ?? 0) + 1, at: now, language, data: encodeScene(projectCapture(state, language)) } } : {}),
  };
  if (store) product.captureCatalog = captureDependencies([...(product.screenshots ?? []), ...(product.capture ? [product.capture] : [])], p.screenshots);
  let next: GameState = { ...state, resources: { ...state.resources, dollars: state.resources.dollars + product.revenue },
    run: { ...state.run, world: 'release', shipping: { productId: product.id, elapsedMs: !store && reducedMotion ? BALANCE.release.animationMs : 0,
      ...(store ? { phase: 'store' as const, storeElapsedMs: reducedMotion ? BALANCE.release.storeAnimationMs : 0 } : {}) } },
    persistent: { ...p, products: [...p.products, product] },
  };
  for (const id of state.run.seed.guide.seen) next = archiveGuide(next, { kind: 'seed', id, version: state.run.version });
  for (const id of k.guide.seen) next = archiveGuide(next, { kind: 'kumiki', id, version: state.run.version });
  next = archiveGuide(next, { kind: 'release', id: 'confirm', version: state.run.version });
  next = archiveGuide(next, { kind: 'release', id: 'sales', version: state.run.version });
  return store ? reconcileProgress(next, now) : next;
}
// Existing saved shipping scenes and fixtures continue from the sales screen.
export function beginPrototypeRelease(state: GameState, now: number, reducedMotion = false): GameState {
  return createReleasedProduct(state, now, reducedMotion, false, 'ja');
}
export interface ProductReleaseOptions { language?: string; screenshotIds?: readonly number[]; reducedMotion?: boolean }
export function beginProductRelease(state: GameState, now: number, options: ProductReleaseOptions = {}): GameState {
  return createReleasedProduct(state, now, options.reducedMotion ?? false, true, options.language ?? 'ja', options.screenshotIds);
}
export const storeComplete = (state: GameState) => state.run.world === 'release' && state.run.shipping?.phase === 'store'
  && (state.run.shipping.storeElapsedMs ?? 0) >= BALANCE.release.storeAnimationMs;
export function showShipping(state: GameState, reducedMotion = false): GameState {
  if (!storeComplete(state)) return state;
  return { ...state, run: { ...state.run, shipping: { ...state.run.shipping!, phase: 'shipping', elapsedMs: reducedMotion ? BALANCE.release.animationMs : 0 } } };
}
export function advanceShipping(state: GameState, activeMs: number): GameState {
  const shipping = state.run.shipping;
  if (state.run.world !== 'release' || !shipping) return state;
  if (shipping.phase === 'store') return { ...state, run: { ...state.run, shipping: { ...shipping, storeElapsedMs: Math.min(BALANCE.release.storeAnimationMs, (shipping.storeElapsedMs ?? 0) + Math.max(0, activeMs)) } } };
  return { ...state, run: { ...state.run, shipping: { ...shipping, elapsedMs: Math.min(BALANCE.release.animationMs, shipping.elapsedMs + Math.max(0, activeMs)) } } };
}
export const shippingComplete = (state: GameState) => state.run.world === 'release' && !!state.run.shipping && state.run.shipping.phase !== 'store' && state.run.shipping.elapsedMs >= BALANCE.release.animationMs;
export const shippingProduct = (state: GameState) => state.persistent.products.find(p => p.id === state.run.shipping?.productId);

export function canBuySpec(state: GameState, key: SpecKey): boolean {
  if (!shippingComplete(state)) return false;
  const level = state.persistent.specs[key], item = BALANCE.spec[key][level + 1];
  if (!item || item.price > state.resources.dollars) return false;
  // Keep the money needed for the next world's display requirement (256 colors / 60 Hz).
  const reserve = requiredSpecBudget(state, key);
  return state.resources.dollars - item.price >= reserve;
}
export function buySpec(state: GameState, key: SpecKey): GameState {
  if (!canBuySpec(state, key)) return state;
  const level = state.persistent.specs[key] + 1;
  return { ...state, resources: { ...state.resources, dollars: state.resources.dollars - BALANCE.spec[key][level]!.price },
    persistent: { ...state.persistent, specs: { ...state.persistent.specs, [key]: level } } };
}
export const canStartNextVersion = (state: GameState) => shippingComplete(state) && nextVersionRequirements(state).every(([key, level]) => state.persistent.specs[key] >= level);
export function startNextVersion(state: GameState, now: number): GameState {
  if (!canStartNextVersion(state)) return state;
  const next = createSeedVersion(state,state.run.version==='v0.1'?'v1':'v2',now);
  next.run.restartMs = BALANCE.release.restartMs;
  next.run.seed.guide = { seen: ['return'], current: 'return', collapsed: false };
  return next;
}
export function productPreviewState(product:ProductRecord):GameState {
 const s=product.screen,next=createInitialState(product.releasedAt);
 next.resources.pixels=s.pixels;next.run.totalPixelsGenerated=product.generatedPixels;
 next.run.version=product.version==='v0.1'?'v0.1':'v1';next.run.world='kumiki';
 next.run.seed.built=s.built.filter(id=>BALANCE.w1.items.some(item=>item.id===id)) as GameState['run']['seed']['built'];
 next.run.seed.autoCursors=s.cursors;next.persistent.specs={...s.specs};
 if(s.workshop)next.run.workshop=structuredClone(s.workshop);
 if(s.editorCustomization)next.persistent.editorCustomization=structuredClone(s.editorCustomization);
 return next;
}
