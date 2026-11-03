import {useImperativeHandle,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode,type Ref} from 'react';
import {BALANCE} from '../config/balance';
import {PAGE_PARTS,createPageDesign,fitPageLayout,pagePartFontSize,recommendedPage,validPagePlacement,type PageDesign,type PageLayout,type PagePart,type PageRect} from '../systems/pageDesign';
import type {I18n} from '../content/i18n';
export interface PageLayoutHandle {measure():PageLayout}
interface Props {
 layout:PageLayout|null;design?:PageDesign;parts:Record<PagePart,ReactNode>;editing:boolean;canvas?:boolean;
 onChange(layout:PageLayout):void;i18n:I18n;measureRef:Ref<PageLayoutHandle>;allowArrangement?:boolean;
 selectedPart?:PagePart;onSelectPart?:(part:PagePart)=>void;onRequestEdit?:()=>void;firstGuide?:boolean;reducedMotion?:boolean;
 partActions?:Partial<Record<PagePart,ReactNode>>;
 placing?:{pieces:PagePart[];sockets:PageLayout;snapPart?:PagePart|null};
 onPlace?:(part:PagePart,rect:PageRect,snapped:boolean)=>void;
}
/** Coordinates belong to the whole page, independently of its evolving editor rails. */
export function PageLayoutSurface({layout,design=createPageDesign(),parts,editing,onChange,i18n,measureRef,allowArrangement=false,selectedPart,onSelectPart,onRequestEdit,firstGuide=false,reducedMotion=false,partActions,placing,onPlace}:Props){
 const root=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:BALANCE.pageDesign.width as number,height:BALANCE.pageDesign.height as number});
 const [preview,setPreview]=useState<{id:PagePart;rect:PageRect;valid:boolean}|null>(null);
 const drag=useRef<{id:PagePart;rect:PageRect;x:number;y:number;scale:number;resize:boolean;piece?:boolean}|null>(null);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>setSize(old=>old.width===node.clientWidth&&old.height===node.clientHeight?old:{width:node.clientWidth,height:node.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
 const fitted=useMemo(()=>fitPageLayout(layout??recommendedPage(),size.width,size.height),[layout,size]);
 const fittedSockets=useMemo(()=>placing?fitPageLayout(placing.sockets,size.width,size.height):null,[placing,size]);
 useImperativeHandle(measureRef,()=>({measure:()=>structuredClone(fitted)}),[fitted]);
 const start=(event:React.PointerEvent<HTMLElement>,id:PagePart,resize:boolean)=>{
  const piece=!editing&&Boolean(placing?.pieces.includes(id));
  if((!editing&&!piece)||event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  onSelectPart?.(id);drag.current={id,rect:{...fitted.parts[id]},x:event.clientX,y:event.clientY,scale:root.current!.getBoundingClientRect().width/root.current!.offsetWidth,resize,piece};setPreview({id,rect:fitted.parts[id],valid:true});
 };
 const move=(event:React.PointerEvent)=>{const current=drag.current;if(!current)return;const grid=BALANCE.pageDesign.grid,dx=Math.round((event.clientX-current.x)/current.scale/grid)*grid,dy=Math.round((event.clientY-current.y)/current.scale/grid)*grid;
  const rect={...current.rect,...(current.resize?{width:current.rect.width+dx,height:current.rect.height+dy}:{x:current.rect.x+dx,y:current.rect.y+dy})};setPreview({id:current.id,rect,valid:current.piece?true:validPagePlacement(fitted,current.id,rect)});
 };
 const finish=()=>{const current=drag.current;if(!current)return;drag.current=null;const rect=preview?.id===current.id?preview.rect:current.rect;
  if(current.piece){const socket=fittedSockets?.parts[current.id],snapped=Boolean(socket&&Math.abs(rect.x-socket.x)<=BALANCE.pageDesign.socketSnapDistance&&Math.abs(rect.y-socket.y)<=BALANCE.pageDesign.socketSnapDistance);onPlace?.(current.id,snapped&&socket?{...socket}:rect,snapped);}
  else if(preview?.valid)onChange({...fitted,parts:{...fitted.parts,[preview.id]:preview.rect}});
  setPreview(null);};
 const keyboard=(event:React.KeyboardEvent,id:PagePart,resize=false)=>{
  const grid=BALANCE.pageDesign.grid,direction=({ArrowLeft:[-grid,0],ArrowRight:[grid,0],ArrowUp:[0,-grid],ArrowDown:[0,grid]} as Record<string,number[]>)[event.key];if(!editing||!direction)return;event.preventDefault();
  const before=fitted.parts[id],rect={...before,...(resize?{width:before.width+direction[0]!,height:before.height+direction[1]!}:{x:before.x+direction[0]!,y:before.y+direction[1]!})};
  if(validPagePlacement(fitted,id,rect))onChange({...fitted,parts:{...fitted.parts,[id]:rect}});
 };
 return <div ref={root} className={`page-layout-surface ${editing?'page-arranging':''}`} data-page-layout-mode={editing}>
  <div className="page-layout-canvas" style={{width:fitted.width,height:fitted.height}}>
   {placing&&fittedSockets&&placing.pieces.map(id=>{const socket=fittedSockets.parts[id];return <div key={id} className="page-socket" data-page-socket={id} aria-hidden="true" style={{left:socket.x,top:socket.y,width:socket.width,height:socket.height}}/>;})}
   {PAGE_PARTS.map(id=>{const rect=preview?.id===id?preview.rect:fitted.parts[id],partColor=design.partColors?.[id],isPiece=Boolean(!editing&&placing?.pieces.includes(id));return <section key={id} data-page-part={id} data-page-piece={isPiece||undefined} data-page-selected={selectedPart===id||undefined} className={`page-part ${preview?.id===id&&!preview.valid?'invalid':''} ${isPiece?'is-piece':''} ${placing?.snapPart===id?'just-fitted':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,'--page-part-font':`${pagePartFontSize(design,id)}px`,...(partColor?.background?{'--page-part-background':partColor.background}:{}),...(partColor?.text?{'--page-part-text':partColor.text}:{})} as CSSProperties} onPointerDown={isPiece?event=>start(event,id,false):undefined} onPointerMove={isPiece?move:undefined} onPointerUp={isPiece?finish:undefined} onLostPointerCapture={isPiece?finish:undefined} onDoubleClick={isPiece?()=>{const socket=fittedSockets?.parts[id];if(socket)onPlace?.(id,{...socket},true);}:undefined}>
    {allowArrangement&&!isPiece&&<button type="button" data-page-part-grip={id} className={`page-part-grip ${editing?'':'page-quiet-grip'}`} style={editing?{insetBlockStart:Math.max(-BALANCE.pageDesign.gripOffset,-rect.y)}:undefined} aria-label={i18n.t('page.movePart',{name:i18n.t(`page.part.${id}`)})} title={i18n.t('page.movePart',{name:i18n.t(`page.part.${id}`)})} onClick={()=>{onSelectPart?.(id);if(!editing)onRequestEdit?.();}} onPointerDown={event=>start(event,id,false)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onKeyDown={event=>keyboard(event,id)}><svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true"><path d="M3 2h2v2H3zM9 2h2v2H9zM3 6h2v2H3zM9 6h2v2H9zM3 10h2v2H3zM9 10h2v2H9z"/></svg>{editing&&<span>{i18n.t(`page.part.${id}`)}</span>}</button>}
    <div className="page-part-content" inert={editing||isPiece}>{parts[id]}</div>
    {!editing&&partActions?.[id]}
    {editing&&<button type="button" data-page-part-resize={id} className="page-part-resize" aria-label={i18n.t('page.resizePart',{name:i18n.t(`page.part.${id}`)})} title={i18n.t('page.resizePart',{name:i18n.t(`page.part.${id}`)})} onPointerDown={event=>start(event,id,true)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={finish} onKeyDown={event=>keyboard(event,id,true)}/>}
   </section>;})}
   {firstGuide&&<div className={`page-drag-demonstration ${reducedMotion?'is-reduced':''}`} data-page-first-guide role="img" aria-label={i18n.t('page.dragExample')} style={{left:fitted.parts.generator.x,top:fitted.parts.generator.y,width:fitted.parts.generator.width,height:fitted.parts.generator.height}}/>}
  </div>
 </div>;
}
