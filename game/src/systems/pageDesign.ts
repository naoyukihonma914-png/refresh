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
}
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
 const parts:PageLayout['parts']={
  pixels:{x:gap,y:pixelY,width:w-gap*2,height:heights.pixels},
  heading:{x:left,y:headingY,width:main,height:heights.heading},
  notice:{x:left,y:noticeY,width:main,height:heights.notice},
  generator:{x:left,y:generatorY,width:Math.min(main,config.partSizes.generator.large.width),height:heights.generator},
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
 return {width:w,height:up(Math.max(config.minCanvasHeight,Math.min(config.maxHeight,height),upgradesY+heights.upgrades+gap)),parts:{
  pixels:{x:gap,y:gap,width:w-gap*2,height:heights.pixels},heading:{x:left,y:headingY,width:main,height:heights.heading},
  generator:{x:left,y:generatorY,width:Math.min(main,config.partSizes.generator.large.width),height:heights.generator},
  cursors:{x:left,y:cursorsY,width:main,height:heights.cursors},notice:{x:left,y:noticeY,width:main,height:heights.notice},
  upgrades:{x:left,y:upgradesY,width:main,height:heights.upgrades},
 }};
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
/** Viewport adaptation is a presentation projection and never changes the saved source layout. */
export function fitPageLayout(layout:PageLayout,width:number,height:number):PageLayout {
 const w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width))),h=Math.max(config.minCanvasHeight,Math.min(config.maxHeight,down(height)));
 if(isRecommendedPage(layout))return recommendedPage(w,h);
 const parts=Object.fromEntries(PAGE_PARTS.map(id=>{const r=layout.parts[id],minimum=pageMinimum(id),partWidth=Math.min(w,up(Math.max(minimum.width,id==='generator'?r.width:r.width*w/layout.width)));return [id,{x:Math.max(0,Math.min(w-partWidth,snap(r.x*w/layout.width))),y:snap(r.y),width:partWidth,height:Math.max(minimum.height,up(r.height))}];})) as PageLayout['parts'];
 const projected={width:w,height:Math.min(config.maxHeight,up(Math.max(h,...PAGE_PARTS.map(id=>parts[id].y+parts[id].height)))),parts};
 if(PAGE_PARTS.every(id=>validPagePlacement(projected,id,parts[id])))return projected;
 // Preserve the visual reading order when a narrow viewport needs new lines.
 if(w<config.layoutBreakpoint){
  let y=config.gap;
  for(const id of [...PAGE_PARTS].sort((a,b)=>layout.parts[a].y-layout.parts[b].y||layout.parts[a].x-layout.parts[b].x)){
   parts[id]={...parts[id],x:config.gap,width:Math.min(w-config.gap*2,parts[id].width),y};y+=parts[id].height+config.gap;
  }
  const stacked={width:w,height:up(Math.max(h,y)),parts};
  if(stacked.height<=config.maxHeight&&PAGE_PARTS.every(id=>validPagePlacement(stacked,id,parts[id])))return stacked;
 }
 return recommendedPage(w,h);
}
export function isPageDesign(value:unknown):value is PageDesign {
 if(!obj(value)||!['background','text','button'].every(key=>value[key]===null||typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key] as string))
  ||!PAGE_FONTS.includes(value.headingFont as PageFont)||!PAGE_FONTS.includes(value.bodyFont as PageFont)||!PAGE_MOTIONS.includes(value.motion as PageDesign['motion'])||typeof value.heading!=='string'||[...value.heading].length>80
  ||!obj(value.partFonts)||Object.keys(value.partFonts).length!==PAGE_PARTS.length||!PAGE_PARTS.every(id=>PAGE_TEXT_SIZES.includes((value.partFonts as Record<string,unknown>)[id] as PageTextSize)))return false;
 if(value.background&&value.text&&contrast(value.background as string,value.text as string)<4.5)return false;
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
  page.layout=structuredClone(a.layout);
 }
 if(a.type==='part-size'){
  if(!b.includes('layout')||!PAGE_PARTS.includes(a.part)||!PAGE_PART_SIZES.includes(a.size))return s;
  const layout=setPagePartSize(p.layout??recommendedPage(),a.part,a.size);if(!layout)return s;page.layout=layout;
 }
 if(a.type==='part-font'){
  if(!b.includes('font')||!PAGE_PARTS.includes(a.part)||!PAGE_TEXT_SIZES.includes(a.size))return s;
  page.partFonts={...p.partFonts,[a.part]:a.size};
 }
 if(a.type==='recommended'){if(!b.includes('layout'))return s;page.layout=recommendedPage();}
 if(a.type==='reset')page={...createPageDesign(),heading:p.heading,layout:b.includes('layout')?recommendedPage():null};
 if(a.type==='heading'){if(!b.includes('font'))return s;page.heading=[...a.heading].slice(0,80).join('');}
 if(a.type==='color'&&a.slot==='button')editorCustomization.accent=a.color??BALANCE.workshop.customization.accent;
 if(a.type==='reset'){editorCustomization.accent=BALANCE.workshop.customization.accent;editorCustomization.background=BALANCE.workshop.customization.background;editorCustomization.nativeBackground=true;}
 return {...s,persistent:{...s.persistent,editorCustomization},run:{...s.run,seed:{...s.run.seed,page}}};
}
