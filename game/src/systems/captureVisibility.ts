import type { Rect } from './desktopState';
import { BALANCE } from '../config/balance';

/** Presentation geometry only. A part can occupy several disjoint regions. */
export interface CaptureElement {
  id:string;
  type:string;
  app?:string;
  sourcePartId?:string;
  rects:Rect[];
  layer:number;
}
export interface CaptureOccluder {id:string;rect:Rect;layer:number}
export interface VisibleCaptureElement extends CaptureElement {
  visibleRects:Rect[];
  area:number;
  visibleArea:number;
  hiddenArea:number;
  visible:boolean;
}
export interface CaptureVisibility {
  parts:VisibleCaptureElement[];
  visibleCount:number;
  kinds:number;
  fullyHidden:number;
  visibleWindows:string[];
}
const valid=(r:Rect)=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>=BALANCE.capture.geometry.coordinateUnit&&r.height>=BALANCE.capture.geometry.coordinateUnit;
export const rectangleArea=(r:Rect)=>valid(r)?r.width*r.height:0;
export function intersectRect(a:Rect,b:Rect):Rect|null {
  if(!valid(a)||!valid(b))return null;
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);
  const result={x,y,width:right-x,height:bottom-y};return valid(result)?result:null;
}
/** Subtraction is exact: each remainder is disjoint, so overlapped occluders cannot double-subtract. */
export function subtractRect(subject:Rect,cover:Rect):Rect[] {
  if(!valid(subject))return [];
  const cut=intersectRect(subject,cover);
  if(!cut)return [{...subject}];
  const regions=[
    {x:subject.x,y:subject.y,width:subject.width,height:cut.y-subject.y},
    {x:subject.x,y:cut.y+cut.height,width:subject.width,height:subject.y+subject.height-cut.y-cut.height},
    {x:subject.x,y:cut.y,width:cut.x-subject.x,height:cut.height},
    {x:cut.x+cut.width,y:cut.y,width:subject.x+subject.width-cut.x-cut.width,height:cut.height},
  ];
  return regions.filter(valid);
}
/** Return a union as disjoint rectangles; overlapping source roles still describe one physical part. */
export function unionRects(rects:readonly Rect[]):Rect[] {
  const result:Rect[]=[];
  for(const rectangle of rects.filter(valid)){
    let remaining=[{...rectangle}];
    for(const previous of result)remaining=remaining.flatMap(piece=>subtractRect(piece,previous));
    result.push(...remaining);
  }
  return result;
}
export function evaluateVisibility(elements:readonly CaptureElement[],occluders:readonly CaptureOccluder[],viewport:Rect):CaptureVisibility {
  const parts=elements.map(element=>{
    const regions=unionRects(element.rects),area=regions.reduce((sum,rect)=>sum+rectangleArea(rect),0);
    let visibleRects=regions.flatMap(rect=>intersectRect(rect,viewport)??[]);
    for(const cover of occluders){
      if(cover.id===element.app||cover.layer<=element.layer)continue;
      visibleRects=visibleRects.flatMap(piece=>subtractRect(piece,cover.rect));
      if(!visibleRects.length)break;
    }
    const visibleArea=visibleRects.reduce((sum,rect)=>sum+rectangleArea(rect),0);
    return {...element,rects:regions,visibleRects,area,visibleArea,hiddenArea:Math.max(0,area-visibleArea),visible:visibleArea>0};
  });
  const visible=parts.filter(part=>part.visible);
  return {parts,visibleCount:visible.length,kinds:new Set(visible.map(part=>part.type)).size,fullyHidden:parts.filter(part=>part.area>0&&!part.visible).length,
    visibleWindows:[...new Set(visible.flatMap(part=>part.app?[part.app]:[]))]};
}
