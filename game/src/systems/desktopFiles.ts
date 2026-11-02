import type { I18n,MessageKey } from '../content/i18n';
import { hasUpgrade } from './desktopJobs';
import type { BuiltApp,Screenshot } from './desktopState';
import type { ArchivedExport } from './releaseState';
import type { GameState } from './state';
import type { SetDocument } from './workshopState';
export interface DesktopFile {
  id: string; kind: 'folder'|'icon'|'part'|'set'|'note'|'shot'|'app'; appId?:BuiltApp; name: string;
  at: number|null; bytes:number; work?:ArchivedExport; shot?:Screenshot; setDocument?:SetDocument;
}
export const byteSize=(value:unknown):number=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const imageBytes=new WeakMap<Screenshot,{data:string;bytes:number}>();
export function screenshotBytes(shot:Screenshot):number {
 const old=imageBytes.get(shot);if(old?.data===shot.data)return old.bytes;
 const bytes=byteSize(shot.data);imageBytes.set(shot,{data:shot.data,bytes});return bytes;
}
export const defaultNote=(i18n:I18n)=>`${i18n.t('intro.note')}\n\n\n${i18n.t('note.memo')}`;
export function fileSize(bytes:number,i18n:I18n):string {
 return bytes<1024?i18n.t('files.bytes',{count:bytes}):bytes<1024*1024?i18n.t('files.kilobytes',{size:i18n.rate(bytes/1024)}):i18n.t('files.megabytes',{size:i18n.rate(bytes/(1024*1024))});
}
export function rawDesktopFiles(state:GameState,i18n:I18n,folder=state.run.desktop.fileFolder):DesktopFile[] {
 if(folder==='screenshots')return state.persistent.screenshots.filter(s=>!s.deleted).map(shot=>({id:`shot:${shot.id}`,kind:'shot',name:i18n.t('files.shot',{count:shot.id}),at:shot.at,bytes:screenshotBytes(shot),shot}));
 const sets:DesktopFile[]=state.persistent.setDocuments.map(setDocument=>({id:`set:${setDocument.id}`,kind:'set',name:i18n.t('ws.setDocument',{set:i18n.t(`ws.set.${setDocument.set}` as MessageKey)}),at:setDocument.at,bytes:byteSize(setDocument),setDocument}));
 if(folder==='exports')return sets;
 const latest=(times:number[])=>times.length?Math.max(...times):null;
 return [
  ...sets,
  ...Object.keys(state.run.desktop.projects??{}).map(app=>({id:`app:${app}`,kind:'app' as const,appId:app as BuiltApp,name:i18n.t('builder.document',{app:i18n.t(`desktop.app.${app as BuiltApp}`)}),at:state.run.desktop.builtAt[app]??null,bytes:byteSize(state.run.desktop.projects[app as BuiltApp])})),
  {id:'exports',kind:'folder',name:i18n.t('files.exports'),at:latest(sets.flatMap(x=>x.at===null?[]:[x.at])),bytes:0},
  {id:'screenshots',kind:'folder',name:i18n.t('files.screenshots'),at:latest(state.persistent.screenshots.map(s=>s.at)),bytes:0},
  {id:'note',kind:'note',name:i18n.t('desktop.app.note'),at:state.persistent.noteUpdatedAt,bytes:byteSize(state.persistent.productionNote??defaultNote(i18n))},
 ];
}
export function desktopFiles(state:GameState,i18n:I18n,folder=state.run.desktop.fileFolder):DesktopFile[] {
 const d=state.run.desktop;let files=rawDesktopFiles(state,i18n,folder).filter(file=>!d.trash.some(t=>t.id===file.id));
 if(hasUpgrade(state,'search')&&d.fileSearch)files=files.filter(f=>f.name.toLocaleLowerCase().includes(d.fileSearch.trim().toLocaleLowerCase()));
 if(hasUpgrade(state,'sort'))files.sort((a,b)=>(d.fileDescending?-1:1)*(d.fileSort==='date'?(a.at??0)-(b.at??0):d.fileSort==='type'?a.kind.localeCompare(b.kind):a.name.localeCompare(b.name,i18n.language==='en-XA'?'en':i18n.language)));
 return files;
}
