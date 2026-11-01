import { editorStage } from '../systems/appearance';
import type { CSSProperties } from 'react';
import { iconTemplate, paletteFor } from '../content/kumikiArt';
import type { GameState } from '../systems/state';
import type { AppId } from '../systems/desktopState';
export function PixelArt({ frames, size, palette, frame = 0, grey = false, style }: { frames: number[][]; size: number; palette: string[]; frame?: number; grey?: boolean; style?: CSSProperties }) {
  return <svg className="pixel-art" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" style={style} aria-hidden="true">
    {(frames[frame] ?? frames[0] ?? []).map((color,i) => color < 0 ? null : <rect key={i} x={i%size} y={Math.floor(i/size)} width="1" height="1" fill={grey ? '#8b8b8b' : palette[color]} />)}
  </svg>;
}
export function AppIcon({ app, state, frame = 0, palette }: { palette?:string[]; app: AppId; state: GameState; frame?: number }) {
  if (['files','mail','photo','bin','clock','settings'].includes(app)) {
    const id = (app==='files'?'folder':app) as 'folder'|'mail'|'photo'|'bin'|'clock'|'settings';
    const work = state.run.kumiki.exports.find(e => e.kind === 'icon' && e.id === id);
    return <PixelArt frames={work?.frames ?? [iconTemplate(id,16)]} size={work?.size ?? 16} palette={palette??paletteFor(state.persistent.specs.color)} frame={frame} grey={!work} />;
  }
  if(app==='tessera'&&editorStage(state)===2)return <svg viewBox="0 0 48 48" className="app-icon gesso-icon" aria-hidden="true"><path d="M6 8h36v34H6z" fill="#526a7e" stroke="#263744"/><path d="M8 10h32v13H8z" fill="#7895ad"/><path d="m14 33 3-8 14-14 5 5-14 14z" fill="#e9e2cf" stroke="#263744"/><path d="m14 33 8-3-5-5z" fill="#d8ab63"/></svg>;
  if(app==='terminal')return <svg viewBox="0 0 48 48" className="app-icon" aria-hidden="true"><rect x="4" y="8" width="40" height="32" rx="3" fill="#26323a" stroke="#8c9ba5"/><path d="m12 17 6 6-6 6m11 1h10" stroke="#e4ecef" strokeWidth="2" fill="none"/></svg>;
  if(app==='manager')return <svg viewBox="0 0 48 48" className="app-icon" aria-hidden="true"><rect x="6" y="5" width="36" height="38" fill="#e4eaed" stroke="#536b7e"/><path d="M10 35h28M14 32V22m10 10V12m10 20V17" stroke="#537e9a" strokeWidth="4"/></svg>;
  if(app==='theme')return <svg viewBox="0 0 48 48" className="app-icon" aria-hidden="true"><path d="M7 6h34v36H7z" fill="#cedae0" stroke="#6c808b"/><path d="M9 8h15v32H9z" fill="#556d7e"/><path d="M27 12h10v10H27z" fill="#bba16e"/></svg>;
  return app === 'tessera' ? <svg viewBox="0 0 48 48" aria-hidden="true" className="app-icon"><path fill="#cba967" d="M6 7h22v12H18v22H6z"/><path fill="#537e9a" d="M30 7h12v34H20V29h10z"/><path fill="#e3d5b8" d="M20 21h8v6h-8z"/></svg>
    : <svg viewBox="0 0 48 48" aria-hidden="true" className="app-icon"><path fill="#fff" stroke="#999" d="M10 4h21l8 8v32H10z"/><path fill="#e5e5e5" stroke="#999" d="M31 4v9h8"/><path stroke="#6b8293" strokeWidth="2" d="M16 20h17M16 25h17M16 30h17M16 35h12"/></svg>;
}
// All line symbols below are drawn here, without an icon package or OS assets.
export function LineIcon({ kind }: { kind: 'minimize'|'maximize'|'restore'|'close'|'back'|'forward'|'up'|'capture'|'bell'|'resize'|'workspace' }) {
  const paths = { workspace:'M2 5h11l-3-3m3 3-3 3M14 11H3l3 3m-3-3 3-3', minimize:'M3 8.5h10', maximize:'M3.5 3.5h9v9h-9z', restore:'M5.5 3.5h7v7M3.5 5.5h7v7h-7z', close:'M3.5 3.5l9 9m0-9l-9 9', back:'M9.5 3.5l-5 4.5 5 4.5M5 8h9', forward:'M6.5 3.5l5 4.5-5 4.5M2 8h9', up:'M3.5 7l4.5-4.5L12.5 7M8 3v11', capture:'M2 5h3l1-2h4l1 2h3v8H2zM5 9a3 3 0 1 0 6 0a3 3 0 1 0-6 0', bell:'M3 11h10l-2-3V6a3 3 0 0 0-6 0v2zM6 13h4', resize:'M4 13l9-9M8 13l5-5M12 13l1-1' };
  return <svg className="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export function CursorGlyph(){return <svg className="cursor-glyph" viewBox="0 0 16 20" aria-hidden="true"><path d="M1 1v14l4-3 3 6 3-2-3-5h6z" fill="currentColor" stroke="#8b969d"/></svg>;}

export function ProductGlyph(){return <svg viewBox="0 0 32 32" className="app-icon product-glyph" aria-hidden="true"><path d="M4 5h20v5H9v8H4z" fill="#e7d5a5"/><path d="M12 13h16v5H17v9h-5z" fill="#c8e1e3"/><path d="M4 22h5v5H4z" fill="#b3c6db"/></svg>;}
