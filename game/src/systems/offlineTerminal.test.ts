import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { readCapture } from './captureScene';
import { actAppBuild,hasAppPart } from './appBuild';
import { actDesktop, activeScreenshots, screenshotCapacity, screenshotReward } from './desktop';
import { passivePixelsPerSecond } from './economy';
import { createFixture } from './fixtures';
import { encodeSave, decodeSave } from './save';
import { advanceOfflineTime } from './time';
import { actWorkshop } from './workshop';

const now = 1_800_000_000_000;
function automated() {
  const state = createFixture('desktop-ready', now)!;
  state.persistent.screenshots = [];
  state.run.desktop.cooldownMs = 0;
  state.run.desktop.terminal = { interval: 60_000, running: true, elapsedMs: 0, executions: 0, log: [] };
  state.run.desktop.reservation = null;
  return state;
}

describe('第3版：不在中のターミナル', () => {
  it('次回までの端数を保ち、各実行時刻までの生成を撮り、その後の生成を混ぜない', () => {
    const state = automated(), rate = passivePixelsPerSecond(state), reward = screenshotReward(state);
    state.run.desktop.terminal.elapsedMs = 15_000;
    const result = advanceOfflineTime(state, now + 120_000);
    expect(result.state.persistent.screenshots.map(shot => shot.at)).toEqual([now + 45_000, now + 105_000]);
    expect(result.state.run.desktop.terminal.elapsedMs).toBe(15_000);
    expect(result.state.run.desktop.terminal.executions).toBe(2);
    const [first, second] = result.state.persistent.screenshots.map(readCapture);
    expect(first!.display.resources.pixels - state.resources.pixels).toBeCloseTo(rate * 45, 2);
    expect(second!.display.resources.pixels - first!.display.resources.pixels).toBeCloseTo(rate * 60 + reward, 2);
    expect(result.pixels).toBeCloseTo(rate * 120 + reward * 2, 2);
  });

  it('ストレージの上限内だけ動き、満杯でも止まらず、履歴と撮影枚数を制限する', () => {
    const state = automated();
    const result = advanceOfflineTime(state, now + 24 * 3_600_000);
    expect(result.creditedMs).toBe(2 * 3_600_000);
    expect(result.capped).toBe(true);
    expect(activeScreenshots(result.state)).toHaveLength(screenshotCapacity(state));
    expect(result.state.run.desktop.terminal.executions).toBe(screenshotCapacity(state));
    expect(result.state.run.desktop.terminal.log).toHaveLength(BALANCE.w3.maxNoteLog);
    expect(result.state.run.desktop.terminal.log.at(-1)).toEqual({ at: now + 2 * 3_600_000, ok: false });
    expect(result.state.persistent.screenshots.at(-1)!.at).toBe(now + screenshotCapacity(state) * 60_000);
    expect(result.state.lastTickAt).toBe(now + 24 * 3_600_000);
  });

  it('同じ時刻・時計の巻き戻し・保存再開で命令や撮影報酬を重複させない', () => {
    const next = advanceOfflineTime(automated(), now + 120_000).state;
    const repeated = advanceOfflineTime(decodeSave(encodeSave(next)), now + 120_000).state;
    expect(repeated.resources).toEqual(next.resources);
    expect(repeated.persistent.screenshots).toEqual(next.persistent.screenshots);
    expect(repeated.run.desktop.terminal).toEqual(next.run.desktop.terminal);
    const backwards = advanceOfflineTime(repeated, now + 60_000).state;
    expect(backwards.resources).toEqual(next.resources);
    expect(backwards.persistent.screenshots).toEqual(next.persistent.screenshots);
  });

  it('停止中・命令パーツなし・保存失敗の代替計算では自動撮影を作らない', () => {
    const stopped = automated(); stopped.run.desktop.terminal.running = false;
    expect(advanceOfflineTime(stopped, now + 120_000).state.persistent.screenshots).toHaveLength(0);
    let missing = actAppBuild(automated(), { type:'app-edit', app:'terminal' });
    missing = actAppBuild(missing, { type:'app-remove', app:'terminal', part:'commands' });
    // Editing the draft must not disable the running app until it is installed.
    expect(hasAppPart(missing,'terminal','commands')).toBe(true);
    missing = actAppBuild(missing, { type:'app-install', app:'terminal' });
    expect(hasAppPart(missing,'terminal','commands')).toBe(false);
    expect(missing.run.workshop.parts['terminal-commands']!.step).toBe(4);
    const withoutCommands = advanceOfflineTime(missing, now + 120_000).state;
    expect(withoutCommands.persistent.screenshots).toHaveLength(0);
    expect(withoutCommands.run.desktop.terminal.executions).toBe(0);
    const fallback = advanceOfflineTime(automated(), now + 120_000, 'ja', false).state;
    expect(fallback.persistent.screenshots).toHaveLength(0);
    expect(fallback.run.desktop.terminal.executions).toBe(0);
  });

  it('不在の完成品エクスポートも一度だけ行い、繰り返してトークンを増やさない', () => {
    let state = automated();
    state.run.workshop = createFixture('stage8a-part-common-button-step-3-era0', now)!.run.workshop;
    state = actWorkshop(state, { type:'fitPiece', part:'common-button', piece:'label', socket:'label' }, now);
    expect(state.run.workshop.parts['common-button']!.step).toBe(4);
    expect(state.run.workshop.parts['common-button']!.exportedAt).toBeNull();
    state.run.play.terminalCommand = 'export';
    const first = advanceOfflineTime(state, now + 180_000).state;
    expect(first.run.workshop.parts['common-button']!.exportedAt).not.toBeNull();
    expect(first.resources.tokens).toBeGreaterThan(state.resources.tokens);
    expect(first.run.desktop.terminal.executions).toBe(1);
    expect(first.persistent.screenshots).toHaveLength(0);
    const later = advanceOfflineTime(first, now + 360_000).state;
    expect(later.resources.tokens).toBe(first.resources.tokens);
    expect(later.run.desktop.terminal.executions).toBe(1);
  });

  it('隠しの再配置命令も間隔ごとに動き、同じ不在の再計算では報酬を付けない', () => {
    const state = automated(), rate = passivePixelsPerSecond(state);
    state.persistent.progress.records['secret-clock'] = now;
    state.run.play.terminalCommand = 'refresh';
    const next = advanceOfflineTime(state, now + 180_000).state;
    expect(next.run.desktop.terminal.executions).toBe(3);
    expect(next.run.play.refreshAt).toBe(now + 180_000);
    // The new achievement changes the rate, so calculate it after granting the record.
    const adjustedRate = passivePixelsPerSecond(state);
    expect(adjustedRate).toBeGreaterThan(rate);
    expect(next.resources.pixels - state.resources.pixels).toBeCloseTo(adjustedRate * (180 + 3 * BALANCE.longPlay.refreshSeconds), 2);
    expect(advanceOfflineTime(next, now + 180_000).state.resources).toEqual(next.resources);
    expect(next.persistent.screenshots).toHaveLength(0);
  });

  it('予約と定期撮影を時刻順に実行し、予約だけの半額とクールダウンを保つ', () => {
    let state = automated();
    state = actDesktop(state, { type: 'reserve', at: now + 30_000 }, now, 'ja');
    const rate = passivePixelsPerSecond(state), reward = screenshotReward(state);
    const result = advanceOfflineTime(state, now + 60_000);
    expect(result.state.persistent.screenshots.map(shot => shot.at)).toEqual([now + 30_000, now + 60_000]);
    expect(result.state.run.desktop.reservation?.result).toBe('captured');
    expect(result.state.run.desktop.terminal.executions).toBe(1);
    expect(result.pixels).toBeCloseTo(rate * 60 + reward * (1 + BALANCE.w3.timerOfflineMultiplier), 2);
    const first = readCapture(result.state.persistent.screenshots[0]!);
    expect(first.display.resources.pixels - state.resources.pixels).toBeCloseTo(rate * 30, 2);
  });
});
