import type { I18n, MessageKey } from '../content/i18n';
import { eligibleBlueprintApps, blueprintDocument } from './appAssembly';
import { hasUpgrade } from './desktopJobs';
import type { BuiltApp, Screenshot } from './desktopState';
import type { ArchivedExport } from './releaseState';
import type { GameState } from './state';
import { isCompleteSetDocument, type SetDocument } from './workshopState';

/** A file is a projection of a saved document or album asset, never an app's upgrade list. */
export interface DesktopFile {
  id: string;
  kind: 'folder'|'icon'|'part'|'set'|'note'|'shot'|'app';
  name: string;
  at: number|null;
  bytes: number;
  edition?: 'current'|'archive';
  version?: SetDocument['version'];
  setDocument?: SetDocument;
  shot?: Screenshot;
  // Historical captures may contain these kinds; the live library does not create them.
  appId?: BuiltApp;
  work?: ArchivedExport;
}
export const byteSize = (value:unknown):number => new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const imageBytes = new WeakMap<Screenshot,{data:string;bytes:number}>();
export function screenshotBytes(shot:Screenshot):number {
  const cached=imageBytes.get(shot);
  if(cached?.data===shot.data)return cached.bytes;
  const bytes=byteSize(shot.data);
  imageBytes.set(shot,{data:shot.data,bytes});
  return bytes;
}
export const defaultNote = (i18n:I18n):string => `${i18n.t('intro.note')}\n\n\n${i18n.t('note.memo')}`;
export function fileSize(bytes:number,i18n:I18n):string {
  return bytes<1024?i18n.t('files.bytes',{count:bytes}):bytes<1024*1024?i18n.t('files.kilobytes',{size:i18n.rate(bytes/1024)}):i18n.t('files.megabytes',{size:i18n.rate(bytes/(1024*1024))});
}
export function documentFiles(state:GameState,i18n:I18n):DesktopFile[] {
  return state.persistent.setDocuments.filter(isCompleteSetDocument).map(document=>({
    id:`set:${document.id}`,
    kind:'set',
    name:state.run.workshop.groupPuzzle?i18n.t('group.toolDocument' as MessageKey,{tool:i18n.t(`ws.set.${document.set}` as MessageKey),version:document.version}):i18n.t('files.setDocumentVersionName',{name:i18n.t('ws.setDocument',{set:i18n.t(`ws.set.${document.set}` as MessageKey)}),version:document.version}),
    at:document.at,
    bytes:byteSize(document),
    edition:document.version===state.run.version?'current':'archive',
    setDocument:document,
  }));
}
export function rawDesktopFiles(state:GameState,i18n:I18n,folder=state.run.desktop.fileFolder):DesktopFile[] {
  const documents=documentFiles(state,i18n);
  const photos:DesktopFile[]=state.persistent.screenshots.filter(shot=>!shot.deleted).map(shot=>({
    id:`shot:${shot.id}`,kind:'shot',name:i18n.t('files.shot',{count:shot.id}),at:shot.at,bytes:screenshotBytes(shot),shot,
  }));
  if(folder==='screenshots')return photos;
  if(folder==='exports')return documents;
  const blueprints:DesktopFile[]=eligibleBlueprintApps(state).map(app=>({id:`blueprint:${state.run.version}:${app}`,kind:'app',appId:app,name:i18n.t('builder.document',{app:i18n.t(`desktop.app.${app}`)}),at:state.run.desktop.builtAt[app]??null,bytes:byteSize(blueprintDocument(state,app)),edition:'current',version:state.run.version}));
  const newest=(files:readonly DesktopFile[]):number|null=>files.reduce<number|null>((latest,file)=>file.at===null?latest:latest===null?file.at:Math.max(latest,file.at),null);
  return [
    {id:'note',kind:'note',name:i18n.t('desktop.app.note'),at:state.persistent.noteUpdatedAt,bytes:byteSize(state.persistent.productionNote??defaultNote(i18n))},
    ...documents,
    ...blueprints,
    {id:'exports',kind:'folder',name:i18n.t('files.sets'),at:newest(documents),bytes:0},
    {id:'screenshots',kind:'folder',name:i18n.t('files.screenshots'),at:newest(photos),bytes:0},
  ];
}
export function desktopFiles(state:GameState,i18n:I18n,folder=state.run.desktop.fileFolder):DesktopFile[] {
  const desktop=state.run.desktop;
  const query=hasUpgrade(state,'search')?desktop.fileSearch.trim().toLocaleLowerCase():'';
  const files=rawDesktopFiles(state,i18n,folder).filter(file=>!desktop.trash.some(item=>item.id===file.id)&&(!query||file.name.toLocaleLowerCase().includes(query)));
  if(!hasUpgrade(state,'sort'))return files;
  const direction=desktop.fileDescending?-1:1;
  const locale=i18n.language==='en-XA'?'en':i18n.language;
  return files.sort((a,b)=>direction*(desktop.fileSort==='date'?(a.at??0)-(b.at??0):desktop.fileSort==='type'?`${a.kind}:${a.edition??''}`.localeCompare(`${b.kind}:${b.edition??''}`):a.name.localeCompare(b.name,locale)));
}
