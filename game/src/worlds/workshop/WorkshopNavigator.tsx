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
import { WorkshopDestinationGlyph } from './WorkshopSchematic';
import { WorkshopExamples } from './WorkshopExamples';
import { WorkshopCombo } from './WorkshopCompletionFeedback';

export interface WorkshopNavigatorProps {runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;onAssembleApp?:(app:BuiltApp)=>void;finishHint?:(part:WorkshopPartId)=>string|null|undefined}
export function WorkshopNavigator({runtime,snapshot,i18n,onAssembleApp,finishHint}:WorkshopNavigatorProps){
 const {state}=snapshot,w=state.run.workshop,stage=editorStage(state),skills=state.persistent.editorSkills,c=state.persistent.editorCustomization,t=i18n.t;
 const dispatch:WorkshopDispatch=runtime.actWorkshop;
 const part=w.activePart?getWorkshopPart(w.activePart):null,production=part?w.parts[part.id]:undefined,assembleApp=part?blueprintAppForSet(part.set):null;
 const partLabel=part?t(part.labelKey as MessageKey):t('ws.untitled'),setLabel=(set:UiSetId)=>t(`ws.set.${set}`);
 const next=nextWorkshopTarget(state),complete=completedParts(state),colors=paletteFor(state.persistent.specs.color),examples=state.persistent.examplesEnabled;
 const [optional,setOptional]=useState(false),[portalHost,setPortalHost]=useState<HTMLElement|null>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{setPortalHost(panel.current?.closest<HTMLElement>('.workshop-root')??null);},[]);
 // Drill-down: the panel shows one level at a time — sets, then that set's parts, then the part's work area.
 const [level,setLevel]=useState<'sets'|'parts'|'work'>(w.activePart?'work':'sets'),[browseSet,setBrowseSet]=useState<UiSetId>(part?.set??'common');
 const lastActive=useRef(w.activePart);
 useEffect(()=>{if(w.activePart&&w.activePart!==lastActive.current){const p=getWorkshopPart(w.activePart);setBrowseSet(p.set);setLevel('work');}lastActive.current=w.activePart;},[w.activePart]);
 const effLevel=level==='parts'&&!w.purchasedSets.includes(browseSet)?'sets':level==='work'&&!part?'sets':level;
 const goParts=(set:UiSetId)=>{setBrowseSet(set);setLevel('parts');},goWork=(id:WorkshopPartId)=>{dispatch({type:'selectPart',part:id});setBrowseSet(getWorkshopPart(id).set);setLevel('work');};
 const statusIcon=(status:ReturnType<typeof workshopRowStatus>)=><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">{status==='complete'?<path d="m2 7 3 3 7-7"/>:status==='ready'?<path d="m4 2 7 5-7 5z"/>:<rect x="2" y="2" width="10" height="10"/>}</svg>;
 const row=(set:UiSetId,id?:WorkshopPartId,isNext=false,onActivate?:()=>void)=>{
  const owned=w.purchasedSets.includes(set),definition=id?getWorkshopPart(id):null,label=definition?t(definition.labelKey as MessageKey):setLabel(set),status=workshopRowStatus(state,set,id);
  const nextKey=id??set;
  const select=()=>{if(!owned){dispatch({type:'buySet',set});return;}const selected=id??partsForSet(set).find(candidate=>w.parts[candidate.id]?.step!==4)?.id??partsForSet(set)[0]!.id;dispatch({type:'selectPart',part:selected});if(selected===w.activePart)panel.current?.querySelector<HTMLElement>('[data-workshop-step]')?.scrollIntoView({block:'nearest'});};
  return <div className={`ws-navigation-row ${isNext?'is-next':''}`} data-navigation-set={set} data-navigation-part={id}>
   <button type="button" className={`ws-navigation-target ${!owned?'ws-set-purchase':''}`} data-workshop-set={!owned?set:undefined} data-workshop-part={id} data-workshop-next={isNext?nextKey:undefined} data-next-kind={isNext?id?'part':'set':undefined} disabled={!owned&&!canBuyWorkshopSet(state,set)} aria-pressed={owned?id?part?.id===id:part?.set===set:undefined} onClick={onActivate??select}>
    <span className="ws-navigation-copy">{isNext&&<span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span>}<span className="ws-navigation-name"><WorkshopDestinationGlyph set={set}/><span>{label}</span></span><span className="ws-navigation-state" data-status={status}>{statusIcon(status)}<span>{t(`tp.workshop.status.${status}` as MessageKey)}</span>{!id&&owned&&<span>{t('tp.workshop.partsCount' as MessageKey,{done:partsForSet(set).filter(candidate=>w.parts[candidate.id]?.step===4).length,total:partsForSet(set).length})}</span>}</span>{!owned&&<span className="ws-navigation-price">{t('ws.price',{count:i18n.price(BALANCE.workshop.setCosts[set])})}</span>}{!owned&&<Estimate cost={BALANCE.workshop.setCosts[set]} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} runtime={runtime} i18n={i18n}/>}</span>
   </button>
  </div>;
 };
 const exit=state.run.world==='desktop'?<World4Preparation state={state} i18n={i18n} dispatch={dispatch}/>:<section className="ws-exit"><button type="button" data-workshop-action="exit" data-workshop-next={next?.kind==='exit'?'exit':undefined} data-next-kind={next?.kind==='exit'?'exit':undefined} disabled={!canInspectDesktopExit(state)} title={!canInspectDesktopExit(state)?t('ws.requireParts'):undefined} onClick={()=>dispatch({type:'exit'})}>{next?.kind==='exit'&&<span className="ws-next-indicator">{t('tp.workshop.next' as MessageKey)}</span>}{t('ws.assemble')}</button><progress aria-label={t('ws.assemble')} max={UI_SETS.filter(set=>set.mainline).reduce((n,set)=>n+set.parts.length,0)} value={complete.filter(id=>WORKSHOP_MAINLINE.includes(getWorkshopPart(id).set)).length}/><small>{t('ws.price',{count:i18n.price(BALANCE.w2.desktopCost)})}</small>{w.exitInspected&&!canAssembleDesktop(state)&&<div className="ws-exit-requirements">{!setComplete(state,'files')||!setComplete(state,'mail')?<p>{t('ws.requireParts')}</p>:null}{state.persistent.specs.color<BALANCE.release.prototypeColorLevel&&<p>{t('ws.requireColor')}</p>}{canRelease(state)&&<button type="button" data-workshop-action="release" onClick={runtime.requestPrototypeRelease}>{t('ws.releaseReady')}</button>}</div>}</section>;
 return <div className="ws-panel ws-panel-parts ws-navigator" ref={panel} data-workshop-nav-level={effLevel}><div className="ws-panel-grip">{t('ws.parts')}</div>
  <h3 className="ws-navigation-heading">{t((examples?'examples.workshop.assembly':'tp.workshop.route') as MessageKey)}</h3>
  {(examples||next&&next.kind!=='exit')&&<div className="ws-next-row">{next&&next.kind!=='exit'&&row(next.set,next.kind==='part'?next.part:undefined,true,next.kind==='part'?()=>goWork(next.part):undefined)}{examples&&<WorkshopExamples state={state} i18n={i18n} dispatch={dispatch} onRelease={runtime.requestPrototypeRelease} finishHint={finishHint}/>}</div>}
  <WorkshopCombo state={state} i18n={i18n} platform={runtime.platform}/>
  {effLevel==='sets'&&<>
   <nav aria-label={t('tp.workshop.route' as MessageKey)} className="ws-navigation-rows">{UI_SETS.filter(set=>set.mainline||(w.purchasedSets.includes(set.id)&&set.id!=='stream')).map(set=><div key={set.id}>{row(set.id,undefined,false,w.purchasedSets.includes(set.id)?()=>goParts(set.id):undefined)}</div>)}</nav>
   <button type="button" className="ws-text-button" aria-expanded={optional} onClick={()=>setOptional(!optional)}>{t('ws.optional')}</button>
   {optional&&<div className="ws-optional-sets">{UI_SETS.filter(set=>!set.mainline&&set.id!=='extras'&&set.id!=='stream'&&!w.purchasedSets.includes(set.id)).map(set=><div key={set.id}>{row(set.id)}</div>)}</div>}
  </>}
  {effLevel==='parts'&&<>
   <div className="ws-level-head"><button type="button" className="ws-text-button" data-workshop-nav="sets" onClick={()=>setLevel('sets')}>{'← '}{t('tp.workshop.allSets' as MessageKey)}</button><h4>{setLabel(browseSet)}</h4><button type="button" className="ws-navigation-help" data-workshop-help-set={browseSet} aria-label={t('tp.workshop.helpFor' as MessageKey,{name:setLabel(browseSet)})} onClick={()=>dispatch({type:'help',target:{set:browseSet}})}>{t('tp.workshop.helpButton' as MessageKey)}</button></div>
   <ul className="ws-navigation-parts">{partsForSet(browseSet).map(definition=><li key={definition.id}>{row(definition.set,definition.id,false,()=>goWork(definition.id))}</li>)}</ul>
  </>}
  {effLevel==='work'&&part&&<>
   <div className="ws-level-head"><button type="button" className="ws-text-button" data-workshop-nav="parts" onClick={()=>goParts(part.set)}>{'← '}{t('tp.workshop.allParts' as MessageKey)}</button><span className="ws-level-set">{setLabel(part.set)}</span><button type="button" className="ws-navigation-help" data-workshop-help-part={part.id} aria-label={t('tp.workshop.helpFor' as MessageKey,{name:partLabel})} onClick={()=>dispatch({type:'help',target:{set:part.set,part:part.id}})}>{t('tp.workshop.helpButton' as MessageKey)}</button></div>
   <div className="ws-production-heading"><h2>{partLabel}</h2><span>{t(part.set==='stream'?'world4.partBaseRate':'ws.baseRate',{count:i18n.rate(BALANCE.workshop.partRates[part.id])})}</span></div>
   <ol className="ws-steps" data-workshop-step={production?.step??0}>{[0,1,2,3].map(n=><li key={n} aria-current={production?.step===n?'step':undefined} className={(production?.step??0)>n?'is-done':''}>{t(`ws.step.${n}` as MessageKey)}</li>)}</ol>
   {!examples&&production?.step===0&&<div className="ws-stage-controls"><p>{t('ws.placementHint')}</p><button type="button" data-workshop-action="place" disabled={!partRectValid(state,part.id,part.defaultRect)} onClick={()=>dispatch({type:'place',part:part.id,rect:part.defaultRect})}>{t('ws.place')}</button>{!partRectValid(state,part.id,part.defaultRect)&&<small>{t('ws.placementBlocked')}</small>}</div>}
   {!examples&&production?.step===1&&<div className="ws-element-list">{part.elements.map(element=><button type="button" data-workshop-element={element} data-workshop-action="element" key={element} disabled={production.elements.includes(element)} onClick={()=>dispatch({type:'addElement',part:part.id,element})}>{production.elements.includes(element)?'✓ ':''}{t(`ws.element.${element}` as MessageKey)}</button>)}{skills.includes('batch')&&<button type="button" data-workshop-action="batch" onClick={()=>part.elements.filter(e=>!production.elements.includes(e)).forEach(element=>dispatch({type:'addElement',part:part.id,element}))}>{t('ws.batch')}</button>}</div>}
   {examples&&production&&<details className="ws-custom-work" data-workshop-customization><summary>{t('examples.workshop.custom' as MessageKey)}</summary>{production.step<2?<p>{t('examples.workshop.customBeforeAdjustment' as MessageKey)}</p>:<><PartInspector part={part} production={production} stage={stage} colors={colors} skills={skills} customization={c} dispatch={dispatch} i18n={i18n}/>{production.step===2&&<button type="button" data-workshop-action="confirmAdjustment" onClick={()=>dispatch({type:'confirmAdjustment',part:part.id})}>{t('examples.workshop.useCurrent' as MessageKey)}</button>}</>}{production.step>0&&skills.includes('dimensions')&&<fieldset className="ws-numeric-dimensions"><legend>{t('ws.canvas')}</legend>{(['x','y','width','height'] as const).map(key=><label key={key}>{t(`ws.${key}`)}<DimensionInput field={key} value={production.rect[key]} min={key==='width'?partMinimumSize(state,part.id).width:key==='height'?partMinimumSize(state,part.id).height:BALANCE.workshop.canvas.inset} step={BALANCE.workshop.canvas.resolutionGrid[state.persistent.specs.resolution]??BALANCE.workshop.canvas.grid} onCommit={value=>dispatch({type:'place',part:part.id,rect:{...production.rect,[key]:value}})}/></label>)}</fieldset>}</details>}
   {!examples&&production&&production.step>=2&&<PartInspector part={part} production={production} stage={stage} colors={colors} skills={skills} customization={c} dispatch={dispatch} i18n={i18n}/>}
   {!examples&&production?.step===2&&<button type="button" className="ws-primary" data-workshop-action="confirmAdjustment" onClick={()=>dispatch({type:'confirmAdjustment',part:part.id})}>{t('ws.confirmAdjustment')}</button>}
   {!examples&&production?.step===3&&<p className="ws-test-hint" role="status">{t((finishHint?.(part.id)??`ws.test.${part.testInteraction}`) as MessageKey)}</p>}
   {production?.step===4&&<div className="ws-completed" role="status"><strong>{t('ws.completed')}</strong><span>{t(production.exportedAt!==null?'ws.exported':'ws.notExported')}</span>{!examples&&production.exportedAt===null&&<button type="button" data-workshop-action="exportPart" onClick={()=>dispatch({type:'export',part:part.id})}>{t('ws.export')}</button>}</div>}
   {!examples&&production&&production.step>0&&skills.includes('dimensions')&&<fieldset className="ws-numeric-dimensions"><legend>{t('ws.canvas')}</legend>{(['x','y','width','height'] as const).map(key=><label key={key}>{t(`ws.${key}`)}<DimensionInput field={key} value={production.rect[key]} min={key==='width'?partMinimumSize(state,part.id).width:key==='height'?partMinimumSize(state,part.id).height:BALANCE.workshop.canvas.inset} step={BALANCE.workshop.canvas.resolutionGrid[state.persistent.specs.resolution]??BALANCE.workshop.canvas.grid} onCommit={value=>dispatch({type:'place',part:part.id,rect:{...production.rect,[key]:value}})}/></label>)}</fieldset>}
   <div className="ws-sibling-parts">{partsForSet(part.set).map(definition=>{const st=workshopRowStatus(state,definition.set,definition.id);return <span key={definition.id} className="ws-sibling-chip-wrap"><button type="button" className="ws-sibling-chip" data-workshop-chip={definition.id} aria-pressed={definition.id===part.id} onClick={()=>goWork(definition.id)}>{statusIcon(st)}<span>{t(definition.labelKey as MessageKey)}</span></button></span>;})}</div>
  </>}
  {state.run.world==='desktop'&&assembleApp&&onAssembleApp&&<button type="button" className="ws-assemble-app" data-workshop-assemble-app={assembleApp} onClick={()=>onAssembleApp(assembleApp)}>{t('ws.assembleApp')}</button>}

  {exit}
  {w.helpTarget&&portalHost&&createPortal(<WorkshopHelp target={w.helpTarget} i18n={i18n} stage={stage} onClose={()=>dispatch({type:'help',target:null})}/>,portalHost)}
 </div>;
}
