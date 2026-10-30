import { BALANCE, type SpecKey } from '../config/balance';
import { SCRIPT } from '../content/script';
import { creditPixels } from './economy';
import { createFixture } from './fixtures';
import { clearGame, createMemoryStorage, decodeSave, encodeSave, loadGame, saveGame, type SaveStorage } from './save';
import { canSave, createInitialState, type GameState } from './state';
import { acquireTab, type TabLease } from './tab';
import { advanceTime, type TimeResult } from './time';

export interface RuntimeSnapshot {
  state: GameState;
  status: 'starting' | 'ready' | 'blocked' | 'corrupt';
  notice: string | null;
  offline: Omit<TimeResult, 'state'> | null;
}

function offlineNotice(result: TimeResult): RuntimeSnapshot['offline'] {
  return result.creditedMs >= BALANCE.time.offlineNoticeMinMs && result.pixels >= 1 ? result : null;
}

export class GameRuntime {
  private snapshot: RuntimeSnapshot;
  private storage: SaveStorage;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lease: TabLease | undefined;
  private lastAutosaveAt = Date.now();
  private suspended = false;
  private disposed = false;
  readonly fixture: boolean;

  constructor(params: URLSearchParams) {
    const now = Date.now();
    const fixture = createFixture(params.get('state'), now);
    this.fixture = fixture !== null;
    // localStorage の取得自体が拒否されるブラウザにも対応する。
    this.storage = fixture ? createMemoryStorage() : {
      getItem: key => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: key => localStorage.removeItem(key),
    };
    this.snapshot = { state: fixture ?? createInitialState(now), status: 'starting', notice: null, offline: null };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;

  private publish(update: Partial<RuntimeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach(listener => listener());
  }

  async start() {
    if (this.disposed) return;
    this.lease = this.fixture ? { acquired: true, isOwner: () => true, release() {} }
      : await acquireTab(this.storage, () => {
        this.stopTimer();
        this.publish({ status: 'blocked' });
      });
    if (this.disposed) { this.lease.release(); return; }
    if (!this.lease.acquired) { this.publish({ status: 'blocked' }); return; }
    const loaded = this.fixture ? { kind: 'loaded' as const, state: this.snapshot.state } : loadGame(this.storage);
    if (loaded.kind === 'corrupt') { this.publish({ status: 'corrupt' }); return; }
    let state = loaded.kind === 'loaded' || loaded.kind === 'recovered' ? loaded.state : this.snapshot.state;
    const result = advanceTime(state, Date.now(), 'offline');
    state = result.state;
    this.publish({
      state, status: 'ready',
      notice: loaded.kind === 'recovered' ? SCRIPT.recoveredSave
        : loaded.kind === 'unavailable' ? SCRIPT.storageUnavailable : null,
      offline: loaded.kind !== 'empty' ? offlineNotice(result) : null,
    });
    // 再読み込みを繰り返しても不在分を重複付与しない。
    this.persist();
    this.suspended = document.hidden;
    this.startTimer();
  }

  private startTimer() {
    this.stopTimer();
    this.lastAutosaveAt = Date.now();
    this.timer = setInterval(() => {
      if (this.suspended || document.hidden || !this.canOperate()) return;
      const now = Date.now();
      if (this.advanceForeground(now)) this.persist();
      if (now - this.lastAutosaveAt >= BALANCE.time.autosaveMs) this.persist();
    }, BALANCE.time.tickMs);
  }

  private stopTimer() { if (this.timer !== undefined) clearInterval(this.timer); }

  private canOperate() {
    if (this.disposed || this.snapshot.status !== 'ready') return false;
    if (!this.lease?.isOwner()) {
      this.stopTimer();
      this.publish({ status: 'blocked' });
      return false;
    }
    return true;
  }

  private advanceForeground(now: number) {
    const mode = now - this.snapshot.state.lastTickAt > BALANCE.time.activeGapMs ? 'offline' : 'active';
    const result = advanceTime(this.snapshot.state, now, mode);
    if (result.creditedMs > 0) this.publish({ state: result.state });
    if (mode === 'offline') this.publish({ offline: offlineNotice(result) });
    return mode === 'offline';
  }

  persist = () => {
    if (!this.canOperate()) return;
    const now = Date.now();
    const result = saveGame(this.storage, this.snapshot.state, now);
    this.lastAutosaveAt = now;
    if (result.kind === 'saved') this.publish({ state: result.state });
    if (result.kind === 'failed') this.publish({ notice: SCRIPT.saveFailed });
  };

  visibilityChanged = () => {
    if (!this.canOperate()) return;
    const now = Date.now();
    if (document.hidden) {
      this.advanceForeground(now);
      this.suspended = true;
      this.persist();
    } else if (this.suspended) {
      const result = advanceTime(this.snapshot.state, now, 'offline');
      this.publish({ state: result.state, offline: offlineNotice(result) });
      this.suspended = false;
      this.persist();
    }
  };

  leave = () => {
    if (!this.canOperate()) return;
    // 非表示中の残りを能動時間として進めず、そのまま保存する。
    if (!this.suspended) this.advanceForeground(Date.now());
    this.persist();
  };

  dispose = () => {
    this.disposed = true;
    this.stopTimer();
    this.lease?.release();
  };

  // 段階1の動作確認用。通常画面には呼び出し口を置かない。
  addDebugPixels = () => {
    if (!this.canOperate()) return;
    this.publish({ state: creditPixels(this.snapshot.state, BALANCE.debug.addPixels) });
    this.persist();
  };

  enableDebugSave = () => {
    if (!this.canOperate()) return;
    const state = this.snapshot.state;
    if (canSave(state)) return;
    this.publish({ state: { ...state, run: { ...state.run, seed: { built: ['border', 'save'], autoCursors: 1 } } } });
    this.persist();
  };

  changeDebugSpec = (key: SpecKey, level: number) => {
    if (!this.canOperate() || !Number.isInteger(level) || level < 0 || level >= BALANCE.spec[key].length) return;
    // 変更する前の区間は変更前の性能で精算する。
    this.advanceForeground(Date.now());
    const state = this.snapshot.state;
    this.publish({ state: { ...state, persistent: { ...state.persistent, specs: { ...state.persistent.specs, [key]: level } } } });
    this.persist();
  };

  exportData = () => encodeSave(this.snapshot.state);

  importData = (raw: string) => {
    if (!this.canOperate()) return false;
    try {
      const state = decodeSave(raw);
      if (!canSave(state) && !clearGame(this.storage)) throw new Error('保存領域を消去できません');
      const result = advanceTime(state, Date.now(), 'offline');
      this.publish({ state: result.state, offline: offlineNotice(result), notice: null });
      this.persist();
      return true;
    } catch {
      this.publish({ notice: SCRIPT.importFailed });
      return false;
    }
  };

  reset = () => {
    if (this.disposed || !this.lease?.isOwner()) return;
    if (this.snapshot.status !== 'ready' && this.snapshot.status !== 'corrupt') return;
    if (!clearGame(this.storage)) { this.publish({ notice: SCRIPT.saveFailed }); return; }
    this.publish({ state: createInitialState(Date.now()), status: 'ready', notice: null, offline: null });
    this.suspended = document.hidden;
    this.startTimer();
  };
}
