import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../config/balance';
import type { I18n,MessageKey } from '../../content/i18n';
import { UI_SETS,getWorkshopPart,partsForSet,type UiSetId,type WorkshopPartId } from '../../content/workshopCatalog';
import { paletteFor } from '../../content/palette';
import { editorStage } from '../../systems/appearance';
import { blueprintAppForSet } from '../../systems/appAssembly';
import type { BuiltApp } from '../../systems/desktopState';
import { passivePixelsPerSecond } from '../../systems/economy';
import { canRelease } from '../../systems/release';
import type { GameRuntime,RuntimeSnapshot } from '../../systems/runtime';
import { canAssembleDesktop,canBuyWorkshopSet,canInspectDesktopExit,completedParts,partMinimumSize,partRectValid,setComplete } from '../../systems/workshop';
import { nextWorkshopTarget,workshopRowStatus,WORKSHOP_MAINLINE } from '../../systems/workshopNavigation';
import { Estimate } from '../../components/Estimate';
import { DimensionInput,PartInspector,type WorkshopDispatch } from './WorkshopCustomization';
import { World4Preparation } from './World4Preparation';
import { WorkshopHelp } from './WorkshopHelp';
import { WorkshopSchematic,WorkshopDestinationGlyph } from './WorkshopSchematic';

export interface WorkshopNavigatorProps {runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;onAssembleApp?:(app:BuiltApp)=>void;finishHint?:(part:WorkshopPartId)=>string|null|undefined}
export function WorkshopNavigator({runtime,snapshot,i18n,onAssembleApp,finishHint}:WorkshopNavigatorProps){
 const {state}=snapshot,w=state.run.workshop,stage=editorStage(state),skills=state.persistent.editorSkills,c=state.persistent.editorCustomization,t=i18n.t;
 const dispatch:WorkshopDispatch=runtime.actWorkshop;
 const part=w.activePart?getWorkshopPart(w.activePart):null,production=part?w.parts[part.id]:undefined,assembleApp=part?blueprintAppForSet(part.set):null;
 const partLabel=part?t(part.labelKey as MessageKey):t('ws.untitled'),setLabel=(set:UiSetId)=>t(`ws.set.${set}`);
 const next=nextWorkshopTarget(state),complete=completedParts(state),colors=paletteFor(state.persistent.specs.color);
 const [optional,setOptional]=useState(false),[portalHost,setPortalHost]=useState<HTMLElement|null>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{setPortalHost(panel.current?.closest<HTMLElement>('.workshop-root')??null);},[]);
 const statusIcon=(status:ReturnType<typeof workshopRowStatus>)=><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">{status==='complete'?<path d="m2 7 3 3 7-7"/>:status==='ready'?<path d="m4 2 7 5-7 5z"/>:<rect x="2" y="2" width="10" height="10"/>}</svg>;
 const row=(set:UiSetId,id?:WorkshopPartId,isNext=false)=>{
  const owned=w.purchasedSets.includes(set),definition=id?getWorkshopPart(id):null,label=definition?t(definition.labelKey as MessageKey):setLabel(set),status=workshopRowStatus(state,set,id);
  const nextKey=id??set;
  const select=()=>{if(!owned){dispatch({type:'buySet',set});return;}const selected=id??partsForSet(set).find(candidate=>w.parts[candidate.id]?.step!==4)?.id??partsForSet(set)[0]!.id;dispatch({type:'selectPart',part:selected});if(selected===w.activePart)panel.current?.querySelector<HTMLElement>('[data-workshop-step]')?.scrollIntoView({block:'nearest'});};
  return <div className={`ws-navigation-row ${isNext?'is-next':''}`} data-navigation-set={set} data-navigation-part={id}>
   <button type="button" className={`ws-navigation-target ${!owned?'ws-set-purchase':''}`} data-workshop-set={!owned?set:undefined} data-workshop-part={id} data-workshop-next={isNext?nextKey:undefined} data-next-kind={isNext?id?'part':'set':undefined} disabled={!owned&&!canBuyWorkshopSet(state,set)} aria-pressed={owned?id?part?.id===id:part?.set===set:undefined} onClick={select}>
    <span className="ws-navigation-preview"><WorkshopSchematic set={set} part={id} i18n={i18n} thumbnail/></span>
    <span className="ws-navigation-copy">{isNext&&<span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span>}<span className="ws-navigation-name"><WorkshopDestinationGlyph set={set}/><span>{label}</span></span><span className="ws-navigation-state" data-status={status}>{statusIcon(status)}<span>{t(`tp.workshop.status.${status}` as MessageKey)}</span>{!id&&owned&&<span>{t('tp.workshop.partsCount' as MessageKey,{done:partsForSet(set).filter(candidate=>w.parts[candidate.id]?.step===4).length,total:partsForSet(set).length})}</span>}</span>{!owned&&<span className="ws-navigation-price">{t('ws.price',{count:i18n.price(BALANCE.workshop.setCosts[set])})}</span>}{!owned&&<Estimate cost={BALANCE.workshop.setCosts[set]} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} runtime={runtime} i18n={i18n}/>}</span>
   </button>
   <button type="button" className="ws-navigation-help" data-workshop-help-set={id?undefined:set} data-workshop-help-part={id} aria-label={t('tp.workshop.helpFor' as MessageKey,{name:label})} onClick={()=>dispatch({type:'help',target:{set,...(id?{part:id}:{})}})}>{t('tp.workshop.helpButton' as MessageKey)}</button>
  </div>;
 };
 const exit=state.run.world==='desktop'?<World4Preparation state={state} i18n={i18n} dispatch={dispatch}/>:<section className="ws-exit"><button type="button" data-workshop-action="exit" data-workshop-next={next?.kind==='exit'?'exit':undefined} data-next-kind={next?.kind==='exit'?'exit':undefined} disabled={!canInspectDesktopExit(state)} title={!canInspectDesktopExit(state)?t('ws.requireParts'):undefined} onClick={()=>dispatch({type:'exit'})}>{next?.kind==='exit'&&<span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span>}{t('ws.assemble')}</button><progress aria-label={t('ws.assemble')} max={UI_SETS.filter(set=>set.mainline).reduce((n,set)=>n+set.parts.length,0)} value={complete.filter(id=>WORKSHOP_MAINLINE.includes(getWorkshopPart(id).set)).length}/><small>{t('ws.price',{count:i18n.price(BALANCE.w2.desktopCost)})}</small>{w.exitInspected&&!canAssembleDesktop(state)&&<div className="ws-exit-requirements">{!setComplete(state,'files')||!setComplete(state,'mail')?<p>{t('ws.requireParts')}</p>:null}{state.persistent.specs.color<BALANCE.release.prototypeColorLevel&&<p>{t('ws.requireColor')}</p>}{canRelease(state)&&<button type="button" data-workshop-action="release" onClick={runtime.requestPrototypeRelease}>{t('ws.releaseReady')}</button>}</div>}</section>;
 return <div className="ws-panel ws-panel-parts ws-navigator" ref={panel}><div className="ws-panel-grip">{t('ws.parts')}</div>
  <h3 className="ws-navigation-heading">{t('tp.workshop.route' as MessageKey)}</h3>
  {next&&next.kind!=='exit'&&<div className="ws-next-row">{row(next.set,next.kind==='part'?next.part:undefined,true)}</div>}
  <nav aria-label={t('tp.workshop.route' as MessageKey)} className="ws-navigation-rows">{w.purchasedSets.filter(set=>WORKSHOP_MAINLINE.includes(set)||set===part?.set).map(set=><div key={set}>{row(set)}</div>)}</nav>

  {w.purchasedSets.length>0&&<label className="ws-set-selector">{t('ws.set')}<select data-workshop-set-selection value={part?.set??w.purchasedSets[0]} onChange={e=>{const set=e.target.value as UiSetId;const target=partsForSet(set).find(d=>w.parts[d.id]?.step!==4)??partsForSet(set)[0]!;dispatch({type:'selectPart',part:target.id});}}>{w.purchasedSets.map(set=><option key={set} value={set}>{setLabel(set)}</option>)}</select></label>}
  {part&&<>
   <div className="ws-production-heading"><h2>{partLabel}</h2><span>{t(part.set==='stream'?'world4.partBaseRate':'ws.baseRate',{count:i18n.rate(BALANCE.workshop.partRates[part.id])})}</span></div>
   <ol className="ws-steps" data-workshop-step={production?.step??0}>{[0,1,2,3].map(n=><li key={n} aria-current={production?.step===n?'step':undefined} className={(production?.step??0)>n?'is-done':''}>{t(`ws.step.${n}` as MessageKey)}</li>)}</ol>
   {production?.step===0&&<div className="ws-stage-controls"><p>{t('ws.placementHint')}</p><button type="button" data-workshop-action="place" disabled={!partRectValid(state,part.id,part.defaultRect)} onClick={()=>dispatch({type:'place',part:part.id,rect:part.defaultRect})}>{t('ws.place')}</button>{!partRectValid(state,part.id,part.defaultRect)&&<small>{t('ws.placementBlocked')}</small>}</div>}
   {production?.step===1&&<div className="ws-element-list">{part.elements.map(element=><button type="button" data-workshop-element={element} data-workshop-action="element" key={element} disabled={production.elements.includes(element)} onClick={()=>dispatch({type:'addElement',part:part.id,element})}>{production.elements.includes(element)?'✓ ':''}{t(`ws.element.${element}` as MessageKey)}</button>)}{skills.includes('batch')&&<button type="button" data-workshop-action="batch" onClick={()=>part.elements.filter(e=>!production.elements.includes(e)).forEach(element=>dispatch({type:'addElement',part:part.id,element}))}>{t('ws.batch')}</button>}</div>}
   {production&&production.step>=2&&<PartInspector part={part} production={production} stage={stage} colors={colors} skills={skills} customization={c} dispatch={dispatch} i18n={i18n}/>}
   {production?.step===2&&<button type="button" className="ws-primary" data-workshop-action="confirmAdjustment" onClick={()=>dispatch({type:'confirmAdjustment',part:part.id})}>{t('ws.confirmAdjustment')}</button>}
   {production?.step===3&&<p className="ws-test-hint" role="status">{t((finishHint?.(part.id)??`ws.test.${part.testInteraction}`) as MessageKey)}</p>}
   {production?.step===4&&<div className="ws-completed" role="status"><strong>{t('ws.completed')}</strong><span>{t(production.exportedAt!==null?'ws.exported':'ws.notExported')}</span>{production.exportedAt===null&&<button type="button" data-workshop-action="exportPart" onClick={()=>dispatch({type:'export',part:part.id})}>{t('ws.export')}</button>}</div>}
   {production&&production.step>0&&skills.includes('dimensions')&&<fieldset className="ws-numeric-dimensions"><legend>{t('ws.canvas')}</legend>{(['x','y','width','height'] as const).map(key=><label key={key}>{t(`ws.${key}`)}<DimensionInput field={key} value={production.rect[key]} min={key==='width'?partMinimumSize(state,part.id).width:key==='height'?partMinimumSize(state,part.id).height:BALANCE.workshop.canvas.inset} step={BALANCE.workshop.canvas.resolutionGrid[state.persistent.specs.resolution]??BALANCE.workshop.canvas.grid} onCommit={value=>dispatch({type:'place',part:part.id,rect:{...production.rect,[key]:value}})}/></label>)}</fieldset>}
   <ul className="ws-navigation-parts">{partsForSet(part.set).filter(definition=>next?.kind!=='part'||definition.id!==next.part).map(definition=><li key={definition.id}>{row(definition.set,definition.id)}</li>)}</ul>
  </>}
  {state.run.world==='desktop'&&assembleApp&&onAssembleApp&&<button type="button" className="ws-assemble-app" data-workshop-assemble-app={assembleApp} onClick={()=>onAssembleApp(assembleApp)}>{t('ws.assembleApp')}</button>}

  <button type="button" className="ws-text-button" aria-expanded={optional} onClick={()=>setOptional(!optional)}>{t('ws.optional')}</button>
  {optional&&<div className="ws-optional-sets">{UI_SETS.filter(set=>!set.mainline&&set.id!=='extras'&&set.id!=='stream'&&!w.purchasedSets.includes(set.id)).map(set=><div key={set.id}>{row(set.id)}</div>)}</div>}
  {exit}
  {w.helpTarget&&portalHost&&createPortal(<WorkshopHelp target={w.helpTarget} i18n={i18n} stage={stage} onClose={()=>dispatch({type:'help',target:null})}/>,portalHost)}
 </div>;
}
