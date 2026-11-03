import { BALANCE } from '../config/balance';
import { APP_RECIPES, type AppSlotRole } from '../content/appRecipes';
import { WORKSHOP_PARTS, type WorkshopPartId } from '../content/workshopCatalog';
import type { BuiltApp, Rect } from './desktopState';
import type { GameState } from './state';
import { isComponentDesign, type ComponentDesign } from './workshopState';

export interface AssemblyMaterial { source:WorkshopPartId; design:ComponentDesign; elements:string[] }
export interface AssemblySlot extends AssemblyMaterial { role:AppSlotRole; rect:Rect }
export interface AppAssembly {
 app:BuiltApp; version:GameState['run']['version']; width:number; height:number;
 common:AssemblyMaterial[]; slots:AssemblySlot[]; legacy?:boolean;
}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const ids=new Set(WORKSHOP_PARTS.map(p=>p.id));
export function validAssemblyMaterial(p:unknown,legacy=false):p is AssemblyMaterial {
 return obj(p)&&typeof p.source==='string'&&ids.has(p.source as WorkshopPartId)&&Array.isArray(p.elements)&&p.elements.every(e=>typeof e==='string'&&WORKSHOP_PARTS.find(def=>def.id===p.source)?.elements.includes(e))&&new Set(p.elements).size===p.elements.length&&WORKSHOP_PARTS.find(def=>def.id===p.source)!.elements.every(element=>(p.elements as string[]).includes(element))&&(isComponentDesign(p.design)||legacy&&obj(p.design)&&finite(p.design.fontSize)&&p.design.fontSize>=10&&p.design.fontSize<=BALANCE.pageDesign.buttonFontMax&&isComponentDesign({...p.design,fontSize:BALANCE.workshop.design.fontSize}));
}
/** The scrollbar material merged into the frame (2026-11): fold a legacy common-material list into the frame's. */
export function foldLegacyAssemblyMaterials(common:AssemblyMaterial[]):AssemblyMaterial[] {
 const scroll=common.find(p=>(p.source as string)==='common-scrollbar');if(!scroll)return common;
 const rest=common.filter(p=>(p.source as string)!=='common-scrollbar');
 const frame=rest.find(p=>p.source==='common-frame');
 if(frame)return rest.map(p=>p===frame?{...frame,elements:[...WORKSHOP_PARTS.find(d=>d.id==='common-frame')!.elements],design:{...frame.design,scrollbarWidth:scroll.design.scrollbarWidth,arrows:scroll.design.arrows}}:p);
 const frameDef=WORKSHOP_PARTS.find(p=>p.id==='common-frame')!;
 return [...rest,{source:'common-frame' as WorkshopPartId,design:scroll.design,elements:[...frameDef.elements]}];
}
/** Frozen recordings keep the legacy scrollbar material; validate them through a virtual fold. */
export function validFrozenAppAssembly(x:unknown,app:BuiltApp):x is AppAssembly {
 if(validAppAssembly(x,app))return true;
 if(!obj(x)||!Array.isArray(x.common)||!x.common.some(p=>obj(p)&&(p.source as string)==='common-scrollbar'))return false;
 return validAppAssembly({...x,common:foldLegacyAssemblyMaterials(x.common as AssemblyMaterial[])},app);
}
export function validAppAssembly(x:unknown,app:BuiltApp):x is AppAssembly {
 if(!obj(x)||x.app!==app||!['v0.1','v1','v2'].includes(x.version as string)||!finite(x.width)||!finite(x.height)||x.width<BALANCE.appBuild.minWidth||x.height<BALANCE.appBuild.minHeight||x.width>BALANCE.appBuild.maxWidth||x.height>BALANCE.appBuild.maxHeight||!Array.isArray(x.common)||!Array.isArray(x.slots)||(x.legacy!==undefined&&typeof x.legacy!=='boolean'))return false;
 if(x.common.length>WORKSHOP_PARTS.filter(p=>p.set==='common').length||new Set(x.common.map(p=>obj(p)?p.source:null)).size!==x.common.length)return false;
 const material=(p:unknown):boolean=>validAssemblyMaterial(p,x.legacy===true);
 if(!x.common.every(p=>material(p)&&String(p.source).startsWith('common-')))return false;
 const recipe=APP_RECIPES[app] as Record<string,WorkshopPartId>,slots=x.slots;
 if(x.slots.length>Object.keys(recipe).length||new Set(x.slots.map(p=>obj(p)?p.role:null)).size!==x.slots.length)return false;
 return slots.every(p=>material(p)&&typeof p.role==='string'&&recipe[p.role]===p.source&&obj(p.rect)&&['x','y','width','height'].every(k=>finite((p.rect as Record<string,unknown>)[k])&&Number((p.rect as Record<string,unknown>)[k])%BALANCE.appBuild.grid===0)&&p.rect.x>=0&&p.rect.y>=0&&p.rect.width>=BALANCE.appBuild.controlMinWidth&&p.rect.height>0&&p.rect.x+p.rect.width<=Number(x.width)&&p.rect.y+p.rect.height<=Number(x.height))&&slots.every((a,i)=>slots.every((b,j)=>i===j||!(a.rect.x<b.rect.x+b.rect.width&&a.rect.x+a.rect.width>b.rect.x&&a.rect.y<b.rect.y+b.rect.height&&a.rect.y+a.rect.height>b.rect.y)));
}

export function validLegacyMaterials(value:unknown,app:BuiltApp):value is AssemblyMaterial[]{const sources=new Set([...Object.values(APP_RECIPES[app]),...WORKSHOP_PARTS.filter(p=>p.set==='common').map(p=>p.id)]);return Array.isArray(value)&&new Set(value.map(p=>obj(p)?p.source:null)).size===value.length&&value.every(p=>validAssemblyMaterial(p,true)&&sources.has(p.source));}
