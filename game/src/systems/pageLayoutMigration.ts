import { BALANCE } from '../config/balance';
import { initialPageLayout,isCrampedPageLayout,PAGE_PARTS,recommendedPage,type PageLayout } from './pageDesign';
import type { GameState } from './state';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const config=BALANCE.pageDesign;
const down=(value:number)=>Math.floor(value/config.grid)*config.grid;
const up=(value:number)=>Math.ceil(value/config.grid)*config.grid;
/** Schema17 defaults, frozen here: the generate button was the large preset (320x80) at the left edge of the main column. Current config values must not leak into this reconstruction. */
const oldHeights=(compact:boolean)=>compact?{heading:64,notice:96,pixels:64,generator:80,cursors:80,upgrades:160}:{heading:80,notice:128,pixels:64,generator:80,cursors:96,upgrades:224};
export function schema17RecommendedPage(width:number=config.width,height:number=config.height):PageLayout {
 const gap=config.gap,w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width))),compact=w<config.layoutBreakpoint,heights=oldHeights(compact);
 const pixelY=gap,headingY=pixelY+heights.pixels+gap,noticeY=headingY+heights.heading+gap,generatorY=noticeY+heights.notice+gap;
 const cursorsY=generatorY+config.partSizes.generator.extraLarge.height+gap;
 const left=compact?gap:config.contentInset,sidebar=compact?w-gap*2:up(Math.max(config.minWidths.upgrades,w*config.sidebarFraction));
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
export function schema17InitialPageLayout(width:number=config.width,height:number=config.height):PageLayout {
 const gap=config.gap,w=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(width))),compact=w<config.layoutBreakpoint,heights=oldHeights(compact);
 const left=compact?gap:config.contentInset,main=w-left-gap;
 const headingY=gap+heights.pixels+gap,generatorY=headingY+heights.heading+gap,cursorsY=generatorY+config.partSizes.generator.extraLarge.height+gap;
 const noticeY=cursorsY+heights.cursors+gap,upgradesY=noticeY+heights.notice+gap;
 return {width:w,height:up(Math.max(config.minCanvasHeight,Math.min(config.maxHeight,height),upgradesY+heights.upgrades+gap)),parts:{
  pixels:{x:gap,y:gap,width:w-gap*2,height:heights.pixels},heading:{x:left,y:headingY,width:main,height:heights.heading},
  generator:{x:left,y:generatorY,width:Math.min(main,config.partSizes.generator.large.width),height:heights.generator},
  cursors:{x:left,y:cursorsY,width:main,height:heights.cursors},notice:{x:left,y:noticeY,width:main,height:heights.notice},
  upgrades:{x:left,y:upgradesY,width:main,height:heights.upgrades},
 }};
}
const sameLayout=(a:PageLayout,b:PageLayout)=>a.width===b.width&&a.height===b.height&&PAGE_PARTS.every(id=>(['x','y','width','height'] as const).every(key=>a.parts[id][key]===b.parts[id][key]));
/** Repair only the live seed page: untouched schema17 defaults move to the current defaults, and a layout squeezed into a corner by the older conversion is replaced by the recommended layout. Historical product screens keep their layouts. */
export function migratePageLayoutSave(value:unknown):unknown {
 if(!record(value)||value.schemaVersion!==17||!record(value.run)||!record(value.run.seed)||!record(value.run.seed.page))throw new Error('Invalid schema17 save');
 const next=structuredClone(value) as unknown as GameState;
 (next as unknown as {schemaVersion:number}).schemaVersion=18;
 if(record(next.persistent)&&typeof next.persistent.doubleClickFit!=='boolean')(next.persistent as Record<string,unknown>).doubleClickFit=false;
 const layout=next.run.seed.page.layout;
 if(layout){
  if(sameLayout(layout,schema17RecommendedPage(layout.width,layout.height)))next.run.seed.page.layout=recommendedPage(layout.width,layout.height);
  else if(sameLayout(layout,schema17InitialPageLayout(layout.width,layout.height)))next.run.seed.page.layout=initialPageLayout(layout.width,layout.height);
  else if(isCrampedPageLayout(layout))next.run.seed.page.layout=recommendedPage(layout.width,layout.height);
 }
 return next;
}
