import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { passivePixelsPerSecond } from './economy';
import { createFixture } from './fixtures';
import { createInitialState } from './state';
import { advanceTime } from './time';

const hour = BALANCE.time.millisecondsPerHour;
const savedState = () => createFixture('foundation-saved', 1_000)!;

describe('時間と不在の計算', () => {
  it('生成手段がなければ不在でも資源は増えない', () => {
    const result = advanceTime(createInitialState(1_000), 1_000 + hour, 'offline');
    expect(result.pixels).toBe(0);
    expect(result.state.resources.pixels).toBe(0);
  });

  it('0.1秒刻みで計算し、端数の時間を次に持ち越す', () => {
    const first = advanceTime(savedState(), 1_250, 'active');
    expect(first.creditedMs).toBe(200);
    expect(first.pixels).toBeCloseTo(0.2);
    const second = advanceTime(first.state, 1_300, 'active');
    expect(second.state.resources.pixels).toBeCloseTo(0.3);
    expect(second.state.lastTickAt).toBe(1_300);
  });

  it('100msずつ進めてもまとめて進めても同じ結果になる', () => {
    let state = savedState();
    for (let i = 1; i <= 100; i++) state = advanceTime(state, 1_000 + i * 100, 'active').state;
    const once = advanceTime(savedState(), 11_000, 'active').state;
    expect(state.resources.pixels).toBeCloseTo(once.resources.pixels);
    expect(state.run.totalPixelsGenerated).toBeCloseTo(once.run.totalPixelsGenerated);
    expect(state.elapsedMs).toBe(once.elapsedMs);
  });

  it('不在中は100%で進み、初期ストレージでは2時間で止まる', () => {
    const result = advanceTime(savedState(), 1_000 + 3 * hour, 'offline');
    expect(result.creditedMs).toBe(2 * hour);
    expect(result.pixels).toBe(7_200);
    expect(result.capped).toBe(true);
    expect(result.state.run.totalPixelsGenerated).toBe(7_200);
    expect(result.state.lastTickAt).toBe(1_000 + 3 * hour);
    expect(advanceTime(result.state, 1_000 + 3 * hour, 'offline').pixels).toBe(0);
  });

  it.each([2, 4, 8, 12, 24])('ストレージ段階に応じて %i 時間まで進む', hours => {
    const state = savedState();
    state.persistent.specs.storage = BALANCE.spec.storage.findIndex(spec => spec.offlineHours === hours);
    const result = advanceTime(state, 1_000 + 48 * hour, 'offline');
    expect(result.creditedMs).toBe(hours * hour);
    expect(result.pixels).toBe(hours * 3_600);
  });

  it('時計を戻しても減らず、同じ時間を再び受け取れない', () => {
    const state = savedState();
    const result = advanceTime(state, 500, 'offline');
    expect(result.pixels).toBe(0);
    expect(result.state.lastTickAt).toBe(1_000);
    expect(advanceTime(result.state, 1_000, 'offline').pixels).toBe(0);
  });

  it('色深度・書体・リフレッシュレートを同じ自動生成式で計算する', () => {
    const state = savedState();
    state.run.seed.built.push('color', 'font');
    state.run.seed.autoCursors = 10;
    state.persistent.specs.color = 1;
    state.persistent.specs.refresh = 1;
    expect(passivePixelsPerSecond(state)).toBe(90);
    expect(advanceTime(state, 2_000, 'offline').pixels).toBe(90);
  });

  it('開いたままならストレージ上限を適用しない', () => {
    const result = advanceTime(savedState(), 1_000 + 3 * hour, 'active');
    expect(result.creditedMs).toBe(3 * hour);
    expect(result.capped).toBe(false);
  });
});
