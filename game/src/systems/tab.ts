import { BALANCE } from '../config/balance';
import type { SaveStorage } from './save';

const LOCK_NAME = 'refresh.active-tab';
const LEASE_KEY = 'refresh.active-tab.lease';

export type TabLease = { acquired: boolean; isOwner: () => boolean; release: () => void };

// Web Locks は先に開いたタブを優先する。古いブラウザは期限つきリースに退避。
export async function acquireTab(
  storage: SaveStorage,
  onLost: () => void,
): Promise<TabLease> {
  if (navigator.locks) {
    return new Promise(resolve => {
      let release: () => void;
      let released = false;
      const held = new Promise<void>(done => { release = done; });
      void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async lock => {
        resolve({ acquired: lock !== null, isOwner: () => lock !== null && !released, release: () => { released = true; release(); } });
        if (lock) await held;
      }).catch(() => { resolve(acquireFallback(storage, onLost)); });
    });
  }
  return acquireFallback(storage, onLost);
}

interface Lease { id: string; expiresAt: number }

function readLease(storage: SaveStorage): Lease | null {
  const raw = storage.getItem(LEASE_KEY);
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw) as Partial<Lease>;
    return typeof data.id === 'string' && typeof data.expiresAt === 'number'
      && Number.isFinite(data.expiresAt) ? data as Lease : null;
  } catch { return null; }
}

async function acquireFallback(storage: SaveStorage, onLost: () => void): Promise<TabLease> {
  const id = crypto.randomUUID();
  try {
    const current = readLease(storage);
    if (current && current.expiresAt > Date.now()) return { acquired: false, isOwner: () => false, release() {} };
    const renew = () => storage.setItem(LEASE_KEY, JSON.stringify({ id, expiresAt: Date.now() + BALANCE.tab.leaseMs }));
    renew();
    await new Promise(resolve => setTimeout(resolve, BALANCE.tab.settleMs));
    if (readLease(storage)?.id !== id) return { acquired: false, isOwner: () => false, release() {} };
    let released = false;
    const heartbeat = setInterval(() => {
      try {
        if (readLease(storage)?.id !== id) {
          clearInterval(heartbeat);
          released = true;
          onLost();
        } else renew();
      } catch { clearInterval(heartbeat); onLost(); }
    }, BALANCE.tab.heartbeatMs);
    return {
      acquired: true,
      isOwner: () => {
        try { return !released && readLease(storage)?.id === id; } catch { return false; }
      },
      release() {
        clearInterval(heartbeat);
        if (!released) {
          try { if (readLease(storage)?.id === id) storage.removeItem(LEASE_KEY); } catch { /* 保存不可 */ }
        }
        released = true;
      },
    };
  } catch {
    // 保存領域を使えない場合も画面は動かし、保存失敗をランタイムが知らせる。
    return { acquired: true, isOwner: () => true, release() {} };
  }
}
