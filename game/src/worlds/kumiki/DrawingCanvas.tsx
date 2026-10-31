import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { I18n } from '../../content/i18n';
import type { Drawing } from '../../systems/kumikiState';

export type DrawingTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'select';
export function DrawingCanvas({ drawing, target, palette, frame, zoom, tool, i18n, modern = false, compact = false, onStroke, onBegin, onEnd, onPosition }: {
  drawing: Drawing; target: number[]; palette: string[]; frame: number; zoom: number; tool: DrawingTool; i18n: I18n;
  modern?: boolean; compact?: boolean;
  onStroke(cells: number[], tool: DrawingTool): void; onBegin(): void; onEnd(): void; onPosition(x: number, y: number): void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const previous = useRef<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const size = drawing.size;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const cell = 512 / size;
    const pixels = drawing.frames[frame] ?? drawing.frames[0]!;
    ctx.clearRect(0, 0, 512, 512);
    for (let i = 0; i < pixels.length; i++) {
      const x = i % size * cell, y = Math.floor(i / size) * cell;
      ctx.fillStyle = modern ? (i % size + Math.floor(i / size)) % 2 ? '#3a3a3a' : '#343434' : (i % size + Math.floor(i / size)) % 2 ? '#d9d6cf' : '#cfccc4';
      ctx.fillRect(x, y, cell, cell);
      if (target[i]! >= 0 && pixels[i] === -1) {
        ctx.globalAlpha = 0.28; ctx.fillStyle = palette[target[i]!] ?? '#000'; ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1;
      }
      if (pixels[i]! >= 0) { ctx.fillStyle = palette[pixels[i]!] ?? '#000'; ctx.fillRect(x, y, cell, cell); }
      if (size <= 32) { ctx.strokeStyle = modern ? '#4a4a4a' : '#8d8a83'; ctx.lineWidth = 0.7; ctx.strokeRect(x, y, cell, cell); }
    }
    ctx.strokeStyle = '#b8452f'; ctx.lineWidth = 2;
    ctx.strokeRect(cursor % size * cell + 1, Math.floor(cursor / size) * cell + 1, cell - 2, cell - 2);
  }, [drawing, target, palette, frame, cursor, size, modern]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(size - 1, Math.floor((event.clientX - rect.left) / rect.width * size)));
    const y = Math.max(0, Math.min(size - 1, Math.floor((event.clientY - rect.top) / rect.height * size)));
    onPosition(x, y); setCursor(y * size + x); return y * size + x;
  };
  const stroke = (end: number) => {
    const start = previous.current ?? end;
    const x = start % size, y = Math.floor(start / size), dx = end % size - x, dy = Math.floor(end / size) - y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const cells = Array.from({ length: steps + 1 }, (_, n) => Math.round(y + dy * n / steps) * size + Math.round(x + dx * n / steps));
    onStroke(cells, tool); previous.current = end;
  };
  const finish = () => { if (previous.current !== null) { previous.current = null; onEnd(); } };
  return <div className="drawing-scroll"><canvas ref={ref} width={512} height={512} tabIndex={0}
    aria-label={i18n.t('k.drawHint')} style={{ inlineSize: (compact ? 208 : modern ? 288 : 384) * zoom, blockSize: (compact ? 208 : modern ? 288 : 384) * zoom }}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); onBegin(); stroke(point(event)); }}
    onPointerMove={event => { const cell = point(event); if (previous.current !== null && tool !== 'fill' && tool !== 'eyedropper') stroke(cell); }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
      if (delta !== undefined) { event.preventDefault(); setCursor(Math.max(0, Math.min(size * size - 1, cursor + delta))); }
      if (event.code === 'Space' || event.code === 'Enter' || event.key === 'Delete') {
        event.preventDefault(); onBegin(); onStroke([cursor], event.key === 'Delete' ? 'eraser' : tool); onEnd();
      }
    }} /></div>;
}
