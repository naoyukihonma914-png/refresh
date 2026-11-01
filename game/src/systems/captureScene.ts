import { LEGACY_DESKTOP } from './desktopGeometry';
import type { LogicalSize } from './viewport';
import { editorStage,desktopStage,type Appearance } from './appearance';
import type { DesktopPreferences, PhotoEdit } from './desktopState';
import { activeScreenshots } from './desktop';
import { createI18n } from '../content/i18n';
import { paletteFor } from '../content/kumikiArt';
import { availableIcons, drawingFor, exportable, targetFor } from './kumiki';
import { blankDrawing, type Drawing, type KumikiState } from './kumikiState';
import { createDesktopState, createDesktopPreferences, decodeCapture, encodeCapture, type DesktopState, type Feedback, type Screenshot } from './desktopState';
import { desktopConditions, screenshotParts, screenshotReward } from './desktop';
import { defaultNote, desktopFiles, screenshotBytes, type DesktopFile } from './desktopFiles';
import { passivePixelsPerSecond } from './economy';
import { BALANCE } from '../config/balance';
import { createInitialState, type GameState, type SeedState } from './state';

// Presentation format 1 is independent of the game/save schema and its purchase order.
// It contains only the visible documents and bounded list rows, never a GameState.
export interface Picture { size:number; frames:number[][] }
export type FrozenFile = Omit<DesktopFile,'work'|'drawing'|'shot'> & { picture?:Picture; shotId?:number; partId?:string };
export interface CaptureSceneV1 {
  version:1;
  display:{ resources:GameState['resources']; specs:GameState['persistent']['specs']; productName:string|null; runVersion:GameState['run']['version']; notation:'compact'|'scientific'; savedAt:number|null; rate:number; parts:number; reward:number; cooldown:number; checks:boolean[]; shotCount:number; shotBytes:number; fileCount:number };
  palette:string[];
  desktop:{apps:('files'|'mail')[];windows:Record<'tessera'|'note'|'files'|'mail',DesktopState['windows']['tessera']>;active:'tessera'|'note'|'files'|'mail'|null;icons:Record<'tessera'|'note'|'files'|'mail',{x:number;y:number}>;cooldownMs:number;fileFolder:DesktopState['fileFolder'];fileSelection:string|null;mailSelection:number|null;notice:number|null;success:number|null;feedback:(Omit<Feedback,'baseline'|'baselineColor'|'kind'>&{kind:'redraw'|'practice'|'color'|'screenshot'})[]};
  home:{ built:SeedState['built']; cursors:number; skills:GameState['persistent']['seedSkills']; appearance:GameState['persistent']['seedAppearance']; history:SeedState['history']; parts:KumikiState['built']; placed:KumikiState['placed']; design:KumikiState['design']; focus:boolean; interval:number; exportName:string; homeWindow:KumikiState['homeWindow']; rows:KumikiState['generationLog'] };
  editor:{ active:string; picture:Picture|null; target:number[]; documents:string[]; exported:string[]; ready:number; skills:GameState['persistent']['artwork']['skills']; modern:boolean; drift:KumikiState['drift']; guide:KumikiState['guide']['current'] };
  icons:Record<string,Picture>;
  wallpaper:Picture|null;
  note:string;
  files:FrozenFile[];
}
const picture = (d:Picture):Picture => ({size:d.size,frames:d.frames});
export function projectCaptureV1(state:GameState,language:string):CaptureSceneV1 {
  const d=state.run.desktop,k=state.run.kumiki,p=state.persistent;
  const filesVisible=d.windows.files.open&&!d.windows.files.minimized;
  const allFiles=filesVisible?desktopFiles(state,createI18n(language)):[];
  const visibleRows=Math.ceil((d.windows.files.height-100)/32)+1;
  const files=allFiles.filter((file,index)=>index<visibleRows||file.id===d.fileSelection).map(file=>{
    const {work,drawing,shot,...metadata}=file;
    return {...metadata,...(work?.kind==='icon'?{picture:picture(work)}:drawing?{picture:picture(drawing)}:{}),...(work?.kind==='part'?{partId:work.id}:{}),...(shot?{shotId:shot.id}:{})};
  });
  const selected=d.feedback.find(f=>f.id===d.mailSelection);
  const mailVisible=d.windows.mail.open&&!d.windows.mail.minimized;
  const shown=mailVisible?d.feedback.slice(-Math.ceil(d.windows.mail.height/50)-2):[];
  const feedback=d.feedback.filter(f=>f.completedAt===null||shown.includes(f)||f===selected||f.id===d.notice||f.id===d.success).map(({baseline:_baseline,baselineColor:_color,...view})=>view);
  const drawing=drawingFor(state,k.activeDrawing);
  const ready=exportable(state);
  const icons=Object.fromEntries(k.exports.filter(e=>e.kind==='icon'&&(e.id==='folder'||e.id==='mail')).map(e=>[e.id,picture(e)]));
  return structuredClone({version:1,
    display:{resources:state.resources,specs:p.specs,productName:p.productName,runVersion:state.run.version,notation:p.numberNotation,savedAt:state.lastSavedAt,rate:passivePixelsPerSecond(state),parts:10+['tessera','note',...d.apps].filter(id=>d.windows[id as keyof typeof d.windows]?.open&&!d.windows[id as keyof typeof d.windows]?.minimized).length*3+2+d.apps.length+(d.notice!==null||d.success!==null?1:0),reward:(state.run.desktop.jobs?screenshotReward(state):passivePixelsPerSecond(state)*(10+['tessera','note',...d.apps].filter(id=>d.windows[id as keyof typeof d.windows]?.open&&!d.windows[id as keyof typeof d.windows]?.minimized).length*3+2+d.apps.length+(d.notice!==null||d.success!==null?1:0))*.5*1.25**p.specs.resolution),cooldown:BALANCE.spec.graphics[p.specs.graphics]!.shotCooldownSeconds*1000,checks:state.run.desktop.jobs?desktopConditions(state):[1+d.apps.length>=6,d.feedback.filter(f=>f.completedAt!==null).length>=10,['folder','bin','clock','mail','photo','settings'].every(id=>k.exports.some(e=>e.kind==='icon'&&e.id===id)),false,false],shotCount:p.screenshots.length,shotBytes:p.screenshots.reduce((sum,s)=>sum+screenshotBytes(s),0),fileCount:allFiles.length},
    palette:paletteFor(p.specs.color),
    desktop:{apps:d.apps,windows:d.windows,active:d.active,icons:d.icons,cooldownMs:d.cooldownMs,fileFolder:d.fileFolder,fileSelection:d.fileSelection,mailSelection:d.mailSelection,notice:d.notice,success:d.success,feedback},
    home:{built:state.run.seed.built,cursors:state.run.seed.autoCursors,skills:p.seedSkills,appearance:p.seedAppearance,history:p.seedSkills.includes('history')?state.run.seed.history.slice(0,4):[],parts:k.built,placed:k.placed,design:k.design,focus:k.focus,interval:k.interval,exportName:k.exportName,homeWindow:k.homeWindow,rows:k.placed.includes('table')?k.generationLog.slice(-4):[]},
    editor:{active:k.activeDrawing,picture:drawing?picture(drawing):null,target:drawing?targetFor(state,k.activeDrawing,drawing.size):[],documents:availableIcons(state),exported:Object.entries(k.drawings).filter(([,v])=>v.exported).map(([id])=>id),ready:ready.icons.length+ready.parts.length,skills:p.artwork.skills,modern:p.artwork.modern,drift:k.drift,guide:k.guide.collapsed?null:k.guide.current},
    icons,wallpaper:p.artwork.wallpaper?picture(p.artwork.wallpaper):null,note:p.productionNote??defaultNote(createI18n(language)),files}) as CaptureSceneV1;
}
// New scene formats get a new projector/validator; keep V1 readable.


const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const text=(v:unknown):v is string=>typeof v==='string';
const nullableText=(v:unknown)=>v===null||text(v);
const list=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(text);
const pictureValid=(v:unknown):v is Picture=>record(v)&&[16,32,64,128].includes(v.size as number)&&Array.isArray(v.frames)&&v.frames.length>0&&v.frames.length<=2&&v.frames.every(f=>Array.isArray(f)&&f.length===(v.size as number)**2&&f.every(c=>Number.isInteger(c)&&c>=-1&&c<256));
// This list freezes format-1 identifiers. It intentionally does not read BALANCE or the game's validators.
const apps=['tessera','note','files','mail'];
const app=(v:unknown)=>text(v)&&apps.includes(v);
const stringIds=(v:unknown,ids:string[])=>list(v)&&v.every(id=>ids.includes(id));
const specLimits={color:4,resolution:4,refresh:4,memory:5,storage:5,network:3,graphics:4};
const seedIds=['border','save','color','font','layout','motion','kumiki'];
const partIds=['select','button','extensions','switch','slider','input','frame','taskbar','tabs','table'];
const seedSkills=['keyboard','history','pattern','inherit','hold','marquee'];
const editorSkills=['fill','mirror','layers','eyedropper','expand','snap','outline','animation','extraParts','wallpaper','modern'];
const documents=['folder','bin','clock','mail','photo','settings','document','image','music','video','archive','text','chart','terminal','link','star','free'];
export function isCaptureSceneV1(value:unknown):value is CaptureSceneV1 {
  if(!record(value)||value.version!==1)return false;
  const {display:d,desktop:w,home:h,editor:e,icons,wallpaper,note,files,palette}=value;
  if(!record(d)||!record(w)||!record(h)||!record(e)||!record(icons)||!text(note)||!Array.isArray(files))return false;
  if(!record(d.resources)||!['pixels','tokens','dollars'].every(k=>num((d.resources as Record<string,unknown>)[k]))||!record(d.specs)||!Object.entries(specLimits).every(([k,limit])=>Number.isInteger((d.specs as Record<string,unknown>)[k])&&num((d.specs as Record<string,unknown>)[k])&&((d.specs as Record<string,number>)[k]??limit)<limit))return false;
  if(!['v0.1','v1','v2'].includes(d.runVersion as string)||!nullableText(d.productName)||!['compact','scientific'].includes(d.notation as string)||!(d.savedAt===null||num(d.savedAt))||!['rate','parts','reward','cooldown','shotCount','shotBytes','fileCount'].every(k=>num(d[k]))||!Array.isArray(d.checks)||d.checks.length!==5||!d.checks.every(c=>typeof c==='boolean')||!list(palette)||palette.length<16||palette.length>256||!palette.every(c=>/^#[0-9a-f]{6}$/i.test(c)))return false;
  if(!stringIds(w.apps,['files','mail'])||!record(w.windows)||!record(w.icons)||!(w.active===null||app(w.active))||!num(w.cooldownMs)||!['root','exports','screenshots'].includes(w.fileFolder as string)||!nullableText(w.fileSelection)||!(w.mailSelection===null||num(w.mailSelection)))return false;
  for(const id of apps){
    const b=w.windows[id],p=w.icons[id];
    if(!record(b)||!num(b.width)||b.width<=0||b.width>1920||!num(b.height)||b.height<=0||b.height>1032||!['x','y','width','height','z'].every(k=>num(b[k]))||!['open','minimized','maximized'].every(k=>typeof b[k]==='boolean')||!record(p)||!num(p.x)||!num(p.y))return false;
  }
  if(!Array.isArray(w.feedback)||w.feedback.length>40||!w.feedback.every(f=>record(f)&&num(f.id)&&['redraw','practice','color','screenshot'].includes(f.kind as string)&&(['redraw','practice'].includes(f.kind as string)?documents.filter(id=>id!=='free').includes(f.target as string):f.target===(f.kind==='color'?'primary':''))&&num(f.at)&&(f.completedAt===null||num(f.completedAt))&&['hikari','ren','maki'].includes(f.sender as string)))return false;
  if(![w.notice,w.success,w.mailSelection].every(id=>id===null||(w.feedback as Record<string,unknown>[]).some(f=>f.id===id)))return false;
  if(!stringIds(h.built,seedIds)||!stringIds(h.parts,partIds)||!stringIds(h.placed,partIds)||!stringIds(h.skills,seedSkills)||!num(h.cursors)||!record(h.appearance)||!['none','dots','grid','diagonal'].includes(h.appearance.pattern as string)||typeof h.appearance.marquee!=='boolean'||!record(h.design)||typeof h.focus!=='boolean'||!num(h.interval)||!text(h.exportName)||!['normal','minimized','maximized','closed'].includes(h.homeWindow as string))return false;
  if(!Object.values(h.design).every(v=>record(v)&&text(v.color)&&/^#[0-9a-f]{6}$/i.test(v.color)&&num(v.radius)&&['small','medium','large'].includes(v.textSize as string)&&typeof v.shadow==='boolean'))return false;
  if(!Array.isArray(h.history)||h.history.length>4||!h.history.every(v=>record(v)&&text(v.item)&&['cursor',...seedIds].includes(v.item)&&num(v.at))||!Array.isArray(h.rows)||h.rows.length>4||!h.rows.every(v=>record(v)&&num(v.at)&&num(v.pixels)))return false;
  if(!documents.includes(e.active as string)||!(e.picture===null||pictureValid(e.picture))||!Array.isArray(e.target)||e.target.length>16384||!e.target.every(v=>Number.isInteger(v)&&v>=-1&&v<256)||!stringIds(e.documents,documents)||!stringIds(e.exported,documents)||!num(e.ready)||!stringIds(e.skills,editorSkills)||typeof e.modern!=='boolean'||!(e.guide===null||['entered','draw','complete','export','extensions','name','wall','hint'].includes(e.guide as string)))return false;
  if(e.picture&&e.target.length!==(e.picture as Picture).size**2)return false;
  if(e.drift!==null&&(!record(e.drift)||!partIds.includes(e.drift.part as string)||!['dx','dy','angle'].every(k=>typeof(e.drift as Record<string,unknown>)[k]==='number'&&Number.isFinite((e.drift as Record<string,unknown>)[k]))))return false;
  if(!Object.entries(icons).every(([id,p])=>['folder','mail'].includes(id)&&pictureValid(p))||!(wallpaper===null||pictureValid(wallpaper)))return false;
  return files.length<=40&&files.every(f=>record(f)&&text(f.id)&&text(f.name)&&['folder','icon','part','home','sketch','note','shot'].includes(f.kind as string)&&(f.at===null||num(f.at))&&num(f.bytes)&&(f.picture===undefined||pictureValid(f.picture))&&(f.shotId===undefined||num(f.shotId))&&(f.partId===undefined||partIds.includes(f.partId as string)));
}
const decoded=new WeakMap<Screenshot,{data:string;id:number;scene:CaptureScene}>();
export function readCapture(shot:Screenshot):CaptureScene {
  const cached=decoded.get(shot);if(cached?.data===shot.data&&cached.id===shot.id)return cached.scene;
  const scene=decodeCapture(shot.data);
  if(!isCaptureScene(scene)||scene.files.some(f=>f.shotId!==undefined&&f.shotId>=shot.id)||scene.version!==1&&[scene.view.photo.source,scene.view.preferences.wallpaper?.source].some(source=>source?.startsWith('shot:')&&Number(source.slice(5))>=shot.id))throw new Error('Invalid screenshot scene');
  decoded.set(shot,{data:shot.data,id:shot.id,scene});return scene;
}
export function encodeScene(scene:CaptureScene):string {
  if(!isCaptureScene(scene))throw new Error('Invalid screenshot scene');
  return encodeCapture(scene);
}
export function restoreScene(shot:Screenshot,catalog:Screenshot[]):GameState {
  const s=readCapture(shot),state=createInitialState(shot.at),k=state.run.kumiki;
  const drawing=(p:Picture):Drawing=>({...blankDrawing(p.size),frames:p.frames,dirty:false});
  state.resources=s.display.resources;state.lastSavedAt=s.display.savedAt;state.run.version=s.display.runVersion;state.run.world='desktop';state.run.totalPixelsGenerated=state.resources.pixels;
  state.persistent.specs=s.display.specs;state.persistent.productName=s.display.productName;state.persistent.numberNotation=s.display.notation;
  state.persistent.seedSkills=s.home.skills;state.persistent.seedAppearance=s.home.appearance;state.run.seed.built=s.home.built;state.run.seed.autoCursors=s.home.cursors;state.run.seed.history=s.home.history;
  state.run.kumiki={...k,entered:true,activeDrawing:s.editor.active,built:s.home.parts,placed:s.home.placed,design:s.home.design,focus:s.home.focus,interval:s.home.interval,exportName:s.home.exportName,homeWindow:s.home.homeWindow,generationLog:s.home.rows,drift:s.editor.drift,guide:{...k.guide,seen:[...new Set(['entered' as const,...(s.editor.guide?[s.editor.guide]:[])])],current:s.editor.guide,collapsed:s.editor.guide===null}};
  for(const id of s.editor.documents){if(id!=='free')state.run.kumiki.drawings[id]={...blankDrawing(s.editor.picture?.size??16),exported:s.editor.exported.includes(id)};}
  if(s.editor.picture){if(s.editor.active==='free')state.persistent.artwork.sketchbook=drawing(s.editor.picture);else {state.run.kumiki.drawings[s.editor.active]=drawing(s.editor.picture);state.run.kumiki.underlays[s.editor.active]=drawing({size:s.editor.picture.size,frames:[s.editor.target]});}}
  state.persistent.artwork.skills=s.editor.skills;state.persistent.artwork.modern=s.editor.modern;state.persistent.artwork.wallpaper=s.wallpaper?drawing(s.wallpaper):null;
  state.run.kumiki.exports=Object.entries(s.icons).map(([id,p])=>({kind:'icon',id,name:null,at:shot.at,size:p.size,frames:p.frames}));
  state.persistent.productionNote=s.note;
  state.run.desktop={...createDesktopState(),...s.desktop,windows:{...createDesktopState().windows,...s.desktop.windows},icons:{...createDesktopState().icons,...s.desktop.icons},entered:true,feedbackSerial:Math.max(0,...s.desktop.feedback.map(f=>f.id)),feedback:s.desktop.feedback.map(f=>({...f,baseline:[],baselineColor:'#000000'}))};
  if(s.version!==1){state.persistent.desktopPrefs={...createDesktopPreferences(),...s.view.preferences};state.run.desktop={...state.run.desktop,...s.view.desktop};if(s.photoPicture)state.persistent.artwork.sketchbook=drawing(s.photoPicture);}
  if(s.version>=3)state.persistent.appearance={...(s as CaptureSceneV3).appearance};
  state.run.desktop.screen=s.version===4?{...s.screen}:{...LEGACY_DESKTOP};
  state.persistent.screenshots=catalog.filter(s=>s.id<shot.id);
  return state;
}
export function frozenFiles(scene:CaptureScene,catalog:Screenshot[]):DesktopFile[] {
  return scene.files.map(({picture:p,shotId,partId,...f})=>({...f,...(p?{drawing:{...blankDrawing(p.size),frames:p.frames},...(f.kind==='icon'?{work:{kind:'icon' as const,id:f.id.split(':').at(-1)!,name:null,at:f.at??0,size:p.size,frames:p.frames}}:{})}:{}),...(partId?{work:{kind:'part' as const,id:partId,name:null,at:f.at??0,size:0,frames:[]}}:{}),...(shotId?{shot:catalog.find(s=>s.id===shotId)}:{})}));
}

export interface CaptureSceneV2 extends Omit<CaptureSceneV1,'version'|'desktop'> {
 version:2;
 display:CaptureSceneV1['display']&{wallTime:number;managerShotRate:number;managerTokenRate:number};
 photoPicture:Picture|null;
 desktop:Omit<DesktopState,'screen'|'upgrades'|'builtAt'|'jobs'|'workspace'|'workspaces'|'fileSort'|'fileDescending'|'fileSearch'|'largeIcons'|'mailFolder'|'photo'|'compare'|'trash'|'recycled'|'trashCount'|'reservation'|'terminal'|'shotHistory'|'stalled'|'stalledClosed'|'stallMs'|'stallSerial'|'idleMs'|'settingsPage'|'managerTab'|'managerProcess'|'calendarMonth'|'feedback'> & {feedback:Omit<Feedback,'baseline'|'baselineColor'>[]};
 view:{preferences:DesktopPreferences;desktop:Pick<DesktopState,'upgrades'|'builtAt'|'jobs'|'workspace'|'workspaces'|'fileSort'|'fileDescending'|'fileSearch'|'largeIcons'|'mailFolder'|'photo'|'compare'|'trash'|'reservation'|'terminal'|'stalled'|'settingsPage'|'managerTab'|'managerProcess'|'calendarMonth'>;photo:PhotoEdit};
}
export type CaptureScene=CaptureSceneV1|CaptureSceneV2|CaptureSceneV3|CaptureSceneV4;
export function projectCaptureV2(state:GameState,language:string):CaptureSceneV2 {
 const d=state.run.desktop;
 // V1's document projection remains shared, while the V2 desktop has its own contract.
 const base=projectCaptureV1(state,language);
 const {upgrades,builtAt,jobs,workspace,workspaces,fileSort,fileDescending,fileSearch,largeIcons,mailFolder,photo,compare,trash,reservation,terminal,stalled,settingsPage,managerTab,managerProcess,calendarMonth}=d;
 return structuredClone({...base,files:base.files.map(f=>{if(f.id===d.fileSelection)return f;const {shotId:_id,...row}=f;return row;}),version:2,photoPicture:d.windows.photo.open&&!d.windows.photo.minimized&&d.photo.source==='sketch'?picture(state.persistent.artwork.sketchbook):null,
  display:{...base.display,parts:screenshotParts(state),reward:screenshotReward(state),rate:passivePixelsPerSecond(state),checks:desktopConditions(state),shotCount:activeScreenshots(state).length,wallTime:state.lastTickAt,managerShotRate:d.shotHistory.filter(h=>h.at>=state.lastTickAt-BALANCE.w3.historyMs).reduce((n,h)=>n+h.pixels,0)/(BALANCE.w3.historyMs/1000),managerTokenRate:d.feedback.filter(f=>f.completedAt!==null&&f.completedAt>=state.lastTickAt-BALANCE.w3.historyMs).reduce((n,f)=>n+(f.reward??BALANCE.w3.feedbackTokens),0)/(BALANCE.w3.historyMs/60000)},
  icons:Object.fromEntries(state.run.kumiki.exports.filter(e=>e.kind==='icon'&&['folder','bin','clock','mail','photo','settings'].includes(e.id)).map(e=>[e.id,picture(e)])),
  desktop:{entered:true,enteredAt:0,apps:d.apps,windows:d.windows,active:d.active,icons:d.icons,feedbackMs:0,feedbackSerial:d.feedbackSerial,cooldownMs:d.cooldownMs,fileFolder:d.fileFolder,fileSelection:d.fileSelection,mailSelection:d.mailSelection,notice:d.notice,success:d.success,feedback:base.desktop.feedback},
  view:{preferences:{...state.persistent.desktopPrefs,lastShotId:0},desktop:{upgrades,builtAt,jobs,workspace,workspaces,fileSort,fileDescending,fileSearch,largeIcons,mailFolder,photo,compare,trash:trash.slice(0,30),reservation,terminal,stalled,settingsPage,managerTab,managerProcess,calendarMonth},photo}});
}
// These identifiers and limits belong to scene format 2. Do not use the save validator here.
const apps2=['tessera','note','files','mail','manager','photo','bin','clock','theme','terminal','settings'];
const upgrades2=['files','sort','mail','draft','jobs','manager','search','large','photo','crop','compare','bin','undo','folders','clock','timer','calendar','theme','slideshow','iconSize','terminal'];
const skills2=['snap','direct','burst','daylight','posts','sortMail','virtual','screensaver','autoFeedback'];
const photo2=(v:unknown)=>record(v)&&text(v.source)&&/^(coast|night|sketch|shot:[1-9][0-9]*)$/.test(v.source)&&typeof v.brightness==='number'&&v.brightness>=.5&&v.brightness<=1.5&&typeof v.tone==='number'&&v.tone>=-50&&v.tone<=50&&num(v.crop)&&v.crop<=40;
function isCaptureSceneV2(v:unknown):v is CaptureSceneV2 {
 if(!record(v)||v.version!==2||!record(v.desktop)||!record(v.view)||!record(v.icons))return false;
 const d=v.desktop,w=v.view,ex=w.desktop,p=w.preferences;
 if(!record(ex)||!record(p)||!record(d.windows)||!record(d.icons)||!Array.isArray(d.feedback)||!stringIds(d.apps,apps2.filter(id=>!['tessera','note','settings'].includes(id)))||!(d.active===null||apps2.includes(d.active as string)))return false;
 // Validate all unchanged documents with the immutable V1 validator.
 const oldFeedback=d.feedback.filter(f=>record(f)&&['redraw','practice','color','screenshot'].includes(f.kind as string));
 const legacy={...v,version:1,icons:Object.fromEntries(Object.entries(v.icons).filter(([id])=>['folder','mail'].includes(id))),desktop:{...d,apps:[],active:null,feedback:oldFeedback,notice:null,success:null,mailSelection:null}};
 if(!(v.photoPicture===null||pictureValid(v.photoPicture))||!isCaptureSceneV1(legacy)||!Object.entries(v.icons).every(([id,img])=>documents.includes(id)&&pictureValid(img)))return false;
 for(const id of apps2){const b=d.windows[id],ip=d.icons[id];if(!record(b)||!['x','y','width','height','z'].every(k=>num(b[k]))||!['open','minimized','maximized'].every(k=>typeof b[k]==='boolean')||!record(ip)||!num(ip.x)||!num(ip.y))return false;}
 if(d.feedback.length>40||!d.feedback.every(f=>record(f)&&num(f.id)&&['redraw','practice','color','screenshot','sort','search','bright','trash','timer','dark'].includes(f.kind as string)&&text(f.target)&&num(f.at)&&(f.completedAt===null||num(f.completedAt))&&['hikari','ren','maki'].includes(f.sender as string)))return false;
 if(![d.notice,d.success,d.mailSelection].every(id=>id===null||(d.feedback as Record<string,unknown>[]).some(f=>f.id===id)))return false;
 if(!record(ex.builtAt)||!Object.entries(ex.builtAt).every(([id,at])=>(id==='desktop'||upgrades2.includes(id))&&num(at)))return false;
 if(!stringIds(ex.upgrades,upgrades2)||!record(ex.jobs)||!['tessera','files','photo','terminal'].every(id=>{const j=(ex.jobs as Record<string,unknown>)[id];return record(j)&&typeof j.assigned==='boolean'&&num(j.cursors)&&num(j.updates);})||!record(ex.workspaces)||!apps2.every(id=>[0,1].includes((ex.workspaces as Record<string,unknown>)[id] as number))||![0,1].includes(ex.workspace as number))return false;
 if(!stringIds(p.skills,skills2)||!stringIds(p.disabled,skills2)||!['light','dark'].includes(p.mode as string)||!text(p.accent)||!/^#[0-9a-f]{6}$/i.test(p.accent)||!num(p.radius)||p.radius>8||![32,48,64].includes(p.iconSize as number)||typeof p.slideshow!=='boolean'||!(p.wallpaper===null||photo2(p.wallpaper))||!num(p.lastShotId)||!photo2(w.photo)||!photo2(ex.photo)||!record(v.display)||!num(v.display.wallTime)||!num(v.display.managerShotRate)||!num(v.display.managerTokenRate))return false;
 if(!['name','date','type'].includes(ex.fileSort as string)||typeof ex.fileDescending!=='boolean'||!text(ex.fileSearch)||typeof ex.largeIcons!=='boolean'||!['all','pending','completed'].includes(ex.mailFolder as string)||typeof ex.compare!=='boolean'||!Array.isArray(ex.trash)||ex.trash.length>30||!ex.trash.every(t=>record(t)&&text(t.id)&&num(t.at)&&num(t.reward)&&typeof t.first==='boolean'))return false;
 if(ex.reservation!==null&&(!record(ex.reservation)||!num(ex.reservation.at)||typeof ex.reservation.done!=='boolean'||ex.reservation.result!==undefined&&!['captured','skipped','expired'].includes(ex.reservation.result as string)))return false;
 const t=ex.terminal;
 return ['processes','performance'].includes(ex.managerTab as string)&&['home','shots','feedback','tessera','files','photo','terminal'].includes(ex.managerProcess as string)&&(ex.calendarMonth===null||num(ex.calendarMonth))&&record(t)&&[60000,3600000].includes(t.interval as number)&&typeof t.running==='boolean'&&num(t.elapsedMs)&&num(t.executions)&&Array.isArray(t.log)&&t.log.length<=20&&t.log.every(l=>record(l)&&num(l.at)&&typeof l.ok==='boolean')&&(ex.stalled===null||apps2.includes(ex.stalled as string))&&['skills','data','specs','general'].includes(ex.settingsPage as string);
}
export function isCaptureScene(value:unknown):value is CaptureScene {return isCaptureSceneV1(value)||isCaptureSceneV2(value)||isCaptureSceneV3(value)||isCaptureSceneV4(value);}

// Format 3 records the selected visual stages. Older formats keep their own readers.
export interface CaptureSceneV3 extends Omit<CaptureSceneV2,'version'> {version:3;appearance:Appearance}
function projectCaptureV3(state:GameState,language:string):CaptureSceneV3 {
 return {...projectCaptureV2(state,language),version:3,appearance:{editor:editorStage(state),desktop:desktopStage(state)}};
}
function isCaptureSceneV3(v:unknown):v is CaptureSceneV3 {
 if(!record(v)||v.version!==3||!record(v.appearance)||![v.appearance.editor,v.appearance.desktop].every(stage=>[0,1,2].includes(stage as number))||!record(v.editor)||!record(v.view)||!record(v.view.preferences))return false;
 const e=v.editor,p=v.view.preferences;
 if(typeof p.radiusCustom!=='boolean'||!stringIds(e.skills,[...editorSkills,'update'])||!stringIds(p.skills,[...skills2,'major1','major2'])||!stringIds(p.disabled,skills2))return false;
 return isCaptureSceneV2({...v,version:2,editor:{...e,skills:(e.skills as string[]).filter(id=>id!=='update')},view:{...v.view,preferences:{...p,skills:(p.skills as string[]).filter(id=>!['major1','major2'].includes(id))}}});
}

// Format 4 keeps the logical size of the photographed desktop, including 4:3 scenes.
export interface CaptureSceneV4 extends Omit<CaptureSceneV3,'version'> {version:4;screen:LogicalSize}
export function projectCapture(state:GameState,language:string):CaptureSceneV4 {
 return {...projectCaptureV3(state,language),version:4,screen:{...state.run.desktop.screen}};
}
function isCaptureSceneV4(v:unknown):v is CaptureSceneV4 {
 if(!record(v)||v.version!==4||!record(v.screen)||![[800,600],[1024,768],[1366,768]].some(([w,h])=>v.screen&&record(v.screen)&&v.screen.width===w&&v.screen.height===h))return false;
 if(!isCaptureSceneV3({...v,version:3})||!record(v.desktop)||!record(v.desktop.windows)||!record(v.desktop.icons))return false;
 const width=v.screen.width as number,height=v.screen.height as number,work=height-(width===800?28:width===1024?30:40);
 return Object.values(v.desktop.windows).every(b=>record(b)&&Number(b.x)+Number(b.width)<=width&&Number(b.y)+Number(b.height)<=work)&&Object.values(v.desktop.icons).every(p=>record(p)&&Number(p.x)<=width-80&&Number(p.y)<=work-76);
}
