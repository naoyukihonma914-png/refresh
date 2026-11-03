import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject, type ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { type WorkshopPartDefinition, type WorkshopRect } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import { fittingSocketRects } from '../../content/workshopFittingGeometry';
import type { PartProduction, WorkshopState } from '../../systems/workshopState';
import type { GameState } from '../../systems/state';
import type { Platform } from '../../platform/types';
import type { RuntimeSnapshot } from '../../systems/runtime';
import { producedControlPalette } from '../../systems/commonChrome';
import { usesNativeComponentColors } from '../../systems/workshopState';
import type { WorkshopDispatch } from './WorkshopCustomization';
import { WorkshopTargetProvider, useWorkshopTarget } from './WorkshopTargetContext';
import { OptionalTargetProvider } from './OptionalParts';
import { WorkshopGlyph } from './WorkshopGlyph';
import { FittingPieceContent, useFittingPieceFront } from './FittingPieceContent';
import './fitting-canvas.css';

export interface FittingCanvasProps {
 platform:Platform;workshopSnap?:RuntimeSnapshot['workshopSnap'];state:GameState;workshop:WorkshopState;
 part:WorkshopPartDefinition|null;production:PartProduction|undefined;zoom:number;dispatch:WorkshopDispatch;i18n:I18n;
 picking:boolean;layerSelection?:string|null;onSelectLayer?:(value:string|null)=>void;onPick:(color:string)=>void;
 reducedMotion?:boolean;showShell?:boolean;showPieces?:boolean;
}
interface Point {x:number;y:number}
interface PieceGesture {piece:string;start:Point;pointer:Point;loose:boolean;moved:boolean;pointerId:number}
interface SnapResponse {piece:string;socket:string;at:number}
const styleRect=(rect:WorkshopRect):CSSProperties=>({left:rect.x,top:rect.y,width:rect.width,height:rect.height});

/** Construction is a socket/piece surface; there are no placement or testing stages. */
export function FittingCanvas(props:FittingCanvasProps) {
 return <WorkshopTargetProvider gameState={props.state} i18n={props.i18n}><OptionalTargetProvider gameState={props.state} i18n={props.i18n} onExport={()=>props.dispatch({type:'export'})}><FittingBoard {...props}/></OptionalTargetProvider></WorkshopTargetProvider>;
}
function FittingBoard({state,workshop,part,production,zoom,dispatch,i18n,picking,onPick,reducedMotion=false,platform,showShell=true,showPieces=true}:FittingCanvasProps) {
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params);
 const c=BALANCE.workshop.canvas,f=BALANCE.workshop.fitting;
 const board=useRef<HTMLDivElement>(null),scrollTarget=useRef<HTMLDivElement>(null),gesture=useRef<PieceGesture|null>(null),suppressClick=useRef(false);
 const [drag,setDrag]=useState<PieceGesture|null>(null),[response,setResponse]=useState<SnapResponse|null>(null),[windowMode,setWindowMode]=useState<'normal'|'minimized'|'closed'|'maximized'>('normal');
 const {files,actions}=useWorkshopTarget();
 const frame=workshop.parts['common-frame'],definition=part?fittingDefinition(part.id):null;
 const inset=f.boardInset,boardWidth=c.width+inset*2,windowHeight=c.height+f.frameTitleHeight;
 const boardHeight=windowHeight+inset*2+f.trayHeight+f.trayGap;
 const activeFrame=part?.id==='common-frame';
 const pieces=definition?.pieces??[],sockets=production?.fitting?.sockets??{};
 const spawned=production?.fitting?.spawned??[];
 const loose=pieces.filter(piece=>spawned.includes(piece)&&sockets[piece]===undefined);
 const activeRect=production?.rect??part?.defaultRect;
 const activeGeometry=part&&activeRect?fittingSocketRects(part,activeRect,production?.design.scrollbarWidth):{};
 const targetScale=windowMode==='maximized'?boardWidth/c.width:1,targetInset=windowMode==='maximized'?0:inset;
 const appOffset={x:targetInset,y:targetInset+(activeFrame?0:f.frameTitleHeight*targetScale)};
 const tray:WorkshopRect={x:boardWidth-f.trayWidth-inset,y:windowHeight+inset+f.trayGap,width:f.trayWidth,height:f.trayHeight};
 useEffect(()=>{gesture.current=null;setDrag(null);setWindowMode('normal');setResponse(null);},[part?.id,state.createdAt,state.run.version]);
 useEffect(()=>{if(!response)return;let stop=()=>{};stop=platform.every(f.snapPulseMs,()=>{stop();setResponse(null);});return stop;},[response,platform,f.snapPulseMs]);
 const point=(e:PointerEvent):Point=>{const r=board.current!.getBoundingClientRect();return{x:(e.clientX-r.left)*boardWidth/r.width,y:(e.clientY-r.top)*boardHeight/r.height};};
 const socketBoardRect=(socket:string):WorkshopRect|null=>{const r=activeGeometry[socket];return r&&activeRect?{x:(r.x+activeRect.x)*targetScale+appOffset.x,y:(r.y+activeRect.y)*targetScale+appOffset.y,width:r.width*targetScale,height:r.height*targetScale}:null;};
 const candidate=(piece:string,p:Point):string|null=>{
  if(!definition)return null;
  const near=definition.sockets.flatMap(socket=>{
   if(!socket.accepts.includes(piece)||!socket.stacked&&Object.entries(sockets).some(([other,seat])=>other!==piece&&seat===socket.id))return [];
   const r=socketBoardRect(socket.id);if(!r)return [];
   const dx=Math.max(r.x-p.x,0,p.x-r.x-r.width),dy=Math.max(r.y-p.y,0,p.y-r.y-r.height);
   return Math.hypot(dx,dy)<=f.snapDistance?[{id:socket.id,distance:Math.hypot(p.x-r.x-r.width/2,p.y-r.y-r.height/2)}]:[];
  }).sort((a,b)=>a.distance-b.distance);
  return near[0]?.id??null;
 };
 const begin=(e:PointerEvent,piece:string,isLoose:boolean)=>{
  if(e.button!==0||picking||!part||!production)return;
  suppressClick.current=false;
  const target=e.target as HTMLElement;
  if(!isLoose&&target.closest('input,textarea,select,[data-fitting-interactive]')&&!target.closest('[data-fitting-grip]'))return;
  const p=point(e),next={piece,start:p,pointer:p,loose:isLoose,moved:false,pointerId:e.pointerId};gesture.current=next;
  if(isLoose)e.preventDefault();
  e.stopPropagation();if(isLoose)e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent)=>{
  const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;
  const p=point(e),moved=g.moved||Math.hypot(p.x-g.start.x,p.y-g.start.y)>=f.dragThreshold;
  gesture.current={...g,pointer:p,moved};if(moved){if(!g.moved)board.current?.setPointerCapture(e.pointerId);e.preventDefault();setDrag(gesture.current);}
 };
 const end=(e:PointerEvent)=>{
  const g=gesture.current;if(!g||e.pointerId!==g.pointerId)return;
  gesture.current=null;setDrag(null);
  if(!g.moved||!part)return;
  e.preventDefault();e.stopPropagation();suppressClick.current=true;
  const p=point(e),socket=candidate(g.piece,p);
  if(socket){dispatch({type:'fitPiece',part:part.id,piece:g.piece,socket});setResponse({piece:g.piece,socket,at:state.elapsedMs});}
  else if(!g.loose&&p.x>=tray.x-f.snapDistance&&p.x<=tray.x+tray.width+f.snapDistance&&p.y>=tray.y-f.snapDistance&&p.y<=tray.y+tray.height+f.snapDistance)dispatch({type:'removePiece',part:part.id,piece:g.piece});
 };
 const windowAction=(symbol:'minimize'|'maximize'|'close')=>setWindowMode(old=>symbol==='close'?'closed':symbol==='minimize'?'minimized':old==='maximized'?'normal':'maximized');
 const pick=(e:React.MouseEvent)=>{
  if(suppressClick.current){suppressClick.current=false;e.preventDefault();e.stopPropagation();return;}
  if(!picking)return;e.preventDefault();e.stopPropagation();
  let target=e.target as HTMLElement;
  while(target&&board.current?.contains(target)){
   const rgb=getComputedStyle(target).backgroundColor.match(/[\d.]+/g);
   if(rgb&&rgb.length>=3&&(rgb.length<4||Number(rgb[3])>0)){onPick('#'+rgb.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join(''));return;}
   target=target.parentElement!;
  }
 };
 const renderPiece=(descriptor:WorkshopPartDefinition,p:PartProduction,piece:string,seat:string,isActive:boolean)=>{
  const r=fittingSocketRects(descriptor,p.rect,p.design.scrollbarWidth)[seat];if(!r)return null;
  return <FittedPiece key={piece} descriptor={descriptor} production={p} piece={piece} seat={seat} i18n={i18n} style={styleRect(r)} draggable={isActive} hidden={drag?.piece===piece&&isActive} state={state} begin={e=>begin(e,piece,false)} onWindowAction={windowAction}>
   {descriptor.id==='common-frame'&&piece==='scrollbar'?<FrameScrollRail target={scrollTarget} production={p} i18n={i18n}/>:null}
  </FittedPiece>;
 };
 const renderShell=(descriptor:WorkshopPartDefinition,p:PartProduction,isActive:boolean)=>{
  const d=fittingDefinition(descriptor.id),map=p.fitting?.sockets??Object.fromEntries(p.elements.map(piece=>[piece,d.sockets.find(socket=>socket.accepts.includes(piece))?.id??piece]));
  const geometry=fittingSocketRects(descriptor,p.rect,p.design.scrollbarWidth),native=usesNativeComponentColors(p.design),isFrame=descriptor.id==='common-frame';
  const shellStyle={...styleRect(p.rect),fontSize:p.design.fontSize,borderRadius:p.design.radius,backgroundColor:native?undefined:p.design.color,color:native?undefined:p.design.textColor,'--wf-part-bg':native?'#c0c0c0':p.design.color,'--wf-part-fg':native?'#101010':p.design.textColor} as CSSProperties;
  return <section key={descriptor.id} className={`wf-part-shell ${isFrame?'wf-frame-shell':''} ${isActive?'is-active':''}`} data-workshop-canvas-part={descriptor.id} data-fitting-shell={descriptor.id} data-component-motion={p.design.motion} style={shellStyle} aria-label={t(descriptor.labelKey)}>
   {isFrame&&<><div className="wf-frame-title-surface" style={{height:f.frameTitleHeight}}/><div className="wf-frame-content" ref={scrollTarget} style={{top:f.frameTitleHeight,right:p.elements.includes('scrollbar')?p.design.scrollbarWidth+4:4}}>
    {files.entries.map(entry=><button type="button" key={entry.id} aria-pressed={files.selectedId===entry.id} onClick={()=>actions.selectFile(entry.id)}><WorkshopGlyph name="file"/><span>{entry.name}</span></button>)}
    <pre className="wf-frame-note">{state.persistent.productionNote??t('intro.note')}</pre>
   </div></>}
   {showShell&&isActive&&d.sockets.map(socket=>{
    const r=geometry[socket.id],occupied=Object.values(map).includes(socket.id),next=state.persistent.examplesEnabled&&!occupied&&d.pieces.find(piece=>map[piece]===undefined&&socket.accepts.includes(piece));
    if(!r)return null;
    return <div key={socket.id} className={`wf-socket ${occupied?'is-filled':''} ${next?'is-next':''} ${drag&&candidate(drag.piece,drag.pointer)===socket.id?'is-near':''}`} data-fitting-socket={socket.id} data-socket-accepts={socket.accepts.join(',')} data-socket-filled={occupied||undefined} role="img" aria-label={t('wf.socket',{name:t(`ws.element.${socket.accepts[0]}`)})} style={styleRect(r)}/>;
   })}
   {showPieces&&d.pieces.filter(piece=>map[piece]!==undefined).map(piece=>renderPiece(descriptor,p,piece,map[piece]!,isActive))}
   {isActive&&response&&<div key={`${response.at}:${response.piece}`} className="wf-snap-response" data-workshop-snap={descriptor.id} data-fitting-snap={response.piece} data-reduced-motion={reducedMotion||undefined} role="status" aria-label={t('wf.snap',{name:t(`ws.element.${response.piece}`)})} style={{...styleRect(geometry[response.socket]!),animationDuration:`${f.snapPulseMs}ms`}}/>}
  </section>;
 };
 return <div className="ws-workbench-scroll wf-workbench-scroll" data-workshop-picking={picking||undefined} onClickCapture={pick}>
  <div className="wf-board-sizer ws-canvas-sizer" style={{width:boardWidth*zoom,height:boardHeight*zoom}}>
   <div ref={board} className="wf-board" data-fitting-board data-workshop-canvas data-reduced-motion={reducedMotion||undefined} style={{width:boardWidth,height:boardHeight,transform:`scale(${zoom})`}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setDrag(null);}}>
    {windowMode!=='normal'&&<button type="button" className="wf-restore-target" data-workshop-action="restoreTarget" onClick={()=>setWindowMode('normal')}>{t('wf.restoreTarget')}</button>}
    {windowMode!=='closed'&&<div className={`wf-destination-window ${windowMode==='maximized'?'is-maximized':''}`} data-workshop-target={part?.set??'common'} data-destination-era={state.persistent.appearance.desktop} style={{left:targetInset,top:targetInset,width:c.width,height:windowMode==='minimized'?f.frameTitleHeight:windowHeight,transform:`scale(${targetScale})`,transformOrigin:'top left'}}>
     {!activeFrame&&<div className="wf-target-title" style={{height:f.frameTitleHeight}}><span>{t(`ws.set.${part?.set??'common'}`)}</span><div className="wf-target-controls">{frame?.elements.filter((piece):piece is 'minimize'|'maximize'|'close'=>['minimize','maximize','close'].includes(piece)).map(symbol=><button type="button" key={symbol} data-workshop-control={symbol} aria-label={t(`ws.window.${symbol}`)} onClick={()=>windowAction(symbol)} style={producedControlPalette(frame.design,symbol)}><WorkshopGlyph name={symbol}/></button>)}</div></div>}
     {windowMode!=='minimized'&&<div className="wf-destination-surface" style={{height:c.height,top:activeFrame?0:f.frameTitleHeight}}>
      {!part&&<p className="wf-empty-canvas">{t('wf.emptyCanvas')}</p>}
      {part&&fittingPartsForSet(part.set).map(descriptor=>{const p=workshop.parts[descriptor.id];return p&&(descriptor.id===part.id||p.elements.length>0||p.step===4)?renderShell(descriptor,p,descriptor.id===part.id):null;})}
     </div>}
    </div>}
    <div className={`wf-piece-tray ${drag&&!drag.loose?'is-return-target':''}`} data-fitting-tray style={styleRect(tray)}><span>{t('wf.tray')}</span><div className="wf-tray-pieces">
     {part&&production&&loose.map(piece=>{
      const target=definition!.sockets.find(socket=>socket.accepts.includes(piece))!,r=activeGeometry[target.id]!,scale=Math.min(1,f.looseMaxWidth/r.width,f.looseMaxHeight/r.height);
      return <div className="wf-loose-piece" key={piece} data-fitting-piece={piece} data-piece-status="spawned" style={{width:Math.max(26,r.width*scale),height:Math.max(24,r.height*scale),visibility:drag?.piece===piece?'hidden':undefined}} role="button" tabIndex={0} aria-label={t('wf.dragPiece',{name:t(`ws.element.${piece}`)})} onPointerDown={e=>begin(e,piece,true)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const socket=definition!.sockets.find(seat=>seat.accepts.includes(piece)&&(seat.stacked||!Object.values(sockets).includes(seat.id)));if(socket)dispatch({type:'fitPiece',part:part.id,piece,socket:socket.id});}}}>
       <FittingPieceContent part={part} production={production} piece={piece} state={state} i18n={i18n} loose/>
      </div>;
     })}
    </div></div>
    {part&&production&&drag&&<div className="wf-drag-ghost" data-fitting-drag={drag.piece} style={{left:drag.pointer.x-f.looseMaxWidth/2,top:drag.pointer.y-24,width:f.looseMaxWidth,height:48}}><FittingPieceContent part={part} production={production} piece={drag.piece} state={state} i18n={i18n} loose/></div>}
   </div>
  </div>
 </div>;
}
function FittedPiece({descriptor,production,piece,seat,style,draggable,hidden,state,i18n,begin,onWindowAction,children}:{descriptor:WorkshopPartDefinition;production:PartProduction;piece:string;seat:string;style:CSSProperties;draggable:boolean;hidden:boolean;state:GameState;i18n:I18n;begin:(event:PointerEvent)=>void;onWindowAction:(symbol:'minimize'|'maximize'|'close')=>void;children:ReactNode}) {
 const front=useFittingPieceFront(descriptor.id,piece,production),t=i18n.t;
 return <div className={`wf-fitted-piece wf-piece-${piece} ${draggable?'is-draggable':''}`} data-fitting-piece={piece} data-fitting-seat={seat} data-piece-status="fitted" data-piece-front={front} style={{...style,display:front?undefined:'none',visibility:hidden?'hidden':undefined}} onPointerDown={draggable?begin:undefined}>
  {children??<FittingPieceContent part={descriptor} production={production} piece={piece} state={state} i18n={i18n} onWindowAction={onWindowAction}/>}
  {draggable&&<button type="button" className="wf-piece-grip" data-fitting-grip aria-label={t('wf.dragPiece' as MessageKey,{name:t(`ws.element.${piece}` as MessageKey)})} onPointerDown={begin}><WorkshopGlyph name="move"/></button>}
 </div>;
}
/** A fitted frame scrollbar scrolls the actual destination list, including its arrows and thumb. */
function FrameScrollRail({target,production,i18n}:{target:RefObject<HTMLDivElement|null>;production:PartProduction;i18n:I18n}) {
 const [thumb,setThumb]=useState({height:100,top:0}),rail=useRef<HTMLDivElement>(null),drag=useRef<{y:number;scroll:number}|null>(null),d=production.design;
 const update=()=>{const node=target.current;if(!node)return;const height=Math.min(100,node.clientHeight/Math.max(1,node.scrollHeight)*100);setThumb({height,top:node.scrollHeight>node.clientHeight?node.scrollTop/(node.scrollHeight-node.clientHeight)*(100-height):0});};
 useEffect(()=>{const node=target.current;if(!node)return;update();node.addEventListener('scroll',update);const resize=new ResizeObserver(update);resize.observe(node);return()=>{node.removeEventListener('scroll',update);resize.disconnect();};},[target]);
 const page=(direction:number)=>{const node=target.current;if(node){node.scrollTop+=direction*node.clientHeight;update();}};
 return <div className="wf-frame-scroll-rail" data-fitting-interactive data-workshop-control="scrollbar" style={{width:d.scrollbarWidth,color:usesNativeComponentColors(d)?undefined:d.textColor,background:usesNativeComponentColors(d)?undefined:d.color}}>
  {d.arrows&&<button type="button" aria-label={i18n.t('ws.moveUp')} onClick={()=>page(-1)}><WorkshopGlyph name="up"/></button>}
  <div className="wf-frame-scroll-track" ref={rail} onPointerDown={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();page(e.clientY<r.top+r.height*thumb.top/100?-1:1);}}}><button type="button" className="wf-frame-scroll-thumb" aria-label={i18n.t('ws.element.scrollbar' as MessageKey)} style={{height:`${thumb.height}%`,top:`${thumb.top}%`}} onPointerDown={e=>{drag.current={y:e.clientY,scroll:target.current?.scrollTop??0};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const g=drag.current,node=target.current,r=rail.current?.getBoundingClientRect();if(g&&node&&r){node.scrollTop=g.scroll+(e.clientY-g.y)*node.scrollHeight/r.height;update();}}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();page(e.key==='ArrowUp'?-1:1);}}}/></div>
  {d.arrows&&<button type="button" aria-label={i18n.t('ws.moveDown')} onClick={()=>page(1)}><WorkshopGlyph name="down"/></button>}
 </div>;
}
