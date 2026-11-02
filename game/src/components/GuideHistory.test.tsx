import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {createI18n} from '../content/i18n';
import {createInitialState} from '../systems/state';
import {WORKSHOP_GUIDE_IDS} from '../systems/workshopState';
import {GuideHistory} from './GuideHistory';
describe('工房のガイドの保存済み履歴',()=>{
 it.each(['ja','en','en-XA'])('%s：新しい9段階と未知の旧IDがあっても履歴を開ける',language=>{
  const s=createInitialState(1800000000000);
  s.persistent.guideArchive=[...WORKSHOP_GUIDE_IDS.map(id=>({kind:'kumiki' as const,id,version:'v0.1' as const})),{kind:'kumiki',id:'obsolete-entry',version:'v0.1'}];
  const i18n=createI18n(language);
  const html=renderToStaticMarkup(<GuideHistory state={s} i18n={i18n}/>);
  expect(html).toContain(i18n.t('ws.guide.entered.title'));expect(html).toContain(i18n.t('guide.archived.title'));expect(html.match(/<button/g)).toHaveLength(WORKSHOP_GUIDE_IDS.length+1);
 });
});
