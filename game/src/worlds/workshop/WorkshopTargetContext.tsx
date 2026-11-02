import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { feedbackSubject, feedbackBodyText } from '../../content/feedback';
import { WORKSHOP_PARTS, type UiSetId, type WorkshopPartId } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import coast from '../../assets/wallpaper/coast.webp';
import night from '../../assets/wallpaper/night.webp';

export type TargetFileFolder = 'all' | 'sets' | 'exports';
export type TargetFileSort = 'name' | 'date' | 'type';
export interface TargetFileEntry { id:string; name:string; type:'set'|'part'|'shot'; date:number; set?:UiSetId; part?:WorkshopPartId; exported:boolean }
export interface TargetMailMessage { id:string; subject:string; body:string; sender:string; date:number }
export interface TargetPhotoSource { id:'coast'|'night'; src:string; label:string }
export interface TargetWallpaper { index:number; brightness:number; tone:number; crop:number }
export interface WorkshopTargetState {
  files:{selectedId:string|null;folder:TargetFileFolder;history:TargetFileFolder[];sort:TargetFileSort;ascending:boolean;query:string;large:boolean};
  mail:{selectedId:string|null;folder:'inbox'|'archive';readIds:string[];archivedIds:string[];draft:string;replyOpen:boolean};
  photo:{index:number;brightness:number;tone:number;crop:number;compare:boolean;wallpaper:TargetWallpaper|null};
  trash:{ids:string[];deletedIds:string[];lastEmptiedIds:string[];selectedId:string|null};
  foundation:{activeApp:'files'|'mail';selectedIcon:string|null;noticeRead:boolean;upgradeOpen:boolean};
}
const P=BALANCE.workshop.preview;
const PHOTO_SOURCE_IDS=['coast','night'] as const;
const wrapPhotoIndex=(index:number)=>((Math.trunc(index)%PHOTO_SOURCE_IDS.length)+PHOTO_SOURCE_IDS.length)%PHOTO_SOURCE_IDS.length;
export const createWorkshopTargetState=():WorkshopTargetState=>({
  files:{selectedId:null,folder:'all',history:[],sort:'name',ascending:true,query:'',large:false},
  mail:{selectedId:null,folder:'inbox',readIds:[],archivedIds:[],draft:'',replyOpen:false},
  photo:{index:0,brightness:P.brightnessNeutral,tone:P.initialValue,crop:P.rangeMax,compare:false,wallpaper:null},
  trash:{ids:[],deletedIds:[],lastEmptiedIds:[],selectedId:null},
  foundation:{activeApp:'files',selectedIcon:null,noticeRead:false,upgradeOpen:false},
});
export type TargetAction =
 | {type:'reset'} | {type:'file-select';id:string|null} | {type:'file-sort';key:TargetFileSort}
 | {type:'file-query';query:string} | {type:'file-large'} | {type:'file-folder';folder:TargetFileFolder} | {type:'file-back'}
 | {type:'mail-select';id:string} | {type:'mail-folder';folder:'inbox'|'archive'}
 | {type:'mail-read';id:string;read:boolean} | {type:'mail-archive';id:string;archive:boolean}
 | {type:'mail-draft';draft:string} | {type:'mail-reply';open:boolean}
 | {type:'photo-index';index:number} | {type:'photo-next';delta:number}
 | {type:'photo-value';key:'brightness'|'tone'|'crop';value:number} | {type:'photo-compare'} | {type:'photo-wallpaper'}
 | {type:'trash-file';id:string} | {type:'trash-select';id:string|null} | {type:'trash-restore';id:string} | {type:'trash-empty'} | {type:'trash-undo-empty'}
 | {type:'foundation-app';app:'files'|'mail'} | {type:'foundation-icon';id:string|null}
 | {type:'foundation-notice'} | {type:'foundation-upgrades'};
export function workshopTargetReducer(state:WorkshopTargetState,action:TargetAction):WorkshopTargetState {
 const f=state.files,m=state.mail,p=state.photo,b=state.foundation,bin=state.trash;
 switch(action.type){
  case 'reset':return createWorkshopTargetState();
  case 'file-select':return {...state,files:{...f,selectedId:action.id}};
  case 'file-sort':return {...state,files:{...f,sort:action.key,ascending:f.sort===action.key?!f.ascending:true}};
  case 'file-query':return {...state,files:{...f,query:action.query,selectedId:null}};
  case 'file-large':return {...state,files:{...f,large:!f.large}};
  case 'file-folder':return action.folder===f.folder?state:{...state,files:{...f,folder:action.folder,history:[...f.history,f.folder],selectedId:null,query:''}};
  case 'file-back':return {...state,files:{...f,folder:f.history.at(-1)??'all',history:f.history.slice(0,-1),selectedId:null,query:''}};
  case 'mail-select':return {...state,mail:{...m,selectedId:action.id,readIds:[...new Set([...m.readIds,action.id])]}};
  case 'mail-folder':return {...state,mail:{...m,folder:action.folder,selectedId:null}};
  case 'mail-read':return {...state,mail:{...m,readIds:action.read?[...new Set([...m.readIds,action.id])]:m.readIds.filter(id=>id!==action.id)}};
  case 'mail-archive':return {...state,mail:{...m,archivedIds:action.archive?[...new Set([...m.archivedIds,action.id])]:m.archivedIds.filter(id=>id!==action.id),selectedId:null}};
  case 'mail-draft':return {...state,mail:{...m,draft:action.draft}};
  case 'mail-reply':return {...state,mail:{...m,replyOpen:action.open}};
  case 'photo-index':if(!Number.isFinite(action.index))return state;return {...state,photo:{...p,index:wrapPhotoIndex(action.index)}};
  case 'photo-next':if(!Number.isFinite(action.delta))return state;return {...state,photo:{...p,index:wrapPhotoIndex(p.index+action.delta)}};
  case 'photo-value': {
   if(!Number.isFinite(action.value))return state;
   const min=action.key==='crop'?P.cropMin:P.rangeMin;
   return {...state,photo:{...p,[action.key]:Math.min(P.rangeMax,Math.max(min,action.value))}};
  }
  case 'photo-compare':return {...state,photo:{...p,compare:!p.compare}};
  case 'photo-wallpaper':return {...state,photo:{...p,wallpaper:{index:p.index,brightness:p.brightness,tone:p.tone,crop:p.crop}}};
  case 'trash-file':return bin.ids.includes(action.id)||bin.deletedIds.includes(action.id)?state:{...state,files:{...f,selectedId:null},trash:{...bin,ids:[...bin.ids,action.id],selectedId:action.id}};
  case 'trash-select':return {...state,trash:{...bin,selectedId:action.id}};
  case 'trash-restore':return {...state,files:{...f,selectedId:action.id},trash:{...bin,ids:bin.ids.filter(id=>id!==action.id),selectedId:null}};
  case 'trash-empty':return {...state,trash:{...bin,deletedIds:[...new Set([...bin.deletedIds,...bin.ids])],lastEmptiedIds:[...bin.ids],ids:[],selectedId:null}};
  case 'trash-undo-empty':return {...state,trash:{...bin,ids:[...new Set([...bin.ids,...bin.lastEmptiedIds])],deletedIds:bin.deletedIds.filter(id=>!bin.lastEmptiedIds.includes(id)),lastEmptiedIds:[]}};
  case 'foundation-app':return {...state,foundation:{...b,activeApp:action.app}};
  case 'foundation-icon':return {...state,foundation:{...b,selectedIcon:action.id}};
  case 'foundation-notice':return {...state,foundation:{...b,noticeRead:!b.noticeRead}};
  case 'foundation-upgrades':return {...state,foundation:{...b,upgradeOpen:!b.upgradeOpen}};
 }
}
export function targetFileEntries(s:GameState,i18n:I18n):TargetFileEntry[] {
 const entries:TargetFileEntry[]=s.persistent.setDocuments.map(setDoc=>({id:`set:${setDoc.id}`,name:`${i18n.t(`ws.set.${setDoc.set}`)} ${setDoc.version}`,type:'set',date:setDoc.at,set:setDoc.set,exported:Object.values(setDoc.parts).some(p=>p?.exportedAt!==null)}));
 for(const definition of WORKSHOP_PARTS){
  const production=s.run.workshop.parts[definition.id];if(!production)continue;
  entries.push({id:`part:${definition.id}`,name:i18n.t(definition.labelKey as MessageKey),type:'part',date:production.exportedAt??production.completedAt??s.run.workshop.enteredAt,set:definition.set,part:definition.id,exported:production.exportedAt!==null});
 }
 for(const shot of s.persistent.screenshots.filter(shot=>!shot.deleted))entries.push({id:`shot:${shot.id}`,name:i18n.t('files.shot',{count:shot.id}),type:'shot',date:shot.at,exported:true});
 return entries;
}
export function targetMailMessages(s:GameState,i18n:I18n):TargetMailMessage[] {
 const guides=s.run.workshop.guide.seen.map((id,index)=>({id:`guide:${id}`,subject:`${i18n.t('guide.title')} ${i18n.integer(index+1)}`,body:i18n.t(`ws.guide.${id}`),sender:i18n.t('guide.signature'),date:s.run.workshop.enteredAt}));
 const feedback=s.run.desktop.feedback.map(f=>({id:`feedback:${f.id}`,subject:feedbackSubject(f,i18n),body:feedbackBodyText(s,f,i18n),sender:i18n.t(`feedback.sender.${f.sender}`),date:f.at}));
 return [...guides,...feedback];
}
export function targetPhotoFilter(edit:Pick<TargetWallpaper,'brightness'|'tone'>):string {
 return `brightness(${edit.brightness/P.brightnessNeutral}) sepia(${Math.abs(edit.tone-P.initialValue)/P.initialValue}) hue-rotate(${edit.tone<P.initialValue?'180deg':'0deg'})`;
}
interface TargetActions {
 setFileSort:(key:TargetFileSort)=>void;setFileQuery:(query:string)=>void;toggleFileLarge:()=>void;selectFile:(id:string|null)=>void;openFolder:(folder:TargetFileFolder)=>void;back:()=>void;
 selectMail:(id:string)=>void;setMailFolder:(folder:'inbox'|'archive')=>void;markMailRead:(read:boolean,id?:string)=>void;archiveMail:(archive:boolean,id?:string)=>void;setDraft:(draft:string)=>void;openReply:(open?:boolean)=>void;
 nextPhoto:(delta?:number)=>void;selectPhoto:(index:number)=>void;setBrightness:(value:number)=>void;setTone:(value:number)=>void;setCrop:(value:number)=>void;toggleCompare:()=>void;applyWallpaper:()=>void;
 trashFile:(id?:string)=>void;selectTrashFile:(id:string|null)=>void;restoreFile:(id?:string)=>void;emptyTrash:()=>void;undoEmptyTrash:()=>void;
 selectFoundation:(app:'files'|'mail')=>void;selectFoundationIcon:(id:string|null)=>void;readNotice:()=>void;toggleUpgrade:()=>void;
}
export interface WorkshopTargetValue {
 files:WorkshopTargetState['files']&{entries:TargetFileEntry[];visible:TargetFileEntry[];selected:TargetFileEntry|null;used:number;capacity:number};
 mail:WorkshopTargetState['mail']&{messages:TargetMailMessage[];visible:TargetMailMessage[];selected:TargetMailMessage|null};
 photo:WorkshopTargetState['photo']&{sources:TargetPhotoSource[];current:TargetPhotoSource;filter:string;wallpaperSource:TargetPhotoSource|null};
 trash:WorkshopTargetState['trash']&{entries:TargetFileEntry[];selected:TargetFileEntry|null};
 foundation:WorkshopTargetState['foundation']&{wallpaper:TargetWallpaper|null};actions:TargetActions;
}
const TargetContext=createContext<WorkshopTargetValue|null>(null);
export function WorkshopTargetProvider({gameState,i18n,children}:{gameState:GameState;i18n:I18n;children:ReactNode}) {
 const [state,dispatch]=useReducer(workshopTargetReducer,undefined,createWorkshopTargetState);
 const runKey=`${gameState.createdAt}:${gameState.run.version}`,lastRun=useRef(runKey);
 useEffect(()=>{if(lastRun.current!==runKey){lastRun.current=runKey;dispatch({type:'reset'});}},[runKey]);
 const value=useMemo<WorkshopTargetValue>(()=>{
  const entries=targetFileEntries(gameState,i18n),f=state.files,m=state.mail,p=state.photo;
  const collator=new Intl.Collator(i18n.language==='en-XA'?'en':i18n.language);
  const hiddenIds=new Set([...state.trash.ids,...state.trash.deletedIds]);
  const visible=entries.filter(entry=>!hiddenIds.has(entry.id)&&(f.folder==='all'||f.folder==='sets'&&entry.type==='set'||f.folder==='exports'&&entry.exported)&&(!f.query||entry.name.toLocaleLowerCase().includes(f.query.toLocaleLowerCase()))).sort((a,b)=>{
   const order=f.sort==='date'?a.date-b.date:f.sort==='type'?collator.compare(a.type,b.type)||collator.compare(a.name,b.name):collator.compare(a.name,b.name);
   return (f.ascending?order:-order)||collator.compare(a.id,b.id);
  });
  const messages=targetMailMessages(gameState,i18n),mailVisible=messages.filter(message=>m.folder==='archive'?m.archivedIds.includes(message.id):!m.archivedIds.includes(message.id));
  const selectedMail=messages.find(message=>message.id===m.selectedId)??mailVisible[0]??null;
  const sources:TargetPhotoSource[]=[{id:'coast',src:coast,label:i18n.t('photo.coast')},{id:'night',src:night,label:i18n.t('photo.night')}];
  const selectedId=selectedMail?.id,selectedFile=entries.find(entry=>entry.id===f.selectedId&&!hiddenIds.has(entry.id))??visible[0]??null;
  const trashEntries=entries.filter(entry=>state.trash.ids.includes(entry.id));
  const selectedTrash=trashEntries.find(entry=>entry.id===state.trash.selectedId)??trashEntries[0]??null;
  const actions:TargetActions={
   setFileSort:key=>dispatch({type:'file-sort',key}),setFileQuery:query=>dispatch({type:'file-query',query}),toggleFileLarge:()=>dispatch({type:'file-large'}),selectFile:id=>dispatch({type:'file-select',id}),openFolder:folder=>dispatch({type:'file-folder',folder}),back:()=>dispatch({type:'file-back'}),
   selectMail:id=>dispatch({type:'mail-select',id}),setMailFolder:folder=>dispatch({type:'mail-folder',folder}),markMailRead:(read,id=selectedId)=>{if(id)dispatch({type:'mail-read',id,read});},archiveMail:(archive,id=selectedId)=>{if(id)dispatch({type:'mail-archive',id,archive});},setDraft:draft=>dispatch({type:'mail-draft',draft}),openReply:(open=true)=>dispatch({type:'mail-reply',open}),
   nextPhoto:(delta=1)=>dispatch({type:'photo-next',delta}),selectPhoto:index=>dispatch({type:'photo-index',index}),setBrightness:value=>dispatch({type:'photo-value',key:'brightness',value}),setTone:value=>dispatch({type:'photo-value',key:'tone',value}),setCrop:value=>dispatch({type:'photo-value',key:'crop',value}),toggleCompare:()=>dispatch({type:'photo-compare'}),applyWallpaper:()=>dispatch({type:'photo-wallpaper'}),
   trashFile:(id=selectedFile?.id)=>{if(id&&entries.some(entry=>entry.id===id))dispatch({type:'trash-file',id});},selectTrashFile:id=>dispatch({type:'trash-select',id}),restoreFile:(id=selectedTrash?.id)=>{if(id)dispatch({type:'trash-restore',id});},emptyTrash:()=>dispatch({type:'trash-empty'}),undoEmptyTrash:()=>dispatch({type:'trash-undo-empty'}),
   selectFoundation:app=>dispatch({type:'foundation-app',app}),selectFoundationIcon:id=>dispatch({type:'foundation-icon',id}),readNotice:()=>dispatch({type:'foundation-notice'}),toggleUpgrade:()=>dispatch({type:'foundation-upgrades'}),
  };
  return {files:{...f,entries,visible,selected:selectedFile,used:gameState.persistent.screenshots.filter(shot=>!shot.deleted).length,capacity:BALANCE.w3.baseShotCapacity*BALANCE.w3.storageCapacityMultiplier**gameState.persistent.specs.storage},mail:{...m,messages,visible:mailVisible,selected:selectedMail},photo:{...p,sources,current:sources[p.index]!,filter:p.compare?'none':targetPhotoFilter(p),wallpaperSource:p.wallpaper?sources[p.wallpaper.index]!:null},trash:{...state.trash,entries:trashEntries,selected:selectedTrash},foundation:{...state.foundation,wallpaper:p.wallpaper},actions};
 },[state,gameState,i18n]);
 return <TargetContext.Provider value={value}>{children}</TargetContext.Provider>;
}
export function useWorkshopTarget():WorkshopTargetValue {
 const target=useContext(TargetContext);
 if(!target)throw new Error('Workshop target controls require their shared provider');
 return target;
}
