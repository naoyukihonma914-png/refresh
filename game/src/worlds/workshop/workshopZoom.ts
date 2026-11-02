import { BALANCE } from '../../config/balance';

export interface WorkbenchViewport {width:number;height:number;paddingLeft:number;paddingRight:number;paddingTop:number;paddingBottom:number}
/** Viewport dimensions are CSS layout pixels, before the desktop's outer scale. */
export function workshopFitZoom(viewport:WorkbenchViewport,content={width:BALANCE.workshop.canvas.width+8,height:BALANCE.workshop.canvas.height+32}):number {
 const width=Math.max(0,viewport.width-viewport.paddingLeft-viewport.paddingRight);
 const height=Math.max(0,viewport.height-viewport.paddingTop-viewport.paddingBottom);
 // Fit may be smaller than the manual zoom choices inside a narrow desktop window.
 if(width===0||height===0)return BALANCE.workshop.zoomMin;
 return Math.min(BALANCE.workshop.zoomMax,width/content.width,height/content.height);
}

export function fitWorkshopViewport(viewport:HTMLElement):number {
 const style=getComputedStyle(viewport),target=viewport.querySelector<HTMLElement>('.ws-target-window');
 const px=(value:string)=>Number.parseFloat(value)||0;
 return workshopFitZoom({width:viewport.clientWidth,height:viewport.clientHeight,paddingLeft:px(style.paddingLeft),paddingRight:px(style.paddingRight),paddingTop:px(style.paddingTop),paddingBottom:px(style.paddingBottom)}, {
  width:Math.max(BALANCE.workshop.canvas.width+8,(target?.offsetLeft??0)+(target?.offsetWidth??0)),
  height:Math.max(BALANCE.workshop.canvas.height+32,(target?.offsetTop??0)+(target?.offsetHeight??0)),
 });
}
