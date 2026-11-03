import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { UI_SETS, getWorkshopPart, type UiSetId, type WorkshopPartId } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import { paletteFor } from '../../content/palette';
import { fittedPieces } from '../../systems/workshopFitting';
import { editorStage } from '../../systems/appearance';
import { blueprintAppForSet } from '../../systems/appAssembly';
import type { BuiltApp } from '../../systems/desktopState';
import { passivePixelsPerSecond } from '../../systems/economy';
import { canRelease } from '../../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { canAssembleDesktop, canBuyWorkshopSet, canInspectDesktopExit, completedParts, setComplete } from '../../systems/workshop';
import { nextWorkshopTarget, workshopRowStatus, WORKSHOP_MAINLINE } from '../../systems/workshopNavigation';
import { Estimate } from '../../components/Estimate';
import { PartInspector, type WorkshopDispatch } from './WorkshopCustomization';
import { World4Preparation } from './World4Preparation';
import { WorkshopHelp } from './WorkshopHelp';
import { WorkshopSchematic, WorkshopDestinationGlyph } from './WorkshopSchematic';
import { WorkshopExamples, workshopExampleHand } from './WorkshopExamples';
import { WorkshopGlyph } from './WorkshopGlyph';
import './fitting-panel.css';

export interface WorkshopNavigatorProps {
 runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;onAssembleApp?:(app:BuiltApp)=>void;
 finishHint?:(part:WorkshopPartId)=>string|null|undefined;onPickColor?:()=>void;onOpenPlugins?:()=>void;
}

/** The navigation hierarchy and the production panel have separate, small surfaces. */
export function WorkshopNavigator({runtime,snapshot,i18n,onAssembleApp,onPickColor,onOpenPlugins}:WorkshopNavigatorProps){
 const {state}=snapshot,w=state.run.workshop,t=i18n.t,stage=editorStage(state),examples=state.persistent.examplesEnabled;
 const dispatch:WorkshopDispatch=runtime.actWorkshop;
 const part=w.activePart&&w.activePart!=='common-scrollbar'?getWorkshopPart(w.activePart):null;
 const production=part?w.parts[part.id]:undefined;
 const [view,setView]=useState<'sets'|'parts'|'production'>(part?'production':'sets');
 const [set,setSet]=useState<UiSetId>(part?.set??'common');
 const [adjusting,setAdjusting]=useState(false),[optional,setOptional]=useState(false);
 const [portalHost,setPortalHost]=useState<HTMLElement|null>(null),panel=useRef<HTMLDivElement>(null),previousPart=useRef(w.activePart),openingSet=useRef(false);
 useEffect(()=>{setPortalHost(panel.current?.closest<HTMLElement>('.workshop-root')??null);},[]);
 useEffect(()=>{
  if(w.activePart!==previousPart.current){
   previousPart.current=w.activePart;
   if(openingSet.current){openingSet.current=false;return;}
   if(w.activePart&&w.activePart!=='common-scrollbar'){
    setSet(getWorkshopPart(w.activePart).set);setView('production');setAdjusting(false);
   }
  }
 },[w.activePart]);
 const next=nextWorkshopTarget(state),hand=workshopExampleHand(state),complete=completedParts(state);
 const setLabel=(id:UiSetId)=>t(`ws.set.${id}`);
 const selectPart=(id:WorkshopPartId)=>{dispatch({type:'selectPart',part:id});setSet(getWorkshopPart(id).set);setView('production');setAdjusting(false);};
 const openSet=(id:UiSetId)=>{
  if(!w.purchasedSets.includes(id)){openingSet.current=true;dispatch({type:'buySet',set:id});}
  setSet(id);setView('parts');setAdjusting(false);
 };
 const statusIcon=(done:boolean)=><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">{done?<path d="m2 7 3 3 7-7"/>:<rect x="2" y="2" width="10" height="10"/>}</svg>;
 const row=(id:UiSetId,partId?:WorkshopPartId)=>{
  const owned=w.purchasedSets.includes(id),definition=partId?getWorkshopPart(partId):null,status=workshopRowStatus(state,id,partId);
  const label=definition?t(definition.labelKey as MessageKey):setLabel(id),isNext=examples&&(partId?next?.kind==='part'&&next.part===partId:next?.kind==='set'&&next.set===id);
  const setParts=fittingPartsForSet(id);
  return <div className="ws-navigation-row" key={partId??id} data-navigation-set={id} data-navigation-part={partId}>
   <button type="button" className="ws-navigation-target" data-workshop-set={partId?undefined:id} data-workshop-part={partId} data-workshop-next={isNext?partId??id:undefined} disabled={!owned&&!canBuyWorkshopSet(state,id)} onClick={()=>partId?selectPart(partId):openSet(id)}>
    <span className="ws-navigation-preview"><WorkshopSchematic set={id} part={partId} i18n={i18n} thumbnail/></span>
    <span className="ws-navigation-copy">{isNext&&<span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span>}<span className="ws-navigation-name"><WorkshopDestinationGlyph set={id}/><span>{label}</span></span>
     <span className="ws-navigation-state" data-status={status}>{statusIcon(status==='complete')}<span>{t(`tp.workshop.status.${status}` as MessageKey)}</span>{!partId&&owned&&<span>{t('tp.workshop.partsCount' as MessageKey,{done:setParts.filter(d=>w.parts[d.id]?.step===4).length,total:setParts.length})}</span>}</span>
     {!owned&&<span className="ws-navigation-price">{t('ws.price',{count:i18n.price(BALANCE.workshop.setCosts[id])})}</span>}
     {!owned&&<Estimate cost={BALANCE.workshop.setCosts[id]} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} runtime={runtime} i18n={i18n}/>}
    </span>
   </button>
   <button type="button" className="ws-navigation-help" data-workshop-help-set={partId?undefined:id} data-workshop-help-part={partId} aria-label={t('tp.workshop.helpFor' as MessageKey,{name:label})} onClick={()=>dispatch({type:'help',target:{set:id,...(partId?{part:partId}:{})}})}>{t('tp.workshop.helpButton' as MessageKey)}</button>
  </div>;
 };
 const exit=state.run.world==='desktop'?<World4Preparation state={state} i18n={i18n} dispatch={dispatch}/>:<section className="ws-exit">
  <button type="button" data-workshop-action="exit" data-workshop-next={examples&&next?.kind==='exit'?'exit':undefined} disabled={!canInspectDesktopExit(state)} title={!canInspectDesktopExit(state)?t('ws.requireParts'):undefined} onClick={()=>dispatch({type:'exit'})}>{t('ws.assemble')}</button>
  <progress aria-label={t('ws.assemble')} max={WORKSHOP_MAINLINE.reduce((sum,id)=>sum+fittingPartsForSet(id).length,0)} value={complete.filter(id=>WORKSHOP_MAINLINE.includes(getWorkshopPart(id).set)).length}/>
  <small>{t('ws.price',{count:i18n.price(BALANCE.w2.desktopCost)})}</small>
  {w.exitInspected&&!canAssembleDesktop(state)&&<div className="ws-exit-requirements">{!setComplete(state,'files')||!setComplete(state,'mail')?<p>{t('ws.requireParts')}</p>:null}{state.persistent.specs.color<BALANCE.release.prototypeColorLevel&&<p>{t('ws.requireColor')}</p>}{canRelease(state)&&<button type="button" data-workshop-action="release" onClick={runtime.requestPrototypeRelease}>{t('ws.releaseReady')}</button>}</div>}
 </section>;
 const adjustments=part&&production&&adjusting?<section className="ws-fitting-adjustments" data-workshop-customization role="dialog" aria-label={t('fitting.adjustments' as MessageKey)}>
  <header><h2>{t('fitting.adjustments' as MessageKey)}</h2><button type="button" aria-label={t('fitting.closeAdjustments' as MessageKey)} onClick={()=>setAdjusting(false)}><WorkshopGlyph name="close"/></button></header>
  <div className="ws-fitting-adjustment-actions"><button type="button" data-workshop-action="useExample" onClick={()=>dispatch({type:'useExample',part:part.id})}>{t('fitting.auto' as MessageKey)}</button>{state.persistent.editorSkills.includes('eyedropper')&&onPickColor&&<button type="button" data-workshop-action="eyedropper" onClick={()=>{setAdjusting(false);onPickColor();}}><WorkshopGlyph name="eyedropper"/>{t('ws.eyedropper')}</button>}</div>
  <PartInspector part={part} production={production} stage={stage} colors={paletteFor(state.persistent.specs.color)} skills={state.persistent.editorSkills} customization={state.persistent.editorCustomization} dispatch={dispatch} i18n={i18n}/>
 </section>:null;
 return <div className="ws-panel ws-panel-parts ws-navigator ws-fitting-panel" ref={panel} data-workshop-panel-view={view}>
  <div className="ws-panel-grip">{t('ws.parts')}</div>
  {examples&&<WorkshopExamples state={state} i18n={i18n} dispatch={dispatch} onRelease={runtime.requestPrototypeRelease} onOpenPlugins={onOpenPlugins}/>}
  {view==='sets'?<>
   <h3 className="ws-navigation-heading">{t('ws.set')}</h3>
   <nav className="ws-navigation-rows" aria-label={t('ws.set')}>{UI_SETS.filter(definition=>w.purchasedSets.includes(definition.id)||next?.kind==='set'&&next.set===definition.id).map(definition=>row(definition.id))}</nav>
   <button type="button" className="ws-text-button" aria-expanded={optional} onClick={()=>setOptional(!optional)}>{t('ws.optional')}</button>
   {optional&&<nav className="ws-optional-sets" aria-label={t('ws.optional')}>{UI_SETS.filter(definition=>!definition.mainline&&definition.id!=='extras'&&definition.id!=='stream'&&!w.purchasedSets.includes(definition.id)).map(definition=>row(definition.id))}</nav>}
   {exit}
  </>:view==='parts'?<>
   <button type="button" className="ws-fitting-back" data-workshop-action="backToSets" onClick={()=>setView('sets')}>{t('fitting.backToSets' as MessageKey)}</button>
   <h2 className="ws-fitting-heading">{setLabel(set)}</h2>
   <nav className="ws-navigation-rows" aria-label={setLabel(set)}>{fittingPartsForSet(set).map(definition=>row(set,definition.id))}</nav>
   {state.run.world==='desktop'&&blueprintAppForSet(set)&&onAssembleApp&&<button type="button" className="ws-assemble-app" data-workshop-assemble-app={blueprintAppForSet(set)!} onClick={()=>onAssembleApp(blueprintAppForSet(set)!)}>{t('ws.assembleApp')}</button>}
  </>:part&&production?<>
   <button type="button" className="ws-fitting-back" data-workshop-action="backToParts" onClick={()=>{setSet(part.set);setView('parts');setAdjusting(false);}}>{t('fitting.backToParts' as MessageKey)}</button>
   <h2 className="ws-fitting-heading">{t(part.labelKey as MessageKey)}</h2>
   <div className="ws-fitting-piece-list" role="group" aria-label={t('fitting.pieces' as MessageKey)}>{fittingDefinition(part.id).pieces.map(piece=>{
    const fitted=fittedPieces(production,part.id).includes(piece),spawned=production.fitting?.spawned.includes(piece)??false,status=fitted?'fitted':spawned?'spawned':'notSpawned';
    const guided=examples&&(hand.kind==='spawnPiece'||hand.kind==='fitPiece')&&hand.part===part.id&&hand.piece===piece;
    return <button type="button" key={piece} data-workshop-piece={piece} data-piece-status={status} data-example-next={guided?piece:undefined} aria-pressed={fitted} disabled={fitted||spawned} onClick={()=>dispatch({type:'spawnPiece',part:part.id,piece})}><span className="ws-fitting-piece-status" aria-hidden="true">{statusIcon(fitted)}</span><span>{t(`ws.element.${piece}` as MessageKey)}</span><small>{t(`fitting.${status}` as MessageKey)}</small></button>;
   })}</div>
   <button type="button" className="ws-fitting-open-adjustments" data-workshop-action="openAdjustments" aria-expanded={adjusting} onClick={()=>setAdjusting(!adjusting)}>{t('fitting.openAdjustments' as MessageKey)}</button>
   <nav className="ws-fitting-part-chips" aria-label={setLabel(part.set)}>{fittingPartsForSet(part.set).map(definition=><button type="button" key={definition.id} data-workshop-part={definition.id} aria-pressed={part.id===definition.id} onClick={()=>selectPart(definition.id)}>{t(definition.labelKey as MessageKey)}</button>)}</nav>
  </>:null}
  {adjustments&&(portalHost?createPortal(adjustments,portalHost):adjustments)}
  {w.helpTarget&&portalHost&&createPortal(<WorkshopHelp target={w.helpTarget} i18n={i18n} stage={stage} onClose={()=>dispatch({type:'help',target:null})}/>,portalHost)}
 </div>;
}
