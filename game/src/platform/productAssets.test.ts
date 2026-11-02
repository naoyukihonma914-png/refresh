import { describe, expect, it } from 'vitest';
import { CaptureStore } from './captures';
import { createMemoryStorage } from './storage';

const scene = (title: string) => JSON.stringify({ display: { title }, palette: ['#fff', '#000'] });
const save = (screenshots: string[], products: { screenshots?: string[]; capture?: string; captureCatalog?: string[] }[] = []) => JSON.stringify({
  persistent: {
    screenshots: screenshots.map(sceneRef => ({ sceneRef })),
    products: products.map(product => ({
      ...(product.screenshots ? { screenshots: product.screenshots.map(sceneRef => ({ sceneRef })) } : {}),
      ...(product.capture ? { capture: { sceneRef: product.capture } } : {}),
      ...(product.captureCatalog ? { captureCatalog: product.captureCatalog.map(sceneRef => ({ sceneRef })) } : {}),
    })),
  },
});

describe('製品ページの画像を共有保存する', () => {
  it('アルバムから消えて製品の掲載写真とプレビューだけに残る画像も保持する', () => {
    const storage = createMemoryStorage(), store = new CaptureStore(storage);
    store.begin();
    const listed = store.put(scene('listed')), preview = store.put(scene('preview')), dependency = store.put(scene('wallpaper source')), obsolete = store.put(scene('obsolete'));
    store.flush(); store.finish();
    store.collect(save([], [{ screenshots: [listed], capture: preview, captureCatalog: [dependency] }]), null, save([listed, preview, dependency, obsolete]));
    // Read through a new instance so its cache cannot hide a deleted section.
    const reloaded = new CaptureStore(storage);
    expect(JSON.parse(reloaded.get(listed))).toEqual(JSON.parse(scene('listed')));
    expect(JSON.parse(reloaded.get(preview))).toEqual(JSON.parse(scene('preview')));
    expect(JSON.parse(reloaded.get(dependency))).toEqual(JSON.parse(scene('wallpaper source')));
    expect(() => reloaded.get(obsolete)).toThrow('Missing scene');
  });

  it('予備の製品だけが参照する画像を保持し、予備からもなくなった後に回収する', () => {
    const storage = createMemoryStorage(), store = new CaptureStore(storage);
    store.begin();
    const old = store.put(scene('old release')), current = store.put(scene('new release'));
    store.flush(); store.finish();
    const previous = save([], [{ screenshots: [old], capture: old }]);
    const next = save([], [{ capture: current }]);
    store.collect(next, previous, previous);
    expect(JSON.parse(new CaptureStore(storage).get(old))).toEqual(JSON.parse(scene('old release')));
    store.collect(next, next, next);
    const reloaded = new CaptureStore(storage);
    expect(() => reloaded.get(old)).toThrow('Missing scene');
    expect(JSON.parse(reloaded.get(current))).toEqual(JSON.parse(scene('new release')));
  });

  it('製品画像のない旧保存でもアルバムの画像を残し、不要な画像だけを回収する', () => {
    const storage = createMemoryStorage(), store = new CaptureStore(storage);
    store.begin();
    const kept = store.put(scene('legacy album')), removed = store.put(scene('removed'));
    store.flush(); store.finish();
    const legacy = JSON.stringify({ persistent: { screenshots: [{ sceneRef: kept }] } });
    store.collect(legacy, null, save([kept, removed]));
    const reloaded = new CaptureStore(storage);
    expect(JSON.parse(reloaded.get(kept))).toEqual(JSON.parse(scene('legacy album')));
    expect(() => reloaded.get(removed)).toThrow('Missing scene');
  });
});
