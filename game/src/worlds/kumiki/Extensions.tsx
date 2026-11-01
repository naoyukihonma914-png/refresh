import { EditorAppearance } from '../../components/AppearanceSelect';
import { canSwitchEditor,editorName,unlockedDesktopStage } from '../../systems/appearance';
import { ProductSettings } from '../../components/ProductSettings';
import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { hasKSkill } from '../../systems/kumiki';
import { PageSettings } from '../PageSettings';
import { LanguageSelect } from '../../components/LanguageSelect';

export function Extensions({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const [tab, setTab] = useState<'tools' | 'home'>('tools');
  const { state } = snapshot;
  return <section className="extensions-page">
    <nav className="extension-tabs">
      <button aria-pressed={tab === 'tools'} onClick={() => setTab('tools')}>{editorName(state,i18n)}</button>
      <button aria-pressed={tab === 'home'} onClick={() => setTab('home')}>{i18n.t('k.homeSettings')}</button>
    </nav>
    {tab === 'home' ? <PageSettings key={state.createdAt} state={state} runtime={runtime} i18n={i18n} onClose={() => setTab('tools')} /> : <div>
      <h1>{i18n.t('k.extensions')}</h1>
      <p>{i18n.t('k.tokens', { count: state.resources.tokens })}</p>
      {([1, 2] as const).filter(band => band === 1 || state.run.version !== 'v0.1').map(band => <fieldset key={band}>
        <legend>{i18n.t(band === 1 ? 'settings.band1' : 'settings.band2')}</legend>
        {BALANCE.w2.skills.filter(skill => skill.band === band).map(skill => <div className="extension-row" key={skill.id}>
          <div><b>{i18n.t(`k.skill.${skill.id}`)}</b><p>{i18n.t(`k.skill.${skill.id}.description`)}</p>{skill.id==='modern'&&!hasKSkill(state,'modern')&&!canSwitchEditor(state)&&<p className="appearance-requirement">{unlockedDesktopStage(state)<BALANCE.appearance.gessoRequirement&&<span>{i18n.t('appearance.requirement',{stage:unlockedDesktopStage(state)})}</span>}{!hasKSkill(state,'update')&&<span>{i18n.t('appearance.updateFirst')}</span>}</p>}</div>
          <span>{i18n.t('k.skillCost', { count: skill.cost })}</span>
          <button disabled={hasKSkill(state, skill.id) || skill.id==='modern'&&!canSwitchEditor(state)|| state.resources.tokens < skill.cost} onClick={() => runtime.actKumiki({ type: 'skill', id: skill.id })}>
            {i18n.t(hasKSkill(state, skill.id) ? 'k.acquired' : 'k.acquire')}
          </button>
        </div>)}
      </fieldset>)}
      <p><EditorAppearance state={state} runtime={runtime} i18n={i18n}/></p>
      <ProductSettings state={state} runtime={runtime} i18n={i18n}/><p><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} /></p>
      <section className="k-data"><h2>{i18n.t('data.title')}</h2>
        <button onClick={runtime.downloadData}>{i18n.t('data.export')}</button>
        <button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button>
        <button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button>
      </section>
    </div>}
  </section>;
}
