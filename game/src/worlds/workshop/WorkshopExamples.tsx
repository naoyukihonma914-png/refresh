import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart, type UiSetId, type WorkshopPartId } from '../../content/workshopCatalog';
import { fittingDefinition } from '../../content/workshopFitting';
import type { GameState } from '../../systems/state';
import { fittedPieces } from '../../systems/workshopFitting';
import { canBuyWorkshopSet, canInspectDesktopExit } from '../../systems/workshop';
import { canRelease } from '../../systems/release';
import { nextWorkshopTarget } from '../../systems/workshopNavigation';
import type { WorkshopDispatch } from './WorkshopCustomization';

export type WorkshopExampleHand =
 | {kind:'buySet';set:UiSetId}
 | {kind:'export'|'selectPart';part:WorkshopPartId}
 | {kind:'spawnPiece'|'fitPiece';part:WorkshopPartId;piece:string}
 | {kind:'exit'|'release'|'customize'};

/** Guidance describes a gesture; it never inserts a piece on the player's behalf. */
export function workshopExampleHand(state:GameState):WorkshopExampleHand {
 const w=state.run.workshop,id=w.activePart,p=id?w.parts[id]:undefined;
 if(id&&p&&id!=='common-scrollbar'){
  const pieces=fittingDefinition(id).pieces;
  const fitted=fittedPieces(p,id),missing=pieces.find(piece=>!fitted.includes(piece));
  if(missing)return {kind:p.fitting?.spawned.includes(missing)?'fitPiece':'spawnPiece',part:id,piece:missing};
  if(p.step===4&&p.exportedAt===null)return {kind:'export',part:id};
 }
 const next=nextWorkshopTarget(state);
 if(next?.kind==='set')return {kind:'buySet',set:next.set};
 if(next?.kind==='part')return {kind:'selectPart',part:next.part};
 if(next?.kind==='exit')return {kind:w.exitInspected&&canRelease(state)?'release':'exit'};
 return {kind:'customize'};
}

export function WorkshopExamples({state,i18n,dispatch,onRelease}:{state:GameState;i18n:I18n;dispatch:WorkshopDispatch;onRelease:()=>void;finishHint?:(part:WorkshopPartId)=>string|null|undefined}){
 if(!state.persistent.examplesEnabled)return null;
 const hand=workshopExampleHand(state),t=i18n.t;
 let description:string,button:string|undefined,disabled=false,onClick:(()=>void)|undefined;
 switch(hand.kind){
  case 'buySet':description=t('examples.workshop.buySet' as MessageKey,{name:t(`ws.set.${hand.set}`)});button=t('ws.buySet');disabled=!canBuyWorkshopSet(state,hand.set);onClick=()=>dispatch({type:'buySet',set:hand.set});break;
  case 'spawnPiece':description=t('fitting.spawnHint' as MessageKey,{name:t(`ws.element.${hand.piece}` as MessageKey)});break;
  case 'fitPiece':description=t('fitting.dragHint' as MessageKey,{name:t(`ws.element.${hand.piece}` as MessageKey)});break;
  case 'export':description=t('examples.workshop.export' as MessageKey);button=t('ws.export');onClick=()=>dispatch({type:'export',part:hand.part});break;
  case 'selectPart':description=t('examples.workshop.nextPart' as MessageKey,{name:t(getWorkshopPart(hand.part).labelKey as MessageKey)});button=t(getWorkshopPart(hand.part).labelKey as MessageKey);onClick=()=>dispatch({type:'selectPart',part:hand.part});break;
  case 'release':description=t('examples.workshop.release' as MessageKey);button=t('ws.releaseReady');onClick=onRelease;break;
  case 'exit':description=t('examples.workshop.exit' as MessageKey);button=t('ws.assemble');disabled=!canInspectDesktopExit(state);onClick=()=>dispatch({type:'exit'});break;
  case 'customize':description=t('examples.workshop.customize' as MessageKey);break;
 }
 return <section className="ws-example-hand" data-workshop-next-hand={hand.kind} aria-label={t('examples.workshop.nextHand' as MessageKey)}>
  <strong>{t('examples.workshop.nextHand' as MessageKey)}</strong><p role="status">{description}</p>
  {button&&<button type="button" className="ws-primary" data-workshop-example-action={hand.kind} disabled={disabled} onClick={onClick}>{button}</button>}
 </section>;
}
