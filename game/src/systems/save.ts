import { captureStore } from '../platform/captures';
import { migrateCaptureV6 } from './captureMigration';
import { createDesktopPreferences, createDesktopState } from './desktopState';
import { canSave, createInitialState, isGameState, SCHEMA_VERSION, type GameState } from './state';
import type { SaveStorage } from '../platform/storage';
import { createArtwork, createKumikiState } from './kumikiState';
import { enterKumiki } from './kumiki';
import { LEGACY_COLOR_MAP, legacyPalette, paletteFor } from '../content/kumikiArt';
export { createMemoryStorage, type SaveStorage } from '../platform/storage';

export const SAVE_KEYS = { primary: 'refresh.save', backup: 'refresh.save.backup' } as const;

// 配布・PRで使用した第1〜第4版を順に変換する。試作の形式は推測しない。
const migrations: Readonly<Record<number, (data: unknown) => unknown>> = {
  1(data) {
    const old = data as GameState;
    const defaults = createInitialState(0);
    return { ...old, schemaVersion: 2,
      run: { ...old.run, seed: { ...old.run?.seed,
        history: [], guide: defaults.run.seed.guide, lastActionAt: 0, installer: null,
      } },
      persistent: { ...old.persistent,
        seedSkills: [], seedAppearance: defaults.persistent.seedAppearance,
      },
    };
  },
  2(data) {
    const old = data as GameState;
    const next = { ...old, schemaVersion: 3,
      run: { ...old.run, kumiki: createKumikiState() },
      persistent: { ...old.persistent, artwork: createArtwork() },
    };
    return next;
  },
  3(data) {
    const next = { ...(data as GameState), schemaVersion: 4 };
    const projected = { ...next, schemaVersion: SCHEMA_VERSION,
      run: { ...next.run, shipping: null, restartMs: 0, desktop: createDesktopState() },
      persistent: { ...next.persistent, products: [], guideArchive: [], homeTheme: {}, productName: null, numberNotation: 'compact', screenshots: [], desktopPrefs:createDesktopPreferences(), productionNote: null, noteUpdatedAt: null, homeUpdatedAt: null, sketchUpdatedAt: null },
    };
    if (!isGameState(projected)) throw new Error('保存データの内容が不正です');
    const palette = paletteFor(1);
    const rgb = (color: string) => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
    const oldPalette = legacyPalette();
    const mapping = oldPalette.map((color, index) => {
      if (index < LEGACY_COLOR_MAP.length) return LEGACY_COLOR_MAP[index]!;
      const exact = palette.indexOf(color);
      if (exact >= 0) return exact;
      const source = rgb(color);
      const distances = palette.map(c => rgb(c).reduce((sum, value, i) => sum + (value - source[i]!) ** 2, 0));
      return distances.indexOf(Math.min(...distances));
    });
    const frames = (items: number[][]) => items.map(frame => frame.map(color => color < 0 ? color : mapping[color]!));
    const k = next.run.kumiki, art = next.persistent.artwork;
    for (const drawing of [...Object.values(k.drawings), ...Object.values(k.underlays), ...Object.values(art.icons), art.sketchbook, ...(art.wallpaper ? [art.wallpaper] : [])]) drawing.frames = frames(drawing.frames);
    for (const work of k.exports) work.frames = frames(work.frames);
    for (const design of Object.values(k.design)) {
      const index = oldPalette.indexOf(design.color.toLowerCase());
      if (index >= 0) design.color = palette[mapping[index]!]!;
    }
    return next;
  },
  4(data) {
    const old = data as GameState;
    return { ...old, schemaVersion: 5,
      run: { ...old.run, shipping: null, restartMs: 0 },
      persistent: { ...old.persistent, products: [], guideArchive: [], homeTheme: {} },
    };
  },
  5(data) {
    const old = data as GameState;
    return { ...old, schemaVersion: 6, run: { ...old.run, desktop: createDesktopState() },
      persistent: { ...old.persistent, productName: null, numberNotation: 'compact', products: (old.persistent.products ?? []).map(p => ({ ...p, name: null })), screenshots: [], productionNote: null, noteUpdatedAt: null } };
  },
  6(data) {
    const old=data as GameState;
    return {...old,schemaVersion:7,persistent:{...old.persistent,homeUpdatedAt:null,sketchUpdatedAt:null,screenshots:old.persistent.screenshots.map(migrateCaptureV6)},
      run:{...old.run,desktop:{...old.run.desktop,feedback:old.run.desktop.feedback.map(f=>({...f,sender:f.sender??'hikari'}))}}};
  },
  7(data) {
    const old=data as GameState, defaults=createDesktopState(), prefs=createDesktopPreferences();
    prefs.lastShotId=Math.max(0,...old.persistent.screenshots.map(s=>s.id));
    return {...old,schemaVersion:8,persistent:{...old.persistent,desktopPrefs:prefs},run:{...old.run,desktop:{...defaults,...old.run.desktop,upgrades:[...old.run.desktop.apps],windows:{...defaults.windows,...old.run.desktop.windows},icons:{...defaults.icons,...old.run.desktop.icons}}}};
  },
};

export function decodeSave(raw: string, readScene?: (ref:string)=>string): GameState {
  let data: unknown = JSON.parse(raw);
  const stored=data as GameState;
  if(Array.isArray(stored?.persistent?.screenshots)) {
    stored.persistent.screenshots=stored.persistent.screenshots.map(shot=>{
      if('data' in shot)return shot;
      const ref=(shot as unknown as {sceneRef?:unknown}).sceneRef;
      if(typeof ref!=='string'||!readScene)throw new Error('Screenshot assets are required');
      const {sceneRef:_ref,...metadata}=shot as unknown as Record<string,unknown>;return {...metadata,data:readScene(ref)} as unknown as GameState['persistent']['screenshots'][number];
    });
  }
  const versionOf = (value: unknown): number => {
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value)
      || !Number.isSafeInteger(value.schemaVersion)) throw new Error('保存形式を確認できません');
    return value.schemaVersion as number;
  };
  let version = versionOf(data);
  const migrated = version < SCHEMA_VERSION;
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
  return migrated && data.run.seed.built.includes('kumiki') && !data.run.kumiki.entered ? enterKumiki(data) : data;
}

export function encodeSave(state: GameState): string {
  if (!isGameState(state)) throw new Error('保存データの内容が不正です');
  return JSON.stringify(state);
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded' | 'recovered'; state: GameState }
  | { kind: 'corrupt' | 'unavailable' };

const verifiedPrimary=new WeakMap<SaveStorage,string>();

export function loadGame(storage: SaveStorage): LoadResult {
  let primary: string | null;
  let backup: string | null;
  try {
    primary = storage.getItem(SAVE_KEYS.primary);
    backup = storage.getItem(SAVE_KEYS.backup);
  } catch {
    return { kind: 'unavailable' };
  }
  try { captureStore(storage).reload(); } catch { return {kind:'unavailable'}; }
  for (const [raw, kind] of [[primary, 'loaded'], [backup, 'recovered']] as const) {
    if (raw === null) continue;
    try {
      const state=decodeSave(raw,ref=>captureStore(storage).get(ref));
      if(kind==='loaded')verifiedPrimary.set(storage,raw);
      return {kind,state};
    } catch {
      // 壊れた主データで予備を上書きしない。
    }
  }
  return primary === null && backup === null ? { kind: 'empty' } : { kind: 'corrupt' };
}

export type SaveResult =
  | { kind: 'saved'; state: GameState }
  | { kind: 'locked' | 'failed'; state: GameState };

export function saveGame(storage: SaveStorage, state: GameState, now: number, { checkpoint = false } = {}): SaveResult {
  if (!canSave(state) && !(checkpoint && state.persistent.products.length > 0)) return { kind: 'locked', state };
  const saved = { ...state, lastSavedAt: now };
  let scenes:ReturnType<typeof captureStore>|undefined;
  let previousBackup:string|null= null,backupChanged=false;
  try {
    if(!isGameState(saved))throw new Error('Invalid game state');
    scenes=captureStore(storage);scenes.begin();
    const screenshots=saved.persistent.screenshots.map(({data,...metadata})=>({...metadata,sceneRef:scenes!.put(data)}));
    const raw=JSON.stringify({...saved,persistent:{...saved.persistent,screenshots}});
    const previous=storage.getItem(SAVE_KEYS.primary);
    if(previous!==null){
      let valid=verifiedPrimary.get(storage)===previous;
      if(!valid){try{decodeSave(previous,ref=>scenes!.get(ref));valid=true;}catch{/* Preserve the existing backup. */}}
      if(valid){previousBackup=storage.getItem(SAVE_KEYS.backup);storage.setItem(SAVE_KEYS.backup,previous);backupChanged=true;}
    }
    scenes.flush();
    storage.setItem(SAVE_KEYS.primary,raw);
    scenes.finish();verifiedPrimary.set(storage,raw);
    try{scenes.collect(raw,storage.getItem(SAVE_KEYS.backup),previous);}catch{/* Collection is best effort after a successful commit. */}
    return {kind:'saved',state:saved};
  } catch {
    scenes?.rollback();
    if(backupChanged){try{if(previousBackup===null)storage.removeItem(SAVE_KEYS.backup);else storage.setItem(SAVE_KEYS.backup,previousBackup);}catch{/* Primary remains intact if storage itself is unavailable. */}}
    return {kind:'failed',state};
  }
}

export function clearGame(storage: SaveStorage): boolean {
  try {
    storage.removeItem(SAVE_KEYS.primary);
    storage.removeItem(SAVE_KEYS.backup);
    captureStore(storage).clear();
    verifiedPrimary.delete(storage);
    return true;
  } catch { return false; }
}
