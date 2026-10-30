import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../config/balance';
import { createMemoryStorage } from './storage';
import { acquireTab } from './tab';
import type { TabLease } from './types';

const leases: TabLease[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  vi.stubGlobal('navigator', {});
});

afterEach(() => {
  leases.splice(0).forEach(lease => lease.release());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function acquire(storage: ReturnType<typeof createMemoryStorage>, onLost = () => {}) {
  const pending = acquireTab(storage, onLost);
  await vi.advanceTimersByTimeAsync(BALANCE.tab.settleMs);
  const lease = await pending;
  leases.push(lease);
  return lease;
}

describe('Web Locks がない環境のタブ所有権', () => {
  it('先に開いたタブを優先し、解放後は別のタブが取得できる', async () => {
    const storage = createMemoryStorage();
    const first = await acquire(storage);
    const second = await acquire(storage);
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    first.release();
    expect(first.isOwner()).toBe(false);
    const third = await acquire(storage);
    expect(third.isOwner()).toBe(true);
  });

  it('期限切れを引き継いだときは元のタブが所有権を失う', async () => {
    const storage = createMemoryStorage();
    const onLost = vi.fn();
    const first = await acquire(storage, onLost);
    // 裏のタブでタイマーが停止したケース。
    vi.setSystemTime(Date.now() + BALANCE.tab.leaseMs + 1);
    const second = await acquire(storage);
    expect(second.acquired).toBe(true);
    expect(first.isOwner()).toBe(false);
    await vi.advanceTimersByTimeAsync(BALANCE.tab.heartbeatMs);
    expect(onLost).toHaveBeenCalledOnce();
    first.release();
    expect(second.isOwner()).toBe(true);
  });

  it('同時に開いた候補が両方とも操作可能にはならない', async () => {
    const storage = createMemoryStorage();
    const first = acquireTab(storage, () => {});
    const second = acquireTab(storage, () => {});
    await vi.advanceTimersByTimeAsync(BALANCE.tab.settleMs);
    const results = await Promise.all([first, second]);
    leases.push(...results);
    expect(results.filter(lease => lease.acquired)).toHaveLength(1);
  });
});
