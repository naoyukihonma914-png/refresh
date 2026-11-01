import {useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {PAGE_PARTS,fitPageLayout,recommendedPage,validPagePlacement,type PageLayout,type PagePart,type PageRect} from '../systems/pageDesign';
import type {I18n} from '../content/i18n';
export function PageLayoutSurface({layout,parts,editing,onChange,i18n}:{layout:PageLayout|null;parts:Record<PagePart,ReactNode>;editing:boolean;onChange(layout:PageLayout):void;i18n:I18n}){
 const root=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:1920,height:920});
 const [ghost,setGhost]=useState<{id:PagePart;rect:PageRect;valid:boolean}|null>(null);
 const drag=useRef<{id:PagePart;rect:PageRect;x:number;y:number;scale:number;resize:boolean}|null>(null);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>setSize(old=>old.width===node.clientWidth&&old.height===node.clientHeight?old:{width:node.clientWidth,height:node.clientHeight});measure();const o=new ResizeObserver(measure);o.observe(node);return()=>o.disconnect();},[]);
 const fitted=useMemo(()=>fitPageLayout(layout??recommendedPage(),size.width,size.height),[layout,size]);
 const standard=JSON.stringify(fitted.parts)===JSON.stringify(recommendedPage(fitted.width,fitted.height).parts),first=fitted.parts.heading,last=fitted.parts.upgrades;
 const begin=(e:React.PointerEvent<HTMLElement>,id:PagePart,resize=false)=>{if(!editing||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id,rect:fitted.parts[id],x:e.clientX,y:e.clientY,scale:root.current!.getBoundingClientRect().width/root.current!.offsetWidth,resize};setGhost({id,rect:fitted.parts[id],valid:true});};
 const move=(e:React.PointerEvent)=>{const d=drag.current;if(!d)return;const dx=Math.round((e.clientX-d.x)/d.scale/8)*8,dy=Math.round((e.clientY-d.y)/d.scale/8)*8,r={...d.rect,...(d.resize?{width:d.rect.width+dx,height:d.rect.height+dy}:{x:d.rect.x+dx,y:d.rect.y+dy})};setGhost({id:d.id,rect:r,valid:validPagePlacement(fitted,d.id,r)});};
 const finish=()=>{if(!drag.current)return;drag.current=null;if(ghost?.valid)onChange({...fitted,parts:{...fitted.parts,[ghost.id]:ghost.rect}});setGhost(null);};
 return <div ref={root} className={`page-layout-surface ${editing?'page-arranging':''}`}><div className="page-layout-canvas" style={{width:fitted.width,height:fitted.height}}>
 {standard&&<div className="page-layout-paper" style={{left:Math.max(0,first.x-12),top:0,width:first.width+24,height:last.y+last.height+12}}/>}
 {PAGE_PARTS.map(id=>{const rect=ghost?.id===id?ghost.rect:fitted.parts[id];return <section key={id} data-page-part={id} className={`page-part ${ghost?.id===id&&!ghost.valid?'invalid':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}} onPointerDown={e=>begin(e,id)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onClickCapture={e=>{if(editing){e.preventDefault();e.stopPropagation();}}}>
 {editing&&<button className="page-part-grip" aria-label={i18n.t(`page.part.${id}`)} onKeyDown={e=>{const v=({ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]} as Record<string,number[]>)[e.key];if(v){e.preventDefault();const r={...rect,x:rect.x+v[0]!,y:rect.y+v[1]!};if(validPagePlacement(fitted,id,r))onChange({...fitted,parts:{...fitted.parts,[id]:r}});}}}>{i18n.t(`page.part.${id}`)}</button>}
 <div className="page-part-content" inert={editing}>{parts[id]}</div>
 {editing&&<button className="page-part-resize" aria-label={i18n.t('builder.resize')} onPointerDown={e=>begin(e,id,true)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish}/>}
 </section>;})}
 </div></div>;
}
