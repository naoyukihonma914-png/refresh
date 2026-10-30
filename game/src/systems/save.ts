import { canSave, isGameState, SCHEMA_VERSION, type GameState } from './state';

export const SAVE_KEYS = { primary: 'refresh.save', backup: 'refresh.save.backup' } as const;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// 実在する旧版ができたら、その版から次版への変換をここに追加する。
// 過去の試作は別仕様なので、旧セーブの形式を推測して読み込まない。
const migrations: Readonly<Record<number, (data: unknown) => unknown>> = {};

export function decodeSave(raw: string): GameState {
  let data: unknown = JSON.parse(raw);
  const versionOf = (value: unknown): number => {
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value)
      || !Number.isSafeInteger(value.schemaVersion)) throw new Error('保存形式を確認できません');
    return value.schemaVersion as number;
  };
  let version = versionOf(data);
  if (version > SCHEMA_VERSION) throw new Error('新しい版で保存されたデータです');
  while (version < SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error('この版の保存データには対応していません');
    data = migrate(data);
    const next = versionOf(data);
    if (next !== version + 1) throw new Error('保存データの変換に失敗しました');
    version = next;
  }
  if (!isGameState(data)) throw new Error('保存データの内容が不正です');
  return data;
}

export function encodeSave(state: GameState): string {
  if (!isGameState(state)) throw new Error('保存データの内容が不正です');
  return JSON.stringify(state);
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded' | 'recovered'; state: GameState }
  | { kind: 'corrupt' | 'unavailable' };

export function loadGame(storage: SaveStorage): LoadResult {
  let primary: string | null;
  let backup: string | null;
  try {
    primary = storage.getItem(SAVE_KEYS.primary);
    backup = storage.getItem(SAVE_KEYS.backup);
  } catch {
    return { kind: 'unavailable' };
  }
  for (const [raw, kind] of [[primary, 'loaded'], [backup, 'recovered']] as const) {
    if (raw === null) continue;
    try {
      return { kind, state: decodeSave(raw) };
    } catch {
      // 壊れた主データで予備を上書きしない。
    }
  }
  return primary === null && backup === null ? { kind: 'empty' } : { kind: 'corrupt' };
}

export type SaveResult =
  | { kind: 'saved'; state: GameState }
  | { kind: 'locked' | 'failed'; state: GameState };

export function saveGame(storage: SaveStorage, state: GameState, now: number): SaveResult {
  if (!canSave(state)) return { kind: 'locked', state };
  const saved = { ...state, lastSavedAt: now };
  try {
    const raw = encodeSave(saved);
    const previous = storage.getItem(SAVE_KEYS.primary);
    if (previous !== null) {
      let valid = false;
      try { decodeSave(previous); valid = true; } catch { /* 予備を保持する */ }
      if (valid) storage.setItem(SAVE_KEYS.backup, previous);
    }
    storage.setItem(SAVE_KEYS.primary, raw);
    return { kind: 'saved', state: saved };
  } catch {
    return { kind: 'failed', state };
  }
}

export function clearGame(storage: SaveStorage): boolean {
  try {
    storage.removeItem(SAVE_KEYS.primary);
    storage.removeItem(SAVE_KEYS.backup);
    return true;
  } catch { return false; }
}

export function createMemoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}
