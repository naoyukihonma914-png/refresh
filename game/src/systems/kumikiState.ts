import { BALANCE, type KumikiItem, type KumikiSkill, type PartId } from '../config/balance';
import { ICON_IDS, PRACTICE_IDS } from '../content/kumikiArt';
const KNOWN_ICONS: readonly string[] = [...ICON_IDS, ...PRACTICE_IDS];

export const PART_IDS: readonly PartId[] = ['button', 'switch', 'slider', 'input', 'frame', 'taskbar', 'tabs', 'table'];
export const K_GUIDES = ['entered', 'draw', 'complete', 'export', 'extensions', 'name', 'wall', 'hint'] as const;
export type KumikiGuide = typeof K_GUIDES[number];
export interface Drawing { size: number; frames: number[][]; rewarded: boolean[]; exported: boolean; dirty: boolean; name: string | null }
export interface Design { color: string; radius: number; textSize: 'small' | 'medium' | 'large'; shadow: boolean }
export interface ExportedWork { kind: 'icon' | 'part'; id: string; name: string | null; at: number; size: number; frames: number[][] }
export interface KumikiState {
  entered: boolean; enteredAt: number; built: KumikiItem[]; placed: PartId[];
  drawings: Record<string, Drawing>; underlays: Record<string, Drawing>; exports: ExportedWork[];
  activeDrawing: string;
  design: Record<string, Design>;
  focus: boolean; interval: number; exportName: string;
  bank: number; batchMs: number; driftTimerMs: number;
  generationLog: { at: number; pixels: number }[];
  drift: { part: PartId; dx: number; dy: number; angle: number } | null;
  guide: { seen: KumikiGuide[]; read: KumikiGuide[]; current: KumikiGuide | null; collapsed: boolean };
  lastActionAt: number; exitInspected: boolean; tokenDiscovered: boolean;
  homeWindow: 'normal' | 'minimized' | 'maximized' | 'closed';
}
export interface Artwork {
  icons: Record<string, Drawing>; sketchbook: Drawing; wallpaper: Drawing | null;
  skills: KumikiSkill[]; modern: boolean;
}
export function blankDrawing(size: number): Drawing {
  return { size, frames: [Array<number>(size * size).fill(-1)], rewarded: Array<boolean>(size * size).fill(false), exported: false, dirty: true, name: null };
}
export function createArtwork(): Artwork { return { icons: {}, sketchbook: blankDrawing(16), wallpaper: null, skills: [], modern: false }; }
export function createKumikiState(): KumikiState {
  return { entered: false, enteredAt: 0, built: [], placed: [], drawings: {}, underlays: {}, exports: [], activeDrawing: 'folder',
    design: {}, focus: false, interval: 1, exportName: '', bank: 0, batchMs: 0, driftTimerMs: 0, drift: null, generationLog: [],
    guide: { seen: [], read: [], current: null, collapsed: false }, lastActionAt: 0, exitInspected: false, tokenDiscovered: false, homeWindow: 'normal' };
}

const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const ids = (x: unknown, allowed: readonly unknown[]): x is string[] => Array.isArray(x) && new Set(x).size === x.length && x.every(id => allowed.includes(id));
export function isDrawing(x: unknown): x is Drawing {
  if (!obj(x) || ![16, 32, 64, 128].includes(x.size as number)) return false;
  const cells = (x.size as number) ** 2;
  return Array.isArray(x.frames) && x.frames.length >= 1 && x.frames.length <= 2
    && x.frames.every(frame => Array.isArray(frame) && frame.length === cells && frame.every(c => Number.isInteger(c) && c >= -1 && c < 256))
    && Array.isArray(x.rewarded) && x.rewarded.length === cells && x.rewarded.every(v => typeof v === 'boolean')
    && typeof x.exported === 'boolean' && typeof x.dirty === 'boolean' && (x.name === null || typeof x.name === 'string');
}
export function isArtwork(x: unknown): x is Artwork {
  return obj(x) && obj(x.icons) && Object.entries(x.icons).every(([id, drawing]) => KNOWN_ICONS.includes(id) && isDrawing(drawing)) && isDrawing(x.sketchbook)
    && (x.wallpaper === null || isDrawing(x.wallpaper)) && typeof x.modern === 'boolean'
    && ids(x.skills, BALANCE.w2.skills.map(s => s.id));
}
export function isKumikiState(x: unknown): x is KumikiState {
  if (!obj(x) || !ids(x.built, BALANCE.w2.items.map(i => i.id)) || !ids(x.placed, PART_IDS)) return false;
  if (!obj(x.drawings) || !Object.entries(x.drawings).every(([id, drawing]) => KNOWN_ICONS.includes(id) && isDrawing(drawing))
    || !obj(x.underlays) || !Object.entries(x.underlays).every(([id, drawing]) => KNOWN_ICONS.includes(id) && isDrawing(drawing))) return false;
  if (typeof x.activeDrawing !== 'string' || x.entered && x.activeDrawing !== 'free' && !x.drawings[x.activeDrawing]) return false;
  if (!['enteredAt', 'bank', 'batchMs', 'driftTimerMs', 'lastActionAt'].every(key => amount(x[key]))) return false;
  if (!Array.isArray(x.generationLog) || !x.generationLog.every(entry => obj(entry) && amount(entry.at) && amount(entry.pixels))) return false;
  if (typeof x.entered !== 'boolean' || typeof x.focus !== 'boolean' || typeof x.exportName !== 'string'
    || typeof x.exitInspected !== 'boolean' || typeof x.tokenDiscovered !== 'boolean') return false;
  if (!Number.isInteger(x.interval) || (x.interval as number) < 1 || (x.interval as number) > 10) return false;
  if (!['normal', 'minimized', 'maximized', 'closed'].includes(x.homeWindow as string)) return false;
  if (!obj(x.guide) || !ids(x.guide.seen, K_GUIDES) || typeof x.guide.collapsed !== 'boolean'
    || !ids(x.guide.read, x.guide.seen)
    || x.guide.current !== null && !x.guide.seen.includes(x.guide.current as string)) return false;
  if (x.drift !== null && (!obj(x.drift) || !PART_IDS.includes(x.drift.part as PartId)
    || !['dx', 'dy', 'angle'].every(key => typeof x.drift === 'object' && Number.isFinite((x.drift as Record<string, unknown>)[key])))) return false;
  if (!obj(x.design) || !Object.entries(x.design).every(([id, d]) => (id === 'primary' || PART_IDS.includes(id as PartId)) && obj(d) && typeof d.color === 'string' && /^#[0-9a-f]{6}$/i.test(d.color)
    && amount(d.radius) && d.radius <= 16 && ['small', 'medium', 'large'].includes(d.textSize as string) && typeof d.shadow === 'boolean')) return false;
  return Array.isArray(x.exports) && x.exports.every(e => obj(e) && ['icon', 'part'].includes(e.kind as string) && typeof e.id === 'string'
    && (e.kind === 'icon' ? KNOWN_ICONS.includes(e.id) : PART_IDS.includes(e.id as PartId))
    && (e.name === null || typeof e.name === 'string') && amount(e.at) && Number.isInteger(e.size) && Array.isArray(e.frames)
    && (e.kind === 'part' ? e.size === 0 && e.frames.length === 0 : [16,32,64,128].includes(e.size as number) && isDrawing({ size: e.size, frames: e.frames,
      rewarded: Array<boolean>((e.size as number) ** 2).fill(false), exported: true, dirty: false, name: null })));
}
