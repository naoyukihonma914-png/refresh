export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

export interface Settings { language?: string; numberNotation?: 'compact' | 'scientific' }
export const SETTINGS_KEY = 'refresh.settings';

// 言語設定はゲームの進捗ではないため、「保存」を作る前から独立して保存する。
export function createSettingsStorage(storage: SaveStorage) {
  return {
    read(): Settings {
      try {
        const raw = storage.getItem(SETTINGS_KEY);
        const data: unknown = raw === null ? null : JSON.parse(raw);
        if (typeof data !== 'object' || data === null) return {};
        const settings: Settings = {};
        if ('language' in data && typeof data.language === 'string') settings.language = data.language;
        if ('numberNotation' in data && (data.numberNotation === 'compact' || data.numberNotation === 'scientific')) settings.numberNotation = data.numberNotation;
        return settings;
      } catch { return {}; }
    },
    write(settings: Settings): boolean {
      try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }
      catch { return false; }
    },
  };
}
