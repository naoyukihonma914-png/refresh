import { BALANCE,type DesktopUpgrade } from '../config/balance';
import { sourceForSlot } from '../content/appRecipes';
import { paletteFor } from '../content/palette';
import { APP_PARTS,allAppParts,recommendedLayout,changePart,emptyLayout,fitAppLayout,placeAppPart,validLayout,type AppLayout,type AppPartId,type AppProject,type PartMinimums } from './appLayout';
import { appIsOperational,assemblyLayout,assemblyWithLayout,availableAssemblyRoles,createAppAssembly,installedAssembly,legacyAppAssembly,legacyMaterialsFor,type AppAssembly } from './appAssembly';
import { validAppAssembly } from './appAssemblySchema';
import { adjustComponentDesign, type ComponentDesign } from './workshopState';
import type { BuiltApp } from './desktopState';
import type { GameState } from './state';
import { actWorkshop } from './workshop';
export const hasAppPart=(s:GameState,app:BuiltApp,id:string)=>s.run.desktop.apps.includes(app)&&(installedAssembly(s,app)?.slots.some(slot=>slot.role===id)??false);
export const functionalApp=appIsOperational;
export type AppChangePatch=Parameters<typeof changePart>[2]&Partial<Pick<ComponentDesign,'nativeColors'|'radius'|'shadow'>>;
export type AppBuildAction=
 |{type:'app-fit'|'app-refresh'|'app-close'|'app-edit'|'app-recommend'|'app-undo'|'app-redo'|'app-revert'|'app-install';app:BuiltApp;metrics?:PartMinimums}
 |{type:'app-craft'|'app-place'|'app-remove';app:BuiltApp;part:AppPartId;rect?:import('./desktopState').Rect;metrics?:PartMinimums}
 |{type:'app-change';app:BuiltApp;part:AppPartId;patch:AppChangePatch;metrics?:PartMinimums};

function normalizedProject(s:GameState,app:BuiltApp):AppProject|null {
 const stored=s.run.desktop.projects[app];if(!stored)return null;
 const legacyMaterials=stored.legacyMaterials??(stored.installedAssembly?.legacy||stored.draftAssembly?.legacy||stored.installedAssembly===undefined?legacyMaterialsFor(s,app,stored):[]);
 return {...stored,legacyMaterials,crafted:[...new Set([...availableAssemblyRoles(s,app),...allAppParts(app).filter(role=>legacyMaterials.some(material=>material.source===sourceForSlot(app,role)))])],draftAssembly:stored.draftAssembly??legacyAppAssembly(s,app,stored.draft),installedAssembly:installedAssembly(s,app),assemblyUndo:stored.assemblyUndo??stored.undo.map(layout=>legacyAppAssembly(s,app,layout)),assemblyRedo:stored.assemblyRedo??stored.redo.map(layout=>legacyAppAssembly(s,app,layout))};
}
/** Source selection and native placement are separate from making a material. Neither spends pixels. */
export function actAppBuild(s:GameState,a:AppBuildAction):GameState {
 const d=s.run.desktop;let project=normalizedProject(s,a.app);
 if(!project){if(a.type==='app-edit'&&s.run.workshop.purchasedSets.includes(a.app))return actAppBuild(ownAppBlueprint(s,a.app),a);return s;}
 const update=(p:AppProject):GameState=>({...s,run:{...s.run,desktop:{...d,projects:{...d.projects,[a.app]:p}}}});
 const draftAssembly=project.draftAssembly!;
 const edit=(draft:AppLayout,assembly:AppAssembly=assemblyWithLayout(draftAssembly,draft)):GameState=>{
  if(JSON.stringify(draft)===JSON.stringify(project!.draft)&&JSON.stringify(assembly)===JSON.stringify(draftAssembly))return s;
  return update({...project!,draft,draftAssembly:assembly,undo:[...project!.undo,project!.draft].slice(-BALANCE.appBuild.history),redo:[],assemblyUndo:[...project!.assemblyUndo!,draftAssembly].slice(-BALANCE.appBuild.history),assemblyRedo:[]});
 };
 if(a.type==='app-close')return {...s,run:{...s.run,desktop:{...d,editingApp:null}}};
 if(a.type==='app-edit')return {...s,run:{...s.run,workshop:{...s.run.workshop,view:'workbench'},desktop:{...d,editingApp:a.app,projects:{...d.projects,[a.app]:project}}}};
 if(a.type==='app-fit'){const draft=fitAppLayout(project.draft,project.draft.width,project.draft.height,a.metrics);return JSON.stringify(draft)===JSON.stringify(project.draft)?s:update({...project,draft,draftAssembly:assemblyWithLayout(draftAssembly,draft)});}
 if(a.type==='app-refresh'){
  const refreshed=createAppAssembly(s,a.app,project.draft.parts.map(p=>p.id),a.metrics);
  const slots=draftAssembly.slots.map(slot=>{const latest=refreshed.slots.find(p=>p.role===slot.role);return latest?{...structuredClone(latest),rect:slot.rect}:slot;});
  const assembly={...draftAssembly,common:[...draftAssembly.common.map(old=>refreshed.common.find(next=>next.source===old.source)??old),...refreshed.common.filter(next=>!draftAssembly.common.some(old=>old.source===next.source))],slots};
  const draft=fitAppLayout(assemblyLayout(assembly,project.draft),assembly.width,assembly.height,a.metrics);
  return edit(draft,assemblyWithLayout(assembly,draft));
 }
 if(a.type==='app-recommend'){
  const assembly=createAppAssembly(s,a.app,project.crafted,a.metrics,draftAssembly);
  if(project.legacyMaterials?.length){
   const geometry=recommendedLayout(a.app,project.crafted,undefined,a.metrics,project.draft);
   for(const part of geometry.parts){if(assembly.slots.some(p=>p.role===part.id))continue;const source=sourceForSlot(a.app,part.id),material=project.legacyMaterials.find(p=>p.source===source);if(material)assembly.slots.push({...structuredClone(material),role:part.id,rect:{x:part.x,y:part.y,width:part.width,height:part.height}});}
   assembly.slots=assembly.slots.map(slot=>{const part=geometry.parts.find(p=>p.id===slot.role)!;return {...slot,rect:{x:part.x,y:part.y,width:part.width,height:part.height}};});assembly.width=geometry.width;assembly.height=geometry.height;assembly.legacy=true;
  }
  const geometry=fitAppLayout(assemblyLayout(assembly,project.draft),assembly.width,assembly.height,a.metrics);
  return edit(geometry,assemblyWithLayout(assembly,geometry));
 }
 if(a.type==='app-craft'){
  const source=sourceForSlot(a.app,a.part);if(!source||!s.run.workshop.parts[source])return s;
  const next=actWorkshop(s,{type:'selectPart',part:source},s.lastTickAt);return {...next,run:{...next.run,desktop:{...next.run.desktop,editingApp:null}}};
 }
 if(a.type==='app-place'){
  if(project.draft.parts.some(part=>part.id===a.part)||!project.crafted.includes(a.part))return s;
  const source=sourceForSlot(a.app,a.part),production=source?s.run.workshop.parts[source]:undefined;
  const legacyMaterial=project.legacyMaterials?.find(material=>material.source===source);
  if(!source||production?.step!==4&&!legacyMaterial)return s;
  const draft=placeAppPart(project.draft,a.part,a.metrics,a.rect);if(draft===project.draft)return s;
  const placed=draft.parts.find(p=>p.id===a.part)!;
  const material=production?.step===4?production:legacyMaterial!;
  const assembly={...draftAssembly,slots:[...draftAssembly.slots,{role:a.part,source,rect:{x:placed.x,y:placed.y,width:placed.width,height:placed.height},design:structuredClone(material.design),elements:[...material.elements],...(material.fitting?{fitting:structuredClone(material.fitting)}:{})}]};
  return edit(assemblyLayout(assembly,draft),assembly);
 }
 if(a.type==='app-remove'){
  const draft={...project.draft,parts:project.draft.parts.filter(part=>part.id!==a.part)};
  return edit(draft,{...draftAssembly,slots:draftAssembly.slots.filter(slot=>slot.role!==a.part)});
 }
 if(a.type==='app-change'){
  const slot=draftAssembly.slots.find(p=>p.role===a.part);if(!slot)return s;
  const designPatch={...(a.patch.color?{color:a.patch.color}:{}),...(a.patch.fontSize!==undefined?{fontSize:a.patch.fontSize}:{}),...(a.patch.nativeColors!==undefined?{nativeColors:a.patch.nativeColors}:{}),...(a.patch.radius!==undefined?{radius:a.patch.radius}:{}),...(a.patch.shadow!==undefined?{shadow:a.patch.shadow}:{})};
  if(a.patch.color&&!paletteFor(s.persistent.specs.color).includes(a.patch.color))return s;
  const font=designPatch.fontSize??slot.design.fontSize,legacyFont=draftAssembly.legacy&&font>=10&&font<=BALANCE.pageDesign.buttonFontMax;
  const safeFont=(value:number)=>Math.max(BALANCE.workshop.design.fontSizeMin,Math.min(BALANCE.workshop.design.fontSizeMax,value));
  const adjusted=Object.keys(designPatch).length?adjustComponentDesign(legacyFont?{...slot.design,fontSize:safeFont(slot.design.fontSize)}:slot.design,legacyFont?{...designPatch,fontSize:safeFont(font)}:designPatch,paletteFor(s.persistent.specs.color)):slot.design;
  const design=adjusted&&legacyFont?{...adjusted,fontSize:font}:adjusted;if(!design)return s;
  const geometryPatch=Object.fromEntries(Object.entries(a.patch).filter(([key])=>['x','y','width','height','color','fontSize','rowHeight','striped'].includes(key)));
  let draft=Object.keys(geometryPatch).length?changePart(project.draft,a.part,geometryPatch,a.metrics):project.draft;
  if(Object.keys(geometryPatch).length&&draft===project.draft)return s;
  if(design!==slot.design)draft={...draft,parts:draft.parts.map(p=>p.id===a.part?{...p,color:design.color,fontSize:design.fontSize}:p)};
  const assembly=assemblyWithLayout(draftAssembly,draft);assembly.slots=assembly.slots.map(p=>p.role===a.part?{...p,design}:p);
  return edit(draft,assembly);
 }
 if(a.type==='app-undo'||a.type==='app-redo'){
  const source=a.type==='app-undo'?'undo':'redo',dest=a.type==='app-undo'?'redo':'undo',sourceAssembly=a.type==='app-undo'?'assemblyUndo':'assemblyRedo',destAssembly=a.type==='app-undo'?'assemblyRedo':'assemblyUndo';
  const draft=project[source].at(-1),assembly=project[sourceAssembly]!.at(-1);if(!draft||!assembly)return s;
  return update({...project,draft,draftAssembly:assembly,[source]:project[source].slice(0,-1),[dest]:[...project[dest],project.draft].slice(-BALANCE.appBuild.history),[sourceAssembly]:project[sourceAssembly]!.slice(0,-1),[destAssembly]:[...project[destAssembly]!,draftAssembly].slice(-BALANCE.appBuild.history)});
 }
 if(a.type==='app-revert')return project.installed&&project.installedAssembly?edit(structuredClone(project.installed),structuredClone(project.installedAssembly)):s;
 if(a.type==='app-install'){
  if(!validLayout(project.draft,a.app)||!validAppAssembly(draftAssembly,a.app))return s;
  const legacyOwned=new Set(project.legacyMaterials?.map(material=>material.source)??[]);
  if(draftAssembly.slots.some(slot=>s.run.workshop.parts[slot.source]?.step!==4&&!legacyOwned.has(slot.source)))return s;
  const next=update({...project,installed:structuredClone(project.draft),installedAssembly:structuredClone(draftAssembly)});
  return {...next,run:{...next.run,desktop:{...next.run.desktop,apps:[...new Set([...d.apps,a.app])],editingApp:null}}};
 }
 return s;
}
export function ownAppBlueprint(s:GameState,app:BuiltApp):GameState {
 if(s.run.desktop.projects[app])return s;
 if(!s.run.workshop.purchasedSets.includes(app)&&!s.run.desktop.upgrades.includes(app)&&!s.run.desktop.apps.includes(app))return s;
 const assembly=createAppAssembly(s,app,[]),project:AppProject={crafted:availableAssemblyRoles(s,app),draft:emptyLayout(),installed:null,undo:[],redo:[],draftAssembly:assembly,installedAssembly:null,assemblyUndo:[],assemblyRedo:[]};
 return {...s,run:{...s.run,workshop:{...s.run.workshop,view:'workbench'},desktop:{...s.run.desktop,upgrades:[...new Set([...s.run.desktop.upgrades,app])],builtAt:{...s.run.desktop.builtAt,[app]:s.run.desktop.builtAt[app]??s.lastTickAt},editingApp:app,projects:{...s.run.desktop.projects,[app]:project}}}};
}
export function ownFeaturePart(s:GameState,_id:DesktopUpgrade,app:BuiltApp):GameState {
 const next=s.run.desktop.projects[app]?s:ownAppBlueprint(s,app);return actAppBuild(next,{type:'app-edit',app});
}
export function missingFeedbackPart(s:GameState,kind:string):{app:BuiltApp;part:AppPartId}|null {
 const requirements:Record<string,[BuiltApp,AppPartId[]]>={sort:['files',['list','sort']],search:['files',['list','search']],bright:['photo',['image','brightness','wallpaper']],trash:['bin',['trash']],timer:['clock',['timer']],dark:['theme',['appearance']]};
 const required=requirements[kind];if(!required||!s.run.desktop.projects[required[0]])return null;const part=required[1].find(id=>!hasAppPart(s,required[0],id));return part?{app:required[0],part}:null;
}
export function missingConditionParts(s:GameState,checks:readonly boolean[]):{app:BuiltApp;part:AppPartId}[] {
 const needs:{app:BuiltApp;part:AppPartId}[]=[];const add=(app:BuiltApp,parts:readonly AppPartId[])=>{if(!s.run.desktop.projects[app])return;const part=parts.find(id=>!hasAppPart(s,app,id));if(part&&!needs.some(n=>n.app===app&&n.part===part))needs.push({app,part});};
 if(!checks[0])for(const app of s.run.desktop.apps)add(app,APP_PARTS[app].base);if(!checks[3])add('photo',['image','wallpaper']);if(!checks[4])add('terminal',['commands','run']);return needs;
}
