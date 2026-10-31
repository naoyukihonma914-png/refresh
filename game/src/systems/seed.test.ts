import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { creditPixels, manualClickValue, passivePixelsPerSecond } from './economy';
import { canBuildSeed, buildSeed, visibleSeedItems, cursorPrice, pressSeed, freshMomentum, momentumAt, readGuide, updateSeedGuide, applySeedSkills, createSeedVersion } from './seed';
import { createInitialState, isGameState } from './state';
import { advanceActiveTime, advanceOfflineTime } from './time';
import { decodeSave, encodeSave } from './save';
import { createFixture } from './fixtures';

const funded = () => creditPixels(createInitialState(1_000), 100_000);
function saved() { let state = funded(); state = buildSeed(state, 'border', 2_000); return buildSeed(state, 'save', 3_000); }
function evolved() { let state = saved(); state = buildSeed(state, 'cursor', 4_000); for (const id of ['color', 'font', 'layout', 'motion'] as const) state = buildSeed(state, id, 5_000); return state; }

describe('素の画面の生成・購入・ガイド', () => {
  it('次の1つ・保存後の最初のカーソル・配置後の2つ先を順に見せ、飛ばして購入できない', () => {
    let state = funded();
    expect(visibleSeedItems(state)).toEqual(['border']);
    expect(buildSeed(state, 'save', 0)).toBe(state);
    state = saved();
    expect(visibleSeedItems(state)).toEqual([]);
    expect(canBuildSeed(state, 'color')).toBe(false);
    state = buildSeed(state, 'cursor', 4_000);
    expect(visibleSeedItems(state)).toEqual(['color']);
    for (const id of ['color', 'font', 'layout'] as const) state = buildSeed(state, id, 5_000);
    expect(visibleSeedItems(state)).toEqual(['motion', 'kumiki']);
    expect(canBuildSeed(state, 'kumiki')).toBe(false);
    state = buildSeed(state, 'motion', 6_000);
    const completed = buildSeed(state, 'kumiki', 7_000);
    expect(completed.run.world).toBe('kumiki');
    expect(visibleSeedItems(completed)).toEqual([]);
    expect(buildSeed(completed, 'kumiki', 8_000)).toBe(completed);
    expect(completed.resources.tokens).toBe(0);
  });

  it('不足・二重購入・不正な購入で財布も累計も減らさない', () => {
    const empty = createInitialState(0);
    expect(buildSeed(empty, 'border', 0)).toBe(empty);
    const state = saved();
    expect(buildSeed(state, 'border', 0)).toBe(state);
    expect(state.run.totalPixelsGenerated).toBe(100_000);
    expect(state.resources.pixels).toBe(99_950);
  });

  it('手動生成と自動生成に枠線・書体・色・性能の倍率を適用し、カーソルを値上げする', () => {
    const state = evolved();
    expect(manualClickValue(state)).toBe(4);
    expect(passivePixelsPerSecond(state)).toBe(3);
    expect(cursorPrice(state)).toBe(18);
    state.persistent.specs.color = 1; state.persistent.specs.refresh = 1;
    expect(manualClickValue(state)).toBe(6);
    expect(passivePixelsPerSecond(state)).toBe(9);
    expect(buildSeed(state, 'cursor', 0).run.seed.autoCursors).toBe(2);
  });

  it('カーソルの値段は切り上げた整数にし、その額で購入判定して支払う', () => {
    const state = evolved();
    state.resources.pixels = 17.99;
    expect(canBuildSeed(state, 'cursor')).toBe(false);
    expect(buildSeed(state, 'cursor', 0)).toBe(state);
    state.resources.pixels = 18;
    const next = buildSeed(state, 'cursor', 0);
    expect(next.resources.pixels).toBe(0);
    expect(next.run.seed.autoCursors).toBe(2);
    expect(cursorPrice(next)).toBe(20);
    expect(next.run.totalPixelsGenerated).toBe(state.run.totalPixelsGenerated);
  });

  it('動きの前は勢いも増量もなく、動きの後だけ最大1.6倍・2秒で元に戻る', () => {
    let state = saved(); let momentum = freshMomentum();
    for (let now = 0; now < 10; now++) {
      const result = pressSeed(state, momentum, now);
      state = result.state; momentum = result.momentum;
      expect(result.pixels).toBe(2);
    }
    state = evolved(); momentum = freshMomentum();
    for (let now = 0; now < 100; now++) {
      const result = pressSeed(state, momentum, now);
      state = result.state; momentum = result.momentum;
    }
    expect(momentum.value).toBe(BALANCE.w1.momentum.max);
    expect(pressSeed(state, momentum, 1_599).pixels).toBeCloseTo(4.6);
    expect(momentumAt(momentum, 2_100)).toBe(1);
    expect(passivePixelsPerSecond(state)).toBe(3);
    expect(pressSeed(state, momentum, 2_100).pixels).toBe(4);
    expect(JSON.parse(encodeSave(state))).not.toHaveProperty('momentum');
  });

  it('色で一度だけ挨拶し、閉じても進み、2つ先に組木が見えた時点で案内する', () => {
    let state = saved();
    expect(state.run.seed.guide.seen).toEqual([]);
    state = buildSeed(state, 'cursor', 4_000);
    state = buildSeed(state, 'color', 5_000);
    expect(state.run.seed.guide.current).toBe('intro');
    state = readGuide(state, 'close');
    expect(updateSeedGuide(state).run.seed.guide.collapsed).toBe(true);
    state = readGuide(state, 'intro');
    state = readGuide(state, 'listen');
    expect(state.run.seed.guide.current).toBe('instructions');
    state = buildSeed(state, 'font', 6_000); state = buildSeed(state, 'layout', 7_000);
    expect(state.run.seed.guide.current).toBe('tool');
    expect(decodeSave(encodeSave(state)).run.seed.guide.seen).toEqual(['intro', 'instructions', 'tool']);
    expect(updateSeedGuide(state).run.seed.guide.seen).toHaveLength(3);
  });

  it('5分手が止まったときだけ助言し、留守の時間では出さない', () => {
    const quiet = saved();
    expect(advanceActiveTime(quiet, 300_000).state.run.seed.guide.seen).toEqual([]);
    const state = buildSeed(buildSeed(quiet, 'cursor', 4_000), 'color', 5_000);
    expect(advanceActiveTime(state, 299_900).state.run.seed.guide.seen).toEqual(['intro']);
    const after = advanceActiveTime(state, 300_000).state;
    expect(after.run.seed.guide.seen).toEqual(['intro', 'hint']);
    expect(updateSeedGuide(after).run.seed.guide.seen).toHaveLength(2);
    const offline = advanceOfflineTime(state, 5_000_000).state;
    expect(advanceActiveTime(offline, 100).state.run.seed.guide.seen).toEqual(['intro']);
  });
});

describe('素朴なページ設定と次のバージョンへの入口', () => {
  it('トークン不足・2周目帯の先取りを拒み、取得済みは再課金しない', () => {
    const first = evolved(); first.resources.tokens = 3;
    expect(applySeedSkills(first, ['keyboard', 'history', 'pattern'], 'dots', false)).toBe(first);
    expect(applySeedSkills(first, ['inherit'], 'none', false)).toBe(first);
    const next = applySeedSkills(first, ['keyboard', 'history'], 'none', false);
    expect(next.resources.tokens).toBe(1);
    expect(next.persistent.seedSkills).toEqual(['keyboard', 'history']);
    expect(applySeedSkills(next, ['keyboard', 'history'], 'none', false).resources.tokens).toBe(1);
  });

  it('遊び系だけをオン・オフにでき、取得した機能は外しても残る', () => {
    const state = evolved(); state.run.version = 'v1'; state.resources.tokens = 40;
    const next = applySeedSkills(state, ['pattern', 'marquee'], 'grid', true);
    expect(next.resources.tokens).toBe(28);
    expect(next.persistent.seedAppearance).toEqual({ pattern: 'grid', marquee: true });
    const off = applySeedSkills(next, [], 'none', false);
    expect(off.persistent.seedSkills).toEqual(['pattern', 'marquee']);
    expect(off.persistent.seedAppearance).toEqual({ pattern: 'none', marquee: false });
    expect(off.resources.tokens).toBe(28);
  });

  it('前回の構成だけを10秒で順に組み立て、保存・再開できる。カーソルと組木は引き継がない', () => {
    const previous = evolved(); previous.persistent.seedSkills = ['inherit'];
    let next = createSeedVersion(previous, 'v1', 10_000);
    expect(next.run.seed.built).toEqual([]);
    expect(canBuildSeed(next, 'border')).toBe(false);
    expect(pressSeed(next, freshMomentum(), 0).pixels).toBe(0);
    next = advanceActiveTime(next, 5_000).state;
    expect(next.run.seed.built).toEqual(['border', 'save', 'color']);
    next = decodeSave(encodeSave(next));
    next = advanceActiveTime(next, 5_000).state;
    expect(next.run.seed.built).toEqual(['border', 'save', 'color', 'font', 'layout', 'motion']);
    expect(next.run.seed.installer).toBeNull();
    expect(next.run.seed.autoCursors).toBe(0);
  });

  it('段階1の実際の第1版を変換し、元の資源・スペック・進捗を保つ。不正な旧データは拒む', () => {
    const state = evolved();
    const old = JSON.parse(encodeSave(state));
    old.schemaVersion = 1;
    old.run.seed = { built: state.run.seed.built, autoCursors: state.run.seed.autoCursors };
    delete old.persistent.seedSkills; delete old.persistent.seedAppearance;
    const migrated = decodeSave(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.resources).toEqual(state.resources);
    expect(migrated.persistent.specs).toEqual(state.persistent.specs);
    expect(migrated.run.seed.built).toEqual(state.run.seed.built);
    expect(migrated.run.seed.history).toEqual([]);
    delete old.run.seed;
    expect(() => decodeSave(JSON.stringify(old))).toThrow();
  });

  it('画面確認の固定状態をすべて保存できる', () => {
    for (const name of ['seed-start', 'seed-border', 'seed-saved', 'seed-color', 'seed-font', 'seed-layout', 'seed-motion', 'seed-complete', 'seed-return', 'seed-inheriting']) {
      const state = createFixture(name, 1_800_000_000_000)!;
      expect(isGameState(state), name).toBe(true);
    }
  });
});

it('付録Eと同じ2.5クリック/秒・買い物判断4秒・ガイド読了15秒で、組木を8〜14分で作れる', () => {
  let state = createInitialState(0);
  let momentum = freshMomentum();
  let time = 0; let nextClick = 0;
  const pause = (ms: number) => {
    for (let left = ms; left > 0; left -= 100) { time += 100; state = advanceActiveTime(state, 100).state; }
  };
  for (const item of BALANCE.w1.items) {
    while (!canBuildSeed(state, item.id)) {
      if (time > 14 * 60_000) throw new Error('進行が14分を超えた');
      while (canBuildSeed(state, 'cursor') && cursorPrice(state) < item.cost * 0.35) state = buildSeed(state, 'cursor', time);
      pause(100);
      if (time >= nextClick) {
        const result = pressSeed(state, momentum, time); state = result.state; momentum = result.momentum; nextClick = time + 400;
      }
    }
    state = buildSeed(state, item.id, time);
    pause(4_000);
    if (item.id === 'color') pause(30_000);
    if (item.id === 'motion') pause(15_000);
  }
  expect(time).toBeGreaterThanOrEqual(8 * 60_000);
  expect(time).toBeLessThanOrEqual(14 * 60_000);
  console.info(`段階2の自動プレイ: ${(time / 60_000).toFixed(2)}分 / ${state.run.seed.autoCursors}台`);
});
