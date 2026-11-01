import { actDesktopExtra, completeRequests, type ExtraAction } from './desktopExtras';
import { FEATURE_APPS, featureCount, hasDesktopSkill, hasUpgrade } from './desktopJobs';
import type { DesktopUpgrade } from '../config/balance';
import { encodeScene, projectCapture, restoreScene } from './captureScene';
import { BALANCE } from '../config/balance';
import { ICON_IDS, PRACTICE_IDS, homeButtonColor } from '../content/kumikiArt';
import { availableIcons, drawingFor, prepareDrawing } from './kumiki';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, APP_IDS, createDesktopState, type AppId, type BuiltApp, type DesktopState, type Feedback, type Rect, type Screenshot } from './desktopState';
import type { GameState } from './state';
export const withDesktop = (state: GameState, desktop: DesktopState): GameState => ({ ...state, run: { ...state.run, desktop } });
export const installedApps = (state: GameState): AppId[] => ['tessera', 'note', ...state.run.desktop.apps, 'settings'];
export const runningApps = (state: GameState): AppId[] => installedApps(state).filter(id => state.run.desktop.windows[id].open);
export const visibleApps = (state: GameState): AppId[] => runningApps(state).filter(id => !state.run.desktop.windows[id].minimized && (!hasDesktopSkill(state,'virtual')||state.run.desktop.workspaces[id]===state.run.desktop.workspace));
export function enterDesktop(state: GameState): GameState {
  if (state.run.world !== 'kumiki' || state.run.desktop.entered || state.persistent.specs.color < 1 || !state.run.kumiki.built.includes('taskbar') || state.resources.pixels < BALANCE.w2.desktopCost) return state;
  const d = createDesktopState(); d.entered = true; d.enteredAt = state.elapsedMs;d.builtAt.desktop=state.lastTickAt; d.active = 'tessera'; d.windows.tessera.open = true; d.windows.tessera.z = 1;
  return { ...state, resources: { ...state.resources, pixels: state.resources.pixels - BALANCE.w2.desktopCost }, run: { ...state.run, world: 'desktop', desktop: d } };
}
export function focusWindow(state: GameState, app: AppId): GameState {
  if (!installedApps(state).includes(app)) return state;
  let d = state.run.desktop;
  if(d.stalled===app&&d.stalledClosed){state=actDesktopExtra(state,{type:'restart',app},state.lastTickAt);d=state.run.desktop;}
  const windows = { ...d.windows };
  const order = APP_IDS.filter(id => id !== app).sort((a,b) => windows[a].z - windows[b].z);
  order.forEach((id,i) => { windows[id] = { ...windows[id], z: i }; });
  windows[app] = { ...windows[app], open: true, minimized: false, z: APP_IDS.length };
  return withDesktop(state, { ...d, windows, active: app, ...(hasDesktopSkill(state,'virtual')?{workspace:d.workspaces[app]}:{}) });
}
function nextActive(state: GameState, app: AppId): AppId | null {
  return visibleApps(state).filter(id => id !== app).sort((a,b) => state.run.desktop.windows[b].z - state.run.desktop.windows[a].z)[0] ?? null;
}
export function fitWindow(app: AppId, rect: Rect): Rect {
  const minWidth = MIN_WINDOW_WIDTH[app];
  const width = Math.max(minWidth, Math.min(1920, rect.width)), height = Math.max(MIN_WINDOW_HEIGHT, Math.min(1032, rect.height));
  return { x: Math.max(0, Math.min(1920 - width, rect.x)), y: Math.max(0, Math.min(1032 - height, rect.y)), width, height };
}
export const nextDesktopApp = (state:GameState) => BALANCE.w3.apps.find(item=>!state.run.desktop.upgrades.includes(item.id))??null;
export const followingDesktopApp = (state:GameState) => BALANCE.w3.apps.filter(item=>!state.run.desktop.upgrades.includes(item.id))[1]??null;
export function buyDesktopApp(state:GameState,id:DesktopUpgrade,now=state.lastTickAt):GameState {
 const item=nextDesktopApp(state);if(state.run.world!=='desktop'||item?.id!==id||state.resources.pixels<item.cost)return state;
 const feature=FEATURE_APPS[id as keyof typeof FEATURE_APPS];
 const isApp=APP_IDS.includes(id as AppId)&&!feature;
 let next=withDesktop({...state,resources:{...state.resources,pixels:state.resources.pixels-item.cost}},{...state.run.desktop,upgrades:[...state.run.desktop.upgrades,id],builtAt:{...state.run.desktop.builtAt,[id]:now},apps:isApp?[...state.run.desktop.apps,id as BuiltApp]:state.run.desktop.apps});
 if(isApp)return focusWindow(next,id as AppId);
 if(feature)return focusWindow(next,feature);
 return next;
}
export function desktopConditions(state:GameState):boolean[] {
 return [runningApps(state).filter(id=>!['note','settings'].includes(id)).length>=BALANCE.w3.requiredApps,
 state.run.desktop.feedback.filter(f=>f.completedAt!==null).length>=BALANCE.w3.requiredFeedback,
 ICON_IDS.every(id=>state.run.kumiki.exports.some(e=>e.kind==='icon'&&e.id===id)),state.persistent.desktopPrefs.wallpaper!==null,
 state.run.desktop.terminal.executions>0];
}
export const pendingCapacity=(state:GameState)=>hasDesktopSkill(state,'sortMail')?BALANCE.w3.sortedMailCapacity:BALANCE.w3.maxPending;
function newFeedback(state: GameState, at: number): Feedback | null {
  const d = state.run.desktop;
  const pending = d.feedback.filter(f => f.completedAt === null);
  if (pending.length >= pendingCapacity(state)) return null;
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
  const eligible:{kind:Feedback['kind'];target:string}[]=[
    ...(hasUpgrade(state,'sort')?[{kind:'sort' as const,target:''}]:[]),
    ...(hasUpgrade(state,'search')?[{kind:'search' as const,target:'home'}]:[]),
    ...(d.apps.includes('photo')?[{kind:'bright' as const,target:''}]:[]),
    ...(d.apps.includes('bin')&&state.persistent.screenshots.filter(s=>!s.deleted&&!d.trash.some(t=>t.id===`shot:${s.id}`)).length>=3?[{kind:'trash' as const,target:''}]:[]),
    ...(hasUpgrade(state,'timer')?[{kind:'timer' as const,target:String(Math.ceil((at+BALANCE.w3.timerRequestDelayMs)/60000)*60000)}]:[]),
    ...(d.apps.includes('theme')?[{kind:'dark' as const,target:''}]:[]),
  ];
  candidates.push(...eligible.filter(c=>!pending.some(f=>f.kind===c.kind)));
  const order: Feedback['kind'][] = ['redraw','practice','color','screenshot','sort','search','bright','trash','timer','dark'];
  const offset = d.feedback.length ? (order.indexOf(d.feedback.at(-1)!.kind) + 1) % order.length : 0;
  const candidate = Array.from({ length: order.length }, (_,i) => candidates.find(c => c.kind === order[(offset+i)%order.length])).find(Boolean);
  if (!candidate) return null;
  return { id: d.feedbackSerial + 1, sender: (['hikari','ren','maki'] as const)[d.feedbackSerial % 3]!, ...candidate, at, completedAt: null,
    baseline: candidate.kind==='trash'?[]:[...(drawingFor(state,candidate.target)?.frames[0] ?? [])], baselineColor: primaryColor };
}
export function advanceDesktopTime(state: GameState, ms: number, now: number, offline = false, language='ja', captures=true): GameState {
  if (state.run.world !== 'desktop') return state;
  const interval = BALANCE.spec.network[state.persistent.specs.network]!.mailIntervalSeconds * BALANCE.time.millisecondsPerSecond;
  let next = withDesktop(state, { ...state.run.desktop, cooldownMs: offline ? state.run.desktop.cooldownMs : Math.max(0, state.run.desktop.cooldownMs-ms), feedbackMs: (state.run.desktop.feedbackMs + ms) % interval });
  const arrivals = Math.floor((state.run.desktop.feedbackMs + ms) / interval);
  for (let i=0; i<Math.min(arrivals,pendingCapacity(state)); i++) {
    const request = newFeedback(next, Math.max(0, now - ms + interval - state.run.desktop.feedbackMs + i * interval));
    if (!request) break;
    next = withDesktop(next, { ...next.run.desktop, feedbackSerial: request.id, feedback: [...next.run.desktop.feedback, request], notice: request.id, success: null });
  }
  return advanceDesktopEvents(next,ms,now,offline,language,captures);
}
function completeFeedback(state: GameState, ids: number[], now: number): GameState {
  const pending = state.run.desktop.feedback.filter(f => ids.includes(f.id) && f.completedAt === null);
  if (!pending.length) return state;
  return withDesktop({ ...state, resources: { ...state.resources, tokens: state.resources.tokens + pending.length * BALANCE.w3.feedbackTokens } }, { ...state.run.desktop,
    feedback: state.run.desktop.feedback.map(f => pending.includes(f) ? { ...f, completedAt: now, reward:BALANCE.w3.feedbackTokens } : f),
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
  return BALANCE.w3.screenshotBaseParts + visibleApps(state).reduce((sum,id)=>sum+BALANCE.w3.partsPerWindow+featureCount(state,id)*BALANCE.w3.featureParts,0) + installedApps(state).filter(id=>id!=='settings').length + (state.run.desktop.notice !== null || state.run.desktop.success !== null ? 1 : 0);
}
export const screenshotCapacity = (state: GameState) => BALANCE.w3.baseShotCapacity * BALANCE.w3.storageCapacityMultiplier ** state.persistent.specs.storage;
export const desktopAppShotGain = (state: GameState) => passivePixelsPerSecond(state) * (BALANCE.w3.partsPerWindow + 1) * BALANCE.w3.screenshotMultiplier * BALANCE.w3.shotResolutionMultiplier ** state.persistent.specs.resolution;
export const screenshotReward = (state: GameState) => passivePixelsPerSecond(state) * screenshotParts(state) * BALANCE.w3.screenshotMultiplier * BALANCE.w3.shotResolutionMultiplier ** state.persistent.specs.resolution;
export function takeScreenshot(state: GameState, now: number, language: string, multiplier=1, automatic=false): GameState {
  if (state.run.world !== 'desktop' || state.run.desktop.cooldownMs > 0 || activeScreenshots(state).length >= screenshotCapacity(state)) return state;
  const frozen = projectCapture({...state,lastTickAt:now},language);
  const shot: Screenshot = { id: Math.max(state.persistent.desktopPrefs.lastShotId,state.persistent.screenshots.at(-1)?.id??0)+1, at: now, language, data: encodeScene(frozen) };
  let next = creditPixels(state,screenshotReward(state)*multiplier);
  next = { ...next, persistent: { ...next.persistent, screenshots: [...next.persistent.screenshots,shot], desktopPrefs:{...next.persistent.desktopPrefs,lastShotId:shot.id} } };
  next = withDesktop(next, { ...next.run.desktop, cooldownMs: screenshotCooldown(state), shotHistory:[...next.run.desktop.shotHistory.filter(h=>h.at>=now-BALANCE.w3.historyMs),{at:now,pixels:screenshotReward(state)*multiplier}].slice(-BALANCE.w3.maxShotHistory) });
  return visibleApps(state).length>=2?completeRequests(next,['screenshot'],now,automatic):next;
}
export function restoreScreenshot(shot: Screenshot, catalog: Screenshot[]): GameState {
  return restoreScene(shot,catalog);
}
export type DesktopAction = ExtraAction
  | { type: 'open' | 'taskbar' | 'minimize' | 'maximize' | 'close'; app: AppId }
  | { type: 'rect'; app: AppId; rect: Rect }
  | { type: 'icon'; app: AppId; x: number; y: number }
  | { type: 'buy'; app: DesktopUpgrade }
  | { type: 'folder'; folder: DesktopState['fileFolder'] }
  | { type: 'file'; id: string | null }
  | { type: 'mail'; id: number }
  | { type: 'notice'; id: number | null }
  | { type: 'success-close' }
  | { type: 'fix'; id: number }
  | { type: 'note'; text: string };
export function actDesktop(state: GameState, action: DesktopAction, now: number, language='ja'): GameState {
  if (state.run.world !== 'desktop') return state;
  state=actDesktopExtra(state,{type:'activity'},now);
  const d = state.run.desktop;
  switch(action.type) {
    case 'open': return focusWindow(state,action.app);
    case 'taskbar': return d.active === action.app && d.windows[action.app].open && !d.windows[action.app].minimized ? actDesktop(state,{ type:'minimize',app:action.app },now) : focusWindow(state,action.app);
    case 'buy': return buyDesktopApp(state,action.app,now);
    case 'minimize': case 'close': {
      if (!installedApps(state).includes(action.app)) return state;
      return withDesktop(state,{ ...d, ...(action.type==='close'&&d.stalled===action.app?{stalledClosed:true}:{}), windows: { ...d.windows,[action.app]: { ...d.windows[action.app], ...(action.type === 'close' ? {open:false} : {minimized:true}) } }, active: d.active === action.app ? nextActive(state,action.app) : d.active });
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
      if(request.kind!=='screenshot'){
        const destinations:Partial<Record<Feedback['kind'],AppId>>={sort:'files',search:'files',bright:'photo',trash:'bin',timer:'clock',dark:'theme'};
        const app=destinations[request.kind]??'tessera';
        let next=focusWindow(withDesktop(state,{...d,notice:null}),app);
        if(hasDesktopSkill(state,'direct')&&['redraw','practice'].includes(request.kind)){next=prepareDrawing(next,request.target);next={...next,run:{...next.run,kumiki:{...next.run.kumiki,activeDrawing:request.target}}};}
        return next;
      }
      // Keep two real windows visible and give the capture toolbar a clear destination.
      let next=focusWindow(withDesktop(state,{...d,notice:null}),'tessera');
      if(next.run.desktop.windows.tessera.maximized)next=actDesktop(next,{type:'maximize',app:'tessera'},now);
      next=actDesktop(next,{type:'rect',app:'tessera',rect:{x:150,y:64,width:900,height:580}},now);
      next=focusWindow(next,'note');
      if(next.run.desktop.windows.note.maximized)next=actDesktop(next,{type:'maximize',app:'note'},now);
      return focusWindow(actDesktop(next,{type:'rect',app:'note',rect:{x:1100,y:140,width:630,height:650}},now),'note');
    }
    default:return actDesktopExtra(state,action,now,language);
    case 'note': return action.text.length > BALANCE.w3.maxNote ? state : { ...state,persistent:{ ...state.persistent,productionNote:action.text,noteUpdatedAt:now } };
  }
}

export const activeScreenshots=(s:GameState)=>s.persistent.screenshots.filter(shot=>!shot.deleted&&!s.run.desktop.trash.some(t=>t.id===`shot:${shot.id}`));
export const screenshotCooldown=(s:GameState)=>BALANCE.spec.graphics[s.persistent.specs.graphics]!.shotCooldownSeconds*BALANCE.time.millisecondsPerSecond*(hasDesktopSkill(s,'burst')?BALANCE.w3.burstMultiplier:1);
function advanceDesktopEvents(s:GameState,ms:number,now:number,offline:boolean,language:string,captures:boolean):GameState {
 let d=s.run.desktop,next=s;
 // Timers are one-shot, including during absence; automatic terminal jobs run while open.
 const r=d.reservation;
 if(r&&!r.done&&r.at<=now){
  next=withDesktop(next,{...next.run.desktop,cooldownMs:offline?0:next.run.desktop.cooldownMs,reservation:{...r,done:true,result:captures&&(offline||next.run.desktop.cooldownMs===0)&&activeScreenshots(next).length<screenshotCapacity(next)?'captured':'skipped'}});
  if(captures)next=takeScreenshot(next,Math.max(0,r.at),language,offline?BALANCE.w3.timerOfflineMultiplier:1);
 }
 if(captures&&!offline&&d.terminal.running){
  const total=d.terminal.elapsedMs+ms,count=Math.floor(total/d.terminal.interval);
  next=withDesktop(next,{...next.run.desktop,terminal:{...d.terminal,elapsedMs:total%d.terminal.interval}});
  for(let i=0;i<Math.min(count,screenshotCapacity(next)+1);i++){
   const at=Math.max(0,now-total%d.terminal.interval-(count-1-i)*d.terminal.interval);
   const before=next.persistent.screenshots.length;
   if(i>0)next=withDesktop(next,{...next.run.desktop,cooldownMs:Math.max(0,next.run.desktop.cooldownMs-d.terminal.interval)});
   next=takeScreenshot(next,at,language,1,hasDesktopSkill(next,'autoFeedback'));
   const ok=before!==next.persistent.screenshots.length;
   next=withDesktop(next,{...next.run.desktop,terminal:{...next.run.desktop.terminal,executions:next.run.desktop.terminal.executions+(ok?1:0),log:[...next.run.desktop.terminal.log,{at,ok}].slice(-BALANCE.w3.maxNoteLog)}});
   if(!ok&&activeScreenshots(next).length>=screenshotCapacity(next))break;
  }
 }
 if(hasDesktopSkill(next,'autoFeedback')){
  if(hasUpgrade(next,'sort')&&next.run.desktop.feedback.some(f=>f.kind==='sort'&&f.completedAt===null))next=completeRequests(withDesktop(next,{...next.run.desktop,fileSort:'date'}),['sort'],now,true);
  if(captures&&!offline&&next.run.desktop.feedback.some(f=>f.kind==='screenshot'&&f.completedAt===null)&&next.run.desktop.cooldownMs===0&&visibleApps(next).length>=2)next=takeScreenshot(next,now,language,1,true);
 }
 d=next.run.desktop;
 if(!offline){
  const stallMs=Math.max(0,d.stallMs-ms);
  const candidates=visibleApps(next).filter(id=>id!=='settings'&&id!=='manager');
  const shouldStall=!d.stalled&&stallMs===0&&candidates.length>0;
  next=withDesktop(next,{...d,idleMs:d.idleMs+ms,stallMs:shouldStall?BALANCE.w3.stallMinMs+(d.stallSerial*7919)%(BALANCE.w3.stallMaxMs-BALANCE.w3.stallMinMs):stallMs,
   ...(shouldStall?{stalled:candidates[d.stallSerial%candidates.length]!,stalledClosed:false,stallSerial:d.stallSerial+1}:{})});
 }
 return next;
}
