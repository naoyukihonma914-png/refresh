import { ICON_IDS, PRACTICE_IDS } from '../content/kumikiArt';
import { BALANCE } from '../config/balance';
export const APP_IDS = ['tessera', 'note', 'files', 'mail'] as const;
export type AppId = typeof APP_IDS[number];
export const MIN_WINDOW_WIDTH = {tessera:760,note:400,files:640,mail:700} as const;
export const MIN_WINDOW_HEIGHT = 320;
export type BuiltApp = 'files' | 'mail';
export interface Rect { x: number; y: number; width: number; height: number }
export interface WindowState extends Rect { open: boolean; minimized: boolean; maximized: boolean; z: number; restore: Rect | null }
export type FeedbackKind = 'redraw' | 'practice' | 'color' | 'screenshot';
export interface Feedback {
  id: number; kind: FeedbackKind; target: string; baseline: number[]; baselineColor: string;
  at: number; completedAt: number | null;
}
export interface DesktopState {
  entered: boolean; enteredAt: number; apps: BuiltApp[];
  windows: Record<AppId, WindowState>; active: AppId | null;
  icons: Record<AppId, { x: number; y: number }>;
  feedbackMs: number; feedbackSerial: number; feedback: Feedback[]; notice: number | null; success: number | null;
  cooldownMs: number; fileFolder: 'root' | 'exports' | 'screenshots'; fileSelection: string | null; mailSelection: number | null;
}
export interface Screenshot { id: number; at: number; language: string; data: string }
export function createDesktopState(): DesktopState {
  const makeWindow = (x: number, y: number, width: number, height: number): WindowState => ({ x, y, width, height, open: false, minimized: false, maximized: false, z: 0, restore: null });
  return { entered: false, enteredAt: 0, apps: [],
    windows: { tessera: makeWindow(150, 64, 900, 580), note: makeWindow(430, 150, 630, 650), files: makeWindow(1076, 236, 760, 470), mail: makeWindow(920, 110, 880, 610) }, active: null,
    icons: { tessera: { x: 8, y: 8 }, note: { x: 8, y: 96 }, files: { x: 8, y: 184 }, mail: { x: 8, y: 272 } },
    feedbackMs: 0, feedbackSerial: 0, feedback: [], notice: null, success: null, cooldownMs: 0, fileFolder: 'root', fileSelection: null, mailSelection: null };
}
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const count = (x: unknown): x is number => amount(x) && Number.isSafeInteger(x);
const rect = (x: unknown): x is Rect => obj(x) && ['x','y','width','height'].every(k => amount(x[k])) && (x.width as number) > 0 && (x.height as number) > 0 && (x.x as number) + (x.width as number) <= 1920 && (x.y as number) + (x.height as number) <= 1032;
export function isDesktopState(x: unknown): x is DesktopState {
  if (!obj(x) || typeof x.entered !== 'boolean' || !amount(x.enteredAt) || !Array.isArray(x.apps) || !x.apps.every((id, i) => id === BALANCE.w3.apps[i]?.id)) return false;
  if (!obj(x.windows) || !obj(x.icons) || !APP_IDS.every(id => {
    const w = (x.windows as Record<string, unknown>)[id], p = (x.icons as Record<string, unknown>)[id];
    return rect(w) && w.width >= MIN_WINDOW_WIDTH[id] && w.height >= MIN_WINDOW_HEIGHT && obj(w) && ['open','minimized','maximized'].every(k => typeof w[k] === 'boolean') && count(w.z) && (w.maximized ? rect(w.restore) : w.restore === null)
      && obj(p) && amount(p.x) && amount(p.y) && p.x <= 1840 && p.y <= 944;
  })) return false;
  if (x.active !== null && !APP_IDS.includes(x.active as AppId)) return false;
  if (!amount(x.feedbackMs) || !count(x.feedbackSerial) || !amount(x.cooldownMs) || !Array.isArray(x.feedback)) return false;
  const requests = x.feedback;
  if (!requests.every(f => obj(f) && count(f.id) && f.id > 0 && ['redraw','practice','color','screenshot'].includes(f.kind as string)
    && (f.kind === 'redraw' ? ICON_IDS.includes(f.target as 'folder') : f.kind === 'practice' ? PRACTICE_IDS.includes(f.target as 'document') : f.target === (f.kind === 'color' ? 'primary' : '')) && Array.isArray(f.baseline) && f.baseline.length <= 16384 && f.baseline.every(c => Number.isInteger(c) && c >= -1 && c < 256)
    && typeof f.baselineColor === 'string' && /^#[0-9a-f]{6}$/i.test(f.baselineColor) && amount(f.at) && (f.completedAt === null || amount(f.completedAt)))) return false;
  if (new Set(requests.map(f => f.id)).size !== requests.length || requests.some(f => f.id > (x.feedbackSerial as number)) || requests.filter(f => f.completedAt === null).length > BALANCE.w3.maxPending) return false;
  return [x.notice,x.success,x.mailSelection].every(id => id === null || requests.some(f => f.id === id))
    && ['root','exports','screenshots'].includes(x.fileFolder as string) && (x.fileSelection === null || typeof x.fileSelection === 'string');
}
// Flat pixel arrays dominate the save size. RLE is deterministic and needs no external codec.
export function encodeCapture(state: unknown): string {
  return JSON.stringify(state, (_key, value: unknown) => {
    if (!Array.isArray(value) || value.length < 256 || !value.every(v => typeof v === 'number' || typeof v === 'boolean')) return value;
    const runs: (number | boolean)[] = [];
    for (let i = 0; i < value.length;) { let end = i + 1; while (end < value.length && value[end] === value[i]) end++; runs.push(value[i]!, end - i); i = end; }
    return runs.length < value.length / 2 ? { $runs: runs } : value;
  });
}
export function decodeCapture(data: string): unknown {
  return JSON.parse(data, (_key, value: unknown) => {
    if (!obj(value) || !('$runs' in value)) return value;
    if (!Array.isArray(value.$runs) || value.$runs.length % 2 !== 0) throw new Error('Invalid pixel runs');
    const pixels: (number | boolean)[] = [];
    for (let i = 0; i < value.$runs.length; i += 2) {
      const color: unknown = value.$runs[i], size: unknown = value.$runs[i + 1];
      if (!(typeof color === 'boolean' || typeof color === 'number' && Number.isInteger(color) && color >= -1 && color < 256) || !count(size) || size < 1 || size + pixels.length > 16384) throw new Error('Invalid pixel run');
      pixels.push(...Array<number | boolean>(size).fill(color));
    }
    return pixels;
  });
}
export function isScreenshot(x: unknown, validate: (v: unknown) => boolean): x is Screenshot {
  if (!obj(x) || !count(x.id) || x.id === 0 || !amount(x.at) || !(typeof x.language === 'string' && x.language.length > 0) || typeof x.data !== 'string') return false;
  try {
    const scene: unknown = decodeCapture(x.data);
    return obj(scene) && obj(scene.persistent) && Array.isArray(scene.persistent.screenshots) && scene.persistent.screenshots.length === 0
      && obj(scene.run) && scene.run.world === 'desktop' && validate(scene);
  } catch { return false; }
}
