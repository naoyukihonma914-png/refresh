import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { setDesktopStage, unlockedDesktopStage } from './appearance';
import { encodeScene, projectCapture, readCapture } from './captureScene';
import { createFixture } from './fixtures';
import { advanceShipping, beginProductRelease, buySpec, releaseEstimate, shippingProduct, showShipping, startNextVersion, v1Conditions } from './release';
import { isReleasePresentation, presentationAtRelease, releasePresentation, softwarePresentation } from './releasePresentation';
import { isProductRecord } from './releaseState';
import { decodeSave, encodeSave } from './save';
import { createInitialState, isGameState } from './state';

const now = 1_800_000_000_000;

describe('ソフトウェアの製品ページと出荷の世代', () => {
  it.each([
    [0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3],
  ] as const)('到達段%iは世代%iのソフトウェアとして扱う', (desktopStage, generation) => {
    const descriptor = softwarePresentation(desktopStage);
    expect(descriptor).toEqual({ medium: 'software', desktopStage, generation });
    expect(isReleasePresentation(descriptor)).toBe(true);
  });

  it('版の名前と現在選んでいる旧姿ではなく、取得した最も先の段を使う', () => {
    const reached = createFixture('stage7-ready3', now)!;
    const oldLook = setDesktopStage(reached, 0);
    expect(oldLook.persistent.appearance.desktop).toBe(0);
    expect(unlockedDesktopStage(oldLook)).toBe(3);
    for (const version of ['v0.1', 'v1', 'v2'] as const) {
      const state = { ...oldLook, run: { ...oldLook.run, version } };
      expect(presentationAtRelease(state)).toEqual({ medium: 'software', desktopStage: 3, generation: 2 });
    }
    const firstStage = createInitialState(now);
    firstStage.run.version = 'v2';
    expect(presentationAtRelease(firstStage)).toEqual({ medium: 'software', desktopStage: 0, generation: 1 });
  });

  it('通常の出荷で様式を固定し、保存・旧姿への変更・次の版でも記録を変えない', () => {
    const ready = setDesktopStage(createFixture('stage7-ready3', now)!, 0);
    const shipped = beginProductRelease(ready, now, { language: 'ja' });
    expect(shipped.run.world).toBe('release');
    const product = shippingProduct(shipped)!;
    expect(product.presentation).toEqual({ medium: 'software', desktopStage: 3, generation: 2 });
    const expected = structuredClone(product.presentation);
    let restored = decodeSave(encodeSave(shipped));
    expect(shippingProduct(restored)!.presentation).toEqual(expected);
    restored = setDesktopStage(restored, 2);
    expect(releasePresentation(shippingProduct(restored)!)).toEqual(expected);
    restored = advanceShipping(showShipping(advanceShipping(restored, BALANCE.release.storeAnimationMs)), BALANCE.release.animationMs);
    restored = buySpec(restored, 'refresh');
    const next = startNextVersion(restored, now + 20_000);
    expect(next.run.version).toBe('v2');
    expect(next.run.world).toBe('seed');
    expect(next.persistent.products.find(item => item.id === product.id)!.presentation).toEqual(expected);
    const latest = setDesktopStage(next, 0);
    expect(decodeSave(encodeSave(latest)).persistent.products.find(item => item.id === product.id)!.presentation).toEqual(expected);
  });

  it('様式のない旧製品は、その製品の凍結画面の到達段を使い、掲載した古い写真を使わない', () => {
    const oldLook = setDesktopStage(createFixture('stage7-ready3', now)!, 0);
    const shipped = beginProductRelease(oldLook, now, { language: 'ja' });
    const product = structuredClone(shippingProduct(shipped)!);
    delete product.presentation;
    const early = createFixture('desktop-early', now - 1_000)!;
    expect(unlockedDesktopStage(early)).toBe(0);
    product.screenshots = [{ id: 1, at: now - 1_000, language: 'ja', data: encodeScene(projectCapture(early, 'ja')) }];
    expect(readCapture(product.capture!).version).toBeGreaterThan(1);
    expect(releasePresentation(product)).toEqual({ medium: 'software', desktopStage: 3, generation: 2 });
    shipped.persistent.products[shipped.persistent.products.length - 1] = product;
    const migrated = decodeSave(encodeSave(shipped));
    expect(migrated.persistent.products.at(-1)!.presentation).toBeUndefined();
    expect(releasePresentation(migrated.persistent.products.at(-1)!)).toEqual({ medium: 'software', desktopStage: 3, generation: 2 });
  });

  it('凍結画面もない旧製品は、今の画面や掲載写真が新しくても世代1のままにする', () => {
    const state = createFixture('stage7-store', now)!;
    const product = structuredClone(shippingProduct(state)!);
    expect(product.screenshots!.length).toBeGreaterThan(0);
    delete product.presentation;
    delete product.capture;
    expect(releasePresentation(product)).toEqual({ medium: 'software', desktopStage: 0, generation: 1 });
    state.persistent.products[state.persistent.products.length - 1] = product;
    expect(isGameState(state)).toBe(true);
    expect(releasePresentation(decodeSave(encodeSave(state)).persistent.products.at(-1)!)).toEqual({ medium: 'software', desktopStage: 0, generation: 1 });
  });

  it.each([
    null, {}, { medium: 'video', desktopStage: 2, generation: 2 },
    { medium: 'software', desktopStage: -1, generation: 1 },
    { medium: 'software', desktopStage: 6, generation: 3 },
    { medium: 'software', desktopStage: 2.5, generation: 2 },
    { medium: 'software', desktopStage: '2', generation: 2 },
    { medium: 'software', desktopStage: 0, generation: 2 },
    { medium: 'software', desktopStage: 3, generation: 3 },
    { medium: 'software', desktopStage: 4, generation: 2 },
  ])('不正な記録の様式を受け入れない: %j', invalid => {
    expect(isReleasePresentation(invalid)).toBe(false);
    const state = createFixture('stage7-freeware', now)!;
    const product = { ...shippingProduct(state)!, presentation: invalid };
    expect(isProductRecord(product)).toBe(false);
    const encoded = JSON.parse(encodeSave(state));
    encoded.persistent.products[encoded.persistent.products.length - 1].presentation = invalid;
    expect(() => decodeSave(JSON.stringify(encoded))).toThrow();
  });

  it.each([1, 2, 3] as const)('世代%iの見本は様式だけを変え、未実装のデスクトップを解放しない', generation => {
    for (const phase of ['store', 'sales']) {
      const state = createFixture(`stage7-${phase}-gen${generation}`, now)!;
      expect(releasePresentation(shippingProduct(state)!)).toEqual({ medium: 'software', desktopStage: (generation - 1) * 2, generation });
      expect(state.persistent.appearance.desktop).toBeLessThanOrEqual(3);
      expect(unlockedDesktopStage(state)).toBeLessThanOrEqual(3);
      expect(isGameState(state)).toBe(true);
      expect(releasePresentation(shippingProduct(decodeSave(encodeSave(state)))!)).toEqual(releasePresentation(shippingProduct(state)!));
    }
  });

  it('様式を決める処理は売上・財布・写真・リリース条件に影響しない', () => {
    const state = createFixture('stage7-store', now)!;
    const before = encodeSave(state);
    const expectedRevenue = releaseEstimate(state);
    const expectedConditions = v1Conditions(state);
    for (const desktopStage of [0, 2, 4] as const) {
      const variant = structuredClone(state);
      shippingProduct(variant)!.presentation = softwarePresentation(desktopStage);
      const snapshot = encodeSave(variant);
      expect(releasePresentation(shippingProduct(variant)!).generation).toBe(desktopStage / 2 + 1);
      expect(presentationAtRelease(variant)).toEqual(presentationAtRelease(state));
      expect(encodeSave(variant)).toBe(snapshot);
      expect(releaseEstimate(variant)).toBe(expectedRevenue);
      expect(v1Conditions(variant)).toEqual(expectedConditions);
      expect(variant.resources).toEqual(state.resources);
      expect(variant.persistent.screenshots).toEqual(state.persistent.screenshots);
      expect(shippingProduct(variant)!.revenue).toBe(shippingProduct(state)!.revenue);
      expect(shippingProduct(variant)!.screenshots).toEqual(shippingProduct(state)!.screenshots);
    }
    expect(encodeSave(state)).toBe(before);
  });
});
