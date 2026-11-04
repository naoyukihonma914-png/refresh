import { groupTool } from '../content/workshopGroups';
import { focusGroupMaterial } from './groupPuzzle';
import { WORKSHOP_PARTS } from '../content/workshopCatalog';
import { usesNativeComponentColors } from './workshopState';
import { actAppBuild, ownAppBlueprint, functionalApp, hasAppPart, type AppBuildAction } from './appBuild';
import { desktopScreen, fitWindow, fitIcon, workHeight } from './desktopGeometry';
import { desktopStage } from './appearance';
import { evaluateCapture,screenshotContentCount,screenshotContentReward } from './captureEvaluation';
import { nextDesktopOffer,followingDesktopOffer } from './desktopOffers';
import { APP_REQUIRED,sourceForSlot } from '../content/appRecipes';
export {fitWindow} from './desktopGeometry';
import { actDesktopExtra, completeRequests,refreshDesktop, type ExtraAction } from './desktopExtras';
import { hasDesktopSkill, hasUpgrade } from './desktopJobs';
import type { DesktopUpgrade } from '../config/balance';
import { encodeScene, projectCapture } from './captureScene';
import { BALANCE } from '../config/balance';
import { actWorkshop, advanceWorkshopAssistance, canAssembleDesktop, completedSets } from './workshop';
import { creditPixels } from './economy';
import { APP_IDS, createDesktopState, type AppId, type BuiltApp, type DesktopState, type Feedback, type Rect, type Screenshot } from './desktopState';
import type { GameState } from './state';
export const withDesktop = (state: GameState, desktop: DesktopState): GameState => ({ ...state, run: { ...state.run, desktop } });
export const installedApps = (state: GameState): AppId[] => ['tessera', 'note', ...state.run.desktop.apps, 'settings'];
export const runningApps = (state: GameState): AppId[] => installedApps(state).filter(id => state.run.desktop.windows[id].open);
export const visibleApps = (state: GameState): AppId[] => runningApps(state).filter(id => !state.run.desktop.windows[id].minimized && (!hasDesktopSkill(state,'virtual')||state.run.desktop.workspaces[id]===state.run.desktop.workspace));
export function enterDesktop(state: GameState): GameState {
  if (!canAssembleDesktop(state) || state.run.desktop.entered) return state;
  const d = createDesktopState(desktopScreen(desktopStage(state))); d.entered = true; d.enteredAt = state.elapsedMs;d.builtAt.desktop=state.lastTickAt; d.active = 'tessera'; d.windows.tessera.open = true; d.windows.tessera.z = 1;
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
export const nextDesktopApp = nextDesktopOffer;
export const followingDesktopApp = followingDesktopOffer;
export function buyDesktopApp(state:GameState,id:DesktopUpgrade,now=state.lastTickAt):GameState {
 const offer=nextDesktopOffer(state);
 if(state.run.world!=='desktop'||offer?.id!==id||state.resources.pixels<offer.cost)return state;
 if(offer.id==='jobs')return withDesktop({...state,resources:{...state.resources,pixels:state.resources.pixels-offer.cost}},{...state.run.desktop,upgrades:[...state.run.desktop.upgrades,'jobs'],builtAt:{...state.run.desktop.builtAt,jobs:now}});
 const app=offer.id;
 let next=state;
 if(offer.kind==='set')next=actWorkshop(next,next.run.workshop.groupPuzzle?{type:'groupBuy',group:groupTool(app).group}:{type:'buySet',set:app},now);
 if(offer.kind==='assemble')next=actAppBuild(ownAppBlueprint(next,app),{type:'app-edit',app});
 else {
  const required=APP_REQUIRED[app].map(role=>sourceForSlot(app,role)!);
  const part=required.find(source=>next.run.workshop.parts[source]?.step!==4)??required[0];
  if(part)next=focusGroupMaterial(next,part,now);
  next={...next,run:{...next.run,workshop:{...next.run.workshop,view:'workbench'},desktop:{...next.run.desktop,editingApp:null}}};
 }
 return focusWindow(next,'tessera');
}
export function desktopConditions(state:GameState):boolean[] {
 return [runningApps(state).filter(id=>!['note','settings'].includes(id)&&(id==='tessera'||functionalApp(state,id as BuiltApp))).length>=BALANCE.w3.requiredApps,
 state.run.desktop.feedback.filter(f=>f.completedAt!==null).length>=BALANCE.w3.requiredFeedback,
 ['common','foundation','files','mail'].every(id=>completedSets(state).includes(id as 'files')),state.persistent.desktopPrefs.wallpaper!==null&&hasAppPart(state,'photo','image')&&hasAppPart(state,'photo','wallpaper'),
 state.run.desktop.terminal.executions>0&&hasAppPart(state,'terminal','commands')&&hasAppPart(state,'terminal','run')];
}
export const pendingCapacity=(state:GameState)=>hasDesktopSkill(state,'sortMail')?BALANCE.w3.sortedMailCapacity:BALANCE.w3.maxPending;
function newFeedback(state: GameState, at: number): Feedback | null {
  const d = state.run.desktop;
  const pending = d.feedback.filter(f => f.completedAt === null);
  if (pending.length >= pendingCapacity(state)) return null;
  const primaryColor = state.run.workshop.parts['common-button']?.design.color??BALANCE.workshop.design.color;
  const candidates: { kind: Feedback['kind']; target: string }[] = [];
  if (!pending.some(f => f.kind === 'color')) candidates.push({ kind: 'color', target: 'primary' });
  if (!pending.some(f => f.kind === 'screenshot')) candidates.push({ kind: 'screenshot', target: '' });
  const eligible:{kind:Feedback['kind'];target:string}[]=[
    ...(hasUpgrade(state,'sort')?[{kind:'sort' as const,target:''}]:[]),
    ...(hasUpgrade(state,'search')?[{kind:'search' as const,target:'note'}]:[]),
    ...(d.apps.includes('photo')?[{kind:'bright' as const,target:''}]:[]),
    ...(d.apps.includes('bin')&&state.persistent.screenshots.filter(s=>!s.deleted&&!d.trash.some(t=>t.id===`shot:${s.id}`)).length>=3?[{kind:'trash' as const,target:''}]:[]),
    ...(hasUpgrade(state,'timer')?[{kind:'timer' as const,target:String(Math.ceil((at+BALANCE.w3.timerRequestDelayMs)/60000)*60000)}]:[]),
    ...(d.apps.includes('theme')?[{kind:'dark' as const,target:''}]:[]),
  ];
  const unfinished=WORKSHOP_PARTS.find(part=>state.run.workshop.parts[part.id]&&state.run.workshop.parts[part.id]!.step!==4);
  if(unfinished&&!pending.some(f=>f.kind==='part'))candidates.push({kind:'part',target:unfinished.id});
  if(!pending.some(f=>f.kind==='capture'))candidates.push({kind:'capture',target:hasAppPart(state,'photo','image')?'photo':state.run.desktop.feedbackSerial%2?'maximized':'windows'});
  candidates.push(...eligible.filter(c=>!pending.some(f=>f.kind===c.kind)));
  const order: Feedback['kind'][] = ['part','color','screenshot','sort','search','bright','trash','timer','dark','capture'];
  const offset = d.feedback.length ? (order.indexOf(d.feedback.at(-1)!.kind) + 1) % order.length : 0;
  const candidate = Array.from({ length: order.length }, (_,i) => candidates.find(c => c.kind === order[(offset+i)%order.length])).find(Boolean);
  if (!candidate) return null;
  return { id: d.feedbackSerial + 1, sender: (['hikari','ren','maki'] as const)[d.feedbackSerial % 3]!, ...candidate, at, completedAt: null,
    baseline: [], baselineColor: primaryColor };
}
export function advanceDesktopTime(state: GameState, ms: number, now: number, offline = false, language='ja', captures=true): GameState {
  if (state.run.world !== 'desktop') return state;
  const interval = BALANCE.spec.network[state.persistent.specs.network]!.mailIntervalSeconds * BALANCE.time.millisecondsPerSecond;
  const automatic = captures && state.run.desktop.terminal.running && hasAppPart(state,'terminal','commands')&&hasAppPart(state,'terminal','run');
  let next = withDesktop(state, { ...state.run.desktop, cooldownMs: offline && !automatic ? state.run.desktop.cooldownMs : Math.max(0, state.run.desktop.cooldownMs-ms), feedbackMs: (state.run.desktop.feedbackMs + ms) % interval });
  const arrivals = Math.floor((state.run.desktop.feedbackMs + ms) / interval);
  for (let i=0; i<Math.min(arrivals,pendingCapacity(state)); i++) {
    const request = newFeedback(next, Math.max(0, now - ms + interval - state.run.desktop.feedbackMs + i * interval));
    if (!request) break;
    next = withDesktop(next, { ...next.run.desktop, feedbackSerial: request.id, feedback: [...next.run.desktop.feedback, request], notice: request.id, success: null });
  }
  return advanceDesktopEvents(advanceWorkshopAssistance(next,ms,now),ms,now,offline,language,captures);
}
function completeFeedback(state: GameState, ids: number[], now: number, automatic=false): GameState {
  const pending = state.run.desktop.feedback.filter(f => ids.includes(f.id) && f.completedAt === null);
  if (!pending.length) return state;
  const reward=BALANCE.w3.feedbackTokens*(automatic?BALANCE.w3.autoFeedbackMultiplier:1);
  return withDesktop({ ...state, resources: { ...state.resources, tokens: state.resources.tokens + pending.length * reward } }, { ...state.run.desktop,
    feedback: state.run.desktop.feedback.map(f => pending.includes(f) ? { ...f, completedAt: now, reward } : f),
    notice: pending.some(f => f.id === state.run.desktop.notice) ? null : state.run.desktop.notice, success: pending[pending.length-1]!.id });
}
export function observeTesseraAction(before: GameState, after: GameState, type: string, now: number): GameState {
  if (after.run.world !== 'desktop' || before === after) return after;
  const done = after.run.desktop.feedback.filter(f => {
    if (f.completedAt !== null) return false;
    if(f.kind==='part')return after.run.workshop.parts[f.target as keyof typeof after.run.workshop.parts]?.step===4&&before.run.workshop.parts[f.target as keyof typeof before.run.workshop.parts]?.step!==4;
    if((type==='adjust'||type==='groupAdjust')&&f.kind==='color'){const a=before.run.workshop.parts['common-button']?.design,b=after.run.workshop.parts['common-button']?.design;return !!a&&!!b&&(a.color!==b.color||usesNativeComponentColors(a)!==usesNativeComponentColors(b));}
    return false;
  }).map(f => f.id);
  return completeFeedback(after,done,now);
}
export const screenshotParts = screenshotContentCount;
export const screenshotCapacity = (state: GameState) => BALANCE.w3.baseShotCapacity * BALANCE.w3.storageCapacityMultiplier ** state.persistent.specs.storage;
export const screenshotReward = screenshotContentReward;
export function takeScreenshot(state: GameState, now: number, language: string, multiplier=1, automatic=false): GameState {
  if (state.run.world !== 'desktop' || state.run.desktop.cooldownMs > 0 || activeScreenshots(state).length >= screenshotCapacity(state)) return state;
  const frozen = projectCapture({...state,lastTickAt:now},language);
  const evaluation=frozen.evaluation??evaluateCapture(state),reward=evaluation.reward*multiplier;
  const shot: Screenshot = { id: Math.max(state.persistent.desktopPrefs.lastShotId,state.persistent.screenshots.at(-1)?.id??0)+1, at: now, language, data: encodeScene(frozen) };
  let next = creditPixels(state,reward);
  next = { ...next, persistent: { ...next.persistent, screenshots: [...next.persistent.screenshots,shot], desktopPrefs:{...next.persistent.desktopPrefs,lastShotId:shot.id} } };
  next = withDesktop(next, { ...next.run.desktop, cooldownMs: screenshotCooldown(state), shotHistory:[...next.run.desktop.shotHistory.filter(h=>h.at>=now-BALANCE.w3.historyMs),{at:now,pixels:reward}].slice(-BALANCE.w3.maxShotHistory) });
  const visible=new Set(evaluation.visibleWindows);
  const completed=next.run.desktop.feedback.filter(f=>f.completedAt===null&&(f.kind==='screenshot'?visible.size>=2:f.kind==='capture'?f.target==='windows'?visible.size>=2:f.target==='photo'?evaluation.parts.some(p=>p.visible&&p.app==='photo'&&p.sourcePartId==='photo-display'):evaluation.visibleWindows.some(id=>state.run.desktop.windows[id as AppId]?.maximized):false)).map(f=>f.id);
  return completeFeedback(next,completed,now,automatic);
}
export type DesktopAction = ExtraAction | AppBuildAction
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
  if(action.type.startsWith('app-'))return actAppBuild(state,action as AppBuildAction);
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
      return focusWindow(withDesktop(state,{ ...d, windows: { ...d.windows,[action.app]: { ...w, ...(w.maximized ? w.restore! : { x:0,y:0,width:d.screen.width,height:workHeight(d.screen) }), maximized: !w.maximized, restore: w.maximized ? null : { x:w.x,y:w.y,width:w.width,height:w.height } } } }),action.app);
    }
    case 'rect': {
      if (!installedApps(state).includes(action.app) || d.windows[action.app].maximized || !(['x','y','width','height'] as const).every(key => Number.isFinite(action.rect[key]))) return state;
      return withDesktop(state,{ ...d,windows:{ ...d.windows,[action.app]:{ ...d.windows[action.app], ...fitWindow(action.app,action.rect,d.screen) } } });
    }
    case 'icon': return !installedApps(state).includes(action.app) || !Number.isFinite(action.x) || !Number.isFinite(action.y) ? state : withDesktop(state,{ ...d,icons:{ ...d.icons,[action.app]: fitIcon({x:action.x,y:action.y},d.screen,Math.max(76,state.persistent.desktopPrefs.iconSize+36)) } });
    case 'folder': return !['root','exports','screenshots'].includes(action.folder) ? state : withDesktop(state,{ ...d,fileFolder:action.folder,fileSelection:null });
    case 'file': return withDesktop(state,{ ...d,fileSelection:action.id });
    case 'mail': return !d.feedback.some(f => f.id === action.id) ? state : withDesktop(state,{ ...d,mailSelection:action.id,feedback:d.feedback.map(f=>f.id===action.id&&f.readAt==null?{...f,readAt:now}:f) });
    case 'notice': return action.id !== null && !d.feedback.some(f => f.id === action.id && f.completedAt === null) ? state : withDesktop(state,{ ...d,notice:action.id });
    case 'success-close': return withDesktop(state,{ ...d,success:null });
    case 'fix': {
      const request=d.feedback.find(f=>f.id===action.id);if(!request)return state;
      if(request.kind!=='screenshot'&&request.kind!=='capture'){
        const destinations:Partial<Record<Feedback['kind'],AppId>>={sort:'files',search:'files',bright:'photo',trash:'bin',timer:'clock',dark:'theme'};
        const app=destinations[request.kind]??'tessera';
        const required:Partial<Record<Feedback['kind'],[BuiltApp,string[]]>>={sort:['files',['list','sort']],search:['files',['list','search']],bright:['photo',['image','brightness','wallpaper']],trash:['bin',['trash']],timer:['clock',['timer']],dark:['theme',['appearance']]};
        const need=required[request.kind];
        if(need&&state.run.desktop.projects[need[0]]&&need[1].some(part=>!hasAppPart(state,need[0],part)))return focusWindow(actAppBuild(state,{type:'app-edit',app:need[0]}),'tessera');
        let next=focusWindow(withDesktop(state,{...d,notice:null,editingApp:app==='tessera'?null:d.editingApp}),app);
        if(request.kind==='part')next=focusGroupMaterial(next,request.target as import('../content/workshopCatalog').WorkshopPartId,now);
        if(request.kind==='color')next=focusGroupMaterial(next,'common-button',now);
        return next;
      }
      // Open the requested tools without replacing the player's saved arrangement.
      const target=request.kind==='capture'&&request.target==='photo'?'photo':'note';
      let next=focusWindow(withDesktop(state,{...d,notice:null}),'tessera');
      return focusWindow(next,target);

    }
    default:return actDesktopExtra(state,action as ExtraAction,now,language);
    case 'note': return action.text.length > BALANCE.w3.maxNote ? state : { ...state,persistent:{ ...state.persistent,productionNote:action.text,noteUpdatedAt:now } };
  }
}

export const activeScreenshots=(s:GameState)=>s.persistent.screenshots.filter(shot=>!shot.deleted&&!s.run.desktop.trash.some(t=>t.id===`shot:${shot.id}`));
export const screenshotCooldown=(s:GameState)=>BALANCE.spec.graphics[s.persistent.specs.graphics]!.shotCooldownSeconds*BALANCE.time.millisecondsPerSecond*(hasDesktopSkill(s,'burst')?BALANCE.w3.burstMultiplier:1);
function advanceDesktopEvents(s:GameState,ms:number,now:number,offline:boolean,language:string,captures:boolean):GameState {
 let d=s.run.desktop,next=s;
 // Timers are one-shot. Offline time is split at each automation deadline by time.ts.
 const r=d.reservation;
 if(r&&!r.done&&r.at<=now){
  next=withDesktop(next,{...next.run.desktop,cooldownMs:offline?0:next.run.desktop.cooldownMs,reservation:{...r,done:true,result:captures&&(offline||next.run.desktop.cooldownMs===0)&&activeScreenshots(next).length<screenshotCapacity(next)?'captured':'skipped'}});
  if(captures)next=takeScreenshot(next,Math.max(0,r.at),language,offline?BALANCE.w3.timerOfflineMultiplier:1);
 }
 if(captures&&d.terminal.running&&hasAppPart(next,'terminal','commands')&&hasAppPart(next,'terminal','run')){
  const total=d.terminal.elapsedMs+ms,count=Math.floor(total/d.terminal.interval);
  next=withDesktop(next,{...next.run.desktop,terminal:{...d.terminal,elapsedMs:total%d.terminal.interval}});
  for(let i=0;i<Math.min(count,screenshotCapacity(next)+1);i++){
   const at=Math.max(0,now-total%d.terminal.interval-(count-1-i)*d.terminal.interval);
   if(i>0)next=withDesktop(next,{...next.run.desktop,cooldownMs:Math.max(0,next.run.desktop.cooldownMs-d.terminal.interval)});
   const before=next;
   next=next.run.play.terminalCommand==='export'?actWorkshop(next,{type:'export'},at):next.run.play.terminalCommand==='refresh'?refreshDesktop(next,at):takeScreenshot(next,at,language,1,hasDesktopSkill(next,'autoFeedback'));
   const ok=next.run.play.terminalCommand==='capture'?before.persistent.screenshots.length!==next.persistent.screenshots.length:before!==next;
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
