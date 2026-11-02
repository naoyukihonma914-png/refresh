import { describe, expect, it } from 'vitest';
import { createInitialState, isGameState } from './state';
import { applySeedSkills, createSeedVersion } from './seed';
import { seedEra, setSeedEra, unlockedSeedEra } from './seedAppearance';
import { decodeSave, encodeSave } from './save';
import { setDesktopStage } from './appearance';
import { desktopScreen, workHeight } from './desktopGeometry';

describe('次の版の素の画面の時代', () => {
  it.each([0, 1, 2, 3] as const)('デスクトップ段%iを残してv2へ進み、空の窓を正しい画面サイズで保存・復元する', era => {
    let previous = createInitialState(1_000);
    previous.run.version = 'v1';
    previous.persistent.desktopPrefs.skills = ['major1', 'major2', 'major3'];
    previous.persistent.desktopPrefs.iconSize = 64;
    previous = setDesktopStage(previous, era);
    previous.run.desktop.entered = true;
    previous.run.desktop.windows.note.open = true;
    previous.run.desktop.windows.note.minimized = true;
    previous.run.desktop.windows.note.z = 10;
    const next = createSeedVersion(previous, 'v2', 2_000);
    const screen = desktopScreen(era);
    expect(next.persistent.appearance.desktop).toBe(era);
    expect(next.run.world).toBe('seed');
    expect(next.run.desktop.screen).toEqual(screen);
    expect(next.run.desktop.entered).toBe(false);
    expect(next.run.desktop.apps).toEqual([]);
    expect(next.run.desktop.active).toBeNull();
    for (const window of Object.values(next.run.desktop.windows)) {
      expect(window.open || window.minimized || window.maximized).toBe(false);
      expect(window.restore).toBeNull();
      expect(window.z).toBe(0);
      expect(window.x + window.width).toBeLessThanOrEqual(screen.width);
      expect(window.y + window.height).toBeLessThanOrEqual(workHeight(screen));
    }
    expect(isGameState(next)).toBe(true);
    const decoded = decodeSave(encodeSave(next));
    expect(decoded.run.desktop).toEqual(next.run.desktop);
    expect(decoded.persistent.appearance.desktop).toBe(era);
  });

  it('大型アップデートだけでは現在のページを変えず、次の版で2000年代の見た目を開く', () => {
    const previous = createInitialState(1_000);
    previous.run.version = 'v1';
    previous.persistent.desktopPrefs.skills.push('major1');
    expect(seedEra(previous)).toBe(0);
    expect(unlockedSeedEra(previous)).toBe(0);
    expect(setSeedEra(previous, 1)).toBe(previous);
    const next = createSeedVersion(previous, 'v2', 2_000);
    expect(seedEra(next)).toBe(1);
    expect(unlockedSeedEra(next)).toBe(1);
    expect(next.run.seed.built).toEqual([]);
    expect(previous.persistent.seedAppearance).toEqual({ pattern: 'none', marquee: false });
    expect(isGameState(next)).toBe(true);
  });

  it('解放していない旧データは元の見た目のままで、戻した選択を設定の適用や次の版でも保つ', () => {
    const old = createInitialState(1_000);
    expect(seedEra(createSeedVersion(old, 'v1', 2_000))).toBe(0);
    old.run.version = 'v1';
    old.persistent.desktopPrefs.skills.push('major1');
    let next = createSeedVersion(old, 'v2', 2_000);
    next = setSeedEra(next, 0);
    next = applySeedSkills(next, [], 'none', false);
    expect(seedEra(next)).toBe(0);
    expect(unlockedSeedEra(next)).toBe(1);
    expect(seedEra(createSeedVersion(next, 'v2', 3_000))).toBe(0);
    const decoded = decodeSave(encodeSave(next));
    expect(decoded.persistent.seedAppearance).toEqual(next.persistent.seedAppearance);
  });

  it('時代を戻しても配置・配色・書体と所持資源は変えない', () => {
    const old = createInitialState(1_000);
    old.persistent.desktopPrefs.skills.push('major1');
    old.persistent.seedSkills.push('inherit');
    old.run.seed.page = { ...old.run.seed.page, background: '#ffffff', button: '#000080', text: '#000000', bodyFont: 'mono', headingFont: 'serif', heading: 'My page' };
    old.run.seed.built = ['border', 'save', 'color', 'font'];
    old.resources.tokens = 21;
    old.resources.dollars = 100;
    const next = createSeedVersion(old, 'v2', 2_000);
    const restored = setSeedEra(next, 0);
    expect(restored.run.seed.page).toEqual(old.run.seed.page);
    expect(restored.run.seed.installer).toEqual(next.run.seed.installer);
    expect(restored.resources).toEqual(next.resources);
    expect(setSeedEra(restored, 2 as 1)).toBe(restored);
    expect(setSeedEra(restored, 1).run.seed.page).toEqual(old.run.seed.page);
  });
});
