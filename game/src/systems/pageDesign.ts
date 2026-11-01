import { BALANCE } from '../config/balance';
import { homeButtonColor, paletteFor } from '../content/kumikiArt';
import { readableText } from './appLayout';
import type { GameState } from './state';
export const PAGE_PARTS=['heading','notice','generator','upgrades'] as const;
export type PagePart=typeof PAGE_PARTS[number];
export const PAGE_FONTS=['sans','serif','pixel','mono'] as const;
export type PageFont=typeof PAGE_FONTS[number];
export const PAGE_MOTIONS=['push','lift','fade'] as const;
export interface PageRect{x:number;y:number;width:number;height:number}
export interface PageLayout{width:number;height:number;parts:Record<PagePart,PageRect>}
export interface PageDesign{background:string|null;text:string|null;button:string|null;headingFont:PageFont;bodyFont:PageFont;motion:typeof PAGE_MOTIONS[number];heading:string;layout:PageLayout|null}
export const createPageDesign=():PageDesign=>({background:null,text:null,button:null,headingFont:'sans',bodyFont:'sans',motion:'push',heading:'',layout:null});
export const pageFonts:Record<PageFont,string>={sans:"'Refresh Sans',sans-serif",serif:"'Refresh Serif',serif",pixel:"'Refresh Pixel',monospace",mono:"'Refresh Mono',monospace"};
export function contrast(a:string,b:string){const l=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i]!,0);const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function pageColors(page:PageDesign,color:number){const background=page.background??(color===0?'#c0c0c0':'#edf0f2'),button=page.button??homeButtonColor(color),requested=page.text??readableText(background),text=contrast(background,requested)>=4.5?requested:readableText(background);return {background,button,text,buttonText:readableText(button)};}
const snap=(n:number)=>Math.round(n/BALANCE.pageDesign.grid)*BALANCE.pageDesign.grid;
const up=(n:number)=>Math.ceil(n/BALANCE.pageDesign.grid)*BALANCE.pageDesign.grid;
export const pageMinimum=(id:PagePart)=>({width:BALANCE.pageDesign.minWidth,height:BALANCE.pageDesign.minHeights[id]});
const overlaps=(a:PageRect,b:PageRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function validPagePlacement(layout:PageLayout,id:PagePart,r:PageRect){const m=pageMinimum(id);return Object.values(r).every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.width>=m.width&&r.height>=m.height&&r.x+r.width<=layout.width&&r.y+r.height<=layout.height&&!PAGE_PARTS.some(other=>other!==id&&overlaps(r,layout.parts[other]));}
export function recommendedPage(width:number=BALANCE.pageDesign.width,height:number=BALANCE.pageDesign.height):PageLayout{
 const w=up(Math.max(BALANCE.pageDesign.minWidth+32,width)),inner=Math.min(BALANCE.pageDesign.cardWidth,w-32),x=snap((w-inner)/2),gap=BALANCE.pageDesign.grid*2;
 let y=16;const parts={} as Record<PagePart,PageRect>;
 for(const id of PAGE_PARTS){const h=w<1000?BALANCE.pageDesign.compactHeights[id]:BALANCE.pageDesign.recommendedHeights[id];parts[id]={x,y,width:inner,height:h};y+=h+gap;}
 return {width:w,height:up(Math.max(height,y)),parts};
}
export function fitPageLayout(layout:PageLayout,width:number,height:number):PageLayout{
 const w=Math.max(352,Math.floor(width/8)*8),h=Math.max(720,Math.floor(height/8)*8);
 if(w<1000&&JSON.stringify(layout.parts)===JSON.stringify(recommendedPage(layout.width,layout.height).parts))return recommendedPage(w,h);
 const parts=Object.fromEntries(PAGE_PARTS.map(id=>{const p=layout.parts[id],min=pageMinimum(id),pw=Math.min(w,up(Math.max(min.width,p.width*w/layout.width))),ph=up(Math.max(min.height,p.height*h/layout.height));return [id,{x:Math.max(0,Math.min(w-pw,snap(p.x*w/layout.width))),y:Math.max(0,snap(p.y*h/layout.height)),width:pw,height:ph}];})) as PageLayout['parts'];
 const result={width:w,height:h,parts};if(PAGE_PARTS.every(id=>validPagePlacement(result,id,parts[id])))return result;
 if(w<1000){let y=16;for(const id of [...PAGE_PARTS].sort((a,b)=>layout.parts[a].y-layout.parts[b].y||layout.parts[a].x-layout.parts[b].x)){parts[id].y=Math.max(y,parts[id].y);y=parts[id].y+parts[id].height+16;}const reflow={width:w,height:up(Math.max(h,y)),parts};if(reflow.height<=1080&&PAGE_PARTS.every(id=>validPagePlacement(reflow,id,parts[id])))return reflow;}
 return recommendedPage(w,h);
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
// Structural contract, also used by scene format 7; UI minima may change independently.
export function isPageDesign(v:unknown):v is PageDesign{
 if(!obj(v)||!['background','text','button'].every(k=>v[k]===null||typeof v[k]==='string'&&/^#[0-9a-f]{6}$/i.test(v[k] as string))||!PAGE_FONTS.includes(v.headingFont as PageFont)||!PAGE_FONTS.includes(v.bodyFont as PageFont)||!PAGE_MOTIONS.includes(v.motion as PageDesign['motion'])||typeof v.heading!=='string'||[...v.heading].length>80)return false;
 if(v.background&&v.text&&contrast(v.background as string,v.text as string)<4.5)return false;
 if(v.layout===null)return true;const l=v.layout;if(!obj(l)||!Number.isFinite(l.width)||!Number.isFinite(l.height)||Number(l.width)<320||Number(l.width)>1920||Number(l.height)<100||Number(l.height)>1080||!obj(l.parts)||Object.keys(l.parts).length!==4)return false;
 return PAGE_PARTS.every(id=>{const r=(l.parts as Record<string,unknown>)[id];return obj(r)&&['x','y','width','height'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&(r[k] as number)>=0&&(r[k] as number)%8===0)&&Number(r.width)>0&&Number(r.height)>0&&Number(r.x)+Number(r.width)<=Number(l.width)&&Number(r.y)+Number(r.height)<=Number(l.height)&&!PAGE_PARTS.some(other=>other!==id&&obj((l.parts as Record<string,unknown>)[other])&&overlaps(r as unknown as PageRect,(l.parts as Record<string,unknown>)[other] as PageRect));});
}
export type PageAction={type:'color';slot:'background'|'button'|'text';color:string|null}|{type:'font';slot:'headingFont'|'bodyFont';font:PageFont}|{type:'motion';motion:PageDesign['motion']}|{type:'layout';layout:PageLayout}|{type:'recommended'|'reset'}|{type:'heading';heading:string};
export function actPageDesign(s:GameState,a:PageAction):GameState{
 const p=s.run.seed.page,b=s.run.seed.built;let page={...p};
 if(a.type==='color'){if(!b.includes('color')||a.color!==null&&!paletteFor(s.persistent.specs.color).includes(a.color))return s;page[a.slot]=a.color;const colors=pageColors(page,s.persistent.specs.color);if(a.slot==='text'&&page.text&&contrast(colors.background,page.text)<4.5)return s;if(a.slot==='background'&&page.text&&contrast(colors.background,page.text)<4.5)page.text=readableText(colors.background);}
 if(a.type==='font'){if(!b.includes('font')||!PAGE_FONTS.includes(a.font))return s;page[a.slot]=a.font;}
 if(a.type==='motion'){if(!b.includes('motion')||!PAGE_MOTIONS.includes(a.motion))return s;page.motion=a.motion;}
 if(a.type==='layout'){if(!b.includes('layout')||!isPageDesign({...p,layout:a.layout})||!PAGE_PARTS.every(id=>validPagePlacement(a.layout,id,a.layout.parts[id])))return s;page.layout=a.layout;}
 if(a.type==='recommended'){if(!b.includes('layout'))return s;page.layout=recommendedPage();}
 if(a.type==='reset')page={...createPageDesign(),heading:p.heading,layout:b.includes('layout')?recommendedPage():null};
 if(a.type==='heading'){if(!s.run.kumiki.placed.includes('input'))return s;page.heading=[...a.heading].slice(0,BALANCE.w2.maxName).join('');}
 return {...s,persistent:{...s.persistent,homeUpdatedAt:s.lastTickAt},run:{...s.run,seed:{...s.run.seed,page}}};
}
