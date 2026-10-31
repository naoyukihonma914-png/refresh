import { readCapture } from './captureScene';
import { ICON_IDS, PRACTICE_IDS } from '../content/kumikiArt';
import { BALANCE, type DesktopUpgrade, type DesktopSkill } from '../config/balance';
export const APP_IDS = ['tessera', 'note', 'files', 'mail', 'manager', 'photo', 'bin', 'clock', 'theme', 'terminal', 'settings'] as const;
export type AppId = typeof APP_IDS[number];
export const MIN_WINDOW_WIDTH = {tessera:760,note:400,files:640,mail:700,manager:700,photo:640,bin:520,clock:360,theme:580,terminal:580,settings:700} as const;
export const MIN_WINDOW_HEIGHT = 320;
export type BuiltApp = Exclude<AppId,'tessera'|'note'|'settings'>;
export const JOB_IDS = ['tessera','files','photo','terminal'] as const;
export type JobId = typeof JOB_IDS[number];
export interface Job { assigned:boolean; cursors:number; updates:number }
export interface PhotoEdit { source:string; brightness:number; tone:number; crop:number }
export interface DesktopPreferences { skills:DesktopSkill[]; disabled:DesktopSkill[]; mode:'light'|'dark'; accent:string; radius:number; iconSize:number; slideshow:boolean; wallpaper:PhotoEdit|null; lastShotId:number }
export const createDesktopPreferences = ():DesktopPreferences => ({skills:[],disabled:[],mode:'light',accent:'#0067c0',radius:8,iconSize:48,slideshow:false,wallpaper:null,lastShotId:0});
export interface Rect { x: number; y: number; width: number; height: number }
export interface WindowState extends Rect { open: boolean; minimized: boolean; maximized: boolean; z: number; restore: Rect | null }
export type FeedbackKind = 'redraw' | 'practice' | 'color' | 'screenshot' | 'sort' | 'search' | 'bright' | 'trash' | 'timer' | 'dark';
export interface Feedback {
  id: number; sender: 'hikari' | 'ren' | 'maki'; kind: FeedbackKind; target: string; baseline: number[]; baselineColor: string;
  at: number; completedAt: number | null; reward?:number;
}
export interface DesktopState {
  entered: boolean; enteredAt: number; apps: BuiltApp[]; upgrades:DesktopUpgrade[];
  builtAt:Record<string,number>; jobs:Record<JobId,Job>; workspace:0|1; workspaces:Record<AppId,0|1>;
  fileSort:'name'|'date'|'type'; fileDescending:boolean; fileSearch:string; largeIcons:boolean; mailFolder:'all'|'pending'|'completed';
  photo:PhotoEdit; compare:boolean; trash:{id:string;at:number;reward:number;first:boolean}[]; recycled:string[]; trashCount:number;
  reservation:{at:number;done:boolean;result?:'captured'|'skipped'|'expired'}|null; terminal:{interval:number;running:boolean;elapsedMs:number;executions:number;log:{at:number;ok:boolean}[]};
  shotHistory:{at:number;pixels:number}[]; stalled:AppId|null; stalledClosed:boolean; stallMs:number; stallSerial:number;
  managerTab:'processes'|'performance';managerProcess:string;calendarMonth:number|null;
  idleMs:number; settingsPage:'skills'|'data'|'specs'|'general';
  windows: Record<AppId, WindowState>; active: AppId | null;
  icons: Record<AppId, { x: number; y: number }>;
  feedbackMs: number; feedbackSerial: number; feedback: Feedback[]; notice: number | null; success: number | null;
  cooldownMs: number; fileFolder: 'root' | 'exports' | 'screenshots'; fileSelection: string | null; mailSelection: number | null;
}
export interface Screenshot { id: number; at: number; language: string; data: string; deleted?:boolean }
export function createDesktopState(): DesktopState {
  const makeWindow = (x: number, y: number, width: number, height: number): WindowState => ({ x, y, width, height, open: false, minimized: false, maximized: false, z: 0, restore: null });
  return { entered: false, enteredAt: 0, apps: [], upgrades:[],
    builtAt:{},jobs:Object.fromEntries(JOB_IDS.map(id=>[id,{assigned:false,cursors:0,updates:0}])) as Record<JobId,Job>, workspace:0,
    workspaces:Object.fromEntries(APP_IDS.map(id=>[id,0])) as Record<AppId,0|1>,
    fileSort:'name',fileDescending:false,fileSearch:'',largeIcons:false,mailFolder:'all',photo:{source:'coast',brightness:1,tone:0,crop:0},compare:false,
    trash:[],recycled:[],trashCount:0,reservation:null,terminal:{interval:BALANCE.w3.terminalIntervals[0],running:false,elapsedMs:0,executions:0,log:[]},shotHistory:[],
    stalled:null,stalledClosed:false,stallMs:BALANCE.w3.stallMinMs,stallSerial:0,idleMs:0,managerTab:'processes',managerProcess:'home',calendarMonth:null,settingsPage:'skills',
    windows: { tessera: makeWindow(150, 64, 900, 580), note: makeWindow(430, 150, 630, 650), files: makeWindow(1076, 236, 760, 470), mail: makeWindow(920, 110, 880, 610),manager:makeWindow(600,180,850,580),photo:makeWindow(760,130,840,600),bin:makeWindow(300,200,650,440),clock:makeWindow(1350,420,480,580),theme:makeWindow(800,120,720,610),terminal:makeWindow(500,260,800,480),settings:makeWindow(700,140,880,680) }, active: null,
    icons: { tessera: { x: 8, y: 8 }, note: { x: 8, y: 96 }, files: { x: 8, y: 184 }, mail: { x: 8, y: 272 },manager:{x:8,y:360},photo:{x:8,y:448},bin:{x:8,y:536},clock:{x:8,y:624},theme:{x:8,y:712},terminal:{x:8,y:800},settings:{x:8,y:888} },
    feedbackMs: 0, feedbackSerial: 0, feedback: [], notice: null, success: null, cooldownMs: 0, fileFolder: 'root', fileSelection: null, mailSelection: null };
}
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const count = (x: unknown): x is number => amount(x) && Number.isSafeInteger(x);
const rect = (x: unknown): x is Rect => obj(x) && ['x','y','width','height'].every(k => amount(x[k])) && (x.width as number) > 0 && (x.height as number) > 0 && (x.x as number) + (x.width as number) <= 1920 && (x.y as number) + (x.height as number) <= 1032;
export function isDesktopState(x: unknown): x is DesktopState {
  if (!obj(x) || typeof x.entered !== 'boolean' || !amount(x.enteredAt) || !Array.isArray(x.apps) || new Set(x.apps).size!==x.apps.length || !x.apps.every(id=>APP_IDS.includes(id as AppId)&&!['tessera','note','settings'].includes(id as string))) return false;
  if (!obj(x.windows) || !obj(x.icons) || !APP_IDS.every(id => {
    const w = (x.windows as Record<string, unknown>)[id], p = (x.icons as Record<string, unknown>)[id];
    return rect(w) && w.width >= MIN_WINDOW_WIDTH[id] && w.height >= MIN_WINDOW_HEIGHT && obj(w) && ['open','minimized','maximized'].every(k => typeof w[k] === 'boolean') && count(w.z) && (w.maximized ? rect(w.restore) : w.restore === null)
      && obj(p) && amount(p.x) && amount(p.y) && p.x <= 1840 && p.y <= 944;
  })) return false;
  if (x.active !== null && !APP_IDS.includes(x.active as AppId)) return false;
  if (!amount(x.feedbackMs) || !count(x.feedbackSerial) || !amount(x.cooldownMs) || !Array.isArray(x.feedback)) return false;
  const requests = x.feedback;
  if (!requests.every(f => obj(f) && count(f.id) && f.id > 0 && ['redraw','practice','color','screenshot','sort','search','bright','trash','timer','dark'].includes(f.kind as string)
    && (f.kind === 'redraw' ? ICON_IDS.includes(f.target as 'folder') : f.kind === 'practice' ? PRACTICE_IDS.includes(f.target as 'document') : typeof f.target==='string' && (f.kind==='search'?f.target.length<=120:f.kind==='timer'?/^\d{1,16}$/.test(f.target):f.target===(f.kind==='color'?'primary':''))) && Array.isArray(f.baseline) && (f.kind==='trash'?f.baseline.length<=3&&f.baseline.every(c=>count(c)&&c>0):f.baseline.length <= 16384 && f.baseline.every(c => Number.isInteger(c) && c >= -1 && c < 256))
    && ['hikari','ren','maki'].includes(f.sender as string) && typeof f.baselineColor === 'string' && /^#[0-9a-f]{6}$/i.test(f.baselineColor) && (f.reward===undefined||amount(f.reward)) && amount(f.at) && (f.completedAt === null || amount(f.completedAt)))) return false;
  if (new Set(requests.map(f => f.id)).size !== requests.length || requests.some(f => f.id > (x.feedbackSerial as number)) || requests.filter(f => f.completedAt === null).length > 5) return false;
  return isDesktopExtras(x) && [x.notice,x.success,x.mailSelection].every(id => id === null || requests.some(f => f.id === id))
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
export function isScreenshot(x: unknown): x is Screenshot {
  if (!obj(x) || !count(x.id) || x.id === 0 || !amount(x.at) || !(typeof x.language === 'string' && x.language.length > 0) || typeof x.data !== 'string' || x.deleted!==undefined&&typeof x.deleted!=='boolean') return false;
  try { readCapture(x as unknown as Screenshot); return true; } catch { return false; }
}

const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(v=>typeof v==='string');
export const isPhotoEdit=(x:unknown):x is PhotoEdit=>obj(x)&&typeof x.source==='string'&&(/^(coast|night|sketch|shot:[1-9][0-9]*)$/).test(x.source)&&typeof x.brightness==='number'&&x.brightness>=0.5&&x.brightness<=1.5&&typeof x.tone==='number'&&x.tone>=-50&&x.tone<=50&&typeof x.crop==='number'&&x.crop>=0&&x.crop<=40;
export function isDesktopPreferences(x:unknown):x is DesktopPreferences {
 return obj(x)&&strings(x.skills)&&new Set(x.skills).size===x.skills.length&&x.skills.every(id=>BALANCE.w3.skills.some(s=>s.id===id))&&strings(x.disabled)&&x.disabled.every(id=>(x.skills as string[]).includes(id)&&BALANCE.w3.skills.some(s=>s.id===id&&s.playful))&&['light','dark'].includes(x.mode as string)&&typeof x.accent==='string'&&/^#[0-9a-f]{6}$/i.test(x.accent)&&typeof x.radius==='number'&&x.radius>=0&&x.radius<=8&&[32,48,64].includes(x.iconSize as number)&&typeof x.slideshow==='boolean'&&(x.wallpaper===null||isPhotoEdit(x.wallpaper))&&count(x.lastShotId);
}
function isDesktopExtras(x:Record<string,unknown>):boolean {
 if(!obj(x.builtAt)||!Object.entries(x.builtAt).every(([id,time])=>(id==='desktop'||BALANCE.w3.apps.some(a=>a.id===id))&&amount(time)))return false;
 if(!strings(x.upgrades)||new Set(x.upgrades).size!==x.upgrades.length||!x.upgrades.every(id=>BALANCE.w3.apps.some(a=>a.id===id))||!obj(x.jobs)||!JOB_IDS.every(id=>{const j=(x.jobs as Record<string,unknown>)[id];return obj(j)&&typeof j.assigned==='boolean'&&count(j.cursors)&&count(j.updates)&&j.cursors<=10000&&j.updates<=100;}))return false;
 if(!(x.apps as string[]).every(id=>(x.upgrades as string[]).includes(id)))return false;
 if(![0,1].includes(x.workspace as number)||!obj(x.workspaces)||!APP_IDS.every(id=>[0,1].includes((x.workspaces as Record<string,unknown>)[id] as number)))return false;
 if(!['name','date','type'].includes(x.fileSort as string)||typeof x.fileDescending!=='boolean'||typeof x.fileSearch!=='string'||x.fileSearch.length>120||typeof x.largeIcons!=='boolean'||!['all','pending','completed'].includes(x.mailFolder as string)||!isPhotoEdit(x.photo)||typeof x.compare!=='boolean')return false;
 if(!Array.isArray(x.trash)||!x.trash.every(t=>obj(t)&&typeof t.id==='string'&&amount(t.at)&&amount(t.reward)&&typeof t.first==='boolean')||!strings(x.recycled)||!count(x.trashCount))return false;
 if(x.reservation!==null&&(!obj(x.reservation)||!amount(x.reservation.at)||typeof x.reservation.done!=='boolean'||x.reservation.result!==undefined&&!['captured','skipped','expired'].includes(x.reservation.result as string)))return false;
 const t=x.terminal;
 if(!obj(t)||!(BALANCE.w3.terminalIntervals as readonly unknown[]).includes(t.interval)||typeof t.running!=='boolean'||!amount(t.elapsedMs)||!count(t.executions)||!Array.isArray(t.log)||t.log.length>BALANCE.w3.maxNoteLog||!t.log.every(v=>obj(v)&&amount(v.at)&&typeof v.ok==='boolean'))return false;
 return ['processes','performance'].includes(x.managerTab as string)&&['home','shots','feedback',...JOB_IDS].includes(x.managerProcess as string)&&(x.calendarMonth===null||amount(x.calendarMonth))&&Array.isArray(x.shotHistory)&&x.shotHistory.length<=BALANCE.w3.maxShotHistory&&x.shotHistory.every(v=>obj(v)&&amount(v.at)&&amount(v.pixels))&&(x.stalled===null||APP_IDS.includes(x.stalled as AppId))&&typeof x.stalledClosed==='boolean'&&amount(x.stallMs)&&count(x.stallSerial)&&amount(x.idleMs)&&['skills','data','specs','general'].includes(x.settingsPage as string);
}
