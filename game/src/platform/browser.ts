import { acquireTab } from './tab';
import { createMemoryStorage, createSettingsStorage, type SaveStorage } from './storage';
import type { Platform } from './types';

export function browserRoot(): HTMLElement {
  return document.getElementById('root')!;
}

function readFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    const cleanup = () => input.remove();
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (file) void file.text().then(resolve, reject);
      else resolve(null);
    }, { once: true });
    input.addEventListener('cancel', () => { cleanup(); resolve(null); }, { once: true });
    document.body.append(input);
    input.click();
  });
}

export function createBrowserPlatform(isolated = false): Platform {
  const storage: SaveStorage = isolated ? createMemoryStorage() : {
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: key => localStorage.removeItem(key),
  };
  const params = new URLSearchParams(window.location.search);
  return {
    storage,
    settings: createSettingsStorage(storage),
    launch: { debug: params.get('debug') === '1', fixture: params.get('state') },
    clock: { wallNow: () => Date.now(), monotonicNow: () => performance.now() },
    preferredLanguages: navigator.languages,
    tabs: {
      acquire: isolated
        ? async () => ({ acquired: true, isOwner: () => true, release() {} })
        : onLost => acquireTab(storage, onLost),
    },
    visibility: {
      isHidden: () => document.hidden,
      subscribe: listener => {
        document.addEventListener('visibilitychange', listener);
        return () => document.removeEventListener('visibilitychange', listener);
      },
    },
    viewport: {
      size: () => ({ width: window.innerWidth, height: window.innerHeight }),
      subscribe: listener => {
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
      },
    },
    lifecycle: {
      onLeave: listener => {
        window.addEventListener('pagehide', listener);
        return () => window.removeEventListener('pagehide', listener);
      },
      onRestore: listener => {
        const restore = (event: PageTransitionEvent) => { if (event.persisted) listener(); };
        window.addEventListener('pageshow', restore);
        return () => window.removeEventListener('pageshow', restore);
      },
    },
    files: {
      write(name, text) {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      read: readFile,
    },
    animation: {
      subscribe(listener) {
        let frame: number;
        const tick = (now: number) => { listener(now); frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    },
    keyboard: {
      subscribe(listener) {
        const key = (event: KeyboardEvent) => listener({
          code: event.code, pressed: event.type === 'keydown', repeat: event.repeat,
          editable: event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLElement
            && !!event.target.closest('input, textarea, select, canvas, button:not(.generate-button), a, [contenteditable="true"], .debug-panel, .page-settings'),
          preventDefault: () => event.preventDefault(),
        });
        const blur = () => listener({ code: 'Space', pressed: false, repeat: false, editable: false, preventDefault() {} });
        window.addEventListener('keydown', key);
        window.addEventListener('keyup', key);
        window.addEventListener('blur', blur);
        return () => {
          window.removeEventListener('keydown', key);
          window.removeEventListener('keyup', key);
          window.removeEventListener('blur', blur);
        };
      },
    },
    every(milliseconds, listener) {
      const timer = setInterval(listener, milliseconds);
      return () => clearInterval(timer);
    },
    confirm: message => window.confirm(message),
    reload: () => window.location.reload(),
    setDocumentLanguage(language, direction) {
      document.documentElement.lang = language;
      document.documentElement.dir = direction;
    },
    async setFullscreen(enabled) {
      try {
        if (enabled && !document.fullscreenElement) await document.documentElement.requestFullscreen();
        if (!enabled && document.fullscreenElement) await document.exitFullscreen();
        return true;
      } catch { return false; }
    },
    // ブラウザのタブの終了と実績は、ブラウザ版では操作しない。
    quit: () => false,
    unlockAchievement() {},
    createPreview: () => createBrowserPlatform(true),
  };
}
