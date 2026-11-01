import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { I18n, MessageKey } from '../content/i18n';
import { fitAppLayout, readableText, type AppLayout, type AppPartId, type PartMinimums } from '../systems/appLayout';
import type { BuiltApp } from '../systems/desktopState';
import type { DesktopProps } from './desktopTypes';
export const partLabel=(id:AppPartId,i18n:I18n)=>i18n.t(`builder.part.${id}` as MessageKey);
export function usePartMinimums(layout:AppLayout,i18n:I18n,fontFamily?:string){
 const ref=useRef<HTMLDivElement>(null),[metrics,setMetrics]=useState<PartMinimums>({});
 const key=layout.parts.map(p=>p.id+':'+p.fontSize).join(',');
 useLayoutEffect(()=>{const root=ref.current;if(!root)return;const measure=()=>{const next:PartMinimums={};for(const node of root.querySelectorAll<HTMLElement>('[data-measure-part]'))next[node.dataset.measurePart as AppPartId]={width:Math.ceil((node.scrollWidth+24)/8)*8,height:32};setMetrics(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);};measure();const observer=new ResizeObserver(measure);observer.observe(root);return()=>observer.disconnect();},[key,i18n.language]);
 const ruler=<div ref={ref} className="app-part-measure" style={{fontFamily}} aria-hidden="true">{layout.parts.map(p=><span key={p.id} data-measure-part={p.id} style={{fontSize:p.fontSize}}>{partLabel(p.id,i18n)}</span>)}</div>;
 return {metrics,ruler};
}
const Composition=createContext<AppLayout|null>(null);
export function AppSurface({app,children,...props}:DesktopProps&{app:BuiltApp;children:ReactNode}){
 const {snapshot,runtime,i18n}=props,w=snapshot.state.run.desktop.windows[app],layout=snapshot.state.run.desktop.projects[app]?.installed;
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:400,height:300});
 const {metrics,ruler}=usePartMinimums(layout??{width:640,height:416,parts:[]},i18n);
 useLayoutEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>setSize(old=>old.width===node.clientWidth&&old.height===node.clientHeight?old:{width:node.clientWidth,height:node.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[!!layout]);
 const fitted=useMemo(()=>layout?fitAppLayout(layout,Math.max(160,Math.floor(size.width/8)*8),Math.max(100,Math.floor(size.height/8)*8),metrics):null,[layout,size,metrics]);
 useLayoutEffect(()=>{
  const node=ref.current;if(!node||!fitted||props.preview||w.maximized||node.clientWidth!==size.width||node.clientHeight!==size.height)return;
  const width=Math.min(snapshot.state.run.desktop.screen.width,w.width+Math.max(0,fitted.width-size.width));
  const height=Math.min(snapshot.state.run.desktop.screen.height-(snapshot.state.run.desktop.screen.width===800?28:snapshot.state.run.desktop.screen.width===1024?30:40),w.height+Math.max(0,fitted.height-size.height));
  if(width>w.width||height>w.height)runtime.actDesktop({type:'rect',app,rect:{...w,width,height}});
 },[fitted?.width,fitted?.height,w.width,w.height,w.maximized,size]);

 if(!layout)return <Composition.Provider value={null}>{children}</Composition.Provider>;
 return <div ref={ref} className="app-layout" data-composed-app={app}>{ruler}<Composition.Provider value={fitted}>{children}</Composition.Provider>{!layout.parts.length&&<p className="app-layout-empty">{i18n.t('builder.emptyInstalled')}</p>}</div>;
}
export function AppPart({id,children}: {id:AppPartId;children:ReactNode}){
 const layout=useContext(Composition);if(!layout)return <>{children}</>;
 const part=layout.parts.find(p=>p.id===id);if(!part)return null;
 const style={left:part.x,top:part.y,width:part.width,height:part.height,backgroundColor:part.color,color:readableText(part.color),fontSize:part.fontSize,'--app-background':part.color,'--app-foreground':readableText(part.color),'--app-stripe':readableText(part.color)==='#000000'?'#ffffff22':'#00000022',borderColor:readableText(part.color),'--app-row-height':`${Math.max(part.rowHeight,part.fontSize+8)}px`} as CSSProperties;
 return <section className={`app-layout-part ${part.striped?'app-striped':''}`} data-app-part={id} style={style}>{children}</section>;
}
