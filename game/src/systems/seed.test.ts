import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { creditPixels, manualClickValue, cursorPixelsPerSecond, passivePixelsPerSecond, seedPartsPixelsPerSecond } from './economy';
import { advanceSeedInstaller, applySeedSkills, buildSeed, canBuildSeed, createSeedVersion, cursorPrice, freshMomentum, momentumAt, pressSeed, readGuide, updateSeedGuide, visibleSeedItems } from './seed';
import { createInitialState, isGameState } from './state';
import { decodeSave, encodeSave } from './save';
import { advanceActiveTime } from './time';
import { createEditorCustomization } from './workshopState';

const now = 1_800_000_000_000;
const funded = () => creditPixels(createInitialState(now), 100_000);
function through(last: 'save' | 'color' | 'font' | 'layout' | 'motion' | 'bars' | 'workspace' | 'export') {
  let state = funded();
  for (const item of BALANCE.w1.items) { state = buildSeed(state, item.id, now); if (item.id === last) break; }
  return state;
}

describe('世界1は9つの部品を組み立てて工房を起動する', () => {
  it('カーソルを強制せず本線を進め、配置後の2つ先を表示しても順番を飛ばさない', () => {
    let state = funded();
    expect(visibleSeedItems(state)).toEqual(['border']);
    expect(buildSeed(state, 'save', now)).toBe(state);
    state = through('save');
    expect(visibleSeedItems(state)).toEqual(['color']);
    expect(canBuildSeed(state, 'cursor')).toBe(true);
    expect(buildSeed(state, 'color', now).run.seed.autoCursors).toBe(0);
    state = through('layout');
    expect(visibleSeedItems(state)).toEqual(['motion', 'bars']);
    expect(buildSeed(state, 'bars', now)).toBe(state);
    state = buildSeed(state, 'motion', now);
    expect(visibleSeedItems(state)).toEqual(['bars', 'workspace']);
  });

  it('9つの購入で工房を開き、共通4要素だけを出来合いにして完成ツールやトークンを渡さない', () => {
    const state = through('export');
    expect(state.run.seed.built).toEqual(['border', 'save', 'color', 'font', 'layout', 'motion', 'bars', 'workspace', 'export']);
    expect(state.run.world).toBe('kumiki');
    expect(state.run.workshop.entered).toBe(true);
    expect(state.run.workshop.enterMs).toBe(BALANCE.workshop.enterMs);
    expect(state.run.workshop.purchasedSets).toEqual(['common']);
    expect(Object.keys(state.run.workshop.parts)).toHaveLength(4);
    expect(state.run.workshop.groupPuzzle!.purchased).toEqual([]);expect(state.run.workshop.groupPuzzle!.shelf).toEqual([]);
    expect(state.persistent.setDocuments).toEqual([]);
    expect(state.resources.tokens).toBe(0);
    expect(buildSeed(state, 'export', now)).toBe(state);
    expect(advanceActiveTime(state, BALANCE.workshop.enterMs).state.run.workshop.enterMs).toBe(0);
    expect(isGameState(state)).toBe(true);
  });

  it('不足・二重購入・不正IDで資源を失わず、購入支出を生成累計に混ぜない', () => {
    const empty = createInitialState(now);
    expect(buildSeed(empty, 'border', now)).toBe(empty);
    expect(buildSeed(empty, 'missing' as 'border', now)).toBe(empty);
    const state = through('save');
    expect(state.resources.pixels).toBe(100_000 - BALANCE.w1.items.filter(item=>item.id==='border'||item.id==='save').reduce((sum,item)=>sum+item.cost,0));
    expect(state.run.totalPixelsGenerated).toBe(100_000);
    expect(buildSeed(state, 'border', now)).toBe(state);
  });

  it('完成部品はカーソル0台でも発電し、生成の経過時間だけ財布へ加わる', () => {
    const state = buildSeed(funded(), 'border', now);
    expect(state.run.seed.autoCursors).toBe(0);
    expect(seedPartsPixelsPerSecond(state)).toBe(BALANCE.w1.items[0].perSecond);
    expect(passivePixelsPerSecond(state)).toBeGreaterThan(0);
    const next = advanceActiveTime(state, 1_000).state;
    expect(next.resources.pixels - state.resources.pixels).toBeCloseTo(BALANCE.w1.items[0].perSecond);
    expect(next.run.totalPixelsGenerated - state.run.totalPixelsGenerated).toBeCloseTo(BALANCE.w1.items[0].perSecond);
  });

  it('クリックとカーソルの既存倍率・カーソル価格を保ち、旧ホームのボタン倍率は使わない', () => {
    let state = through('motion');
    expect(manualClickValue(state)).toBe(4);
    expect(cursorPixelsPerSecond(state)).toBe(3);
    expect(cursorPrice(state)).toBe(15);
    state = buildSeed(state, 'cursor', now);
    expect(cursorPrice(state)).toBe(18);
    state.persistent.specs.color = 1; state.persistent.specs.refresh = 1;
    expect(manualClickValue(state)).toBe(6);
    expect(cursorPixelsPerSecond(state)).toBe(9);
    state.resources.pixels = 17.99;
    expect(canBuildSeed(state, 'cursor')).toBe(false);
    state.resources.pixels = 18;
    expect(buildSeed(state, 'cursor', now).resources.pixels).toBe(0);
  });

  it('動きの作成前には勢いを付けず、作成後の連打だけ1.6倍になり2秒で戻る', () => {
    let state = through('save'), momentum = freshMomentum();
    for (let time = 0; time < 10; time++) {
      const pressed = pressSeed(state, momentum, time); state = pressed.state; momentum = pressed.momentum;
      expect(pressed.pixels).toBe(2);
    }
    state = through('motion'); momentum = freshMomentum();
    for (let time = 0; time < 100; time++) {
      const pressed = pressSeed(state, momentum, time); state = pressed.state; momentum = pressed.momentum;
    }
    expect(momentum.value).toBe(BALANCE.w1.momentum.max);
    expect(pressSeed(state, momentum, 100).pixels).toBeCloseTo(4 * BALANCE.w1.momentum.max);
    expect(momentumAt(momentum, 2_100)).toBe(1);
    expect(pressSeed(state, momentum, 2_100).pixels).toBe(4);
    expect(JSON.parse(encodeSave(state))).not.toHaveProperty('momentum');
  });

  it('色で一度だけ案内し、エクスポートが見える段階で道具の完成を案内する', () => {
    let state = through('color');
    expect(state.run.seed.guide.current).toBe('intro');
    state = readGuide(state, 'close');
    expect(updateSeedGuide(state).run.seed.guide.collapsed).toBe(true);
    state = readGuide(state, 'listen');
    expect(state.run.seed.guide.current).toBe('instructions');
    for (const id of ['font', 'layout', 'motion', 'bars'] as const) state = buildSeed(state, id, now);
    expect(state.run.seed.guide.current).toBe('tool');
    expect(decodeSave(encodeSave(state)).run.seed.guide.seen).toEqual(['intro', 'instructions', 'tool']);
  });

  it('引き継ぐのは選んだ設定だけで、9部品・カーソル・セットを無料で戻さない', () => {
    const previous = through('export');
    previous.persistent.seedSkills = ['inherit'];
    previous.run.seed.page.button = '#d0523a';
    previous.persistent.editorCustomization.accent = '#d0523a';
    previous.persistent.editorCustomization.bandPosition = 'bottom';
    previous.resources.dollars = 600; previous.resources.tokens = 20;
    const next = createSeedVersion(previous, 'v1', now + 1_000);
    expect(next.run.seed.built).toEqual([]); expect(next.run.seed.autoCursors).toBe(0); expect(next.run.seed.installer).toBeNull();
    expect(next.run.workshop.parts).toEqual({}); expect(next.run.workshop.purchasedSets).toEqual([]);
    expect(next.run.seed.page).toEqual(previous.run.seed.page);
    expect(next.persistent.editorCustomization).toEqual(previous.persistent.editorCustomization);
    expect(next.persistent.editorCustomization).not.toBe(previous.persistent.editorCustomization);
    expect(next.resources).toEqual({ pixels: 0, dollars: 600, tokens: 20 });
    expect(advanceSeedInstaller(next, 60_000).run.seed.built).toEqual([]);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    previous.persistent.seedSkills = [];
    const standard = createSeedVersion(previous, 'v1', now + 1_000);
    expect(standard.persistent.editorCustomization).toEqual(createEditorCustomization());
    expect(standard.run.seed.page.button).toBeNull();
  });

  it('スキルを不正な帯・不足資金で取得できず、正しく取得した設定だけを保つ', () => {
    const state = through('save');
    expect(applySeedSkills(state, ['inherit'], 'none', false)).toBe(state);
    state.run.version = 'v1'; state.resources.tokens = 12;
    const next = applySeedSkills(state, ['inherit'], 'none', false);
    expect(next.resources.tokens).toBe(0); expect(next.persistent.seedSkills).toEqual(['inherit']);
    expect(next.run.seed.built).toEqual(state.run.seed.built);
  });

  it('カラーなし案件の完了後は、工房で料金を払ってカラーだけを追加できる', () => {
    let state = funded(); state.run.version = 'v2'; state.run.play.contract = { id: 'no-color', status: 'active' };
    for (const item of BALANCE.w1.items) if (item.id !== 'color') state = buildSeed(state, item.id, now);
    expect(state.run.world).toBe('kumiki');
    state.run.play.contract = { id: 'no-color', status: 'complete' };
    const before = state.resources.pixels;
    const next = buildSeed(state, 'color', now);
    expect(next.run.world).toBe('kumiki');
    expect(next.run.seed.built).toContain('color');
    expect(next.resources.pixels).toBe(before - BALANCE.w1.items.find(item => item.id === 'color')!.cost);
    expect(cursorPixelsPerSecond(next) / cursorPixelsPerSecond(state)).toBe(BALANCE.w1.color_cursor_mult);
    expect(buildSeed(next, 'color', now)).toBe(next);
    const blocked = createInitialState(now); blocked.run.world = 'kumiki';
    expect(canBuildSeed(blocked, 'border')).toBe(false);
  });
});
