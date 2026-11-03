import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createI18n} from '../content/i18n';
import {BALANCE} from '../config/balance';
import {buildSeed} from '../systems/seed';
import {creditPixels} from '../systems/economy';
import {createInitialState,type GameState} from '../systems/state';
import type {GameRuntime,RuntimeSnapshot} from '../systems/runtime';
import {SeedFuturePreview} from './SeedFuturePreview';
const now=1_800_000_000_000;
const runtime={platform:{clock:{monotonicNow:()=>now,wallNow:()=>now},animation:{reducedMotion:()=>true,subscribe:()=>()=>{}},every:()=>()=>{},keyboard:{subscribe:()=>()=>{}},viewport:{size:()=>({width:1920,height:1080}),subscribe:()=>()=>{},logicalSizeChanged:()=>{}}}} as unknown as GameRuntime;
const snap=(state:GameState)=>({state,language:'ja',status:'ready',notice:null,offline:null,introVisible:false}) as unknown as RuntimeSnapshot;
describe('TP-3：世界1で完成後の姿を常に示す',()=>{
 for(const language of ['ja','en','en-XA'])it(`${language}: 実物の完成形ミニチュアと残数・次の変化を示し、ゲーム状態を操作しない`,()=>{
  let state=createInitialState(now);const i18n=createI18n(language),before=structuredClone(state);
  const initial=renderToStaticMarkup(<SeedFuturePreview state={state} runtime={runtime} snapshot={snap(state)} i18n={i18n}/>);
  expect(initial).toContain('data-seed-future-remaining="9"');expect(initial).toContain('data-seed-future-next="border"');
  expect(initial).toContain('data-seed-future-live');expect(initial).not.toContain('data-seed-ghost-part');
  expect(initial).toContain('data-page-part="upgrades"');expect(initial).toContain('data-page-part="heading"');
  expect(initial).toContain(i18n.t('seed.future.title'));expect(state).toEqual(before);
  state=creditPixels(state,1e6);for(const id of ['border','save','color'] as const)state=buildSeed(state,id,now);
  const completed=renderToStaticMarkup(<SeedFuturePreview state={state} runtime={runtime} snapshot={snap(state)} i18n={i18n}/>);
  expect(completed).toContain('data-seed-future-remaining="6"');expect(completed).toContain('data-seed-future-next="font"');expect(completed).toContain('data-seed-future-built="border,save,color"');
 });
 it('16色の案件では飛ばすカラーを起動までの残数へ含めない',()=>{
  let state=creditPixels(createInitialState(now),1e6);state.run.play.contract={id:'no-color',status:'active'};
  for(const item of BALANCE.w1.items)if(item.id!=='color'&&item.id!=='export')state=buildSeed(state,item.id,now);
  const markup=renderToStaticMarkup(<SeedFuturePreview state={state} runtime={runtime} snapshot={snap(state)} i18n={createI18n('ja')}/>);
  expect(markup).toContain('data-seed-future-remaining="1"');expect(markup).toContain('data-seed-future-next="export"');expect(state.run.seed.built).not.toContain('color');
 });
});
