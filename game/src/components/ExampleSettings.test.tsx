import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createI18n} from '../content/i18n';
import type {GameRuntime} from '../systems/runtime';
import {createInitialState} from '../systems/state';
import {ExampleSettings} from './ExampleSettings';
import {SeedNextHand} from './SeedNextHand';
import {DesktopNextHand} from './DesktopNextHand';
import {createFixture} from '../systems/fixtures';

const runtime={} as GameRuntime,now=1_800_000_000_000;
describe('お手本の設定と次の手は人物コメントと独立する',()=>{
 for(const language of ['ja','en','en-XA'])it(`${language}: 共有設定と具体的な次の制作を、選んだ言語で表示する`,()=>{
  const state=createInitialState(now),i18n=createI18n(language);
  const markup=renderToStaticMarkup(<><ExampleSettings state={state} runtime={runtime} i18n={i18n}/><SeedNextHand state={state} i18n={i18n}/></>);
  expect(markup).toContain('data-examples-input');expect(markup).toContain('checked=""');
  expect(markup).toContain('data-example-next="seed-generate"');expect(markup).toContain('data-example-item="border"');expect(markup).toContain(i18n.t('item.border'));
  state.persistent.examplesEnabled=false;expect(renderToStaticMarkup(<SeedNextHand state={state} i18n={i18n}/>)).toBe('');
 });
 it('世界3の次の手は画面を遮る別overlayを描かず、入口1個へ具体的な名前を付ける',()=>{
  const state=createFixture('stage7-ready0',now)!;state.run.desktop.editingApp=null;
  const markup=renderToStaticMarkup(<DesktopNextHand state={state} runtime={runtime} i18n={createI18n('ja')} onOffer={()=>{}} onConditions={()=>{}}/>);
  expect(markup).toContain('data-example-next="desktop-release"');expect(markup).toContain('title="次の手: リリースする"');expect(markup).toContain('aria-label="次の手: リリースする"');expect(markup.match(/<button/g)).toHaveLength(1);expect(markup).not.toContain('<aside');
 });
});
