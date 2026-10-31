import { encodeScene, projectCapture, restoreScene } from './captureScene';
import { BALANCE } from '../config/balance';
import { ICON_IDS, PRACTICE_IDS, homeButtonColor } from '../content/kumikiArt';
import { availableIcons, drawingFor } from './kumiki';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, APP_IDS, createDesktopState, type AppId, type BuiltApp, type DesktopState, type Feedback, type Rect, type Screenshot } from './desktopState';
import type { GameState } from './state';
export const withDesktop = (state: GameState, desktop: DesktopState): GameState => ({ ...state, run: { ...state.run, desktop } });
export const installedApps = (state: GameState): AppId[] => ['tessera', 'note', ...state.run.desktop.apps];
export const runningApps = (state: GameState): AppId[] => installedApps(state).filter(id => state.run.desktop.windows[id].open);
export const visibleApps = (state: GameState): AppId[] => runningApps(state).filter(id => !state.run.desktop.windows[id].minimized);
export function enterDesktop(state: GameState): GameState {
  if (state.run.world !== 'kumiki' || state.run.desktop.entered || state.persistent.specs.color < 1 || !state.run.kumiki.built.includes('taskbar') || state.resources.pixels < BALANCE.w2.desktopCost) return state;
  const d = createDesktopState(); d.entered = true; d.enteredAt = state.elapsedMs; d.active = 'tessera'; d.windows.tessera.open = true; d.windows.tessera.z = 1;
  return { ...state, resources: { ...state.resources, pixels: state.resources.pixels - BALANCE.w2.desktopCost }, run: { ...state.run, world: 'desktop', desktop: d } };
}
export function focusWindow(state: GameState, app: AppId): GameState {
  if (!installedApps(state).includes(app)) return state;
  const d = state.run.desktop;
  const windows = { ...d.windows };
  const order = APP_IDS.filter(id => id !== app).sort((a,b) => windows[a].z - windows[b].z);
  order.forEach((id,i) => { windows[id] = { ...windows[id], z: i }; });
  windows[app] = { ...windows[app], open: true, minimized: false, z: APP_IDS.length };
  return withDesktop(state, { ...d, windows, active: app });
}
function nextActive(state: GameState, app: AppId): AppId | null {
  return visibleApps(state).filter(id => id !== app).sort((a,b) => state.run.desktop.windows[b].z - state.run.desktop.windows[a].z)[0] ?? null;
}
export function fitWindow(app: AppId, rect: Rect): Rect {
  const minWidth = MIN_WINDOW_WIDTH[app];
  const width = Math.max(minWidth, Math.min(1920, rect.width)), height = Math.max(MIN_WINDOW_HEIGHT, Math.min(1032, rect.height));
  return { x: Math.max(0, Math.min(1920 - width, rect.x)), y: Math.max(0, Math.min(1032 - height, rect.y)), width, height };
}
export const nextDesktopApp = (state: GameState) => BALANCE.w3.apps[state.run.desktop.apps.length] ?? null;
export function buyDesktopApp(state: GameState, id: BuiltApp): GameState {
  const item = nextDesktopApp(state);
  if (state.run.world !== 'desktop' || item?.id !== id || state.resources.pixels < item.cost) return state;
  return focusWindow(withDesktop({ ...state, resources: { ...state.resources, pixels: state.resources.pixels - item.cost } }, { ...state.run.desktop, apps: [...state.run.desktop.apps, id] }), id);
}
export function desktopConditions(state: GameState): boolean[] {
  return [1 + state.run.desktop.apps.length >= BALANCE.w3.requiredApps,
    state.run.desktop.feedback.filter(f => f.completedAt !== null).length >= BALANCE.w3.requiredFeedback,
    ICON_IDS.every(id => state.run.kumiki.exports.some(e => e.kind === 'icon' && e.id === id)), false, false];
}
function newFeedback(state: GameState, at: number): Feedback | null {
  const d = state.run.desktop;
  const pending = d.feedback.filter(f => f.completedAt === null);
  if (pending.length >= BALANCE.w3.maxPending) return null;
  const primaryColor = state.run.kumiki.design.primary?.color ?? homeButtonColor(state.persistent.specs.color);
  const candidates: { kind: Feedback['kind']; target: string }[] = [];
  const redraw = [...ICON_IDS].sort((a,b) => {
    const last=(id:string)=>d.feedback.filter(f=>f.kind==='redraw'&&f.target===id).at(-1)?.id??0;
    return last(a)-last(b);
  }).find(id => state.run.kumiki.exports.some(e => e.kind === 'icon' && e.id === id) && !pending.some(f => f.kind === 'redraw' && f.target === id));
  const practice = PRACTICE_IDS.find(id => availableIcons(state).includes(id) && !drawingFor(state,id)?.exported && !pending.some(f => f.kind === 'practice' && f.target === id));
  if (redraw) candidates.push({ kind: 'redraw', target: redraw });
  if (practice) candidates.push({ kind: 'practice', target: practice });
  if (!pending.some(f => f.kind === 'color')) candidates.push({ kind: 'color', target: 'primary' });
  if (!pending.some(f => f.kind === 'screenshot')) candidates.push({ kind: 'screenshot', target: '' });
  // Rotate eligible types; missing stage-six features never create impossible requests.
  const order: Feedback['kind'][] = ['redraw','practice','color','screenshot'];
  const offset = d.feedback.length ? (order.indexOf(d.feedback.at(-1)!.kind) + 1) % order.length : 0;
  const candidate = Array.from({ length: order.length }, (_,i) => candidates.find(c => c.kind === order[(offset+i)%order.length])).find(Boolean);
  if (!candidate) return null;
  return { id: d.feedbackSerial + 1, sender: (['hikari','ren','maki'] as const)[d.feedbackSerial % 3]!, ...candidate, at, completedAt: null,
    baseline: [...(drawingFor(state,candidate.target)?.frames[0] ?? [])], baselineColor: primaryColor };
}
export function advanceDesktopTime(state: GameState, ms: number, now: number, offline = false): GameState {
  if (state.run.world !== 'desktop') return state;
  const interval = BALANCE.spec.network[state.persistent.specs.network]!.mailIntervalSeconds * BALANCE.time.millisecondsPerSecond;
  let next = withDesktop(state, { ...state.run.desktop, cooldownMs: offline ? state.run.desktop.cooldownMs : Math.max(0, state.run.desktop.cooldownMs-ms), feedbackMs: (state.run.desktop.feedbackMs + ms) % interval });
  const arrivals = Math.floor((state.run.desktop.feedbackMs + ms) / interval);
  for (let i=0; i<Math.min(arrivals,BALANCE.w3.maxPending); i++) {
    const request = newFeedback(next, Math.max(0, now - ms + interval - state.run.desktop.feedbackMs + i * interval));
    if (!request) break;
    next = withDesktop(next, { ...next.run.desktop, feedbackSerial: request.id, feedback: [...next.run.desktop.feedback, request], notice: request.id, success: null });
  }
  return next;
}
function completeFeedback(state: GameState, ids: number[], now: number): GameState {
  const pending = state.run.desktop.feedback.filter(f => ids.includes(f.id) && f.completedAt === null);
  if (!pending.length) return state;
  return withDesktop({ ...state, resources: { ...state.resources, tokens: state.resources.tokens + pending.length * BALANCE.w3.feedbackTokens } }, { ...state.run.desktop,
    feedback: state.run.desktop.feedback.map(f => pending.includes(f) ? { ...f, completedAt: now } : f),
    notice: pending.some(f => f.id === state.run.desktop.notice) ? null : state.run.desktop.notice, success: pending[pending.length-1]!.id });
}
export function observeTesseraAction(before: GameState, after: GameState, type: string, now: number): GameState {
  if (after.run.world !== 'desktop' || before === after) return after;
  const done = after.run.desktop.feedback.filter(f => {
    if (f.completedAt !== null) return false;
    if (type === 'design' && f.kind === 'color') return (after.run.kumiki.design.primary?.color ?? homeButtonColor(after.persistent.specs.color)) !== f.baselineColor;
    if (type !== 'export' || !['redraw','practice'].includes(f.kind)) return false;
    const old = drawingFor(before, f.target), work = after.run.kumiki.exports.find(e => e.kind === 'icon' && e.id === f.target);
    if (!old?.dirty || !work) return false;
    if (f.kind === 'practice') return !old.exported && !!drawingFor(after,f.target)?.exported;
    return work.frames[0]!.filter((c,i) => c !== f.baseline[i]).length >= BALANCE.w3.redrawCells;
  }).map(f => f.id);
  return completeFeedback(after,done,now);
}
export function screenshotParts(state: GameState): number {
  return BALANCE.w3.screenshotBaseParts + visibleApps(state).length * BALANCE.w3.partsPerWindow + installedApps(state).length + (state.run.desktop.notice !== null || state.run.desktop.success !== null ? 1 : 0);
}
export const screenshotCapacity = (state: GameState) => BALANCE.w3.baseShotCapacity * BALANCE.w3.storageCapacityMultiplier ** state.persistent.specs.storage;
export const desktopAppShotGain = (state: GameState) => passivePixelsPerSecond(state) * (BALANCE.w3.partsPerWindow + 1) * BALANCE.w3.screenshotMultiplier * BALANCE.w3.shotResolutionMultiplier ** state.persistent.specs.resolution;
export const screenshotReward = (state: GameState) => passivePixelsPerSecond(state) * screenshotParts(state) * BALANCE.w3.screenshotMultiplier * BALANCE.w3.shotResolutionMultiplier ** state.persistent.specs.resolution;
export function takeScreenshot(state: GameState, now: number, language: string): GameState {
  if (state.run.world !== 'desktop' || state.run.desktop.cooldownMs > 0 || state.persistent.screenshots.length >= screenshotCapacity(state)) return state;
  const frozen = projectCapture(state,language);
  const shot: Screenshot = { id: (state.persistent.screenshots.at(-1)?.id ?? 0)+1, at: now, language, data: encodeScene(frozen) };
  let next = creditPixels(state,screenshotReward(state));
  next = { ...next, persistent: { ...next.persistent, screenshots: [...next.persistent.screenshots,shot] } };
  next = withDesktop(next, { ...next.run.desktop, cooldownMs: BALANCE.spec.graphics[state.persistent.specs.graphics]!.shotCooldownSeconds * BALANCE.time.millisecondsPerSecond });
  return visibleApps(state).length >= 2 ? completeFeedback(next,next.run.desktop.feedback.filter(f => f.kind === 'screenshot').map(f => f.id),now) : next;
}
export function restoreScreenshot(shot: Screenshot, catalog: Screenshot[]): GameState {
  return restoreScene(shot,catalog);
}
export type DesktopAction =
  | { type: 'open' | 'taskbar' | 'minimize' | 'maximize' | 'close'; app: AppId }
  | { type: 'rect'; app: AppId; rect: Rect }
  | { type: 'icon'; app: AppId; x: number; y: number }
  | { type: 'buy'; app: BuiltApp }
  | { type: 'folder'; folder: DesktopState['fileFolder'] }
  | { type: 'file'; id: string | null }
  | { type: 'mail'; id: number }
  | { type: 'notice'; id: number | null }
  | { type: 'success-close' }
  | { type: 'fix'; id: number }
  | { type: 'note'; text: string };
export function actDesktop(state: GameState, action: DesktopAction, now: number): GameState {
  if (state.run.world !== 'desktop') return state;
  const d = state.run.desktop;
  switch(action.type) {
    case 'open': return focusWindow(state,action.app);
    case 'taskbar': return d.active === action.app && d.windows[action.app].open && !d.windows[action.app].minimized ? actDesktop(state,{ type:'minimize',app:action.app },now) : focusWindow(state,action.app);
    case 'buy': return buyDesktopApp(state,action.app);
    case 'minimize': case 'close': {
      if (!installedApps(state).includes(action.app)) return state;
      return withDesktop(state,{ ...d, windows: { ...d.windows,[action.app]: { ...d.windows[action.app], ...(action.type === 'close' ? {open:false} : {minimized:true}) } }, active: d.active === action.app ? nextActive(state,action.app) : d.active });
    }
    case 'maximize': {
      if (!installedApps(state).includes(action.app)) return state;
      const w = d.windows[action.app];
      return focusWindow(withDesktop(state,{ ...d, windows: { ...d.windows,[action.app]: { ...w, ...(w.maximized ? w.restore! : { x:0,y:0,width:1920,height:1032 }), maximized: !w.maximized, restore: w.maximized ? null : { x:w.x,y:w.y,width:w.width,height:w.height } } } }),action.app);
    }
    case 'rect': {
      if (!installedApps(state).includes(action.app) || d.windows[action.app].maximized || !(['x','y','width','height'] as const).every(key => Number.isFinite(action.rect[key]))) return state;
      return withDesktop(state,{ ...d,windows:{ ...d.windows,[action.app]:{ ...d.windows[action.app], ...fitWindow(action.app,action.rect) } } });
    }
    case 'icon': return !installedApps(state).includes(action.app) || !Number.isFinite(action.x) || !Number.isFinite(action.y) ? state : withDesktop(state,{ ...d,icons:{ ...d.icons,[action.app]: { x:Math.max(0,Math.min(1840,action.x)),y:Math.max(0,Math.min(944,action.y)) } } });
    case 'folder': return !['root','exports','screenshots'].includes(action.folder) ? state : withDesktop(state,{ ...d,fileFolder:action.folder,fileSelection:null });
    case 'file': return withDesktop(state,{ ...d,fileSelection:action.id });
    case 'mail': return !d.feedback.some(f => f.id === action.id) ? state : withDesktop(state,{ ...d,mailSelection:action.id });
    case 'notice': return action.id !== null && !d.feedback.some(f => f.id === action.id && f.completedAt === null) ? state : withDesktop(state,{ ...d,notice:action.id });
    case 'success-close': return withDesktop(state,{ ...d,success:null });
    case 'fix': {
      const request=d.feedback.find(f=>f.id===action.id);if(!request)return state;
      if(request.kind!=='screenshot')return focusWindow(withDesktop(state,{...d,notice:null}),'tessera');
      // Keep two real windows visible and give the capture toolbar a clear destination.
      let next=focusWindow(withDesktop(state,{...d,notice:null}),'tessera');
      if(next.run.desktop.windows.tessera.maximized)next=actDesktop(next,{type:'maximize',app:'tessera'},now);
      next=actDesktop(next,{type:'rect',app:'tessera',rect:{x:150,y:64,width:900,height:580}},now);
      next=focusWindow(next,'note');
      if(next.run.desktop.windows.note.maximized)next=actDesktop(next,{type:'maximize',app:'note'},now);
      return focusWindow(actDesktop(next,{type:'rect',app:'note',rect:{x:1100,y:140,width:630,height:650}},now),'note');
    }
    case 'note': return action.text.length > BALANCE.w3.maxNote ? state : { ...state,persistent:{ ...state.persistent,productionNote:action.text,noteUpdatedAt:now } };
  }
}
