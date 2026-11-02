import {editorName} from '../systems/appearance';
import { useState } from 'react';
import {LOCALES,type I18n,type MessageKey} from '../content/i18n';
import type { GameState } from '../systems/state';
import type { GuideRecord } from '../systems/releaseState';

export function GuideHistory({ state, i18n }: { state: GameState; i18n: I18n }) {
  const [selected, setSelected] = useState<GuideRecord | null>(null);
  const candidate = (entry: GuideRecord) => entry.kind==='seed'&&entry.id==='return'&&entry.version==='v2'?'guide.return.v2':entry.kind==='release'&&entry.version!=='v0.1'?`release.${entry.id}.v1` as MessageKey:`${entry.kind === 'seed' ? 'guide' : entry.kind === 'kumiki' ? 'ws.guide' : 'release'}.${entry.id}` as MessageKey;
  const key=(entry:GuideRecord):MessageKey=>Object.hasOwn(LOCALES.ja!.messages,candidate(entry))?candidate(entry):'guide.archived';
  const title=(entry:GuideRecord):MessageKey=>Object.hasOwn(LOCALES.ja!.messages,`${key(entry)}.title`)?`${key(entry)}.title` as MessageKey:'guide.archived.title';
  if (!state.persistent.guideArchive.length) return null;
  return <section className="guide-history"><h3>{i18n.t('release.guideHistory')}</h3>
    <ul>{state.persistent.guideArchive.map(entry => <li key={`${entry.version}:${entry.kind}:${entry.id}`}>
      <button type="button" className="text-button" onClick={() => setSelected(entry)}>{i18n.t('release.guideRead', { version: entry.version, title: i18n.t(title(entry)) })}</button>
    </li>)}</ul>
    {selected && <div className="guide-history-body"><p>{i18n.t(key(selected),{app:editorName(state,i18n)})}</p><button type="button" onClick={() => setSelected(null)}>{i18n.t('guide.close')}</button></div>}
  </section>;
}
