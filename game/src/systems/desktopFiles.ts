import type { BuiltApp } from './desktopState';
import { hasUpgrade } from './desktopJobs';
import { productLabel } from '../content/products';
import type { I18n } from '../content/i18n';
import type { Drawing, ExportedWork } from './kumikiState';
import type { Screenshot } from './desktopState';
import type { GameState } from './state';
import { encodeCapture } from './desktopState';
export interface DesktopFile {
  id: string; kind: 'folder' | 'icon' | 'part' | 'home' | 'sketch' | 'note' | 'shot' | 'app'; appId?:BuiltApp; name: string;
  at: number | null; bytes: number; work?: ExportedWork; drawing?: Drawing; shot?: Screenshot;
}
export const byteSize = (value: unknown): number => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
const imageBytes=new WeakMap<Screenshot,{data:string;bytes:number}>();
export function screenshotBytes(shot:Screenshot):number {
  const cached=imageBytes.get(shot);if(cached?.data===shot.data)return cached.bytes;
  const bytes=byteSize(shot.data);imageBytes.set(shot,{data:shot.data,bytes});return bytes;
}
export const defaultNote = (i18n: I18n) => `${i18n.t('intro.note')}\n\n\n${i18n.t('note.memo')}`;
export function fileSize(bytes: number, i18n: I18n): string {
  return bytes < 1024 ? i18n.t('files.bytes',{count:bytes}) : bytes < 1024*1024 ? i18n.t('files.kilobytes',{size:i18n.rate(bytes/1024)}) : i18n.t('files.megabytes',{size:i18n.rate(bytes/(1024*1024))});
}
export function rawDesktopFiles(state: GameState, i18n: I18n, folder = state.run.desktop.fileFolder): DesktopFile[] {
  if (folder === 'screenshots') return state.persistent.screenshots.filter(s=>!s.deleted).map(shot => ({ id:`shot:${shot.id}`,kind:'shot',name:i18n.t('files.shot',{count:shot.id}),at:shot.at,bytes:screenshotBytes(shot),shot }));
  const exports = (works: ExportedWork[], prefix: string, version?: string): DesktopFile[] => works.map(work => {
    let name = work.name || i18n.t(work.kind === 'icon' ? `k.icon.${work.id as 'folder'}` : `k.part.${work.id as 'button'}`);
    if (version) name = i18n.t('files.archived',{name,version});
    return { id:`${prefix}:${work.kind}:${work.id}`,kind:work.kind,name,at:work.at,bytes:byteSize(work),work };
  });
  if (folder === 'exports') return [...exports(state.run.kumiki.exports,'current'),...state.persistent.products.flatMap(p => exports(p.exports,`product:${p.id}`,productLabel(i18n,p.name,i18n.t('release.prototype'))))];
  const latest=(times:(number|null)[])=>times.reduce<number|null>((result,value)=>value===null?result:Math.max(result??0,value),null);
  const exportDate=latest([...state.run.kumiki.exports,...state.persistent.products.flatMap(p=>p.exports)].map(w=>w.at));
  const screenshotDate=latest(state.persistent.screenshots.map(s=>s.at));
  return [
    ...Object.keys(state.run.desktop.projects??{}).map(app=>({id:`app:${app}`,kind:'app' as const,appId:app as BuiltApp,name:i18n.t('builder.document',{app:i18n.t(`desktop.app.${app as BuiltApp}`)}),at:state.run.desktop.builtAt[app]??null,bytes:byteSize(state.run.desktop.projects[app as BuiltApp])})),
    {id:'exports',kind:'folder',name:i18n.t('files.exports'),at:exportDate,bytes:0},
    {id:'screenshots',kind:'folder',name:i18n.t('files.screenshots'),at:screenshotDate,bytes:0},
    {id:'home',kind:'home',name:i18n.t('files.home'),at:state.persistent.homeUpdatedAt,bytes:byteSize(encodeCapture({built:state.run.kumiki.built,placed:state.run.kumiki.placed,design:state.run.kumiki.design}))},
    {id:'sketch',kind:'sketch',name:i18n.t('files.sketch'),at:state.persistent.sketchUpdatedAt,bytes:byteSize(state.persistent.artwork.sketchbook),drawing:state.persistent.artwork.sketchbook},
    {id:'note',kind:'note',name:i18n.t('desktop.app.note'),at:state.persistent.noteUpdatedAt,bytes:byteSize(state.persistent.productionNote ?? defaultNote(i18n))},
  ];
}

export function desktopFiles(state:GameState,i18n:I18n,folder=state.run.desktop.fileFolder):DesktopFile[] {
 const d=state.run.desktop;
 let files=rawDesktopFiles(state,i18n,folder).filter(file=>!d.trash?.some(t=>t.id===file.id));
 if(hasUpgrade(state,'search')&&d.fileSearch)files=files.filter(f=>f.name.toLocaleLowerCase().includes(d.fileSearch.trim().toLocaleLowerCase()));
 if(hasUpgrade(state,'sort')){
  const compare=(a:DesktopFile,b:DesktopFile)=>d.fileSort==='date'?(a.at??0)-(b.at??0):d.fileSort==='type'?a.kind.localeCompare(b.kind):a.name.localeCompare(b.name,i18n.language==='en-XA'?'en':i18n.language);
  files.sort((a,b)=>(d.fileDescending?-1:1)*compare(a,b));
 }
 return files;
}
