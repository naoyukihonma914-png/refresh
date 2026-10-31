import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BALANCE, type PartId } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { ownedParts, hasKSkill } from '../../systems/kumiki';
import { Foundation, useAnimationClock } from '../Foundation';
import { manualClickValue } from '../../systems/economy';
import { designStyle } from './design';
export function HomeDocument({ runtime, snapshot, i18n, selected, onSelect, selecting, dragPart, onDrop, preview = false }: {
  runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n; selected: string | null; onSelect(id: string): void;
  selecting: boolean; dragPart: PartId | null; onDrop(id: PartId): void;
  preview?: boolean;
}) {
  const { state } = snapshot;
  const k = state.run.kumiki;
  const sheet = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [recordTab, setRecordTab] = useState(false);
  const repairStart = useRef<{ id: PartId; x: number; y: number; scale: number } | null>(null);
  const [repairOffset, setRepairOffset] = useState({ dx: 0, dy: 0 });
  const act = runtime.actKumiki;
  useLayoutEffect(() => {
    const root = sheet.current;
    const node = root && selected ? root.querySelector<HTMLElement>(`[data-part="${selected}"]`) : null;
    if (!root || !node || !hasKSkill(state, 'snap')) { setMeasure(null); return; }
    const a = root.getBoundingClientRect(), b = node.getBoundingClientRect(), scale = a.width / root.offsetWidth;
    setMeasure(b.width ? { x: (b.left - a.left) / scale + root.scrollLeft, y: (b.top - a.top) / scale + root.scrollTop,
      width: b.width / scale, height: b.height / scale } : null);
  }, [selected, k.placed.length, k.design, k.homeWindow, state.persistent.artwork.skills]);
  const clock = useAnimationClock(runtime, !preview && state.run.seed.built.includes('motion'), state.persistent.specs.refresh);
  const [floating, setFloating] = useState<NonNullable<RuntimeSnapshot['press']>[]>([]);
  useEffect(() => {
    const press = snapshot.press;
    if (press?.target === 'button') setFloating(previous => [...previous.filter(item => press.at - item.at < BALANCE.w1.floatMs).slice(-11), press]);
  }, [snapshot.press]);
  const slot = (id: PartId, widget: ReactNode) => {
    const placed = k.placed.includes(id);
    const shifted = k.drift?.part === id ? k.drift : null;
    return <div key={id} className={`part-slot ${placed ? 'is-placed' : ''} ${dragPart === id ? 'drop-ready' : ''}`} data-slot={id}
      onDragOver={event => { event.preventDefault(); }} onDrop={event => { event.preventDefault(); onDrop(id); }}
      onPointerUp={event => { if (dragPart === id) { event.stopPropagation(); onDrop(id); } }}>
      {placed ? <div data-part={id} className={`home-part ${shifted ? 'part-shifted' : ''} ${selected === id ? 'part-selected' : ''}`}
        style={{ ...designStyle(k.design[id]), transform: shifted ? `translate(${shifted.dx + (repairStart.current?.id === id ? repairOffset.dx : 0)}px,${shifted.dy + (repairStart.current?.id === id ? repairOffset.dy : 0)}px) rotate(${shifted.angle}deg)` : undefined }}
        title={shifted ? i18n.t('k.repair') : undefined}
        onPointerDownCapture={event => {
          if (!shifted) return;
          if (hasKSkill(state, 'snap')) { act({ type: 'repair', id, dx: 0, dy: 0 }); return; }
          event.preventDefault(); event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          repairStart.current = { id, x: event.clientX, y: event.clientY, scale: event.currentTarget.getBoundingClientRect().width / event.currentTarget.offsetWidth };
          setRepairOffset({ dx: 0, dy: 0 });
        }}
        onPointerMoveCapture={event => { const start = repairStart.current; if (start?.id === id) setRepairOffset({ dx: (event.clientX - start.x) / start.scale, dy: (event.clientY - start.y) / start.scale }); }}
        onPointerUpCapture={event => {
          const start = repairStart.current;
          if (!start || start.id !== id) return;
          event.preventDefault(); event.stopPropagation(); repairStart.current = null; setRepairOffset({ dx: 0, dy: 0 });
          act({ type: 'repair', id, dx: (event.clientX - start.x) / start.scale, dy: (event.clientY - start.y) / start.scale });
        }}>{widget}</div> : <button className="part-placeholder" onClick={() => onDrop(id)}>{i18n.t('k.slot', { name: i18n.t(`k.part.${id}`) })}</button>}
    </div>;
  };
  const items: Record<PartId, ReactNode> = {
    button: <span className="secondary-anchor"><button className="generate-button second-generate" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect(); runtime.pressSeed({ x: event.detail ? (event.clientX - rect.left) / rect.width * 100 : 50, y: 50, target: 'button' });
    }} style={designStyle(k.design.button)}>{i18n.t('seed.generate', { count: manualClickValue(state) })}</button>
      {!runtime.platform.animation.reducedMotion() && floating.filter(item => clock - item.at < BALANCE.w1.floatMs).map(item => <span key={item.serial} className="pixel-gain" aria-hidden="true"
        style={{ insetInlineStart: `${item.x}%`, transform: `translate(calc(-50% + ${BALANCE.w1.gainOffsets[(item.serial - 1) % BALANCE.w1.gainOffsets.length]}px), ${-36 * Math.max(0, clock - item.at) / BALANCE.w1.floatMs}px)`, opacity: Math.max(0, 1 - (clock - item.at) / BALANCE.w1.floatMs) }}>{i18n.t('seed.gain', { pixels: i18n.integer(item.pixels) })}</span>)}
    </span>,
    switch: <label><input type="checkbox" checked={k.focus} onChange={event => act({ type: 'configure', change: { focus: event.target.checked } })} />{i18n.t('k.focus')}</label>,
    slider: <label>{i18n.t('k.interval')}<input aria-label={i18n.t('k.interval')} type="range" min={BALANCE.w2.intervalMin} max={BALANCE.w2.intervalMax} value={k.interval}
      onChange={event => act({ type: 'configure', change: { interval: Number(event.target.value) } })} /><output>{i18n.t('k.seconds', { count: k.interval })}</output></label>,
    input: <label>{i18n.t('k.exportName')}<input value={k.exportName} maxLength={BALANCE.w2.maxName} onChange={event => act({ type: 'configure', change: { exportName: event.target.value } })} /></label>,
    frame: <span>{i18n.t('k.home')}</span>, taskbar: <button onClick={() => act({ type: 'configure', change: { homeWindow: k.homeWindow === 'minimized' ? 'normal' : 'minimized' } })}>{i18n.t('k.home')}</button>,
    tabs: <div className="home-tabs"><button aria-pressed={!recordTab} onClick={() => setRecordTab(false)}>{i18n.t('k.tab.home')}</button><button aria-pressed={recordTab} onClick={() => setRecordTab(true)}>{i18n.t('k.tab.record')}</button></div>,
    table: <table><thead><tr><th>{i18n.t('k.table.time')}</th><th>{i18n.t('k.table.pixels')}</th></tr></thead><tbody>{k.generationLog.slice(-4).map((entry, index) => <tr key={index}><td>{i18n.time(entry.at)}</td><td>{i18n.integer(entry.pixels)}</td></tr>)}</tbody></table>,
  };
  return <div ref={sheet} className={`home-document ${k.placed.includes('frame') ? 'has-window-frame' : ''} home-${k.homeWindow}`}
    onClickCapture={event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-part]');
      if (selecting && target?.dataset.part) { event.preventDefault(); event.stopPropagation(); onSelect(target.dataset.part); }
    }}>
    {k.placed.includes('frame') && <header className="home-title" data-part="frame" style={designStyle(k.design.frame)}><span>{i18n.t('k.home')}</span>
      <div>{(['minimized', 'maximized', 'closed'] as const).map((value, index) => <button key={value} aria-label={i18n.t(index === 0 ? 'k.minimize' : index === 1 ? 'k.maximize' : 'k.close')}
        onClick={() => act({ type: 'configure', change: { homeWindow: k.homeWindow === value ? 'normal' : value } })}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d={['M3 12H13','M3 3H13V13H3Z','M3 3L13 13M13 3L3 13'][index]} /></svg>
      </button>)}</div></header>}
    <div className="home-body" hidden={k.homeWindow === 'minimized' || k.homeWindow === 'closed'}>
      <Foundation snapshot={snapshot} runtime={runtime} i18n={i18n} embedded preview={preview}>
        <div className="home-part-list">
          {ownedParts(state).filter(id => id !== 'frame' && id !== 'taskbar' && (id !== 'table' || !k.placed.includes('tabs') || recordTab)).map(id => slot(id, items[id]))}
          {ownedParts(state).includes('frame') && !k.placed.includes('frame') && slot('frame', items.frame)}
        </div>
      </Foundation>
    </div>
    {ownedParts(state).includes('taskbar') && slot('taskbar', items.taskbar)}
    {measure && <div className="selection-measure" style={{ insetInlineStart: measure.x, insetBlockStart: measure.y, inlineSize: measure.width, blockSize: measure.height }}>
      <span>{i18n.t('k.dimensions', { width: Math.round(measure.width), height: Math.round(measure.height) })}</span>
    </div>}
  </div>;
}
