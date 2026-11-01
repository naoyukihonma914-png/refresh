import { describe, expect, it } from 'vitest';
import { createFixture } from './fixtures';
import { clearGame, createMemoryStorage, decodeSave, encodeSave, loadGame, SAVE_KEYS, saveGame } from './save';
import { createInitialState, isGameState } from './state';
import { LEGACY_COLOR_MAP, paletteFor } from '../content/kumikiArt';
import { completeDrawing } from './kumiki';

const savedState = () => createFixture('foundation-saved', 1_000)!;

describe('保存と読み込み', () => {
  it('第3版の描画・テンプレート・エクスポート・スケッチと色設定を新しいパレットへ移し、報酬記録を保つ', () => {
    const old = JSON.parse(encodeSave(createFixture('kumiki-mature', 1_000)!));
    old.schemaVersion = 3;
    // 第3版が保存していた色番号で、完成したフォルダを再現する。
    for (const drawing of [...Object.values(old.run.kumiki.drawings), ...Object.values(old.persistent.artwork.icons)] as { frames: number[][] }[]) {
      drawing.frames = drawing.frames.map(frame => frame.map(color => color < 0 ? color : LEGACY_COLOR_MAP.indexOf(color)));
    }
    const drawing = old.run.kumiki.drawings.folder;
    drawing.frames[0][0] = 11; drawing.rewarded[0] = true;
    old.run.kumiki.underlays.folder = structuredClone(drawing);
    old.persistent.artwork.sketchbook = structuredClone(drawing);
    old.persistent.artwork.wallpaper = structuredClone(drawing);
    old.persistent.artwork.icons.folder = structuredClone(drawing);
    old.run.kumiki.exports[0].frames[0][0] = 11;
    old.run.kumiki.design.primary = { color: '#000080', radius: 4, textSize: 'medium', shadow: false };
    const next = decodeSave(JSON.stringify(old));
    expect(next.schemaVersion).toBe(9);
    for (const art of [next.run.kumiki.drawings.folder, next.run.kumiki.underlays.folder, next.persistent.artwork.sketchbook, next.persistent.artwork.wallpaper, next.persistent.artwork.icons.folder]) {
      expect(art!.frames[0]![0]).toBe(LEGACY_COLOR_MAP[11]);
      expect(art!.rewarded[0]).toBe(true);
    }
    expect(next.run.kumiki.exports[0]!.frames[0]![0]).toBe(LEGACY_COLOR_MAP[11]);
    expect(next.run.kumiki.design.primary!.color).toBe(paletteFor(0)[11]);
    expect(next.resources).toEqual(old.resources);
    expect(completeDrawing(next, 'folder')).toBe(true);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('保存を作るまでは、保存領域に何も書かない', () => {
    const storage = createMemoryStorage();
    expect(saveGame(storage, createInitialState(1_000), 2_000).kind).toBe('locked');
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('版番号つきの単一データとして往復できる', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    state.persistent.playerName = '作者';
    state.resources.tokens = 3;
    state.persistent.specs.storage = 2;
    const result = saveGame(storage, state, 2_000);
    expect(result.kind).toBe('saved');
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state: { ...state, lastSavedAt: 2_000 } });
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it('正常な前世代を1つ残し、主データが壊れたら復元する', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    saveGame(storage, state, 2_000);
    saveGame(storage, state, 3_000);
    storage.setItem(SAVE_KEYS.primary, '{途中で切れた');
    expect(loadGame(storage)).toEqual({ kind: 'recovered', state: { ...state, lastSavedAt: 2_000 } });
    saveGame(storage, state, 4_000);
    expect(decodeSave(storage.getItem(SAVE_KEYS.backup)! ).lastSavedAt).toBe(2_000);
    expect(loadGame(storage).kind).toBe('loaded');
  });

  it('主データが消えていても予備を見つける', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEYS.backup, encodeSave(savedState()));
    expect(loadGame(storage).kind).toBe('recovered');
  });

  it('両方壊れていたら確認待ちにし、元の文字列を残す', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEYS.primary, '壊れた主データ');
    storage.setItem(SAVE_KEYS.backup, '壊れた予備');
    expect(loadGame(storage).kind).toBe('corrupt');
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('壊れた主データ');
    expect(storage.getItem(SAVE_KEYS.backup)).toBe('壊れた予備');
  });

  it('保存領域へのアクセス拒否を、新規データとは区別する', () => {
    const storage = { ...createMemoryStorage(), getItem() { throw new Error('拒否'); } };
    expect(loadGame(storage).kind).toBe('unavailable');
  });

  it('容量不足でも元のデータと保存時刻を変更しない', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    saveGame(storage, state, 2_000);
    const failed = { ...storage, setItem() { throw new Error('容量不足'); } };
    expect(saveGame(failed, state, 3_000)).toEqual({ kind: 'failed', state });
    expect(decodeSave(storage.getItem(SAVE_KEYS.primary)!).lastSavedAt).toBe(2_000);
  });

  it('今後の版・未対応の旧版を推測で読み込まない', () => {
    expect(() => decodeSave(JSON.stringify({ ...savedState(), schemaVersion: 10 }))).toThrow('新しい版');
    expect(() => decodeSave(JSON.stringify({ ...savedState(), schemaVersion: 0 }))).toThrow('対応していません');
    expect(() => decodeSave('{}')).toThrow();
  });

  it.each([
    (state: ReturnType<typeof savedState>) => { state.resources.pixels = -1; },
    (state: ReturnType<typeof savedState>) => { state.resources.tokens = Infinity; },
    (state: ReturnType<typeof savedState>) => { state.persistent.specs.storage = 99; },
    (state: ReturnType<typeof savedState>) => { state.run.seed.autoCursors = 0.5; },
    (state: ReturnType<typeof savedState>) => { state.run.seed.built.push('save'); },
    (state: ReturnType<typeof savedState>) => { state.resources.pixels = 100; },
  ])('版番号が合っていても不正な内容を受け付けない (%#)', mutate => {
    const state = savedState();
    mutate(state);
    expect(isGameState(state)).toBe(false);
    expect(() => encodeSave(state)).toThrow();
    expect(() => decodeSave(JSON.stringify(state))).toThrow();
  });

  it('明示的な初期化で主データと予備を両方消す', () => {
    const storage = createMemoryStorage();
    saveGame(storage, savedState(), 2_000);
    saveGame(storage, savedState(), 3_000);
    expect(clearGame(storage)).toBe(true);
    expect(loadGame(storage).kind).toBe('empty');
  });
});
