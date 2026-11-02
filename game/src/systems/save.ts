import { createAdviceState } from './advice';
import { createPageDesign, isPageDesign } from './pageDesign';
import { repairAppProjects } from './appLayout';
import { getWorkshopPart, WORKSHOP_PARTS, type UiSetId, type WorkshopPartId, type WorkshopRect } from '../content/workshopCatalog';
import { isPartProduction, minimumPartSize, workshopPairValid, workshopRectOnGrid, type PartProduction } from './workshopState';
import { normalizeWorkshopRect } from './workshop';
import { captureStore } from '../platform/captures';
import { canSave, isGameState, SCHEMA_VERSION, type GameState } from './state';
import { migrateLegacySave } from './legacySave';
import { migrateStage8bSave } from './stage8bMigration';
import type { SaveStorage } from '../platform/storage';
export { createMemoryStorage, type SaveStorage } from '../platform/storage';

export const SAVE_KEYS = { primary: 'refresh.save', backup: 'refresh.save.backup' } as const;

/** Geometry can be repaired without resetting a paid/completed production. */
function repairWorkshopRects(state: GameState): void {
  const workshop = state.run?.workshop;
  if (!workshop || !workshop.parts || typeof workshop.parts !== 'object' || Array.isArray(workshop.parts)) return;
  const entries = Object.entries(workshop.parts) as [WorkshopPartId, PartProduction][];
  const repaired = { ...workshop.parts }, pending = new Set<WorkshopPartId>();
  const byId = new Map(entries);
  for (const [id, part] of entries) {
    const descriptor = WORKSHOP_PARTS.find(p => p.id === id);
    // A rect repair must not legitimize fabricated completion, missing elements,
    // changed timestamps, or an unknown part from an edited save.
    const reference = descriptor && part ? normalizeWorkshopRect(state, id, descriptor.defaultRect) : null;
    if (!descriptor || !part || !reference || !isPartProduction({ ...part, rect: reference }, id)) throw new Error('保存データの内容が不正です');
    if (!isPartProduction(part, id) || !workshopRectOnGrid(part.rect, state.persistent.specs.resolution)) pending.add(id);
  }
  // A window perimeter is the container, so restore it rather than moving valid
  // controls into an accidentally shrunken frame.
  const frame = byId.get('common-frame');
  if (frame && frame.step > 0 && !pending.has('common-frame') && entries.some(([id, part]) => id !== 'common-frame' && getWorkshopPart(id).set === 'common' && part.step > 0 && !pending.has(id) && !workshopPairValid('common-frame', frame.rect, id, part.rect))) pending.add('common-frame');
  const settled = new Set<WorkshopPartId>();
  const fits = (id: WorkshopPartId, rect: WorkshopRect): boolean => {
    const part = byId.get(id)!;
    return isPartProduction({ ...part, rect }, id) && workshopRectOnGrid(rect, state.persistent.specs.resolution)
      && (part.step === 0 || [...settled].every(other => {
        const sibling = repaired[other]!;
        return sibling.step === 0 || getWorkshopPart(other).set !== getWorkshopPart(id).set || workshopPairValid(id, rect, other, sibling.rect);
      }));
  };
  for (const [id, part] of entries) if (!pending.has(id)) {
    if (fits(id, part.rect)) settled.add(id);
    else pending.add(id);
  }
  const resetSet = (set: UiSetId) => {
    const ids = entries.filter(([id]) => getWorkshopPart(id).set === set).map(([id]) => id);
    for (const id of ids) settled.delete(id);
    for (const id of ids) {
      const rect = normalizeWorkshopRect(state, id, getWorkshopPart(id).defaultRect);
      if (!rect || !fits(id, rect)) throw new Error('保存データの内容が不正です');
      repaired[id] = { ...byId.get(id)!, rect }; settled.add(id); pending.delete(id);
    }
  };
  for (const id of [...pending]) {
    if (!pending.has(id)) continue;
    const descriptor = getWorkshopPart(id), part = byId.get(id)!;
    const original = normalizeWorkshopRect(state, id, part.rect), standard = normalizeWorkshopRect(state, id, descriptor.defaultRect);
    const minSize = minimumPartSize(id, part.design);
    const minimum = normalizeWorkshopRect(state, id, { ...descriptor.defaultRect, width: minSize.width, height: minSize.height });
    const siblings = [...settled].filter(other => repaired[other]!.step > 0 && getWorkshopPart(other).set === descriptor.set).map(other => repaired[other]!.rect);
    let chosen: WorkshopRect | undefined;
    // Empty rectangles can slide until an edge meets the canvas or a sibling.
    // Checking those edges is bounded by the set's part count, even at 1px grid.
    for (const size of id === 'common-frame' ? [standard, original, minimum] : [original, standard, minimum]) {
      if (!size || chosen) continue;
      const xs = new Set([size.x, descriptor.defaultRect.x, ...siblings.flatMap(r => [r.x, r.x + r.width, r.x - size.width, r.x + r.width - size.width])]);
      const ys = new Set([size.y, descriptor.defaultRect.y, ...siblings.flatMap(r => [r.y, r.y + r.height, r.y - size.height, r.y + r.height - size.height])]);
      for (const x of xs) {
        for (const y of ys) {
          const rect = normalizeWorkshopRect(state, id, { ...size, x, y });
          if (rect && fits(id, rect)) { chosen = rect; break; }
        }
        if (chosen) break;
      }
    }
    if (chosen) { repaired[id] = { ...part, rect: chosen }; settled.add(id); pending.delete(id); }
    else resetSet(descriptor.set);
  }
  workshop.parts = repaired;
}

export function decodeSave(raw: string, readScene?: (ref:string)=>string): GameState {
  let data: unknown = JSON.parse(raw);
  const stored=data as GameState;
  const inflateShot = (shot:GameState['persistent']['screenshots'][number]) => {
      if('data' in shot)return shot;
      const ref=(shot as unknown as {sceneRef?:unknown}).sceneRef;
      if(typeof ref!=='string'||!readScene)throw new Error('Screenshot assets are required');
      const {sceneRef:_ref,...metadata}=shot as unknown as Record<string,unknown>;return {...metadata,data:readScene(ref)} as unknown as GameState['persistent']['screenshots'][number];
  };
  if(Array.isArray(stored?.persistent?.screenshots)) {
    stored.persistent.screenshots=stored.persistent.screenshots.map(inflateShot);
  }
  if(Array.isArray(stored?.persistent?.products))stored.persistent.products=stored.persistent.products.map(product=>({...product,
    ...(Array.isArray(product.screenshots)?{screenshots:product.screenshots.map(inflateShot)}:{}),
    ...(product.capture?{capture:inflateShot(product.capture)}:{}),
    ...(Array.isArray(product.captureCatalog)?{captureCatalog:product.captureCatalog.map(inflateShot)}:{}),
  }));
  const versionOf = (value: unknown): number => {
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value)
      || !Number.isSafeInteger(value.schemaVersion)) throw new Error('保存形式を確認できません');
    return value.schemaVersion as number;
  };
  let version = versionOf(data);
  if (version > SCHEMA_VERSION) throw new Error('新しい版で保存されたデータです');
  if (version < SCHEMA_VERSION) {
    if(version<14)data=migrateLegacySave(data);
    if(versionOf(data)===14)data=migrateStage8bSave(data);
    version = versionOf(data);
    if (version !== SCHEMA_VERSION) throw new Error('保存データの変換に失敗しました');
  }
  const candidate=data as GameState;
  if(candidate.run?.desktop){candidate.run.desktop.projects=repairAppProjects(candidate.run.desktop.projects,candidate.run.desktop.apps,candidate.run.desktop.upgrades,candidate.persistent?.desktopPrefs?.skills??[]);if(candidate.run.desktop.editingApp&&!candidate.run.desktop.projects[candidate.run.desktop.editingApp])candidate.run.desktop.editingApp=null;}
  if(candidate.run?.seed&&!isPageDesign(candidate.run.seed.page))candidate.run.seed.page=createPageDesign();
  if(candidate.run&&candidate.run.advice===undefined)candidate.run.advice=createAdviceState();
  repairWorkshopRects(candidate);
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
    const packShot = ({data,...metadata}:GameState['persistent']['screenshots'][number])=>({...metadata,sceneRef:scenes!.put(data)});
    const screenshots=saved.persistent.screenshots.map(packShot);
    const products=saved.persistent.products.map(product=>({...product,
      ...(product.screenshots?{screenshots:product.screenshots.map(packShot)}:{}),
      ...(product.capture?{capture:packShot(product.capture)}:{}),
      ...(product.captureCatalog?{captureCatalog:product.captureCatalog.map(packShot)}:{}),
    }));
    const raw=JSON.stringify({...saved,persistent:{...saved.persistent,screenshots,products}});
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
