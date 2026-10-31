import { createI18n } from '../content/i18n';
import { paletteFor } from '../content/kumikiArt';
import { availableIcons, drawingFor, exportable, targetFor } from './kumiki';
import { blankDrawing, type Drawing, type KumikiState } from './kumikiState';
import { createDesktopState, decodeCapture, encodeCapture, type DesktopState, type Feedback, type Screenshot } from './desktopState';
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
  desktop:Pick<DesktopState,'apps'|'windows'|'active'|'icons'|'cooldownMs'|'fileFolder'|'fileSelection'|'mailSelection'|'notice'|'success'> & {feedback:Omit<Feedback,'baseline'|'baselineColor'>[]};
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
    display:{resources:state.resources,specs:p.specs,productName:p.productName,runVersion:state.run.version,notation:p.numberNotation,savedAt:state.lastSavedAt,rate:passivePixelsPerSecond(state),parts:screenshotParts(state),reward:screenshotReward(state),cooldown:BALANCE.spec.graphics[p.specs.graphics]!.shotCooldownSeconds*1000,checks:desktopConditions(state),shotCount:p.screenshots.length,shotBytes:p.screenshots.reduce((sum,s)=>sum+screenshotBytes(s),0),fileCount:allFiles.length},
    palette:paletteFor(p.specs.color),
    desktop:{apps:d.apps,windows:d.windows,active:d.active,icons:d.icons,cooldownMs:d.cooldownMs,fileFolder:d.fileFolder,fileSelection:d.fileSelection,mailSelection:d.mailSelection,notice:d.notice,success:d.success,feedback},
    home:{built:state.run.seed.built,cursors:state.run.seed.autoCursors,skills:p.seedSkills,appearance:p.seedAppearance,history:p.seedSkills.includes('history')?state.run.seed.history.slice(0,4):[],parts:k.built,placed:k.placed,design:k.design,focus:k.focus,interval:k.interval,exportName:k.exportName,homeWindow:k.homeWindow,rows:k.placed.includes('table')?k.generationLog.slice(-4):[]},
    editor:{active:k.activeDrawing,picture:drawing?picture(drawing):null,target:drawing?targetFor(state,k.activeDrawing,drawing.size):[],documents:availableIcons(state),exported:Object.entries(k.drawings).filter(([,v])=>v.exported).map(([id])=>id),ready:ready.icons.length+ready.parts.length,skills:p.artwork.skills,modern:p.artwork.modern,drift:k.drift,guide:k.guide.collapsed?null:k.guide.current},
    icons,wallpaper:p.artwork.wallpaper?picture(p.artwork.wallpaper):null,note:p.productionNote??defaultNote(createI18n(language)),files});
}
// New scene formats get a new projector/validator; keep V1 readable.
export const projectCapture=projectCaptureV1;

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
export function isCaptureScene(value:unknown):value is CaptureSceneV1 {
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
const decoded=new WeakMap<Screenshot,{data:string;id:number;scene:CaptureSceneV1}>();
export function readCapture(shot:Screenshot):CaptureSceneV1 {
  const cached=decoded.get(shot);if(cached?.data===shot.data&&cached.id===shot.id)return cached.scene;
  const scene=decodeCapture(shot.data);
  if(!isCaptureScene(scene)||scene.files.some(f=>f.shotId!==undefined&&f.shotId>=shot.id))throw new Error('Invalid screenshot scene');
  decoded.set(shot,{data:shot.data,id:shot.id,scene});return scene;
}
export function encodeScene(scene:CaptureSceneV1):string {
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
  state.run.desktop={...createDesktopState(),...s.desktop,entered:true,feedbackSerial:Math.max(0,...s.desktop.feedback.map(f=>f.id)),feedback:s.desktop.feedback.map(f=>({...f,baseline:[],baselineColor:'#000000'}))};
  state.persistent.screenshots=catalog.filter(s=>s.id<shot.id);
  return state;
}
export function frozenFiles(scene:CaptureSceneV1,catalog:Screenshot[]):DesktopFile[] {
  return scene.files.map(({picture:p,shotId,partId,...f})=>({...f,...(p?{drawing:{...blankDrawing(p.size),frames:p.frames},...(f.kind==='icon'?{work:{kind:'icon' as const,id:f.id.split(':').at(-1)!,name:null,at:f.at??0,size:p.size,frames:p.frames}}:{})}:{}),...(partId?{work:{kind:'part' as const,id:partId,name:null,at:f.at??0,size:0,frames:[]}}:{}),...(shotId?{shot:catalog.find(s=>s.id===shotId)}:{})}));
}
