import type { CSSProperties } from 'react';
import { fittingDefinition } from '../../content/workshopFitting';
import { fittingSocketRects } from '../../content/workshopFittingGeometry';
import { getWorkshopPart, type WorkshopPartId } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import { createComponentDesign, type PartProduction } from '../../systems/workshopState';
import { defaultPieceSocket, emptyFitting, fittedPieces } from '../../systems/workshopFitting';
import type { I18n, MessageKey } from '../../content/i18n';
import { BALANCE } from '../../config/balance';
import { WorkshopTargetProvider } from './WorkshopTargetContext';
import { OptionalTargetProvider } from './OptionalParts';
import { FittingPieceContent } from './FittingPieceContent';

export interface WorkshopHover {part:WorkshopPartId;piece?:string;top:number;right:number;limitHeight:number}
/** The same piece renderer as the workbench, projected without writing production or rewards. */
export function WorkshopHoverPreview({state,i18n,hover,zoom,contentOnly=false}:{state:GameState;i18n:I18n;hover:WorkshopHover;zoom:number;contentOnly?:boolean}) {
 const part=getWorkshopPart(hover.part),previous=state.run.workshop.parts[part.id],recipe=fittingDefinition(part.id),fitting=emptyFitting();
 fitting.sockets={...previous?.fitting?.sockets};
 for(const piece of recipe.pieces){const socket=fitting.sockets[piece]??defaultPieceSocket(recipe,fitting,piece);if(socket){fitting.sockets[piece]=socket;fitting.spawned.push(piece);fitting.paid.push(piece);}}
 fitting.completionPaid=true;
 const production:PartProduction={...previous,step:4,rect:previous?.rect??part.defaultRect,design:previous?.design??createComponentDesign(),fitting,elements:[],completedAt:state.lastTickAt,exportedAt:null,tested:true};
 production.elements=fittedPieces(production,part.id);
 const geometry=fittingSocketRects(part,production.rect,production.design.scrollbarWidth),seat=hover.piece?fitting.sockets[hover.piece]:null;
 const r=seat?geometry[seat]!:null,scale=r?zoom:Math.min(BALANCE.workshop.fitting.hoverScale,280/production.rect.width,180/production.rect.height);
 const width=(r?.width??production.rect.width)*scale,height=(r?.height??production.rect.height)*scale;
 const style={left:Math.max(4,hover.right-width-12),top:Math.max(4,Math.min(hover.top,hover.limitHeight-height-14)),width:width+10,height:height+10} as CSSProperties;
 const artwork=<WorkshopTargetProvider gameState={state} i18n={i18n}><OptionalTargetProvider gameState={state} i18n={i18n}>
   <div inert className="ws-hover-preview-content" style={{width:r?.width??production.rect.width,height:r?.height??production.rect.height,transform:`scale(${contentOnly?1:scale})`}}>
    {hover.piece?<FittingPieceContent part={part} production={production} piece={hover.piece} state={state} i18n={i18n} loose/>:recipe.pieces.map(piece=>{const rect=geometry[fitting.sockets[piece]!]!;return <div key={piece} style={{position:'absolute',left:rect.x,top:rect.y,width:rect.width,height:rect.height}}><FittingPieceContent part={part} production={production} piece={piece} state={state} i18n={i18n}/></div>;})}
   </div>
  </OptionalTargetProvider></WorkshopTargetProvider>;
 if(contentOnly)return artwork;
 return <div className="ws-hover-preview" data-workshop-hover={hover.piece?'piece':'part'} data-hover-part={part.id} data-hover-piece={hover.piece} style={style} role="img" aria-label={i18n.t('fitting.previewFor' as MessageKey,{name:hover.piece?i18n.t(`ws.element.${hover.piece}` as MessageKey):i18n.t(part.labelKey as MessageKey)})}>
{artwork}</div>;
}

export function CompletedPartImage({state,i18n,part}:{state:GameState;i18n:I18n;part:WorkshopPartId}){
 return <WorkshopHoverPreview state={state} i18n={i18n} hover={{part,top:0,right:0,limitHeight:0}} zoom={1} contentOnly/>;
}
