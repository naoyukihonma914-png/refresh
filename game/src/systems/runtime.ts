import { VIEWPORT } from './viewport';
import { hasDesktopSkill } from './desktopJobs';
import { actDesktop, observeTesseraAction, activeScreenshots, screenshotCapacity, takeScreenshot, type DesktopAction } from './desktop';
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
import { actKumiki, enterKumiki, type KumikiAction } from './kumiki';
import { archiveGuide, beginPrototypeRelease, buySpec, canReleasePrototype, shippingComplete, startNextVersion } from './release';

export interface RuntimeSnapshot {
  state: GameState;
  frozenRate?: number;
  tesseraIntent?:{serial:number;kind:'color'|'drawing'};
  shotHintSerial?: number;
  language: string;
  status: 'starting' | 'ready' | 'blocked' | 'corrupt';
  notice: MessageKey | null;
  offline: Omit<TimeResult, 'state'> | null;
  introVisible: boolean;
  releaseConfirmation: boolean;
  press: { serial: number; pixels: number; momentum: number; at: number; x: number; y: number; target: 'primary' | 'button' } | null;
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
      status: 'starting', notice: null, offline: null, press: null, introVisible: false, releaseConfirmation: false,
    };
    this.platform.setDocumentLanguage(language, createI18n(language).direction);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;

  private publish(update: Partial<RuntimeSnapshot>) {
    const before=this.snapshot.state.run.world==='desktop'?this.snapshot.state.run.desktop.screen:VIEWPORT;
    this.snapshot = { ...this.snapshot, ...update };
    const after=this.snapshot.state.run.world==='desktop'?this.snapshot.state.run.desktop.screen:VIEWPORT;
    if(before.width!==after.width||before.height!==after.height)this.platform.viewport.logicalSizeChanged({width:after.width,height:after.height});
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
    const initialSize=this.snapshot.state.run.world==='desktop'?this.snapshot.state.run.desktop.screen:VIEWPORT;
    this.platform.viewport.logicalSizeChanged({width:initialSize.width,height:initialSize.height});
    const loaded = this.fixture ? { kind: 'loaded' as const, state: this.snapshot.state }
      : loadGame(this.platform.storage);
    if (loaded.kind === 'corrupt') { this.publish({ status: 'corrupt' }); return; }
    let state = loaded.kind === 'loaded' || loaded.kind === 'recovered' ? loaded.state : this.snapshot.state;
    if (!this.fixture && state.run.seed.built.includes('kumiki') && !state.run.kumiki.entered) state = enterKumiki(state);
    state = { ...state, persistent: { ...state.persistent, numberNotation: this.platform.settings.read().numberNotation ?? state.persistent.numberNotation } };
    const result = this.durableTime(state,advanceOfflineTime(state, this.platform.clock.wallNow(),this.snapshot.language),()=>advanceOfflineTime(state,this.platform.clock.wallNow(),this.snapshot.language,false));
    this.publish({
      state: result.state, status: 'ready',
      notice: this.snapshot.notice==='save.failed'?'save.failed':loaded.kind === 'recovered' ? 'save.recovered'
        : loaded.kind === 'unavailable' ? 'save.storageUnavailable' : null,
      offline: loaded.kind !== 'empty' ? offlineNotice(result) : null,
      introVisible: this.platform.launch.fixture === 'intro' || !this.fixture && (loaded.kind === 'empty' || loaded.kind === 'unavailable'),
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
      const wasShippingComplete = shippingComplete(this.snapshot.state);
      const inactive = this.advanceForeground();
      const after = this.snapshot.state.run.seed;
      if (inactive || before.built.length !== after.built.length || before.guide.seen.length !== after.guide.seen.length
        || !wasShippingComplete && shippingComplete(this.snapshot.state)
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
    if (this.snapshot.introVisible) {
      this.publish({ state: { ...this.snapshot.state, lastTickAt: wallNow } });
      return false;
    }
    if (inactive) {
      this.momentum = freshMomentum();
      const before=this.snapshot.state;
      const result = this.durableTime(before,advanceOfflineTime(before, wallNow,this.snapshot.language),()=>advanceOfflineTime(before,wallNow,this.snapshot.language,false));
      this.publish({ state: result.state, offline: offlineNotice(result) });
    } else {
      const before=this.snapshot.state,duration=monotonicElapsed+this.activeRemainderMs;
      const result = this.durableTime(before,advanceActiveTime(before,duration,this.snapshot.language),()=>advanceActiveTime(before,duration,this.snapshot.language,false));
      this.activeRemainderMs = result.remainderMs;
      this.publish({state:{...result.state,lastTickAt:wallNow}});
    }
    return inactive;
  }

  private durableTime(before:GameState,result:TimeResult,withoutCaptures:()=>TimeResult):TimeResult {
    if(result.state.persistent.screenshots===before.persistent.screenshots)return result;
    const saved=saveGame(this.platform.storage,result.state,this.platform.clock.wallNow());
    if(saved.kind==='saved')return {...result,state:saved.state};
    this.publish({notice:'save.failed'});
    const fallback=withoutCaptures();
    return {...fallback,state:{...fallback.state,run:{...fallback.state.run,desktop:{...fallback.state.run.desktop,terminal:{...fallback.state.run.desktop.terminal,running:false}}}}};
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
      const before=this.snapshot.state;
      const result = this.durableTime(before,advanceOfflineTime(before, this.platform.clock.wallNow(),this.snapshot.language),()=>advanceOfflineTime(before,this.platform.clock.wallNow(),this.snapshot.language,false));
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
    const stored = language === TEST_LANGUAGE || this.platform.settings.write({ ...this.platform.settings.read(), language });
    this.publish({ language, notice: stored ? this.snapshot.notice : 'settings.failed' });
  };

  reload = () => { this.platform.reload(); };

  startGame = () => {
    if (!this.canOperate() || !this.snapshot.introVisible) return;
    this.lastActiveAt = this.platform.clock.monotonicNow();
    this.activeRemainderMs = 0;
    this.publish({ introVisible: false, state: { ...this.snapshot.state, lastTickAt: this.platform.clock.wallNow() } });
  };

  pressSeed = (position: { x: number; y: number; target?: 'primary' | 'button' } = { x: 50, y: 50 }) => {
    if (!this.canOperate() || this.snapshot.state.run.world === 'release' || this.snapshot.introVisible || this.suspended || this.platform.visibility.isHidden()) return;
    const desktop = this.snapshot.state.run.desktop;
    if (this.snapshot.state.run.world === 'desktop' && (desktop.active !== 'tessera' || desktop.windows.tessera.minimized || !desktop.windows.tessera.open)) return;
    if (this.advanceForeground()) this.persist();
    const now = this.platform.clock.monotonicNow();
    const result = pressSeed(this.snapshot.state, this.momentum, now);
    if (result.state === this.snapshot.state) return;
    this.momentum = result.momentum;
    this.publish({ state: result.state, press: { serial: ++this.pressSerial, pixels: result.pixels, momentum: result.momentum.value, at: now, ...position, target: position.target ?? 'primary' } });
  };

  buildSeed = (id: SeedItem | 'cursor') => {
    if (!this.canOperate() || this.snapshot.introVisible || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    const previous = this.snapshot.state;
    const state = buildSeed(previous, id, this.platform.clock.wallNow());
    if (state === previous) return;
    this.publish({ state });
    this.persist();
    if (id === 'kumiki') this.platform.unlockAchievement('kumiki-created');
  };

  actKumiki = (action: KumikiAction) => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    const previous = this.snapshot.state;
    const state = observeTesseraAction(previous, actKumiki(previous, action, this.platform.clock.wallNow()), action.type, this.platform.clock.wallNow());
    if (previous === state) return;
    this.publish({ state });
    if (action.type !== 'paint' && action.type !== 'fill') this.persist();
  };

  actDesktop = (action: DesktopAction) => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    const state = actDesktop(this.snapshot.state, action, this.platform.clock.wallNow(),this.snapshot.language);
    if (state === this.snapshot.state) return;
    const request=action.type==='fix'?state.run.desktop.feedback.find(f=>f.id===action.id):null;
    this.publish({state,...(request?.kind==='screenshot'?{shotHintSerial:(this.snapshot.shotHintSerial??0)+1}:{}),...(request&&hasDesktopSkill(state,'direct')&&['color','redraw','practice'].includes(request.kind)?{tesseraIntent:{serial:(this.snapshot.tesseraIntent?.serial??0)+1,kind:request.kind==='color'?'color':'drawing'}}:{})});
    if (action.type !== 'rect' && action.type !== 'icon' && action.type !== 'note') this.persist();
  };

  desktopActivity = () => { if(this.canOperate()&&this.snapshot.state.run.world==='desktop'&&this.snapshot.state.run.desktop.idleMs>0)this.publish({state:actDesktop(this.snapshot.state,{type:'activity'},this.platform.clock.wallNow())}); };

  takeScreenshot = () => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return false;
    this.advanceForeground();
    if (activeScreenshots(this.snapshot.state).length >= screenshotCapacity(this.snapshot.state)) {
      this.publish({ notice: 'desktop.storageFull' }); return false;
    }
    return this.commitReleaseChange(takeScreenshot(this.snapshot.state, this.platform.clock.wallNow(), this.snapshot.language));
  };

  readSeedGuide = (id: GuideId | 'close' | 'listen') => {
    if (!this.canOperate()) return;
    this.publish({ state: readGuide(this.snapshot.state, id) });
    this.persist();
  };

  applySeedSettings = (selected: readonly SeedSkill[], pattern: GameState['persistent']['seedAppearance']['pattern'], marquee: boolean) => {
    if (!this.canOperate() || this.snapshot.state.run.world === 'release') return;
    this.advanceForeground();
    this.publish({ state: applySeedSkills(this.snapshot.state, selected, pattern, marquee) });
    this.persist();
  };

  // 段階1の動作確認用。通常画面には呼び出し口を置かない。
  addDebugPixels = () => {
    if (!this.canOperate() || this.snapshot.state.run.world === 'release') return;
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
      const result = advanceOfflineTime(state,this.platform.clock.wallNow(),this.snapshot.language);
      if (canSave(state)||state.persistent.products.length>0) {
        const saved=saveGame(this.platform.storage,result.state,this.platform.clock.wallNow(),{checkpoint:true});
        if(saved.kind!=='saved')throw new Error('Storage unavailable');
        result.state=saved.state;
      } else if(!clearGame(this.platform.storage))throw new Error('Storage unavailable');
      this.activeRemainderMs = 0;
      this.momentum = freshMomentum();
      this.lastActiveAt = this.platform.clock.monotonicNow();
      this.publish({ state: result.state, offline: offlineNotice(result), notice: null, press: null, introVisible: false, releaseConfirmation: false });
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
    this.publish({ state: createInitialState(this.platform.clock.wallNow()), status: 'ready', notice: null, offline: null, press: null, introVisible: true, releaseConfirmation: false });
    this.momentum = freshMomentum();
    this.activeRemainderMs = 0;
    this.lastActiveAt = this.platform.clock.monotonicNow();
    this.suspended = this.platform.visibility.isHidden();
    this.startTimer();
  };

  requestPrototypeRelease = () => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    if (!canReleasePrototype(this.snapshot.state)) return;
    this.publish({ releaseConfirmation: true, state: archiveGuide(this.snapshot.state, { kind: 'release', id: 'confirm', version: 'v0.1' }) });
    this.persist();
  };

  setProductName = (name: string) => {
    if (!this.canOperate() || this.snapshot.state.run.world === 'release') return;
    const productName = [...name].slice(0, BALANCE.release.maxProductName).join('') || null;
    this.publish({ state: { ...this.snapshot.state, persistent: { ...this.snapshot.state.persistent, productName } } });
  };

  setNumberNotation = (numberNotation: 'compact' | 'scientific') => {
    if (!this.canOperate() || !['compact','scientific'].includes(numberNotation)) return;
    const stored = this.platform.settings.write({ ...this.platform.settings.read(), numberNotation });
    this.publish({ state: { ...this.snapshot.state, persistent: { ...this.snapshot.state.persistent, numberNotation } }, notice: stored ? this.snapshot.notice : 'settings.failed' });
    this.persist();
  };

  cancelPrototypeRelease = () => { if (this.canOperate()) this.publish({ releaseConfirmation: false }); };

  private commitReleaseChange(state: GameState, checkpoint = false): boolean {
    if (!this.canOperate() || state === this.snapshot.state) return false;
    const result = saveGame(this.platform.storage, state, this.platform.clock.wallNow(), { checkpoint });
    if (result.kind !== 'saved') { this.publish({ notice: 'save.failed' }); return false; }
    this.publish({ state: result.state, notice: null });
    this.lastAutosaveAt = this.platform.clock.monotonicNow();
    return true;
  }

  confirmPrototypeRelease = () => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden() || !this.snapshot.releaseConfirmation) return;
    this.advanceForeground();
    const before = saveGame(this.platform.storage, this.snapshot.state, this.platform.clock.wallNow());
    if (before.kind !== 'saved') { this.publish({ notice: 'save.failed' }); return; }
    this.publish({ state: before.state });
    const state = beginPrototypeRelease({ ...before.state, persistent: { ...before.state.persistent, productName: before.state.persistent.productName?.trim() || null } }, this.platform.clock.wallNow(), this.platform.animation.reducedMotion());
    if (!this.commitReleaseChange(state)) return;
    this.momentum = freshMomentum();
    this.publish({ releaseConfirmation: false, press: null, offline: null });
    this.platform.unlockAchievement('prototype-released');
  };

  purchaseSpec = (key: SpecKey) => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    this.commitReleaseChange(buySpec(this.snapshot.state, key));
  };

  startNextVersion = () => {
    if (!this.canOperate() || this.suspended || this.platform.visibility.isHidden()) return;
    this.advanceForeground();
    if (!this.commitReleaseChange(startNextVersion(this.snapshot.state, this.platform.clock.wallNow()), true)) return;
    this.momentum = freshMomentum(); this.activeRemainderMs = 0;
    this.lastActiveAt = this.platform.clock.monotonicNow();
    this.publish({ press: null, offline: null, introVisible: false, releaseConfirmation: false });
  };
}
