import { BALANCE, type SeedItem, type SpecKey } from '../config/balance';

export const SCHEMA_VERSION = 1;

// ここには JSON として保存できるものだけを入れる。
// 選択中の道具・押しているキー・勢いなど、一時的な表示状態は入れない。
export interface GameState {
  schemaVersion: typeof SCHEMA_VERSION;
  createdAt: number;
  lastTickAt: number; // 不在用の端末時計。能動時間には使わない。
  lastSavedAt: number | null;
  elapsedMs: number;
  resources: { pixels: number; tokens: number; dollars: number };
  run: {
    version: 'v0.1';
    world: 'seed';
    totalPixelsGenerated: number;
    seed: { built: SeedItem[]; autoCursors: number };
  };
  persistent: { specs: Record<SpecKey, number>; playerName: string | null };
}

export function createInitialState(now: number): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    lastTickAt: now,
    lastSavedAt: null,
    elapsedMs: 0,
    resources: { pixels: 0, tokens: 0, dollars: 0 },
    run: {
      version: 'v0.1', world: 'seed', totalPixelsGenerated: 0,
      seed: { built: [], autoCursors: 0 },
    },
    persistent: {
      specs: { color: 0, resolution: 0, refresh: 0, memory: 0, storage: 0, network: 0, graphics: 0 },
      playerName: null,
    },
  };
}

export function canSave(state: GameState): boolean {
  return state.run.seed.built.includes('save');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

const isCount = (value: unknown): value is number => isAmount(value) && Number.isSafeInteger(value);

// ファイルからの読み込みにも同じ検査を使う。版番号だけを信用しない。
export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (![value.createdAt, value.lastTickAt, value.elapsedMs].every(isAmount)) return false;
  if (value.lastSavedAt !== null && !isAmount(value.lastSavedAt)) return false;
  const resources = value.resources;
  const run = value.run;
  const persistent = value.persistent;
  if (!isRecord(resources) || !isRecord(run) || !isRecord(persistent)) return false;
  if (!isAmount(resources.pixels) || !isAmount(resources.tokens) || !isAmount(resources.dollars)) return false;
  if (run.version !== 'v0.1' || run.world !== 'seed' || !isAmount(run.totalPixelsGenerated)) return false;
  if (run.totalPixelsGenerated < resources.pixels) return false;
  if (!isRecord(run.seed) || !Array.isArray(run.seed.built) || !isCount(run.seed.autoCursors)) return false;
  const itemIds: readonly unknown[] = BALANCE.w1.items.map(item => item.id);
  if (!run.seed.built.every(item => itemIds.includes(item))) return false;
  if (new Set(run.seed.built).size !== run.seed.built.length) return false;
  if (persistent.playerName !== null && typeof persistent.playerName !== 'string') return false;
  const specs = persistent.specs;
  if (!isRecord(specs)) return false;
  return (Object.keys(BALANCE.spec) as SpecKey[]).every(key =>
    isCount(specs[key]) && specs[key] < BALANCE.spec[key].length,
  );
}
