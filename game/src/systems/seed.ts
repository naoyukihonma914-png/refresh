import {tesseraUpdatePending} from './workshopUpdate';
import {contractBlocks} from './longPlay';
import {bulkQuote} from './bulk';
import { recommendedPage } from './pageDesign';
import { BALANCE, type SeedItem, type SeedSkill } from '../config/balance';
import { creditPixels, manualClickValue } from './economy';
import { createInitialState, type GameState, type GuideId } from './state';
import { archiveCompletedSets, enterWorkshop } from './workshop';
import { createEditorCustomization } from './workshopState';
import { desktopStage, editorStage } from './appearance';
import { createDesktopState } from './desktopState';
import { desktopScreen, resizeDesktop } from './desktopGeometry';

export function visibleSeedItems(state: GameState): SeedItem[] {
  const { built } = state.run.seed;
  return BALANCE.w1.items.filter(item => !built.includes(item.id)&&!contractBlocks(state,item.id))
    .slice(0, built.includes('layout') ? BALANCE.w1.previewItems : 1).map(item => item.id);
}

export const seedCursorQuote=(s:GameState)=>bulkQuote(s,BALANCE.w1.cursor_cost,BALANCE.w1.cursor_growth,s.run.seed.autoCursors);
export function cursorPrice(state: GameState): number {
  return Math.ceil(BALANCE.w1.cursor_cost * BALANCE.w1.cursor_growth ** state.run.seed.autoCursors);
}

export function canBuildSeed(state: GameState, id: SeedItem | 'cursor'): boolean {
  if (state.run.world === 'release' || state.run.seed.installer || state.run.restartMs > 0) return false;
  if (id === 'cursor') {const q=seedCursorQuote(state);return !contractBlocks(state,'cursor')&&state.run.seed.built.includes('save')&&q.count>0&&state.run.seed.autoCursors+q.count<=BALANCE.longPlay.cursorLimit&&state.resources.pixels>=q.cost;}
  const deferredColor = id === 'color' && state.run.play.contract?.id === 'no-color' && state.run.play.contract.status === 'complete';
  if (state.run.world !== 'seed' && !deferredColor) return false;
  const next = visibleSeedItems(state)[0];
  const item = BALANCE.w1.items.find(item => item.id === id);
  return !!item && id === next && state.resources.pixels >= item.cost;
}

function addGuide(state: GameState, id: GuideId): GameState {
  const seed = state.run.seed;
  if (seed.guide.seen.includes(id) || state.run.version !== 'v0.1') return state;
  return { ...state, run: { ...state.run, seed: { ...seed,
    guide: { seen: [...seed.guide.seen, id], current: id, collapsed: false },
  } } };
}

export function updateSeedGuide(state: GameState): GameState {
  let next = state;
  if (state.run.seed.built.includes('color')) next = addGuide(next, 'intro');
  if (visibleSeedItems(state).includes('export')) next = addGuide(next, 'tool');
  if (state.run.seed.built.includes('color') && state.elapsedMs - state.run.seed.lastActionAt >= BALANCE.w1.hintAfterMs
    && !state.run.seed.built.includes('export')) next = addGuide(next, 'hint');
  return next;
}

export function buildSeed(state: GameState, id: SeedItem | 'cursor', now: number): GameState {
  if (!canBuildSeed(state, id)) return state;
  const seed = state.run.seed;
  const quantity=id==='cursor'?seedCursorQuote(state).count:1;
  const cost = id === 'cursor' ? seedCursorQuote(state).cost : BALANCE.w1.items.find(item => item.id === id)!.cost;
  const next = updateSeedGuide({ ...state,
    resources: { ...state.resources, pixels: Math.max(0, state.resources.pixels - cost) },
    run: { ...state.run, seed: { ...seed,
      page:id==='layout'?{...seed.page,layout:seed.page.layout??recommendedPage()}:seed.page,
      built: id === 'cursor' ? seed.built : [...seed.built, id],
      autoCursors: seed.autoCursors + (id === 'cursor' ? quantity : 0),
      history: [...seed.history, { item: id, at: now }], lastActionAt: state.elapsedMs,
    } },
  });
  return id === 'export' ? enterWorkshop(next) : next;
}

export interface Momentum { value: number; lastPressAt: number | null }
export const freshMomentum = (): Momentum => ({ value: 1, lastPressAt: null });

export function momentumAt(momentum: Momentum, now: number): number {
  if (momentum.lastPressAt === null) return 1;
  const remaining = Math.max(0, 1 - Math.max(0, now - momentum.lastPressAt) / BALANCE.w1.momentum.decayMs);
  return 1 + (momentum.value - 1) * remaining;
}

export function pressSeed(state: GameState, momentum: Momentum, now: number) {
  if (state.run.world === 'release' || state.run.seed.installer || state.run.restartMs > 0) return { state, momentum, pixels: 0 };
  const motion = state.run.seed.built.includes('motion');
  const decayed = motion ? momentumAt(momentum, now) : 1;
  const value = motion && momentum.lastPressAt !== null && now - momentum.lastPressAt <= BALANCE.w1.momentum.chainMs
    ? Math.min(BALANCE.w1.momentum.max, decayed + BALANCE.w1.momentum.increment) : decayed;
  const pixels = manualClickValue(state) * value;
  const next = creditPixels(state, pixels);
  const preBorder=state.run.world==='seed'&&!state.run.seed.built.includes('border')?1:0;
  return { state: { ...next,persistent:{...next.persistent,progress:{...next.persistent.progress,counts:{...next.persistent.progress.counts,preBorder:next.persistent.progress.counts.preBorder+preBorder}}}, run: { ...next.run, seed: { ...next.run.seed, lastActionAt: next.elapsedMs } } },
    momentum: { value, lastPressAt: now }, pixels };
}

export function readGuide(state: GameState, id: GuideId | 'close' | 'listen'): GameState {
  if (id === 'listen') return addGuide({ ...state, run: { ...state.run, seed: { ...state.run.seed, lastActionAt: state.elapsedMs } } }, 'instructions');
  const seed = state.run.seed;
  if (id !== 'close' && !seed.guide.seen.includes(id)) return state;
  return { ...state, run: { ...state.run, seed: { ...seed,
    lastActionAt: state.elapsedMs,
    guide: { ...seed.guide, current: id === 'close' ? seed.guide.current : id, collapsed: id === 'close' },
  } } };
}

export function applySeedSkills(state: GameState, selected: readonly SeedSkill[], pattern: GameState['persistent']['seedAppearance']['pattern'], marquee: boolean): GameState {
  const skills = [...new Set(selected)];
  if (skills.some(id => !BALANCE.w1.skills.some(skill => skill.id === id))) return state;
  const additions = BALANCE.w1.skills.filter(skill => skills.includes(skill.id) && !state.persistent.seedSkills.includes(skill.id));
  if (additions.some(skill => skill.band === 2 && state.run.version === 'v0.1')) return state;
  const cost = additions.reduce((sum, skill) => sum + skill.cost, 0);
  if (cost > state.resources.tokens || cost>0&&tesseraUpdatePending(state)) return state;
  const owned = [...state.persistent.seedSkills, ...additions.map(skill => skill.id)];
  return { ...state, resources: { ...state.resources, tokens: state.resources.tokens - cost },
    run: { ...state.run, seed: { ...state.run.seed, lastActionAt: state.elapsedMs } },
    persistent: { ...state.persistent, seedSkills: owned, seedAppearance: {
      ...state.persistent.seedAppearance,
      pattern: owned.includes('pattern') ? pattern : 'none', marquee: owned.includes('marquee') && marquee,
    } },
  };
}

// リリース後の作り直し。永続データを複製し、今の構成だけを初期化する。
export function createSeedVersion(previous: GameState, version: 'v1' | 'v2', now: number): GameState {
  const next = createInitialState(now);
  const archived=archiveCompletedSets(previous,now);
  next.run.version = version;
  next.persistent = {...structuredClone({...archived.persistent,screenshots:[]}),screenshots:[...previous.persistent.screenshots]};
  // Appearance is permanent, but desktop contents and window positions belong to the old version.
  const screen = desktopScreen(desktopStage(next));
  next.run.desktop = resizeDesktop(createDesktopState(screen), screen, next.persistent.desktopPrefs.iconSize);
  next.resources.tokens = previous.resources.tokens;
  next.resources.dollars = previous.resources.dollars;
  if(version==='v2'&&next.persistent.progress.selected&&next.persistent.progress.records['v1-released']!==undefined){next.run.play.contract={id:next.persistent.progress.selected,status:'active'};next.persistent.progress.selected=null;}
  const stage=editorStage(next),standard=createEditorCustomization(stage),presets=structuredClone(previous.persistent.editorCustomization.presets);
  if (previous.persistent.seedSkills.includes('inherit')) {
    next.run.seed.page=structuredClone(previous.run.seed.page);
    if((previous.run.workshop.editorStageAtEntry??editorStage(previous))!==stage){
      next.persistent.editorCustomization={...next.persistent.editorCustomization,
        bandPosition:standard.bandPosition,panelWidth:standard.panelWidth,docking:standard.docking,
        panelPositions:standard.panelPositions,panelWidths:standard.panelWidths};
      next.run.seed.page.layout=null;
    }
  } else next.persistent.editorCustomization = {...standard,presets};
  // The skill carries the chosen editor design, never already purchased construction parts.
  next.run.seed.installer = null;
  return next;
}

export function advanceSeedInstaller(state: GameState, activeMs: number): GameState {
  void activeMs;
  return state.run.seed.installer ? { ...state, run: { ...state.run, seed: { ...state.run.seed, installer: null } } } : state;
}

/** Only already-made page UI can be bought in a batch on later versions. */
export function knownSeedItems(state:GameState):SeedItem[] {
  if(state.run.version==='v0.1')return [];
  const known=new Set<string>([
    ...state.persistent.products.flatMap(product=>product.screen.built),
    ...state.run.seed.history.map(entry=>entry.item),
  ]);
  return BALANCE.w1.items.filter(item=>known.has(item.id)).map(item=>item.id);
}

export interface SeedReplayQuote {
  /** The affordable prefix that this click will actually build. */
  items:SeedItem[];
  cost:number;
  /** The continuous known route ahead; an unfamiliar UI stops the batch. */
  remaining:SeedItem[];
  totalCost:number;
}
function replayKnownSeed(state:GameState,now:number):{quote:SeedReplayQuote;state:GameState} {
  const quote:SeedReplayQuote={items:[],cost:0,remaining:[],totalCost:0};
  if(state.run.world!=='seed'||state.run.version==='v0.1'||state.run.seed.installer||state.run.restartMs>0)return {quote,state};
  const known=new Set(knownSeedItems(state));
  for(const item of BALANCE.w1.items){
    if(state.run.seed.built.includes(item.id)||contractBlocks(state,item.id))continue;
    if(!known.has(item.id))break;
    quote.remaining.push(item.id);quote.totalCost+=item.cost;
  }
  let next=state;
  for(const id of quote.remaining){
    if(!canBuildSeed(next,id))break;
    const built=buildSeed(next,id,now);
    if(built===next)break;
    next=built;quote.items.push(id);quote.cost+=BALANCE.w1.items.find(item=>item.id===id)!.cost;
    if(next.run.world!=='seed')break;
  }
  return {quote,state:next};
}

/** Quotes execute only pure construction reducers; the input and its records remain unchanged. */
export function seedReplayQuote(state:GameState):SeedReplayQuote {
  return replayKnownSeed(state,state.lastTickAt).quote;
}

/** Preserve normal prices, order, history and the editor-start transition. Never grants free UI. */
export function buildKnownSeed(state:GameState,now:number):GameState {
  return replayKnownSeed(state,now).state;
}
