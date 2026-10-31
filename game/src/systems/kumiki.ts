import { BALANCE, type KumikiItem, type KumikiSkill, type PartId } from '../config/balance';
import { ICON_IDS, PRACTICE_IDS, iconTemplate, paletteFor, scaleArt } from '../content/kumikiArt';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { blankDrawing, createKumikiState, PART_IDS, type Design, type Drawing, type KumikiGuide, type KumikiState } from './kumikiState';
import type { GameState } from './state';

const withK = (state: GameState, kumiki: KumikiState): GameState => ({ ...state, run: { ...state.run, kumiki } });
export const hasKSkill = (state: GameState, id: KumikiSkill) => state.persistent.artwork.skills.includes(id);
export function kGuide(state: GameState, id: KumikiGuide): GameState {
  const k = state.run.kumiki;
  if (k.guide.seen.includes(id) || state.run.version !== 'v0.1') return state;
  return withK(state, { ...k, guide: { ...k.guide, seen: [...k.guide.seen, id], current: id, collapsed: false } });
}
export function enterKumiki(state: GameState): GameState {
  if (state.run.kumiki.entered) return state;
  const k = { ...createKumikiState(), entered: true, enteredAt: state.elapsedMs,
    lastActionAt: state.elapsedMs, underlays: structuredClone(state.persistent.artwork.icons) };
  let next: GameState = { ...state, run: { ...state.run, world: 'kumiki', kumiki: k } };
  next = prepareDrawing(next, 'folder');
  next = kGuide(kGuide(next, 'entered'), 'draw');
  return withK(next, { ...next.run.kumiki, guide: { ...next.run.kumiki.guide, current: next.run.version === 'v0.1' ? 'entered' : null } });
}
const UNLOCKS = [null, 'button', 'switch', 'slider', 'input', 'frame'] as const;
export function availableIcons(state: GameState): string[] {
  const result: string[] = [];
  for (const [index, id] of ICON_IDS.entries()) {
    if (UNLOCKS[index] && !state.run.kumiki.built.includes(UNLOCKS[index]!)) break;
    result.push(id);
    if (!state.run.kumiki.drawings[id]?.exported) break;
  }
  return state.run.kumiki.built.includes('frame') ? [...result, ...PRACTICE_IDS] : result;
}
export function drawingFor(state: GameState, id: string): Drawing | undefined {
  return id === 'free' ? state.persistent.artwork.sketchbook : state.run.kumiki.drawings[id];
}
export function targetFor(state: GameState, id: string, size: number): number[] {
  if (id === 'free') return Array<number>(size * size).fill(-1);
  const previous = state.run.kumiki.underlays[id];
  return previous ? scaleArt(previous.frames[0]!, previous.size, size) : iconTemplate(id, size);
}
export function completeDrawing(state: GameState, id: string): boolean {
  const drawing = drawingFor(state, id);
  if (!drawing || id === 'free') return false;
  const target = targetFor(state, id, drawing.size);
  return target.some(c => c >= 0) && target.every((c, i) => c < 0 || drawing.frames[0]![i] === c);
}
function storeDrawing(state: GameState, id: string, drawing: Drawing): GameState {
  return id === 'free' ? { ...state, persistent: { ...state.persistent, artwork: { ...state.persistent.artwork, sketchbook: drawing } } }
    : withK(state, { ...state.run.kumiki, drawings: { ...state.run.kumiki.drawings, [id]: drawing } });
}
export function prepareDrawing(state: GameState, id: string): GameState {
  if (id === 'free' || drawingFor(state, id) || !availableIcons(state).includes(id)) return state;
  const drawing = blankDrawing(BALANCE.spec.resolution[state.persistent.specs.resolution]!.grid);
  const stored = storeDrawing(state, id, drawing);
  let next = withK(stored, { ...stored.run.kumiki, activeDrawing: id });
  if (hasKSkill(next, 'outline')) {
    const target = targetFor(next, id, drawing.size);
    const points = target.flatMap((c, i) => c >= 0 && [i % drawing.size === 0 ? -1 : i - 1,
      i % drawing.size === drawing.size - 1 ? -1 : i + 1, i - drawing.size, i + drawing.size]
      .some(p => p < 0 || p >= target.length || target[p] === -1) ? [i] : []);
    for (const color of new Set(points.map(i => target[i]!))) next = paintDrawing(next, id, points.filter(i => target[i] === color), color);
  }
  return next;
}

export function paintDrawing(state: GameState, id: string, cells: readonly number[], color: number, frame = 0, mirror = false): GameState {
  if (state.run.world !== 'kumiki' || !Number.isInteger(color) || color < -1 || color >= paletteFor(state.persistent.specs.color).length) return state;
  const drawing = drawingFor(state, id);
  if (!drawing || !drawing.frames[frame] || frame > 0 && !hasKSkill(state, 'animation')) return state;
  const next = { ...drawing, frames: drawing.frames.map(f => [...f]), rewarded: [...drawing.rewarded], dirty: true };
  const target = targetFor(state, id, drawing.size);
  const indices = new Set(cells.filter(i => Number.isInteger(i) && i >= 0 && i < target.length));
  if (mirror && hasKSkill(state, 'mirror')) for (const i of [...indices]) indices.add(Math.floor(i / drawing.size) * drawing.size + drawing.size - 1 - i % drawing.size);
  let earned = 0;
  for (const i of indices) {
    next.frames[frame]![i] = color;
    if (id !== 'free' && color >= 0 && target[i] === color && !next.rewarded[i]) { next.rewarded[i] = true; earned++; }
  }
  let result = storeDrawing(state, id, next);
  result = withK(result, { ...result.run.kumiki, lastActionAt: result.elapsedMs });
  const focus = result.run.kumiki.placed.includes('switch') && result.run.kumiki.focus;
  result = creditPixels(result, earned * BALANCE.w2.dotValue * BALANCE.spec.color[state.persistent.specs.color]!.multiplier * (focus ? BALANCE.w2.focusMultiplier : 1));
  return id === 'folder' && completeDrawing(result, id) ? kGuide(result, 'complete') : result;
}
export function fillDrawing(state: GameState, id: string, cell: number, color: number, frame = 0): GameState {
  if (!hasKSkill(state, 'fill')) return state;
  const drawing = drawingFor(state, id);
  const pixels = drawing?.frames[frame];
  if (!drawing || !pixels || !Number.isInteger(cell) || cell < 0 || cell >= pixels.length) return state;
  const source = pixels[cell];
  const pending = [cell], visited = new Set<number>();
  while (pending.length) {
    const i = pending.pop()!;
    if (visited.has(i) || pixels[i] !== source) continue;
    visited.add(i);
    if (i % drawing.size > 0) pending.push(i - 1);
    if (i % drawing.size < drawing.size - 1) pending.push(i + 1);
    if (i >= drawing.size) pending.push(i - drawing.size);
    if (i + drawing.size < pixels.length) pending.push(i + drawing.size);
  }
  return paintDrawing(state, id, [...visited], color, frame);
}
export function restoreDrawing(state: GameState, id: string, frames: number[][]): GameState {
  const drawing = drawingFor(state, id);
  if (!drawing || !frames.length || frames.length > drawing.frames.length || frames.some(f => f.length !== drawing.size ** 2 || f.some(c => !Number.isInteger(c) || c < -1 || c >= paletteFor(state.persistent.specs.color).length))) return state;
  // 戻す・やり直すは絵だけ。稼いだマスの記録と資源は巻き戻さない。
  return storeDrawing(state, id, { ...drawing, frames: drawing.frames.map((f, index) => [...(frames[index] ?? f)]), dirty: true });
}
export function addAnimationFrame(state: GameState, id: string): GameState {
  const drawing = drawingFor(state, id);
  return !hasKSkill(state, 'animation') || !drawing || drawing.frames.length === 2 ? state
    : storeDrawing(state, id, { ...drawing, frames: [...drawing.frames, [...drawing.frames[0]!]], dirty: true });
}
export function nextKumikiItem(state: GameState): KumikiItem | null {
  return BALANCE.w2.items.find(item => !state.run.kumiki.built.includes(item.id))?.id ?? null;
}
export function buildKumiki(state: GameState, id: KumikiItem): GameState {
  const item = BALANCE.w2.items.find(item => item.id === id);
  if (state.run.world !== 'kumiki' || nextKumikiItem(state) !== id || !item || state.resources.pixels < item.cost) return state;
  let next = withK({ ...state, resources: { ...state.resources, pixels: state.resources.pixels - item.cost } },
    { ...state.run.kumiki, built: [...state.run.kumiki.built, id], lastActionAt: state.elapsedMs });
  if (id === 'input') next = kGuide(next, 'name');
  if (id === 'taskbar' && state.persistent.specs.color === 0) {
    next = withK(next, { ...next.run.kumiki, exitInspected: true });
    next = kGuide(next, 'wall');
  }
  return next;
}
export function ownedParts(state: GameState): PartId[] {
  const built = state.run.kumiki.built;
  return PART_IDS.filter(id => id === 'tabs' || id === 'table' ? hasKSkill(state, 'extraParts') : built.includes(id));
}
export function placePart(state: GameState, part: PartId): GameState {
  if (state.run.world !== 'kumiki' || !ownedParts(state).includes(part) || state.run.kumiki.placed.includes(part)) return state;
  return withK(state, { ...state.run.kumiki, placed: [...state.run.kumiki.placed, part], lastActionAt: state.elapsedMs });
}
export function exportable(state: GameState): { icons: string[]; parts: PartId[] } {
  return { icons: availableIcons(state).filter(id => completeDrawing(state, id) && drawingFor(state, id)!.dirty),
    parts: ownedParts(state).filter(id => !state.run.kumiki.exports.some(work => work.kind === 'part' && work.id === id)) };
}
export function exportKumiki(state: GameState, now: number): GameState {
  if (state.run.world !== 'kumiki') return state;
  const ready = exportable(state);
  if (!ready.icons.length && !ready.parts.length) return state;
  const next = structuredClone(state);
  let tokens = 0;
  const customName = next.run.kumiki.placed.includes('input') ? next.run.kumiki.exportName.trim().slice(0, BALANCE.w2.maxName) : '';
  for (const id of ready.icons) {
    const drawing = next.run.kumiki.drawings[id]!;
    if (!drawing.exported && ICON_IDS.some(icon => icon === id)) tokens += BALANCE.spec.resolution[state.persistent.specs.resolution]!.tokens;
    drawing.exported = true; drawing.dirty = false;
    drawing.name = customName || drawing.name;
    next.persistent.artwork.icons[id] = structuredClone(drawing);
    const work = { kind: 'icon' as const, id, name: drawing.name, at: now, size: drawing.size, frames: structuredClone(drawing.frames) };
    const index = next.run.kumiki.exports.findIndex(item => item.kind === 'icon' && item.id === id);
    if (index < 0) next.run.kumiki.exports.push(work); else next.run.kumiki.exports[index] = work;
  }
  for (const id of ready.parts) {
    tokens += BALANCE.w2.partTokens;
    next.run.kumiki.exports.push({ kind: 'part', id, name: customName || null, at: now, size: 0, frames: [] });
  }
  next.resources.tokens += tokens;
  next.run.kumiki.tokenDiscovered = true;
  next.run.kumiki.lastActionAt = next.elapsedMs;
  return kGuide(next, 'export');
}
export function buyKumikiSkill(state: GameState, id: KumikiSkill): GameState {
  const skill = BALANCE.w2.skills.find(skill => skill.id === id);
  if (!state.run.kumiki.built.includes('extensions') || !skill || hasKSkill(state, id) || skill.band === 2 && state.run.version === 'v0.1' || state.resources.tokens < skill.cost) return state;
  const artwork = { ...state.persistent.artwork, skills: [...state.persistent.artwork.skills, id] };
  if (id === 'expand') {
    const old = artwork.sketchbook;
    const expanded = blankDrawing(32);
    if (old.size < 32) {
      expanded.frames = old.frames.map(frame => {
        const larger = Array<number>(32 * 32).fill(-1);
        for (let y = 0; y < old.size; y++) for (let x = 0; x < old.size; x++) larger[y * 32 + x] = frame[y * old.size + x]!;
        return larger;
      });
      artwork.sketchbook = expanded;
    }
  }
  if (id === 'modern') artwork.modern = true;
  return { ...state, resources: { ...state.resources, tokens: state.resources.tokens - skill.cost }, persistent: { ...state.persistent, artwork } };
}
export function flushHomeBank(state: GameState): GameState {
  const next = creditPixels(state, state.run.kumiki.bank);
  return withK(next, { ...next.run.kumiki, bank: 0, batchMs: 0 });
}
export function configureKumiki(state: GameState, change: Partial<Pick<KumikiState, 'focus' | 'interval' | 'exportName' | 'homeWindow'>>): GameState {
  if (change.focus !== undefined && !state.run.kumiki.placed.includes('switch')
    || change.interval !== undefined && (!state.run.kumiki.placed.includes('slider') || !Number.isInteger(change.interval) || change.interval < BALANCE.w2.intervalMin || change.interval > BALANCE.w2.intervalMax)) return state;
  const next = change.focus !== undefined || change.interval !== undefined ? flushHomeBank(state) : state;
  return withK(next, { ...next.run.kumiki, ...change, exportName: (change.exportName ?? next.run.kumiki.exportName).slice(0, BALANCE.w2.maxName), lastActionAt: state.elapsedMs });
}
export function changeDesign(state: GameState, part: string, design: Design): GameState {
  if (!state.run.kumiki.built.includes('select') || part !== 'primary' && !state.run.kumiki.placed.includes(part as PartId)
    || !paletteFor(state.persistent.specs.color).includes(design.color) || !Number.isFinite(design.radius) || design.radius < 0 || design.radius > 16
    || !['small', 'medium', 'large'].includes(design.textSize)) return state;
  return withK(state, { ...state.run.kumiki, design: { ...state.run.kumiki.design, [part]: design } });
}
export function readKumikiGuide(state: GameState, id: KumikiGuide | 'close'): GameState {
  if (id !== 'close' && !state.run.kumiki.guide.seen.includes(id)) return state;
  const guide = state.run.kumiki.guide;
  const read = [...new Set([...guide.read, ...(guide.current ? [guide.current] : [])])];
  const next = id === 'close' ? guide.seen.find(message => !read.includes(message)) : id;
  return withK(state, { ...state.run.kumiki, guide: { ...guide, read,
    current: next ?? guide.current, collapsed: !next }, lastActionAt: state.elapsedMs });
}
export function advanceKumikiTimers(state: GameState, ms: number): GameState {
  if (state.run.world !== 'kumiki') return state;
  const k = state.run.kumiki;
  let next = withK(state, { ...k, driftTimerMs: k.driftTimerMs + ms });
  const movable = k.placed.filter(part => part !== 'frame');
  if (!k.drift && movable.length && next.run.kumiki.driftTimerMs >= BALANCE.w2.driftMinMs + (k.exports.length * BALANCE.time.autosaveMs) % (BALANCE.w2.driftMaxMs - BALANCE.w2.driftMinMs)) {
    const step = k.exports.length + k.built.length;
    next = withK(next, { ...next.run.kumiki, driftTimerMs: 0, drift: { part: movable[step % movable.length]!,
      dx: BALANCE.w2.driftMinPx + step % (BALANCE.w2.driftMaxPx - BALANCE.w2.driftMinPx + 1), dy: -BALANCE.w2.driftMinPx,
      angle: BALANCE.w2.driftAngle } });
  }
  if (state.elapsedMs - k.lastActionAt >= BALANCE.w2.hintMs) next = kGuide(next, 'hint');
  return next;
}
export function repairPart(state: GameState, part: PartId, dx: number, dy: number): GameState {
  const drift = state.run.kumiki.drift;
  if (!drift || drift.part !== part || !hasKSkill(state, 'snap') && Math.hypot(dx + drift.dx, dy + drift.dy) > BALANCE.w2.snapPx) return state;
  const next = creditPixels(state, passivePixelsPerSecond(state) * BALANCE.w2.repairSeconds);
  return withK(next, { ...next.run.kumiki, drift: null, driftTimerMs: 0, lastActionAt: state.elapsedMs });
}
export function prototypeConditions(state: GameState): boolean[] {
  const k = state.run.kumiki;
  return [k.built.includes('button') && k.built.includes('switch'), k.exports.filter(e => e.kind === 'icon' && ICON_IDS.some(id => id === e.id)).length >= 2, k.placed.includes('button')];
}

export type KumikiAction =
  | { type: 'prepare'; id: string }
  | { type: 'paint'; id: string; cells: number[]; color: number; frame: number; mirror: boolean }
  | { type: 'fill'; id: string; cell: number; color: number; frame: number }
  | { type: 'restore'; id: string; frames: number[][] }
  | { type: 'frame'; id: string }
  | { type: 'build'; id: KumikiItem }
  | { type: 'place'; id: PartId }
  | { type: 'export' }
  | { type: 'skill'; id: KumikiSkill }
  | { type: 'configure'; change: Partial<Pick<KumikiState, 'focus' | 'interval' | 'exportName' | 'homeWindow'>> }
  | { type: 'design'; id: string; design: Design }
  | { type: 'guide'; id: KumikiGuide | 'close' }
  | { type: 'repair'; id: PartId; dx: number; dy: number }
  | { type: 'name'; name: string }
  | { type: 'modern'; enabled: boolean }
  | { type: 'wallpaper' }
  | { type: 'extensions' }
  | { type: 'exit' };

export function actKumiki(state: GameState, action: KumikiAction, now: number): GameState {
  if (state.run.world !== 'kumiki') return state;
  switch (action.type) {
    case 'prepare': {
      if (action.id !== 'free' && !availableIcons(state).includes(action.id)) return state;
      const next = prepareDrawing(state, action.id);
      return withK(next, { ...next.run.kumiki, activeDrawing: action.id });
    }
    case 'paint': return paintDrawing(state, action.id, action.cells, action.color, action.frame, action.mirror);
    case 'fill': return fillDrawing(state, action.id, action.cell, action.color, action.frame);
    case 'restore': return restoreDrawing(state, action.id, action.frames);
    case 'frame': return addAnimationFrame(state, action.id);
    case 'build': return buildKumiki(state, action.id);
    case 'place': return placePart(state, action.id);
    case 'export': return exportKumiki(state, now);
    case 'skill': return buyKumikiSkill(state, action.id);
    case 'configure': return configureKumiki(state, action.change);
    case 'design': return changeDesign(state, action.id, action.design);
    case 'guide': return readKumikiGuide(state, action.id);
    case 'repair': return repairPart(state, action.id, action.dx, action.dy);
    case 'name': return !state.run.kumiki.built.includes('input') ? state : { ...state, persistent: { ...state.persistent, playerName: action.name.trim().slice(0, BALANCE.w2.maxName) || null } };
    case 'modern': return !hasKSkill(state, 'modern') ? state : { ...state, persistent: { ...state.persistent, artwork: { ...state.persistent.artwork, modern: action.enabled } } };
    case 'wallpaper': return !hasKSkill(state, 'wallpaper') ? state : { ...state, persistent: { ...state.persistent, artwork: { ...state.persistent.artwork, wallpaper: structuredClone(state.persistent.artwork.sketchbook) } } };
    case 'extensions': return !state.run.kumiki.built.includes('extensions') ? state : kGuide(state, 'extensions');
    case 'exit': return !state.run.kumiki.built.includes('taskbar') ? state : kGuide(withK(state, { ...state.run.kumiki, exitInspected: true }), 'wall');
  }
}
