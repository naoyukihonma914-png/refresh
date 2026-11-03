import type {CSSProperties} from 'react';
import {BALANCE} from '../config/balance';
import type {I18n} from '../content/i18n';
import type {GameRuntime,RuntimeSnapshot} from '../systems/runtime';
import type {GameState} from '../systems/state';
import {editorName,editorStage} from '../systems/appearance';
import {contractBlocks} from '../systems/longPlay';
import {effectiveEditorBackground} from '../systems/workshopState';
import {readableText} from '../systems/appLayout';
import {visibleSeedItems} from '../systems/seed';
import {completedSeedPreviewState} from '../systems/seedPreview';
import {Foundation} from './Foundation';

interface Props {state:GameState;runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n}
/** The finished picture: the player's own screen with everything built and fitted, rendered live at miniature size. It neither installs nor produces UI. */
export function SeedFuturePreview({state,runtime,snapshot,i18n}:Props){
 const config=BALANCE.w1.futurePreview,built=state.run.seed.built,remaining=BALANCE.w1.items.filter(item=>!built.includes(item.id)&&!contractBlocks(state,item.id)).length,next=visibleSeedItems(state)[0];
 const background=built.includes('color')?effectiveEditorBackground(state.persistent.editorCustomization,editorStage(state)):'#ffffff';
 const app=editorName(state,i18n);
 const previewSnapshot:RuntimeSnapshot={...snapshot,state:completedSeedPreviewState(state),offline:null,introVisible:false,notice:null,tesseraIntent:undefined,shotHintSerial:undefined,workshopSnap:undefined,workshopCompletion:undefined};
 const view=runtime.platform.viewport.size(),scale=config.width/Math.max(1,view.width);
 return <aside className="seed-future-preview" data-seed-future-preview data-seed-future-remaining={remaining} data-seed-future-next={next??''} data-seed-future-built={built.join(',')} aria-label={i18n.t('seed.future.title')} style={{'--seed-future-width':`${config.width}px`,'--seed-future-right':`${config.right}px`,'--seed-future-top':`${config.top}px`,'--seed-future-footer-clearance':`${config.footerHeight}px`,backgroundColor:background,color:readableText(background)} as CSSProperties}>
  <h2>{i18n.t('seed.future.title')}</h2>
  <p className="seed-future-name">{i18n.t('seed.future.editor',{app})}</p>
  <div className="seed-future-live" data-seed-future-live style={{aspectRatio:`${view.width}/${view.height}`}} inert>
   <div className="seed-future-live-inner" style={{width:view.width,height:view.height,transform:`scale(${scale})`}}>
    <Foundation bare runtime={runtime} snapshot={previewSnapshot} i18n={i18n}/>
   </div>
  </div>
  <p className="seed-future-progress" data-seed-future-progress>{remaining?i18n.t('seed.future.remaining',{count:remaining,app}):i18n.t('seed.future.ready',{app})}</p>
  {next&&<p className="seed-future-change" data-seed-future-change>{i18n.t('seed.future.next',{name:i18n.t(`item.${next}`),change:i18n.t(`seed.future.change.${next}`)})}</p>}
 </aside>;
}
