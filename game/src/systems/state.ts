import {createProgress,createPlay,isProgress,isPlay,type Progress,type PlayState} from './longPlay';
import { createPageDesign, isPageDesign, type PageDesign } from './pageDesign';
import { desktopScreen } from './desktopGeometry';
import { createAppearance, unlockedEditorStage, unlockedDesktopStage, type Appearance } from './appearance';
import { createDesktopPreferences, isDesktopPreferences, type DesktopPreferences, createDesktopState, isDesktopState, isScreenshot, type DesktopState, type Screenshot } from './desktopState';
import { BALANCE, type SeedItem, type SeedSkill, type SpecKey } from '../config/balance';
import { createArtwork, createKumikiState, isArtwork, isDesignMap, isKumikiState, type Artwork, type Design, type KumikiState } from './kumikiState';
import { isGuideArchive, isProductRecord, type GuideRecord, type ProductRecord, type ShippingState } from './releaseState';

export const SCHEMA_VERSION = 13;

export const GUIDE_IDS = ['intro', 'instructions', 'tool', 'hint', 'return'] as const;
export type GuideId = typeof GUIDE_IDS[number];
export interface SeedState {
  page:PageDesign;
  built: SeedItem[];
  autoCursors: number;
  history: { item: SeedItem | 'cursor'; at: number }[];
  guide: { seen: GuideId[]; current: GuideId | null; collapsed: boolean };
  lastActionAt: number; // 能動経過時間。端末時計の変更に影響されない。
  installer: { items: SeedItem[]; elapsedMs: number } | null;
}

// ここには JSON として保存できるものだけを入れる。
// 選択中の道具・押しているキー・勢いなど、一時的な表示状態は入れない。
export interface GameState {
  legacyGeneration?:boolean;
  schemaVersion: typeof SCHEMA_VERSION;
  createdAt: number;
  lastTickAt: number; // 不在用の端末時計。能動時間には使わない。
  lastSavedAt: number | null;
  elapsedMs: number;
  resources: { pixels: number; tokens: number; dollars: number };
  run: {
    play:PlayState;
    version: 'v0.1' | 'v1' | 'v2';
    world: 'seed' | 'kumiki' | 'release' | 'desktop';
    shipping: ShippingState | null;
    restartMs: number;
    totalPixelsGenerated: number;
    seed: SeedState;
    kumiki: KumikiState;
    desktop: DesktopState;
  };
  persistent: {
    progress:Progress;
    appearance:Appearance;
    specs: Record<SpecKey, number>; playerName: string | null;
    productName: string | null;
    numberNotation: 'compact' | 'scientific';
    seedSkills: SeedSkill[];
    seedAppearance: { pattern: 'none' | 'dots' | 'grid' | 'diagonal'; marquee: boolean };
    artwork: Artwork;
    products: ProductRecord[];
    guideArchive: GuideRecord[];
    homeTheme: Record<string, Design>;
    screenshots: Screenshot[];
    desktopPrefs:DesktopPreferences;
    productionNote: string | null;
    noteUpdatedAt: number | null;
    homeUpdatedAt: number | null;
    sketchUpdatedAt: number | null;
  };
}

export function createInitialState(now: number): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    lastTickAt: now,
    lastSavedAt: null,
    elapsedMs: 0,
    resources: { pixels: 0, tokens: 0, dollars: 0 },
    run: {
      play:createPlay(),version: 'v0.1', world: 'seed', totalPixelsGenerated: 0, shipping: null, restartMs: 0,
      seed: {
        page:createPageDesign(),built: [], autoCursors: 0, history: [], lastActionAt: 0, installer: null,
        guide: { seen: [], current: null, collapsed: false },
      },
      kumiki: createKumikiState(), desktop: createDesktopState(),
    },
    persistent: {
      progress:createProgress(),appearance:createAppearance(),
      specs: { color: 0, resolution: 0, refresh: 0, memory: 0, storage: 0, network: 0, graphics: 0 },
      playerName: null, productName: null, numberNotation: 'compact',
      seedSkills: [], seedAppearance: { pattern: 'none', marquee: false },
      artwork: createArtwork(),
      products: [], guideArchive: [], homeTheme: {}, screenshots: [], desktopPrefs:createDesktopPreferences(), productionNote: null, noteUpdatedAt: null, homeUpdatedAt: null, sketchUpdatedAt: null,
    },
  };
}

export function canSave(state: GameState): boolean {
  return state.run.seed.built.includes('save');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

const isCount = (value: unknown): value is number => isAmount(value) && Number.isSafeInteger(value);

// ファイルからの読み込みにも同じ検査を使う。版番号だけを信用しない。
export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (![value.createdAt, value.lastTickAt, value.elapsedMs].every(isAmount)) return false;
  if (value.lastSavedAt !== null && !isAmount(value.lastSavedAt)) return false;
  if(!isRecord(value.persistent)||!isRecord(value.persistent.appearance)||![value.persistent.appearance.editor,value.persistent.appearance.desktop].every(v=>[0,1,2].includes(v as number)))return false;
  const resources = value.resources;
  const run = value.run;
  const persistent = value.persistent;
  if (!isRecord(resources) || !isRecord(run) || !isRecord(persistent)) return false;
  if (!isAmount(resources.pixels) || !isAmount(resources.tokens) || !isAmount(resources.dollars)) return false;
  if (!['v0.1', 'v1', 'v2'].includes(run.version as string) || !['seed', 'kumiki', 'release', 'desktop'].includes(run.world as string) || !isAmount(run.totalPixelsGenerated)) return false;
  if (!isAmount(run.restartMs) || run.restartMs > BALANCE.release.restartMs || !isGuideArchive(persistent.guideArchive) || !isDesignMap(persistent.homeTheme)) return false;
  if (!Array.isArray(persistent.products) || !persistent.products.every(isProductRecord)
    || new Set(persistent.products.map(p => p.id)).size !== persistent.products.length) return false;
  if (run.world === 'release' ? !isRecord(run.shipping) || !isCount(run.shipping.productId)
    || !persistent.products.some(p => p.id === (run.shipping as Record<string, unknown>).productId)
    || !isAmount(run.shipping.elapsedMs) || run.shipping.elapsedMs > BALANCE.release.animationMs : run.shipping !== null) return false;
  if(!isProgress(persistent.progress)||!isPlay(run.play))return false;
  if (!isDesktopPreferences(persistent.desktopPrefs)) return false;
  if (!isDesktopState(run.desktop) || run.world === 'desktop' && !run.desktop.entered) return false;
  const screen=desktopScreen((persistent.appearance as unknown as Appearance).desktop);
  if(run.desktop.screen.width!==screen.width||run.desktop.screen.height!==screen.height)return false;
  if (!Array.isArray(persistent.screenshots) || !persistent.screenshots.every(s => isScreenshot(s))
    || persistent.screenshots.some((s, i, shots) => i > 0 && s.id <= shots[i-1]!.id)
    || !(persistent.productionNote === null || typeof persistent.productionNote === 'string' && persistent.productionNote.length <= BALANCE.w3.maxNote)
    || ![persistent.noteUpdatedAt,persistent.homeUpdatedAt,persistent.sketchUpdatedAt].every(v=>v===null||isAmount(v))) return false;
  if (!isKumikiState(run.kumiki) || !isArtwork(persistent.artwork)) return false;
  if((persistent.appearance as unknown as Appearance).editor>unlockedEditorStage(value as unknown as GameState)||(persistent.appearance as unknown as Appearance).desktop>unlockedDesktopStage(value as unknown as GameState))return false;
  if (run.totalPixelsGenerated < resources.pixels) return false;
  if (!isRecord(run.seed) || !Array.isArray(run.seed.built) || !isCount(run.seed.autoCursors)) return false;
  const itemIds: readonly unknown[] = BALANCE.w1.items.map(item => item.id);
  if (!run.seed.built.every(item => itemIds.includes(item))) return false;
  if (new Set(run.seed.built).size !== run.seed.built.length) return false;
  const seed = run.seed;
  if(!isPageDesign(seed.page))return false;
  if (!isAmount(seed.lastActionAt) || !Array.isArray(seed.history)
    || !seed.history.every(entry => isRecord(entry) && (itemIds.includes(entry.item) || entry.item === 'cursor') && isAmount(entry.at))) return false;
  if (!isRecord(seed.guide) || !Array.isArray(seed.guide.seen)
    || !seed.guide.seen.every(id => GUIDE_IDS.includes(id as GuideId))
    || new Set(seed.guide.seen).size !== seed.guide.seen.length
    || (seed.guide.current !== null && !seed.guide.seen.includes(seed.guide.current))
    || typeof seed.guide.collapsed !== 'boolean') return false;
  if (seed.installer !== null && (!isRecord(seed.installer) || !Array.isArray(seed.installer.items)
    || !seed.installer.items.every(item => itemIds.includes(item) && item !== 'kumiki')
    || new Set(seed.installer.items).size !== seed.installer.items.length
    || !isAmount(seed.installer.elapsedMs) || seed.installer.elapsedMs > BALANCE.w1.inheritMs)) return false;
  if (!Array.isArray(persistent.seedSkills) || !persistent.seedSkills.every(id => BALANCE.w1.skills.some(skill => skill.id === id))
    || new Set(persistent.seedSkills).size !== persistent.seedSkills.length) return false;
  if (!isRecord(persistent.seedAppearance) || !['none', 'dots', 'grid', 'diagonal'].includes(persistent.seedAppearance.pattern as string)
    || typeof persistent.seedAppearance.marquee !== 'boolean') return false;
  if (!(persistent.productName === null || typeof persistent.productName === 'string' && [...persistent.productName].length <= BALANCE.release.maxProductName) || !['compact','scientific'].includes(persistent.numberNotation as string)) return false;
  if (persistent.playerName !== null && typeof persistent.playerName !== 'string') return false;
  const specs = persistent.specs;
  if (!isRecord(specs)) return false;
  return (Object.keys(BALANCE.spec) as SpecKey[]).every(key =>
    isCount(specs[key]) && specs[key] < BALANCE.spec[key].length,
  );
}
