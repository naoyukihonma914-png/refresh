import { canBuyGroup } from '../../systems/groupPuzzle';
import type { I18n } from '../../content/i18n';
import { partsForSet } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import { world4Preparation } from '../../systems/world4';
import { canBuyWorkshopSet } from '../../systems/workshop';
import type { WorkshopDispatch } from './WorkshopCustomization';
import { BALANCE } from '../../config/balance';

/** Shows preparation conditions only; entering the streaming world is outside this stage. */
export function World4Preparation({state,i18n,dispatch,onOpenWorkshop}:{state:GameState;i18n:I18n;dispatch:WorkshopDispatch;onOpenWorkshop?:()=>void}) {
 const readiness=world4Preparation(state),t=i18n.t;
 const requiredParts=readiness.requiredSets.flatMap(partsForSet);
 const completeCount=requiredParts.filter(part=>state.run.workshop.parts[part.id]?.step===4).length;
 const streamOwned=state.run.workshop.purchasedSets.includes('stream');
 const next=requiredParts.find(part=>state.run.workshop.parts[part.id]?.step!==4)??requiredParts[0];
 const open=()=>{if(next){if(state.run.workshop.groupPuzzle)dispatch({type:'groupSelect',group:'stream'});dispatch({type:'selectPart',part:next.id});dispatch({type:'view',view:'workbench'});onOpenWorkshop?.();}};
 return <section className="ws-world4-preparation" data-world4-preparation data-world4-version-allowed={readiness.versionAllowed} data-world4-desktop-available={readiness.desktopAvailable} data-world4-required-sets={readiness.requiredSets.join(',')} data-world4-completed-sets={readiness.completedSets.join(',')} data-world4-stored-sets={readiness.storedSets.join(',')} data-world4-required-hz={readiness.requiredHz} data-world4-current-hz={readiness.currentHz} data-world4-ready={readiness.ready}>
  <h3>{t('world4.preparationTitle')}</h3>
  <progress aria-label={t('world4.preparationTitle')} max={requiredParts.length} value={completeCount}/>
  <ul><li data-world4-parts-complete={completeCount===requiredParts.length}>{t('world4.partsCondition',{count:i18n.integer(completeCount),total:i18n.integer(requiredParts.length)})}</li><li data-world4-document-stored={readiness.storedSets.length===readiness.requiredSets.length}>{t('world4.documentCondition',{count:i18n.integer(readiness.storedSets.length),total:i18n.integer(readiness.requiredSets.length)})}</li><li data-world4-spec-ready={readiness.currentHz>=readiness.requiredHz}>{t('world4.refreshCondition',{required:i18n.integer(readiness.requiredHz),current:i18n.integer(readiness.currentHz)})}</li></ul>
  {!readiness.versionAllowed?<p>{t('world4.nextVersion')}</p>:streamOwned?<button type="button" data-world4-open-set onClick={open}>{t('world4.openSet')}</button>:<button type="button" data-workshop-set="stream" disabled={!(state.run.workshop.groupPuzzle?canBuyGroup(state,'stream'):canBuyWorkshopSet(state,'stream'))} onClick={()=>dispatch(state.run.workshop.groupPuzzle?{type:'groupBuy',group:'stream'}:{type:'buySet',set:'stream'})}>{t('world4.buySet',{price:i18n.price(BALANCE.workshop.setCosts.stream)})}</button>}
  {readiness.ready&&<p role="status" data-world4-ready-message>{t('world4.ready')}</p>}
 </section>;
}
