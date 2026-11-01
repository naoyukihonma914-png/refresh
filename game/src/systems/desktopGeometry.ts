import { BALANCE } from '../config/balance';
import type { AppId, DesktopState, Rect } from './desktopState';
import type { VisualStage } from './appearance';
import type { LogicalSize } from './viewport';

export const LEGACY_DESKTOP:LogicalSize={width:1920,height:1080};
export const desktopScreen=(stage:VisualStage):LogicalSize=>({...BALANCE.appearance.screens[stage]});
export const taskbarHeight=(screen:LogicalSize)=>screen.width===800?28:screen.width===1024?30:screen.width===1366?40:48;
export const workHeight=(screen:LogicalSize)=>screen.height-taskbarHeight(screen);
export const MIN_WINDOW_WIDTH={tessera:520,note:300,files:440,mail:520,manager:480,photo:440,bin:340,clock:280,theme:360,terminal:360,settings:480} as const;
export const MIN_WINDOW_HEIGHT=240;
export function fitWindow(app:AppId,rect:Rect,screen:LogicalSize):Rect {
 const width=Math.max(Math.min(MIN_WINDOW_WIDTH[app],screen.width),Math.min(screen.width,Math.round(rect.width)));
 const height=Math.max(Math.min(MIN_WINDOW_HEIGHT,workHeight(screen)),Math.min(workHeight(screen),Math.round(rect.height)));
 return {x:Math.max(0,Math.min(screen.width-width,Math.round(rect.x))),y:Math.max(0,Math.min(workHeight(screen)-height,Math.round(rect.y))),width,height};
}
export function fitIcon(point:{x:number;y:number},screen:LogicalSize,height=76){
 return {x:Math.max(0,Math.min(screen.width-80,Math.round(point.x))),y:Math.max(0,Math.min(workHeight(screen)-height,Math.round(point.y)))};
}
// Scale saved coordinates, then respect native control sizes. Reflow only colliding shortcuts.
export function resizeDesktop<T extends Pick<DesktopState,'windows'|'icons'|'screen'>>(desktop:T,screen:LogicalSize,iconSize=32):T {
 const source=desktop.screen,rx=screen.width/source.width,ry=workHeight(screen)/workHeight(source);
 const scale=(app:AppId,r:Rect)=>fitWindow(app,{x:r.x*rx,y:r.y*ry,width:r.width*rx,height:r.height*ry},screen);
 const windows=Object.fromEntries(Object.entries(desktop.windows).map(([id,w])=>{const app=id as AppId;return [id,{...w,...(w.maximized?{x:0,y:0,width:screen.width,height:workHeight(screen)}:scale(app,w)),restore:w.restore?scale(app,w.restore):null}];})) as DesktopState['windows'];
 const height=Math.max(76,iconSize+36),placed:{x:number;y:number}[]=[];
 const collides=(p:{x:number;y:number})=>placed.some(q=>Math.abs(p.x-q.x)<80&&Math.abs(p.y-q.y)<height);
 const icons=Object.fromEntries(Object.entries(desktop.icons).map(([id,p])=>{
  let point=fitIcon({x:p.x*rx,y:p.y*ry},screen,height);
  if(collides(point)){
   const slots=[];for(let x=8;x<=screen.width-80;x+=84)for(let y=8;y<=workHeight(screen)-height;y+=height)slots.push({x,y});
   slots.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));point=slots.find(p=>!collides(p))??point;
  }
  placed.push(point);return [id,point];
 })) as DesktopState['icons'];
 return {...desktop,screen:{...screen},windows,icons};
}
