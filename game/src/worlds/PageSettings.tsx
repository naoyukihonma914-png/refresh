import {Records,SoundSettings} from '../components/LongPlaySettings';
import { PAGE_FONTS,PAGE_MOTIONS,pageColors,contrast } from '../systems/pageDesign';
import { paletteFor } from '../content/kumikiArt';
import { ProductSettings } from '../components/ProductSettings';
import { productLabel } from '../content/products';
import { useState } from 'react';
import { BALANCE, type SeedSkill } from '../config/balance';
import type { I18n } from '../content/i18n';
import type { GameRuntime } from '../systems/runtime';
import type { GameState } from '../systems/state';
import { LanguageSelect } from '../components/LanguageSelect';

// 組木のホーム画面タブからも同じ設定部品を開く。
export function PageSettings({ state, runtime, i18n, onClose }: {
  state: GameState; runtime: GameRuntime; i18n: I18n; onClose(): void;
}) {
  const owned = state.persistent.seedSkills;
  const appearance = state.persistent.seedAppearance;
  const [selected, setSelected] = useState<SeedSkill[]>(owned.filter(id =>
    id !== 'pattern' && id !== 'marquee' || id === 'pattern' && appearance.pattern !== 'none' || id === 'marquee' && appearance.marquee));
  const [pattern, setPattern] = useState(appearance.pattern === 'none' ? 'dots' : appearance.pattern);
  const cost = BALANCE.w1.skills.filter(skill => selected.includes(skill.id) && !owned.includes(skill.id)).reduce((total, skill) => total + skill.cost, 0);
  return <section className="page-settings">
    <h1>{i18n.t('seed.settings')}</h1>
    <button className="text-button" onClick={onClose}>{i18n.t('settings.back')}</button>
    <section className="page-design-settings">
    {state.run.seed.built.includes('color')&&<fieldset><legend>{i18n.t('page.colors')}</legend>{(['background','button','text'] as const).map(slot=><label key={slot}>{i18n.t(`page.color.${slot}`)}<select aria-label={i18n.t(`page.color.${slot}`)} value={state.run.seed.page[slot]??''} onChange={e=>runtime.actPage({type:'color',slot,color:e.target.value||null})}><option value="">{i18n.t('page.standard')}</option>{paletteFor(state.persistent.specs.color).map(c=><option key={c} value={c} disabled={slot==='text'&&contrast(pageColors(state.run.seed.page,state.persistent.specs.color).background,c)<4.5}>{c}</option>)}</select></label>)}</fieldset>}
    {state.run.seed.built.includes('font')&&<fieldset><legend>{i18n.t('page.fonts')}</legend>{(['headingFont','bodyFont'] as const).map(slot=><label key={slot}>{i18n.t(`page.${slot}`)}<select aria-label={i18n.t(`page.${slot}`)} value={state.run.seed.page[slot]} onChange={e=>runtime.actPage({type:'font',slot,font:e.target.value as typeof state.run.seed.page.bodyFont})}>{PAGE_FONTS.map(id=><option key={id} value={id}>{i18n.t(`page.font.${id}`)}</option>)}</select></label>)}</fieldset>}
    {state.run.seed.built.includes('motion')&&<fieldset><legend>{i18n.t('page.motion')}</legend><select aria-label={i18n.t('page.motion')} value={state.run.seed.page.motion} onChange={e=>runtime.actPage({type:'motion',motion:e.target.value as typeof state.run.seed.page.motion})}>{PAGE_MOTIONS.map(id=><option key={id} value={id}>{i18n.t(`page.motion.${id}`)}</option>)}</select></fieldset>}
    {state.run.seed.built.includes('layout')&&<button onClick={()=>runtime.actPage({type:'recommended'})}>{i18n.t('builder.recommended')}</button>}<button onClick={()=>runtime.actPage({type:'reset'})}>{i18n.t('page.reset')}</button>
    </section>
    {(state.run.version!=='v0.1'||state.run.kumiki.built.includes('extensions'))&&<><p>{i18n.t('settings.tokens', { count: state.resources.tokens })}</p>
    <form onSubmit={event => {
      event.preventDefault();
      runtime.applySeedSettings(selected, selected.includes('pattern') ? pattern : 'none', selected.includes('marquee'));
    }}>
      {([1, 2] as const).filter(band => band === 1 || state.run.version !== 'v0.1').map(band => <fieldset key={band}>
        <legend>{i18n.t(band === 1 ? 'settings.band1' : 'settings.band2')}</legend>
        {BALANCE.w1.skills.filter(skill => skill.band === band).map(skill => <div className="skill-row" key={skill.id}>
          <label>
            <input type="checkbox" checked={selected.includes(skill.id)} disabled={owned.includes(skill.id) && !skill.playful}
              onChange={event => setSelected(event.target.checked ? [...selected, skill.id] : selected.filter(id => id !== skill.id))} />
            <span>{i18n.t(`settings.${skill.id}`)}</span>
            <small>{owned.includes(skill.id) ? i18n.t('settings.owned') : i18n.t('settings.price', { cost: skill.cost })}</small>
          </label>
          <p>{i18n.t(`settings.${skill.id}.description`)}</p>
        </div>)}
      </fieldset>)}
      {selected.includes('pattern') && <p><label>{i18n.t('pattern.label')}
        <select aria-label={i18n.t('pattern.label')} value={pattern} onChange={event => setPattern(event.target.value as typeof pattern)}>
          {(['dots', 'grid', 'diagonal'] as const).map(id => <option value={id} key={id}>{i18n.t(`pattern.${id}`)}</option>)}
        </select>
      </label></p>}
      <p>{i18n.t('settings.total', { count: cost })}</p>
      <button type="submit" disabled={cost > state.resources.tokens}>{i18n.t('settings.apply')}</button>
    </form></>}
    <ProductSettings state={state} runtime={runtime} i18n={i18n}/><p><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} /></p>
    {state.persistent.products.length > 0 && <section className="product-history"><h2>{i18n.t('release.history')}</h2><table><thead><tr><th>{i18n.t('release.version')}</th><th>{i18n.t('release.releasedAt')}</th><th>{i18n.t('release.contents')}</th></tr></thead><tbody>{state.persistent.products.map(product => <tr key={product.id}><td>{productLabel(i18n,product.name,i18n.t('release.prototype'))}</td><td>{i18n.date(product.releasedAt)}</td><td>{i18n.t('release.summary', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length })}</td></tr>)}</tbody></table></section>}
    <details className="longplay-settings"><summary>{i18n.t('settings.records')}</summary><Records state={state} i18n={i18n}/></details><details className="longplay-settings"><summary>{i18n.t('settings.sound')}</summary><SoundSettings state={state} runtime={runtime} i18n={i18n}/></details>
    <section className="data-settings">
      <h2>{i18n.t('data.title')}</h2>
      <button onClick={runtime.downloadData}>{i18n.t('data.export')}</button>
      <button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button>
      <button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button>
    </section>
  </section>;
}
