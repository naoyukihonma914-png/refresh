import { BALANCE } from '../config/balance';
import type { I18n } from '../content/i18n';
import { LanguageSelect } from './LanguageSelect';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { canSave } from '../systems/state';

export function DebugPanel({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  return (
    <fieldset className="debug-panel">
      <legend>{i18n.t('debug.title')}</legend>
      {runtime.fixture && <p>{i18n.t('debug.fixture')}</p>}
      <p>{i18n.t('debug.description')}</p>
      <LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} includeTest />
      <div className="debug-actions">
        <button onClick={runtime.addDebugPixels}>{i18n.t('debug.addPixels')}</button>
        <button onClick={runtime.enableDebugSave} disabled={canSave(snapshot.state)}>{i18n.t('debug.enableSave')}</button>
        <button onClick={runtime.persist} disabled={!canSave(snapshot.state)}>{i18n.t('debug.saveNow')}</button>
      </div>
      <p className="cursor-count">{i18n.t('debug.cursorCount', { count: snapshot.state.run.seed.autoCursors })}</p>
      {(['color', 'refresh', 'storage'] as const).map(key => (
        <label key={key}>
          {i18n.t(`spec.${key}`)}
          <select title={i18n.spec(key, snapshot.state.persistent.specs[key])} value={snapshot.state.persistent.specs[key]} onChange={event => runtime.changeDebugSpec(key, Number(event.target.value))}>
            {BALANCE.spec[key].map((_, index) => <option value={index} key={index}>{i18n.spec(key, index)}</option>)}
          </select>
        </label>
      ))}
      <div className="debug-actions">
        <button onClick={runtime.downloadData}>{i18n.t('data.export')}</button>
        <button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button>
        <button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button>
      </div>
    </fieldset>
  );
}
