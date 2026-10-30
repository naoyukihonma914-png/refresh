import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuntime } from './runtime';
import { BALANCE } from '../config/balance';
import { createFixture } from './fixtures';
import { createMemoryStorage, encodeSave, loadGame, SAVE_KEYS } from './save';

let storage: ReturnType<typeof createMemoryStorage>;
let runtime: GameRuntime;
let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  storage = createMemoryStorage();
  hidden = false;
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('document', { get hidden() { return hidden; } });
  vi.stubGlobal('navigator', { locks: { request: (_: string, __: unknown, callback: (lock: object) => Promise<void>) => callback({}) } });
});

afterEach(() => {
  runtime?.dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function start(query = '') {
  runtime = new GameRuntime(new URLSearchParams(query));
  await runtime.start();
}

describe('ブラウザの保存・時間処理の接続', () => {
  it('通常の開始と10秒ごとの処理では、保存解禁前にセーブしない', async () => {
    await start();
    vi.advanceTimersByTime(20_000);
    runtime.leave();
    expect(loadGame(storage).kind).toBe('empty');
    expect(runtime.getSnapshot().status).toBe('ready');
  });

  it('解禁直後と10秒ごとに保存する', async () => {
    await start();
    runtime.enableDebugSave();
    expect(loadGame(storage).kind).toBe('loaded');
    vi.advanceTimersByTime(BALANCE.time.autosaveMs);
    const saved = loadGame(storage);
    expect(saved.kind === 'loaded' && saved.state.resources.pixels).toBeCloseTo(10);
  });

  it('閉じて再開した不在分を保存し、再読み込みで重複付与しない', async () => {
    const state = createFixture('foundation-saved', 0)!;
    storage.setItem(SAVE_KEYS.primary, encodeSave(state));
    vi.setSystemTime(3 * BALANCE.time.millisecondsPerHour);
    await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    runtime.dispose();
    await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    expect(runtime.getSnapshot().offline).toBeNull();
  });

  it('裏のタブの時間を能動時間に混ぜず、復帰で1回だけ上限まで計算する', async () => {
    await start();
    runtime.enableDebugSave();
    hidden = true;
    runtime.visibilityChanged();
    vi.setSystemTime(10_000 + 3 * BALANCE.time.millisecondsPerHour);
    runtime.leave();
    hidden = false;
    runtime.visibilityChanged();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    expect(runtime.getSnapshot().offline?.capped).toBe(true);
    runtime.visibilityChanged();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
  });

  it('スリープなどで処理が止まった時間にも不在上限を適用する', async () => {
    await start();
    runtime.enableDebugSave();
    vi.setSystemTime(10_000 + 3 * BALANCE.time.millisecondsPerHour);
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    expect(runtime.getSnapshot().offline?.capped).toBe(true);
  });

  it.each(['leave', 'hide'])('スリープ直後の %s でも上限を越えて加算しない', async action => {
    await start();
    runtime.enableDebugSave();
    vi.setSystemTime(10_000 + 3 * BALANCE.time.millisecondsPerHour);
    if (action === 'leave') runtime.leave();
    else { hidden = true; runtime.visibilityChanged(); }
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
  });

  it('固定状態は実セーブを読まず、書き換えもしない', async () => {
    storage.setItem(SAVE_KEYS.primary, '実際の保存データ');
    await start('state=foundation-saved');
    runtime.addDebugPixels();
    runtime.persist();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(BALANCE.debug.addPixels);
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('実際の保存データ');
  });

  it('両方壊れた場合は確認待ちのまま保存・時間処理を止める', async () => {
    storage.setItem(SAVE_KEYS.primary, '壊れたデータ');
    await start();
    vi.advanceTimersByTime(20_000);
    runtime.persist();
    runtime.addDebugPixels();
    expect(runtime.getSnapshot().status).toBe('corrupt');
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('壊れたデータ');
    runtime.reset();
    expect(runtime.getSnapshot().status).toBe('ready');
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('不正な読み込みファイルで現在の状態を変えない', async () => {
    await start();
    runtime.enableDebugSave();
    const state = runtime.getSnapshot().state;
    expect(runtime.importData('{')).toBe(false);
    expect(runtime.getSnapshot().state).toEqual(state);
  });

  it('解禁前のデータを読み込んだ場合は、以前のセーブを復活させない', async () => {
    await start();
    const initial = runtime.exportData();
    runtime.enableDebugSave();
    expect(runtime.importData(initial)).toBe(true);
    expect(loadGame(storage).kind).toBe('empty');
  });
});
