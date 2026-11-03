import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart, type UiSetId, type WorkshopPartId } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import { paletteFor } from '../../content/palette';
import { fittedPieces } from '../../systems/workshopFitting';
import { editorStage } from '../../systems/appearance';
import { blueprintAppForSet } from '../../systems/appAssembly';
import type { BuiltApp } from '../../systems/desktopState';
import { canRelease } from '../../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { canAssembleDesktop, canBuyWorkshopSet, canInspectDesktopExit, completedParts, setComplete } from '../../systems/workshop';
import { workshopRowStatus, WORKSHOP_MAINLINE } from '../../systems/workshopNavigation';
import { PartInspector, type WorkshopDispatch } from './WorkshopCustomization';
import { World4Preparation } from './World4Preparation';
import { WorkshopHelp } from './WorkshopHelp';
import { WorkshopDestinationGlyph } from './WorkshopSchematic';
import { WorkshopExamples, workshopExampleHand } from './WorkshopExamples';
import { WorkshopGlyph } from './WorkshopGlyph';
import { initialWorkshopPanelSet, workshopCategoryForSet, WORKSHOP_CATEGORIES, WORKSHOP_CATEGORY_SETS, type WorkshopCategory } from './workshopPanel';
import './fitting-panel.css';

export interface WorkshopNavigatorProps {
 runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;onAssembleApp?:(app:BuiltApp)=>void;
 selectedPiece?:string|null;onSelectPiece?:(piece:string)=>void;finishHint?:(part:WorkshopPartId)=>string|null|undefined;onPickColor?:()=>void;onOpenPlugins?:()=>void;
}

/** Every navigation level has a stable place in one scrolling column. */
export function WorkshopNavigator({runtime,snapshot,i18n,onAssembleApp,onPickColor,onOpenPlugins,selectedPiece,onSelectPiece}:WorkshopNavigatorProps){
 const {state}=snapshot,w=state.run.workshop,t=i18n.t,stage=editorStage(state),examples=state.persistent.examplesEnabled;
 const dispatch:WorkshopDispatch=runtime.actWorkshop;
 const initialSet=initialWorkshopPanelSet(state),initialCategory=workshopCategoryForSet(initialSet);
 const [category,setCategory]=useState<WorkshopCategory>(initialCategory);
 const [selection,setSelection]=useState<Record<WorkshopCategory,UiSetId>>({shared:'common',required:initialCategory==='required'?initialSet:'foundation',optional:initialCategory==='optional'?initialSet:'photo'});
 const selectedSet=selection[category],owned=w.purchasedSets.includes(selectedSet);
 const active=w.activePart&&w.activePart!=='common-scrollbar'?getWorkshopPart(w.activePart):null;
 const part=active?.set===selectedSet?active:null,production=part?w.parts[part.id]:undefined;
 const [adjusting,setAdjusting]=useState(false),[optionalExpanded,setOptionalExpanded]=useState(true);
 const [portalHost,setPortalHost]=useState<HTMLElement|null>(null),panel=useRef<HTMLDivElement>(null),goal=useRef<HTMLDivElement>(null),tabs=useRef<HTMLDivElement>(null),previousPart=useRef(w.activePart);
 const [stickySizes,setStickySizes]=useState({goal:0,tabs:0});
 useEffect(()=>{setPortalHost(panel.current?.closest<HTMLElement>('.workshop-root')??null);},[]);
 useEffect(()=>{
  const measure=()=>setStickySizes({goal:goal.current?.offsetHeight??0,tabs:tabs.current?.offsetHeight??0});
  measure();const observer=new ResizeObserver(measure);if(goal.current)observer.observe(goal.current);if(tabs.current)observer.observe(tabs.current);return()=>observer.disconnect();
 },[examples,stage]);
 useEffect(()=>{
  if(w.activePart===previousPart.current)return;previousPart.current=w.activePart;
  if(w.activePart&&w.activePart!=='common-scrollbar'){
   const id=getWorkshopPart(w.activePart).set,target=workshopCategoryForSet(id);
   setCategory(target);setSelection(previous=>({...previous,[target]:id}));setAdjusting(false);
  }
 },[w.activePart]);
 const hand=workshopExampleHand(state),complete=completedParts(state),setLabel=(id:UiSetId)=>t(`ws.set.${id}`);
 const cue=hand.kind==='buySet'?hand.set:'part' in hand?hand.kind==='spawnPiece'||hand.kind==='fitPiece'?hand.piece:hand.part:hand.kind;
 const selectSet=(id:UiSetId)=>{
  const target=workshopCategoryForSet(id);setSelection(previous=>({...previous,[target]:id}));setCategory(target);setAdjusting(false);
  if(w.purchasedSets.includes(id)&&active?.set!==id){const candidate=fittingPartsForSet(id).find(definition=>w.parts[definition.id]?.step!==4)??fittingPartsForSet(id)[0];if(candidate)dispatch({type:'selectPart',part:candidate.id});}
 };
 const selectPart=(id:WorkshopPartId)=>{dispatch({type:'selectPart',part:id});setAdjusting(false);};
 const statusIcon=(done:boolean)=><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">{done?<path d="m2 7 3 3 7-7"/>:<rect x="2" y="2" width="10" height="10"/>}</svg>;
 const helpButton=(id:UiSetId,partId?:WorkshopPartId)=><button type="button" className="ws-navigation-help" data-workshop-help-set={partId?undefined:id} data-workshop-help-part={partId} aria-label={t('tp.workshop.helpFor' as MessageKey,{name:partId?t(getWorkshopPart(partId).labelKey as MessageKey):setLabel(id)})} onClick={()=>dispatch({type:'help',target:{set:id,...(partId?{part:partId}:{})}})}>{t('tp.workshop.helpButton' as MessageKey)}</button>;
 const setRow=(id:UiSetId)=>{
  const purchased=w.purchasedSets.includes(id),definitions=fittingPartsForSet(id),status=workshopRowStatus(state,id),done=definitions.filter(definition=>w.parts[definition.id]?.step===4).length;
  return <div className="ws-panel-set-row" key={id} data-navigation-set={id} data-selected={selectedSet===id} data-status={status} role="group" aria-label={setLabel(id)}>
   <button type="button" className="ws-panel-set-select" data-workshop-select-set={id} aria-pressed={selectedSet===id} onClick={()=>selectSet(id)}><span className="ws-panel-state-bar" aria-hidden="true"/><WorkshopDestinationGlyph set={id}/><span className="ws-panel-row-copy"><strong>{setLabel(id)}</strong><small>{purchased?t('tp.workshop.partsCount' as MessageKey,{done,total:definitions.length}):t('tp.workshop.status.unowned' as MessageKey)}</small></span></button>
   <button type="button" className="ws-panel-set-buy" data-workshop-set={id} disabled={purchased||!canBuyWorkshopSet(state,id)} aria-label={t(purchased?'ws.owned':'ws.buySet')} onClick={()=>{selectSet(id);dispatch({type:'buySet',set:id});}}>{purchased?statusIcon(status==='complete'):t('ws.price',{count:i18n.price(BALANCE.workshop.setCosts[id])})}</button>
   {helpButton(id)}
  </div>;
 };
 const exit=state.run.world==='desktop'?<World4Preparation state={state} i18n={i18n} dispatch={dispatch}/>:<section className="ws-exit">
  <button type="button" data-workshop-action="exit" disabled={!canInspectDesktopExit(state)} title={!canInspectDesktopExit(state)?t('ws.requireParts'):undefined} onClick={()=>dispatch({type:'exit'})}>{t('ws.assemble')}</button>
  <progress aria-label={t('ws.assemble')} max={WORKSHOP_MAINLINE.reduce((sum,id)=>sum+fittingPartsForSet(id).length,0)} value={complete.filter(id=>WORKSHOP_MAINLINE.includes(getWorkshopPart(id).set)).length}/>
  <small>{t('ws.price',{count:i18n.price(BALANCE.w2.desktopCost)})}</small>
  {w.exitInspected&&!canAssembleDesktop(state)&&<div className="ws-exit-requirements">{!setComplete(state,'files')||!setComplete(state,'mail')?<p>{t('ws.requireParts')}</p>:null}{state.persistent.specs.color<BALANCE.release.prototypeColorLevel&&<p>{t('ws.requireColor')}</p>}{canRelease(state)&&<button type="button" data-workshop-action="release" onClick={runtime.requestPrototypeRelease}>{t('ws.releaseReady')}</button>}</div>}
 </section>;
 const adjustments=part&&production&&adjusting?<section className="ws-fitting-adjustments" data-workshop-customization role="dialog" aria-label={t('fitting.adjustments' as MessageKey)}>
  <header><h2>{t('fitting.adjustments' as MessageKey)}</h2><button type="button" aria-label={t('fitting.closeAdjustments' as MessageKey)} onClick={()=>setAdjusting(false)}><WorkshopGlyph name="close"/></button></header>
  <div className="ws-fitting-adjustment-actions"><button type="button" data-workshop-action="useExample" onClick={()=>dispatch({type:'useExample',part:part.id})}>{t('fitting.auto' as MessageKey)}</button>{state.persistent.editorSkills.includes('eyedropper')&&onPickColor&&<button type="button" data-workshop-action="eyedropper" onClick={()=>{setAdjusting(false);onPickColor();}}><WorkshopGlyph name="eyedropper"/>{t('ws.eyedropper')}</button>}</div>
  <PartInspector part={part} production={production} stage={stage} colors={paletteFor(state.persistent.specs.color)} skills={state.persistent.editorSkills} customization={state.persistent.editorCustomization} dispatch={dispatch} i18n={i18n}/>
 </section>:null;
 return <div className="ws-panel ws-panel-parts ws-navigator ws-fitting-panel" ref={panel} data-workshop-panel-scroll data-workshop-panel-view="zones" style={{'--ws-panel-goal-height':`${stickySizes.goal}px`,'--ws-panel-tabs-height':`${stickySizes.tabs}px`} as CSSProperties}>
  {examples&&<div className="ws-panel-goal" ref={goal} data-workshop-next={cue}><span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span><WorkshopExamples state={state} i18n={i18n} dispatch={dispatch} onRelease={runtime.requestPrototypeRelease} onOpenPlugins={onOpenPlugins}/></div>}
  <div className="ws-panel-category-tabs" ref={tabs} role="tablist" aria-label={t('ws.parts')}>{WORKSHOP_CATEGORIES.map(id=><button type="button" key={id} role="tab" data-workshop-category={id} aria-selected={category===id} onClick={()=>{setCategory(id);setAdjusting(false);}}>{t(`fitting.category.${id}` as MessageKey)}</button>)}</div>
  <section className="ws-panel-zone" data-workshop-zone="sets"><h3 data-workshop-zone-heading="sets">{t('fitting.zone.sets' as MessageKey)}</h3>{category==='optional'&&<button type="button" className="ws-panel-optional-toggle" data-workshop-optional-toggle aria-expanded={optionalExpanded} onClick={()=>setOptionalExpanded(!optionalExpanded)}>{t((optionalExpanded?'fitting.optionalHide':'fitting.optionalShow') as MessageKey)}</button>}<div className="ws-panel-set-rows">{(category!=='optional'||optionalExpanded)&&WORKSHOP_CATEGORY_SETS[category].map(setRow)}</div></section>
  <section className="ws-panel-zone" data-workshop-zone="parts"><h3 data-workshop-zone-heading="parts"><span>{t('fitting.zone.parts' as MessageKey)}</span><small>{setLabel(selectedSet)}</small></h3>{!owned&&<p className="ws-panel-unowned-note">{t('fitting.lockedParts' as MessageKey)}</p>}<div className="ws-panel-part-rows" data-has-selection={!!part}>{fittingPartsForSet(selectedSet).map(definition=>{
   const p=w.parts[definition.id],status=workshopRowStatus(state,selectedSet,definition.id);
   return <div className="ws-panel-part-row" key={definition.id} data-navigation-part={definition.id} data-selected={part?.id===definition.id} data-status={status}><button type="button" className="ws-panel-part-select" data-workshop-part={definition.id} aria-pressed={part?.id===definition.id} disabled={!owned} onClick={()=>selectPart(definition.id)}><span className="ws-panel-state-bar" aria-hidden="true"/>{statusIcon(p?.step===4)}<span>{t(definition.labelKey as MessageKey)}</span></button>{helpButton(selectedSet,definition.id)}</div>;
  })}</div></section>
  <section className="ws-panel-zone" data-workshop-zone="pieces"><h3 data-workshop-zone-heading="pieces"><span>{t('fitting.zone.pieces' as MessageKey)}</span>{part&&<small>{t(part.labelKey as MessageKey)}</small>}</h3>{part&&production?<><div className="ws-fitting-piece-list" data-has-selection={!!selectedPiece} role="group" aria-label={t('fitting.pieces' as MessageKey)}>{fittingDefinition(part.id).pieces.map(piece=>{
   const fitted=fittedPieces(production,part.id).includes(piece),spawned=production.fitting?.spawned.includes(piece)??false,status=fitted?'fitted':spawned?'spawned':'notSpawned';
   return <button type="button" key={piece} data-workshop-piece={piece} data-piece-status={status} aria-pressed={selectedPiece===piece} disabled={fitted||spawned} onClick={()=>{onSelectPiece?.(piece);dispatch({type:'spawnPiece',part:part.id,piece});}}><span className="ws-panel-state-bar" aria-hidden="true"/><span className="ws-fitting-piece-status" aria-hidden="true">{statusIcon(fitted)}</span><span>{t(`ws.element.${piece}` as MessageKey)}</span><small>{t(`fitting.${status}` as MessageKey)}</small></button>;
  })}</div><button type="button" className="ws-fitting-open-adjustments" data-workshop-action="openAdjustments" aria-expanded={adjusting} onClick={()=>setAdjusting(!adjusting)}>{t('fitting.openAdjustments' as MessageKey)}</button></>:<p className="ws-panel-unowned-note">{t('fitting.selectPart' as MessageKey)}</p>}</section>
  {state.run.world==='desktop'&&owned&&blueprintAppForSet(selectedSet)&&onAssembleApp&&<button type="button" className="ws-assemble-app" data-workshop-assemble-app={blueprintAppForSet(selectedSet)!} onClick={()=>onAssembleApp(blueprintAppForSet(selectedSet)!)}>{t('ws.assembleApp')}</button>}
  {exit}
  {adjustments&&(portalHost?createPortal(adjustments,portalHost):adjustments)}
  {w.helpTarget&&portalHost&&createPortal(<WorkshopHelp target={w.helpTarget} i18n={i18n} stage={stage} onClose={()=>dispatch({type:'help',target:null})}/>,portalHost)}
 </div>;
}
