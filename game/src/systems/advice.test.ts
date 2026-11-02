import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { advanceAdvice, createAdviceState, isAdviceState, nextAdvice, readAdvice } from './advice';
import { createFixture } from './fixtures';
import { createInitialState } from './state';
import { advanceActiveTime, advanceOfflineTime } from './time';

const now = 1_000_000;

describe('進み具合に合わせた助言', () => {
  it('試作版はカラー後にだけ話し、次の操作と案件の制約を選び分ける', () => {
    const state = createInitialState(now);
    expect(nextAdvice(state)).toBeNull();
    state.run.seed.built = ['border', 'save', 'color'];
    expect(nextAdvice(state)).toBe('seed-cursor');
    state.run.seed.autoCursors = 1;
    expect(nextAdvice(state)).toBe('seed-upgrade');
    state.run.seed.built.push('font', 'layout', 'motion');
    expect(nextAdvice(state)).toBe('seed-kumiki');
    state.run.version = 'v2'; state.run.seed.autoCursors = 0;
    state.run.play.contract = { id: 'no-cursors', status: 'active' };
    expect(nextAdvice(state)).toBe('seed-kumiki');
    expect(nextAdvice(createFixture('desktop-early', now)!)).toBe('desktop-apps');
    expect(nextAdvice(createFixture('release-ready', now)!)).toBe('editor-prototype');
  });

  it('能動時間が5分になるまで待ち、閉じた同じ助言を保存後も繰り返さない', () => {
    const state = createFixture('seed-color', now)!;
    let advice = advanceAdvice(createAdviceState(), state, 0);
    advice = advanceAdvice(advice, state, BALANCE.w2.hintMs - 1);
    expect(advice.current).toBeNull();
    advice = advanceAdvice(advice, state, 1);
    expect(advice.current).toBe('seed-upgrade');
    expect(advice.seen).toEqual(['seed-upgrade']);
    advice = JSON.parse(JSON.stringify(readAdvice(advice, null)));
    expect(isAdviceState(advice)).toBe(true);
    expect(advanceAdvice(advice, state, BALANCE.w2.hintMs).current).toBeNull();
    expect(readAdvice(advice, 'seed-upgrade').current).toBe('seed-upgrade');
    expect(readAdvice(advice, 'desktop-release')).toBe(advice);
  });

  it('手動操作や進行があれば待ちをやり直し、自動生成だけなら待ち続ける', () => {
    let state = createFixture('seed-color', now)!;
    let advice = advanceAdvice(createAdviceState(), state, 0);
    advice = advanceAdvice(advice, state, BALANCE.w2.hintMs / 2);
    state = advanceActiveTime(state, 1000).state;
    expect(advanceAdvice(advice, state, 1000).idleMs).toBe(advice.idleMs + 1000);
    state.run.seed.lastActionAt = state.elapsedMs;
    advice = advanceAdvice(advice, state, 1000);
    expect(advice.idleMs).toBe(0);
    expect(advice.current).toBeNull();
    state.run.seed.built.push('font', 'layout', 'motion');
    advice = advanceAdvice(advice, state, BALANCE.w2.hintMs);
    expect(advice.idleMs).toBe(0);
    expect(advanceAdvice(advice, state, BALANCE.w2.hintMs).current).toBe('seed-kumiki');
  });

  it('デスクトップのマウス操作で待ちをやり直し、時刻ではなく能動時間を使う', () => {
    let state = createFixture('desktop-early', now)!;
    let advice = advanceAdvice(createAdviceState(), state, 0);
    state = advanceActiveTime(state, BALANCE.w2.hintMs / 2).state;
    advice = advanceAdvice(advice, state, BALANCE.w2.hintMs / 2);
    expect(advice.idleMs).toBe(BALANCE.w2.hintMs / 2);
    state.run.desktop.idleMs = 0;
    advice = advanceAdvice(advice, state, 1);
    expect(advice.idleMs).toBe(0);
    state = advanceOfflineTime(state, now + 3_600_000).state;
    expect(advanceAdvice(advice, state, 0).current).toBeNull();
  });

  it('通知へマウスを動かしても消さず、別の履歴を開いて読める', () => {
    const state = createFixture('desktop-early', now)!;
    let memory = advanceAdvice(createAdviceState(), state, 0);
    memory = advanceAdvice(memory, state, BALANCE.w2.hintMs);
    expect(memory.current).toBe('desktop-apps');
    state.run.desktop.idleMs = 0; state.elapsedMs += 100;
    memory = advanceAdvice(memory, state, 100);
    expect(memory.current).toBe('desktop-apps');
    memory = { ...memory, seen: [...memory.seen, 'seed-upgrade'] };
    memory = readAdvice(memory, 'seed-upgrade');
    state.elapsedMs += 100;
    expect(advanceAdvice(memory, state, 100).current).toBe('seed-upgrade');
  });

  it('出荷中・作り直し・引き継ぎ中には新しい助言を出さない', () => {
    for (const name of ['release-complete', 'release-restarting', 'seed-inheriting']) {
      const state = createFixture(name, now)!;
      expect(nextAdvice(state)).toBeNull();
      const advice = advanceAdvice(createAdviceState(), state, BALANCE.w2.hintMs);
      expect(advice.current).toBeNull();
      expect(advice.idleMs).toBe(0);
    }
  });

  it('保存データの不正なID・重複・時刻を拒否し、異常な増分では時間を進めない', () => {
    const state = createFixture('seed-color', now)!;
    const advice = advanceAdvice(createAdviceState(), state, 0);
    for (const ms of [NaN, Infinity, -1]) expect(advanceAdvice(advice, state, ms)).toEqual(advice);
    expect(isAdviceState({ ...advice, seen: ['missing'] })).toBe(false);
    expect(isAdviceState({ ...advice, seen: ['seed-upgrade', 'seed-upgrade'] })).toBe(false);
    expect(isAdviceState({ ...advice, current: 'seed-upgrade' })).toBe(false);
    expect(isAdviceState({ ...advice, idleMs: Infinity })).toBe(false);
  });
});
