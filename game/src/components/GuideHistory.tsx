import { useState } from 'react';
import type { I18n, MessageKey } from '../content/i18n';
import type { GameState } from '../systems/state';
import type { GuideRecord } from '../systems/releaseState';

export function GuideHistory({ state, i18n }: { state: GameState; i18n: I18n }) {
  const [selected, setSelected] = useState<GuideRecord | null>(null);
  const key = (entry: GuideRecord) => `${entry.kind === 'seed' ? 'guide' : entry.kind === 'kumiki' ? 'k.guide' : 'release'}.${entry.id}` as MessageKey;
  if (!state.persistent.guideArchive.length) return null;
  return <section className="guide-history"><h3>{i18n.t('release.guideHistory')}</h3>
    <ul>{state.persistent.guideArchive.map(entry => <li key={`${entry.version}:${entry.kind}:${entry.id}`}>
      <button type="button" className="text-button" onClick={() => setSelected(entry)}>{i18n.t('release.guideRead', { version: entry.version, title: i18n.t(`${key(entry)}.title` as MessageKey) })}</button>
    </li>)}</ul>
    {selected && <div className="guide-history-body"><p>{i18n.t(key(selected))}</p><button type="button" onClick={() => setSelected(null)}>{i18n.t('guide.close')}</button></div>}
  </section>;
}
