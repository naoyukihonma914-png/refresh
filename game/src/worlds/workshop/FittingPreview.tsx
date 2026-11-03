import { useMemo, useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import type { Platform } from '../../platform/types';
import type { GameState } from '../../systems/state';
import { createComponentDesign } from '../../systems/workshopState';
import { defaultPieceSocket, emptyFitting, fittedPieces } from '../../systems/workshopFitting';
import { FittingCanvas } from './FittingCanvas';
import { WorkshopGlyph } from './WorkshopGlyph';

/** An inert projection of this set's finished components, never game production. */
export function FittingPreview({state,i18n,platform}:{state:GameState;i18n:I18n;platform:Platform}) {
 const [collapsed,setCollapsed]=useState(false);
 const projected=useMemo(()=>{
  const source=state.run.workshop,active=source.activePart&&source.activePart!=='common-scrollbar'?getWorkshopPart(source.activePart):getWorkshopPart('common-frame');
  const parts={...source.parts};
  for(const definition of fittingPartsForSet(active.set)){
   const previous=parts[definition.id],fitting=emptyFitting(),recipe=fittingDefinition(definition.id);
   fitting.sockets={...previous?.fitting?.sockets};
   for(const piece of recipe.pieces){
    const seat=previous?.fitting?.sockets[piece]??defaultPieceSocket(recipe,fitting,piece);
    if(seat){fitting.sockets[piece]=seat;fitting.spawned.push(piece);fitting.paid.push(piece);}
   }
   fitting.completionPaid=true;
   const p={step:4 as const,rect:previous?.rect??{...definition.defaultRect},elements:[] as string[],design:previous?.design??createComponentDesign(),completedAt:previous?.completedAt??state.lastTickAt,exportedAt:null,tested:true,fitting};
   parts[definition.id]={...p,elements:fittedPieces(p,definition.id)};
  }
  const workshop={...source,activePart:active.id,parts};
  return {active,workshop,state:{...state,run:{...state.run,workshop}}};
 },[state]);
 const t=i18n.t;
 return <aside className="fitting-preview" data-fitting-preview data-collapsed={collapsed}>
  <header><strong>{t('tp.preview.title' as MessageKey)}</strong><button type="button" aria-label={t(collapsed?'ws.preview.open':'ws.window.minimize')} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><WorkshopGlyph name={collapsed?'maximize':'minimize'}/></button></header>
  {!collapsed&&<div className="fitting-preview-surface" role="img" aria-label={t('fitting.previewFor' as MessageKey,{name:t(`ws.set.${projected.active.set}`)})}>
   <div inert aria-hidden="true"><FittingCanvas platform={platform} state={projected.state} workshop={projected.workshop} part={projected.active} production={projected.workshop.parts[projected.active.id]} zoom={BALANCE.workshop.fitting.previewZoom} dispatch={()=>{}} i18n={i18n} picking={false} onPick={()=>{}} reducedMotion showShell={false}/></div>
  </div>}
 </aside>;
}
