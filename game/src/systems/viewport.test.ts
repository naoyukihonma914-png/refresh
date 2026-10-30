import { describe, expect, it } from 'vitest';
import { fitViewport } from './viewport';

describe('1920×1080 の等倍率表示', () => {
  it.each([[1920, 1080], [1366, 768], [2560, 1440], [1080, 1920]])('%i×%i に縦横比を保って収める', (width, height) => {
    const result = fitViewport(width, height);
    expect(result.width).toBeLessThanOrEqual(width);
    expect(result.height).toBeLessThanOrEqual(height);
    expect(result.width / result.height).toBeCloseTo(1920 / 1080);
  });
  it('大きいブラウザでは拡大もする', () => {
    expect(fitViewport(3840, 2160).scale).toBe(2);
  });
  it('縦長または最低寸法未満のときだけ案内を出す', () => {
    expect(fitViewport(1080, 1920).narrow).toBe(true);
    expect(fitViewport(1279, 720).narrow).toBe(true);
    expect(fitViewport(1280, 719).narrow).toBe(true);
    expect(fitViewport(1280, 720).narrow).toBe(false);
    expect(fitViewport(1366, 768).narrow).toBe(false);
  });
});
