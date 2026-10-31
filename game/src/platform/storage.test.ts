import { describe, expect, it } from 'vitest';
import { createMemoryStorage, createSettingsStorage, SETTINGS_KEY } from './storage';
import { loadGame } from '../systems/save';

describe('言語設定の保存窓口', () => {
  it('進捗の保存とは分けて言語設定を往復できる', () => {
    const storage = createMemoryStorage();
    const settings = createSettingsStorage(storage);
    expect(settings.write({ language: 'en' })).toBe(true);
    expect(settings.read()).toEqual({ language: 'en' });
    expect(loadGame(storage).kind).toBe('empty');
  });

  it.each(['{', 'null', '{"language":42}'])('不正な設定 %s で初期化を止めない', raw => {
    const storage = createMemoryStorage();
    storage.setItem(SETTINGS_KEY, raw);
    expect(createSettingsStorage(storage).read()).toEqual({});
  });

  it('保存領域が拒否されても設定の失敗を返し、例外で止めない', () => {
    const storage = { ...createMemoryStorage(), setItem() { throw new Error('Denied'); } };
    expect(createSettingsStorage(storage).write({ language: 'en' })).toBe(false);
  });
});
