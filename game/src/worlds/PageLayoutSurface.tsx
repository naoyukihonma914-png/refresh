import {useImperativeHandle,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode,type Ref} from 'react';
import {BALANCE} from '../config/balance';
import {PAGE_PARTS,fitPageLayout,pageMinimum,recommendedPage,validPagePlacement,type PageLayout,type PagePart,type PageRect} from '../systems/pageDesign';
import type {I18n} from '../content/i18n';
export interface PageLayoutHandle {measure():PageLayout}
export function PageLayoutSurface({layout,parts,editing,canvas,onChange,i18n,measureRef}:{layout:PageLayout|null;parts:Record<PagePart,ReactNode>;editing:boolean;canvas:boolean;onChange(layout:PageLayout):void;i18n:I18n;measureRef:Ref<PageLayoutHandle>}){
 const root=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:1920,height:920});
 const [ghost,setGhost]=useState<{id:PagePart;rect:PageRect;valid:boolean}|null>(null);
 const drag=useRef<{id:PagePart;rect:PageRect;x:number;y:number;scale:number;resize:boolean;button:{width:number;height:number}}|null>(null);
 useLayoutEffect(()=>{if(!canvas)return;const node=root.current;if(!node)return;const measure=()=>setSize(old=>old.width===node.clientWidth&&old.height===node.clientHeight?old:{width:node.clientWidth,height:node.clientHeight});measure();const o=new ResizeObserver(measure);o.observe(node);return()=>o.disconnect();},[canvas]);
 const fitted=useMemo(()=>fitPageLayout(layout??recommendedPage(),size.width,size.height),[layout,size]);
 useImperativeHandle(measureRef,()=>({measure(){
  // Read the natural card before entering the canvas; do not save measurements until an edit is accepted.
  const node=root.current!,page=node.closest<HTMLElement>('.seed-page')!,bounds=page.getBoundingClientRect(),scale=bounds.width/page.offsetWidth,grid=BALANCE.pageDesign.grid;
  const down=(n:number)=>Math.floor(n/grid)*grid,up=(n:number)=>Math.ceil(n/grid)*grid;
  const width=Math.max(352,down(page.clientWidth)),parts={} as PageLayout['parts'];let bottom=16;
  for(const id of PAGE_PARTS){
   const content=node.querySelector<HTMLElement>(`[data-page-part="${id}"] .page-part-content`)!,rects=[...content.children].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height),min=pageMinimum(id);
   const x=rects.length?Math.max(0,down((Math.min(...rects.map(r=>r.left))-bounds.left)/scale)):32;
   const y=rects.length?Math.max(bottom,down((Math.min(...rects.map(r=>r.top))-bounds.top)/scale)):bottom;
   const height=Math.max(min.height,rects.length?up((Math.max(...rects.map(r=>r.bottom))-bounds.top)/scale-y+32):0);
   parts[id]={x,y,width:Math.min(width-x,Math.max(min.width,rects.length?up((Math.max(...rects.map(r=>r.right))-bounds.left)/scale-x):width-64)),height};bottom=y+height+8;
  }
  return {width,height:Math.min(1080,up(Math.max(720,page.clientHeight,bottom))),parts};
 }}),[]);
 const begin=(e:React.PointerEvent<HTMLElement>,id:PagePart,resize=false)=>{
  if(!editing||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
  const button=root.current!.querySelector<HTMLElement>('[data-part="primary"]')!;
  drag.current={id,rect:fitted.parts[id],x:e.clientX,y:e.clientY,scale:root.current!.getBoundingClientRect().width/root.current!.offsetWidth,resize,button:{width:button.offsetWidth,height:button.offsetHeight}};setGhost({id,rect:fitted.parts[id],valid:true});
 };
 const move=(e:React.PointerEvent)=>{const d=drag.current;if(!d)return;const dx=Math.round((e.clientX-d.x)/d.scale/8)*8,dy=Math.round((e.clientY-d.y)/d.scale/8)*8,r={...d.rect,...(d.resize?{width:d.rect.width+dx,height:d.rect.height+dy}:{x:d.rect.x+dx,y:d.rect.y+dy})};setGhost({id:d.id,rect:r,valid:validPagePlacement(fitted,d.id,r)});};
 const finish=()=>{
  const d=drag.current;if(!d)return;drag.current=null;
  if(ghost?.valid){const next={...fitted,parts:{...fitted.parts,[ghost.id]:ghost.rect}};
   if(d.resize&&d.id==='generator')next.button={width:Math.max(BALANCE.pageDesign.buttonMinWidth,Math.min(ghost.rect.width-24,d.button.width+ghost.rect.width-d.rect.width)),height:Math.max(BALANCE.pageDesign.buttonMinHeight,Math.min(ghost.rect.height-120,d.button.height+ghost.rect.height-d.rect.height))};
   onChange(next);
  }setGhost(null);
 };
 if(!canvas)return <div ref={root} className="page-layout-flow">{PAGE_PARTS.map(id=><section key={id} data-page-part={id} className="page-flow-part"><div className="page-part-content">{parts[id]}</div></section>)}</div>;
 return <div ref={root} className={`page-layout-surface ${editing?'page-arranging':''}`}><div className="page-layout-canvas" style={{width:fitted.width,height:fitted.height}}>
 {PAGE_PARTS.map(id=>{const rect=ghost?.id===id?ghost.rect:fitted.parts[id];return <section key={id} data-page-part={id} className={`page-part ${ghost?.id===id&&!ghost.valid?'invalid':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,...(id==='generator'&&fitted.button?{'--page-button-width':`${fitted.button.width}px`,'--page-button-height':`${fitted.button.height}px`}:{})} as CSSProperties} onPointerDown={e=>begin(e,id)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onClickCapture={e=>{if(editing){e.preventDefault();e.stopPropagation();}}}>
 {editing&&<button className="page-part-grip" aria-label={i18n.t(`page.part.${id}`)} onKeyDown={e=>{const v=({ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]} as Record<string,number[]>)[e.key];if(v){e.preventDefault();const r={...rect,x:rect.x+v[0]!,y:rect.y+v[1]!};if(validPagePlacement(fitted,id,r))onChange({...fitted,parts:{...fitted.parts,[id]:r}});}}}>{i18n.t(`page.part.${id}`)}</button>}
 <div className="page-part-content" inert={editing}>{parts[id]}</div>
 {editing&&<button className="page-part-resize" aria-label={i18n.t('builder.resize')} onPointerDown={e=>begin(e,id,true)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish}/>}
 </section>;})}
 </div></div>;
}
