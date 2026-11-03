import { BALANCE } from '../config/balance';
import { homeButtonColor, paletteFor } from '../content/palette';
import { readableText } from './appLayout';
import type { GameState } from './state';
import { editorStage, type VisualStage } from './appearance';
import { effectiveEditorBackground, usesNativeEditorBackground, type EditorCustomization } from './workshopState';

export const PAGE_PARTS=['heading','notice','pixels','generator','cursors','upgrades'] as const;
export type PagePart=typeof PAGE_PARTS[number];
export const PAGE_PART_SIZES=['small','large','extraLarge'] as const;
export type PagePartSize=typeof PAGE_PART_SIZES[number];
export const PAGE_TEXT_SIZES=['small','normal','large'] as const;
export type PageTextSize=typeof PAGE_TEXT_SIZES[number];
export const PAGE_FONTS=['sans','serif','pixel','mono'] as const;
export type PageFont=typeof PAGE_FONTS[number];
export const PAGE_MOTIONS=['push','lift','fade'] as const;
export interface PageRect{x:number;y:number;width:number;height:number}
/** The generator rectangle is the button itself. Resources and parked cursors are peers. */
export interface PageLayout{width:number;height:number;parts:Record<PagePart,PageRect>}
export interface PageDesign {
 background:string|null;text:string|null;button:string|null;
 headingFont:PageFont;bodyFont:PageFont;motion:typeof PAGE_MOTIONS[number];heading:string;
 layout:PageLayout|null;partFonts:Record<PagePart,PageTextSize>;
 partColors?:Partial<Record<PagePart,{background:string|null;text:string|null}>>;
 fitted?:PagePart[];piecePositions?:Partial<Record<PagePart,{x:number;y:number}>>;
}
/** With the guide (お手本) on, seed parts arrive as pieces fitted into background recesses; all of them are out at once and can be fitted in any order. FIT_ORDER only orders the guidance hint. */
export const FIT_ORDER:PagePart[]=['heading','notice','upgrades','cursors'];
export const effectiveFitted=(page:PageDesign,examplesEnabled:boolean):PagePart[]=>!examplesEnabled?[...PAGE_PARTS]:page.fitted?[...page.fitted]:[...PAGE_PARTS];
export function piecesToFit(page:PageDesign,examplesEnabled:boolean,autoCursors:number):PagePart[] {
 if(!examplesEnabled)return [];const fitted=effectiveFitted(page,true);
 return FIT_ORDER.filter(id=>!fitted.includes(id)&&(id!=='cursors'||autoCursors>0));
}
export function nextPieceToFit(page:PageDesign,examplesEnabled:boolean,autoCursors:number):PagePart|null {
 return piecesToFit(page,examplesEnabled,autoCursors)[0]??null;
}
/** Display layout while pieces wait: each piece hovers beside its socket; fitted parts sit at their layout rects. */
export function socketLayout(page:PageDesign,base:PageLayout,examplesEnabled:boolean,autoCursors:number):PageLayout {
 const pieces=piecesToFit(page,examplesEnabled,autoCursors);if(!pieces.length)return base;
 const parts={...base.parts},off=BALANCE.pageDesign.socketSpawnOffset;
 for(const piece of pieces){const socket=base.parts[piece],stored=page.piecePositions?.[piece];
  parts[piece]={...socket,x:stored?.x??Math.max(0,Math.min(base.width-socket.width,socket.x+off)),y:stored?.y??Math.max(0,Math.min(base.height-socket.height,socket.y+off))};}
 return {...base,parts};
}
export const pagePartColors=(page:PageDesign,id:PagePart):{background:string|null;text:string|null}=>page.partColors?.[id]??{background:null,text:null};
export const createPageDesign=():PageDesign=>({background:null,text:null,button:null,headingFont:'sans',bodyFont:'sans',motion:'push',heading:'',layout:null,partFonts:Object.fromEntries(PAGE_PARTS.map(id=>[id,'normal'])) as PageDesign['partFonts']});
export const pageFonts:Record<PageFont,string>={sans:"'Refresh Sans',sans-serif",serif:"'Refresh Serif',serif",pixel:"'Refresh Pixel',monospace",mono:"'Refresh Mono',monospace"};
export function contrast(a:string,b:string){const l=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i]!,0);const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function pageColors(page:PageDesign,color:number,editor?:Pick<EditorCustomization,'background'|'accent'|'nativeBackground'>,stage:VisualStage=0){const background=editor?effectiveEditorBackground(editor,stage):page.background??(color===0?'#c0c0c0':'#e8edf1'),button=page.button??editor?.accent??homeButtonColor(color),requested=page.text??readableText(background),text=contrast(background,requested)>=4.5?requested:readableText(background);return {background,button,text,buttonText:readableText(button)};}
const config=BALANCE.pageDesign;
const snap=(n:number)=>Math.round(n/config.grid)*config.grid;
const down=(n:number)=>Math.floor(n/config.grid)*config.grid;
const up=(n:number)=>Math.ceil(n/config.grid)*config.grid;
export const pageMinimum=(id:PagePart)=>({width:config.minWidths[id],height:config.minHeights[id]});
export const pagePartFontSize=(page:PageDesign,id:PagePart):number=>config.partFontSizes[page.partFonts[id]];
const overlaps=(a:PageRect,b:PageRect)=>a.width>0&&a.height>0&&b.width>0&&b.height>0&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const onGrid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value%config.grid===0;
export function validPagePlacement(layout:PageLayout,id:PagePart,r:PageRect):boolean {
 const minimum=pageMinimum(id);
 return ['x','y','width','height'].every(key=>onGrid(r[key as keyof PageRect]))
  &&r.width>=minimum.width&&r.height>=minimum.height&&r.x+r.width<=layout.width&&r.y+r.height<=layout.height
  &&!PAGE_PARTS.some(other=>other!==id&&layout.parts[other]&&overlaps(r,layout.parts[other]));
}
export function recommendedPage(width:number=config.width,height:number=config.height):PageLayout {
 const gap=config.gap,w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width)));
 const compact=w<config.layoutBreakpoint,heights=compact?config.compactHeights:config.recommendedHeights;
 const pixelY=gap,headingY=pixelY+heights.pixels+gap,noticeY=headingY+heights.heading+gap,generatorY=noticeY+heights.notice+gap;
 // Empty room beneath the standard button lets the explicit XL choice grow in place.
 const cursorsY=generatorY+config.partSizes.generator.extraLarge.height+gap;
 const left=compact?gap:config.contentInset;
 const sidebar=compact?w-gap*2:up(Math.max(config.minWidths.upgrades,w*config.sidebarFraction));
 const main=compact?w-gap*2:w-sidebar-gap*2-left;
 const generatorWidth=Math.min(main,config.partSizes.generator.extraLarge.width);
 const parts:PageLayout['parts']={
  pixels:{x:gap,y:pixelY,width:w-gap*2,height:heights.pixels},
  heading:{x:left,y:headingY,width:main,height:heights.heading},
  notice:{x:left,y:noticeY,width:main,height:heights.notice},
  generator:{x:left+down((main-generatorWidth)/2),y:generatorY,width:generatorWidth,height:heights.generator},
  cursors:{x:left,y:cursorsY,width:main,height:heights.cursors},
  upgrades:compact?{x:gap,y:cursorsY+heights.cursors+gap,width:sidebar,height:heights.upgrades}
   :{x:left+main+gap,y:headingY,width:sidebar,height:up(Math.max(heights.upgrades,Math.min(config.maxHeight,height)-headingY-gap))},
 };
 return {width:w,height:up(Math.max(config.minCanvasHeight,Math.min(config.maxHeight,height),...PAGE_PARTS.map(id=>parts[id].y+parts[id].height+gap))),parts};
}
/** A deterministic bare page: building early milestones never shifts the press target. */
export function initialPageLayout(width:number=config.width,height:number=config.height):PageLayout {
 const gap=config.gap,w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width))),compact=w<config.layoutBreakpoint;
 const heights=compact?config.compactHeights:config.recommendedHeights,left=compact?gap:config.contentInset,main=w-left-gap;
 const headingY=gap+heights.pixels+gap,generatorY=headingY+heights.heading+gap;
 const cursorsY=generatorY+config.partSizes.generator.extraLarge.height+gap;
 const noticeY=cursorsY+heights.cursors+gap,upgradesY=noticeY+heights.notice+gap;
 const generatorWidth=Math.min(main,config.partSizes.generator.extraLarge.width);
 return {width:w,height:up(Math.max(config.minCanvasHeight,Math.min(config.maxHeight,height),upgradesY+heights.upgrades+gap)),parts:{
  pixels:{x:gap,y:gap,width:w-gap*2,height:heights.pixels},heading:{x:left,y:headingY,width:main,height:heights.heading},
  generator:{x:left+down((main-generatorWidth)/2),y:generatorY,width:generatorWidth,height:heights.generator},
  cursors:{x:left,y:cursorsY,width:main,height:heights.cursors},notice:{x:left,y:noticeY,width:main,height:heights.notice},
  upgrades:{x:left,y:upgradesY,width:main,height:heights.upgrades},
 }};
}
/** A layout converted by an older build can end up squeezed into one corner: parts span only part of the canvas, or the generate button shrank below the standard large preset. Such a layout is a conversion artifact, not a design choice. */
export function isCrampedPageLayout(layout:PageLayout):boolean {
 const left=Math.min(...PAGE_PARTS.map(id=>layout.parts[id].x)),right=Math.max(...PAGE_PARTS.map(id=>layout.parts[id].x+layout.parts[id].width));
 const generator=layout.parts.generator,large=config.partSizes.generator.large;
 return right-left<layout.width*.75||generator.width<large.width||generator.height<large.height;
}
export function isRecommendedPage(layout:PageLayout|null):boolean {
 if(layout===null)return true;
 const reference=recommendedPage(layout.width,layout.height);
 return PAGE_PARTS.every(id=>(['x','y','width','height'] as const).every(key=>layout.parts[id][key]===reference.parts[id][key]));
}
/** Bounded edge search keeps every other part unchanged. A full canvas rejects rather than overlaps. */
export function pagePlacementForSize(layout:PageLayout,id:PagePart,size:{width:number;height:number},anchor:Pick<PageRect,'x'|'y'>=layout.parts[id]):PageRect|null {
 const minimum=pageMinimum(id),width=up(Math.max(minimum.width,size.width)),height=up(Math.max(minimum.height,size.height));
 if(width>layout.width||height>layout.height)return null;
 const siblings=PAGE_PARTS.filter(other=>other!==id).map(other=>layout.parts[other]);
 const xs=new Set([snap(anchor.x),0,layout.width-width,...siblings.flatMap(r=>[r.x,r.x+r.width,r.x-width,r.x+r.width-width])]);
 const ys=new Set([snap(anchor.y),0,layout.height-height,...siblings.flatMap(r=>[r.y,r.y+r.height,r.y-height,r.y+r.height-height])]);
 const candidates=[...xs].flatMap(x=>[...ys].map(y=>({x,y,width,height}))).filter(r=>validPagePlacement(layout,id,r));
 candidates.sort((a,b)=>(a.x-anchor.x)**2+(a.y-anchor.y)**2-((b.x-anchor.x)**2+(b.y-anchor.y)**2)||a.y-b.y||a.x-b.x);
 return candidates[0]??null;
}
export function setPagePartSize(layout:PageLayout,part:PagePart,size:PagePartSize):PageLayout|null {
 const dimensions=config.partSizes[part][size],rect=pagePlacementForSize(layout,part,dimensions);
 return rect?{...layout,parts:{...layout.parts,[part]:rect}}:null;
}
export const canSetPagePartSize=(layout:PageLayout,part:PagePart,size:PagePartSize):boolean=>setPagePartSize(layout,part,size)!==null;
export function pagePartSize(layout:PageLayout,part:PagePart):PagePartSize|'custom' {
 const rect=layout.parts[part];return PAGE_PART_SIZES.find(size=>{const preset=config.partSizes[part][size];return rect.width===preset.width&&rect.height===preset.height;})??'custom';
}
/** Viewport adaptation uses the same per-part anchors before and after a customization. */
export function fitPageLayout(layout:PageLayout,width:number,height:number):PageLayout {
 const w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width))),h=Math.max(config.minCanvasHeight,Math.min(config.maxHeight,down(height)));
 const source=recommendedPage(layout.width,layout.height),reference=recommendedPage(w,h),compact=w<config.layoutBreakpoint;
 const same=(a:PageRect,b:PageRect)=>(['x','y','width','height'] as const).every(key=>a[key]===b[key]);
 const parts=Object.fromEntries(PAGE_PARTS.map(id=>{
  const r=layout.parts[id],before=source.parts[id],after=reference.parts[id],minimum=pageMinimum(id);
  let x=r.x===before.x?after.x:r.x===config.gap?config.gap:r.x===config.contentInset?(compact?config.gap:config.contentInset):snap(after.x+(r.x-before.x)*w/layout.width);
  x=Math.max(0,Math.min(w-minimum.width,x));
  // Unchanged stretch regions stay responsive; explicit sizes remain physical UI choices.
  const spansWidth=id!=='generator'&&r.x+r.width===layout.width-config.gap;
  const desiredWidth=r.width===before.width?after.width:spansWidth?w-x-config.gap:r.width;
  const partWidth=Math.min(w-x,up(Math.max(minimum.width,desiredWidth)));
  x=Math.max(0,Math.min(w-partWidth,x));
  const y=r.y===before.y?after.y:r.y;
  const partHeight=r.height===before.height?after.height:r.height;
  return [id,{x,y,width:partWidth,height:up(Math.max(minimum.height,partHeight))}];
 })) as PageLayout['parts'];
 const projected={width:w,height:Math.min(config.maxHeight,up(Math.max(h,...PAGE_PARTS.map(id=>parts[id].y+parts[id].height)))),parts};
 if(PAGE_PARTS.every(id=>validPagePlacement(projected,id,parts[id])))return projected;
 // A constrained viewport may relocate a changed part; unrelated defaults never switch projection paths.
 const repaired={...reference,parts:structuredClone(reference.parts)};
 const changed=PAGE_PARTS.filter(id=>!same(layout.parts[id],source.parts[id])).sort((a,b)=>layout.parts[a].y-layout.parts[b].y||layout.parts[a].x-layout.parts[b].x);
 for(const id of changed){
  const desired=parts[id],candidate=validPagePlacement(repaired,id,desired)?desired:pagePlacementForSize(repaired,id,desired,desired);
  if(candidate)repaired.parts[id]=candidate;
 }
 return repaired;
}

export function isPageDesign(value:unknown):value is PageDesign {
 if(!obj(value)||!['background','text','button'].every(key=>value[key]===null||typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key] as string))
  ||!PAGE_FONTS.includes(value.headingFont as PageFont)||!PAGE_FONTS.includes(value.bodyFont as PageFont)||!PAGE_MOTIONS.includes(value.motion as PageDesign['motion'])||typeof value.heading!=='string'||[...value.heading].length>80
  ||!obj(value.partFonts)||Object.keys(value.partFonts).length!==PAGE_PARTS.length||!PAGE_PARTS.every(id=>PAGE_TEXT_SIZES.includes((value.partFonts as Record<string,unknown>)[id] as PageTextSize)))return false;
 if(value.background&&value.text&&contrast(value.background as string,value.text as string)<4.5)return false;
 const fittedList=(value as {fitted?:unknown}).fitted;
 if(fittedList!==undefined&&(!Array.isArray(fittedList)||!fittedList.every(id=>PAGE_PARTS.includes(id as PagePart))||new Set(fittedList).size!==fittedList.length))return false;
 const piecePositions=(value as {piecePositions?:unknown}).piecePositions;
 if(piecePositions!==undefined&&(!obj(piecePositions)||!Object.keys(piecePositions).every(key=>PAGE_PARTS.includes(key as PagePart)&&obj((piecePositions as Record<string,unknown>)[key])&&['x','y'].every(axis=>{const v=((piecePositions as Record<string,Record<string,unknown>>)[key]!)[axis];return typeof v==='number'&&Number.isFinite(v)&&v>=0;}))))return false;
 const partColors=(value as {partColors?:unknown}).partColors;
 if(partColors!==undefined&&(!obj(partColors)||!Object.keys(partColors).every(key=>PAGE_PARTS.includes(key as PagePart)&&obj((partColors as Record<string,unknown>)[key])&&['background','text'].every(slot=>{const v=((partColors as Record<string,Record<string,unknown>>)[key]!)[slot];return v===null||typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);}))))return false;
 if(value.layout===null)return true;
 const layout=value.layout;
 if(!obj(layout)||!onGrid(layout.width)||!onGrid(layout.height)||layout.width<config.minCanvasWidth||layout.width>config.maxWidth||layout.height<config.minCanvasHeight||layout.height>config.maxHeight||!obj(layout.parts)||Object.keys(layout.parts).length!==PAGE_PARTS.length||'button'in layout)return false;
 return PAGE_PARTS.every(id=>{const rect=(layout.parts as Record<string,unknown>)[id];return obj(rect)&&['x','y','width','height'].every(key=>onGrid(rect[key]))&&validPagePlacement(layout as unknown as PageLayout,id,rect as unknown as PageRect);});
}
export type PageAction=
 |{type:'color';slot:'background'|'button'|'text';color:string|null}
 |{type:'font';slot:'headingFont'|'bodyFont';font:PageFont}
 |{type:'motion';motion:PageDesign['motion']}|{type:'layout';layout:PageLayout}
 |{type:'part-size';part:PagePart;size:PagePartSize}|{type:'part-font';part:PagePart;size:PageTextSize}
 |{type:'part-color';part:PagePart;slot:'background'|'text';color:string|null}
 |{type:'fit';part:PagePart}|{type:'piece-move';part:PagePart;x:number;y:number}
 |{type:'recommended'|'reset'|'layout-guide-seen'}|{type:'heading';heading:string};
export function actPageDesign(s:GameState,a:PageAction):GameState {
 if(a.type==='layout-guide-seen')return s.run.seed.built.includes('layout')&&!s.persistent.testplay.layoutGuideSeen?{...s,persistent:{...s.persistent,testplay:{...s.persistent.testplay,layoutGuideSeen:true}}}:s;
 const p=s.run.seed.page,b=s.run.seed.built,editorCustomization={...s.persistent.editorCustomization},background=effectiveEditorBackground(editorCustomization,editorStage(s));
 let page={...p,background:usesNativeEditorBackground(editorCustomization)?null:background,text:p.text&&contrast(background,p.text)<4.5?readableText(background):p.text};
 if(a.type==='color'){
  if(!b.includes('color')||a.color!==null&&!paletteFor(s.persistent.specs.color).includes(a.color))return s;
  page[a.slot]=a.color;
  if(a.slot==='background'){editorCustomization.background=a.color??BALANCE.workshop.customization.background;editorCustomization.nativeBackground=a.color===null;}
  const colors=pageColors(page,s.persistent.specs.color,editorCustomization,editorStage(s));
  if(a.slot==='text'&&page.text&&contrast(colors.background,page.text)<4.5)return s;
  if(a.slot==='background'&&page.text&&contrast(colors.background,page.text)<4.5)page.text=readableText(colors.background);
 }
 if(a.type==='font'){if(!b.includes('font')||!PAGE_FONTS.includes(a.font))return s;page[a.slot]=a.font;}
 if(a.type==='motion'){if(!b.includes('motion')||!PAGE_MOTIONS.includes(a.motion))return s;page.motion=a.motion;}
 if(a.type==='layout'){
  if(!b.includes('layout')||!isPageDesign({...p,layout:a.layout}))return s;
  page.layout=structuredClone(a.layout);page.piecePositions={};
 }
 if(a.type==='part-size'){
  if(!b.includes('layout')||!PAGE_PARTS.includes(a.part)||!PAGE_PART_SIZES.includes(a.size))return s;
  const layout=setPagePartSize(p.layout??recommendedPage(),a.part,a.size);if(!layout)return s;page.layout=layout;
 }
 if(a.type==='part-font'){
  if(!b.includes('font')||!PAGE_PARTS.includes(a.part)||!PAGE_TEXT_SIZES.includes(a.size))return s;
  page.partFonts={...p.partFonts,[a.part]:a.size};
 }
 if(a.type==='part-color'){
  if(!b.includes('color')||!PAGE_PARTS.includes(a.part)||a.color!==null&&!paletteFor(s.persistent.specs.color).includes(a.color))return s;
  const colors=pageColors(page,s.persistent.specs.color,editorCustomization,editorStage(s));
  const current={...(page.partColors?.[a.part]??{background:null,text:null})};
  if(a.slot==='text'){if(a.color&&contrast(current.background??colors.background,a.color)<4.5)return s;current.text=a.color;}
  else{current.background=a.color;const bg=a.color??colors.background;if(current.text&&contrast(bg,current.text)<4.5)current.text=readableText(bg);}
  page.partColors={...page.partColors,[a.part]:current};
 }
 if(a.type==='fit'){
  if(!piecesToFit(p,s.persistent.examplesEnabled,s.run.seed.autoCursors).includes(a.part))return s;
  page.fitted=[...effectiveFitted(p,true),a.part];
  if(page.piecePositions){page.piecePositions={...page.piecePositions};delete page.piecePositions[a.part];}
 }
 if(a.type==='piece-move'){
  if(!piecesToFit(p,s.persistent.examplesEnabled,s.run.seed.autoCursors).includes(a.part))return s;
  const base=p.layout??initialPageLayout(),rect=base.parts[a.part];
  const x=Math.max(0,Math.min(base.width-rect.width,snap(Math.round(a.x)))),y=Math.max(0,Math.min(base.height-rect.height,snap(Math.round(a.y))));
  page.piecePositions={...page.piecePositions,[a.part]:{x,y}};
 }
 if(a.type==='recommended'){if(!b.includes('layout'))return s;page.layout=recommendedPage();page.piecePositions={};}
 if(a.type==='reset')page={...createPageDesign(),heading:p.heading,layout:b.includes('layout')?recommendedPage():null};
 if(a.type==='heading'){if(!b.includes('font'))return s;page.heading=[...a.heading].slice(0,80).join('');}
 if(a.type==='color'&&a.slot==='button')editorCustomization.accent=a.color??BALANCE.workshop.customization.accent;
 if(a.type==='reset'){editorCustomization.accent=BALANCE.workshop.customization.accent;editorCustomization.background=BALANCE.workshop.customization.background;editorCustomization.nativeBackground=true;}
 return {...s,persistent:{...s.persistent,editorCustomization},run:{...s.run,seed:{...s.run.seed,page}}};
}
