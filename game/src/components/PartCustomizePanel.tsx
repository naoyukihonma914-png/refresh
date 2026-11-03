import {PAGE_FONTS,PAGE_MOTIONS,PAGE_PART_SIZES,PAGE_TEXT_SIZES,canSetPagePartSize,contrast,pageColors,pagePartSize,recommendedPage,type PagePart} from '../systems/pageDesign';
import {paletteFor} from '../content/palette';
import {editorStage} from '../systems/appearance';
import {usesNativeEditorBackground} from '../systems/workshopState';
import type {GameState} from '../systems/state';
import type {GameRuntime} from '../systems/runtime';
import type {I18n} from '../content/i18n';

// Inline per-part customization, opened from the part's own button on the seed screen,
// so changing a part never requires leaving for the settings page.
export function PartCustomizePanel({state,runtime,i18n,part,onClose}:{state:GameState;runtime:GameRuntime;i18n:I18n;part:PagePart;onClose():void}){
 const t=i18n.t,built=state.run.seed.built,page=state.run.seed.page,layout=page.layout??recommendedPage();
 return <div className="seed-customize-panel" data-customize-panel={part} role="dialog" aria-label={`${t(`page.part.${part}`)} ${t('page.customize')}`}>
  <div className="seed-customize-head"><strong>{t(`page.part.${part}`)}</strong><button type="button" className="seed-customize-close" aria-label={t('common.close')} onClick={onClose}><svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true"><path d="M2 2L12 12M12 2L2 12" fill="none" stroke="currentColor" strokeWidth={2}/></svg></button></div>
  {built.includes('layout')&&<fieldset><legend>{t('page.partSettings')}</legend>
   <div className="page-size-choices">{PAGE_PART_SIZES.map(size=><button type="button" key={size} data-page-size={size} aria-pressed={pagePartSize(layout,part)===size} disabled={!canSetPagePartSize(layout,part,size)} onClick={()=>runtime.actPage({type:'part-size',part,size})}>{t(`page.size.${size}`)}</button>)}</div>
   {built.includes('font')&&<label>{t('page.textSize')}<select data-page-font-size value={page.partFonts[part]} onChange={event=>runtime.actPage({type:'part-font',part,size:event.target.value as typeof PAGE_TEXT_SIZES[number]})}>{PAGE_TEXT_SIZES.map(size=><option value={size} key={size}>{t(`page.text.${size}`)}</option>)}</select></label>}
  </fieldset>}
  {built.includes('color')&&<fieldset><legend>{t('page.colors')}</legend>{(['background','button','text'] as const).map(slot=><label key={slot}>{t(`page.color.${slot}`)}<select aria-label={t(`page.color.${slot}`)} value={slot==='background'?(usesNativeEditorBackground(state.persistent.editorCustomization)?'':state.persistent.editorCustomization.background):page[slot]??''} onChange={e=>runtime.actPage({type:'color',slot,color:e.target.value||null})}><option value="">{t('page.standard')}</option>{paletteFor(state.persistent.specs.color).map(c=><option key={c} value={c} disabled={slot==='text'&&contrast(pageColors(page,state.persistent.specs.color,state.persistent.editorCustomization,editorStage(state)).background,c)<4.5}>{c}</option>)}</select></label>)}</fieldset>}
  {part==='heading'&&built.includes('font')&&<><fieldset><legend>{t('page.fonts')}</legend>{(['headingFont','bodyFont'] as const).map(slot=><label key={slot}>{t(`page.${slot}`)}<select aria-label={t(`page.${slot}`)} value={page[slot]} onChange={e=>runtime.actPage({type:'font',slot,font:e.target.value as typeof page.bodyFont})}>{PAGE_FONTS.map(id=><option key={id} value={id}>{t(`page.font.${id}`)}</option>)}</select></label>)}</fieldset>
  <p><label>{t('seed8.heading')}<input aria-label={t('seed8.heading')} value={page.heading} onChange={e=>runtime.actPage({type:'heading',heading:e.target.value})}/></label></p></>}
  {part==='generator'&&built.includes('motion')&&<fieldset><legend>{t('page.motion')}</legend><select aria-label={t('page.motion')} value={page.motion} onChange={e=>runtime.actPage({type:'motion',motion:e.target.value as typeof page.motion})}>{PAGE_MOTIONS.map(id=><option key={id} value={id}>{t(`page.motion.${id}`)}</option>)}</select></fieldset>}
 </div>;
}
