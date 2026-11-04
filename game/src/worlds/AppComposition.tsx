import { BALANCE } from '../config/balance';
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { I18n, MessageKey } from '../content/i18n';
import { fitAppLayout,minimumPart, type AppLayout, type AppPartId, type PartMinimums } from '../systems/appLayout';
import {createComponentDesign,usesNativeComponentColors} from '../systems/workshopState';
import {assemblyLayout,getInstalledAppParts,installedAssembly,type InstalledAppPart} from '../systems/appAssembly';
import {partVisual} from './workshop/partVisual';
import type { BuiltApp } from '../systems/desktopState';
import type { DesktopProps } from './desktopTypes';
import {ClockFace,ClockTimerContents} from '../components/ClockContents';
import {PhotoAdjustment} from '../components/PhotoAdjustment';
import { customizedScrollbar, producedScrollbarMaterial } from '../systems/commonChrome';
export const partLabel=(id:AppPartId,i18n:I18n)=>i18n.t(`builder.part.${id}` as MessageKey);
const photoAdjustment=(id:AppPartId):id is 'brightness'|'tone'|'crop'=>id==='brightness'||id==='tone'||id==='crop';
export function usePartMinimums(layout:AppLayout,i18n:I18n,fontFamily?:string,now=0){
 const ref=useRef<HTMLDivElement>(null),[metrics,setMetrics]=useState<PartMinimums>({});
 const key=layout.parts.map(p=>p.id+':'+p.fontSize).join(',');
 const clockText=i18n.date(now)+i18n.time(now);
 useLayoutEffect(()=>{const root=ref.current;if(!root)return;const measure=()=>{const next:PartMinimums={};for(const node of root.querySelectorAll<HTMLElement>('[data-measure-part]')){const id=node.dataset.measurePart as AppPartId;next[id]={width:Math.ceil((node.scrollWidth+(id==='places'?48:24))/BALANCE.appBuild.grid)*BALANCE.appBuild.grid,height:id==='time'||id==='timer'||photoAdjustment(id)?Math.ceil((node.offsetHeight+BALANCE.appBuild.grid)/BALANCE.appBuild.grid)*BALANCE.appBuild.grid:32};}setMetrics(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);};measure();const observer=new ResizeObserver(measure);observer.observe(root);for(const node of root.querySelectorAll('[data-measure-part]'))observer.observe(node);return()=>observer.disconnect();},[key,i18n.language,clockText]);
 const ruler=<div ref={ref} className="app-part-measure" style={{fontFamily}} aria-hidden="true" inert>{layout.parts.map(p=><span key={p.id} data-measure-part={p.id} style={{fontSize:p.fontSize,...(p.id==='timer'?{width:280}:photoAdjustment(p.id)?{width:minimumPart(p.id).width-BALANCE.appBuild.grid,whiteSpace:'normal' as const}:{})}}>{p.id==='time'?<ClockFace i18n={i18n} now={now}/>:p.id==='timer'?<ClockTimerContents i18n={i18n}><p>{i18n.t('clock.scheduled',{time:i18n.dateTime(now)})}<button className="win-button">{i18n.t('clock.cancel')}</button></p></ClockTimerContents>:photoAdjustment(p.id)?<PhotoAdjustment label={i18n.t(`photo.${p.id}`)} min={0} max={1} value={0}>{p.id==='crop'?i18n.t('number.percent',{value:i18n.integer(0)}):i18n.number(0)}</PhotoAdjustment>:<>{partLabel(p.id,i18n)}{p.id==='places'&&(['root','exports','screenshots'] as const).map(id=><span className="part-measure-line" key={id}>{i18n.t(`files.${id}`)}</span>)}</>}</span>)}</div>;
 return {metrics,ruler};
}
export function commonDesignStyle(assembly:ReturnType<typeof installedAssembly>):CSSProperties {
 const style:Record<string,string>={},defaults=createComponentDesign();
 if(!assembly)return style;
 const component=(source:string)=>assembly.common.find(part=>part.source===source)?.design;
 const button=component('common-button'),heading=component('common-heading'),progress=component('common-progress'),scroll=producedScrollbarMaterial(assembly)?.design;
 if(button){
  if(!usesNativeComponentColors(button)){style['--app-common-button-bg']=button.color;style['--app-common-button-fg']=button.textColor;}
  if(button.radius!==defaults.radius)style['--app-common-button-radius']=`${button.radius}px`;
  if(button.fontSize!==defaults.fontSize)style['--app-common-button-font']=`${button.fontSize}px`;
  if(button.shadow)style['--app-common-button-filter']='drop-shadow(1px 1px 0 #666)';
 }
 if(heading){
  if(!usesNativeComponentColors(heading)){style['--app-common-heading-bg']=heading.color;style['--app-common-heading-fg']=heading.textColor;}
  if(heading.fontSize!==defaults.fontSize)style['--app-common-heading-font']=`${heading.fontSize}px`;
  style['--app-common-heading-line']=heading.separator?'1px solid currentColor':'none';
 }
 if(progress){
  if(!usesNativeComponentColors(progress))style['--app-common-progress-fill']=progress.color;
  style['--app-common-progress-height']=`${progress.progressHeight}px`;style['--app-common-progress-radius']=`${progress.radius}px`;
 }
 if(scroll){
  style['--app-common-scroll-width']=`${scroll.scrollbarWidth}px`;style['--app-common-scroll-radius']=`${scroll.radius}px`;style['--app-common-scroll-arrows']=scroll.arrows?'block':'none';
  if(!usesNativeComponentColors(scroll)){style['--app-common-scroll-track']=scroll.color;style['--app-common-scroll-thumb']=scroll.textColor;}
 }
 return style as CSSProperties;
}
const Composition=createContext<InstalledAppPart[]|null>(null);
export function AppSurface({app,children,...props}:DesktopProps&{app:BuiltApp;children:ReactNode}){
 const {snapshot,runtime,i18n}=props,w=snapshot.state.run.desktop.windows[app],assembly=installedAssembly(snapshot.state,app),layout=assembly?assemblyLayout(assembly,snapshot.state.run.desktop.projects[app]?.installed??undefined):null;
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:400,height:300});
 const {metrics,ruler}=usePartMinimums(layout??{width:640,height:416,parts:[]},i18n,undefined,props.capture&&props.capture.version!==1?props.capture.display.wallTime:runtime.platform.clock.wallNow());
 useLayoutEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>setSize(old=>old.width===node.clientWidth&&old.height===node.clientHeight?old:{width:node.clientWidth,height:node.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[!!layout]);
 const fitted=useMemo(()=>layout?fitAppLayout(layout,Math.max(160,Math.floor(size.width/8)*8),Math.max(100,Math.floor(size.height/8)*8),metrics):null,[layout,size,metrics]);
 useLayoutEffect(()=>{
  const node=ref.current;if(!node||!fitted||props.preview||w.maximized||node.clientWidth!==size.width||node.clientHeight!==size.height)return;
  const width=Math.min(snapshot.state.run.desktop.screen.width,w.width+Math.max(0,fitted.width-size.width));
  const height=Math.min(snapshot.state.run.desktop.screen.height-(snapshot.state.run.desktop.screen.width===800?28:snapshot.state.run.desktop.screen.width===1024?30:40),w.height+Math.max(0,fitted.height-size.height));
  if(width>w.width||height>w.height)runtime.actDesktop({type:'rect',app,rect:{...w,width,height}},{automatic:true});
 },[fitted?.width,fitted?.height,w.width,w.height,w.maximized,size]);

 if(!layout)return <Composition.Provider value={null}>{children}</Composition.Provider>;
 return <div ref={ref} className="app-layout" data-composed-app={app} data-common-control-radius={assembly?.common.some(part=>part.source==='common-button'&&part.design.radius!==BALANCE.workshop.design.radius)||undefined} data-common-scroll-custom={customizedScrollbar(assembly)||undefined} style={commonDesignStyle(assembly)}>{ruler}<Composition.Provider value={getInstalledAppParts(snapshot.state,app,Math.max(160,Math.floor(size.width/8)*8),Math.max(100,Math.floor(size.height/8)*8),metrics)}>{children}</Composition.Provider>{!layout.parts.length&&<p className="app-layout-empty">{i18n.t('builder.emptyInstalled')}</p>}</div>;
}
export function AppPart({id,children}: {id:AppPartId;children:ReactNode}){
 const parts=useContext(Composition);if(!parts)return <>{children}</>;
 const part=parts.find(p=>p.role===id);if(!part)return null;
 const d=part.design,visual=partVisual(part.sourcePartId,d);
 const style={left:part.rect.x,top:part.rect.y,width:part.rect.width,height:part.rect.height,backgroundColor:visual.background,color:visual.foreground,fontSize:d.fontSize,borderRadius:d.radius,boxShadow:d.shadow?'1px 1px 0 #666':undefined,'--app-background':visual.background,'--app-foreground':visual.foreground,'--app-stripe':visual.foreground==='#000000'?'#ffffff22':'#00000022','--app-row-height':`${Math.max(part.rowHeight,d.fontSize+BALANCE.appBuild.grid)}px`,...(d.radius!==BALANCE.workshop.design.radius?{'--app-part-control-radius':`${d.radius}px`}:{}),...(!usesNativeComponentColors(d)?{'--app-part-control-bg':visual.background,'--app-part-control-fg':visual.foreground}:{}),...(d.fontSize!==BALANCE.workshop.design.fontSize?{'--app-part-control-font':`${d.fontSize}px`}:{})} as CSSProperties;
 return <section className={`app-layout-part ${part.striped?'app-striped':''}`} data-app-part={id} data-source-part={part.sourcePartId} data-own-control-radius={d.radius!==BALANCE.workshop.design.radius||undefined} style={style}>{children}</section>;
}
