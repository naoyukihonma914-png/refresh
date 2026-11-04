import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { BALANCE } from '../../config/balance';
import { currentGroupTools, groupBounds, looseGroupPiece } from '../../systems/groupPuzzle';
import { groupTool, toolLabel, type WorkshopToolId } from '../../content/workshopGroups';
import type { GameState } from '../../systems/state';
import type { I18n, MessageKey } from '../../content/i18n';
import type { Platform } from '../../platform/types';
import type { PiecePoint } from '../../systems/workshopPuzzle';
import type { WorkshopDispatch } from './WorkshopCustomization';
import { GroupArtworkProviders, GroupPieceArtwork, GroupToolSurface } from './GroupToolArtwork';
import { WorkshopDestinationGlyph } from './WorkshopSchematic';
import { WorkshopGlyph } from './WorkshopGlyph';
import './group-puzzle.css';

interface Gesture {tool:WorkshopToolId;piece:string;start:PiecePoint;pointer:PiecePoint;offset:PiecePoint;width:number;height:number;pointerId:number;moved:boolean}
interface Flight {tool:WorkshopToolId;style:CSSProperties}
export interface GroupCanvasProps {state:GameState;i18n:I18n;platform:Platform;dispatch:WorkshopDispatch;zoom:number;onScale?:(scale:number)=>void;picking:boolean;onPick:(color:string)=>void;showPieces?:boolean;showSockets?:boolean;showAdjustments?:boolean}
export function GroupPuzzleCanvas(props:GroupCanvasProps){
 return <GroupArtworkProviders state={props.state} i18n={props.i18n}><GroupBoard {...props}/></GroupArtworkProviders>;
}
function GroupBoard({state,i18n,platform,dispatch,zoom,onScale,picking,onPick,showPieces=true,showSockets=true,showAdjustments=true}:GroupCanvasProps){
 const g=state.run.workshop.groupPuzzle!,reduced=platform.animation.reducedMotion(),b=groupBounds(),t=i18n.t;
 const viewport=useRef<HTMLDivElement>(null),board=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),serial=useRef(0),suppress=useRef(false);
 const [drag,setDrag]=useState<Gesture|null>(null),[hover,setHover]=useState<{tool:WorkshopToolId;piece:string}|null>(null);
 const [space,setSpace]=useState({width:1200,height:800}),[response,setResponse]=useState<{tool:WorkshopToolId;piece:string;serial:number}|null>(null);
 const [preview,setPreview]=useState<WorkshopToolId|null>(null),[folded,setFolded]=useState<WorkshopToolId[]>([]),[flights,setFlights]=useState<Flight[]>([]);
 const tools=currentGroupTools(g).filter(tool=>!g.tools[tool.id]!.completionPaid);
 const extents=tools.flatMap(tool=>{const p=g.tools[tool.id]!;return tool.pieces.flatMap(piece=>[p.positions[piece.id]!.origin,p.positions[piece.id]!.at].map(point=>({x:point.x+piece.rect.width+b.inset,y:point.y+piece.rect.height+b.inset})));});
 const width=Math.max(704,...extents.map(p=>p.x)),height=Math.max(512,...extents.map(p=>p.y));
 const scale=Math.max(.001,Math.min(zoom,space.width/width,space.height/height));
 useLayoutEffect(()=>{
  const node=viewport.current;if(!node)return;const measure=()=>{const css=getComputedStyle(node),n=(s:string)=>parseFloat(s)||0;setSpace({width:node.clientWidth-n(css.paddingLeft)-n(css.paddingRight),height:node.clientHeight-n(css.paddingTop)-n(css.paddingBottom)});};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>onScale?.(scale),[onScale,scale]);
 const run=`${state.createdAt}:${state.run.version}`;
 const history=useRef<{run:string;shelf:WorkshopToolId[];state:GameState;bounds:DOMRect|null;scale:number}>({run,shelf:g.shelf,state,bounds:null,scale});
 useLayoutEffect(()=>{
  const before=history.current,node=viewport.current,root=board.current;
  if(node&&root&&before.run===run&&!reduced){
   const v=node.getBoundingClientRect(),outer=v.width/node.offsetWidth,old=before.state.run.workshop.groupPuzzle!;
   const added=g.shelf.filter(id=>!before.shelf.includes(id));
   if(added.length)setFlights(added.flatMap(tool=>{
    const d=groupTool(tool),origin=old.tools[tool]?.positions[d.base]?.at,from=before.bounds,target=node.querySelector(`[data-group-icon="${tool}"] .gp-shelf-image`)?.getBoundingClientRect();
    if(!origin||!from||!target)return [];
    const x=(from.left-v.left)/outer+origin.x*before.scale,y=(from.top-v.top)/outer+origin.y*before.scale;
    return [{tool,style:{left:x,top:y,width:d.width*before.scale,height:d.height*before.scale,'--gp-from-scale':before.scale,'--gp-to-scale':Math.min(target.width/outer/d.width,target.height/outer/d.height),'--gp-x':`${(target.left-v.left)/outer-x}px`,'--gp-y':`${(target.top-v.top)/outer-y}px`,'--gp-width':`${target.width/outer}px`,'--gp-height':`${target.height/outer}px`,'--gp-duration':`${b.glowMs+b.flightMs}ms`} as CSSProperties}];
   }));
   for(const tool of tools)for(const piece of tool.pieces)if(g.tools[tool.id]!.fitted[piece.id]&&!old.tools[tool.id]?.fitted[piece.id])setResponse({tool:tool.id,piece:piece.id,serial:++serial.current});
  }
  history.current={run,shelf:g.shelf,state,bounds:root?.getBoundingClientRect()??null,scale};
 },[g.tools,g.shelf,run,reduced,scale,state,tools,b.glowMs,b.flightMs]);
 useEffect(()=>{if(!response)return;let stop=()=>{};stop=platform.every(BALANCE.workshop.fitting.snapPulseMs,()=>{stop();setResponse(null);});return stop;},[response,platform]);
 useEffect(()=>{if(!flights.length)return;let stop=()=>{};stop=platform.every(b.flightMs+b.glowMs,()=>{stop();setFlights([]);});return stop;},[flights,platform,b.flightMs,b.glowMs]);
 useEffect(()=>{gesture.current=null;setDrag(null);setHover(null);setResponse(null);setFolded([]);setPreview(null);},[g.selected,run]);
 const point=(event:PointerEvent):PiecePoint=>{const r=board.current!.getBoundingClientRect();return {x:(event.clientX-r.left)*width/r.width,y:(event.clientY-r.top)*height/r.height};};
 const candidate=(value:Gesture):boolean=>{
  const d=groupTool(value.tool),p=g.tools[value.tool]!,piece=d.pieces.find(piece=>piece.id===value.piece)!;
  if(value.piece===d.base||!p.placed||folded.includes(d.id))return false;
  const at=p.positions[d.base]!.at,r=piece.rect,pt=value.pointer,dx=Math.max(at.x+r.x-pt.x,0,pt.x-at.x-r.x-r.width),dy=Math.max(at.y+r.y-pt.y,0,pt.y-at.y-r.y-r.height);
  return Math.hypot(dx,dy)<=(state.persistent.editorCustomization.grid?b.snapDistance:0);
 };
 const begin=(event:PointerEvent,tool:WorkshopToolId,piece:string,fitted=false)=>{
  if(event.button!==0||picking)return;
  const d=groupTool(tool),p=g.tools[tool]!,target=event.target as HTMLElement;
  if(piece===d.base&&p.locked||target.closest('input,select,textarea,button')&&!target.closest('[data-group-grip]'))return;
  if(piece===d.base&&target.closest('[data-group-installed]'))return;
  const source=event.currentTarget.closest<HTMLElement>('[data-group-piece]')!,r=source.getBoundingClientRect(),bounds=board.current!.getBoundingClientRect(),pt=point(event),seat=d.pieces.find(item=>item.id===piece)!.rect;
  gesture.current={tool,piece,start:pt,pointer:pt,offset:{x:(event.clientX-r.left)*width/bounds.width,y:(event.clientY-r.top)*height/bounds.height},width:seat.width,height:seat.height,pointerId:event.pointerId,moved:false};
  suppress.current=false;event.stopPropagation();if(!fitted){event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}
 };
 const move=(event:PointerEvent)=>{
  const value=gesture.current;if(!value||event.pointerId!==value.pointerId)return;
  const pt=point(event),moved=value.moved||Math.hypot(pt.x-value.start.x,pt.y-value.start.y)>=BALANCE.workshop.fitting.dragThreshold;
  gesture.current={...value,pointer:pt,moved};if(moved){if(!value.moved)board.current?.setPointerCapture(event.pointerId);event.preventDefault();setDrag(gesture.current);}
 };
 const end=(event:PointerEvent)=>{
  const value=gesture.current;if(!value||event.pointerId!==value.pointerId)return;gesture.current=null;setDrag(null);if(!value.moved)return;
  suppress.current=true;event.preventDefault();event.stopPropagation();const r=board.current!.getBoundingClientRect(),v=viewport.current!.getBoundingClientRect(),pt=point(event);
  const inside=event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom&&event.clientX>=v.left&&event.clientX<=v.right&&event.clientY>=v.top&&event.clientY<=v.bottom;
  const at={x:Math.max(b.inset,Math.min(width-b.inset-value.width,pt.x-value.offset.x)),y:Math.max(b.inset,Math.min(height-b.inset-value.height,pt.y-value.offset.y))};
  if(inside&&value.piece===groupTool(value.tool).base)dispatch({type:'groupPlace',tool:value.tool,at});
  else if(inside&&candidate({...value,pointer:pt}))dispatch({type:'groupFit',tool:value.tool,piece:value.piece});
  else dispatch({type:'groupStage',tool:value.tool,piece:value.piece,...(inside?{at}:{})});
 };
 const highlighted=drag??hover;
 const artworkState=showAdjustments?state:{...state,run:{...state.run,workshop:{...state.run.workshop,groupPuzzle:{...g,tools:Object.fromEntries(Object.entries(g.tools).map(([id,p])=>[id,{...p,designs:{}}]))}}}} as GameState;
 const windowAction=(tool:WorkshopToolId,action:'minimize'|'maximize'|'close')=>action==='maximize'?setPreview(tool):setFolded(previous=>previous.includes(tool)?previous.filter(id=>id!==tool):[...previous,tool]);
 return <div ref={viewport} className="gp-workbench" data-group-workbench data-reduced-motion={reduced||undefined} onPointerDownCapture={()=>{suppress.current=false;}} onClickCapture={event=>{
  if(suppress.current){suppress.current=false;event.stopPropagation();event.preventDefault();return;}
  if(!picking)return;let node=event.target as HTMLElement;while(node&&viewport.current?.contains(node)){const rgb=getComputedStyle(node).backgroundColor.match(/[\d.]+/g);if(rgb&&rgb.length>=3&&(rgb.length<4||Number(rgb[3])>0)){onPick('#'+rgb.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join(''));event.stopPropagation();return;}node=node.parentElement!;}
 }}>
  <div className="gp-board-sizer" style={{width:width*scale,height:height*scale}}><div ref={board} className="gp-board" data-group-board style={{width,height,transform:`scale(${scale})`}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setDrag(null);}}>
   {!tools.length&&<p className="gp-empty">{t((g.selected&&g.purchased.includes(g.selected)?'group.allComplete':'group.choose') as MessageKey)}</p>}
   {tools.filter(tool=>g.tools[tool.id]!.placed).map(tool=>{
    const p=g.tools[tool.id]!,at=p.positions[tool.base]!.at,isFolded=folded.includes(tool.id);
    return <section key={tool.id} data-group-frame={tool.id} data-group-piece={tool.base} data-group-owner={tool.id} data-frame-locked={p.locked} className={`gp-placed-frame ${g.focus===tool.id?'is-focused':''} ${isFolded?'is-folded':''}`} style={{left:at.x,top:at.y,width:tool.width,height:isFolded?32:tool.height,zIndex:g.focus===tool.id?3:1,visibility:drag?.tool===tool.id&&drag.piece===tool.base?'hidden':undefined}} onPointerDown={event=>begin(event,tool.id,tool.base,true)}>
     <GroupPieceArtwork state={artworkState} i18n={i18n} tool={tool.id} piece={tool.pieces[0]!} interactive onWindowAction={action=>windowAction(tool.id,action)}/>
     {isFolded?<button className="gp-restore" type="button" onClick={()=>setFolded(previous=>previous.filter(id=>id!==tool.id))}>{t('wf.restoreTarget')}</button>:tool.pieces.filter(piece=>piece.id!==tool.base).map(piece=>{
      const r=piece.rect,fitted=!!p.fitted[piece.id]&&!(drag?.tool===tool.id&&drag.piece===piece.id),match=highlighted&&Math.abs(groupTool(highlighted.tool).pieces.find(item=>item.id===highlighted.piece)!.rect.width-r.width)<.1&&Math.abs(groupTool(highlighted.tool).pieces.find(item=>item.id===highlighted.piece)!.rect.height-r.height)<.1;
      return <div key={piece.id} data-group-socket={piece.id} data-group-socket-owner={tool.id} data-group-installed={fitted||undefined} data-group-piece={fitted?piece.id:undefined} data-group-owner={tool.id} className={`gp-seat ${fitted?'is-fitted':showSockets?'is-empty':''} ${!fitted&&match?'is-compatible':''} ${drag?.tool===tool.id&&drag.piece===piece.id&&candidate(drag)?'is-near':''}`} style={{left:r.x,top:r.y,width:r.width,height:r.height}} onPointerEnter={()=>fitted&&setHover({tool:tool.id,piece:piece.id})} onPointerLeave={()=>setHover(null)} onPointerDown={event=>fitted&&begin(event,tool.id,piece.id,true)}>
       {fitted&&showPieces&&<><GroupPieceArtwork state={artworkState} i18n={i18n} tool={tool.id} piece={piece} interactive/><button className="gp-grip" type="button" data-group-grip aria-label={t('wf.dragPiece',{name:t(piece.label as MessageKey)})} onPointerDown={event=>begin(event,tool.id,piece.id,true)}><WorkshopGlyph name="move"/></button></>}
       {!reduced&&response?.tool===tool.id&&response.piece===piece.id&&<span key={response.serial} className="gp-fit-effect" data-group-snap={piece.id} style={{animationDuration:`${BALANCE.workshop.fitting.snapPulseMs}ms`}}/>}
      </div>;
     })}
    </section>;
   })}
   {showPieces&&tools.flatMap(tool=>{const p=g.tools[tool.id]!;return tool.pieces.filter(piece=>looseGroupPiece(p,tool.base,piece.id)).map(piece=>{
    const at=p.positions[piece.id]!.at;return <div key={`${tool.id}:${piece.id}`} className={`gp-loose ${g.focus===tool.id?'is-focused':''}`} data-group-loose data-group-piece={piece.id} data-group-owner={tool.id} style={{left:at.x,top:at.y,width:piece.rect.width,height:piece.rect.height,zIndex:6+Math.max(0,g.stack.indexOf(`${tool.id}:${piece.id}`)+1),visibility:drag?.tool===tool.id&&drag.piece===piece.id?'hidden':undefined}} role="button" tabIndex={0} aria-label={t('wf.dragPiece',{name:`${t(toolLabel(tool.id) as MessageKey)} ${t(piece.label as MessageKey)}`})} onPointerEnter={()=>setHover({tool:tool.id,piece:piece.id})} onPointerLeave={()=>setHover(null)} onPointerDown={event=>begin(event,tool.id,piece.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();dispatch(piece.id===tool.base?{type:'groupPlace',tool:tool.id,at}:{type:'groupFit',tool:tool.id,piece:piece.id});}}}>
     <GroupPieceArtwork state={artworkState} i18n={i18n} tool={tool.id} piece={piece} loose/>
    </div>;
   });})}
   {drag&&<div className="gp-drag" data-group-drag={drag.piece} data-group-drag-owner={drag.tool} style={{left:drag.pointer.x-drag.offset.x,top:drag.pointer.y-drag.offset.y,width:drag.width,height:drag.height}}><GroupPieceArtwork state={artworkState} i18n={i18n} tool={drag.tool} piece={groupTool(drag.tool).pieces.find(piece=>piece.id===drag.piece)!} loose/></div>}
  </div></div>
  <aside className="gp-desktop-shelf" data-group-shelf aria-label={t('ws.shelfDesktop' as MessageKey)}><strong>{t('ws.shelfDesktop' as MessageKey)}</strong><div>{g.shelf.map(tool=><button type="button" key={tool} data-group-icon={tool} title={t(toolLabel(tool) as MessageKey)} onClick={()=>setPreview(tool)}><span className="gp-shelf-image"><WorkshopDestinationGlyph set={groupTool(tool).set}/></span><span>{t(toolLabel(tool) as MessageKey)}</span></button>)}</div></aside>
  {!reduced&&flights.map(flight=><div key={flight.tool} className="gp-completion-flight" data-group-completion={flight.tool} style={flight.style} aria-hidden="true"><div className="gp-flight-art"><GroupToolSurface state={state} i18n={i18n} tool={flight.tool} complete/></div><span className="gp-flight-icon"><WorkshopDestinationGlyph set={groupTool(flight.tool).set}/></span></div>)}
  {preview&&<div className="gp-preview-backdrop"><section className="gp-tool-dialog" role="dialog" aria-label={t(toolLabel(preview) as MessageKey)}><header><strong>{t(toolLabel(preview) as MessageKey)}</strong><button type="button" aria-label={t('ws.close')} onClick={()=>setPreview(null)}><WorkshopGlyph name="close"/></button></header><GroupToolSurface state={state} i18n={i18n} tool={preview} complete={g.tools[preview]!.completionPaid} interactive onWindowAction={action=>action==='maximize'?setPreview(null):setPreview(null)}/></section></div>}
 </div>;
}
