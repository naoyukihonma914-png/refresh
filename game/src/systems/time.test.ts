import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { passivePixelsPerSecond } from './economy';
import { createFixture } from './fixtures';
import { createInitialState } from './state';
import { advanceActiveTime, advanceOfflineTime, isInactiveGap } from './time';

const hour = BALANCE.time.millisecondsPerHour;
const savedState = () => createFixture('foundation-saved', 1_000)!;

describe('能動時間と不在時間', () => {
  it('処理停止と時計の差を設定値で判定し、小さな誤差や負の差では停止としない', () => {
    const { inactivityGapMs: gap, clockDriftToleranceMs: drift } = BALANCE.time;
    expect(isInactiveGap(gap, gap)).toBe(true);
    expect(isInactiveGap(100, 3 * hour)).toBe(true);
    expect(isInactiveGap(gap - 1, gap - 1)).toBe(false);
    expect(isInactiveGap(gap - 1, gap - 1 + drift / 2)).toBe(false);
    expect(isInactiveGap(100, -hour)).toBe(false);
  });
  it('生成手段がなければ不在でも資源は増えない', () => {
    expect(advanceOfflineTime(createInitialState(1_000), 1_000 + hour).pixels).toBe(0);
  });

  it('能動時間は0.1秒刻みで計算し、端数を返す', () => {
    const first = advanceActiveTime(savedState(), 250);
    expect(first.creditedMs).toBe(200);
    expect(first.pixels).toBeCloseTo(0.2);
    const second = advanceActiveTime(first.state, 50 + first.remainderMs);
    expect(second.state.resources.pixels).toBeCloseTo(0.3);
    expect(second.remainderMs).toBe(0);
    expect(second.state.lastTickAt).toBe(1_000);
  });

  it('100msずつ進めてもまとめて進めても同じ結果になる', () => {
    let state = savedState();
    for (let i = 0; i < 100; i++) state = advanceActiveTime(state, 100).state;
    const once = advanceActiveTime(savedState(), 10_000).state;
    expect(state.resources.pixels).toBeCloseTo(once.resources.pixels);
    expect(state.run.totalPixelsGenerated).toBeCloseTo(once.run.totalPixelsGenerated);
    expect(state.elapsedMs).toBe(once.elapsedMs);
  });

  it('不在中は100%で進み、初期ストレージでは2時間で止まる', () => {
    const result = advanceOfflineTime(savedState(), 1_000 + 3 * hour);
    expect(result.creditedMs).toBe(2 * hour);
    expect(result.pixels).toBe(7_200);
    expect(result.capped).toBe(true);
    expect(result.state.run.totalPixelsGenerated).toBe(7_200);
    expect(advanceOfflineTime(result.state, 1_000 + 3 * hour).pixels).toBe(0);
  });

  it.each([2, 4, 8, 12, 24])('ストレージ段階に応じて %i 時間まで進む', hours => {
    const state = savedState();
    state.persistent.specs.storage = BALANCE.spec.storage.findIndex(spec => spec.offlineHours === hours);
    const result = advanceOfflineTime(state, 1_000 + 48 * hour);
    expect(result.creditedMs).toBe(hours * hour);
    expect(result.pixels).toBe(hours * 3_600);
  });

  it('負の不在時間は0とし、次の不在は現在の時計から測る', () => {
    const result = advanceOfflineTime(savedState(), 500);
    expect(result.pixels).toBe(0);
    expect(result.state.lastTickAt).toBe(500);
    expect(advanceOfflineTime(result.state, 500).pixels).toBe(0);
    expect(advanceOfflineTime(result.state, 1_500).pixels).toBe(1);
  });

  it('色深度・書体・リフレッシュレートを共通の自動生成式で計算する', () => {
    const state = savedState();
    state.run.seed.built.push('color', 'font');
    state.run.seed.autoCursors = 10;
    state.persistent.specs.color = 1;
    state.persistent.specs.refresh = 1;
    expect(passivePixelsPerSecond(state)).toBe(90);
    expect(advanceActiveTime(state, 1_000).pixels).toBe(90);
    expect(advanceOfflineTime(state, 2_000).pixels).toBe(90);
  });

  it('能動時間には不在の上限も端末時計の値も影響しない', () => {
    const state = savedState();
    state.lastTickAt = 10 * hour;
    const result = advanceActiveTime(state, 3 * hour);
    expect(result.creditedMs).toBe(3 * hour);
    expect(result.pixels).toBe(10_800);
    expect(result.capped).toBe(false);
  });
});
