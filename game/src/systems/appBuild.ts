import { BALANCE, type DesktopUpgrade } from '../config/balance';
import { paletteFor } from '../content/kumikiArt';
import type { BuiltApp } from './desktopState';
import type { GameState } from './state';
import { APP_PARTS, allAppParts, changePart, fitAppLayout, placeAppPart, emptyProject, recommendedLayout, validLayout, type AppPartId, type AppLayout, type AppProject, type PartMinimums } from './appLayout';
export const hasAppPart=(s:GameState,app:BuiltApp,id:string)=>s.run.desktop.apps.includes(app)&&(s.run.desktop.projects?.[app]?.installed?.parts.some(p=>p.id===id)??!s.run.desktop.projects?.[app]);
export const functionalApp=(s:GameState,app:BuiltApp)=>APP_PARTS[app].base.every(id=>hasAppPart(s,app,id));
export type AppBuildAction=
 |{type:'app-fit'|'app-close'|'app-edit'|'app-recommend'|'app-undo'|'app-redo'|'app-revert'|'app-install';app:BuiltApp;metrics?:PartMinimums}
 |{type:'app-craft'|'app-place'|'app-remove';app:BuiltApp;part:AppPartId;rect?:import('./desktopState').Rect;metrics?:PartMinimums}
 |{type:'app-change';app:BuiltApp;part:AppPartId;patch:Parameters<typeof changePart>[2];metrics?:PartMinimums};
export function actAppBuild(s:GameState,a:AppBuildAction):GameState {
 const d=s.run.desktop,project=d.projects[a.app];if(!project||!d.upgrades.includes(a.app))return s;
 const update=(p:AppProject):GameState=>({...s,run:{...s.run,desktop:{...d,projects:{...d.projects,[a.app]:p}}}});
 const edit=(draft:AppLayout,crafted=project.crafted)=>draft===project.draft?s:update({...project,crafted,draft,undo:[...project.undo,project.draft].slice(-BALANCE.appBuild.history),redo:[]});
 if(a.type==='app-fit'){const draft=fitAppLayout(project.draft,project.draft.width,project.draft.height,a.metrics);return JSON.stringify(draft)===JSON.stringify(project.draft)?s:update({...project,draft});}
 if(a.type==='app-close')return {...s,run:{...s.run,desktop:{...d,editingApp:null}}};
 if(a.type==='app-edit')return {...s,run:{...s.run,kumiki:{...s.run.kumiki,workspace:'compose'},desktop:{...d,editingApp:a.app}}};
 if(a.type==='app-recommend'){const crafted=[...new Set([...project.crafted,...APP_PARTS[a.app].base])] as AppPartId[];return edit(recommendedLayout(a.app,crafted,undefined,a.metrics,project.draft),crafted);}
 if(a.type==='app-craft'){
  if(!(APP_PARTS[a.app].base as readonly string[]).includes(a.part)||project.crafted.includes(a.part))return s;
  return update({...project,crafted:[...project.crafted,a.part]});
 }
 if(a.type==='app-place'){
  if(!project.crafted.includes(a.part)||project.draft.parts.some(p=>p.id===a.part))return s;
  return edit(placeAppPart(project.draft,a.part,a.metrics,a.rect));
 }
 if(a.type==='app-remove')return edit({...project.draft,parts:project.draft.parts.filter(p=>p.id!==a.part)});
 if(a.type==='app-change'){
  if(a.patch.color&&!paletteFor(s.persistent.specs.color).includes(a.patch.color))return s;
  return edit(changePart(project.draft,a.part,a.patch,a.metrics));
 }
 if(a.type==='app-undo'||a.type==='app-redo'){
  const source=a.type==='app-undo'?'undo':'redo',dest=a.type==='app-undo'?'redo':'undo',draft=project[source].at(-1);if(!draft)return s;
  return update({...project,draft,[source]:project[source].slice(0,-1),[dest]:[...project[dest],project.draft].slice(-BALANCE.appBuild.history)});
 }
 if(a.type==='app-revert')return project.installed?edit(structuredClone(project.installed)):s;
 if(a.type==='app-install'){
  if(!validLayout(project.draft,a.app)||project.draft.parts.some(p=>!project.crafted.includes(p.id)))return s;
  const next=update({...project,installed:structuredClone(project.draft)});
  return {...next,run:{...next.run,desktop:{...next.run.desktop,apps:[...new Set([...d.apps,a.app])],editingApp:null}}};
 }
 return s;
}
export function ownAppBlueprint(s:GameState,app:BuiltApp):GameState {
 const project=emptyProject();if(app==='mail'&&s.persistent.desktopPrefs.skills.includes('sortMail'))project.crafted.push('folders');
 return {...s,run:{...s.run,kumiki:{...s.run.kumiki,workspace:'compose'},desktop:{...s.run.desktop,editingApp:app,projects:{...s.run.desktop.projects,[app]:project}}}};
}
export function ownFeaturePart(s:GameState,id:DesktopUpgrade,app:BuiltApp):GameState {
 const p=s.run.desktop.projects?.[app];if(!p||!allAppParts(app).includes(id as AppPartId))return s;
 return {...s,run:{...s.run,kumiki:{...s.run.kumiki,workspace:'compose'},desktop:{...s.run.desktop,editingApp:app,projects:{...s.run.desktop.projects,[app]:{...p,crafted:[...new Set([...p.crafted,id as AppPartId])]}}}}};
}
export function appLayoutBonus(s:GameState):number {
 const installed=s.run.desktop.apps.map(app=>s.run.desktop.projects?.[app]?.installed).filter((v):v is AppLayout=>!!v&&v.parts.length>0);
 const aligned=installed.filter(l=>l.parts.every(p=>[p.x,p.x+p.width].some(edge=>[0,Math.floor(l.width/2/BALANCE.appBuild.grid)*BALANCE.appBuild.grid-BALANCE.appBuild.grid,Math.floor(l.width/2/BALANCE.appBuild.grid)*BALANCE.appBuild.grid,l.width].includes(edge)))).length;
 return installed.length?1+BALANCE.appBuild.layoutBonus*aligned/installed.length:1;
}

export function missingFeedbackPart(s:GameState,kind:string):{app:BuiltApp;part:AppPartId}|null {
 const requirements:Record<string,[BuiltApp,AppPartId[]]>={sort:['files',['list','sort']],search:['files',['list','search']],bright:['photo',['image','brightness','wallpaper']],trash:['bin',['trash']],timer:['clock',['timer']],dark:['theme',['appearance']]};
 const required=requirements[kind];if(!required||!s.run.desktop.projects[required[0]])return null;
 const part=required[1].find(id=>!hasAppPart(s,required[0],id));return part?{app:required[0],part}:null;
}

export function missingConditionParts(s:GameState,checks:readonly boolean[]):{app:BuiltApp;part:AppPartId}[] {
 const needs:{app:BuiltApp;part:AppPartId}[]=[];
 const add=(app:BuiltApp,parts:readonly AppPartId[])=>{if(!s.run.desktop.projects[app])return;const part=parts.find(id=>!hasAppPart(s,app,id));if(part&&!needs.some(n=>n.app===app&&n.part===part))needs.push({app,part});};
 if(!checks[0])for(const app of s.run.desktop.apps)add(app,APP_PARTS[app].base);
 if(!checks[3])add('photo',['image','wallpaper']);
 if(!checks[4])add('terminal',['commands']);
 return needs;
}
