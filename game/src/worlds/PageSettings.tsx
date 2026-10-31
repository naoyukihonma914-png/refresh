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
    <p>{i18n.t('settings.tokens', { count: state.resources.tokens })}</p>
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
    </form>
    <ProductSettings state={state} runtime={runtime} i18n={i18n}/><p><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} /></p>
    {state.persistent.products.length > 0 && <section className="product-history"><h2>{i18n.t('release.history')}</h2><table><thead><tr><th>{i18n.t('release.version')}</th><th>{i18n.t('release.releasedAt')}</th><th>{i18n.t('release.contents')}</th></tr></thead><tbody>{state.persistent.products.map(product => <tr key={product.id}><td>{productLabel(i18n,product.name,i18n.t('release.prototype'))}</td><td>{i18n.date(product.releasedAt)}</td><td>{i18n.t('release.summary', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length })}</td></tr>)}</tbody></table></section>}
    <section className="data-settings">
      <h2>{i18n.t('data.title')}</h2>
      <button onClick={runtime.downloadData}>{i18n.t('data.export')}</button>
      <button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button>
      <button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button>
    </section>
  </section>;
}
