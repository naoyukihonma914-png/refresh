import { productLabel } from '../content/products';
import type { I18n } from '../content/i18n';
import type { Drawing, ExportedWork } from './kumikiState';
import type { Screenshot } from './desktopState';
import type { GameState } from './state';
import { encodeCapture } from './desktopState';
export interface DesktopFile {
  id: string; kind: 'folder' | 'icon' | 'part' | 'home' | 'sketch' | 'note' | 'shot'; name: string;
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
export function desktopFiles(state: GameState, i18n: I18n, folder = state.run.desktop.fileFolder): DesktopFile[] {
  if (folder === 'screenshots') return state.persistent.screenshots.map(shot => ({ id:`shot:${shot.id}`,kind:'shot',name:i18n.t('files.shot',{count:shot.id}),at:shot.at,bytes:screenshotBytes(shot),shot }));
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
    {id:'exports',kind:'folder',name:i18n.t('files.exports'),at:exportDate,bytes:0},
    {id:'screenshots',kind:'folder',name:i18n.t('files.screenshots'),at:screenshotDate,bytes:0},
    {id:'home',kind:'home',name:i18n.t('files.home'),at:state.persistent.homeUpdatedAt,bytes:byteSize(encodeCapture({built:state.run.kumiki.built,placed:state.run.kumiki.placed,design:state.run.kumiki.design}))},
    {id:'sketch',kind:'sketch',name:i18n.t('files.sketch'),at:state.persistent.sketchUpdatedAt,bytes:byteSize(state.persistent.artwork.sketchbook),drawing:state.persistent.artwork.sketchbook},
    {id:'note',kind:'note',name:i18n.t('desktop.app.note'),at:state.persistent.noteUpdatedAt,bytes:byteSize(state.persistent.productionNote ?? defaultNote(i18n))},
  ];
}
