import { isPageDesign, type PageDesign } from './pageDesign';
import { BALANCE, type KumikiItem, type KumikiSkill, type PartId, type SeedItem, type SeedSkill, type SpecKey } from '../config/balance';
import { isDesignMap, isExportedWork, PART_IDS, type Design, type ExportedWork } from './kumikiState';
import type { SeedState } from './state';

export interface ProductScreen {
  page?:PageDesign;legacyBonus?:{auto:number;drawing:number};
  pixels: number; built: SeedItem[]; cursors: number; kumikiBuilt: KumikiItem[]; placed: PartId[];
  design: Record<string, Design>; focus: boolean; interval: number; exportName: string;
  specs: Record<SpecKey, number>; seedSkills: SeedSkill[];
  pattern: 'none' | 'dots' | 'grid' | 'diagonal'; marquee: boolean;
  kumikiSkills: KumikiSkill[]; modern: boolean; log: { at: number; pixels: number }[];
  history: SeedState['history'];
}
export interface ProductRecord {
  id: number; name: string | null; version: 'v0.1'; releasedAt: number; author: string | null;
  generatedPixels: number; builtCount: number; revenue: number;
  screen: ProductScreen; exports: ExportedWork[];
}
export interface ShippingState { productId: number; elapsedMs: number }
export interface GuideRecord { kind: 'seed' | 'kumiki' | 'release'; id: string; version: 'v0.1' | 'v1' | 'v2' }

const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const count = (x: unknown): x is number => amount(x) && Number.isSafeInteger(x);
const ids = (x: unknown, allowed: readonly unknown[]): x is string[] => Array.isArray(x) && new Set(x).size === x.length && x.every(id => allowed.includes(id));
export function isProductRecord(x: unknown): x is ProductRecord {
  if (!obj(x) || !(x.name === null || typeof x.name === 'string' && [...x.name].length <= BALANCE.release.maxProductName) || !count(x.id) || x.id < 1 || x.version !== 'v0.1' || !amount(x.releasedAt)
    || x.author !== null && typeof x.author !== 'string' || !amount(x.generatedPixels) || !count(x.builtCount) || !count(x.revenue)) return false;
  const s = x.screen;
  if (!obj(s) || !amount(s.pixels) || !count(s.cursors) || !ids(s.built, BALANCE.w1.items.map(i => i.id))
    || !ids(s.kumikiBuilt, [...BALANCE.w2.items.map(i => i.id),'switch','slider']) || !ids(s.placed, PART_IDS) || !isDesignMap(s.design)
    || typeof s.focus !== 'boolean' || !count(s.interval) || s.interval < BALANCE.w2.intervalMin || s.interval > BALANCE.w2.intervalMax
    || typeof s.exportName !== 'string' || !ids(s.seedSkills, BALANCE.w1.skills.map(i => i.id))
    || !['none', 'dots', 'grid', 'diagonal'].includes(s.pattern as string) || typeof s.marquee !== 'boolean'
    || !ids(s.kumikiSkills, BALANCE.w2.skills.map(i => i.id)) || typeof s.modern !== 'boolean') return false;
  if(s.page!==undefined&&!isPageDesign(s.page))return false;
  if(s.legacyBonus!==undefined&&(!obj(s.legacyBonus)||!amount(s.legacyBonus.auto)||s.legacyBonus.auto<1||s.legacyBonus.auto>1.2||!amount(s.legacyBonus.drawing)||s.legacyBonus.drawing<1||s.legacyBonus.drawing>2))return false;
  if (!obj(s.specs) || !(Object.keys(BALANCE.spec) as SpecKey[]).every(key => obj(s.specs) && count(s.specs[key]) && s.specs[key] < BALANCE.spec[key].length)) return false;
  if (!Array.isArray(s.log) || !s.log.every(e => obj(e) && amount(e.at) && amount(e.pixels))) return false;
  if (!Array.isArray(s.history) || !s.history.every(e => obj(e) && ['cursor', ...BALANCE.w1.items.map(i => i.id)].includes(e.item as SeedItem | 'cursor') && amount(e.at))) return false;
  return Array.isArray(x.exports) && x.exports.every(isExportedWork)
    && new Set(x.exports.map(e => `${e.kind}:${e.id}`)).size === x.exports.length;
}
export function isGuideArchive(x: unknown): x is GuideRecord[] {
  const allowed = {
    seed: ['intro', 'instructions', 'tool', 'hint', 'return'],
    kumiki: ['entered', 'draw', 'complete', 'export', 'extensions', 'name', 'wall', 'hint'],
    release: ['confirm', 'sales'],
  };
  return Array.isArray(x) && x.every(e => obj(e) && ['v0.1', 'v1', 'v2'].includes(e.version as string)
    && Object.keys(allowed).includes(e.kind as string) && allowed[e.kind as keyof typeof allowed].includes(e.id as string))
    && new Set(x.map(e => `${e.version}:${e.kind}:${e.id}`)).size === x.length;
}
