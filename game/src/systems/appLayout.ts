import { BALANCE } from '../config/balance';
import type { BuiltApp, Rect } from './desktopState';
import type { DesktopUpgrade } from '../config/balance';

export const BUILDABLE_APPS = ['files','mail','photo','bin','clock','theme','terminal','manager'] as const satisfies readonly BuiltApp[];
export const APP_PARTS = {
 files:{base:['navigation','places','list','status'],features:['sort','search','large']},
 mail:{base:['messages','body'],features:['draft','folders']},
 photo:{base:['source','image','brightness','tone','wallpaper'],features:['crop','compare']},
 bin:{base:['trash','empty'],features:['undo']},clock:{base:['time'],features:['timer','calendar']},
 theme:{base:['appearance'],features:['slideshow','iconSize']},terminal:{base:['commands','output'],features:[]},manager:{base:['tabs','processes'],features:[]},
} as const;
export type AppPartId = typeof APP_PARTS[BuiltApp]['base'][number] | typeof APP_PARTS[BuiltApp]['features'][number];
export interface AppPart extends Rect { id:AppPartId; color:string; fontSize:number; rowHeight:number; striped:boolean }
export interface AppLayout {width:number;height:number;parts:AppPart[]}
export interface AppProject {crafted:AppPartId[];draft:AppLayout;installed:AppLayout|null;undo:AppLayout[];redo:AppLayout[]}
export type AppProjects=Partial<Record<BuiltApp,AppProject>>;
export type PartMinimums=Partial<Record<AppPartId,{width:number;height:number}>>;
export const allAppParts=(app:BuiltApp):readonly AppPartId[]=>[...APP_PARTS[app].base,...APP_PARTS[app].features];
export const featureApp=(id:string)=>BUILDABLE_APPS.find(app=>(APP_PARTS[app].features as readonly string[]).includes(id));
export const isBuildable=(id:string):id is BuiltApp=>(BUILDABLE_APPS as readonly string[]).includes(id);
export const emptyLayout=():AppLayout=>({width:BALANCE.appBuild.width,height:BALANCE.appBuild.height,parts:[]});
export const emptyProject=():AppProject=>({crafted:[],draft:emptyLayout(),installed:null,undo:[],redo:[]});
export const bodyParts:readonly AppPartId[]=['places','list','messages','body','image','trash','calendar','appearance','output','processes'];
export function minimumPart(id:AppPartId,metrics:PartMinimums={}):{width:number;height:number} {
 const body=bodyParts.includes(id),m=metrics[id];
 return {width:Math.max(({navigation:280,status:224,list:224,messages:200,body:200,source:200,brightness:200,tone:200,crop:200,wallpaper:180,compare:160,search:200,large:160,sort:200,timer:280,commands:320,tabs:280,slideshow:220,iconSize:220,time:200} as Partial<Record<AppPartId,number>>)[id]??(body?BALANCE.appBuild.bodyMinWidth:BALANCE.appBuild.controlMinWidth),m?.width??0),height:Math.max(({time:112,commands:112,timer:128,appearance:192,calendar:224,draft:96} as Partial<Record<AppPartId,number>>)[id]??(body?BALANCE.appBuild.bodyMinHeight:BALANCE.appBuild.controlMinHeight),m?.height??0)};
}
const grid=(n:number)=>Math.round(n/BALANCE.appBuild.grid)*BALANCE.appBuild.grid;
const up=(n:number)=>Math.ceil(n/BALANCE.appBuild.grid)*BALANCE.appBuild.grid;
export const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function readableText(color:string):'#000000'|'#ffffff' {
 const rgb=[1,3,5].map(n=>parseInt(color.slice(n,n+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const luminance=rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722;
 return (luminance+.05)/.05>=1.05/(luminance+.05)?'#000000':'#ffffff';
}
export function validPlacement(layout:AppLayout,part:AppPart,metrics:PartMinimums={}):boolean {
 const min=minimumPart(part.id,metrics);
 return [part.x,part.y,part.width,part.height].every(Number.isFinite)&&part.x>=0&&part.y>=0&&part.width>=min.width&&part.height>=min.height&&part.x+part.width<=layout.width&&part.y+part.height<=layout.height&&!layout.parts.some(p=>p.id!==part.id&&overlap(p,part));
}
export function recommendedLayout(app:BuiltApp,ids:readonly AppPartId[],size={width:BALANCE.appBuild.width as number,height:BALANCE.appBuild.height as number},metrics:PartMinimums={},previous?:AppLayout):AppLayout {
 const available=allAppParts(app).filter(id=>ids.includes(id)),gap=BALANCE.appBuild.grid;
 const width=up(Math.max(size.width,...available.map(id=>minimumPart(id,metrics).width),app==='files'&&available.includes('places')&&available.includes('list')?minimumPart('places',metrics).width+minimumPart('list',metrics).width+gap:0));
 if(app==='files'){
  const placed:AppPart[]=[];let top=0;const add=(id:AppPartId,r:Rect)=>placed.push({...previous?.parts.find(p=>p.id===id),id,color:previous?.parts.find(p=>p.id===id)?.color??'#ffffff',fontSize:previous?.parts.find(p=>p.id===id)?.fontSize??12,rowHeight:previous?.parts.find(p=>p.id===id)?.rowHeight??24,striped:previous?.parts.find(p=>p.id===id)?.striped??false,...r});
  if(available.includes('navigation')){add('navigation',{x:0,y:top,width,height:up(minimumPart('navigation',metrics).height)});top+=up(minimumPart('navigation',metrics).height)+gap;}
  for(const id of ['sort','search','large'] as const)if(available.includes(id)){add(id,{x:0,y:top,width,height:up(minimumPart(id,metrics).height)});top+=up(minimumPart(id,metrics).height)+gap;}
  const footer=available.includes('status')?up(minimumPart('status',metrics).height)+gap:0,body=available.some(id=>id==='places'||id==='list')?BALANCE.appBuild.bodyMinHeight:0;
  const height=up(Math.max(size.height,top+body+footer));
  const sidebar=available.includes('places')&&available.includes('list')?up(minimumPart('places',metrics).width):width;
  if(available.includes('places'))add('places',{x:0,y:top,width:sidebar,height:height-top-footer});
  if(available.includes('list')){const x=available.includes('places')?sidebar+gap:0;add('list',{x,y:top,width:width-x,height:height-top-footer});}
  if(available.includes('status'))add('status',{x:0,y:height-footer+gap,width,height:footer-gap});
  return {width,height,parts:placed};
 }
 const controls=available.filter(id=>!bodyParts.includes(id)),bodies=available.filter(id=>bodyParts.includes(id));
 let y=0,x=0,row=0;const parts:AppPart[]=[];
 const make=(id:AppPartId,r:Rect):AppPart=>({...previous?.parts.find(p=>p.id===id),id,color:previous?.parts.find(p=>p.id===id)?.color??'#ffffff',fontSize:previous?.parts.find(p=>p.id===id)?.fontSize??12,rowHeight:previous?.parts.find(p=>p.id===id)?.rowHeight??24,striped:previous?.parts.find(p=>p.id===id)?.striped??false,...r});
 for(const id of controls){const min=minimumPart(id,metrics),w=up(Math.max(min.width,Math.floor((width-gap)/2/gap)*gap)),h=up(min.height);
  if(x&&x+w>width){y+=row+gap;x=0;row=0;}parts.push(make(id,{x,y,width:Math.min(x?width-x:w,width),height:h}));x+=w+gap;row=Math.max(row,h);}
 if(controls.length)y+=row+gap;
 const horizontal=bodies.length>0&&bodies.reduce((n,id)=>n+up(minimumPart(id,metrics).width),0)+gap*(bodies.length-1)<=width;
 const minHeight=horizontal?Math.max(0,...bodies.map(id=>up(minimumPart(id,metrics).height))):bodies.reduce((n,id)=>n+up(minimumPart(id,metrics).height)+gap,0);
 const height=up(Math.max(size.height,y+minHeight));x=0;
 for(const id of bodies){const w=horizontal?(id===bodies.at(-1)?width-x:up(minimumPart(id,metrics).width)+Math.floor((width-gap*(bodies.length-1)-bodies.reduce((n,b)=>n+up(minimumPart(b,metrics).width),0))/bodies.length/gap)*gap):width,h=horizontal?height-y:up(Math.max(minimumPart(id,metrics).height,(height-y-gap*(bodies.length-1))/bodies.length));parts.push(make(id,{x,y,width:w,height:h}));if(horizontal)x+=w+gap;else y+=h+gap;}
 return {width,height,parts};
}
export function fitAppLayout(layout:AppLayout,width:number,height:number,metrics:PartMinimums={}):AppLayout {
 const w=up(Math.max(width,...layout.parts.map(p=>minimumPart(p.id,metrics).width))),h=up(Math.max(height,...layout.parts.map(p=>minimumPart(p.id,metrics).height)));
 const parts=layout.parts.map(p=>{const min=minimumPart(p.id,metrics);return {...p,x:grid(p.x*w/layout.width),y:grid(p.y*h/layout.height),width:up(Math.max(min.width,p.width*w/layout.width)),height:up(Math.max(min.height,p.height*h/layout.height))};});
 const scaled={width:w,height:h,parts};if(parts.every(p=>validPlacement(scaled,p,metrics)))return scaled;
 // Repack only when scaling plus native minimum sizes cannot preserve the original positions.
 const app=BUILDABLE_APPS.find(a=>parts.every(p=>allAppParts(a).includes(p.id)))??'files';
 return recommendedLayout(app,parts.map(p=>p.id),{width:w,height:h},metrics,layout);
}
export function changePart(layout:AppLayout,id:AppPartId,patch:Partial<Rect & Pick<AppPart,'color'|'fontSize'|'rowHeight'|'striped'>>,metrics:PartMinimums={}):AppLayout {
 const part=layout.parts.find(p=>p.id===id);if(!part)return layout;
 const next={...part,...patch};for(const k of ['x','y','width','height'] as const)next[k]=grid(next[k]);
 if(!/^#[0-9a-f]{6}$/i.test(next.color)||![10,12,14,16].includes(next.fontSize)||![20,24,28,32].includes(next.rowHeight)||typeof next.striped!=='boolean'||!validPlacement(layout,next,metrics))return layout;
 return {...layout,parts:layout.parts.map(p=>p.id===id?next:p)};
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validLayout(v:unknown,app:BuiltApp):v is AppLayout {
 if(!obj(v)||!Number.isFinite(v.width)||!Number.isFinite(v.height)||(v.width as number)<160||(v.height as number)<100||(v.width as number)>1920||(v.height as number)>1080||!Array.isArray(v.parts)||v.parts.length>allAppParts(app).length)return false;
 if(!v.parts.every(p=>obj(p)&&allAppParts(app).includes(p.id as AppPartId)&&['x','y','width','height'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&(p[k] as number)%BALANCE.appBuild.grid===0)&&typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)&&[10,12,14,16].includes(p.fontSize as number)&&[20,24,28,32].includes(p.rowHeight as number)&&typeof p.striped==='boolean'))return false;
 const layout=v as unknown as AppLayout;return new Set(layout.parts.map(p=>p.id)).size===layout.parts.length&&layout.parts.every(p=>validPlacement(layout,p));
}
export function migrateAppProjects(apps:BuiltApp[],upgrades:DesktopUpgrade[],skills:readonly string[]=[]):AppProjects {
 return Object.fromEntries(BUILDABLE_APPS.filter(app=>upgrades.includes(app)).map(app=>{const crafted=[...APP_PARTS[app].base,...APP_PARTS[app].features.filter(id=>upgrades.includes(id)||app==='mail'&&id==='folders'&&skills.includes('sortMail'))] as AppPartId[],layout=recommendedLayout(app,crafted);return [app,{crafted,draft:layout,installed:apps.includes(app)?structuredClone(layout):null,undo:[],redo:[]}];}));
}
export function repairAppProjects(raw:unknown,apps:BuiltApp[],upgrades:DesktopUpgrade[],skills:readonly string[]=[]):AppProjects {
 const fallback=migrateAppProjects(apps,upgrades,skills);if(!obj(raw))return fallback;
 for(const app of BUILDABLE_APPS){const p=raw[app];if(!fallback[app]||!obj(p)||!Array.isArray(p.crafted)||!p.crafted.every(id=>allAppParts(app).includes(id as AppPartId))||new Set(p.crafted).size!==p.crafted.length||!validLayout(p.draft,app)||!(p.installed===null&&!apps.includes(app)||validLayout(p.installed,app))||!Array.isArray(p.undo)||!Array.isArray(p.redo)||p.undo.length>BALANCE.appBuild.history||p.redo.length>BALANCE.appBuild.history||![...p.undo,...p.redo].every(l=>validLayout(l,app)))continue;
  const project=p as unknown as AppProject;
  if([project.draft,...(project.installed?[project.installed]:[]),...project.undo,...project.redo].some(l=>l.parts.some(part=>!project.crafted.includes(part.id))))continue;
  fallback[app]=project;
 }
 return fallback;
}

export function placeAppPart(layout:AppLayout,id:AppPartId,metrics:PartMinimums={},rect?:Rect):AppLayout {
 if(layout.parts.some(p=>p.id===id))return layout;const min=minimumPart(id,metrics),part:AppPart={id,x:0,y:0,width:up(min.width),height:up(min.height),color:'#ffffff',fontSize:12,rowHeight:24,striped:false,...rect};
 if(rect)return validPlacement(layout,part,metrics)?{...layout,parts:[...layout.parts,part]}:layout;
 for(let y=0;y+part.height<=layout.height;y+=BALANCE.appBuild.grid)for(let x=0;x+part.width<=layout.width;x+=BALANCE.appBuild.grid){const candidate={...part,x,y};if(validPlacement(layout,candidate,metrics))return {...layout,parts:[...layout.parts,candidate]};}
 return layout;
}
