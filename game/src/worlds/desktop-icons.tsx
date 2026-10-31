import type { CSSProperties } from 'react';
import { iconTemplate, paletteFor } from '../content/kumikiArt';
import type { GameState } from '../systems/state';
import type { AppId } from '../systems/desktopState';
export function PixelArt({ frames, size, palette, frame = 0, grey = false, style }: { frames: number[][]; size: number; palette: string[]; frame?: number; grey?: boolean; style?: CSSProperties }) {
  return <svg className="pixel-art" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" style={style} aria-hidden="true">
    {(frames[frame] ?? frames[0] ?? []).map((color,i) => color < 0 ? null : <rect key={i} x={i%size} y={Math.floor(i/size)} width="1" height="1" fill={grey ? '#8b8b8b' : palette[color]} />)}
  </svg>;
}
export function AppIcon({ app, state, frame = 0 }: { app: AppId; state: GameState; frame?: number }) {
  if (app === 'files' || app === 'mail') {
    const id = app === 'files' ? 'folder' : 'mail';
    const work = state.run.kumiki.exports.find(e => e.kind === 'icon' && e.id === id);
    return <PixelArt frames={work?.frames ?? [iconTemplate(id,16)]} size={work?.size ?? 16} palette={paletteFor(state.persistent.specs.color)} frame={frame} grey={!work} />;
  }
  return app === 'tessera' ? <svg viewBox="0 0 48 48" aria-hidden="true" className="app-icon"><path fill="#cba967" d="M6 7h22v12H18v22H6z"/><path fill="#537e9a" d="M30 7h12v34H20V29h10z"/><path fill="#e3d5b8" d="M20 21h8v6h-8z"/></svg>
    : <svg viewBox="0 0 48 48" aria-hidden="true" className="app-icon"><path fill="#fff" stroke="#999" d="M10 4h21l8 8v32H10z"/><path fill="#e5e5e5" stroke="#999" d="M31 4v9h8"/><path stroke="#6b8293" strokeWidth="2" d="M16 20h17M16 25h17M16 30h17M16 35h12"/></svg>;
}
// All line symbols below are drawn here, without an icon package or OS assets.
export function LineIcon({ kind }: { kind: 'minimize'|'maximize'|'restore'|'close'|'back'|'forward'|'up'|'capture'|'bell'|'resize' }) {
  const paths = { minimize:'M3 8.5h10', maximize:'M3.5 3.5h9v9h-9z', restore:'M5.5 3.5h7v7M3.5 5.5h7v7h-7z', close:'M3.5 3.5l9 9m0-9l-9 9', back:'M9.5 3.5l-5 4.5 5 4.5M5 8h9', forward:'M6.5 3.5l5 4.5-5 4.5M2 8h9', up:'M3.5 7l4.5-4.5L12.5 7M8 3v11', capture:'M2 5h3l1-2h4l1 2h3v8H2zM5 9a3 3 0 1 0 6 0a3 3 0 1 0-6 0', bell:'M3 11h10l-2-3V6a3 3 0 0 0-6 0v2zM6 13h4', resize:'M4 13l9-9M8 13l5-5M12 13l1-1' };
  return <svg className="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
