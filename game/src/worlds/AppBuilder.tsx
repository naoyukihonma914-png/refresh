import { useRef, useState, useLayoutEffect, type CSSProperties } from 'react';
import { BALANCE } from '../config/balance';
import type { AppBuildAction, AppChangePatch } from '../systems/appBuild';
import { allAppParts,minimumPart,validLayout,validPlacement,type AppPart,type AppPartId } from '../systems/appLayout';
import { availableAssemblyRoles,eligibleBlueprintApps,type AppAssembly } from '../systems/appAssembly';
import { sourceForSlot } from '../content/appRecipes';
import { paletteFor } from '../content/palette';
import type { BuiltApp } from '../systems/desktopState';
import type { DesktopProps } from './desktopTypes';
import { BuiltAppContent } from './Desktop';
import { AppSurface, partLabel, usePartMinimums } from './AppComposition';

/** Assemble completed materials. The installed app stays live until the explicit install transaction. */
export function AppBuilder({app,...props}:DesktopProps&{app:BuiltApp}){
 const {snapshot,runtime,i18n}=props,s=snapshot.state,project=s.run.desktop.projects[app]!;
 const [selected,setSelected]=useState<AppPartId|null>(null),[invalid,setInvalid]=useState(false),[preview,setPreview]=useState<AppPart|null>(null),[scale,setScale]=useState(1);
 const canvas=useRef<HTMLDivElement>(null),drag=useRef<{part:AppPart;x:number;y:number;scale:number;resize:boolean}|null>(null);
 const draft=project.draft,assembly=project.draftAssembly!,part=draft.parts.find(p=>p.id===selected),material=assembly?.slots.find(p=>p.role===selected);
 const {metrics,ruler}=usePartMinimums(draft,i18n,'var(--app-font)',runtime.platform.clock.wallNow());
 const act=(action:AppBuildAction)=>{if(!props.preview)runtime.actDesktop(action);};
 const send=(patch:AppChangePatch)=>{if(part)act({type:'app-change',app,part:part.id,patch,metrics});};
 const finish=()=>{if(!drag.current)return;drag.current=null;if(preview&&validPlacement(draft,preview,metrics)){act({type:'app-change',app,part:preview.id,patch:{x:preview.x,y:preview.y,width:preview.width,height:preview.height},metrics});setInvalid(false);}else setInvalid(true);setPreview(null);};
 const move=(e:React.PointerEvent)=>{const pointer=drag.current;if(!pointer)return;const grid=BALANCE.appBuild.grid,dx=Math.round((e.clientX-pointer.x)/pointer.scale/grid)*grid,dy=Math.round((e.clientY-pointer.y)/pointer.scale/grid)*grid;
  const candidate={...pointer.part,...(pointer.resize?{width:pointer.part.width+dx,height:pointer.part.height+dy}:{x:pointer.part.x+dx,y:pointer.part.y+dy})};setPreview(candidate);setInvalid(!validPlacement(draft,candidate,metrics));};
 const begin=(e:React.PointerEvent<HTMLElement>,p:AppPart,resize=false)=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();setSelected(p.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={part:p,x:e.clientX,y:e.clientY,scale:canvas.current!.getBoundingClientRect().width/draft.width,resize};setPreview(p);setInvalid(false);};
 useLayoutEffect(()=>{act({type:'app-fit',app,metrics});},[app,JSON.stringify(metrics)]);
 useLayoutEffect(()=>{const node=canvas.current;if(!node)return;const measure=()=>setScale(node.clientWidth/draft.width);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[draft.width]);
 const previewProject={...project,installed:draft,installedAssembly:assembly as AppAssembly};
 const previewState={...s,run:{...s.run,desktop:{...s.run.desktop,apps:[...new Set([...s.run.desktop.apps,app])],projects:{...s.run.desktop.projects,[app]:previewProject}}}};
 const previewSnapshot={...snapshot,state:previewState},name=i18n.t(`desktop.app.${app}`),available=[...new Set([...availableAssemblyRoles(s,app),...project.crafted])];
 const unmade=allAppParts(app).find(role=>{const source=sourceForSlot(app,role);return source&&s.run.workshop.parts[source]&&s.run.workshop.parts[source]?.step!==4;});
 const rows=allAppParts(app).filter(role=>available.includes(role)||draft.parts.some(p=>p.id===role)||role===unmade);
 return <section className="app-builder" data-building={app} data-assembly-app={app} data-assembly-adopted={assembly?.slots.map(p=>p.source).join(' ')}>{ruler}
  <header className="builder-toolbar"><label><select aria-label={i18n.t('builder.document',{app:name})} value={app} onChange={e=>{setSelected(null);act({type:'app-edit',app:e.target.value as BuiltApp});}}>{eligibleBlueprintApps(s).map(id=><option key={id} value={id}>{i18n.t('builder.document',{app:i18n.t(`desktop.app.${id}`)})}</option>)}</select></label>
   <button data-assembly-action="recommend" onClick={()=>act({type:'app-recommend',app,metrics})}>{i18n.t('builder.recommended')}</button><button data-assembly-action="refresh" onClick={()=>act({type:'app-refresh',app,metrics})}>{i18n.t('builder.refreshSources')}</button>
   <button disabled={!project.undo.length} onClick={()=>act({type:'app-undo',app})}>{i18n.t('builder.undo')}</button><button disabled={!project.redo.length} onClick={()=>act({type:'app-redo',app})}>{i18n.t('builder.redo')}</button><button disabled={!project.installed} onClick={()=>act({type:'app-revert',app})}>{i18n.t('builder.revert')}</button>
  </header>
  <div className="builder-body"><div className="builder-workspace"><div className="builder-preview-frame"><h2>{i18n.t('builder.document',{app:name})}</h2><div ref={canvas} className="builder-canvas" style={{aspectRatio:`${draft.width}/${draft.height}`}}>
   <div className="builder-preview-content" inert style={{width:draft.width,height:draft.height,transform:`scale(${scale})`,fontFamily:'var(--app-font)'}}><AppSurface {...props} snapshot={previewSnapshot} app={app} preview><BuiltAppContent {...props} snapshot={previewSnapshot} app={app} preview/></AppSurface></div>
   {draft.parts.map(p=>{const shown=preview?.id===p.id?preview:p;return <div key={p.id} role="button" tabIndex={0} aria-label={partLabel(p.id,i18n)} aria-pressed={selected===p.id} title={partLabel(p.id,i18n)} data-builder-part={p.id} data-assembly-slot={p.id} className={`builder-part ${selected===p.id?'builder-selected':''} ${invalid&&preview?.id===p.id?'invalid':''}`} style={{left:`${shown.x/draft.width*100}%`,top:`${shown.y/draft.height*100}%`,width:`${shown.width/draft.width*100}%`,height:`${shown.height/draft.height*100}%`,background:'transparent'} as CSSProperties}
    onPointerDown={e=>begin(e,p)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onKeyDown={e=>{const grid=BALANCE.appBuild.grid,delta=({ArrowLeft:[-grid,0],ArrowRight:[grid,0],ArrowUp:[0,-grid],ArrowDown:[0,grid]} as Record<string,number[]>)[e.key];if(delta){e.preventDefault();const changed={...p,x:p.x+delta[0]!,y:p.y+delta[1]!};setInvalid(!validPlacement(draft,changed,metrics));act({type:'app-change',app,part:p.id,patch:{x:changed.x,y:changed.y},metrics});}if(e.key==='Delete')act({type:'app-remove',app,part:p.id});if(e.key==='Enter')setSelected(p.id);}}>
    <button className="builder-resize" aria-label={i18n.t('builder.resize')} onPointerDown={e=>begin(e,p,true)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish}/></div>;})}
   {!draft.parts.length&&<p className="builder-empty">{i18n.t('builder.empty')}</p>}
  </div></div>{invalid&&<p className="builder-error" role="status">{i18n.t('builder.invalid')}</p>}</div>
  <aside className="builder-sidebar"><h2>{i18n.t('builder.materials')}</h2><div className="builder-parts">{rows.map(role=>{const source=sourceForSlot(app,role)!,placed=draft.parts.some(p=>p.id===role),complete=available.includes(role);return <div key={role} data-assembly-source={source} data-assembly-role={role}><button aria-pressed={selected===role} onClick={()=>setSelected(role)}>{i18n.t(`ws.part.${source}`)}</button>{placed?<button data-assembly-action="remove" onClick={()=>act({type:'app-remove',app,part:role})}>{i18n.t('builder.remove')}</button>:complete?<button data-assembly-action="place" onClick={()=>act({type:'app-place',app,part:role,metrics})}>{i18n.t('builder.place')}</button>:<button data-assembly-action="make" onClick={()=>act({type:'app-craft',app,part:role})}>{i18n.t('builder.unmade')}</button>}</div>;})}{!rows.length&&<p>{i18n.t('builder.noMaterials')}</p>}</div>
   <h2>{i18n.t('builder.properties')}</h2>{part&&material&&<div className="builder-properties"><strong>{partLabel(part.id,i18n)}</strong><small>{i18n.t('builder.source',{name:i18n.t(`ws.part.${material.source}`)})}</small>
    {(['x','y','width','height'] as const).map(key=><label key={key}>{i18n.t(`builder.${key}`)}<input type="number" step={BALANCE.appBuild.grid} min={key==='width'||key==='height'?minimumPart(part.id,metrics)[key]:0} value={part[key]} onChange={e=>send({[key]:Number(e.target.value)})}/></label>)}
    <label>{i18n.t('builder.color')}<select aria-label={i18n.t('builder.color')} value={material.design.nativeColors===true?'native':material.design.color} onChange={e=>send(e.target.value==='native'?{nativeColors:true}:{color:e.target.value})}><option value="native">{i18n.t('ws.nativeColors')}</option>{paletteFor(s.persistent.specs.color).map(color=><option key={color} value={color}>{color}</option>)}</select></label>
    <label>{i18n.t('builder.font')}<select value={part.fontSize} onChange={e=>send({fontSize:Number(e.target.value)})}>{[...new Set([part.fontSize,...BALANCE.appBuild.fontSizes.filter(size=>size>=BALANCE.workshop.design.fontSizeMin&&size<=BALANCE.workshop.design.fontSizeMax)])].sort((a,b)=>a-b).map(size=><option key={size} value={size}>{i18n.integer(size)}</option>)}</select></label>
    <label>{i18n.t('builder.row')}<select value={part.rowHeight} onChange={e=>send({rowHeight:Number(e.target.value)})}>{[...new Set([part.rowHeight,...BALANCE.appBuild.rowHeights])].sort((a,b)=>a-b).map(size=><option key={size} value={size}>{i18n.integer(size)}</option>)}</select></label>
    <label>{i18n.t('ws.radius')}<input type="range" min={0} max={BALANCE.workshop.design.radiusMax} value={material.design.radius} onChange={e=>send({radius:Number(e.target.value)})}/></label><label><input type="checkbox" checked={material.design.shadow} onChange={e=>send({shadow:e.target.checked})}/>{i18n.t('ws.shadow')}</label><label><input type="checkbox" checked={part.striped} onChange={e=>send({striped:e.target.checked})}/>{i18n.t('builder.stripes')}</label>
   </div>}
   <footer>{project.installed&&<p>{i18n.t('builder.installed')}</p>}<button className="builder-install" data-assembly-action="install" disabled={!validLayout(draft,app)} onClick={()=>{act({type:'app-install',app,metrics});runtime.actDesktop({type:'open',app});}}>{i18n.t('builder.install')}</button></footer>
  </aside></div>
 </section>;
}
