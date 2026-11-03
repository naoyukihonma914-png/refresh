import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart, type UiSetId, type WorkshopPartId } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import { canBuyWorkshopSet, canInspectDesktopExit, partRectValid } from '../../systems/workshop';
import { canRelease } from '../../systems/release';
import { nextWorkshopTarget } from '../../systems/workshopNavigation';
import type { WorkshopDispatch } from './WorkshopCustomization';

export type WorkshopExampleHand =
 | {kind:'buySet';set:UiSetId}
 | {kind:'place'|'useExample'|'finish'|'export'|'selectPart';part:WorkshopPartId}
 | {kind:'addElement';part:WorkshopPartId;element:string}
 | {kind:'addAll';part:WorkshopPartId;elements:readonly string[]}
 | {kind:'exit'|'release'|'customize'};

/** A concrete next operation on the selected work; it never changes the player's work. */
export function workshopExampleHand(state:GameState):WorkshopExampleHand {
 const w=state.run.workshop,part=w.activePart?getWorkshopPart(w.activePart):null,p=part?w.parts[part.id]:undefined;
 if(part&&p){
  if(p.step===0)return {kind:'place',part:part.id};
  if(p.step===1){const elements=part.elements.filter(element=>!p.elements.includes(element));if(elements.length>1&&state.persistent.editorSkills.includes('batch'))return {kind:'addAll',part:part.id,elements};if(elements[0])return {kind:'addElement',part:part.id,element:elements[0]};}
  if(p.step===2)return {kind:'useExample',part:part.id};
  if(p.step===3)return {kind:'finish',part:part.id};
  if(p.step===4&&p.exportedAt===null)return {kind:'export',part:part.id};
 }
 const next=nextWorkshopTarget(state);
 if(next?.kind==='set')return {kind:'buySet',set:next.set};
 if(next?.kind==='part')return {kind:'selectPart',part:next.part};
 if(next?.kind==='exit')return {kind:w.exitInspected&&canRelease(state)?'release':'exit'};
 return {kind:'customize'};
}

export function WorkshopExamples({state,i18n,dispatch,onRelease,finishHint}:{state:GameState;i18n:I18n;dispatch:WorkshopDispatch;onRelease:()=>void;finishHint?:(part:WorkshopPartId)=>string|null|undefined}){
 const hand=workshopExampleHand(state),t=i18n.t;
 let description:string,button:string|undefined,disabled=false,action:string|undefined,onClick:(()=>void)|undefined;
 switch(hand.kind){
  case 'buySet':description=t('examples.workshop.buySet' as MessageKey,{name:t(`ws.set.${hand.set}`)});button=t('ws.buySet');disabled=!canBuyWorkshopSet(state,hand.set);action='buySet';onClick=()=>dispatch({type:'buySet',set:hand.set});break;
  case 'place':{const part=getWorkshopPart(hand.part);description=t('examples.workshop.place' as MessageKey,{name:t(part.labelKey as MessageKey)});button=t('ws.place');disabled=!partRectValid(state,part.id,part.defaultRect);action='place';onClick=()=>dispatch({type:'place',part:part.id,rect:part.defaultRect,example:true});break;}
  case 'addElement':description=t('examples.workshop.addElement' as MessageKey,{name:t(`ws.element.${hand.element}` as MessageKey)});button=t(`ws.element.${hand.element}` as MessageKey);action='element';onClick=()=>dispatch({type:'addElement',part:hand.part,element:hand.element});break;
  case 'addAll':description=t('examples.workshop.addAll' as MessageKey);button=t('ws.batch');action='batch';onClick=()=>hand.elements.forEach(element=>dispatch({type:'addElement',part:hand.part,element}));break;
  case 'useExample':description=t('examples.workshop.useExample' as MessageKey);button=t('examples.workshop.useExampleAction' as MessageKey);action='useExample';onClick=()=>dispatch({type:'useExample',part:hand.part});break;
  case 'finish':description=t((finishHint?.(hand.part)??`ws.test.${getWorkshopPart(hand.part).testInteraction}`) as MessageKey);break;
  case 'export':description=t('examples.workshop.export' as MessageKey);button=t('ws.export');action='exportPart';onClick=()=>dispatch({type:'export',part:hand.part});break;
  case 'selectPart':description=t('examples.workshop.nextPart' as MessageKey,{name:t(getWorkshopPart(hand.part).labelKey as MessageKey)});button=t(getWorkshopPart(hand.part).labelKey as MessageKey);action='selectPart';onClick=()=>dispatch({type:'selectPart',part:hand.part});break;
  case 'release':description=t('examples.workshop.release' as MessageKey);button=t('ws.releaseReady');onClick=onRelease;break;
  case 'exit':description=t('examples.workshop.exit' as MessageKey);button=t('ws.assemble');disabled=!canInspectDesktopExit(state);onClick=()=>dispatch({type:'exit'});break;
  case 'customize':description=t('examples.workshop.customize' as MessageKey);break;
 }
 return <section className="ws-example-hand" data-workshop-next-hand={hand.kind} aria-label={t('examples.workshop.nextHand' as MessageKey)}>
  <strong>{t('examples.workshop.nextHand' as MessageKey)}</strong><p role="status">{description}</p>
  {button&&<button type="button" className="ws-primary" data-workshop-example-action={hand.kind} data-workshop-action={action} data-workshop-element={hand.kind==='addElement'?hand.element:undefined} disabled={disabled} onClick={onClick}>{button}</button>}
 </section>;
}
