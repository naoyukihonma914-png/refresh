import type { CSSProperties, ReactNode } from 'react';
import { effectiveEditorBackground, type EditorCustomization } from '../systems/workshopState';
import './EditorShell.css';

export interface EditorShellProps {
  stage: 0 | 1 | 2;
  top?: ReactNode;
  palette?: ReactNode;
  parts?: ReactNode;
  tools?: ReactNode;
  bottom?: ReactNode;
  layers?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  positions?: Partial<Record<'palette'|'tools'|'parts'|'bottom','left'|'right'|'top'|'bottom'>>;
  widths?: Partial<Record<'palette'|'tools'|'parts',number>>;
  bandPosition?: 'top'|'bottom';
  construction?: boolean;
  background?: Pick<EditorCustomization,'background'|'nativeBackground'>;
}

/** The editor's real outer structure, assembled in world 1 and used in world 2. */
export function EditorShell({ stage, top, palette, parts, tools, bottom, layers, children, className = '', style, positions, widths, bandPosition='top', construction=false, background }: EditorShellProps) {
  const locations={palette:stage===2?'right':'left',tools:stage===2?'left':'right',parts:stage===2?'left':'right',bottom:'bottom',...positions};
  const entries=stage===2?[['tools',tools],['parts',parts],['palette',palette],['bottom',bottom]] as const:[['palette',palette],['parts',parts],['tools',tools],['bottom',bottom]] as const;
  const rail=(side:'left'|'right'|'top'|'bottom')=>entries.some(([id,node])=>node&&locations[id]===side)?<div className={`editor-shell-rail editor-shell-${side}-rail`}>{entries.filter(([id,node])=>node&&locations[id]===side).map(([id,node])=><div className={`editor-shell-${id}`} key={id}>{node}</div>)}</div>:null;
  const title=top&&<header className="editor-shell-top">{top}</header>;
  return <main className={`editor-shell editor-stage-${stage} ${palette ? 'has-palette' : ''} ${parts ? 'has-parts-panel' : ''} ${tools ? 'has-tools' : ''} ${className}`} data-editor-stage={stage} data-seed-construction={construction||undefined} style={{...(background?{'--editor-canvas':effectiveEditorBackground(background,stage)}:{}),...(widths?.palette?{'--editor-palette-width':`${widths.palette}px`}:{}),...(widths?.tools?{'--editor-tools-width':`${widths.tools}px`}:{}),...(widths?.parts?{'--editor-parts-width':`${widths.parts}px`}:{}),...style} as CSSProperties}>
    {bandPosition==='top'&&title}{rail('top')}
    <div className="editor-shell-body">{rail('left')}<section className="editor-shell-workspace">{children}</section>{rail('right')}</div>
    {layers && <div className="editor-shell-layers">{layers}</div>}{rail('bottom')}{bandPosition==='bottom'&&title}
  </main>;
}
