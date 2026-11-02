import { ADVICE_IDS, createAdviceState, isAdviceState } from './advice';
import { createAppearance } from './appearance';
import { migrateAppProjects } from './appLayout';
import { migrateCaptureV6 } from './captureMigration';
import { createDesktopPreferences, createDesktopState, type DesktopState, type Screenshot } from './desktopState';
import { desktopScreen, LEGACY_DESKTOP, resizeDesktop } from './desktopGeometry';
import { createPlay, createProgress } from './longPlay';
import { createPageDesign } from './pageDesign';
import { normalizeArchivedProduct } from './releaseState';
import { createEditorCustomization, createWorkshopState, WORKSHOP_GUIDE_IDS, type WorkshopGuideId } from './workshopState';

type Data = Record<string, unknown>;
export const legacyRecord = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
const optionalRecord = (value: unknown): Data => legacyRecord(value) ? value : {};
const object = (value: unknown): Data => {
  if (!legacyRecord(value)) throw new Error('保存データの内容が不正です');
  return value;
};
const amount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('保存データの内容が不正です');
  return value;
};
export function legacyStrings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(id => typeof id === 'string') || new Set(value).size !== value.length) throw new Error('保存データの内容が不正です');
  return value;
}

// Historical prices are restitution, not the current, tunable economy. Keep them
// frozen so changing the new workshop cannot change an old player's refund.
export const LEGACY_PART_PRICES: Readonly<Record<string, number>> = Object.freeze({
  select: 4_000, button: 9_000, extensions: 15_000, input: 45_000,
  frame: 65_000, taskbar: 90_000, switch: 20_000, slider: 32_000,
});
export const LEGACY_REMOVED_SKILL_PRICES: Readonly<Record<string, number>> = Object.freeze({
  fill: 2, mirror: 3, expand: 1, outline: 20, animation: 20, wallpaper: 10,
});
export const LEGACY_RETAINED_EDITOR_SKILLS = ['layers', 'eyedropper', 'snap', 'extraParts', 'update', 'modern'] as const;
const OLD_SEED_ITEMS = ['border', 'save', 'color', 'font', 'layout', 'motion', 'kumiki'];
const OLD_EDITOR_SKILLS = [...LEGACY_RETAINED_EDITOR_SKILLS, ...Object.keys(LEGACY_REMOVED_SKILL_PRICES)];

export interface LegacySave13 extends Data {
  schemaVersion: 13;
  run: Data & { seed: Data; kumiki: Data; desktop: DesktopState };
  persistent: Data & { artwork: Data };
  resources: { pixels: number; tokens: number; dollars: number };
}

function historicalProgress(state: LegacySave13): unknown {
  const old = optionalRecord(state.persistent.progress);
  if (Object.keys(old).length) return old;
  const progress = createProgress(), d = state.run.desktop, k = state.run.kumiki;
  const products = Array.isArray(state.persistent.products) ? state.persistent.products.filter(legacyRecord) : [];
  const exports = [...(Array.isArray(k.exports) ? k.exports : []), ...products.flatMap(p => Array.isArray(p.exports) ? p.exports : [])].filter(legacyRecord);
  const icons = exports.filter(e => e.kind === 'icon');
  const built = legacyStrings(state.run.seed.built), skills = legacyStrings(state.persistent.artwork.skills);
  const archivedBuilt = products.flatMap(p => Array.isArray(optionalRecord(p.screen).built) ? optionalRecord(p.screen).built as string[] : []);
  const shots = Array.isArray(state.persistent.screenshots) ? state.persistent.screenshots : [];
  progress.counts.shots = Math.max(shots.length, Number(optionalRecord(state.persistent.desktopPrefs).lastShotId ?? 0));
  progress.counts.feedback = d.feedback.filter(f => f.completedAt !== null).length;
  progress.counts.icons = new Set(icons.map(e => `${e.at}:${e.id}`)).size;
  const known = (id: string) => icons.some(e => e.id === id);
  const cursors = Number(state.run.seed.autoCursors);
  const tests: Record<string, boolean> = {
    'first-pixel': Number(state.run.totalPixelsGenerated) > 0 || products.some(p => Number(p.generatedPixels) > 0),
    'save-created': built.includes('save') || archivedBuilt.includes('save'),
    cursors10: cursors >= 10 || products.some(p => Number(optionalRecord(p.screen).cursors) >= 10),
    cursors50: cursors >= 50 || products.some(p => Number(optionalRecord(p.screen).cursors) >= 50),
    'kumiki-created': built.includes('kumiki') || k.entered === true || products.length > 0,
    'first-export': exports.length > 0,
    icons6: ['folder', 'bin', 'clock', 'mail', 'photo', 'settings'].every(known),
    practice10: ['document', 'image', 'music', 'video', 'archive', 'text', 'chart', 'terminal', 'link', 'star'].every(known),
    'parts-all': ['button', 'input', 'frame', 'taskbar'].every(id => Array.isArray(k.placed) && k.placed.includes(id))
      || products.some(p => ['button', 'input', 'frame', 'taskbar'].every(id => {
        const placed = optionalRecord(p.screen).placed;
        return Array.isArray(placed) && placed.includes(id);
      })),
    'editor-update': skills.includes('update'), 'editor-modern': skills.includes('modern'),
    'desktop-update': Array.isArray(optionalRecord(state.persistent.desktopPrefs).skills) && (optionalRecord(state.persistent.desktopPrefs).skills as string[]).includes('major1'),
    'product-name': !!state.persistent.productName || products.some(p => !!p.name),
    'prototype-released': products.some(p => p.version === 'v0.1'),
    'v1-released': products.some(p => p.version === 'v1.0') || state.run.version === 'v2',
    'first-shot': progress.counts.shots > 0, shots100: progress.counts.shots >= 100,
    feedback10: progress.counts.feedback >= 10, feedback50: progress.counts.feedback >= 50,
    'jobs-full': d.upgrades.includes('jobs') && Object.values(d.jobs).filter(j => j.assigned && j.cursors > 0).length
      >= ([3, 4, 5, 6, 8][Number(optionalRecord(state.persistent.specs).memory)] ?? Infinity)
        + (Array.isArray(optionalRecord(state.persistent.desktopPrefs).skills) && (optionalRecord(state.persistent.desktopPrefs).skills as string[]).includes('posts') ? 1 : 0),
    apps7: d.entered && d.apps.length + 1 >= 7,
    wallpaper: optionalRecord(state.persistent.desktopPrefs).wallpaper !== null,
    terminal: d.terminal.executions > 0,
  };
  for (const [id, earned] of Object.entries(tests)) if (earned) (progress.records as Record<string, number>)[id] = amount(state.lastTickAt);
  return progress;
}

/**
 * Read the published 1–13 envelopes independently of today's game schema.
 * Editable artwork is deliberately not interpreted or palette-converted: it is
 * retired in 14, while captured images have their own immutable scene reader.
 * In particular the historical v3 step must never call the current validator.
 */
export function normalizeLegacySave(value: unknown): LegacySave13 {
  const old = object(value), version = Number(old.schemaVersion);
  if (!Number.isInteger(version) || version < 1 || version > 13) throw new Error('この版の保存データには対応していません');
  const run = object(old.run), persistent = object(old.persistent), seed = object(run.seed), resources = object(old.resources);
  const built = legacyStrings(seed.built);
  if (!built.every(id => OLD_SEED_ITEMS.includes(id))) throw new Error('保存データの内容が不正です');
  const oldK = version < 3 ? optionalRecord(run.kumiki) : object(run.kumiki);
  const k = { entered: false, enteredAt: 0, built: [], placed: [], exports: [], bank: 0, exitInspected: false, tokenDiscovered: false,
    guide: { seen: [], read: [], current: null, collapsed: false }, lastActionAt: 0, ...oldK };
  const artwork: Data = { skills: [], modern: false, ...(version < 3 ? optionalRecord(persistent.artwork) : object(persistent.artwork)) };
  const skills = legacyStrings(artwork.skills);
  if (!skills.every(id => OLD_EDITOR_SKILLS.includes(id))) throw new Error('保存データの内容が不正です');
  legacyStrings(k.built);
  amount(k.bank);
  let desktop = { ...createDesktopState(), ...(version < 6 ? optionalRecord(run.desktop) : object(run.desktop)) } as DesktopState;
  const prefs = { ...createDesktopPreferences(), ...optionalRecord(persistent.desktopPrefs) };
  const shots = Array.isArray(persistent.screenshots) ? persistent.screenshots as Screenshot[] : [];
  if (version <= 7) prefs.lastShotId = Math.max(prefs.lastShotId, ...shots.map(s => s.id));
  if (version <= 7) {
    const defaults = createDesktopState();
    desktop = { ...desktop, upgrades: [...desktop.apps], windows: { ...defaults.windows, ...desktop.windows }, icons: { ...defaults.icons, ...desktop.icons } };
  }
  const appearance = { ...createAppearance(), ...optionalRecord(persistent.appearance) };
  if (version <= 8 && skills.includes('modern')) {
    artwork.skills = [...new Set([...skills, 'update'])];
    prefs.skills = [...new Set([...prefs.skills, 'major1', 'major2'])] as typeof prefs.skills;
    appearance.editor = artwork.modern ? 2 : 0;
    appearance.desktop = 2;
  }
  if (version <= 8) prefs.radiusCustom = prefs.radius !== 8;
  if (version <= 9) desktop = resizeDesktop({ ...desktop, screen: LEGACY_DESKTOP }, desktopScreen(appearance.desktop), prefs.iconSize);
  if (version <= 10) desktop = { ...desktop, editingApp: null, projects: migrateAppProjects(desktop.apps, desktop.upgrades, prefs.skills) };
  if (version <= 6) desktop = { ...desktop, feedback: desktop.feedback.map(f => ({ ...f, sender: f.sender ?? 'hikari' })) };
  const normalized: LegacySave13 = {
    ...old, schemaVersion: 13,
    resources: { pixels: amount(resources.pixels), tokens: amount(resources.tokens), dollars: amount(resources.dollars) },
    run: { ...run, advice: run.advice ?? createAdviceState(), play: run.play ?? createPlay(),
      shipping: run.shipping ?? null, restartMs: run.restartMs ?? 0,
      seed: { page: createPageDesign(), history: [], guide: { seen: [], current: null, collapsed: false }, lastActionAt: 0, installer: null, ...seed },
      kumiki: k, desktop,
    },
    persistent: { seedSkills: [], seedAppearance: { pattern: 'none', marquee: false }, products: [], guideArchive: [],
      productName: null, numberNotation: 'compact', productionNote: null, noteUpdatedAt: null,
      ...persistent, artwork, appearance, desktopPrefs: prefs,
      screenshots: version <= 6 ? shots.map(migrateCaptureV6) : shots,
    },
  };
  normalized.persistent.progress = historicalProgress(normalized);
  return normalized;
}

export function legacyRestitution(old: LegacySave13): { pixels: number; tokens: number; bank: number } {
  const built = legacyStrings(old.run.kumiki.built), skills = legacyStrings(old.persistent.artwork.skills);
  return {
    pixels: built.reduce((sum, id) => sum + (LEGACY_PART_PRICES[id] ?? 0), 0),
    tokens: skills.reduce((sum, id) => sum + (LEGACY_REMOVED_SKILL_PRICES[id] ?? 0), 0),
    bank: amount(old.run.kumiki.bank),
  };
}

const NEW_SEED_ITEMS = ['border', 'save', 'color', 'font', 'layout', 'motion', 'bars', 'workspace', 'export'];
const retiredAdvice: Record<string, string> = { 'editor-draw': 'editor-produce', 'desktop-icons': 'desktop-sets' };
function migrateAdvice(value: unknown): unknown {
  const old = optionalRecord(value), mapId = (id: unknown) => typeof id === 'string' ? retiredAdvice[id] ?? id : null;
  const seen = [...new Set((Array.isArray(old.seen) ? old.seen : []).map(mapId).filter(id => ADVICE_IDS.includes(id as typeof ADVICE_IDS[number])))];
  const current = mapId(old.current);
  // A historical fingerprint includes the retired world's production state.
  const next = { ...createAdviceState(), ...old, seen, current: seen.includes(current) ? current : null, fingerprint: '' };
  return isAdviceState(next) ? next : createAdviceState();
}

/** The only restitution boundary. A schema-14 reload never visits this code. */
export function migrateLegacySave(value: unknown): unknown {
  const old = normalizeLegacySave(value), k = old.run.kumiki;
  const compensation = legacyRestitution(old), pixels = old.resources.pixels + compensation.pixels + compensation.bank;
  const { kumiki: _oldWorkshop, ...run } = old.run;
  const { artwork: _oldArtwork, homeTheme: _oldTheme, homeUpdatedAt: _oldHomeDate, sketchUpdatedAt: _oldSketchDate, ...persistent } = old.persistent;
  const oldBuilt = legacyStrings(old.run.seed.built);
  const entered = oldBuilt.includes('kumiki') || k.entered === true || old.run.world !== 'seed';
  // A completed old editor has already paid its final 12,000-pixel purchase.
  // Partial pages retain their six paid upgrades; only the new three remain.
  const built = entered ? [...NEW_SEED_ITEMS] : [...oldBuilt];
  const history = Array.isArray(old.run.seed.history) ? old.run.seed.history.map(entry => {
    const item = object(entry);
    return { ...item, item: item.item === 'kumiki' ? 'export' : item.item };
  }) : [];
  const installer = legacyRecord(old.run.seed.installer) ? { ...old.run.seed.installer,
    items: legacyStrings(old.run.seed.installer.items).map(id => id === 'kumiki' ? 'export' : id),
  } : old.run.seed.installer;
  const workshop = createWorkshopState();
  workshop.entered = entered;
  workshop.enteredAt = Number(k.enteredAt ?? 0);
  workshop.exitInspected = k.exitInspected === true;
  workshop.tokenDiscovered = k.tokenDiscovered === true || old.resources.tokens > 0;
  workshop.lastActionAt = Number(k.lastActionAt ?? 0);
  const previousGuide = optionalRecord(k.guide), guideIds = Array.isArray(previousGuide.seen) ? previousGuide.seen : [];
  const mapGuide = (id: unknown) => id === 'draw' ? 'place' : id;
  workshop.guide.seen = [...new Set(guideIds.map(mapGuide).filter(id => WORKSHOP_GUIDE_IDS.includes(id as WorkshopGuideId)))] as WorkshopGuideId[];
  const currentGuide = mapGuide(previousGuide.current);
  workshop.guide.current = workshop.guide.seen.includes(currentGuide as WorkshopGuideId) ? currentGuide as WorkshopGuideId : null;
  workshop.guide.collapsed = previousGuide.collapsed === true;
  const editorCustomization = createEditorCustomization();
  const theme = optionalRecord(old.persistent.homeTheme), designs = optionalRecord(k.design);
  const accent = optionalRecord(theme.primary).color ?? optionalRecord(designs.primary).color;
  if (typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent)) editorCustomization.accent = accent;
  const oldProgress = optionalRecord(persistent.progress), { unknownArt, ...progress } = oldProgress;
  const defaults = createProgress();
  const desktop = { ...old.run.desktop,
    photo: { ...old.run.desktop.photo, source: old.run.desktop.photo.source === 'sketch' ? 'coast' : old.run.desktop.photo.source },
    fileSelection: typeof old.run.desktop.fileSelection === 'string' && /^(?:(?:home|sketch)$|(?:icon|part):)/.test(old.run.desktop.fileSelection) ? null : old.run.desktop.fileSelection,
    feedback: old.run.desktop.feedback.map(request => {
      // These requests depended on editable icon pixels, not a live new part.
      const oldKind: string = request.kind;
      const next = oldKind === 'redraw' || oldKind === 'practice' ? { ...request, kind: 'color' as const, target: 'primary' } : { ...request };
      if (next.kind === 'search' && ['home', 'sketch'].includes(next.target)) next.target = 'note';
      return { ...next, baseline: next.kind === 'trash' ? next.baseline : [] };
    }),
  };
  const preferences = optionalRecord(persistent.desktopPrefs), wallpaper = optionalRecord(preferences.wallpaper);
  const guideArchive = Array.isArray(persistent.guideArchive) ? persistent.guideArchive.map(value => {
    const entry = object(value);
    return entry.kind === 'kumiki' && ['draw', 'complete', 'extensions', 'name'].includes(String(entry.id)) ? { ...entry, id: 'entered' } : entry;
  }) : persistent.guideArchive;
  const distinctGuideArchive = Array.isArray(guideArchive) ? guideArchive.filter((entry, index, entries) => entries.findIndex(e => e.kind === entry.kind && e.id === entry.id && e.version === entry.version) === index) : guideArchive;
  return {
    ...old, schemaVersion: 14,
    resources: { ...old.resources, pixels, tokens: old.resources.tokens + compensation.tokens },
    run: { ...run, world: run.world === 'seed' && oldBuilt.includes('kumiki') ? 'kumiki' : run.world,
      advice: migrateAdvice(run.advice), workshop, desktop,
      totalPixelsGenerated: Math.max(Number(run.totalPixelsGenerated) + compensation.bank, pixels),
      seed: { ...run.seed, built, history, installer },
    },
    persistent: { ...persistent, editorCustomization,
      editorSkills: legacyStrings(old.persistent.artwork.skills).filter(id => LEGACY_RETAINED_EDITOR_SKILLS.includes(id as typeof LEGACY_RETAINED_EDITOR_SKILLS[number])),
      setDocuments: [], products: (persistent.products as unknown[]).map(normalizeArchivedProduct), guideArchive: distinctGuideArchive,
      desktopPrefs: { ...preferences, wallpaper: wallpaper.source === 'sketch' ? null : preferences.wallpaper },
      progress: { ...defaults, ...progress, counts: { ...defaults.counts, ...optionalRecord(progress.counts) }, secretPart: progress.secretPart === true || unknownArt !== undefined && unknownArt !== null },
    },
  };
}
