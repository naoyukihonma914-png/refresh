import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createI18n} from '../content/i18n';
import {BALANCE} from '../config/balance';
import {buildSeed} from '../systems/seed';
import {creditPixels} from '../systems/economy';
import {createInitialState} from '../systems/state';
import {SeedFuturePreview} from './SeedFuturePreview';
const now=1_800_000_000_000;
describe('TP-3：世界1で完成後の姿を常に示す',()=>{
 for(const language of ['ja','en','en-XA'])it(`${language}: 現在の9つと残数・次の変化を示し、ゲーム状態を操作しない`,()=>{
  let state=createInitialState(now);const i18n=createI18n(language),before=structuredClone(state);
  const initial=renderToStaticMarkup(<SeedFuturePreview state={state} i18n={i18n}/>);
  expect(initial).toContain('data-seed-future-remaining="9"');expect(initial).toContain('data-seed-future-next="border"');expect(initial.match(/data-seed-ghost-part=/g)).toHaveLength(BALANCE.w1.items.length);
  expect(initial).toContain(i18n.t('seed.future.title'));expect(initial).not.toContain('<button');expect(state).toEqual(before);
  state=creditPixels(state,1e6);for(const id of ['border','save','color'] as const)state=buildSeed(state,id,now);
  const completed=renderToStaticMarkup(<SeedFuturePreview state={state} i18n={i18n}/>);
  expect(completed).toContain('data-seed-future-remaining="6"');expect(completed).toContain('data-seed-future-next="font"');expect(completed.match(/data-built="true"/g)).toHaveLength(3);
 });
 it('16色の案件では飛ばすカラーを起動までの残数へ含めない',()=>{
  let state=creditPixels(createInitialState(now),1e6);state.run.play.contract={id:'no-color',status:'active'};
  for(const item of BALANCE.w1.items)if(item.id!=='color'&&item.id!=='export')state=buildSeed(state,item.id,now);
  const markup=renderToStaticMarkup(<SeedFuturePreview state={state} i18n={createI18n('ja')}/>);
  expect(markup).toContain('data-seed-future-remaining="1"');expect(markup).toContain('data-seed-future-next="export"');expect(state.run.seed.built).not.toContain('color');
 });
});
