import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRef} from 'react';
import {BALANCE} from '../../config/balance';
import {createI18n} from '../../content/i18n';
import type {Platform} from '../../platform/types';
import type {RuntimeSnapshot} from '../../systems/runtime';
import {createFixture} from '../../systems/fixtures';
import {WorkshopCombo,WorkshopCompletionFeedback} from './WorkshopCompletionFeedback';

const now=1_800_000_000_000;
for(const language of ['ja','en','en-XA'])describe(`お手本の完成表示 ${language}`,()=>{
 it('連続の表示はこれから受け取る工程倍率で、基本毎秒や取得済み報酬を変えない',()=>{
  const state=createFixture('stage8a-part-common-button-step-3-era0',now)!;state.run.workshop.combo={count:2,lastCompletedAt:now};
  const before=structuredClone(state),i18n=createI18n(language),platform={clock:{wallNow:()=>now}} as Platform;
  const html=renderToStaticMarkup(<WorkshopCombo state={state} i18n={i18n} platform={platform}/>);
  expect(html).toContain('data-workshop-combo="2"');expect(html).toContain('data-workshop-next-step-multiplier="1.04"');
  expect(html).toContain(i18n.t('examples.feedback.combo',{count:2,multiplier:i18n.number(1.04)}));expect(state).toEqual(before);
  platform.clock.wallNow=()=>now+BALANCE.workshop.examples.comboWindowMs+1;
  expect(renderToStaticMarkup(<WorkshopCombo state={state} i18n={i18n} platform={platform}/>)).toBe('');
 });
 it('ロード時に残っている一時反応を初回マウントでは再生しない',()=>{
  const state=createFixture('stage8a-part-common-button-step-3-era0',now)!,i18n=createI18n(language);
  const snapshot={state,workshopCompletion:{serial:5,part:'common-button',at:0,run:'prior',partRate:10,activePartRate:10,rateBefore:100,rateAfter:110}} as RuntimeSnapshot;
  const platform={clock:{monotonicNow:()=>0}} as Platform;
  expect(renderToStaticMarkup(<WorkshopCompletionFeedback snapshot={snapshot} i18n={i18n} platform={platform} containerRef={createRef<HTMLElement>()}/>)).toBe('');
 });
});
