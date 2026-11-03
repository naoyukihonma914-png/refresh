import { BALANCE } from '../config/balance';
import { APP_RECIPES, APP_REQUIRED, slotRoles, sourceForSlot, type AppSlotRole } from '../content/appRecipes';
import { WORKSHOP_PARTS, type WorkshopPartId, type UiSetId } from '../content/workshopCatalog';
import { APP_PARTS,fitAppLayout, recommendedLayout, readableText, type AppLayout, type AppPart, type AppProject, type PartMinimums } from './appLayout';
import type { AppAssembly, AssemblyMaterial, AssemblySlot } from './appAssemblySchema';
import { createComponentDesign, type ComponentDesign } from './workshopState';
import type { BuiltApp, Rect } from './desktopState';
import type { GameState } from './state';
export type { AppAssembly,AssemblySlot,AssemblyMaterial } from './appAssemblySchema';
export { validAppAssembly } from './appAssemblySchema';
export function availableAssemblyRoles(s:GameState,app:BuiltApp):AppSlotRole[]{return slotRoles(app).filter(role=>s.run.workshop.parts[sourceForSlot(app,role)!]?.step===4);}
export function availableAssemblySources(s:GameState,app:BuiltApp):WorkshopPartId[]{return [...new Set(availableAssemblyRoles(s,app).map(role=>sourceForSlot(app,role)!))];}
function commonMaterials(s:GameState,legacy=false):AssemblyMaterial[]{return WORKSHOP_PARTS.filter(p=>p.set==='common'&&(legacy||s.run.workshop.parts[p.id]?.step===4)&&!(p.id==='common-scrollbar'&&!legacy&&s.run.workshop.parts['common-frame']?.fitting&&s.run.workshop.parts['common-frame']?.step===4)).map(p=>{const production=s.run.workshop.parts[p.id];return {source:p.id,design:production?.step===4?structuredClone(production.design):createComponentDesign(),elements:[...(production?.step===4?production.elements:p.elements)],...(production?.step===4&&production.fitting?{fitting:structuredClone(production.fitting)}:{}),...(!legacy&&production?.step===4&&production.createdStage!==undefined?{createdStage:production.createdStage}:{})};});}
function slotFromPart(s:GameState,app:BuiltApp,part:AppPart,legacy=false):AssemblySlot|null {
 const source=sourceForSlot(app,part.id);if(!source)return null;const production=s.run.workshop.parts[source];if(!legacy&&production?.step!==4)return null;
 const design:ComponentDesign=legacy?{...createComponentDesign(),nativeColors:false,color:part.color,textColor:readableText(part.color),fontSize:part.fontSize}:structuredClone(production!.design);
 return {role:part.id,source,elements:[...(production?.step===4?production.elements:WORKSHOP_PARTS.find(p=>p.id===source)!.elements)],...(production?.step===4&&production.fitting?{fitting:structuredClone(production.fitting)}:{}),...(!legacy&&production?.step===4&&production.createdStage!==undefined?{createdStage:production.createdStage}:{}),rect:{x:part.x,y:part.y,width:part.width,height:part.height},design};
}
/** Installable recipes refer to actual completed materials. A role never creates inventory. */
export function createAppAssembly(s:GameState,app:BuiltApp,roles:readonly AppSlotRole[]=availableAssemblyRoles(s,app),metrics:PartMinimums={},previous?:AppAssembly):AppAssembly {
 const layout=recommendedLayout(app,[...new Set(roles)].filter(role=>availableAssemblyRoles(s,app).includes(role)),undefined,metrics,previous?assemblyLayout(previous):undefined);
 const madeCommon=commonMaterials(s),common=previous?[...structuredClone(previous.common),...madeCommon.filter(material=>!previous.common.some(old=>old.source===material.source))]:madeCommon;
 return {app,version:s.run.version,width:layout.width,height:layout.height,common,slots:layout.parts.flatMap(part=>{const slot=slotFromPart(s,app,part),old=previous?.slots.find(p=>p.role===part.id);return slot?[old?{...structuredClone(old),rect:slot.rect}:slot]:[];})};
}
export function legacyAppAssembly(s:GameState,app:BuiltApp,layout:AppLayout):AppAssembly {
 const aliases:Partial<Record<BuiltApp,Record<string,AppSlotRole[]>>>={theme:{appearance:['accent','radius']},terminal:{commands:['interval','run'],output:['history']},manager:{processes:['performance']},mail:{messages:['unread']}};
 const expanded=[...new Set(layout.parts.flatMap(p=>[p.id,...(aliases[app]?.[p.id]??[])]))];
 const geometry=expanded.length===layout.parts.length?layout:recommendedLayout(app,expanded,{width:layout.width,height:layout.height},{},layout);
 return {app,version:s.run.version,width:geometry.width,height:geometry.height,legacy:true,common:commonMaterials(s,true),slots:geometry.parts.flatMap(part=>{
  const parent=layout.parts.find(p=>(aliases[app]?.[p.id]??[]).includes(part.id)),styled=parent?{...part,color:parent.color,fontSize:parent.fontSize,rowHeight:parent.rowHeight,striped:parent.striped}:part;
  const slot=slotFromPart(s,app,styled,true);return slot?[slot]:[];
 })};
}
export function assemblyLayout(assembly:AppAssembly,previous?:AppLayout):AppLayout {
 return {width:assembly.width,height:assembly.height,parts:assembly.slots.map(slot=>{const saved=previous?.parts.find(p=>p.id===slot.role);return {id:slot.role,...slot.rect,color:slot.design.color,fontSize:slot.design.fontSize,rowHeight:saved?.rowHeight??Math.max(BALANCE.appBuild.controlMinHeight/2,slot.design.fontSize+BALANCE.appBuild.grid),striped:saved?.striped??false};})};
}
/** Transfer a geometry edit without replacing a made part with an anonymous rectangle. */
export function assemblyWithLayout(assembly:AppAssembly,layout:AppLayout):AppAssembly{return {...assembly,width:layout.width,height:layout.height,slots:layout.parts.flatMap(part=>{const slot=assembly.slots.find(p=>p.role===part.id);return slot?[{...slot,rect:{x:part.x,y:part.y,width:part.width,height:part.height}}]:[];})};}
export function installedAssembly(s:GameState,app:BuiltApp):AppAssembly|null {const project=s.run.desktop.projects[app];if(project?.installedAssembly!==undefined)return project.installedAssembly;return project?.installed?legacyAppAssembly(s,app,project.installed):null;}
export function adoptedPartIds(s:GameState,app:BuiltApp):WorkshopPartId[]{if(!s.run.desktop.apps.includes(app))return [];const assembly=installedAssembly(s,app);return assembly?[...new Set([...assembly.common.map(p=>p.source),...assembly.slots.map(p=>p.source)])]:[];}
export function adoptedFeaturePartIds(s:GameState,app:BuiltApp):WorkshopPartId[]{const assembly=installedAssembly(s,app),features=APP_PARTS[app].features as readonly string[];if(!assembly||!s.run.desktop.apps.includes(app))return [];return [...new Set(assembly.slots.filter(slot=>features.includes(slot.role)).map(slot=>slot.source))];}
export function appIsOperational(s:GameState,app:BuiltApp):boolean {const assembly=installedAssembly(s,app);return s.run.desktop.apps.includes(app)&&!!assembly&&APP_REQUIRED[app].every(role=>assembly.slots.some(slot=>slot.role===role));}
export interface InstalledAppPart {sourcePartId:WorkshopPartId;role:AppSlotRole;rect:Rect;design:ComponentDesign;rowHeight:number;striped:boolean}
export function getInstalledAppParts(s:GameState,app:BuiltApp,width?:number,height?:number,metrics:PartMinimums={}):InstalledAppPart[]{
 const assembly=installedAssembly(s,app);if(!assembly)return [];const saved=s.run.desktop.projects[app]?.installed,layout=assemblyLayout(assembly,saved??undefined);
 const fitted=width!==undefined&&height!==undefined?fitAppLayout(layout,width,height,metrics):layout;
 return fitted.parts.flatMap(part=>{const slot=assembly.slots.find(p=>p.role===part.id);return slot?[{sourcePartId:slot.source,role:slot.role,rect:{x:part.x,y:part.y,width:part.width,height:part.height},design:slot.design,rowHeight:part.rowHeight,striped:part.striped}]:[];});
}
export function legacyMaterialsFor(s:GameState,app:BuiltApp,project:AppProject):AssemblyMaterial[]{
 if(project.legacyMaterials)return project.legacyMaterials;
 const historical=legacyAppAssembly(s,app,recommendedLayout(app,project.crafted,undefined,{},project.draft));
 const materials=[...historical.common,...historical.slots];
 return [...new Map(materials.map(material=>[material.source,{source:material.source,design:structuredClone(material.design),elements:[...material.elements],...(material.fitting?{fitting:structuredClone(material.fitting)}:{}),...(material.createdStage!==undefined?{createdStage:material.createdStage}:{})}])).values()];
}
/** Compatibility adoption preserves paid native apps; it never manufactures workshop productions. */
export function migrateAppAssemblies(s:GameState):GameState {
 const projects={...s.run.desktop.projects};for(const app of Object.keys(APP_RECIPES) as BuiltApp[]){const project=projects[app];if(!project)continue;const draft=project.draftAssembly??legacyAppAssembly(s,app,project.draft),installed=project.installedAssembly!==undefined?project.installedAssembly:project.installed?legacyAppAssembly(s,app,project.installed):null;projects[app]={...project,crafted:[...new Set([...project.crafted,...draft.slots.map(p=>p.role),...(installed?.slots.map(p=>p.role)??[])])],draft:assemblyLayout(draft,project.draft),installed:installed?assemblyLayout(installed,project.installed??undefined):null,draftAssembly:draft,installedAssembly:installed,legacyMaterials:project.legacyMaterials??legacyMaterialsFor(s,app,project),assemblyUndo:project.assemblyUndo??project.undo.map(l=>legacyAppAssembly(s,app,l)),assemblyRedo:project.assemblyRedo??project.redo.map(l=>legacyAppAssembly(s,app,l))};}
 return {...s,run:{...s.run,desktop:{...s.run.desktop,projects}}};
}

export const blueprintAppForSet=(set:UiSetId):BuiltApp|null=>Object.hasOwn(APP_RECIPES,set)?set as BuiltApp:null;
export const eligibleBlueprintApps=(s:GameState):BuiltApp[]=>Object.keys(APP_RECIPES).filter(app=>s.run.workshop.purchasedSets.includes(app as UiSetId)||!!s.run.desktop.projects[app as BuiltApp]) as BuiltApp[];
export const blueprintDocument=(s:GameState,app:BuiltApp)=>eligibleBlueprintApps(s).includes(app)?{app,sourceSet:app,partIds:[...new Set(Object.values(APP_RECIPES[app]))]}:null;
