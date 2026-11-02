import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { focusWindow } from './desktop';
import { passivePixelsPerSecond } from './economy';
import { createFixture,FIXTURE_NAMES } from './fixtures';
import { actCommon } from './longPlay';
import { beginProductRelease,beginPrototypeRelease,buySpec,canBuySpec,canFundNextVersion,canReleasePrototype,canStartNextVersion,dailySales,displayedSales,releaseEstimate,releaseScreenshotBonus,selectedReleaseScreenshots,shippingComplete,shippingProduct,showShipping,SPEC_ORDER,startNextVersion,storeComplete } from './release';
import { createMemoryStorage,decodeSave,encodeSave,loadGame,saveGame } from './save';
import { canBuildSeed,freshMomentum,pressSeed } from './seed';
import { createInitialState,isGameState } from './state';
import { advanceActiveTime,advanceOfflineTime } from './time';
import { prototypeConditions } from './workshop';

const now = 1_800_000_000_000;
const ready = () => createFixture('release-ready', now)!;
const shipped = () => createFixture('release-complete', now)!;
const v1Ready = () => {
  let state = createFixture('desktop-ready', now)!;
  for (const app of ['files','mail','clock','bin'] as const) state = focusWindow(state, app);
  state.run.desktop.feedback = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, kind: 'sort' as const, sender: 'hikari' as const,
    target: '', baseline: [], baselineColor: '#0067c0', at: now, completedAt: now }));
  state.run.desktop.feedbackSerial = 10;
  return state;
};

describe('試作版のリリース', () => {

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

  it('売上不足の出荷と、256色の購入分を使い切る買い方を止め、作業を続けられる', () => {
    const low = ready(); low.run.totalPixelsGenerated = low.resources.pixels = 1;
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

  it.each(FIXTURE_NAMES.filter(name => name.startsWith('release-')))('固定状態%sを保存・復元できる', name => {
    const state = createFixture(name, now)!;
    expect(isGameState(state)).toBe(true); expect(decodeSave(encodeSave(state))).toEqual(state);
  });
});

describe('製品ページからv1.0を出荷する', () => {

  it('製品ページの3秒と出荷の8秒を分け、閉じ直しと重複操作で売上を二重に付けない', () => {
    const before = v1Ready(), estimate = releaseEstimate(before);
    let state = beginProductRelease(before, now, { language: 'en' });
    const product = shippingProduct(state)!;
    expect(product.version).toBe('v1.0'); expect(state.run.shipping?.phase).toBe('store');
    expect(state.resources.dollars).toBe(before.resources.dollars + estimate);
    expect(canBuySpec(state, 'refresh')).toBe(false); expect(showShipping(state)).toBe(state);
    state = advanceActiveTime(state, BALANCE.release.storeAnimationMs).state;
    expect(storeComplete(state)).toBe(true); expect(shippingComplete(state)).toBe(false);
    expect(state.run.shipping?.elapsedMs).toBe(0);
    state = decodeSave(encodeSave(state));
    expect(storeComplete(state)).toBe(true);
    state = showShipping(state);
    expect(state.run.shipping?.phase).toBe('shipping'); expect(storeComplete(state)).toBe(false);
    expect(showShipping(state)).toBe(state); expect(beginProductRelease(state, now)).toBe(state);
    state = advanceActiveTime(state, BALANCE.release.animationMs).state;
    expect(shippingComplete(state)).toBe(true); expect(state.resources.dollars).toBe(before.resources.dollars + estimate);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it('動きを減らす設定でも製品ページを読め、売上へ進む操作を残す', () => {
    const state = beginProductRelease(v1Ready(), now, { reducedMotion: true });
    expect(storeComplete(state)).toBe(true); expect(state.run.shipping?.phase).toBe('store');
    expect(shippingComplete(state)).toBe(false);
    expect(shippingComplete(showShipping(state, true))).toBe(true);
  });

  it('通常の出荷時点でv1実績を一度だけ取り、受託選択と60Hzを次の素の画面へ引き継ぐ', () => {
    const original = v1Ready(); original.persistent.seedSkills = ['inherit'];
    let state = showShipping(beginProductRelease(original, now, { reducedMotion: true }), true);
    expect(state.persistent.progress.records['v1-released']).toBe(now);
    state = actCommon(state, { type: 'contract-select', id: 'no-color' }, now);
    expect(state.persistent.progress.selected).toBe('no-color');
    state = buySpec(state, 'refresh');
    const next = startNextVersion(state, now + 1_000);
    expect(next.run.world).toBe('seed'); expect(next.run.version).toBe('v2');
    expect(next.persistent.specs.refresh).toBe(1); expect(next.resources.tokens).toBe(state.resources.tokens);
    expect(next.persistent.progress.records['v1-released']).toBe(now);
    expect(next.run.play.contract).toEqual({ id: 'no-color', status: 'active' });
    expect(next.persistent.progress.selected).toBeNull();
    expect(next.run.seed.installer).toBeNull();
    expect(next.run.desktop.apps).toEqual([]); expect(next.run.desktop.feedback).toEqual([]);
    expect(next.run.seed.autoCursors).toBe(0); expect(next.resources.pixels).toBe(0);
    expect(next.persistent.products).toEqual(state.persistent.products); expect(isGameState(next)).toBe(true);
  });

  it('60Hzの予算をほかの買い物で使い切れず、売上不足のときは作業へ戻れる', () => {
    let state = showShipping(beginProductRelease(v1Ready(), now, { reducedMotion: true }), true);
    state.resources.dollars = BALANCE.spec.refresh[1]!.price;
    expect(canStartNextVersion(state)).toBe(false); expect(canBuySpec(state, 'storage')).toBe(false);
    expect(canBuySpec(state, 'refresh')).toBe(true);
    state = buySpec(state, 'refresh');
    expect(state.resources.dollars).toBe(0); expect(canStartNextVersion(state)).toBe(true);
    const low = v1Ready(); low.resources.pixels = 0; low.run.totalPixelsGenerated = 0; low.resources.dollars = 0;
    expect(canFundNextVersion(low)).toBe(false); expect(beginProductRelease(low, now)).toBe(low);
  });

  it('未選択は新しい順、指定時は掲載順を保存し、枚数を追加しても写真の加点を減らさない', () => {
    const original = v1Ready(), ids = original.persistent.screenshots.map(s => s.id);
    expect(selectedReleaseScreenshots(original).map(s => s.id)).toEqual([...ids].reverse());
    const selected = [ids[0]!, ids[2]!];
    const bonus = releaseScreenshotBonus(original, [selected[0]!]);
    expect(releaseScreenshotBonus(original, selected)).toBeGreaterThanOrEqual(bonus);
    expect(releaseScreenshotBonus(original, selected)).toBeLessThanOrEqual(BALANCE.release.screenshotBonusMax);
    const state = beginProductRelease(original, now, { screenshotIds: selected }), product = shippingProduct(state)!;
    expect(product.screenshots?.map(s => s.id)).toEqual(selected);
    expect(product.revenue).toBe(releaseEstimate(original, selected));
    original.persistent.screenshots[0]!.language = 'changed';
    expect(product.screenshots?.[0]?.language).toBe('ja');
  });

  it('新しい製品情報や助言を持たない旧保存を読み、売上と出荷位置を保つ', () => {
    const old = shipped(), raw = JSON.parse(encodeSave(old));
    delete raw.run.advice;
    const migrated = decodeSave(JSON.stringify(raw));
    expect(migrated.resources).toEqual(old.resources); expect(migrated.persistent.products).toEqual(old.persistent.products);
    expect(migrated.run.shipping).toEqual(old.run.shipping); expect(migrated.run.advice.seen).toEqual([]);
  });
});

describe('8a prototype integration',()=>{
 it('requires editor entry, three finished parts, one export, and inspecting the display wall',()=>{
  const s=ready();expect(prototypeConditions(s)).toEqual([true,true,true]);expect(canReleasePrototype(s)).toBe(true);
  for(const mutate of [
   (x:typeof s)=>{x.run.workshop.exitInspected=false;},
   (x:typeof s)=>{for(const part of Object.values(x.run.workshop.parts))part.exportedAt=null;},
   (x:typeof s)=>{x.run.workshop.parts={};},
   (x:typeof s)=>{x.persistent.specs.color=1;},
  ]){const x=structuredClone(s);mutate(x);expect(canReleasePrototype(x)).toBe(false);expect(beginPrototypeRelease(x,now)).toBe(x);}
 });
 it('freezes new production data without an editable drawing or home document',()=>{
  const source=ready(),next=beginPrototypeRelease(source,now,true),product=next.persistent.products.at(-1)!;
  expect(product.screen.workshop).toEqual(source.run.workshop);expect(product.screen).not.toHaveProperty('drawings');expect(product.screen).not.toHaveProperty('placed');
  expect(product.exports.every(p=>p.kind==='part'&&!('frames' in p))).toBe(true);
  source.run.workshop.parts['common-button']!.design.shadow=true;
  expect(product.screen.workshop!.parts['common-button']!.design.shadow).toBe(false);
  expect(decodeSave(encodeSave(next))).toEqual(next);
 });
 it('keeps the shipping flow through 256 colours and begins the next version with no made parts',()=>{
  let s=beginPrototypeRelease(ready(),now,true);s=buySpec(s,'color');expect(canStartNextVersion(s)).toBe(true);
  s=startNextVersion(s,now+1);expect(s.run.version).toBe('v1');expect(s.run.world).toBe('seed');
  expect(s.persistent.specs.color).toBeGreaterThan(0);expect(s.run.workshop.parts).toEqual({});expect(s.persistent.setDocuments.length).toBeGreaterThan(0);
 });
});
