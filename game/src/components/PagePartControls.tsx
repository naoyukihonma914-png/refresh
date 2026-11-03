import {useState} from 'react';
import {PAGE_PARTS,PAGE_PART_SIZES,PAGE_TEXT_SIZES,canSetPagePartSize,pagePartSize,recommendedPage,type PagePart} from '../systems/pageDesign';
import type {GameState} from '../systems/state';
import type {GameRuntime} from '../systems/runtime';
import type {I18n} from '../content/i18n';

export function PagePartControls({state,runtime,i18n,part,onSelect}:{state:GameState;runtime:GameRuntime;i18n:I18n;part?:PagePart;onSelect?:(part:PagePart)=>void}){
 const [local,setLocal]=useState<PagePart>('generator'),selected=part??local,page=state.run.seed.page,layout=page.layout??recommendedPage();
 return <fieldset className="page-part-settings" data-page-part-setting={selected}>
  <legend>{i18n.t('page.partSettings')}</legend>
  <label>{i18n.t('page.selectPart')}<select data-page-selected-part value={selected} onChange={event=>{const value=event.target.value as PagePart;setLocal(value);onSelect?.(value);}}>{PAGE_PARTS.map(id=><option key={id} value={id}>{i18n.t(`page.part.${id}`)}</option>)}</select></label>
  <div className="page-size-choices">{PAGE_PART_SIZES.map(size=><button type="button" key={size} data-page-size={size} aria-pressed={pagePartSize(layout,selected)===size} disabled={!canSetPagePartSize(layout,selected,size)} onClick={()=>runtime.actPage({type:'part-size',part:selected,size})}>{i18n.t(`page.size.${size}`)}</button>)}</div>
  {state.run.seed.built.includes('font')&&<label>{i18n.t('page.textSize')}<select data-page-font-size value={page.partFonts[selected]} onChange={event=>runtime.actPage({type:'part-font',part:selected,size:event.target.value as typeof PAGE_TEXT_SIZES[number]})}>{PAGE_TEXT_SIZES.map(size=><option value={size} key={size}>{i18n.t(`page.text.${size}`)}</option>)}</select></label>}
 </fieldset>;
}
