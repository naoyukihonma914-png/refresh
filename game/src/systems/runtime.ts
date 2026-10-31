import { BALANCE, type SeedItem, type SeedSkill, type SpecKey } from '../config/balance';
import { chooseLanguage, createI18n, LOCALES, TEST_LANGUAGE, type MessageKey } from '../content/i18n';
import type { Platform, TabLease, Unsubscribe } from '../platform/types';
import { creditPixels } from './economy';
import { createFixture } from './fixtures';
import { clearGame, decodeSave, encodeSave, loadGame, saveGame } from './save';
import { canSave, createInitialState, type GameState } from './state';
import { advanceActiveTime, advanceOfflineTime, isInactiveGap, type TimeResult } from './time';
import { applySeedSkills, buildSeed, freshMomentum, pressSeed, readGuide } from './seed';
import type { GuideId } from './state';

export interface RuntimeSnapshot {
  state: GameState;
  language: string;
  status: 'starting' | 'ready' | 'blocked' | 'corrupt';
  notice: MessageKey | null;
  offline: Omit<TimeResult, 'state'> | null;
  press: { serial: number; pixels: number; momentum: number; at: number; x: number; y: number } | null;
}

function offlineNotice(result: TimeResult): RuntimeSnapshot['offline'] {
  const { state: _state, ...notice } = result;
  return result.creditedMs >= BALANCE.time.offlineNoticeMinMs && result.pixels >= 1 ? notice : null;
}

export class GameRuntime {
  private snapshot: RuntimeSnapshot;
  private listeners = new Set<() => void>();
  private stopTimer: Unsubscribe | undefined;
  private lease: TabLease | undefined;
  private lastAutosaveAt = 0;
  private lastActiveAt = 0;
  private activeRemainderMs = 0;
  private suspended = false;
  private disposed = false;
  private momentum = freshMomentum();
  private pressSerial = 0;
  readonly fixture: boolean;
  readonly platform: Platform;

  constructor(platform: Platform) {
    const now = platform.clock.wallNow();
    const fixture = createFixture(platform.launch.fixture, now);
    this.fixture = fixture !== null;
    this.platform = fixture ? platform.createPreview() : platform;
    const language = chooseLanguage(this.platform.settings.read().language, platform.preferredLanguages);
    this.snapshot = {
      state: fixture ?? createInitialState(now), language,
      status: 'starting', notice: null, offline: null, press: null,
    };
    this.platform.setDocumentLanguage(language, createI18n(language).direction);
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
    this.lease = await this.platform.tabs.acquire(() => {
      this.stopTimer?.();
      this.publish({ status: 'blocked' });
    });
    if (this.disposed) { this.lease.release(); return; }
    if (!this.lease.acquired) { this.publish({ status: 'blocked' }); return; }
    const loaded = this.fixture ? { kind: 'loaded' as const, state: this.snapshot.state }
      : loadGame(this.platform.storage);
    if (loaded.kind === 'corrupt') { this.publish({ status: 'corrupt' }); return; }
    const state = loaded.kind === 'loaded' || loaded.kind === 'recovered' ? loaded.state : this.snapshot.state;
    const result = advanceOfflineTime(state, this.platform.clock.wallNow());
    this.publish({
      state: result.state, status: 'ready',
      notice: loaded.kind === 'recovered' ? 'save.recovered'
        : loaded.kind === 'unavailable' ? 'save.storageUnavailable' : null,
      offline: loaded.kind !== 'empty' ? offlineNotice(result) : null,
    });
    this.lastActiveAt = this.platform.clock.monotonicNow();
    this.suspended = this.platform.visibility.isHidden();
    this.persist();
    this.startTimer();
  }

  private startTimer() {
    this.stopTimer?.();
    this.lastAutosaveAt = this.platform.clock.monotonicNow();
    this.stopTimer = this.platform.every(BALANCE.time.tickMs, () => {
      if (this.suspended || this.platform.visibility.isHidden() || !this.canOperate()) return;
      const before = this.snapshot.state.run.seed;
      const inactive = this.advanceForeground();
      const after = this.snapshot.state.run.seed;
      if (inactive || before.built.length !== after.built.length || before.guide.seen.length !== after.guide.seen.length
        || this.platform.clock.monotonicNow() - this.lastAutosaveAt >= BALANCE.time.autosaveMs) this.persist();
    });
  }

  private canOperate() {
    if (this.disposed || this.snapshot.status !== 'ready') return false;
    if (!this.lease?.isOwner()) {
      this.stopTimer?.();
      this.publish({ status: 'blocked' });
      return false;
    }
    return true;
  }

  private advanceForeground() {
    const now = this.platform.clock.monotonicNow();
    const wallNow = this.platform.clock.wallNow();
    const monotonicElapsed = Math.max(0, now - this.lastActiveAt);
    const wallElapsed = wallNow - this.snapshot.state.lastTickAt;
    const inactive = isInactiveGap(monotonicElapsed, wallElapsed);
    this.lastActiveAt = now;
    if (inactive) {
      this.momentum = freshMomentum();
      const result = advanceOfflineTime(this.snapshot.state, wallNow);
      this.publish({ state: result.state, offline: offlineNotice(result) });
    } else {
      const result = advanceActiveTime(this.snapshot.state, monotonicElapsed + this.activeRemainderMs);
      this.activeRemainderMs = result.remainderMs;
      this.publish({ state: { ...result.state, lastTickAt: wallNow } });
    }
    return inactive;
  }

  persist = () => {
    if (!this.canOperate()) return;
    if (!this.suspended) this.advanceForeground();
    const result = saveGame(this.platform.storage, this.snapshot.state, this.platform.clock.wallNow());
    this.lastAutosaveAt = this.platform.clock.monotonicNow();
    if (result.kind === 'saved') this.publish({ state: result.state });
    if (result.kind === 'failed') this.publish({ notice: 'save.failed' });
  };

  visibilityChanged = () => {
    if (!this.canOperate()) return;
    if (this.platform.visibility.isHidden()) {
      if (this.suspended) return;
      this.advanceForeground();
      this.suspended = true;
      this.momentum = freshMomentum();
      this.persist();
    } else if (this.suspended) {
      const result = advanceOfflineTime(this.snapshot.state, this.platform.clock.wallNow());
      this.publish({ state: result.state, offline: offlineNotice(result) });
      this.lastActiveAt = this.platform.clock.monotonicNow();
      this.suspended = false;
      this.persist();
    }
  };

  leave = () => { this.persist(); };

  dispose = () => {
    this.disposed = true;
    this.stopTimer?.();
    this.lease?.release();
  };

  changeLanguage = (language: string) => {
    if (!LOCALES[language] && !(this.platform.launch.debug && language === TEST_LANGUAGE)) return;
    if (this.canOperate() && !this.suspended && this.advanceForeground()) this.persist();
    const i18n = createI18n(language);
    this.platform.setDocumentLanguage(language, i18n.direction);
    const stored = language === TEST_LANGUAGE || this.platform.settings.write({ language });
    this.publish({ language, notice: stored ? this.snapshot.notice : 'settings.failed' });
  };

  reload = () => { this.platform.reload(); };

  pressSeed = (position = { x: 50, y: 50 }) => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    if (this.advanceForeground()) this.persist();
    const now = this.platform.clock.monotonicNow();
    const result = pressSeed(this.snapshot.state, this.momentum, now);
    this.momentum = result.momentum;
    this.publish({ state: result.state, press: { serial: ++this.pressSerial, pixels: result.pixels, momentum: result.momentum.value, at: now, ...position } });
  };

  buildSeed = (id: SeedItem | 'cursor') => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    const previous = this.snapshot.state;
    const state = buildSeed(previous, id, this.platform.clock.wallNow());
    if (state === previous) return;
    this.publish({ state });
    this.persist();
    if (id === 'kumiki') this.platform.unlockAchievement('kumiki-created');
  };

  readSeedGuide = (id: GuideId | 'close' | 'listen') => {
    if (!this.canOperate()) return;
    this.publish({ state: readGuide(this.snapshot.state, id) });
    this.persist();
  };

  applySeedSettings = (selected: readonly SeedSkill[], pattern: GameState['persistent']['seedAppearance']['pattern'], marquee: boolean) => {
    if (!this.canOperate()) return;
    this.advanceForeground();
    this.publish({ state: applySeedSkills(this.snapshot.state, selected, pattern, marquee) });
    this.persist();
  };

  // 段階1の動作確認用。通常画面には呼び出し口を置かない。
  addDebugPixels = () => {
    if (!this.canOperate()) return;
    this.advanceForeground();
    this.publish({ state: creditPixels(this.snapshot.state, BALANCE.debug.addPixels) });
    this.persist();
  };

  enableDebugSave = () => {
    if (!this.canOperate()) return;
    this.advanceForeground();
    const state = this.snapshot.state;
    if (canSave(state)) return;
    this.publish({ state: { ...state, run: { ...state.run, seed: { ...state.run.seed, built: ['border', 'save'], autoCursors: 1 } } } });
    this.persist();
  };

  changeDebugSpec = (key: SpecKey, level: number) => {
    if (!this.canOperate() || !Number.isInteger(level) || level < 0 || level >= BALANCE.spec[key].length) return;
    this.advanceForeground();
    const state = this.snapshot.state;
    this.publish({ state: { ...state, persistent: { ...state.persistent, specs: { ...state.persistent.specs, [key]: level } } } });
    this.persist();
  };

  exportData = () => encodeSave(this.snapshot.state);

  downloadData = () => {
    if (!this.canOperate()) return;
    this.persist();
    this.platform.files.write(createI18n(this.snapshot.language).t('data.filename'), this.exportData());
  };

  requestImport = async () => {
    if (!this.canOperate()) return;
    try {
      const raw = await this.platform.files.read();
      if (raw !== null && this.platform.confirm(createI18n(this.snapshot.language).t('confirm.import'))) this.importData(raw);
    } catch { this.publish({ notice: 'data.importFailed' }); }
  };

  importData = (raw: string) => {
    if (!this.canOperate()) return false;
    try {
      const state = decodeSave(raw);
      const result = advanceOfflineTime(state, this.platform.clock.wallNow());
      if (!canSave(state) && !clearGame(this.platform.storage)) throw new Error('Storage unavailable');
      this.activeRemainderMs = 0;
      this.momentum = freshMomentum();
      this.lastActiveAt = this.platform.clock.monotonicNow();
      this.publish({ state: result.state, offline: offlineNotice(result), notice: null, press: null });
      this.persist();
      return true;
    } catch {
      this.publish({ notice: 'data.importFailed' });
      return false;
    }
  };

  requestReset = (corrupt = false) => {
    const { t } = createI18n(this.snapshot.language);
    if (corrupt ? this.platform.confirm(t('confirm.corruptReset'))
      : this.platform.confirm(t('confirm.reset')) && this.platform.confirm(t('confirm.resetAgain'))) this.reset();
  };

  reset = () => {
    if (this.disposed || !this.lease?.isOwner()) return;
    if (this.snapshot.status !== 'ready' && this.snapshot.status !== 'corrupt') return;
    if (!clearGame(this.platform.storage)) { this.publish({ notice: 'save.failed' }); return; }
    this.publish({ state: createInitialState(this.platform.clock.wallNow()), status: 'ready', notice: null, offline: null, press: null });
    this.momentum = freshMomentum();
    this.activeRemainderMs = 0;
    this.lastActiveAt = this.platform.clock.monotonicNow();
    this.suspended = this.platform.visibility.isHidden();
    this.startTimer();
  };
}
