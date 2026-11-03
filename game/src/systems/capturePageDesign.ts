import {isLegacyPageDesign} from './legacyPageDesign';
import type {PageDesign,PageRect} from './pageDesign';

// Published scene12 structure. These limits deliberately do not follow mutable UI minima.
const parts=['heading','notice','pixels','generator','cursors','upgrades'] as const;
const fontSizes=['small','normal','large'];
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const grid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value%8===0;
const overlaps=(a:PageRect,b:PageRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

/** A frozen page is presentation data; accepting it never grants a usable live layout. */
export function isCapturePageDesignV12(value:unknown):value is PageDesign {
 if(!record(value)||!isLegacyPageDesign({...value,layout:null})||!record(value.partFonts)
   ||Object.keys(value.partFonts).length!==parts.length||!parts.every(id=>fontSizes.includes(String((value.partFonts as Record<string,unknown>)[id]))))return false;
 if(value.layout===null)return true;
 const layout=value.layout;
 if(!record(layout)||!grid(layout.width)||!grid(layout.height)||layout.width<320||layout.width>1920||layout.height<100||layout.height>1080||'button'in layout||!record(layout.parts)||Object.keys(layout.parts).length!==parts.length)return false;
 const rectangles=layout.parts;
 return parts.every(id=>{
  const rectangle=rectangles[id];
  return record(rectangle)&&['x','y','width','height'].every(key=>grid(rectangle[key]))&&Number(rectangle.width)>0&&Number(rectangle.height)>0
   &&Number(rectangle.x)+Number(rectangle.width)<=Number(layout.width)&&Number(rectangle.y)+Number(rectangle.height)<=Number(layout.height)
   &&!parts.some(other=>other!==id&&record(rectangles[other])&&overlaps(rectangle as unknown as PageRect,rectangles[other] as unknown as PageRect));
 });
}
