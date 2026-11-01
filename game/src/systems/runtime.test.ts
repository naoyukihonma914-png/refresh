import {seedCursorQuote} from './seed';
import {passivePixelsPerSecond} from './economy';
import {globalMultiplier} from './longPlay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuntime } from './runtime';
import { BALANCE } from '../config/balance';
import { TEST_LANGUAGE } from '../content/i18n';
import { createFixture } from './fixtures';
import { createMemoryStorage, createSettingsStorage, SETTINGS_KEY } from '../platform/storage';
import type { Platform } from '../platform/types';
import { encodeSave, loadGame, SAVE_KEYS } from './save';

const hour = BALANCE.time.millisecondsPerHour;
let storage: ReturnType<typeof createMemoryStorage>;
let runtime: GameRuntime;
let platform: Platform;
let clock: { wall: number; mono: number; hidden: boolean; owned: boolean };

function makePlatform(target = storage): Platform {
  return {
    audio:{play:vi.fn(),dispose:vi.fn()},storage: target, settings: createSettingsStorage(target), launch: { debug: true, fixture: null },
    preferredLanguages: ['ja-JP'],
    clock: { wallNow: () => clock.wall, monotonicNow: () => clock.mono },
    tabs: { acquire: vi.fn(async () => ({ acquired: clock.owned, isOwner: () => clock.owned, release() {} })) },
    visibility: { isHidden: () => clock.hidden, subscribe: () => () => {} },
    viewport: { logicalSizeChanged:vi.fn(),size: () => ({ width: 1920, height: 1080 }), subscribe: () => () => {} },
    lifecycle: { onLeave: () => () => {}, onRestore: () => () => {} },
    files: { write: vi.fn(), read: vi.fn(async () => null) },
    animation: { subscribe: () => () => {}, reducedMotion: () => false },
    keyboard: { subscribe: () => () => {} },
    every(ms, callback) { const timer = setInterval(callback, ms); return () => clearInterval(timer); },
    confirm: vi.fn(() => true), reload: vi.fn(), setDocumentLanguage: vi.fn(),
    setFullscreen: vi.fn(async () => false), quit: vi.fn(() => false), unlockAchievement: vi.fn(),
    createPreview: () => makePlatform(createMemoryStorage()),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  storage = createMemoryStorage();
  clock = { wall: 1_800_000_000_000, mono: 0, hidden: false, owned: true };
  platform = makePlatform();
});

afterEach(() => { runtime?.dispose(); vi.useRealTimers(); });

async function start() { runtime = new GameRuntime(platform); await runtime.start(); runtime.startGame(); }

function step(ms: number, wallDelta = ms) {
  clock.wall += wallDelta - ms;
  for (let remaining = ms; remaining > 0;) {
    const delta = Math.min(remaining, BALANCE.time.tickMs);
    clock.mono += delta;
    clock.wall += delta;
    vi.advanceTimersByTime(delta);
    remaining -= delta;
  }
}

describe('制作ノートからの開始', () => {
  it('新規だけに表示し、読む時間と開始前の生成をゲームの進行へ加えない', async () => {
    runtime = new GameRuntime(platform); await runtime.start();
    expect(runtime.getSnapshot().introVisible).toBe(true);
    step(300_000); runtime.pressSeed(); runtime.buildSeed('border'); runtime.leave();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    expect(runtime.getSnapshot().state.elapsedMs).toBe(0);
    expect(loadGame(storage).kind).toBe('empty');
    runtime.startGame(); runtime.pressSeed();
    expect(runtime.getSnapshot().introVisible).toBe(false);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(1);
    runtime.dispose(); runtime = new GameRuntime(platform); await runtime.start();
    expect(runtime.getSnapshot().introVisible).toBe(true);
  });

  it('セーブ後の再開やv1以降には表示せず、初期化するとまた表示する', async () => {
    for (const version of ['v0.1', 'v1', 'v2'] as const) {
      const saved = createFixture('foundation-saved', clock.wall)!; saved.run.version = version;
      storage.setItem(SAVE_KEYS.primary, encodeSave(saved));
      runtime = new GameRuntime(platform); await runtime.start();
      expect(runtime.getSnapshot().introVisible).toBe(false);
      runtime.dispose();
    }
    runtime = new GameRuntime(platform); await runtime.start(); runtime.reset();
    expect(runtime.getSnapshot().introVisible).toBe(true);
    expect(loadGame(storage).kind).toBe('empty');
  });
});

describe('プラットフォームを通した保存・時間処理', () => {
  it('保存解禁前は10秒ごとの処理でも保存しない', async () => {
    await start(); step(20_000); runtime.leave();
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('解禁直後と単調時計で10秒ごとに保存する', async () => {
    await start(); runtime.enableDebugSave();
    expect(loadGame(storage).kind).toBe('loaded');
    step(10_000);
    const saved = loadGame(storage);
    expect(saved.kind === 'loaded' && saved.state.resources.pixels).toBeCloseTo(10.199);
  });

  it('端末時計を戻しても能動時間と自動保存は止まらない', async () => {
    await start(); runtime.enableDebugSave();
    step(10_000, -hour);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(10.199);
    const saved = loadGame(storage);
    expect(saved.kind === 'loaded' && saved.state.resources.pixels).toBeCloseTo(10.199);
    expect(runtime.getSnapshot().offline).toBeNull();
    step(1_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(11.219);
  });

  it('単調時計が進まない長い停止も端末時計の差から検出し、上限まで保存する', async () => {
    await start(); runtime.enableDebugSave();
    clock.wall += 3 * hour;
    clock.mono += 100;
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_272);
    expect(runtime.getSnapshot().offline?.capped).toBe(true);
    const saved = loadGame(storage);
    expect(saved.kind === 'loaded' && saved.state.resources.pixels).toBe(7_272);
    step(1_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(7_273.02);
  });

  it('開いたまま3時間処理が止まった場合は2時間分だけ加算し、次の処理で重ねない', async () => {
    await start(); runtime.enableDebugSave();
    clock.wall += 3 * hour; clock.mono += 3 * hour;
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_272);
    runtime.persist();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_272);
    runtime.dispose(); await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_272);
  });

  it('短い処理遅れは能動時間として計算し、留守の知らせを出さない', async () => {
    await start(); runtime.enableDebugSave();
    const elapsed = BALANCE.time.inactivityGapMs - BALANCE.time.tickMs;
    clock.wall += elapsed; clock.mono += elapsed;
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(elapsed / 1_000*(1+BALANCE.longPlay.achievementBonus));
    expect(runtime.getSnapshot().offline).toBeNull();
  });

  it('長い停止の端末時計差が負でも0で再開し、その後の能動生成は続く', async () => {
    await start(); runtime.enableDebugSave();
    clock.wall -= hour; clock.mono += 3 * hour;
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    step(1_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(1.019);
  });

  it('持っているストレージの上限を開いたままの停止にも適用する', async () => {
    await start(); runtime.enableDebugSave(); runtime.changeDebugSpec('storage', 1);
    clock.wall += 6 * hour; clock.mono += 6 * hour;
    vi.advanceTimersByTime(100);
    expect(runtime.getSnapshot().state.resources.pixels).toBe(14_544);
  });

  it('端数の能動時間は複数回の保存をまたいで残る', async () => {
    await start(); runtime.enableDebugSave();
    clock.mono += 50; runtime.persist();
    clock.mono += 50; runtime.persist();
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(0.1);
  });

  it('再開した不在分を保存し、再読み込みで重複付与しない', async () => {
    const state = createFixture('foundation-saved', clock.wall - 3 * hour)!;
    storage.setItem(SAVE_KEYS.primary, encodeSave(state));
    await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    runtime.dispose(); await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_200);
    expect(runtime.getSnapshot().offline).toBeNull();
  });

  it('裏のタブは端末時計で上限まで計算し、復帰時に単調時計の基準を更新する', async () => {
    await start(); runtime.enableDebugSave();
    clock.hidden = true; runtime.visibilityChanged();
    clock.wall += 3 * hour; clock.mono += 3 * hour;
    runtime.leave();
    clock.hidden = false; runtime.visibilityChanged();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(7_272);
    expect(runtime.getSnapshot().offline?.capped).toBe(true);
    step(1_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(7_273.02);
  });

  it('不在中に時計が戻っても0扱いで復帰し、能動生成は続く', async () => {
    await start(); runtime.enableDebugSave();
    clock.hidden = true; runtime.visibilityChanged();
    clock.wall -= hour; clock.mono += 3_000;
    clock.hidden = false; runtime.visibilityChanged();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    step(1_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(1.019);
  });

  it('固定状態の保存と言語設定は実データに影響しない', async () => {
    storage.setItem(SAVE_KEYS.primary, '実際の保存データ');
    platform.settings.write({ language: 'ja' });
    platform.launch.fixture = 'foundation-saved';
    await start(); runtime.addDebugPixels(); runtime.changeLanguage('en');
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('実際の保存データ');
    expect(platform.settings.read().language).toBe('ja');
  });

  it('両方壊れた場合は確認待ちのまま書き込みと時間を止める', async () => {
    storage.setItem(SAVE_KEYS.primary, '壊れたデータ');
    await start(); step(20_000); runtime.persist(); runtime.addDebugPixels();
    expect(runtime.getSnapshot().status).toBe('corrupt');
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('壊れたデータ');
    runtime.requestReset(true);
    expect(runtime.getSnapshot().status).toBe('ready');
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('不正な読み込みファイルで現在の状態を変えない', async () => {
    await start(); runtime.enableDebugSave();
    const state = runtime.getSnapshot().state;
    expect(runtime.importData('{')).toBe(false);
    expect(runtime.getSnapshot().state).toEqual(state);
    expect(runtime.getSnapshot().notice).toBe('data.importFailed');
  });

  it('解禁前のデータを読み込んだら以前のセーブを復活させない', async () => {
    await start(); const initial = runtime.exportData(); runtime.enableDebugSave();
    expect(runtime.importData(initial)).toBe(true);
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('書き出しはプラットフォームの窓口を呼ぶ', async () => {
    await start(); runtime.downloadData();
    expect(platform.files.write).toHaveBeenCalledWith('画面の保存データ.json', runtime.exportData());
  });

  it('読み込みの確認を取り消したら現在のデータを変えない', async () => {
    await start(); runtime.enableDebugSave();
    vi.mocked(platform.files.read).mockResolvedValue(runtime.exportData());
    vi.mocked(platform.confirm).mockReturnValue(false);
    const state = runtime.getSnapshot().state;
    await runtime.requestImport();
    expect(runtime.getSnapshot().state).toEqual(state);
  });

  it('初期化は2回確認し、2回目の取り消しでも記録を残す', async () => {
    await start(); runtime.enableDebugSave();
    vi.mocked(platform.confirm).mockReturnValueOnce(true).mockReturnValueOnce(false);
    runtime.requestReset();
    expect(platform.confirm).toHaveBeenCalledTimes(2);
    expect(loadGame(storage).kind).toBe('loaded');
    runtime.requestReset();
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('後から開いたタブは停止し、読み直しは窓口を呼ぶ', async () => {
    clock.owned = false;
    await start(); runtime.addDebugPixels(); runtime.reload();
    expect(runtime.getSnapshot().status).toBe('blocked');
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    expect(platform.reload).toHaveBeenCalledOnce();
  });

  it('言語は進捗の保存前から設定として保存され、次の起動で使われる', async () => {
    await start(); runtime.changeLanguage('en');
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull();
    expect(loadGame(storage).kind).toBe('empty');
    runtime.dispose(); await start();
    expect(runtime.getSnapshot().language).toBe('en');
  });

  it('試験用の言語は開発用でだけ選べ、通常の言語設定を上書きしない', async () => {
    await start(); runtime.changeLanguage('en'); runtime.changeLanguage(TEST_LANGUAGE);
    expect(runtime.getSnapshot().language).toBe(TEST_LANGUAGE);
    expect(platform.settings.read().language).toBe('en');
    platform.launch.debug = false;
    runtime.dispose(); await start(); runtime.changeLanguage(TEST_LANGUAGE);
    expect(runtime.getSnapshot().language).toBe('en');
  });
});

describe('段階2の操作と保存', () => {
  it('実際の生成と購入で保存を解禁し、購入直後の値を保存する', async () => {
    await start();
    for (let i = 0; i < 10; i++) runtime.pressSeed();
    runtime.buildSeed('border');
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(.09);
    expect(loadGame(storage).kind).toBe('empty');
    for (let i = 0; i < 20; i++) runtime.pressSeed();
    runtime.buildSeed('save');
    const saved = loadGame(storage);
    expect(saved.kind).toBe('loaded');
    if (saved.kind === 'loaded') {
      expect(saved.state.run.seed.built).toEqual(['border', 'save']);
      expect(saved.state.run.seed.history.map(entry => entry.item)).toEqual(['border', 'save']);
      expect(saved.state.resources.pixels).toBeCloseTo(.49);
    }
    for (let i = 0; i < 8; i++) runtime.pressSeed();
    runtime.buildSeed('cursor');
    step(2_000);
    expect(runtime.getSnapshot().state.resources.pixels).toBeCloseTo(3.85);
  });

  it('タブの所有権を失った後は生成・購入・設定が動かない', async () => {
    await start(); runtime.addDebugPixels();
    const previous = runtime.getSnapshot().state;
    clock.owned = false;
    runtime.pressSeed(); runtime.buildSeed('border'); runtime.applySeedSettings(['keyboard'], 'none', false);
    expect(runtime.getSnapshot().state).toBe(previous);
    expect(runtime.getSnapshot().status).toBe('blocked');
  });

  it('組木の購入と世界2の開始を保存し、実績を1回だけ知らせる', async () => {
    const fixture = createFixture('seed-motion', clock.wall)!;
    storage.setItem(SAVE_KEYS.primary, encodeSave(fixture));
    await start();vi.mocked(platform.unlockAchievement).mockClear(); runtime.buildSeed('kumiki'); runtime.buildSeed('kumiki');
    expect(platform.unlockAchievement).toHaveBeenCalledExactlyOnceWith('kumiki-created');
    expect(runtime.getSnapshot().state.run.world).toBe('kumiki');
    expect(runtime.getSnapshot().state.run.seed.built).toContain('kumiki');
    const saved = loadGame(storage);
    expect(saved.kind === 'loaded' && saved.state.run.seed.built.includes('kumiki')).toBe(true);
  });

  it('勢いを保存・読み込み・タブ復帰へ持ち越さない', async () => {
    const fixture = createFixture('seed-motion', clock.wall)!;
    storage.setItem(SAVE_KEYS.primary, encodeSave(fixture));
    await start();
    for (let i = 0; i < 20; i++) runtime.pressSeed();
    expect(runtime.getSnapshot().press?.momentum).toBe(1.6);
    const raw = runtime.exportData();
    runtime.importData(raw); runtime.pressSeed();
    expect(runtime.getSnapshot().press?.momentum).toBe(1);
    for (let i = 0; i < 20; i++) runtime.pressSeed();
    clock.hidden = true; runtime.visibilityChanged();
    clock.hidden = false; runtime.visibilityChanged(); runtime.pressSeed();
    expect(runtime.getSnapshot().press?.momentum).toBe(1);
  });
});

describe('出荷の保存と再開', () => {
  const prepare = async () => {
    storage.setItem(SAVE_KEYS.primary, encodeSave(createFixture('release-ready', clock.wall)!));
    await start();vi.mocked(platform.unlockAchievement).mockClear();
  };

  it('確認を取り消して作業へ戻れ、承認後だけ出荷する。再読み込み・再押下で二重に入金しない', async () => {
    await prepare();
    const before = runtime.getSnapshot().state.resources;
    runtime.requestPrototypeRelease();
    expect(runtime.getSnapshot().releaseConfirmation).toBe(true);
    runtime.cancelPrototypeRelease();
    expect(runtime.getSnapshot().state.resources).toEqual(before);
    runtime.requestPrototypeRelease(); runtime.confirmPrototypeRelease(); runtime.confirmPrototypeRelease();
    expect(runtime.getSnapshot().state.run.world).toBe('release');
    expect(runtime.getSnapshot().state.resources.dollars).toBe(303);
    expect(platform.unlockAchievement).toHaveBeenCalledExactlyOnceWith('prototype-released');
    step(2_400); runtime.leave();
    runtime.dispose(); clock.wall += 3 * hour;
    await start();
    expect(runtime.getSnapshot().state.run.shipping!.elapsedMs).toBe(2_400);
    expect(runtime.getSnapshot().state.resources.dollars).toBe(303);
    expect(runtime.getSnapshot().offline).toBeNull();
    step(5_600); runtime.purchaseSpec('color'); runtime.purchaseSpec('storage');
    expect(runtime.getSnapshot().state.resources.dollars).toBe(43);
    runtime.startNextVersion(); runtime.startNextVersion();
    expect(runtime.getSnapshot().state.run.version).toBe('v1');
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    runtime.dispose(); await start();
    expect(runtime.getSnapshot().introVisible).toBe(false);
    expect(runtime.getSnapshot().state.persistent.products).toHaveLength(1);
    expect(runtime.getSnapshot().state.persistent.specs.color).toBe(1);
    expect(runtime.getSnapshot().state.persistent.specs.storage).toBe(1);
  });

  it.each([1, 2])('出荷の前後の保存（%i回目）が失敗したら元の構成を残し、再試行で一度だけ入金する', async failAt => {
    await prepare(); runtime.requestPrototypeRelease();
    const write = storage.setItem; let writes = 0;
    storage.setItem = (key, value) => {
      if (key === SAVE_KEYS.primary && ++writes === failAt) throw new Error('Quota exceeded');
      write(key, value);
    };
    runtime.confirmPrototypeRelease();
    expect(runtime.getSnapshot().notice).toBe('save.failed');
    expect(runtime.getSnapshot().state.run.world).toBe('kumiki');
    expect(runtime.getSnapshot().state.resources.dollars).toBe(0);
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state.run.world).toBe('kumiki');
    storage.setItem = write; runtime.confirmPrototypeRelease();
    expect(runtime.getSnapshot().state.resources.dollars).toBe(303);
    expect(runtime.getSnapshot().state.persistent.products).toHaveLength(1);
  });

  it('リセット直後の保存が失敗したら出荷画面を保ち、再試行後はセーブ未作成でもv1の記録が残る', async () => {
    await prepare(); runtime.requestPrototypeRelease(); runtime.confirmPrototypeRelease();
    step(8_000); runtime.purchaseSpec('color');
    const write = storage.setItem;
    storage.setItem = (key, value) => { if (key === SAVE_KEYS.primary) throw new Error('Quota exceeded'); write(key, value); };
    runtime.startNextVersion();
    expect(runtime.getSnapshot().state.run.world).toBe('release');
    expect(runtime.getSnapshot().notice).toBe('save.failed');
    storage.setItem = write; runtime.startNextVersion();
    const checkpoint = loadGame(storage);
    expect(checkpoint.kind === 'loaded' && checkpoint.state.run.version).toBe('v1');
    step(1_000); runtime.pressSeed();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(1.62);
    runtime.dispose(); await start();
    expect(runtime.getSnapshot().state.resources.pixels).toBe(0);
    expect(runtime.getSnapshot().state.persistent.products).toHaveLength(1);
  });

  it('タブの所有権を失ったら出荷と性能購入を止める', async () => {
    await prepare(); runtime.requestPrototypeRelease(); clock.owned = false;
    runtime.confirmPrototypeRelease(); runtime.purchaseSpec('color');
    expect(runtime.getSnapshot().status).toBe('blocked');
    expect(runtime.getSnapshot().state.resources.dollars).toBe(0);
    expect(platform.unlockAchievement).not.toHaveBeenCalled();
  });

  it('動きを減らす設定では集計の演出を省略して購入できる', async () => {
    platform.animation.reducedMotion = () => true;
    await prepare(); runtime.requestPrototypeRelease(); runtime.confirmPrototypeRelease(); runtime.purchaseSpec('color');
    expect(runtime.getSnapshot().state.persistent.specs.color).toBe(1);
    expect(runtime.getSnapshot().state.resources.dollars).toBe(103);
  });
});

it('構成の組み立て中に保存ができた時点ですぐ書き込み、再起動後も続きから組み立てる', async () => {
  storage.setItem(SAVE_KEYS.primary, encodeSave(createFixture('seed-inheriting', clock.wall)!));
  await start(); step(3_400);
  const saved = loadGame(storage);
  expect(saved.kind).toBe('loaded');
  if (saved.kind === 'loaded') {
    expect(saved.state.run.seed.built).toEqual(['border', 'save']);
    expect(saved.state.run.seed.installer?.elapsedMs).toBe(3_400);
  }
  runtime.dispose(); await start(); step(6_600);
  expect(runtime.getSnapshot().state.run.seed.installer).toBeNull();
  expect(runtime.getSnapshot().state.run.seed.built).toEqual(['border', 'save', 'color', 'font', 'layout', 'motion']);
});

it('描画の報酬済み記録を保存し、再起動後に同じマスを塗っても二重加算しない', async () => {
  storage.setItem(SAVE_KEYS.primary, encodeSave(createFixture('kumiki-early', clock.wall)!));
  await start();
  const reward=10*globalMultiplier(runtime.getSnapshot().state);
  runtime.actKumiki({ type: 'paint', id: 'folder', cells: [49], color: 0, frame: 0, mirror: false });
  expect(runtime.getSnapshot().state.resources.pixels).toBe(reward);
  runtime.leave(); runtime.dispose(); await start();
  runtime.actKumiki({ type: 'paint', id: 'folder', cells: [49], color: 0, frame: 0, mirror: false });
  expect(runtime.getSnapshot().state.resources.pixels).toBe(reward);
});

describe('段階5の保存と製品名',()=>{
  it('撮影の保存が失敗したら報酬・クールダウン・撮影記録を進めず、再試行で一度だけ保存する',async()=>{
    storage.setItem(SAVE_KEYS.primary,encodeSave(createFixture('desktop-early',clock.wall)!));await start();
    const before=runtime.getSnapshot().state, write=storage.setItem;
    storage.setItem=(key,value)=>{if(key===SAVE_KEYS.primary)throw new Error('Quota exceeded');write(key,value);};
    expect(runtime.takeScreenshot()).toBe(false);expect(runtime.getSnapshot().state.resources).toEqual(before.resources);expect(runtime.getSnapshot().state.persistent.screenshots).toEqual([]);expect(runtime.getSnapshot().state.run.desktop.cooldownMs).toBe(0);
    storage.setItem=write;expect(runtime.takeScreenshot()).toBe(true);expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(1);expect(runtime.takeScreenshot()).toBe(false);
    runtime.dispose();await start();expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(1);expect(runtime.getSnapshot().state.run.desktop.cooldownMs).toBe(30_000);
  });
  it('製品名は作者と別に保存され、空白は無題、20文字まで。出荷後の改名は過去の製品名を変えない',async()=>{
    storage.setItem(SAVE_KEYS.primary,encodeSave(createFixture('release-ready',clock.wall)!));await start();
    runtime.requestPrototypeRelease();runtime.setProductName('星'.repeat(21));expect([...runtime.getSnapshot().state.persistent.productName!]).toHaveLength(20);
    runtime.setProductName('  私の画面  ');runtime.confirmPrototypeRelease();expect(runtime.getSnapshot().state.persistent.products[0]!.name).toBe('私の画面');expect(runtime.getSnapshot().state.persistent.products[0]!.author).toBe('Aoi');
    step(8000);runtime.purchaseSpec('color');runtime.startNextVersion();runtime.setProductName('次の名前');runtime.persist();
    expect(runtime.getSnapshot().state.persistent.productName).toBe('次の名前');expect(runtime.getSnapshot().state.persistent.products[0]!.name).toBe('私の画面');
    runtime.setNumberNotation('scientific');runtime.dispose();await start();expect(runtime.getSnapshot().state.persistent.numberNotation).toBe('scientific');
  });
});

describe('段階6の自動撮影と保存',()=>{
 it('ターミナルの撮影も保存成功後に公開し、失敗時は通常生成を保って自動化を止める',async()=>{
  const s=createFixture('desktop-ready',clock.wall)!;s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s.run.desktop.terminal.elapsedMs=59900;
  storage.setItem(SAVE_KEYS.primary,encodeSave(s));await start();const before=runtime.getSnapshot().state.run.totalPixelsGenerated;
  const write=storage.setItem;storage.setItem=(key,value)=>{if(key.startsWith('refresh.capture.'))throw new Error('Quota');write(key,value);};
  step(100);expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(0);expect(runtime.getSnapshot().state.run.desktop.terminal.running).toBe(false);expect(runtime.getSnapshot().state.run.totalPixelsGenerated).toBeGreaterThan(before);expect(runtime.getSnapshot().notice).toBe('save.failed');
  storage.setItem=write;runtime.actDesktop({type:'terminal',running:true,interval:60000});step(60000);expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(1);
  runtime.dispose();await start();expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(1);
 });
 it('不在の予約撮影も保存できるまで報酬を付けず、保存失敗でも通常の不在生成は失わない',async()=>{
  const s=createFixture('desktop-ready',clock.wall)!;s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s.run.desktop.reservation={at:clock.wall+60000,done:false};
  storage.setItem(SAVE_KEYS.primary,encodeSave(s));await start();const before=runtime.getSnapshot().state.run.totalPixelsGenerated;
  clock.hidden=true;runtime.visibilityChanged();clock.wall+=120000;clock.mono+=120000;
  const write=storage.setItem;storage.setItem=(key,value)=>{if(key.startsWith('refresh.capture.'))throw new Error('Quota');write(key,value);};
  clock.hidden=false;runtime.visibilityChanged();expect(runtime.getSnapshot().state.persistent.screenshots).toHaveLength(0);expect(runtime.getSnapshot().state.run.totalPixelsGenerated).toBeGreaterThan(before);expect(runtime.getSnapshot().notice).toBe('save.failed');
 });
});

describe('論理画面の大きさをプラットフォームへ通知',()=>{
 it('デスクトップの読み込み・切替・取り込みを通知し、通常のtickでは重複しない',async()=>{
  storage.setItem(SAVE_KEYS.primary,encodeSave(createFixture('desktop-stage0',clock.wall)!));await start();expect(platform.viewport.logicalSizeChanged).toHaveBeenLastCalledWith({width:800,height:600});
  vi.mocked(platform.viewport.logicalSizeChanged).mockClear();step(1000);expect(platform.viewport.logicalSizeChanged).not.toHaveBeenCalled();
  runtime.actDesktop({type:'desktop-stage',stage:1});expect(platform.viewport.logicalSizeChanged).toHaveBeenLastCalledWith({width:1024,height:768});
  runtime.actDesktop({type:'desktop-stage',stage:2});expect(platform.viewport.logicalSizeChanged).toHaveBeenLastCalledWith({width:1366,height:768});
  runtime.importData(encodeSave(createFixture('kumiki-wall',clock.wall)!));expect(platform.viewport.logicalSizeChanged).toHaveBeenLastCalledWith({width:1920,height:1080});
 });
});

describe('段階6.5の操作と永続の記録',()=>{
 it('100回の隠し要素を1回だけ通知し、書きかけのノートへ追記して再読み込みでも保持する',async()=>{
  const s=createFixture('foundation-start',clock.wall)!;s.persistent.productionNote='書きかけの大切な文';s.persistent.progress.counts.preBorder=99;storage.setItem(SAVE_KEYS.primary,encodeSave(s));await start();runtime.pressSeed();expect(runtime.getSnapshot().state.persistent.productionNote).toBe('書きかけの大切な文\n\nボタンは、押すほど愛着がわく。');runtime.enableDebugSave();runtime.persist();runtime.dispose();await start();runtime.pressSeed();expect(runtime.getSnapshot().state.persistent.productionNote?.match(/ボタンは/g)).toHaveLength(1);expect(vi.mocked(platform.unlockAchievement).mock.calls.filter(([id])=>id==='secret-button')).toHaveLength(1);
 });
 it('長さの上限のノートを切り捨てず、隠しの行は別に保持して保存できる',async()=>{
  const s=createFixture('foundation-start',clock.wall)!;s.persistent.productionNote='あ'.repeat(BALANCE.w3.maxNote);s.persistent.progress.counts.preBorder=99;storage.setItem(SAVE_KEYS.primary,encodeSave(s));await start();runtime.pressSeed();runtime.enableDebugSave();runtime.persist();const saved=loadGame(storage);expect(saved.kind).toBe('loaded');if(saved.kind==='loaded'){expect(saved.state.persistent.productionNote).toBe(s.persistent.productionNote);expect(saved.state.persistent.progress.noteOverflow).toBe(true);}
 });
 it('取り残されたピクセルは20秒分を一度だけ受け取り、消えた後には付けない',async()=>{
  storage.setItem(SAVE_KEYS.primary,encodeSave(createFixture('stray-seed',clock.wall)!));await start();const before=runtime.getSnapshot().state,rate=passivePixelsPerSecond(before);runtime.collectStray();const earned=runtime.getSnapshot().state.resources.pixels-before.resources.pixels;expect(earned).toBeCloseTo(rate*20);runtime.collectStray();expect(runtime.getSnapshot().state.resources.pixels-before.resources.pixels).toBeCloseTo(earned);expect(runtime.getSnapshot().state.run.play.stray.lifeMs).toBe(0);
 });
 it('音量と入切は保存し、音声が使えなくてもクリックと保存は動く',async()=>{
  await start();runtime.common({type:'sound',enabled:false,volume:.4});vi.mocked(platform.audio.play).mockClear();runtime.pressSeed();expect(platform.audio.play).not.toHaveBeenCalled();runtime.common({type:'sound',enabled:true});vi.mocked(platform.audio.play).mockImplementation(()=>{throw new Error('no device')});expect(()=>runtime.pressSeed()).not.toThrow();runtime.enableDebugSave();runtime.persist();const saved=loadGame(storage);expect(saved.kind==='loaded'&&saved.state.persistent.progress.sound).toEqual({enabled:true,volume:.4});
 });
 it('10台のまとめ買いを保存し、残高と台数が一致する',async()=>{
  const s=createFixture('seed-motion',clock.wall)!;s.resources.pixels=1e6;s.run.totalPixelsGenerated=1e6;storage.setItem(SAVE_KEYS.primary,encodeSave(s));await start();runtime.common({type:'bulk',mode:'ten'});const before=runtime.getSnapshot().state,q=seedCursorQuote(before);runtime.buildSeed('cursor');const after=runtime.getSnapshot().state;expect(after.run.seed.autoCursors-before.run.seed.autoCursors).toBe(10);expect(before.resources.pixels-after.resources.pixels).toBe(q.cost);expect(loadGame(storage).kind).toBe('loaded');
 });
});

it('時計を開いた際の自動サイズ調整は連続クリックを途切れさせず、10回ちょうどで解放する',async()=>{
 storage.setItem(SAVE_KEYS.primary,encodeSave(createFixture('desktop-ready',clock.wall)!));await start();runtime.common({type:'clock-click'});
 const w=runtime.getSnapshot().state.run.desktop.windows.clock;runtime.actDesktop({type:'rect',app:'clock',rect:{...w,width:w.width+8}},{automatic:true});
 expect(runtime.getSnapshot().state.run.play.clock.count).toBe(1);
 for(let i=0;i<8;i++)runtime.common({type:'clock-click'});expect(runtime.getSnapshot().state.persistent.progress.records['secret-clock']).toBeUndefined();
 runtime.common({type:'clock-click'});expect(runtime.getSnapshot().state.persistent.progress.records['secret-clock']).toBe(clock.wall);
});
