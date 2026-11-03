import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {createFixture} from './fixtures';
import {passivePixelsPerSecond} from './economy';
import {actWorkshop} from './workshop';
import {completionFeedback,feedbackCounterValue,workshopVisible} from './workshopFeedback';

const now=1_800_000_000_000;
describe('完成の見せ方は実際の生産を観測するだけ',()=>{
 it('新規完成だけを取り出し、基本値・実稼働分・倍率込みの合計を混同しない',()=>{
  const before=createFixture('stage8a-part-common-button-step-3-era0',now)!;
  const after=actWorkshop(before,{type:'test',part:'common-button',interaction:'press'},now),copy=structuredClone(after);
  const event=completionFeedback(before,after,'common-button',1,100)!;
  expect(event.partRate).toBe(BALANCE.workshop.partRates['common-button']);expect(event.activePartRate).toBeGreaterThan(0);
  expect(event.rateBefore).toBe(passivePixelsPerSecond(before));expect(event.rateAfter).toBe(passivePixelsPerSecond(after));
  expect(feedbackCounterValue(event,0)).toBe(event.rateBefore);expect(feedbackCounterValue(event,1)).toBe(event.rateAfter);
  expect(feedbackCounterValue(event,-1)).toBe(event.rateBefore);expect(feedbackCounterValue(event,2)).toBe(event.rateAfter);expect(after).toEqual(copy);
  expect(completionFeedback(after,after,'common-button',2,101)).toBeNull();
  const nextRun=structuredClone(after);nextRun.run.version='v1';expect(completionFeedback(before,nextRun,'common-button',2,101)).toBeNull();
 });
 it('未採用の配信材料は、実績が合計を増やす場合でも現在の稼働源に見せない',()=>{
  const before=createFixture('stage8b-stream-draft-era0',now)!;before.persistent.progress.records={};
  const after=structuredClone(actWorkshop(before,{type:'test',part:'stream-preview',interaction:'select'},now));after.persistent.progress.records={'first-pixel':now};
  const event=completionFeedback(before,after,'stream-preview',1,100)!;
  expect(event.partRate).toBeGreaterThan(0);expect(event.activePartRate).toBe(0);expect(event.rateAfter).toBeGreaterThan(event.rateBefore);
 });
 it('工房が最前面で実際に開いているときだけ、音と表示を付ける',()=>{
  const state=createFixture('stage8b-stream-draft-era0',now)!;expect(workshopVisible(state)).toBe(true);
  const hidden=structuredClone(state);hidden.run.desktop.windows.tessera.minimized=true;expect(workshopVisible(hidden)).toBe(false);
  hidden.run.desktop.windows.tessera.minimized=false;hidden.run.desktop.active='files';expect(workshopVisible(hidden)).toBe(false);
  state.run.workshop.view='settings';expect(workshopVisible(state)).toBe(false);
 });
});
