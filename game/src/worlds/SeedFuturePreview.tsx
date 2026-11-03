import {useId,type CSSProperties} from 'react';
import {BALANCE,type SeedItem} from '../config/balance';
import type {I18n} from '../content/i18n';
import type {GameState} from '../systems/state';
import {editorName,editorStage} from '../systems/appearance';
import {contractBlocks} from '../systems/longPlay';
import {effectiveEditorBackground} from '../systems/workshopState';
import {readableText} from '../systems/appLayout';
import {visibleSeedItems} from '../systems/seed';
import {paletteFor} from '../content/palette';

interface Props {state:GameState;i18n:I18n}
/** A future drawing of the tool, in its own page region. It neither installs nor produces UI. */
export function SeedFuturePreview({state,i18n}:Props){
 const config=BALANCE.w1.futurePreview,built=state.run.seed.built,remaining=BALANCE.w1.items.filter(item=>!built.includes(item.id)&&!contractBlocks(state,item.id)).length,next=visibleSeedItems(state)[0];
 const background=built.includes('color')?effectiveEditorBackground(state.persistent.editorCustomization,editorStage(state)):'#ffffff';
 const app=editorName(state,i18n),palette=paletteFor(state.persistent.specs.color),grid=`seed-future-grid-${useId().replace(/:/g,'')}`;
 const attributes=(part:SeedItem)=>({'data-seed-ghost-part':part,'data-built':built.includes(part),className:`seed-future-piece ${built.includes(part)?'is-built':''}`});
 return <aside className="seed-future-preview" data-seed-future-preview data-seed-future-remaining={remaining} data-seed-future-next={next??''} data-seed-future-built={built.join(',')} aria-label={i18n.t('seed.future.title')} style={{'--seed-future-width':`${config.width}px`,'--seed-future-right':`${config.right}px`,'--seed-future-top':`${config.top}px`,'--seed-future-footer-clearance':`${config.footerHeight}px`,backgroundColor:background,color:readableText(background)} as CSSProperties}>
  <h2>{i18n.t('seed.future.title')}</h2>
  <p className="seed-future-name">{i18n.t('seed.future.editor',{app})}</p>
  <svg viewBox={`0 0 ${config.schematicWidth} ${config.schematicHeight}`} width={config.schematicWidth} height={config.schematicHeight} className="seed-future-drawing" aria-hidden="true">
   <defs><pattern id={grid} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="currentColor" strokeOpacity=".18"/></pattern></defs>
   <g {...attributes('border')}><rect {...config.editor}/></g>
   <g {...attributes('save')}><rect x={config.status.x} y={config.status.y} width={config.status.width} height={config.status.height}/><path d="M20 147h8m-8 4h18"/></g>
   <g {...attributes('color')}>{Array.from({length:config.palette.count},(_,index)=><rect key={index} x={config.palette.x} y={config.palette.y+index*(config.palette.height+config.palette.gap)} width={config.palette.width} height={config.palette.height} style={{fill:built.includes('color')?palette[index+1]:undefined}}/>)}</g>
   <g {...attributes('font')}>{[0,1,2].map(index=><rect key={index} x={config.heading.x} y={config.heading.y+config.heading.lineGap*index} width={config.heading.width/(index+1)} height={config.heading.height}/>)}</g>
   <g {...attributes('layout')}><rect {...config.panel}/><path d="M226 50h44m-44 12h44m-44 12h28m-28 12h44m-44 12h44m-44 12h30"/></g>
   <g {...attributes('motion')}><rect {...config.button}/><path d="M168 94v22l5-6 5 9 4-2-5-9 8-1Z"/></g>
   <g {...attributes('bars')}><rect {...config.title}/><path d="M20 19h118m128 0h7m8 0h7m8 0h7"/></g>
   <g {...attributes('workspace')}><rect {...config.canvas} fill={`url(#${grid})`}/><rect {...config.tool}/><path d="m291 54 6-6 3 3-6 6-4 2Z"/></g>
   <g {...attributes('export')}><rect {...config.export}/><path d="M270 19h14m-5-4 5 4-5 4"/></g>
   <g className="seed-future-connection"><path d="M160 162v13m-4-4 4 4 4-4"/></g>
   <g className="seed-future-desktop" data-seed-future-desktop><rect {...config.desktop}/><rect {...config.taskbar}/><rect {...config.futureWindow}/><path d="M64 205h170m-161 14h74m-74 8h104M20 194h12v12H20Zm0 22h12v12H20Zm-5 34h24m10 0h14"/></g>
  </svg>
  <p className="seed-future-desktop-name">{i18n.t('seed.future.desktop')}</p>
  <p className="seed-future-progress" data-seed-future-progress>{remaining?i18n.t('seed.future.remaining',{count:remaining,app}):i18n.t('seed.future.ready',{app})}</p>
  {next&&<p className="seed-future-change" data-seed-future-change>{i18n.t('seed.future.next',{name:i18n.t(`item.${next}`),change:i18n.t(`seed.future.change.${next}`)})}</p>}
 </aside>;
}
