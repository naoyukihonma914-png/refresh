import { BALANCE } from '../config/balance';
import { SET_IDS, type UiSetId } from '../content/workshopCatalog';
import { isLegacyPageDesign, type LegacyPageDesign, type LegacyPageLayout } from './legacyPageDesign';
import { createPageDesign,isPageDesign,PAGE_PARTS,pageMinimum,pagePlacementForSize,recommendedPage,validPagePlacement,type PageDesign,type PageLayout } from './pageDesign';
import type { GameState } from './state';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const config=BALANCE.pageDesign;
const up=(value:number)=>Math.ceil(value/config.grid)*config.grid;
const down=(value:number)=>Math.floor(value/config.grid)*config.grid;
/** Published schema15's standard four-part arrangement. It must not use current UI defaults. */
function legacyRecommendation(width:number,height:number):LegacyPageLayout {
 const gap=16,w=Math.ceil(Math.max(352,width)/8)*8,parts={} as LegacyPageLayout['parts'];
 const heights=w<1000?{heading:80,notice:80,generator:280,upgrades:160}:{heading:112,notice:160,generator:176,upgrades:224};
 if(w>=1000){
  const sidebar=Math.ceil(Math.max(320,w*.28)/8)*8,main=w-sidebar-gap*3;let y=gap;
  for(const id of ['heading','notice','generator'] as const){parts[id]={x:gap,y,width:main,height:heights[id]};y+=heights[id]+gap;}
  parts.upgrades={x:main+gap*2,y:gap,width:sidebar,height:Math.ceil(Math.max(heights.upgrades,y-gap*2)/8)*8};
  return {width:w,height:Math.ceil(Math.max(height,y)/8)*8,parts};
 }
 let y=gap;for(const id of ['heading','notice','generator','upgrades'] as const){parts[id]={x:gap,y,width:w-gap*2,height:heights[id]};y+=heights[id]+gap;}
 return {width:w,height:Math.ceil(Math.max(height,y)/8)*8,parts};
}
function migrateLayout(old:LegacyPageLayout):PageLayout {
 const width=Math.max(config.minCanvasWidth,Math.min(config.maxWidth,down(old.width))),height=Math.max(config.minCanvasHeight,Math.min(config.maxHeight,up(old.height)));
 const reference=legacyRecommendation(old.width,old.height);
 if(!old.button&&(['heading','notice','generator','upgrades'] as const).every(id=>(['x','y','width','height'] as const).every(key=>old.parts[id][key]===reference.parts[id][key])))return recommendedPage(width,height);
 const button={width:up(Math.max(config.buttonMinWidth,old.button?.width??config.partSizes.generator.large.width)),height:up(Math.max(config.buttonMinHeight,old.button?.height??config.partSizes.generator.large.height))};
 const baseline=recommendedPage(width,height),pixels=baseline.parts.pixels;
 const empty=():PageLayout=>({width,height:config.maxHeight,parts:Object.fromEntries(PAGE_PARTS.map(id=>[id,{x:0,y:0,width:0,height:0}])) as PageLayout['parts']});
 const lefts=[old.parts.generator.x,config.contentInset,0,width-button.width];
 const tops=[old.parts.generator.y,pixels.y+pixels.height,pixels.y+pixels.height+Math.max(...(['heading','notice','upgrades','cursors'] as const).map(id=>pageMinimum(id).height)),config.maxHeight-button.height];
 let best:PageLayout|null=null,bestScore=Infinity;
 for(const x of lefts)for(const y of tops){
  const layout=empty(),generator={x:down(Math.max(0,x)),y:down(Math.max(0,y)),...button};
  layout.parts.pixels={...pixels};
  if(!validPagePlacement(layout,'generator',generator))continue;
  layout.parts.generator=generator;let score=(generator.x-old.parts.generator.x)**2+(generator.y-old.parts.generator.y)**2,failed=false;
  for(const id of ['upgrades','heading','notice','cursors'] as const){
   const source=id==='cursors'?{x:old.parts.generator.x,y:generator.y+generator.height+config.gap,width:old.parts.generator.width,height:config.minHeights.cursors}:old.parts[id];
   const minimum=pageMinimum(id),preferred={width:Math.min(width,up(Math.max(minimum.width,source.width))),height:up(Math.max(minimum.height,source.height))};
   let rect=pagePlacementForSize(layout,id,preferred,source);
   if(!rect){rect=pagePlacementForSize(layout,id,minimum,source);score+=config.maxWidth**2+config.maxHeight**2;}
   if(!rect){failed=true;break;}
   layout.parts[id]=rect;score+=(rect.x-source.x)**2+(rect.y-source.y)**2;
  }
  if(failed)continue;
  layout.height=up(Math.max(height,...PAGE_PARTS.map(id=>layout.parts[id].y+layout.parts[id].height)));
  if(layout.height<=config.maxHeight&&PAGE_PARTS.every(id=>validPagePlacement(layout,id,layout.parts[id]))&&score<bestScore){best=layout;bestScore=score;}
 }
 if(best)return best;
 const safe=pagePlacementForSize(baseline,'generator',button,old.parts.generator);
 return safe?{...baseline,parts:{...baseline.parts,generator:safe}}:baseline;
}
/** Upgrade only the live page. Historical recordings retain their original page payload. */
export function migrateLegacyPageDesign(value:unknown):PageDesign {
 if(isPageDesign(value))return structuredClone(value);
 const initial=createPageDesign();
 if(!record(value)||!isLegacyPageDesign({...value,layout:null}))return initial;
 const legacy=value as unknown as LegacyPageDesign;
 return {...initial,background:legacy.background,text:legacy.text,button:legacy.button,headingFont:legacy.headingFont,bodyFont:legacy.bodyFont,motion:legacy.motion,heading:legacy.heading,
  layout:isLegacyPageDesign(value)&&legacy.layout?migrateLayout(legacy.layout):null};
}
/** No currencies, production, possessions, published products, or screenshot bytes change here. */
export function migrateTestplaySave(value:unknown):GameState {
 if(!record(value)||value.schemaVersion!==15||!record(value.run)||!record(value.run.seed)||!record(value.run.workshop)||!record(value.run.desktop)||!record(value.persistent)||!Array.isArray(value.persistent.products)||!Array.isArray(value.persistent.setDocuments))throw new Error('Invalid schema15 save');
 const next=structuredClone(value) as unknown as GameState;
 next.schemaVersion=16;
 const oldPage=value.run.seed.page;
 next.run.seed.page=migrateLegacyPageDesign(oldPage);
 const hadLayout=Array.isArray(value.run.seed.built)&&value.run.seed.built.includes('layout')
  ||record(oldPage)&&oldPage.layout!==null&&oldPage.layout!==undefined
  ||next.run.workshop.entered||next.run.desktop.entered
  ||next.persistent.products.some(product=>product.screen.built.includes('layout'));
 const knownSets:unknown[]=[...next.run.workshop.purchasedSets,...next.persistent.setDocuments.map(doc=>doc.set),...next.persistent.products.flatMap(product=>product.screen.workshop?.purchasedSets??[]),...(next.persistent.editorSkills.includes('extraParts')?['extras']:[])];
 next.persistent.testplay={layoutGuideSeen:hadLayout,helpSeen:SET_IDS.filter(set=>knownSets.includes(set)) as UiSetId[]};
 next.run.workshop.helpTarget=null;
 return next;
}
