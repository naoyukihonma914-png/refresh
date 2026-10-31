import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createFixture, FIXTURE_NAMES } from './fixtures';
import { createInitialState, isGameState } from './state';
import { decodeSave, encodeSave, loadGame, saveGame, createMemoryStorage } from './save';
import { advanceActiveTime, advanceOfflineTime } from './time';
import { buildSeed, canBuildSeed, cursorPrice, pressSeed, freshMomentum } from './seed';
import { availableIcons, buildKumiki, configureKumiki, enterKumiki, exportKumiki, ownedParts, paintDrawing, placePart, prepareDrawing, prototypeConditions, targetFor } from './kumiki';
import { passivePixelsPerSecond } from './economy';
import { beginPrototypeRelease, buySpec, canBuySpec, canFundNextVersion, canReleasePrototype, canStartNextVersion, dailySales, displayedSales, productPreviewState, releaseEstimate, shippingComplete, shippingProduct, SPEC_ORDER, startNextVersion } from './release';

const now = 1_800_000_000_000;
const ready = () => createFixture('release-ready', now)!;
const shipped = () => createFixture('release-complete', now)!;

describe('試作版のリリース', () => {
  it('出口の16色の壁と3条件がそろうまではリリースできない', () => {
    const state = ready();
    expect(prototypeConditions(state)).toEqual([true, true, true]);
    expect(canReleasePrototype(state)).toBe(true);
    for (const mutate of [
      (s: typeof state) => { s.run.kumiki.exitInspected = false; },
      (s: typeof state) => { s.run.kumiki.built = s.run.kumiki.built.filter(id => id !== 'switch'); },
      (s: typeof state) => { s.run.kumiki.exports = s.run.kumiki.exports.filter(e => e.kind === 'part'); },
      (s: typeof state) => { s.run.kumiki.placed = s.run.kumiki.placed.filter(id => id !== 'button'); },
      (s: typeof state) => { s.run.version = 'v1'; },
      (s: typeof state) => { s.persistent.specs.color = 1; },
      (s: typeof state) => { s.run.world = 'seed'; },
    ]) {
      const invalid = structuredClone(state); mutate(invalid);
      expect(canReleasePrototype(invalid)).toBe(false);
      expect(beginPrototypeRelease(invalid, now)).toBe(invalid);
    }
  });

  it('累計の生成量と作ったもの・アイコンで売上を計算し、支出や重複エクスポートでは増減しない', () => {
    const state = ready();
    const icons = state.run.kumiki.exports.filter(e => e.kind === 'icon').length;
    const r = BALANCE.release;
    const expected = Math.floor(r.base * (state.run.totalPixelsGenerated / r.pixelUnit) ** r.exponent * (1 + r.perElement * (state.run.seed.built.length + state.run.kumiki.built.length + icons)));
    expect(releaseEstimate(state)).toBe(expected);
    state.resources.pixels = 0;
    state.run.kumiki.exports.push(structuredClone(state.run.kumiki.exports[0]!));
    expect(releaseEstimate(state)).toBe(expected);
  });

  it.each([0, 1, 3, 200, 303, 14_500, 1_000_000])('%iドルを7日へ整数で配分し、初日から減少して合計を保つ', total => {
    const days = dailySales(total);
    expect(days).toHaveLength(7);
    expect(days.reduce((a, b) => a + b, 0)).toBe(total);
    expect(days.every((d, i) => Number.isInteger(d) && d >= 0 && (i === 0 || d <= days[i - 1]!))).toBe(true);
    if (total === 303) expect(days).toEqual([...BALANCE.release.dailyWeights]);
  });

  it('8秒で1日目から順に増え、ドルは出荷時に一度だけ付く。繰り返し出荷や再開では付かない', () => {
    const state = beginPrototypeRelease(ready(), now), product = shippingProduct(state)!;
    expect(product.revenue).toBe(303);
    expect(state.resources.dollars).toBe(product.revenue);
    expect(displayedSales(product, 0)).toEqual([0,0,0,0,0,0,0]);
    const halfDay = displayedSales(product, BALANCE.release.animationMs / 14);
    expect(halfDay[0]).toBe(44); expect(halfDay.slice(1)).toEqual([0,0,0,0,0,0]);
    const done = advanceActiveTime(state, BALANCE.release.animationMs).state;
    expect(displayedSales(product, done.run.shipping!.elapsedMs).reduce((a,b) => a+b, 0)).toBe(product.revenue);
    expect(shippingComplete(done)).toBe(true);
    expect(beginPrototypeRelease(done, now)).toBe(done);
    expect(decodeSave(encodeSave(done)).resources.dollars).toBe(product.revenue);
  });

  it('出荷中は能動生成・不在生成・カーソル購入・手動生成が止まり、不在では売上の演出も進まない', () => {
    const state = beginPrototypeRelease(ready(), now);
    expect(passivePixelsPerSecond(state)).toBe(0);
    expect(canBuildSeed(state, 'cursor')).toBe(false);
    expect(pressSeed(state, freshMomentum(), 0).state).toBe(state);
    const active = advanceActiveTime(state, 2_000).state;
    expect(active.resources).toEqual(state.resources);
    expect(active.run.shipping!.elapsedMs).toBe(2_000);
    const away = advanceOfflineTime(active, now + 24 * BALANCE.time.millisecondsPerHour);
    expect(away.pixels).toBe(0); expect(away.state.run.shipping!.elapsedMs).toBe(2_000);
    expect(away.state.resources).toEqual(active.resources);
  });

  it('スライダーの受け取り待ちも出荷前に精算し、累計と製品へ一度だけ含める', () => {
    const original = ready(); original.run.kumiki.bank = 1_234; original.run.kumiki.batchMs = 2_000;
    const estimate = releaseEstimate(original), next = beginPrototypeRelease(original, now);
    expect(next.run.kumiki.bank).toBe(0); expect(next.run.kumiki.batchMs).toBe(0);
    expect(next.run.totalPixelsGenerated).toBe(original.run.totalPixelsGenerated + 1_234);
    expect(shippingProduct(next)!.screen.pixels).toBe(original.resources.pixels + 1_234);
    expect(shippingProduct(next)!.generatedPixels).toBe(next.run.totalPixelsGenerated);
    expect(next.resources.dollars).toBe(estimate);
  });

  it('製品の画面・作者・エクスポートを独立した記録として残し、後の変更で書き換わらない', () => {
    const before = ready();
    const next = beginPrototypeRelease(before, now);
    const product = shippingProduct(next)!;
    before.run.kumiki.placed.length = 0; before.persistent.specs.color = 3;
    before.run.kumiki.exports[0]!.name = 'Changed';
    expect(product.screen.placed).toContain('button');
    expect(product.screen.specs.color).toBe(0);
    expect(product.exports[0]!.name).not.toBe('Changed');
    expect(product.author).toBe('Aoi');
    const preview = productPreviewState(product);
    expect(preview.resources.pixels).toBe(product.screen.pixels);
    expect(preview.persistent.products).toEqual([]); // スナップショットを再帰的に増やさない
    expect(isGameState(preview)).toBe(true);
  });

  it('売上不足の出荷と、256色の購入分を使い切る買い方を止め、作業を続けられる', () => {
    const low = ready(); low.run.totalPixelsGenerated = 300_000;
    expect(canReleasePrototype(low)).toBe(true);
    expect(canFundNextVersion(low)).toBe(false);
    expect(beginPrototypeRelease(low, now)).toBe(low);
    const state = shipped(); state.resources.dollars = 250;
    expect(canBuySpec(state, 'storage')).toBe(false);
    expect(canBuySpec(state, 'color')).toBe(true);
    expect(canStartNextVersion(state)).toBe(false);
  });

  it('集計後だけ性能を買え、色深度とストレージの支払い・残高・効果を保つ', () => {
    const counting = beginPrototypeRelease(ready(), now);
    expect(buySpec(counting, 'color')).toBe(counting);
    let state = shipped();
    state = buySpec(state, 'color');
    expect(state.resources.dollars).toBe(103); expect(state.persistent.specs.color).toBe(1);
    expect(shippingProduct(state)!.screen.specs.color).toBe(0);
    state = buySpec(state, 'storage');
    expect(state.resources.dollars).toBe(43); expect(state.persistent.specs.storage).toBe(1);
    expect(buySpec(state, 'memory')).toBe(state);
    expect(canStartNextVersion(state)).toBe(true);
  });

  it.each(SPEC_ORDER)('性能%sを順に買い、最大段階では再課金しない', key => {
    let state = createFixture('release-rich', now)!;
    state.resources.dollars = BALANCE.spec[key].reduce((sum, level) => sum + level.price, 0);
    state.persistent.specs.color = key === 'color' ? 0 : 1;
    for (let level = state.persistent.specs[key] + 1; level < BALANCE.spec[key].length; level++) {
      const before = state.resources.dollars;
      state = buySpec(state, key);
      expect(state.persistent.specs[key]).toBe(level);
      expect(before - state.resources.dollars).toBe(BALANCE.spec[key][level]!.price);
    }
    expect(canBuySpec(state, key)).toBe(false); expect(buySpec(state, key)).toBe(state);
  });

  it('作り直しは資源と構成をリセットし、性能・トークン・プラグイン・絵・名前・会話・製品を残す', () => {
    const original = ready();
    original.persistent.seedSkills = ['keyboard', 'history']; original.persistent.artwork.skills = ['fill'];
    original.run.kumiki.design.primary = { color: '#008080', radius: 4, textSize: 'medium', shadow: true };
    const state = advanceActiveTime(beginPrototypeRelease(original, now), BALANCE.release.animationMs).state;
    const next = startNextVersion(buySpec(state, 'color'), now + 1_000);
    expect(next.run.version).toBe('v1'); expect(next.run.world).toBe('seed');
    expect(next.resources.pixels).toBe(0); expect(next.run.totalPixelsGenerated).toBe(0);
    expect(next.run.seed.autoCursors).toBe(0); expect(next.run.seed.built).toEqual([]);
    expect(next.run.kumiki.placed).toEqual([]); expect(next.run.kumiki.exports).toEqual([]);
    expect(next.resources.tokens).toBe(state.resources.tokens); expect(next.resources.dollars).toBe(103);
    expect(next.persistent.seedSkills).toEqual(['keyboard', 'history']); expect(next.persistent.artwork.skills).toEqual(['fill']);
    expect(next.persistent.artwork.icons).toEqual(state.persistent.artwork.icons);
    expect(next.persistent.products).toEqual(state.persistent.products); expect(next.persistent.playerName).toBe('Aoi');
    expect(next.persistent.homeTheme.primary).toEqual(original.run.kumiki.design.primary);
    expect(next.persistent.guideArchive.some(e => e.kind === 'kumiki' && e.id === 'wall')).toBe(true);
    expect(next.run.seed.guide.current).toBe('return'); expect(next.run.restartMs).toBe(BALANCE.release.restartMs);
    expect(startNextVersion(next, now)).toBe(next);
  });

  it('新しいテンプレートは前の絵を使い、前の報酬記録を持ち越さず、またピクセルとトークンが入る', () => {
    let state = shipped(); state = buySpec(buySpec(state, 'color'), 'resolution');
    // 解像度は高額なので確認用にドルを用意してから買う。
    state.resources.dollars = 2_000; state = buySpec(state, 'resolution');
    state = startNextVersion(state, now + 1_000); state.run.restartMs = 0;
    state.run.seed.built = BALANCE.w1.items.map(i => i.id);
    state = enterKumiki(state);
    const drawing = state.run.kumiki.drawings.folder!, target = targetFor(state, 'folder', drawing.size);
    expect(drawing.size).toBe(32); expect(drawing.rewarded.every(v => !v)).toBe(true);
    expect(state.run.kumiki.underlays.folder).toEqual(state.persistent.artwork.icons.folder);
    const tokens = state.resources.tokens;
    for (const color of new Set(target.filter(c => c >= 0))) state = paintDrawing(state, 'folder', target.flatMap((c,i) => c === color ? [i] : []), color);
    expect(state.resources.pixels).toBe(target.filter(c => c >= 0).length * 15);
    state = exportKumiki(state, now);
    expect(state.resources.tokens).toBe(tokens + 2);
    expect(state.persistent.products[0]!.screen.specs.resolution).toBe(0);
    expect(state.run.world).toBe('kumiki'); // 段階5のデスクトップは作らない
  });

  it('セーブ未作成の新規データは保存せず、リセット直後のチェックポイントだけは製品と一緒に保存する', () => {
    const storage = createMemoryStorage();
    expect(saveGame(storage, createInitialState(now), now, { checkpoint: true }).kind).toBe('locked');
    const next = startNextVersion(buySpec(shipped(), 'color'), now);
    expect(saveGame(storage, next, now).kind).toBe('locked');
    expect(saveGame(storage, next, now, { checkpoint: true }).kind).toBe('saved');
    const loaded = loadGame(storage);
    expect(loaded.kind === 'loaded' && loaded.state.run.version).toBe('v1');
    expect(loaded.kind === 'loaded' && loaded.state.persistent.products.length).toBe(1);
  });

  it('第4版を変換し、出荷中を復元でき、不正な製品と集計値を拒む', () => {
    const old = JSON.parse(encodeSave(ready())); old.schemaVersion = 4;
    delete old.run.shipping; delete old.run.restartMs;
    delete old.persistent.products; delete old.persistent.guideArchive; delete old.persistent.homeTheme;
    const migrated = decodeSave(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(7); expect(migrated.resources).toEqual(old.resources);
    const state = shipped(); expect(decodeSave(encodeSave(state))).toEqual(state);
    for (const mutate of [
      (s: typeof state) => { s.run.shipping!.productId = 99; },
      (s: typeof state) => { s.run.shipping!.elapsedMs = 9_000; },
      (s: typeof state) => { s.persistent.products[0]!.screen.cursors = -1; },
      (s: typeof state) => { s.persistent.products[0]!.revenue = 1.5; },
      (s: typeof state) => { s.persistent.products.push(s.persistent.products[0]!); },
    ]) {
      const invalid = structuredClone(state); mutate(invalid);
      expect(() => decodeSave(JSON.stringify(invalid))).toThrow();
    }
  });

  it.each(FIXTURE_NAMES.filter(name => name.startsWith('release-')))('固定状態%sを保存・復元できる', name => {
    const state = createFixture(name, now)!;
    expect(isGameState(state)).toBe(true); expect(decodeSave(encodeSave(state))).toEqual(state);
  });
});

it('実際の生成・購入・描画からv0.1を出荷し、256色を買って作り直せる', () => {
  let state = createInitialState(0), momentum = freshMomentum(), time = 0, nextClick = 0;
  const pause = (ms: number) => { for (let left = ms; left > 0; left -= 100) { time += 100; state = advanceActiveTime(state, 100).state; } };
  const cursors = (goal: number) => {
    while (canBuildSeed(state, 'cursor') && cursorPrice(state) < goal * .35) state = buildSeed(state, 'cursor', time);
  };
  for (const item of BALANCE.w1.items) {
    while (!canBuildSeed(state, item.id)) {
      if (time > 60 * 60_000) throw new Error('60分を超えた');
      cursors(item.cost); pause(100);
      if (time >= nextClick) { const result = pressSeed(state, momentum, time); state = result.state; momentum = result.momentum; nextClick = time + 400; }
    }
    state = buildSeed(state, item.id, time); pause(4_000);
    if (item.id === 'color') pause(30_000);
    if (item.id === 'motion') pause(15_000);
  }
  pause(30_000);
  let budget = 0, id = '', pending: number[] = [], target: number[] = [];
  for (const item of BALANCE.w2.items) {
    while (state.resources.pixels < item.cost) {
      if (time > 60 * 60_000) throw new Error('60分を超えた');
      cursors(item.cost); pause(100); budget += .15; // 付録Eの1.5マス/秒
      if (budget < 1) continue;
      budget -= 1;
      if (!pending.length) {
        id = availableIcons(state).find(icon => !state.run.kumiki.drawings[icon]?.exported) ?? '';
        if (!id) continue;
        state = prepareDrawing(state, id);
        const drawing = state.run.kumiki.drawings[id]!;
        target = targetFor(state, id, drawing.size);
        pending = target.flatMap((c, i) => c >= 0 && drawing.frames[0]![i] !== c ? [i] : []);
      }
      if (pending.length) {
        const cell = pending.shift()!; state = paintDrawing(state, id, [cell], target[cell]!);
        if (!pending.length) { state = exportKumiki(state, time); pause(2_000); if (id === 'folder') pause(30_000); }
      }
    }
    state = buildKumiki(state, item.id); pause(4_000);
    for (const part of ownedParts(state)) if (!state.run.kumiki.placed.includes(part)) state = placePart(state, part);
    if (item.id === 'slider') state = configureKumiki(state, { interval: BALANCE.w2.intervalMax });
    state = exportKumiki(state, time); pause(2_000);
    if (item.id === 'extensions' || item.id === 'input') pause(15_000);
  }
  pause(30_000);
  expect(canReleasePrototype(state)).toBe(true); expect(canFundNextVersion(state)).toBe(true);
  const revenue = releaseEstimate(state);
  state = beginPrototypeRelease(state, time); state = advanceActiveTime(state, BALANCE.release.animationMs).state;
  state = buySpec(state, 'color'); state = startNextVersion(state, time + BALANCE.release.animationMs);
  expect(state.run.version).toBe('v1'); expect(state.run.world).toBe('seed'); expect(state.persistent.specs.color).toBe(1);
  expect(state.persistent.products).toHaveLength(1);
  console.info(`v0.1の自動プレイ: ${(time / 60_000).toFixed(2)}分 / ${revenue}ドル / ${state.persistent.products[0]!.exports.filter(e => e.kind === 'icon').length}アイコン`);
  expect(time).toBeGreaterThanOrEqual(40 * 60_000); expect(time).toBeLessThanOrEqual(60 * 60_000);
});
