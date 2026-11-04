import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject, type ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart, type WorkshopPartDefinition, type WorkshopPartId, type WorkshopRect } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import { fittingSocketRects } from '../../content/workshopFittingGeometry';
import type { PartProduction, WorkshopState } from '../../systems/workshopState';
import type { GameState } from '../../systems/state';
import type { Platform } from '../../platform/types';
import type { RuntimeSnapshot } from '../../systems/runtime';
import { fittingWindowControlPalette } from '../../systems/commonChrome';
import { createComponentDesign, usesNativeComponentColors } from '../../systems/workshopState';
import type { WorkshopDispatch } from './WorkshopCustomization';
import { WorkshopTargetProvider, useWorkshopTarget } from './WorkshopTargetContext';
import { OptionalTargetProvider } from './OptionalParts';
import { WorkshopGlyph } from './WorkshopGlyph';
import { FittingPieceContent, useFittingPieceFront } from './FittingPieceContent';
import { ensurePuzzlePositions, puzzleParts, puzzlePieceRect, puzzlePieceVisible, puzzleSet } from '../../systems/workshopPuzzle';
import { WorkshopExportShelf } from './WorkshopExportShelf';
import './fitting-canvas.css';

export interface FittingCanvasProps {
 platform:Platform;workshopSnap?:RuntimeSnapshot['workshopSnap'];state:GameState;workshop:WorkshopState;
 part:WorkshopPartDefinition|null;production:PartProduction|undefined;zoom:number;dispatch:WorkshopDispatch;i18n:I18n;
 picking:boolean;selectedPiece?:string|null;onSelectPiece?:(piece:string)=>void;layerSelection?:string|null;onSelectLayer?:(value:string|null)=>void;onPick:(color:string)=>void;
 onTargetScale?:(scale:number)=>void;preview?:boolean;reducedMotion?:boolean;showShell?:boolean;showPieces?:boolean;showAdjustments?:boolean;
}
interface Point {x:number;y:number}
interface PieceGesture {part:WorkshopPartId;piece:string;start:Point;pointer:Point;loose:boolean;moved:boolean;pointerId:number;offset:Point;width:number;height:number}
interface SnapResponse {part:WorkshopPartId;piece:string;socket:string;at:number}
const styleRect=(rect:WorkshopRect):CSSProperties=>({left:rect.x,top:rect.y,width:rect.width,height:rect.height});

/** Construction is a socket/piece surface; there are no placement or testing stages. */
export function FittingCanvas(props:FittingCanvasProps) {
 return <WorkshopTargetProvider gameState={props.state} i18n={props.i18n}><OptionalTargetProvider gameState={props.state} i18n={props.i18n} onExport={()=>props.dispatch({type:'export'})}><FittingBoard {...props}/></OptionalTargetProvider></WorkshopTargetProvider>;
}
function FittingBoard({state,workshop,part,zoom,dispatch,i18n,picking,onPick,onTargetScale,preview=false,reducedMotion=false,platform,showShell=true,showPieces=true,showAdjustments=true}:FittingCanvasProps) {
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params);
 const c=BALANCE.workshop.canvas,f=BALANCE.workshop.fitting;
 const viewport=useRef<HTMLDivElement>(null),board=useRef<HTMLDivElement>(null),scrollTarget=useRef<HTMLDivElement>(null),gesture=useRef<PieceGesture|null>(null),suppressClick=useRef(false);
 const [drag,setDrag]=useState<PieceGesture|null>(null),[response,setResponse]=useState<SnapResponse|null>(null),[windowMode,setWindowMode]=useState<'normal'|'minimized'|'closed'|'maximized'>('normal');
 const {files,actions}=useWorkshopTarget();
 workshop=ensurePuzzlePositions(workshop,puzzleParts(workshop));
 const selected=puzzleParts(workshop),set=puzzleSet(workshop),descriptors=fittingPartsForSet(set);
 const frame=workshop.parts['common-frame'];
 const inset=f.boardInset,windowHeight=c.height+f.frameTitleHeight;
 const positionRects=descriptors.flatMap(descriptor=>Object.entries(workshop.parts[descriptor.id]?.fitting?.positions??{}).flatMap(([piece,pos])=>{const r=puzzlePieceRect(workshop,descriptor.id,piece);return [pos.origin,pos.at].map(point=>({...point,width:r.width,height:r.height}));}));
 const baseWidth=Math.max(c.width+inset*2,...positionRects.map(r=>r.x+r.width+inset));
 const frameShellVisible=set==='common'&&!!frame&&(selected.includes('common-frame')||frame.elements.length>0||frame.step===4);
 const targetScale=windowMode==='maximized'?(c.width+inset*2)/c.width:1,targetInset=windowMode==='maximized'?0:inset;
 const boardWidth=baseWidth*targetScale;
 const appOffset={x:targetInset,y:targetInset+(frameShellVisible?0:f.frameTitleHeight*targetScale)};
 const loose=descriptors.flatMap(descriptor=>fittingDefinition(descriptor.id).pieces.filter(piece=>puzzlePieceVisible(workshop,descriptor.id,piece)).map(piece=>({part:descriptor,piece,r:puzzlePieceRect(workshop,descriptor.id,piece),position:workshop.parts[descriptor.id]!.fitting!.positions![piece]!})));
 const boardHeight=Math.max(windowHeight+inset*2,...positionRects.map(r=>r.y+r.height+inset))*targetScale;
 const [space,setSpace]=useState<{width:number;height:number}|null>(null);
 useLayoutEffect(()=>{
  const node=viewport.current;if(!node||preview)return;
  const measure=()=>{const css=getComputedStyle(node),n=(value:string)=>Number.parseFloat(value)||0;
   const width=node.clientWidth-n(css.paddingLeft)-n(css.paddingRight),height=node.clientHeight-n(css.paddingTop)-n(css.paddingBottom);
   setSpace(previous=>previous?.width===width&&previous.height===height?previous:{width,height});};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
 },[preview]);
 const displayZoom=space?Math.max(.001,Math.min(zoom,space.width/boardWidth,space.height/boardHeight)):zoom;
 useEffect(()=>onTargetScale?.(displayZoom*targetScale/zoom),[onTargetScale,displayZoom,targetScale,zoom]);
 const history=useRef({run:`${state.createdAt}:${state.run.version}`,parts:workshop.parts,serial:0});
 useEffect(()=>{
  const previous=history.current,run=`${state.createdAt}:${state.run.version}`;
  if(previous.run===run&&!reducedMotion){
   for(const [id,p] of Object.entries(workshop.parts))for(const [piece,socket] of Object.entries(p?.fitting?.sockets??{})){
    if(previous.parts[id as WorkshopPartId]?.fitting?.sockets[piece]!==socket)setResponse({part:id as WorkshopPartId,piece,socket,at:++previous.serial});
   }
  }else setResponse(null);
  history.current={run,parts:workshop.parts,serial:previous.serial};
 },[workshop.parts,state.createdAt,state.run.version,reducedMotion]);
 const [hovered,setHovered]=useState<{part:WorkshopPartId;piece:string}|null>(null);
 const highlight=drag??hovered;
 useEffect(()=>{gesture.current=null;setDrag(null);setWindowMode('normal');setResponse(null);setHovered(null);},[set,state.createdAt,state.run.version]);
 useEffect(()=>{if(!response)return;let stop=()=>{};stop=platform.every(f.snapPulseMs,()=>{stop();setResponse(null);});return stop;},[response,platform,f.snapPulseMs]);
 const point=(e:PointerEvent):Point=>{const r=board.current!.getBoundingClientRect();return{x:(e.clientX-r.left)*boardWidth/r.width,y:(e.clientY-r.top)*boardHeight/r.height};};
 const socketBoardRect=(id:WorkshopPartId,socket:string):WorkshopRect|null=>{const p=workshop.parts[id];if(!p)return null;const r=fittingSocketRects(getWorkshopPart(id),p.rect,showAdjustments?p.design.scrollbarWidth:undefined)[socket];return r?{x:(r.x+p.rect.x)*targetScale+appOffset.x,y:(r.y+p.rect.y)*targetScale+appOffset.y,width:r.width*targetScale,height:r.height*targetScale}:null;};
 const candidate=(id:WorkshopPartId,piece:string,p:Point):string|null=>{
  const definition=fittingDefinition(id),sockets=workshop.parts[id]?.fitting?.sockets??{};
  const near=definition.sockets.flatMap(socket=>{
   if(!socket.accepts.includes(piece)||!socket.stacked&&Object.entries(sockets).some(([other,seat])=>other!==piece&&seat===socket.id))return [];
   const r=socketBoardRect(id,socket.id);if(!r)return [];
   const dx=Math.max(r.x-p.x,0,p.x-r.x-r.width),dy=Math.max(r.y-p.y,0,p.y-r.y-r.height);
   const tolerance=state.persistent.editorCustomization.grid?f.snapDistance:0;
   return Math.hypot(dx,dy)<=tolerance?[{id:socket.id,distance:Math.hypot(p.x-r.x-r.width/2,p.y-r.y-r.height/2)}]:[];
  }).sort((a,b)=>a.distance-b.distance);
  return near[0]?.id??null;
 };
 const begin=(e:PointerEvent,id:WorkshopPartId,piece:string,isLoose:boolean)=>{
  if(e.button!==0||picking)return;
  suppressClick.current=false;
  const target=e.target as HTMLElement;
  if(!isLoose&&target.closest('input,textarea,select,[data-fitting-interactive]')&&!target.closest('[data-fitting-grip]'))return;
  const source=e.currentTarget.closest<HTMLElement>('[data-fitting-piece]'),r=source?.getBoundingClientRect(),seat=puzzlePieceRect(workshop,id,piece);
  if(!r)return;
  const p=point(e),bounds=board.current!.getBoundingClientRect(),next={part:id,piece,start:p,pointer:p,loose:isLoose,moved:false,pointerId:e.pointerId,offset:{x:(e.clientX-r.left)*boardWidth/bounds.width,y:(e.clientY-r.top)*boardHeight/bounds.height},width:seat.width*targetScale,height:seat.height*targetScale};gesture.current=next;
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
  if(!g.moved)return;
  e.preventDefault();e.stopPropagation();suppressClick.current=true;
  const p=point(e),view=board.current!.closest('.wf-workbench-scroll')!.getBoundingClientRect();
  const inside=e.clientX>=view.left&&e.clientX<view.right&&e.clientY>=view.top&&e.clientY<view.bottom&&p.x>=0&&p.x<=boardWidth&&p.y>=0&&p.y<=boardHeight;
  const socket=inside?candidate(g.part,g.piece,p):null;
  if(socket)dispatch({type:'fitPiece',part:g.part,piece:g.piece,socket});
  else dispatch({type:'stagePiece',part:g.part,piece:g.piece,...(inside?{at:{x:Math.max(0,Math.min(baseWidth-g.width/targetScale,(p.x-g.offset.x)/targetScale)),y:Math.max(0,Math.min(boardHeight/targetScale-g.height/targetScale,(p.y-g.offset.y)/targetScale))}}:{})});
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
 const renderPiece=(descriptor:WorkshopPartDefinition,p:PartProduction,piece:string,seat:string)=>{
  const r=fittingSocketRects(descriptor,p.rect,p.design.scrollbarWidth)[seat];if(!r)return null;
  return <FittedPiece key={piece} descriptor={descriptor} production={p} piece={piece} seat={seat} i18n={i18n} style={styleRect(r)} draggable={showShell} hidden={drag?.piece===piece&&drag.part===descriptor.id} state={state} begin={e=>begin(e,descriptor.id,piece,false)} onWindowAction={windowAction} hover={value=>setHovered(value?{part:descriptor.id,piece}:null)}>
   {descriptor.id==='common-frame'&&piece==='scrollbar'?<FrameScrollRail target={scrollTarget} production={p} i18n={i18n}/>:null}
  </FittedPiece>;
 };
 const renderShell=(descriptor:WorkshopPartDefinition,original:PartProduction,isActive:boolean)=>{
  const p=showAdjustments?original:{...original,design:createComponentDesign()};
  const d=fittingDefinition(descriptor.id),map=p.fitting?.sockets??Object.fromEntries(p.elements.map(piece=>[piece,d.sockets.find(socket=>socket.accepts.includes(piece))?.id??piece]));
  const geometry=fittingSocketRects(descriptor,p.rect,p.design.scrollbarWidth),native=usesNativeComponentColors(p.design),isFrame=descriptor.id==='common-frame';
  const frameContentTop=isFrame?Math.max(f.frameTitleHeight,...fittingPartsForSet('common').filter(sibling=>sibling.id!=='common-frame').flatMap(sibling=>{const other=workshop.parts[sibling.id];return other&&(selected.includes(sibling.id)||other.elements.length>0||other.step===4)?[other.rect.y+other.rect.height-p.rect.y+c.inset]:[];})):f.frameTitleHeight;
  const shellStyle={...styleRect(p.rect),fontSize:p.design.fontSize,borderRadius:p.design.radius,backgroundColor:native?undefined:p.design.color,color:native?undefined:p.design.textColor,'--wf-part-bg':native?'#c0c0c0':p.design.color,'--wf-part-fg':native?'#101010':p.design.textColor} as CSSProperties;
  return <section key={descriptor.id} className={`wf-part-shell ${isFrame?'wf-frame-shell':''} ${isActive?'is-active':''} ${showShell?'':'is-shell-hidden'} ${isActive?'':'is-unselected'}`} data-workshop-canvas-part={descriptor.id} data-fitting-shell={descriptor.id} data-component-motion={p.design.motion} style={shellStyle} aria-label={t(descriptor.labelKey)}>
   {isFrame&&<><div className="wf-frame-title-surface" style={{height:f.frameTitleHeight}}/><div className="wf-frame-content" ref={scrollTarget} style={{top:frameContentTop,right:p.elements.includes('scrollbar')?p.design.scrollbarWidth+4:4}}>
    {files.entries.map(entry=><button type="button" key={entry.id} aria-pressed={files.selectedId===entry.id} onClick={()=>actions.selectFile(entry.id)}><WorkshopGlyph name="file"/><span>{entry.name}</span></button>)}
    <pre className="wf-frame-note">{state.persistent.productionNote??t('intro.note')}</pre>
   </div></>}
   {showShell&&isActive&&d.sockets.map(socket=>{
    const r=geometry[socket.id],occupied=Object.entries(map).some(([piece,seat])=>seat===socket.id&&!(drag?.part===descriptor.id&&drag.piece===piece)),nextPiece=d.pieces.find(piece=>map[piece]===undefined),next=state.persistent.examplesEnabled&&!occupied&&nextPiece&&socket.accepts.includes(nextPiece);
    if(!r)return null;
    return <div key={socket.id} className={`wf-socket ${occupied?'is-filled':''} ${next?'is-next':''} ${drag&&drag.part===descriptor.id&&candidate(drag.part,drag.piece,drag.pointer)===socket.id?'is-near':''} ${highlight&&!occupied&&Math.abs(puzzlePieceRect(workshop,highlight.part,highlight.piece).width-r.width)<.1&&Math.abs(puzzlePieceRect(workshop,highlight.part,highlight.piece).height-r.height)<.1?'is-compatible':''}`} data-fitting-socket={socket.id} data-socket-accepts={socket.accepts.join(',')} data-socket-filled={occupied||undefined} role="img" aria-label={t('wf.socket',{name:t(`ws.element.${socket.accepts[0]}`)})} style={styleRect(r)}/>;
   })}
   {showPieces&&d.pieces.filter(piece=>map[piece]!==undefined).map(piece=>renderPiece(descriptor,p,piece,map[piece]!))}
   {!reducedMotion&&response?.part===descriptor.id&&geometry[response.socket]&&<div key={`${response.at}:${response.piece}`} className="wf-snap-response" data-workshop-snap={descriptor.id} data-fitting-snap={response.piece} data-reduced-motion={reducedMotion||undefined} role="status" aria-label={t('wf.snap',{name:t(`ws.element.${response.piece}`)})} style={{...styleRect(geometry[response.socket]!),animationDuration:`${f.snapPulseMs}ms`}}/>}
  </section>;
 };
 return <div ref={viewport} className="ws-workbench-scroll wf-workbench-scroll" data-workshop-fit={!preview||undefined} data-workshop-picking={picking||undefined} onClickCapture={pick}>
  <div className="wf-board-sizer ws-canvas-sizer" style={{width:boardWidth*displayZoom,height:boardHeight*displayZoom}}>
   <div ref={board} className="wf-board" data-fitting-board data-workshop-canvas data-reduced-motion={reducedMotion||undefined} style={{width:boardWidth,height:boardHeight,transform:`scale(${displayZoom})`}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setDrag(null);}}>
    {windowMode!=='normal'&&<button type="button" className="wf-restore-target" data-workshop-action="restoreTarget" onClick={()=>setWindowMode('normal')}>{t('wf.restoreTarget')}</button>}
    {windowMode!=='closed'&&<div className={`wf-destination-window ${windowMode==='maximized'?'is-maximized':''}`} data-workshop-target={set} data-destination-era={state.persistent.appearance.desktop} style={{left:targetInset,top:targetInset,width:c.width,height:windowMode==='minimized'?f.frameTitleHeight:windowHeight,transform:`scale(${targetScale})`,transformOrigin:'top left'}}>
     {!frameShellVisible&&<div className="wf-target-title" style={{height:f.frameTitleHeight}}><span>{t(`ws.set.${set}`)}</span><div className="wf-target-controls">{frame?.elements.filter((piece):piece is 'minimize'|'maximize'|'close'=>['minimize','maximize','close'].includes(piece)).map(symbol=><button type="button" key={symbol} data-workshop-control={symbol} aria-label={t(`ws.window.${symbol}`)} onClick={()=>windowAction(symbol)} style={fittingWindowControlPalette}><WorkshopGlyph name={symbol}/></button>)}</div></div>}
     {windowMode!=='minimized'&&<div className="wf-destination-surface" style={{height:c.height,top:frameShellVisible?0:f.frameTitleHeight}}>
      {!part&&<p className="wf-empty-canvas">{t('wf.emptyCanvas')}</p>}
      {descriptors.map(descriptor=>{const p=workshop.parts[descriptor.id];return p&&(selected.includes(descriptor.id)||p.elements.length>0||p.step===4)?renderShell(descriptor,p,selected.includes(descriptor.id)||drag?.part===descriptor.id):null;})}
     </div>}
    </div>}
    {showPieces&&loose.map(({part:descriptor,piece,r,position})=>{
     const original=workshop.parts[descriptor.id]!,p=showAdjustments?original:{...original,design:createComponentDesign()};
     return <div className="wf-loose-piece" key={`${descriptor.id}:${piece}`} data-fitting-part={descriptor.id} data-fitting-piece={piece} data-piece-status="spawned" style={{left:position.at.x*targetScale,top:position.at.y*targetScale,width:r.width*targetScale,height:r.height*targetScale,visibility:drag?.piece===piece&&drag.part===descriptor.id?'hidden':undefined}} role="button" tabIndex={0} aria-label={t('wf.dragPiece',{name:t(`ws.element.${piece}`)})} onPointerEnter={()=>setHovered({part:descriptor.id,piece})} onPointerLeave={()=>setHovered(null)} onPointerDown={e=>begin(e,descriptor.id,piece,true)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const socket=fittingDefinition(descriptor.id).sockets.find(seat=>seat.accepts.includes(piece)&&(seat.stacked||!Object.values(p.fitting!.sockets).includes(seat.id)));if(socket)dispatch({type:'fitPiece',part:descriptor.id,piece,socket:socket.id});}}}>
      <div className="wf-piece-scale" style={{width:r.width,height:r.height,transform:`scale(${targetScale})`}}><FittingPieceContent part={descriptor} production={p} piece={piece} state={state} i18n={i18n} loose/></div>
     </div>;
    })}
    {drag&&<div className="wf-drag-ghost" data-fitting-part={drag.part} data-fitting-drag={drag.piece} style={{left:drag.pointer.x-drag.offset.x,top:drag.pointer.y-drag.offset.y,width:drag.width,height:drag.height}}><div className="wf-piece-scale" style={{width:drag.width/targetScale,height:drag.height/targetScale,transform:`scale(${targetScale})`}}><FittingPieceContent part={getWorkshopPart(drag.part)} production={showAdjustments?workshop.parts[drag.part]!:{...workshop.parts[drag.part]!,design:createComponentDesign()}} piece={drag.piece} state={state} i18n={i18n} loose/></div></div>}

   </div>
  </div>
  {!preview&&<WorkshopExportShelf state={state} i18n={i18n} platform={platform} viewport={viewport} reducedMotion={reducedMotion}/>}
 </div>;
}
function FittedPiece({descriptor,production,piece,seat,style,draggable,hidden,state,i18n,begin,onWindowAction,hover,children}:{descriptor:WorkshopPartDefinition;production:PartProduction;piece:string;seat:string;style:CSSProperties;draggable:boolean;hidden:boolean;state:GameState;i18n:I18n;begin:(event:PointerEvent)=>void;onWindowAction:(symbol:'minimize'|'maximize'|'close')=>void;hover:(value:boolean)=>void;children:ReactNode}) {
 const front=useFittingPieceFront(descriptor.id,piece,production),t=i18n.t;
 return <div className={`wf-fitted-piece wf-piece-${piece} ${draggable?'is-draggable':''}`} data-fitting-part={descriptor.id} data-fitting-piece={piece} data-fitting-seat={seat} data-piece-status="fitted" data-piece-front={front} style={{...style,display:front?undefined:'none',visibility:hidden?'hidden':undefined}} onPointerEnter={()=>hover(true)} onPointerLeave={()=>hover(false)} onPointerDown={draggable?begin:undefined}>
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
