import type { SaveStorage, createSettingsStorage } from './storage';

export type Unsubscribe = () => void;
export type TabLease = { acquired: boolean; isOwner: () => boolean; release: () => void };
export type Achievement = 'kumiki-created' | 'prototype-released' | 'v1-released';
export interface GameKey { code: string; pressed: boolean; repeat: boolean; editable: boolean; preventDefault(): void }

export interface Platform {
  readonly storage: SaveStorage;
  readonly settings: ReturnType<typeof createSettingsStorage>;
  readonly launch: { debug: boolean; fixture: string | null };
  readonly clock: { wallNow(): number; monotonicNow(): number };
  readonly preferredLanguages: readonly string[];
  readonly tabs: { acquire(onLost: () => void): Promise<TabLease> };
  readonly visibility: { isHidden(): boolean; subscribe(listener: () => void): Unsubscribe };
  readonly viewport: {
    size(): { width: number; height: number };
    subscribe(listener: () => void): Unsubscribe;
    logicalSizeChanged(size:{width:number;height:number}):void;
  };
  readonly lifecycle: {
    onLeave(listener: () => void): Unsubscribe;
    onRestore(listener: () => void): Unsubscribe;
  };
  readonly files: { write(name: string, text: string): void; read(): Promise<string | null> };
  readonly animation: { subscribe(listener: (now: number) => void): Unsubscribe; reducedMotion(): boolean };
  readonly keyboard: { subscribe(listener: (key: GameKey) => void): Unsubscribe };
  every(milliseconds: number, listener: () => void): Unsubscribe;
  confirm(message: string): boolean;
  reload(): void;
  setDocumentLanguage(language: string, direction: 'ltr' | 'rtl'): void;
  setFullscreen(enabled: boolean): Promise<boolean>;
  quit(): boolean;
  unlockAchievement(achievement: Achievement): void;
  createPreview(): Platform;
}
