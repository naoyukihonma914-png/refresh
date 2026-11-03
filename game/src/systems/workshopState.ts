import { BALANCE, type EditorSkill } from '../config/balance';
import { SET_IDS, WORKSHOP_PARTS, getWorkshopPart, type UiSetId, type WorkshopPartId, type WorkshopRect } from '../content/workshopCatalog';
export type { EditorSkill } from '../config/balance';
export type { WorkshopRect } from '../content/workshopCatalog';
export const WORKSHOP_GUIDE_IDS = ['entered','place','elements','adjust','test','complete','export','wall','hint'] as const;
export type WorkshopGuideId = typeof WORKSHOP_GUIDE_IDS[number];
export type PanelPosition = 'left' | 'right' | 'top' | 'bottom';
export interface ComponentDesign {
  nativeColors?:boolean;
  color: string; textColor: string; radius: number; fontSize: number; shadow: boolean;
  titleAlign: 'start' | 'center' | 'end'; controlSide: 'start' | 'end';
  controlColors: Record<string,string>; controlSides: Record<string,'start'|'end'>;
  symbolShape: 'line' | 'square'; scrollbarWidth: number; arrows: boolean;
  separator: boolean; progressHeight: number; progressStyle: 'solid' | 'striped'; showPercent: boolean;
  motion: 'plain' | 'press' | 'smooth';
}
export interface EditorCustomization {
  nativeBackground?:boolean;
  accent: string; bandPosition: 'top' | 'bottom'; panelWidth: number;
  background: string; grid: boolean; gridSpacing: number; fontSize: number;
  docking: 'standard' | 'left' | 'right'; presets: ComponentDesign[];
  panelPositions: Record<'palette'|'tools'|'parts'|'info',PanelPosition>;
  panelWidths: Record<'palette'|'tools'|'parts',number>;
}
export interface PartProduction {
  step: 0|1|2|3|4; rect: WorkshopRect; elements: string[]; design: ComponentDesign;
  completedAt: number|null; exportedAt: number|null; tested: boolean;
}
export interface WorkshopHelpTarget {set:UiSetId;part?:WorkshopPartId}
export interface WorkshopState {
  /** UI hints are optional in historical workshop presentation documents. */
  helpTarget?:WorkshopHelpTarget|null;
  /** The layout era this version entered with; later upgrades reset inherited panel placement. */
  editorStageAtEntry?:0|1|2;
  assistance?: {part:WorkshopPartId|null;elapsedMs:number};
  entered: boolean; enteredAt: number; enterMs: number; purchasedSets: UiSetId[];
  parts: Partial<Record<WorkshopPartId,PartProduction>>; activePart: WorkshopPartId|null;
  view: 'workbench'|'settings'|'exports'; zoom: number; exitInspected: boolean;
  tokenDiscovered: boolean;
  guide: { seen: WorkshopGuideId[]; current: WorkshopGuideId|null; collapsed: boolean };
  lastActionAt: number;
}
export interface SetDocument {
  id: string; set: UiSetId; version: 'v0.1'|'v1'|'v2'; at: number;
  parts: Partial<Record<WorkshopPartId,PartProduction>>;
}
export const createComponentDesign = (): ComponentDesign => ({
  nativeColors:true,
  color: BALANCE.workshop.design.color, textColor: BALANCE.workshop.design.textColor,
  radius: BALANCE.workshop.design.radius, fontSize: BALANCE.workshop.design.fontSize,
  shadow: false, titleAlign: 'start', controlSide: 'end', controlColors: {}, controlSides: {},
  symbolShape: 'line', scrollbarWidth: BALANCE.workshop.design.scrollbarWidth, arrows: true,
  separator: true, progressHeight: BALANCE.workshop.design.progressHeight, progressStyle: 'solid', showPercent: true, motion: 'plain',
});
export const createEditorCustomization = (stage:0|1|2=0): EditorCustomization => ({
  nativeBackground:true,
  accent: BALANCE.workshop.customization.accent, bandPosition: 'top',
  panelWidth: BALANCE.workshop.customization.panelWidth, background: BALANCE.workshop.customization.background,
  grid: true, gridSpacing: BALANCE.workshop.customization.gridSpacing,
  fontSize: BALANCE.workshop.customization.fontSize, docking: 'standard', presets: [],
  panelPositions: stage===2?{ palette:'right',tools:'left',parts:'left',info:'bottom' }:{ palette:'left',tools:'right',parts:'right',info:'bottom' },
  panelWidths: { palette:BALANCE.workshop.customization.panelWidth,tools:BALANCE.workshop.customization.panelWidth,parts:BALANCE.workshop.customization.panelWidth },
});
export const createWorkshopState = (): WorkshopState => ({
  helpTarget:null,
  editorStageAtEntry:0,
  assistance:{part:null,elapsedMs:0},
  entered:false,enteredAt:0,enterMs:0,purchasedSets:[],parts:{},activePart:null,
  view:'workbench',zoom:1,exitInspected:false,tokenDiscovered:false,
  guide:{seen:[],current:null,collapsed:false},lastActionAt:0,
});
const record = (x:unknown):x is Record<string,unknown> => typeof x==='object'&&x!==null&&!Array.isArray(x);
const amount = (x:unknown):x is number => typeof x==='number'&&Number.isFinite(x)&&x>=0;
const between = (x:unknown,min:number,max:number):x is number => amount(x)&&x>=min&&x<=max;
const color = (x:unknown):x is string => typeof x==='string'&&/^#[\da-f]{6}$/i.test(x);
const unique = (x:unknown[]):boolean => new Set(x).size===x.length;
export function colorContrast(a:string,b:string):number {
  const light=(hex:string)=>{const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722;};
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
/** Undefined flags retain schema14's former default-vs-custom inference. */
export const usesNativeComponentColors=(design:ComponentDesign):boolean=>design.nativeColors??(design.color===BALANCE.workshop.design.color&&design.textColor===BALANCE.workshop.design.textColor&&Object.keys(design.controlColors).length===0);
export const usesNativeEditorBackground=(custom:Pick<EditorCustomization,'background'|'nativeBackground'>):boolean=>custom.nativeBackground??custom.background===BALANCE.workshop.customization.background;
export function effectiveEditorBackground(custom:Pick<EditorCustomization,'background'|'nativeBackground'>,stage:0|1|2=0):string {
  return usesNativeEditorBackground(custom)?BALANCE.workshop.customization.nativeBackgrounds[stage]:custom.background;
}
/** Apply a colour choice as one readable change, never through an invalid intermediate pair. */
export function adjustComponentDesign(current:ComponentDesign,patch:Partial<ComponentDesign>,palette:readonly string[]):ComponentDesign|null {
  const reset=patch.nativeColors===true;
  const touched=['color','textColor'].some(key=>Object.hasOwn(patch,key));
  const next:ComponentDesign={...current,...patch,
    controlColors:reset?{...patch.controlColors}:{...current.controlColors,...patch.controlColors},
    controlSides:{...current.controlSides,...patch.controlSides},
    ...(reset?{color:patch.color??BALANCE.workshop.design.color,textColor:patch.textColor??BALANCE.workshop.design.textColor}:{}),
    ...(touched&&!reset?{nativeColors:false}:{}),
  };
  if(!color(next.color)||!color(next.textColor))return null;
  const limit=BALANCE.workshop.design.minContrast;
  if(colorContrast(next.color,next.textColor)<limit&&Object.hasOwn(patch,'color')){
    const readable=palette.filter(candidate=>color(candidate)&&colorContrast(next.color,candidate)>=limit)
      .sort((a,b)=>colorContrast(next.color,b)-colorContrast(next.color,a))[0];
    if(!readable)return null;
    next.textColor=readable;
  }
  for(const [symbol,value] of Object.entries(next.controlColors)){
    if(!['minimize','maximize','close'].includes(symbol)||!color(value))return null;
    if(colorContrast(next.color,value)<limit)delete next.controlColors[symbol];
  }
  return isComponentDesign(next)?next:null;
}
export function isComponentDesign(x:unknown):x is ComponentDesign {
  if(!record(x)||!color(x.color)||!color(x.textColor)||colorContrast(x.color,x.textColor)<BALANCE.workshop.design.minContrast)return false;
  const d=BALANCE.workshop.design;
  return (x.nativeColors===undefined||typeof x.nativeColors==='boolean')&&between(x.radius,0,d.radiusMax)&&between(x.fontSize,d.fontSizeMin,d.fontSizeMax)
    && typeof x.shadow==='boolean'&&['start','center','end'].includes(x.titleAlign as string)
    && ['start','end'].includes(x.controlSide as string)&&['line','square'].includes(x.symbolShape as string)
    && between(x.scrollbarWidth,d.scrollbarMin,d.scrollbarMax)&&typeof x.arrows==='boolean'
    && typeof x.separator==='boolean'&&between(x.progressHeight,d.progressHeightMin,d.progressHeightMax)&&['solid','striped'].includes(x.progressStyle as string)
    && typeof x.showPercent==='boolean'&&['plain','press','smooth'].includes(x.motion as string)
    &&record(x.controlColors)&&Object.entries(x.controlColors).every(([k,v])=>['minimize','maximize','close'].includes(k)&&color(v)&&colorContrast(x.color as string,v)>=d.minContrast)
    &&record(x.controlSides)&&Object.entries(x.controlSides).every(([k,v])=>['minimize','maximize','close'].includes(k)&&['start','end'].includes(v as string));
}
export function isEditorCustomization(x:unknown):x is EditorCustomization {
  if(!record(x))return false;
  const c=BALANCE.workshop.customization;
  return (x.nativeBackground===undefined||typeof x.nativeBackground==='boolean')&&color(x.accent)&&color(x.background)&&['top','bottom'].includes(x.bandPosition as string)
    && between(x.panelWidth,c.panelMin,c.panelMax)&&typeof x.grid==='boolean'
    &&between(x.gridSpacing,c.gridMin,c.gridMax)&&between(x.fontSize,c.fontMin,c.fontMax)
    &&['standard','left','right'].includes(x.docking as string)&&Array.isArray(x.presets)
    &&x.presets.length<=c.maxPresets&&x.presets.every(isComponentDesign)
    &&record(x.panelPositions)&&['palette','tools','parts','info'].every(k=>['left','right','top','bottom'].includes((x.panelPositions as Record<string,unknown>)[k] as string))
    &&record(x.panelWidths)&&['palette','tools','parts'].every(k=>between((x.panelWidths as Record<string,unknown>)[k],c.panelMin,c.panelMax));
}
export function isWorkshopRect(x:unknown):x is WorkshopRect {
  if(!record(x))return false;
  const c=BALANCE.workshop.canvas;
  return amount(x.x)&&amount(x.y)&&between(x.width,c.minWidth,c.width)&&between(x.height,c.minHeight,c.height)
    &&x.x>=c.inset&&x.y>=c.inset&&x.x+x.width<=c.width-c.inset&&x.y+x.height<=c.height-c.inset;
}
export function workshopRectOnGrid(rect:WorkshopRect,resolution:number):boolean {
  const grid=BALANCE.workshop.canvas.resolutionGrid[resolution];
  return grid!==undefined&&[rect.x,rect.y,rect.width,rect.height].every(value=>Number.isFinite(value)&&value%grid===0);
}
/** Enlarged lettering needs enough room for the same real controls. */
export function minimumPartSize(id:WorkshopPartId,design?:ComponentDesign):{width:number;height:number} {
  const base=getWorkshopPart(id).minSize,scale=Math.max(1,(design?.fontSize??BALANCE.workshop.design.fontSize)/BALANCE.workshop.design.fontSize);
  return {width:Math.ceil(base.width*scale),height:Math.ceil(base.height*scale)};
}
export function isPartProduction(x:unknown,id:WorkshopPartId):x is PartProduction {
  if(!record(x)||![0,1,2,3,4].includes(x.step as number)||!isWorkshopRect(x.rect)||!isComponentDesign(x.design)
    ||!Array.isArray(x.elements)||!unique(x.elements)||typeof x.tested!=='boolean')return false;
  const descriptor=getWorkshopPart(id);
  const min=minimumPartSize(id,x.design);
  if(x.rect.width<min.width||x.rect.height<min.height)return false;
  if(!x.elements.every(e=>descriptor.elements.includes(e as string)))return false;
  if(Number(x.step)>=2&&!descriptor.elements.every(e=>(x.elements as unknown[]).includes(e)))return false;
  if(x.step===0&&(x.elements.length>0||x.tested))return false;
  if(x.step===4?(!amount(x.completedAt)||!x.tested):x.completedAt!==null||x.tested)return false;
  return x.exportedAt===null||x.step===4&&amount(x.exportedAt)&&x.exportedAt>=Number(x.completedAt);
}
export function isWorkshopHelpTarget(value:unknown):value is WorkshopHelpTarget {
 return record(value)&&SET_IDS.includes(value.set as UiSetId)&&(value.part===undefined||WORKSHOP_PARTS.some(part=>part.id===value.part&&part.set===value.set));
}
export function isWorkshopState(x:unknown):x is WorkshopState {
  if(record(x)&&x.helpTarget!==undefined&&x.helpTarget!==null&&!isWorkshopHelpTarget(x.helpTarget))return false;
  if(!record(x)||(x.editorStageAtEntry!==undefined&&![0,1,2].includes(x.editorStageAtEntry as number))||typeof x.entered!=='boolean'||!amount(x.enteredAt)||!between(x.enterMs,0,BALANCE.workshop.enterMs)
    ||!Array.isArray(x.purchasedSets)||!unique(x.purchasedSets)||!x.purchasedSets.every(s=>SET_IDS.includes(s as UiSetId))
    ||!record(x.parts)||!['workbench','settings','exports'].includes(x.view as string)
    ||!between(x.zoom,BALANCE.workshop.zoomMin,BALANCE.workshop.zoomMax)||typeof x.exitInspected!=='boolean'
    ||typeof x.tokenDiscovered!=='boolean'||!amount(x.lastActionAt)||!record(x.guide))return false;
  const entries=Object.entries(x.parts);
  if(!entries.every(([id,p])=>WORKSHOP_PARTS.some(d=>d.id===id)&&(x.purchasedSets as unknown[]).includes(getWorkshopPart(id as WorkshopPartId).set)&&isPartProduction(p,id as WorkshopPartId)))return false;
  if(x.activePart!==null&&(!WORKSHOP_PARTS.some(d=>d.id===x.activePart)||!x.parts[x.activePart as string]))return false;
  if(x.assistance!==undefined){
    const assistant=x.assistance;
    if(!record(assistant)||!amount(assistant.elapsedMs)||assistant.elapsedMs>=BALANCE.workshop.assistStepMs
      ||(assistant.part===null?assistant.elapsedMs!==0:typeof assistant.part!=='string'||!x.parts[assistant.part])
      ||assistant.elapsedMs>0&&assistant.part!==x.activePart)return false;
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const [aId,a]=entries[i] as [WorkshopPartId,PartProduction], [bId,b]=entries[j] as [WorkshopPartId,PartProduction];
    if(a.step>0&&b.step>0&&getWorkshopPart(aId).set===getWorkshopPart(bId).set&&!workshopPairValid(aId,a.rect,bId,b.rect))return false;
  }
  const g=x.guide;
  return Array.isArray(g.seen)&&unique(g.seen)&&g.seen.every(id=>WORKSHOP_GUIDE_IDS.includes(id as WorkshopGuideId))
    &&(g.current===null||g.seen.includes(g.current))&&typeof g.collapsed==='boolean';
}
/** The window perimeter contains its controls; it is not a filled sibling part. */
export function workshopPairValid(aId:WorkshopPartId,a:WorkshopRect,bId:WorkshopPartId,b:WorkshopRect):boolean {
 const contains=(outer:WorkshopRect,inner:WorkshopRect)=>inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.width<=outer.x+outer.width&&inner.y+inner.height<=outer.y+outer.height;
 if(aId==='common-frame')return contains(a,b);
 if(bId==='common-frame')return contains(b,a);
 return !rectsOverlap(a,b);
}
export const rectsOverlap=(a:WorkshopRect,b:WorkshopRect):boolean=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function isSetDocument(x:unknown):x is SetDocument {
  return record(x)&&typeof x.id==='string'&&SET_IDS.includes(x.set as UiSetId)&&['v0.1','v1','v2'].includes(x.version as string)
    &&amount(x.at)&&record(x.parts)&&Object.keys(x.parts).length>0
    &&Object.entries(x.parts).every(([id,p])=>WORKSHOP_PARTS.some(d=>d.id===id&&d.set===x.set)&&isPartProduction(p,id as WorkshopPartId)&&(p as PartProduction).step===4);
}
/** Partial exports are records, but do not satisfy a completed-set requirement. */
export function isCompleteSetDocument(document:SetDocument):boolean {
  return WORKSHOP_PARTS.filter(part=>part.set===document.set).every(part=>document.parts[part.id]?.step===4);
}
export const isEditorSkill=(x:unknown):x is EditorSkill=>BALANCE.workshop.skills.some(s=>s.id===x);
