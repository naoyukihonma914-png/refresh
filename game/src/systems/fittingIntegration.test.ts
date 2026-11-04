import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createAppAssembly, installedAssembly } from './appAssembly';
import { validAppAssembly, validAssemblyMaterial } from './appAssemblySchema';
import { actAppBuild } from './appBuild';
import { customizedScrollbar, producedControlSide, producedScrollbarMaterial, producedWindowChrome } from './commonChrome';
import { createFixture } from './fixtures';
import { fittedPieces, migrateFittingProduction } from './workshopFitting';
import { commonDesignStyle } from '../worlds/AppComposition';
import { completionFeedback } from './workshopFeedback';
import { createComponentDesign } from './workshopState';

const now = 1_800_000_000_000;
function fittedFrame() {
 const state = createFixture('desktop-ready', now)!;
 const frame = migrateFittingProduction(state.run.workshop.parts['common-frame']!, 'common-frame', now);
 frame.fitting!.sockets.close = 'control-0';
 frame.fitting!.sockets.maximize = 'control-1';
 frame.fitting!.sockets.minimize = 'control-2';
 frame.elements = fittedPieces(frame, 'common-frame');
 state.run.workshop.parts['common-frame'] = frame;
 delete state.run.workshop.parts['common-scrollbar'];
 return state;
}

describe('はめた共通部品を実アプリへ採用する', () => {
 it('共有窪みに逆順ではめた記号とスクロールバーを採用時点で保存する', () => {
  let state = fittedFrame();
  const original = structuredClone(installedAssembly(state, 'files'));
  const current = producedWindowChrome(state)!;
  expect(current.symbols).toEqual(['close', 'maximize', 'minimize']);
  expect(current.symbols.map(symbol => producedControlSide(current, symbol))).toEqual(['end', 'end', 'end']);
  expect(installedAssembly(state, 'files')).toEqual(original);
  state = actAppBuild(state, { type: 'app-edit', app: 'files' });
  state = actAppBuild(state, { type: 'app-refresh', app: 'files' });
  state = actAppBuild(state, { type: 'app-install', app: 'files' });
  const installed = installedAssembly(state, 'files')!;
  expect(validAppAssembly(installed, 'files')).toBe(true);
  expect(producedWindowChrome(state, 'files')?.symbols).toEqual(['close', 'maximize', 'minimize']);
  expect(installed.common.find(part => part.source === 'common-frame')?.fitting?.sockets.close).toBe('control-0');
  expect(producedScrollbarMaterial(installed)?.source).toBe('common-frame');
  const frozen = structuredClone(installed);
  state.run.workshop.parts['common-frame']!.fitting!.sockets.close = 'control-2';
  expect(installedAssembly(state, 'files')).toEqual(frozen);
 });
 it('枠のスクロール設定が実アプリと保存画面の共通スタイルへ届き、旧作品は独立部品を維持する', () => {
  const state = fittedFrame(), frame = state.run.workshop.parts['common-frame']!;
  frame.design.scrollbarWidth = BALANCE.workshop.design.scrollbarMax;
  frame.design.arrows = false;
  const assembly = createAppAssembly(state, 'files');
  expect(customizedScrollbar(assembly)).toBe(true);
  expect(commonDesignStyle(assembly)).toMatchObject({
   '--app-common-scroll-width': `${BALANCE.workshop.design.scrollbarMax}px`,
   '--app-common-scroll-arrows': 'none',
  });
  const historical = structuredClone(installedAssembly(createFixture('desktop-ready', now)!, 'files')!);
  const historicalFrame=historical.common.find(material=>material.source==='common-frame')!;
  delete historicalFrame.fitting;historicalFrame.elements=historicalFrame.elements.filter(element=>element!=='scrollbar');
  historical.common=historical.common.filter(material=>material.source!=='common-scrollbar');
  historical.common.push({source:'common-scrollbar',elements:['track','thumb','arrows'],design:createComponentDesign()});
  expect(producedScrollbarMaterial(historical)?.source).toBe('common-scrollbar');
  expect(validAppAssembly(historical, 'files')).toBe(true);
 });
 it('完成後に外したピースも取得済み作品の保存を壊さず、不正な窪みは受け付けない', () => {
  const state = fittedFrame(), frame = state.run.workshop.parts['common-frame']!;
  delete frame.fitting!.sockets.close;
  frame.elements = fittedPieces(frame, 'common-frame');
  const assembly = createAppAssembly(state, 'files');
  expect(validAppAssembly(assembly, 'files')).toBe(true);
  const material = structuredClone(assembly.common.find(part => part.source === 'common-frame')!);
  material.fitting!.sockets.close = 'title';
  material.elements.push('close');
  expect(validAssemblyMaterial(material)).toBe(false);
 });
 it('最後のピースの1→4だけを完成演出として観測し、外し直しでは再発行しない', () => {
  const after = fittedFrame(), before = structuredClone(after);
  before.run.workshop.parts['common-frame']!.step = 1;
  before.run.workshop.parts['common-frame']!.completedAt = null;
  const event = completionFeedback(before, after, 'common-frame', 1, 100);
  expect(event).not.toBeNull();
  expect(event?.part).toBe('common-frame');
  expect(completionFeedback(after, structuredClone(after), 'common-frame', 2, 101)).toBeNull();
 });
});
