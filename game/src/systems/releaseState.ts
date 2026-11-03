import { BALANCE, type SpecKey } from '../config/balance';
import { isScreenshot, type Screenshot } from './desktopState';
import { isReleasePresentation, type ReleasePresentation } from './releasePresentation';
import { isFrozenWorkshopState, isEditorCustomization, type WorkshopState, type EditorCustomization } from './workshopState';

/** Published metadata is independent of the current game's part/catalog identifiers. */
export interface ProductScreen {
  pixels:number; built:string[]; cursors:number; specs:Record<SpecKey,number>;
  workshop?:WorkshopState; editorCustomization?:EditorCustomization; editorStage?:0|1|2; legacy?:boolean;
}
export interface ProductExport {kind:'icon'|'part';id:string;name:string|null;at:number}
export type ArchivedExport=ProductExport;
export interface ProductRecord {
  presentation?:ReleasePresentation;
  id:number;name:string|null;version:'v0.1'|'v1.0';releasedAt:number;author:string|null;
  generatedPixels:number;builtCount:number;revenue:number;
  screen:ProductScreen;exports:ProductExport[];
  screenshots?:Screenshot[];capture?:Screenshot;captureCatalog?:Screenshot[];screenshotBonus?:number;
}
export interface ShippingState {productId:number;elapsedMs:number;phase?:'store'|'shipping';storeElapsedMs?:number}
export interface GuideRecord {kind:'seed'|'kumiki'|'release';id:string;version:'v0.1'|'v1'|'v2'}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const amount=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const count=(x:unknown):x is number=>amount(x)&&Number.isSafeInteger(x);
const text=(x:unknown):x is string=>typeof x==='string';
const optionalName=(x:unknown)=>x===null||text(x);
const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(text)&&new Set(x).size===x.length;
const specKeys:SpecKey[]=['color','storage','memory','resolution','network','refresh','graphics'];
const frozenSpecCounts:Record<SpecKey,number>={color:4,storage:5,memory:5,resolution:4,network:3,refresh:4,graphics:4};
export function isProductScreen(s:unknown):s is ProductScreen {
  return obj(s)&&amount(s.pixels)&&count(s.cursors)&&strings(s.built)&&obj(s.specs)
    &&specKeys.every(key=>count((s.specs as Record<string,unknown>)[key])&&Number((s.specs as Record<string,unknown>)[key])<frozenSpecCounts[key])
    &&(s.workshop===undefined||isFrozenWorkshopState(s.workshop))&&(s.editorCustomization===undefined||isEditorCustomization(s.editorCustomization))
    &&(s.editorStage===undefined||[0,1,2].includes(s.editorStage as number))&&(s.legacy===undefined||typeof s.legacy==='boolean');
}
export function isProductRecord(x:unknown):x is ProductRecord {
  if(!obj(x)||!optionalName(x.name)||text(x.name)&&[...x.name].length>BALANCE.release.maxProductName||!count(x.id)||x.id<1
    ||!['v0.1','v1.0'].includes(String(x.version))||!amount(x.releasedAt)||!optionalName(x.author)||!amount(x.generatedPixels)||!count(x.builtCount)||!count(x.revenue)||!isProductScreen(x.screen))return false;
  if(!Array.isArray(x.exports)||!x.exports.every(e=>obj(e)&&['icon','part'].includes(String(e.kind))&&text(e.id)&&e.id.length>0&&optionalName(e.name)&&amount(e.at))||new Set(x.exports.map(e=>`${e.kind}:${e.id}`)).size!==x.exports.length)return false;
  if(x.screenshots!==undefined&&(!Array.isArray(x.screenshots)||x.screenshots.length>BALANCE.release.storeMaxScreenshots||!x.screenshots.every(isScreenshot)||new Set(x.screenshots.map(s=>s.id)).size!==x.screenshots.length))return false;
  if(x.capture!==undefined&&!isScreenshot(x.capture))return false;
  if(x.captureCatalog!==undefined&&(!Array.isArray(x.captureCatalog)||!x.captureCatalog.every(isScreenshot)||new Set(x.captureCatalog.map(s=>s.id)).size!==x.captureCatalog.length))return false;
  return (x.screenshotBonus===undefined||amount(x.screenshotBonus)&&x.screenshotBonus<=BALANCE.release.screenshotBonusMax)&&(x.presentation===undefined||isReleasePresentation(x.presentation));
}
/** Drop obsolete editable drawings and home layouts without changing a published ledger. */
export function normalizeArchivedProduct(value:unknown):ProductRecord {
  if(!obj(value)||!obj(value.screen))throw new Error('Invalid archived product');
  const s=value.screen;
  const screen:ProductScreen={pixels:s.pixels as number,built:s.built as string[],cursors:s.cursors as number,specs:s.specs as Record<SpecKey,number>,
    ...(s.workshop!==undefined?{workshop:s.workshop as WorkshopState}:{}),...(s.editorCustomization!==undefined?{editorCustomization:s.editorCustomization as EditorCustomization}:{}),
    ...(s.editorStage!==undefined?{editorStage:s.editorStage as 0|1|2}:{}),...(s.workshop===undefined?{legacy:true}:{}),
  };
  if(!Array.isArray(value.exports))throw new Error('Invalid archived exports');
  const exports=value.exports.map(e=>{if(!obj(e))throw new Error('Invalid archived export');return {kind:e.kind,id:e.id,name:e.name,at:e.at} as ProductExport;});
  const product={...value,screen,exports} as unknown as ProductRecord;
  if(!isProductRecord(product))throw new Error('Invalid archived product');
  return product;
}
export function isGuideArchive(x:unknown):x is GuideRecord[] {
  return Array.isArray(x)&&x.every(e=>obj(e)&&['seed','kumiki','release'].includes(String(e.kind))&&text(e.id)&&e.id.length>0&&e.id.length<=80&&['v0.1','v1','v2'].includes(String(e.version)))
    &&new Set(x.map(e=>`${e.version}:${e.kind}:${e.id}`)).size===x.length;
}
