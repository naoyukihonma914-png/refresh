import { useRef,type CSSProperties,type ReactNode } from 'react';
import { groupTool, toolLabel, type GroupPieceDefinition, type WorkshopToolId } from '../../content/workshopGroups';
import { getWorkshopPart, type WorkshopPartId } from '../../content/workshopCatalog';
import { fittingDefinition } from '../../content/workshopFitting';
import { fittingSocketRects } from '../../content/workshopFittingGeometry';
import type { GameState } from '../../systems/state';
import type { I18n, MessageKey } from '../../content/i18n';
import { materialProduction } from '../../systems/groupPuzzle';
import { createComponentDesign, usesNativeComponentColors } from '../../systems/workshopState';
import { FittingPieceContent } from './FittingPieceContent';
import { WorkshopGlyph } from './WorkshopGlyph';
import { WorkshopTargetProvider } from './WorkshopTargetContext';
import { OptionalTargetProvider } from './OptionalParts';
import { usePieceTextFit } from './usePieceTextFit';
import { fittingWindowControlPalette } from '../../systems/commonChrome';

export function GroupArtworkProviders({state,i18n,children}:{state:GameState;i18n:I18n;children:ReactNode}){
 return <WorkshopTargetProvider gameState={state} i18n={i18n}><OptionalTargetProvider gameState={state} i18n={i18n}>{children}</OptionalTargetProvider></WorkshopTargetProvider>;
}
function MaterialImage({state,i18n,tool,id,width,height,only}:{state:GameState;i18n:I18n;tool:WorkshopToolId;id:WorkshopPartId;width:number;height:number;only?:string}){
 const settings=state.run.workshop.groupPuzzle!.tools[tool]!.designs,specific=settings[id]??createComponentDesign(),shared=settings['common-button']??createComponentDesign(),defaults=createComponentDesign(),part=getWorkshopPart(id);
 const inherit=!id.startsWith('common-'),design=inherit?{...specific,...(usesNativeComponentColors(specific)&&!usesNativeComponentColors(shared)?{nativeColors:false,color:shared.color,textColor:shared.textColor}:{}),radius:specific.radius===defaults.radius?shared.radius:specific.radius,fontSize:specific.fontSize===defaults.fontSize?shared.fontSize:specific.fontSize,shadow:specific.shadow||shared.shadow}:specific;
 const p={...materialProduction(id,state.lastTickAt,design,true),rect:{x:0,y:0,width,height}},geometry=fittingSocketRects(part,p.rect,design.scrollbarWidth);
 if(only)return <div className="gp-material" style={{width,height}}><FittingPieceContent part={part} production={p} piece={only} state={state} i18n={i18n}/></div>;
 return <div className="gp-material" data-group-material={id} style={{width,height}}>{fittingDefinition(id).pieces.filter(piece=>!only||piece===only).map(piece=>{
  const r=geometry[p.fitting!.sockets[piece]!]!;
  return <div key={piece} style={{position:'absolute',left:r.x,top:r.y,width:r.width,height:r.height}}><FittingPieceContent part={part} production={p} piece={piece} state={state} i18n={i18n}/></div>;
 })}</div>;
}
export function GroupPieceArtwork({state,i18n,tool,piece,loose=false,interactive=false,onWindowAction}:{state:GameState;i18n:I18n;tool:WorkshopToolId;piece:GroupPieceDefinition;loose?:boolean;interactive?:boolean;onWindowAction?:(action:'minimize'|'maximize'|'close')=>void}){
 const definition=groupTool(tool),p=state.run.workshop.groupPuzzle!.tools[tool]!,base=piece.id===definition.base;
 if(base){
  if(tool==='foundation')return <div inert={!interactive} className="gp-ground-art" data-group-piece-art data-loose={loose||undefined}><MaterialImage state={state} i18n={i18n} tool={tool} id="foundation-desktop" width={640} height={448}/><strong>{i18n.t('ws.set.foundation')}</strong></div>;
  if(tool==='tabs'||tool==='table')return <div inert={!interactive} className="gp-extension-art" data-group-piece-art data-loose={loose||undefined}><strong>{i18n.t(toolLabel(tool) as MessageKey)}</strong><div style={{position:'absolute',left:0,top:32}}><MaterialImage state={state} i18n={i18n} tool={tool} id={tool==='tabs'?'plugin-tabs':'plugin-table'} width={tool==='tabs'?360:240} height={tool==='tabs'?40:224} only={tool==='tabs'?'tab':'time'}/></div></div>;
  const design=p.designs['common-frame']??createComponentDesign(),heading=p.designs['common-heading']??createComponentDesign(),progress=p.designs['common-progress']??createComponentDesign(),native=usesNativeComponentColors(design),header=usesNativeComponentColors(design)&&!usesNativeComponentColors(heading)?heading:design;
  return <div inert={!interactive} className="gp-frame-art" data-group-piece-art data-loose={loose||undefined} data-tool-frame={tool} data-symbol-shape={design.symbolShape} style={{'--gp-frame-color':native&&usesNativeComponentColors(heading)?'#000080':header.color,'--gp-frame-text':native&&usesNativeComponentColors(heading)?'#fff':header.textColor,borderRadius:design.radius,boxShadow:design.shadow?'4px 4px #0005':undefined} as CSSProperties}>
   <header><GroupFrameTitle name={i18n.t(toolLabel(tool) as MessageKey)} size={design.fontSize===createComponentDesign().fontSize?heading.fontSize:design.fontSize} align={design.titleAlign}/><div>{(['minimize','maximize','close'] as const).map(action=><button key={action} type="button" aria-label={i18n.t(`ws.window.${action}`)} style={fittingWindowControlPalette} onClick={()=>onWindowAction?.(action)}><WorkshopGlyph name={action}/></button>)}</div></header>
   <div className="gp-integrated-scrollbar" data-arrows={design.arrows} style={{width:design.scrollbarWidth}}><MaterialImage state={state} i18n={i18n} tool={tool} id="common-frame" width={design.scrollbarWidth} height={408} only="scrollbar"/></div>
   <progress style={{height:progress.progressHeight/4,accentColor:usesNativeComponentColors(progress)?undefined:progress.color,borderRadius:progress.radius}} data-striped={progress.progressStyle==='striped'||undefined} className="gp-built-progress" max={definition.pieces.length} value={Object.keys(p.fitted).length+(p.placed?1:0)} aria-label={i18n.t('group.assemblyProgress' as MessageKey)}/>{progress.showPercent&&<small className="gp-built-percent">{i18n.t('ws.percent',{count:i18n.number((Object.keys(p.fitted).length+(p.placed?1:0))/definition.pieces.length*100)})}</small>}
  </div>;
 }
 const slots=piece.slots??piece.parts.map(part=>({part,rect:{x:0,y:0,width:piece.rect.width,height:piece.rect.height}}));
 return <div inert={!interactive} className="gp-element-art" data-group-piece-art data-loose={loose||undefined}>
  {slots.map(({part,rect:r})=><div key={part} style={{position:'absolute',left:r.x,top:r.y,width:r.width,height:r.height}}><MaterialImage state={state} i18n={i18n} tool={tool} id={part} width={r.width} height={r.height} only={tool==='tabs'?'page':tool==='table'?'pixels':undefined}/></div>)}
 </div>;
}
export function GroupToolSurface({state,i18n,tool,complete=false,interactive=false,onWindowAction}:{state:GameState;i18n:I18n;tool:WorkshopToolId;complete?:boolean;interactive?:boolean;onWindowAction?:(action:'minimize'|'maximize'|'close')=>void}){
 const d=groupTool(tool),p=state.run.workshop.groupPuzzle!.tools[tool]!;
 return <div className="gp-tool-surface" style={{width:d.width,height:d.height}}>
  <GroupPieceArtwork state={state} i18n={i18n} tool={tool} piece={d.pieces[0]!} interactive={interactive} onWindowAction={onWindowAction}/>
  {d.pieces.filter(piece=>piece.id!==d.base).map(piece=>{const r=piece.rect,fitted=complete||!!p.fitted[piece.id];return <div key={piece.id} className={fitted?'gp-surface-fitted':'gp-surface-hole'} style={{left:r.x,top:r.y,width:r.width,height:r.height}}>{fitted&&<GroupPieceArtwork state={state} i18n={i18n} tool={tool} piece={piece} interactive={interactive}/>}</div>;})}
 </div>;
}

function GroupFrameTitle({name,size,align}:{name:string;size:number;align:'start'|'center'|'end'}){const root=useRef<HTMLDivElement>(null);usePieceTextFit(root,size);return <div className="gp-frame-title" ref={root} style={{textAlign:align}}>{name}</div>;}
