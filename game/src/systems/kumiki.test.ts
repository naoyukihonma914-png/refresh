import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { ICON_IDS, PRACTICE_IDS, paletteFor } from '../content/kumikiArt';
import { createFixture } from './fixtures';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { actKumiki, advanceKumikiTimers, availableIcons, buildKumiki, buyKumikiSkill, changeDesign, completeDrawing, configureKumiki, enterKumiki, exportKumiki, fillDrawing, ownedParts, paintDrawing, placePart, prepareDrawing, prototypeConditions, readKumikiGuide, repairPart, restoreDrawing, targetFor } from './kumiki';
import { createSeedVersion } from './seed';
import { advanceActiveTime, advanceOfflineTime } from './time';
import { decodeSave, encodeSave } from './save';
import { isGameState, createInitialState } from './state';
import type { GameState } from './state';

const now = 1_800_000_000_000;
const early = () => creditPixels(createFixture('kumiki-early', now)!, 2_000_000);
function through(id: string) {
  let state = early();
  for (const item of BALANCE.w2.items) { state = buildKumiki(state, item.id); if (item.id === id) break; }
  return state;
}
function finish(state: GameState, id: string) {
  let next = prepareDrawing(state, id);
  const target = targetFor(next, id, next.run.kumiki.drawings[id]!.size);
  for (const color of new Set(target.filter(c => c >= 0))) next = paintDrawing(next, id, target.flatMap((c, i) => c === color ? [i] : []), color);
  return next;
}

describe('組木の描画と書き出し', () => {
  it('パレットは16色と256色で重複なく用意する', () => {
    expect(paletteFor(0)).toHaveLength(16);
    expect(paletteFor(1)).toHaveLength(256);
    expect(new Set(paletteFor(1)).size).toBe(256);
  });

  it('最初の案内を閉じると描き方が続き、読了済みを保存して読み返せる', () => {
    let state = early();
    expect(state.run.kumiki.guide.current).toBe('entered');
    state = readKumikiGuide(state, 'close');
    expect(state.run.kumiki.guide.current).toBe('draw');
    expect(state.run.kumiki.guide.collapsed).toBe(false);
    state = readKumikiGuide(state, 'close');
    expect(state.run.kumiki.guide.collapsed).toBe(true);
    state = decodeSave(encodeSave(state));
    expect(state.run.kumiki.guide.read).toEqual(['entered', 'draw']);
    expect(readKumikiGuide(state, 'entered').run.kumiki.guide.seen).toEqual(['entered', 'draw']);
  });
  it('入った直後はフォルダだけで、下絵の正しい色だけを一度ずつ報酬にする', () => {
    let state = early(); const before = state.resources.pixels;
    expect(availableIcons(state)).toEqual(['folder']);
    const target = targetFor(state, 'folder', 16), cell = target.findIndex(c => c >= 0), blank = target.findIndex(c => c < 0);
    state = paintDrawing(state, 'folder', [cell, blank], (target[cell]! + 1) % 16);
    expect(state.resources.pixels).toBe(before);
    state = paintDrawing(state, 'folder', [cell], target[cell]!);
    expect(state.resources.pixels).toBe(before + 10);
    state = paintDrawing(state, 'folder', [cell], -1);
    state = restoreDrawing(state, 'folder', [Array<number>(256).fill(-1)]);
    state = paintDrawing(state, 'folder', [cell], target[cell]!);
    expect(state.resources.pixels).toBe(before + 10);
    expect(state.run.kumiki.drawings.folder!.rewarded[cell]).toBe(true);
  });

  it('枠外・不正な色を無視し、自由帳ではどれだけ描いても稼がない', () => {
    let state = early(); const before = state.resources.pixels;
    expect(paintDrawing(state, 'folder', [0], 16)).toBe(state);
    state = paintDrawing(state, 'free', [-1, 0, 8, 9999], 6);
    expect(state.resources.pixels).toBe(before);
    expect(state.persistent.artwork.sketchbook.frames[0]![0]).toBe(6);
    const next = createSeedVersion(state, 'v1', now);
    expect(next.persistent.artwork.sketchbook).toEqual(state.persistent.artwork.sketchbook);
  });

  it('未完成は書き出せず、完成品のトークンは一度だけ。再編集しても二重にもらえない', () => {
    let state = early();
    expect(exportKumiki(state, now)).toBe(state);
    state = finish(state, 'folder');
    expect(completeDrawing(state, 'folder')).toBe(true);
    state = exportKumiki(state, now);
    expect(state.resources.tokens).toBe(1);
    expect(state.run.kumiki.exports).toHaveLength(1);
    expect(exportKumiki(state, now)).toBe(state);
    const cell = targetFor(state, 'folder', 16).findIndex(c => c >= 0);
    const color = targetFor(state, 'folder', 16)[cell]!;
    state = paintDrawing(state, 'folder', [cell], -1);
    state = paintDrawing(state, 'folder', [cell], color);
    state = exportKumiki(state, now + 1);
    expect(state.resources.tokens).toBe(1);
    expect(state.run.kumiki.exports).toHaveLength(1);
  });

  it('購入と前の書き出しに応じて下絵が1つずつ届く。練習用はトークンなし', () => {
    let state = through('taskbar');
    expect(availableIcons(state).filter(id => ICON_IDS.some(icon => icon === id))).toEqual(['folder']);
    for (const id of ICON_IDS) { state = finish(state, id); state = exportKumiki(state, now); }
    expect(availableIcons(state)).toEqual([...ICON_IDS, ...PRACTICE_IDS]);
    const tokens = state.resources.tokens, before = state.resources.pixels;
    state = finish(state, PRACTICE_IDS[0]); state = exportKumiki(state, now);
    expect(state.resources.pixels).toBeGreaterThan(before);
    expect(state.resources.tokens).toBe(tokens);
    expect(state.run.kumiki.exports.filter(e => e.kind === 'icon')).toHaveLength(7);
  });

  it('32マスの下絵と解像度に応じたトークン、次のバージョンの下絵を保つ', () => {
    let state = early(); state.persistent.specs.resolution = 1;
    state = { ...state, run: { ...state.run, kumiki: { ...state.run.kumiki, drawings: {} } } };
    state = finish(state, 'folder'); state = exportKumiki(state, now);
    expect(state.run.kumiki.drawings.folder!.size).toBe(32);
    expect(state.resources.tokens).toBe(2);
    const next = enterKumiki(createSeedVersion(state, 'v1', now + 1));
    expect(next.run.kumiki.underlays.folder!.size).toBe(32);
    expect(next.run.kumiki.drawings.folder!.rewarded.every(v => !v)).toBe(true);
  });
});

describe('部品・拡張機能と生成', () => {
  it('購入の飛ばし・不足・二重購入を拒み、置いた後だけ自動生成が増える', () => {
    let state = early();
    expect(buildKumiki(state, 'button')).toBe(state);
    const poor = { ...state, resources: { ...state.resources, pixels: 0 } };
    expect(buildKumiki(poor, 'select')).toBe(poor);
    state = buildKumiki(state, 'select'); state = buildKumiki(state, 'button');
    const rate = passivePixelsPerSecond(state);
    expect(buildKumiki(state, 'button')).toBe(state);
    expect(placePart(state, 'switch')).toBe(state);
    state = placePart(state, 'button');
    expect(passivePixelsPerSecond(state)).toBe(rate * 1.5);
    expect(placePart(state, 'button')).toBe(state);
  });

  it('廃止した集中・間隔は新規に購入・配置できず、自動生成を止めない',()=>{
    const state=through('input');expect(buildKumiki(state,'switch')).toBe(state);expect(buildKumiki(state,'slider')).toBe(state);expect(placePart(state,'switch')).toBe(state);expect(placePart(state,'slider')).toBe(state);expect(configureKumiki(state,{focus:true})).toBe(state);expect(configureKumiki(state,{interval:10})).toBe(state);expect(passivePixelsPerSecond(state)).toBeGreaterThan(0);
  });
  it('自動生成を連続して受け取り、保存・不在を通して二重に加算しない',()=>{
    let state=placePart(through('input'),'button');const before=state.resources.pixels,rate=passivePixelsPerSecond(state);state=advanceActiveTime(state,9000).state;expect(state.resources.pixels-before).toBeCloseTo(rate*9);state=decodeSave(encodeSave(state));state=advanceActiveTime(state,1000).state;expect(state.resources.pixels-before).toBeCloseTo(rate*10);const off=advanceOfflineTime(state,now+3*3600000);expect(off.pixels).toBeCloseTo(rate*7200);expect(advanceOfflineTime(off.state,now+3*3600000).pixels).toBe(0);
  });
  it('トークン不足・次の帯の先取り・二重課金を拒む', () => {
    let state = through('extensions');
    expect(buyKumikiSkill(state, 'fill')).toBe(state);
    state.resources.tokens = 40;
    expect(buyKumikiSkill(state, 'modern')).toBe(state);
    state = buyKumikiSkill(state, 'fill');
    expect(state.resources.tokens).toBe(38);
    expect(buyKumikiSkill(state, 'fill')).toBe(state);
  });

  it('塗りつぶし・左右対称も報酬を重ねず、取得前には使えない', () => {
    let state = through('extensions'); state.resources.tokens = 10;
    expect(fillDrawing(state, 'folder', 0, 0)).toBe(state);
    state = buyKumikiSkill(buyKumikiSkill(state, 'fill'), 'mirror');
    const before = state.resources.pixels;
    state = fillDrawing(state, 'folder', 0, 0);
    expect(state.resources.pixels).toBeGreaterThan(before);
    const earned = state.resources.pixels;
    state = fillDrawing(state, 'folder', 0, 0);
    expect(state.resources.pixels).toBe(earned);
    state = paintDrawing(state, 'folder', [4], 6, 0, true);
    expect(state.run.kumiki.drawings.folder!.frames[0]![11]).toBe(6);
  });

  it('自由帳拡張で描いたものを保ち、2コマ目や追加部品・壁紙・新調を使える', () => {
    let state = through('extensions'); state.run.version = 'v1'; state.resources.tokens = 200;
    state = paintDrawing(state, 'free', [0], 6);
    state.persistent.desktopPrefs.skills = ['major1','major2'];
    for (const id of ['expand','animation','extraParts','wallpaper','update','modern'] as const) state = buyKumikiSkill(state, id);
    expect(state.persistent.artwork.sketchbook.size).toBe(32);
    expect(state.persistent.artwork.sketchbook.frames[0]![0]).toBe(6);
    state = actKumiki(state, { type: 'frame', id: 'folder' }, now);
    expect(state.run.kumiki.drawings.folder!.frames).toHaveLength(2);
    expect(ownedParts(state)).toContain('tabs');
    state = actKumiki(state, { type: 'wallpaper' }, now);
    expect(state.persistent.artwork.wallpaper!.frames[0]![0]).toBe(6);
    expect(state.persistent.artwork.modern).toBe(true);
    state = actKumiki(state, { type: 'modern', enabled: false }, now);
    expect(state.persistent.artwork.modern).toBe(false);
  });

  it('2コマ描いてから自由帳を広げても両方のコマが残る', () => {
    let state = through('extensions'); state.run.version = 'v1'; state.resources.tokens = 40;
    state = buyKumikiSkill(state, 'animation');
    state = paintDrawing(state, 'free', [0], 3);
    state = actKumiki(state, { type: 'frame', id: 'free' }, now);
    state = paintDrawing(state, 'free', [1], 6, 1);
    state = buyKumikiSkill(state, 'expand');
    expect(state.persistent.artwork.sketchbook.frames).toHaveLength(2);
    expect(state.persistent.artwork.sketchbook.frames[0]![0]).toBe(3);
    expect(state.persistent.artwork.sketchbook.frames[1]![1]).toBe(6);
  });

  it('輪郭の自動描画は新しい下絵にだけ適用し、消しても再報酬にしない', () => {
    let state = through('button'); state.run.version = 'v1';
    state = exportKumiki(finish(state, 'folder'), now);
    state.persistent.artwork.skills.push('outline');
    const before = state.resources.pixels;
    state = prepareDrawing(state, 'bin');
    expect(state.resources.pixels).toBeGreaterThan(before);
    const total = state.resources.pixels;
    expect(prepareDrawing(state, 'bin').resources.pixels).toBe(total);
  });

  it('名前は入力欄の後、設定は選択ツールの後に保存し、部品の書き出しを記録する', () => {
    let state = early();
    expect(actKumiki(state, { type: 'name', name: '名前' }, now)).toBe(state);
    state = through('input');
    state = actKumiki(state, { type: 'name', name: '  作者  ' }, now);
    expect(state.persistent.playerName).toBe('作者');
    state = changeDesign(state, 'primary', { color: '#1f3f7a', radius: 4, textSize: 'large', shadow: true });
    state = placePart(state, 'input'); state = configureKumiki(state, { exportName: '自分のボタン' });
    state = exportKumiki(state, now);
    expect(state.run.kumiki.exports.find(e => e.id === 'button')?.name).toBe('自分のボタン');
    expect(decodeSave(encodeSave(state)).run.kumiki.design.primary?.radius).toBe(4);
  });
});

describe('ずれ直し・段階の境界・保存', () => {
  it('3〜6分で1つだけずれ、不在では進まず、正しく戻した報酬は一度だけ', () => {
    let state = placePart(through('button'), 'button');
    expect(advanceOfflineTime(state, now + 3_600_000).state.run.kumiki.drift).toBeNull();
    state = advanceKumikiTimers(state, BALANCE.w2.driftMaxMs);
    const drift = state.run.kumiki.drift!;
    expect(drift.part).toBe('button');
    expect(advanceKumikiTimers(state, BALANCE.w2.driftMaxMs).run.kumiki.drift).toEqual(drift);
    expect(repairPart(state, 'button', 100, 100)).toBe(state);
    const before = state.resources.pixels, rate = passivePixelsPerSecond(state);
    state = repairPart(state, 'button', -drift.dx, -drift.dy);
    expect(state.resources.pixels - before).toBe(rate * 30);
    expect(repairPart(state, 'button', 0, 0)).toBe(state);
  });

  it('16色の出口で止まり、条件がそろっても出荷・ドル・世界3を始めない', () => {
    let state = through('taskbar'); state = placePart(state, 'button');
    state = exportKumiki(finish(state, 'folder'), now);
    state = exportKumiki(finish(state, 'bin'), now);
    expect(prototypeConditions(state)).toEqual([true, true, true]);
    expect(state.run.kumiki.guide.seen).toContain('wall');
    state = actKumiki(state, { type: 'exit' }, now);
    expect(state.run.world).toBe('kumiki'); expect(state.resources.dollars).toBe(0);
    expect(state.run.version).toBe('v0.1');
  });

  it('第2版の組木購入済みセーブから世界2へ進め、未購入なら素の画面を保つ', () => {
    const previous = createFixture('seed-complete', now)!;
    const old = JSON.parse(encodeSave(previous)); old.schemaVersion = 2;
    delete old.run.kumiki; delete old.persistent.artwork;
    const next = decodeSave(JSON.stringify(old));
    expect(next.run.world).toBe('kumiki'); expect(next.run.kumiki.drawings.folder).toBeDefined();
    const seed = JSON.parse(encodeSave(createInitialState(now))); seed.schemaVersion = 2;
    delete seed.run.kumiki; delete seed.persistent.artwork;
    expect(decodeSave(JSON.stringify(seed)).run.world).toBe('seed');
  });

  it.each(['kumiki-early','kumiki-mature','kumiki-wall','kumiki-modern','kumiki-drift'])('固定状態%sを保存・読み込みできる', name => {
    const state = createFixture(name, now)!;
    expect(isGameState(state)).toBe(true);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it('破損した絵・コマ・報酬記録・設定値を保存として受け付けない', () => {
    const state = early();
    for (const mutate of [
      (s: GameState) => { s.run.kumiki.drawings.folder!.frames[0]!.pop(); },
      (s: GameState) => { s.run.kumiki.drawings.folder!.rewarded = []; },
      (s: GameState) => { s.run.kumiki.interval = 11; },
      (s: GameState) => { s.run.kumiki.placed.push('wrong' as 'button'); },
      (s: GameState) => { s.run.kumiki.drawings.unknown = structuredClone(s.run.kumiki.drawings.folder!); },
    ]) {
      const corrupt = structuredClone(state); mutate(corrupt);
      expect(() => decodeSave(JSON.stringify(corrupt))).toThrow();
    }
  });
});
