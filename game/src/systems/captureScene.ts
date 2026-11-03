import { BALANCE, type SpecKey } from '../config/balance';
import { createI18n } from '../content/i18n';
import { editorStage, desktopStage } from './appearance';
import { isBuildable, validLayout, type AppProjects } from './appLayout';
import { validAppAssembly } from './appAssemblySchema';
import { activeScreenshots, desktopConditions } from './desktop';
import { defaultNote, desktopFiles, screenshotBytes, type DesktopFile } from './desktopFiles';
import { decodeCapture, encodeCapture, type Screenshot, type WindowState } from './desktopState';
import { passivePixelsPerSecond, producerLedger } from './economy';
import type { PageDesign } from './pageDesign';
import { isCapturePageDesignV12 } from './capturePageDesign';
import { isLegacyPageDesign, type LegacyPageDesign } from './legacyPageDesign';
import type { GameState } from './state';
import { isWorkshopState, isEditorCustomization, isSetDocument, type WorkshopState, type EditorCustomization, type EditorSkill, type SetDocument } from './workshopState';
import { evaluateCapture, isCaptureEvaluation, type CaptureEvaluation } from './captureEvaluation';
import { feedbackBodyText, feedbackSubject } from '../content/feedback';
import { producerName } from '../content/production';

/** A presentation document, never a game state. Historical formats are read through this DTO. */
export interface FrozenFile {
  id:string; name:string; kind:DesktopFile['kind']; at:number|null; bytes:number;
  appId?:DesktopFile['appId']; shotId?:number; partId?:string;
  edition?:'current'|'archive';version?:SetDocument['version'];
}
export interface FrozenPhoto {source:string;brightness:number;tone:number;crop:number}
export interface FrozenPreferences {
  skills:string[]; disabled:string[];mode:'light'|'dark';accent:string;radius:number;radiusCustom:boolean;
  iconSize:number;slideshow:boolean;wallpaper:FrozenPhoto|null;lastShotId:number;
}
export interface FrozenFeedback {id:number;kind:string;target:string;at:number;completedAt:number|null;sender:'hikari'|'ren'|'maki';reward?:number;readAt?:number|null;subject?:string;body?:string}
export interface FrozenNotice {id:string;title:string;text:string;sender?:string}
export interface FrozenProducer {id:string;kind:string;app?:string;name:string;sourceIds:string[];baseRate:number;count:number;perSecond:number;multipliers:Record<string,number>}
export interface CaptureScene {
  version:1|2|3|4|5|6|7|8|9|10|11|12;
  /** Marks a normalized historical presentation, without the discarded editable artwork. */
  archived?:true;
  display:{resources:GameState['resources'];specs:Record<SpecKey,number>;productName:string|null;runVersion:'v0.1'|'v1'|'v2';notation:'compact'|'scientific';savedAt:number|null;rate:number;parts:number;reward:number;cooldown:number;checks:boolean[];shotCount:number;shotBytes:number;fileCount:number;wallTime:number;managerShotRate:number;managerTokenRate:number};
  desktop:{apps:string[];windows:Record<string,WindowState>;active:string|null;icons:Record<string,{x:number;y:number}>;cooldownMs:number;fileFolder:'root'|'exports'|'screenshots';fileSelection:string|null;mailSelection:number|null;notice:number|null;success:number|null;feedback:FrozenFeedback[]};
  view:{preferences:FrozenPreferences;photo:FrozenPhoto;desktop:Record<string,unknown>};
  appearance:{editor:0|1|2;desktop:0|1|2|3|4|5};screen:{width:number;height:number};
  note:string;files:FrozenFile[];palette:string[];
  workshop?:WorkshopState;editorCustomization?:EditorCustomization;editorSkills?:EditorSkill[];
  page?:LegacyPageDesign|PageDesign;appProjects?:AppProjects;editingApp?:string|null;
  common?:{progress:unknown;play:unknown;settingsPage:string};
  evaluation?:CaptureEvaluation;selectedSetDocument?:SetDocument;
  notices?:FrozenNotice[];
  production?:FrozenProducer[];
}
export interface CaptureSceneV10 extends CaptureScene {version:10;workshop:WorkshopState;editorCustomization:EditorCustomization;editorSkills:EditorSkill[];page:LegacyPageDesign}
export interface CaptureSceneV11 extends CaptureScene {version:11;workshop:WorkshopState;editorCustomization:EditorCustomization;editorSkills:EditorSkill[];page:LegacyPageDesign;evaluation:CaptureEvaluation}
export interface CaptureSceneV12 extends CaptureScene {version:12;workshop:WorkshopState;editorCustomization:EditorCustomization;editorSkills:EditorSkill[];page:PageDesign;evaluation:CaptureEvaluation}

/** Published 11 and current 12 share native rendering, while their page schemas remain distinct. */
export const hasNativeCapturePresentation=(scene:Pick<CaptureScene,'version'>)=>scene.version===11||scene.version===12;

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const integer=(v:unknown):v is number=>number(v)&&Number.isSafeInteger(v);
const text=(v:unknown):v is string=>typeof v==='string';
const nullableText=(v:unknown)=>v===null||text(v);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(text);
const color=(v:unknown)=>text(v)&&/^#[\da-f]{6}$/i.test(v);
// These belong to the published recording formats, not the mutable game's catalog.
const appIds=['tessera','note','files','mail','manager','photo','bin','clock','theme','terminal','settings'];
const specCounts={color:4,resolution:4,refresh:4,memory:5,storage:5,network:3,graphics:4};
const feedbackKinds=['redraw','practice','color','screenshot','sort','search','bright','trash','timer','dark'];
const photo=(v:unknown):v is FrozenPhoto=>record(v)&&text(v.source)&&/^(coast|night|sketch|shot:[1-9][0-9]*)$/.test(v.source)&&typeof v.brightness==='number'&&v.brightness>=.5&&v.brightness<=1.5&&typeof v.tone==='number'&&v.tone>=-50&&v.tone<=50&&number(v.crop)&&v.crop<=40;
const bitmap=(v:unknown)=>record(v)&&[16,32,64,128].includes(v.size as number)&&Array.isArray(v.frames)&&v.frames.length>0&&v.frames.length<=2&&v.frames.every(f=>Array.isArray(f)&&f.length===Number(v.size)**2&&f.every(c=>Number.isInteger(c)&&c>=-1&&c<256));
function windowValid(v:unknown):v is WindowState {
  return record(v)&&['x','y','width','height','z'].every(k=>number(v[k]))&&Number(v.width)>0&&Number(v.width)<=1920&&Number(v.height)>0&&Number(v.height)<=1080&&['open','minimized','maximized'].every(k=>typeof v[k]==='boolean');
}
function displayValid(v:unknown):boolean {
  return record(v)&&record(v.resources)&&['pixels','tokens','dollars'].every(k=>number((v.resources as Record<string,unknown>)[k]))&&record(v.specs)
    &&Object.entries(specCounts).every(([k,n])=>integer((v.specs as Record<string,unknown>)[k])&&Number((v.specs as Record<string,unknown>)[k])<n)
    &&nullableText(v.productName)&&['v0.1','v1','v2'].includes(String(v.runVersion))&&['compact','scientific'].includes(String(v.notation))&&(v.savedAt===null||number(v.savedAt))
    &&['rate','parts','reward','cooldown','shotCount','shotBytes','fileCount'].every(k=>number(v[k]))&&Array.isArray(v.checks)&&v.checks.length===5&&v.checks.every(c=>typeof c==='boolean');
}
function desktopValid(v:unknown,modern=false):boolean {
  if(!record(v)||!strings(v.apps)||!v.apps.every(a=>appIds.includes(a))||new Set(v.apps).size!==v.apps.length||!record(v.windows)||!record(v.icons)||!(v.active===null||appIds.includes(String(v.active)))||!number(v.cooldownMs)||!['root','exports','screenshots'].includes(String(v.fileFolder))||!nullableText(v.fileSelection)||!Array.isArray(v.feedback)||v.feedback.length>40)return false;
  if(!Object.entries(v.windows).every(([id,w])=>appIds.includes(id)&&windowValid(w))||!['tessera','note','files','mail'].every(id=>Object.hasOwn(v.windows as object,id)))return false;
  if(!Object.entries(v.icons).every(([id,p])=>appIds.includes(id)&&record(p)&&number(p.x)&&number(p.y)))return false;
  if(!v.feedback.every(f=>record(f)&&integer(f.id)&&(modern?[...feedbackKinds,'part','capture']:feedbackKinds).includes(String(f.kind))&&text(f.target)&&number(f.at)&&(f.completedAt===null||number(f.completedAt))&&['hikari','ren','maki'].includes(String(f.sender))&&(f.reward===undefined||number(f.reward))
    &&(!modern||(f.readAt===undefined||f.readAt===null||number(f.readAt))&&(f.subject===undefined||text(f.subject))&&(f.body===undefined||text(f.body)))))return false;
  return [v.notice,v.success,v.mailSelection].every(id=>id===null||(v.feedback as Record<string,unknown>[]).some(f=>f.id===id));
}
function filesValid(v:unknown,legacy:boolean):boolean {
  return Array.isArray(v)&&v.length<=40&&v.every(f=>record(f)&&text(f.id)&&text(f.name)&&['folder','icon','part','set','note','shot','app',...(legacy?['home','sketch']:[])].includes(String(f.kind))&&(f.at===null||number(f.at))&&number(f.bytes)&&(f.shotId===undefined||integer(f.shotId)&&f.shotId>0)&&(f.picture===undefined||legacy&&bitmap(f.picture))&&(f.partId===undefined||text(f.partId))&&(f.appId===undefined||appIds.includes(String(f.appId))));
}
function preferencesValid(v:unknown):boolean {
  return record(v)&&strings(v.skills)&&strings(v.disabled)&&['light','dark'].includes(String(v.mode))&&color(v.accent)&&number(v.radius)&&v.radius<=8&&[32,48,64].includes(v.iconSize as number)&&typeof v.slideshow==='boolean'&&(v.wallpaper===null||photo(v.wallpaper))&&integer(v.lastShotId)&&(v.radiusCustom===undefined||typeof v.radiusCustom==='boolean');
}
function commonValid(v:Record<string,unknown>,legacy:boolean):boolean {
  if(!displayValid(v.display)||!desktopValid(v.desktop,v.version===11||v.version===12)||!text(v.note)||!filesValid(v.files,legacy)||!strings(v.palette)||v.palette.length>256||!v.palette.every(color))return false;
  if(v.screen!==undefined&&(!record(v.screen)||![[800,600],[1024,768],[1366,768],[1920,1080]].some(([w,h])=>record(v.screen)&&v.screen.width===w&&v.screen.height===h)))return false;
  if(v.appearance!==undefined&&(!record(v.appearance)||![0,1,2].includes(v.appearance.editor as number)||![0,1,2,3,4,5].includes(v.appearance.desktop as number)))return false;
  if(Number(v.version)!==1&&(!record(v.view)||!preferencesValid(v.view.preferences)||!photo(v.view.photo)||!record(v.view.desktop)))return false;
  return true;
}
function projectsValid(value:unknown):boolean {
  return value===undefined||record(value)&&Object.entries(value).every(([id,project])=>isBuildable(id)&&record(project)
    &&validLayout(project.draft,id)&&(project.installed===null||validLayout(project.installed,id))
    &&(project.draftAssembly===undefined||validAppAssembly(project.draftAssembly,id))
    &&(project.installedAssembly===undefined||project.installedAssembly===null||validAppAssembly(project.installedAssembly,id)));
}
/** Old drawing DTOs are checked only here, never imported into the live state or UI. */
function legacyValid(v:Record<string,unknown>):boolean {
  if(![1,2,3,4,5,6,7,8,9].includes(v.version as number)||!commonValid(v,true))return false;
  if(v.archived===true)return record(v.view)&&preferencesValid(v.view.preferences)&&photo(v.view.photo);
  if(!record(v.home)||!record(v.editor)||!strings(v.home.built)||!number(v.home.cursors)||!strings(v.editor.documents)||!strings(v.editor.skills)||!record(v.icons))return false;
  if(!(v.editor.picture===null||bitmap(v.editor.picture))||!Array.isArray(v.editor.target)||v.editor.target.length>16384||!v.editor.target.every(c=>Number.isInteger(c)&&c>=-1&&c<256))return false;
  if(v.editor.picture!==null&&v.editor.target.length!==Number((v.editor.picture as Record<string,unknown>).size)**2)return false;
  if(!Object.values(v.icons).every(bitmap)||!(v.wallpaper===null||bitmap(v.wallpaper)))return false;
  return (v.photoPicture===undefined||v.photoPicture===null||bitmap(v.photoPicture))&&(v.secretArt===undefined||v.secretArt===null||bitmap(v.secretArt));
}
export function isCaptureScene(v:unknown):v is CaptureScene {
  if(!record(v))return false;
  if(v.version!==10&&v.version!==11&&v.version!==12)return legacyValid(v);
  return v.archived===undefined&&commonValid(v,false)&&record(v.display)&&['wallTime','managerShotRate','managerTokenRate'].every(k=>number((v.display as Record<string,unknown>)[k]))&&record(v.view)&&preferencesValid(v.view.preferences)&&photo(v.view.photo)&&v.view.photo.source!=='sketch'&&record(v.view.preferences)&&typeof v.view.preferences.radiusCustom==='boolean'&&(v.view.preferences.wallpaper===null||photo(v.view.preferences.wallpaper)&&v.view.preferences.wallpaper.source!=='sketch')&&record(v.appearance)&&record(v.screen)
    &&isWorkshopState(v.workshop)&&isEditorCustomization(v.editorCustomization)&&strings(v.editorSkills)&&v.editorSkills.every(id=>BALANCE.workshop.skills.some(s=>s.id===id))&&(v.version===12?isCapturePageDesignV12(v.page):isLegacyPageDesign(v.page))
    &&(v.version===10||isCaptureEvaluation(v.evaluation)&&projectsValid(v.appProjects)&&(v.selectedSetDocument===undefined||isSetDocument(v.selectedSetDocument))
      &&(v.notices===undefined||Array.isArray(v.notices)&&v.notices.length<=BALANCE.w3.maxPending&&v.notices.every(notice=>record(notice)&&text(notice.id)&&text(notice.title)&&text(notice.text)&&(notice.sender===undefined||text(notice.sender))))
      &&(v.production===undefined||Array.isArray(v.production)&&v.production.length<=BALANCE.capture.maxElements&&v.production.every(row=>record(row)&&text(row.id)&&text(row.kind)&&text(row.name)&&(row.app===undefined||text(row.app))&&strings(row.sourceIds)&&row.sourceIds.length<=BALANCE.capture.maxElements&&amountNumberFields(row,['baseRate','count','perSecond'])&&record(row.multipliers)&&Object.values(row.multipliers).every(number))));
}
function amountNumberFields(value:Record<string,unknown>,fields:string[]):boolean{return fields.every(key=>number(value[key]));}
const clone=<T,>(value:T):T=>structuredClone(value);
const defaultPhoto:FrozenPhoto={source:'coast',brightness:1,tone:0,crop:0};
const defaultPreferences:FrozenPreferences={skills:[],disabled:[],mode:'light',accent:'#0067c0',radius:0,radiusCustom:false,iconSize:48,slideshow:false,wallpaper:null,lastShotId:0};
/** Converts only static presentation fields. Editable historical artwork is deliberately discarded. */
export function normalizeCapture(value:unknown):CaptureScene {
  if(!isCaptureScene(value))throw new Error('Invalid screenshot scene');
  const v=value as unknown as Record<string,unknown>,d=v.display as CaptureScene['display'],desk=v.desktop as CaptureScene['desktop'];
  const files=(v.files as Record<string,unknown>[]).map(f=>({id:String(f.id),name:String(f.name),kind:((f.kind==='home'||f.kind==='sketch')?'part':f.kind) as FrozenFile['kind'],at:f.at as number|null,bytes:Number(f.bytes),...(f.shotId===undefined?{}:{shotId:Number(f.shotId)}),...(typeof f.partId==='string'?{partId:f.partId}:{}),...(f.appId===undefined?{}:{appId:f.appId as FrozenFile['appId']}),...(['current','archive'].includes(String(f.edition))?{edition:f.edition as FrozenFile['edition']}:{ }),...(['v0.1','v1','v2'].includes(String(f.version))?{version:f.version as SetDocument['version']}:{})}));
  const view=v.view as CaptureScene['view']|undefined;
  return clone({version:value.version,...(value.version>=10?{}:{archived:true as const}),
    display:{...d,wallTime:d.wallTime??d.savedAt??0,managerShotRate:d.managerShotRate??0,managerTokenRate:d.managerTokenRate??0},
    desktop:{apps:desk.apps,windows:desk.windows,active:desk.active,icons:desk.icons,cooldownMs:desk.cooldownMs,fileFolder:desk.fileFolder,fileSelection:desk.fileSelection,mailSelection:desk.mailSelection,notice:desk.notice,success:desk.success,feedback:desk.feedback},
    view:{preferences:{...(view?.preferences??defaultPreferences),radiusCustom:view?.preferences.radiusCustom??false},photo:view?.photo??defaultPhoto,desktop:view?.desktop??{}},
    appearance:(v.appearance as CaptureScene['appearance']|undefined)??{editor:0,desktop:0},screen:(v.screen as CaptureScene['screen']|undefined)??{width:1920,height:1080},
    note:String(v.note),files,palette:v.palette as string[],
    ...(value.version>=10?{workshop:value.workshop,editorCustomization:value.editorCustomization,editorSkills:value.editorSkills,page:value.page,appProjects:value.appProjects,editingApp:value.editingApp,common:value.common}:{}),
    ...(hasNativeCapturePresentation(value)?{evaluation:value.evaluation,selectedSetDocument:value.selectedSetDocument,notices:value.notices,production:value.production}:{}),
  });
}
const decoded=new WeakMap<Screenshot,{data:string;id:number;scene:CaptureScene}>();
export function readCapture(shot:Screenshot):CaptureScene {
  const cached=decoded.get(shot);if(cached?.data===shot.data&&cached.id===shot.id)return cached.scene;
  const scene=normalizeCapture(decodeCapture(shot.data));
  if(scene.files.some(f=>f.shotId!==undefined&&f.shotId>=shot.id)||[scene.view.photo.source,scene.view.preferences.wallpaper?.source].some(source=>source?.startsWith('shot:')&&Number(source.slice(5))>=shot.id))throw new Error('Invalid screenshot reference');
  decoded.set(shot,{data:shot.data,id:shot.id,scene});return scene;
}
export function encodeScene(scene:CaptureScene):string {
  if(!isCaptureScene(scene))throw new Error('Invalid screenshot scene');
  return encodeCapture(scene);
}
export function projectCapture(state:GameState,language:string):CaptureSceneV12 {
  const d=state.run.desktop,p=state.persistent;
  const i18n=createI18n(language,{numberNotation:p.numberNotation});
  const allFiles=d.windows.files.open&&!d.windows.files.minimized?desktopFiles(state,createI18n(language)):[];
  const files=allFiles.filter((f,i)=>i<39||f.id===d.fileSelection).map(file=>({id:file.id,name:file.name,kind:file.kind,at:file.at,bytes:file.bytes,...(file.appId?{appId:file.appId}:{}),...(file.work?.kind==='part'?{partId:file.work.id}:{}),...(file.shot&&file.id===d.fileSelection?{shotId:file.shot.id}:{}),...(file.edition?{edition:file.edition}:{}),...(file.setDocument?{version:file.setDocument.version}:{})}));
  const evaluation=evaluateCapture(state),selectedSetDocument=allFiles.find(file=>file.id===d.fileSelection)?.setDocument;
  const selected=d.feedback.find(f=>f.id===d.mailSelection),shown=d.windows.mail.open&&!d.windows.mail.minimized?d.feedback.slice(-Math.ceil(d.windows.mail.height/50)-2):[];
  const feedback=d.feedback.filter(f=>f.completedAt===null||shown.includes(f)||f===selected||f.id===d.notice||f.id===d.success).map(f=>{const {baseline:_baseline,baselineColor:_color,...row}=f;return {...row,subject:feedbackSubject(f,i18n),body:feedbackBodyText(state,f,i18n)};});
  const notices:FrozenNotice[]=[],notice=d.feedback.find(f=>f.id===(d.success??d.notice));
  if(notice)notices.push({id:'notification:feedback',title:i18n.t(d.success!==null?'desktop.thanks':'desktop.notifications'),sender:i18n.t(`feedback.sender.${notice.sender}`),text:d.success!==null?i18n.t('desktop.tokenReward',{count:notice.reward??BALANCE.w3.feedbackTokens}):feedbackBodyText(state,notice,i18n)});
  if(state.run.play.achievement)notices.push({id:'notification:achievement',title:i18n.t('settings.records'),text:i18n.t('achievement.notice',{name:i18n.t(`achievement.${state.run.play.achievement.id}`)})});
  const production=d.windows.manager.open&&!d.windows.manager.minimized?producerLedger(state).map(entry=>({...entry,name:producerName(entry,state,i18n)})):undefined;
  const {assistance:_assistance,...workshopPresentation}=state.run.workshop;
  const {upgrades,builtAt,jobs,workspace,workspaces,fileSort,fileDescending,fileSearch,largeIcons,mailFolder,photo:photoEdit,compare,trash,reservation,terminal,stalled,settingsPage,managerTab,managerProcess,calendarMonth}=d;
  return clone({version:12,evaluation,notices,...(production?{production}:{}),...(selectedSetDocument?{selectedSetDocument}:{}),display:{resources:state.resources,specs:p.specs,productName:p.productName,runVersion:state.run.version,notation:p.numberNotation,savedAt:state.lastSavedAt,rate:passivePixelsPerSecond(state),parts:evaluation.visibleCount,reward:evaluation.reward,cooldown:BALANCE.spec.graphics[p.specs.graphics]!.shotCooldownSeconds*1000,checks:desktopConditions(state),shotCount:activeScreenshots(state).length,shotBytes:activeScreenshots(state).reduce((sum,s)=>sum+screenshotBytes(s),0),fileCount:allFiles.length,wallTime:state.lastTickAt,managerShotRate:d.shotHistory.filter(h=>h.at>=state.lastTickAt-BALANCE.w3.historyMs).reduce((n,h)=>n+h.pixels,0)/(BALANCE.w3.historyMs/1000),managerTokenRate:d.feedback.filter(f=>f.completedAt!==null&&f.completedAt>=state.lastTickAt-BALANCE.w3.historyMs).reduce((n,f)=>n+(f.reward??BALANCE.w3.feedbackTokens),0)/(BALANCE.w3.historyMs/60000)},
    desktop:{apps:d.apps,windows:d.windows,active:d.active,icons:d.icons,cooldownMs:d.cooldownMs,fileFolder:d.fileFolder,fileSelection:d.fileSelection,mailSelection:d.mailSelection,notice:d.notice,success:d.success,feedback},
    view:{preferences:{...p.desktopPrefs,lastShotId:0},photo:photoEdit,desktop:{upgrades,builtAt,jobs,workspace,workspaces,fileSort,fileDescending,fileSearch,largeIcons,mailFolder,photo:photoEdit,compare,trash:trash.slice(0,30),reservation,terminal,stalled,settingsPage,managerTab,managerProcess,calendarMonth}},
    appearance:{editor:editorStage(state),desktop:desktopStage(state)},screen:{...d.screen},note:p.productionNote??defaultNote(createI18n(language)),files,palette:[],
    workshop:workshopPresentation,editorCustomization:p.editorCustomization,editorSkills:p.editorSkills,page:state.run.seed.page,
    appProjects:Object.fromEntries(Object.entries(d.projects).filter(([id])=>d.editingApp===id||d.windows[id as keyof typeof d.windows].open&&!d.windows[id as keyof typeof d.windows].minimized).map(([id,project])=>[id,{...project,undo:[],redo:[],assemblyUndo:[],assemblyRedo:[]}])),editingApp:d.editingApp,
    common:{progress:p.progress,play:state.run.play,settingsPage:d.settingsPage},
  });
}
/** Historical rows can be inspected without rebuilding a home or a drawing document. */
export function frozenFiles(scene:CaptureScene,catalog:Screenshot[]):DesktopFile[] {
  return scene.files.map(({shotId,partId,...row})=>({...row,...(partId?{work:{kind:'part' as const,id:partId,name:null,at:row.at??0}}:{}),...(shotId===undefined?{}:{shot:catalog.find(s=>s.id===shotId)}),...(scene.selectedSetDocument&&row.id===`set:${scene.selectedSetDocument.id}`?{setDocument:scene.selectedSetDocument}:{})}));
}
