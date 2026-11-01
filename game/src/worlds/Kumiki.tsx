import { ProductNameInput } from '../components/ProductSettings';
import { Estimate } from '../components/Estimate';
import { productLabel } from '../content/products';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BALANCE, type PartId } from '../config/balance';
import { BASE_PALETTE, homeButtonColor, paletteFor } from '../content/kumikiArt';
import type { I18n } from '../content/i18n';
import { availableIcons, drawingFor, exportable, hasKSkill, nextKumikiItem, ownedParts, prototypeConditions, targetFor } from '../systems/kumiki';
import { passivePixelsPerSecond } from '../systems/economy';
import type { Design, KumikiGuide } from '../systems/kumikiState';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { DrawingCanvas, type DrawingTool } from './kumiki/DrawingCanvas';
import { HomeDocument } from './kumiki/HomeDocument';
import { Extensions } from './kumiki/Extensions';
import { canFundNextVersion, canReleasePrototype, releaseEstimate } from '../systems/release';
import { GuideHistory } from '../components/GuideHistory';

const TOOL_PATHS = {
  pencil: 'M4 20L6 14L16 4L20 8L10 18Z M14 6L18 10 M6 14L10 18',
  eraser: 'M3 15L13 5L21 13L13 21H9Z M8 10L16 18',
  select: 'M5 3L5 21L10 16L14 22L17 20L13 14L20 13Z',
  fill: 'M4 12L12 4L20 12L12 20Z M3 13H21',
  eyedropper: 'M4 20L5 15L15 5L19 9L9 19Z M13 3L21 11',
};
export function Kumiki({ runtime, snapshot, i18n, embedded = false, preview = false, interactive = true, previewReady, previewDocuments, previewPalette }: { previewPalette?:string[]; previewReady?: number; previewDocuments?: string[]; embedded?: boolean; preview?: boolean; interactive?: boolean; runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot;
  const k = state.run.kumiki;
  const act = preview ? () => {} : runtime.actKumiki;
  useEffect(() => { setDrawingId(k.activeDrawing); setFrame(0); }, [k.activeDrawing]);
  const [tool, setTool] = useState<DrawingTool>('pencil');
  const [color, setColor] = useState(0);
  const [drawingId, setDrawingId] = useState(k.activeDrawing);
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [selected, setSelected] = useState<string | null>(state.persistent.artwork.modern ? 'primary' : null);
  const [extensions, setExtensions] = useState(false);
  const [menu, setMenu] = useState<'file' | 'edit' | null>(null);
  const [conditions, setConditions] = useState(false);
  const [archive, setArchive] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [name, setName] = useState(state.persistent.playerName ?? '');
  const [playing, setPlaying] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [wallpaperNotice, setWallpaperNotice] = useState(false);
  const [dragPart, setDragPart] = useState<PartId | null>(null);
  const dragRef = useRef<PartId | null>(null);
  const host = useRef<HTMLElement>(null);
  const previousModern = useRef(state.persistent.artwork.modern);
  const undo = useRef<{ id: string; frames: number[][] }[]>([]);
  const redo = useRef<{ id: string; frames: number[][] }[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const palette = useMemo(() => previewPalette??paletteFor(state.persistent.specs.color), [state.persistent.specs.color,previewPalette]);
  const drawing = drawingFor(state, drawingId);
  const target = useMemo(() => targetFor(state, drawingId, drawing?.size ?? 16), [state.run.kumiki.underlays, drawingId, drawing?.size]);
  const ready = exportable(state);
  const readyCount = previewReady ?? ready.icons.length + ready.parts.length;
  const next = nextKumikiItem(state);
  const nextCost = BALANCE.w2.items.find(item => item.id === next)?.cost ?? 0;
  const parts = ownedParts(state);
  const mature = k.built.includes('select');
  const entered = !preview && state.elapsedMs - k.enteredAt < BALANCE.w2.enterMs;
  const tokensVisible = k.tokenDiscovered || state.resources.tokens > 0;
  const prototype = k.exitInspected && state.persistent.specs.color === 0;
  const releaseChecks = prototypeConditions(state);
  const defaultDesign: Design = { color: selected === 'primary' || selected === 'button' ? homeButtonColor(state.persistent.specs.color) : BASE_PALETTE[11]!, radius: 0, textSize: 'medium', shadow: false };
  const design = selected ? k.design[selected] ?? defaultDesign : defaultDesign;
  useEffect(()=>{
    if(preview||!snapshot.tesseraIntent)return;
    setExtensions(false);setMenu(null);setExportsOpen(false);
    if(snapshot.tesseraIntent.kind==='color'){setTool('select');setSelected('primary');}
    else{setTool('pencil');setDrawingId(k.activeDrawing);setFrame(0);}
  },[snapshot.tesseraIntent?.serial,preview]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    const home = root.querySelector<HTMLElement>('.home-document');
    const origin = root.getBoundingClientRect();
    const previousAnimation = home?.style.animation;
    if (home) {
      home.style.animation = 'none';
      const rect = home.getBoundingClientRect(), scale = origin.width / root.offsetWidth;
      root.style.setProperty('--arrive-x', `${-(rect.left - origin.left) / scale}px`);
      root.style.setProperty('--arrive-y', `${-(rect.top - origin.top) / scale}px`);
      root.style.setProperty('--arrive-scale', `${1920 / (rect.width / scale)}`);
    }
    const node = selected ? root.querySelector<HTMLElement>(`[data-part="${selected}"]`) : null;
    if (node) {
      const rect = node.getBoundingClientRect(), scale = origin.width / root.offsetWidth;
      setDimensions({ width: Math.round(rect.width / scale), height: Math.round(rect.height / scale) });
    }
    if (home) home.style.animation = previousAnimation ?? '';
  }, [selected, design.radius, design.textSize, k.placed.length, mature]);
  useEffect(() => {
    if (previousModern.current !== state.persistent.artwork.modern && state.persistent.artwork.modern) setRenewing(true);
    previousModern.current = state.persistent.artwork.modern;
  }, [state.persistent.artwork.modern]);
  useEffect(() => {
    if (!renewing) return;
    const stop = runtime.platform.every(BALANCE.w2.upgradeMs, () => { setRenewing(false); stop(); });
    return stop;
  }, [renewing, runtime]);
  useEffect(() => {
    if (!playing || !drawing || drawing.frames.length < 2) return;
    return runtime.platform.every(BALANCE.w2.animationFrameMs, () => setFrame(previous => (previous + 1) % 2));
  }, [playing, drawing?.frames.length, runtime]);
  useEffect(() => {
    const cancel = () => { dragRef.current = null; setDragPart(null); };
    return runtime.platform.visibility.subscribe(cancel);
  }, [runtime]);

  const openDrawing = (id: string) => { act({ type: 'prepare', id }); setDrawingId(id); setFrame(0); setPlaying(false); };
  const begin = () => {
    if (!drawing) return;
    undo.current = [...undo.current, { id: drawingId, frames: structuredClone(drawing.frames) }].slice(-BALANCE.w2.undoLimit);
    redo.current = []; setHistoryVersion(historyVersion + 1);
  };
  const restore = (direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? undo : redo, dest = direction === 'undo' ? redo : undo;
    const entry = source.current.pop();
    if (!entry) return;
    const current = drawingFor(state, entry.id);
    if (!current) return;
    dest.current.push({ id: entry.id, frames: structuredClone(current.frames) });
    setDrawingId(entry.id); act({ type: 'restore', ...entry }); setHistoryVersion(historyVersion + 1);
  };
  const stroke = (cells: number[], useTool: DrawingTool) => {
    if (!drawing) return;
    if (useTool === 'eyedropper') { const picked = drawing.frames[frame]?.[cells[0]!]; if (picked !== undefined && picked >= 0) setColor(picked); return; }
    if (useTool === 'select') return;
    if (useTool === 'fill') act({ type: 'fill', id: drawingId, cell: cells[0]!, color, frame });
    else act({ type: 'paint', id: drawingId, cells, color: useTool === 'eraser' ? -1 : color, frame, mirror });
  };
  const drop = (id: PartId) => { act({ type: 'place', id }); dragRef.current = null; setDragPart(null); };
  const readGuide = (id: KumikiGuide | 'close') => { act({ type: 'guide', id }); };
  const change = (patch: Partial<Design>) => { if (selected) act({ type: 'design', id: selected, design: { ...design, ...patch } }); };
  const selectPart = (id: string) => {
    if (tool === 'eyedropper') { const selectedColor = k.design[id]?.color ?? defaultDesign.color; setColor(Math.max(0, palette.indexOf(selectedColor))); }
    else setSelected(id);
  };
  const layers = hasKSkill(state, 'layers') && <section className="layer-list"><h2>{i18n.t('k.layers')}</h2>{['primary', ...k.placed].map(id => <button key={id} className={selected === id ? 'active' : ''} onClick={() => { setTool('select'); selectPart(id); }}>{id === 'primary' ? i18n.t('k.primary') : i18n.t(`k.part.${id as PartId}`)}</button>)}</section>;
  const effect = next === 'button' ? i18n.t('effect.home', { value: BALANCE.w2.buttonMultiplier })
    : next === 'switch' ? i18n.t('effect.focus', { value: BALANCE.w2.focusMultiplier })
      : next === 'slider' ? i18n.t('effect.interval', { value: BALANCE.w2.sliderMultiplier }) : '';
  return <main ref={host} className={['kumiki', embedded && 'k-embedded', preview && 'k-preview', mature && 'is-mature', state.persistent.artwork.modern && 'is-modern', entered && 'is-entering', renewing && 'is-renewing'].filter(Boolean).join(' ')}
    onPointerUp={event => {
      const id = dragRef.current;
      if (!id) return;
      const slots = host.current?.querySelectorAll<HTMLElement>('[data-slot]');
      for (const slot of slots ?? []) {
        const rect = slot.getBoundingClientRect();
        if (slot.dataset.slot === id && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) { drop(id); return; }
      }
      dragRef.current = null; setDragPart(null);
    }}>
    <nav className="k-menu">
      <b className="app-name">{i18n.t('k.app')}</b>
      <div className="menu-anchor"><button aria-expanded={menu === 'file'} onClick={() => setMenu(menu === 'file' ? null : 'file')}>{i18n.t('k.file')}</button>
        {menu === 'file' && <div className="k-dropdown">
          <button onClick={runtime.downloadData}>{i18n.t('data.export')}</button><button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button>
          <button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button><button onClick={() => { setExportsOpen(!exportsOpen); setMenu(null); }}>{i18n.t('k.exports')}</button>
        </div>}
      </div>
      <div className="menu-anchor"><button aria-expanded={menu === 'edit'} onClick={() => setMenu(menu === 'edit' ? null : 'edit')}>{i18n.t('k.edit')}</button>
        {menu === 'edit' && <div className="k-dropdown">
          <button disabled={!undo.current.length} onClick={() => restore('undo')}>{i18n.t('k.undo')}</button><button disabled={!redo.current.length} onClick={() => restore('redo')}>{i18n.t('k.redo')}</button>
          <button onClick={() => { setTool('eraser'); setMenu(null); }}>{i18n.t('k.tool.eraser')}</button>
        </div>}
      </div>
      {k.built.includes('extensions') && <button className={extensions ? 'active' : ''} onClick={() => { setExtensions(!extensions); act({ type: 'extensions' }); }}>{i18n.t('k.extensions')}</button>}
      <div className="k-menu-end">
        {!embedded && (tokensVisible || k.exitInspected) && <button onClick={() => setConditions(!conditions)}>{i18n.t('k.releaseProgress', { version: productLabel(i18n,state.persistent.productName,prototype ? 'v0.1' : 'v1.0'), done: prototype ? releaseChecks.filter(Boolean).length : 0, total: prototype ? releaseChecks.length : 5 })}</button>}
        {canReleasePrototype(state) && !snapshot.releaseConfirmation && <button className="prototype-release" onClick={runtime.requestPrototypeRelease}>{i18n.t('release.action')}</button>}
        <button aria-expanded={archive} onClick={() => setArchive(!archive)}>{i18n.t('k.comments')}</button>
      </div>
    </nav>
    <header className="k-toolbar"><span>{i18n.t('k.home')}</span><b className="k-resource" data-pixels={state.resources.pixels}>{i18n.t('k.pixels', { pixels: i18n.pixels(state.resources.pixels) })}</b>
      <span className="k-resource">{i18n.t('k.rate', { pixels: i18n.rate(passivePixelsPerSecond(state)) })}</span>
      {tokensVisible && <span className="token-count k-resource">{i18n.t('k.tokens', { count: state.resources.tokens })}</span>}
      <span className="current-tool">{i18n.t(`k.tool.${tool}`)}</span>
      <button className={`export-button ${readyCount ? 'can-export' : ''}`} disabled={!readyCount} onClick={() => {
        act({ type: 'export' }); const latest = runtime.getSnapshot().state;
        const arrived = availableIcons(latest).find(id => !drawingFor(latest, id)?.exported);
        if (arrived && arrived !== drawingId) openDrawing(arrived);
      }}>{readyCount ? i18n.t('k.exportReady', { count: readyCount }) : i18n.t('k.export')}</button>
    </header>
    {conditions && <section className="k-condition-popover"><h2>{i18n.t('k.conditions')}</h2>
      {(prototype ? ['parts', 'icons', 'buttons'] as const : ['apps', 'requests', 'icons', 'wallpaper', 'automation'] as const).map((id, index) => <p key={id}><input type="checkbox" readOnly checked={prototype && !!releaseChecks[index]} />{i18n.t(prototype ? `k.condition.${id as 'parts' | 'icons' | 'buttons'}` : `seed.condition.${id as 'apps' | 'requests' | 'icons' | 'wallpaper' | 'automation'}`)}</p>)}
    </section>}
    {snapshot.releaseConfirmation && <section className="k-release-confirm k-comment" role="dialog" aria-label={i18n.t('release.confirm.title')}>
      <h3>{i18n.t('release.confirm.title')}</h3><p>{i18n.t('release.confirm')}</p><ProductNameInput state={state} runtime={runtime} i18n={i18n}/><p>{i18n.t('guide.signature')}</p>
      <p>{i18n.t('release.estimate', { dollars: i18n.integer(releaseEstimate(state)) })}</p>
      {!canFundNextVersion(state) && <p>{i18n.t('release.needRevenue', { dollars: BALANCE.spec.color[BALANCE.release.prototypeColorLevel]!.price })}</p>}
      <div className="release-confirm-actions"><button disabled={!canFundNextVersion(state)} onClick={runtime.confirmPrototypeRelease}>{i18n.t('release.action')}</button><button onClick={runtime.cancelPrototypeRelease}>{i18n.t('release.keepWorking')}</button></div>
    </section>}
    <div className="k-body">
      <aside className="k-tools">
        {(['pencil', ...(mature ? ['eraser', 'select'] : []), ...(hasKSkill(state, 'fill') ? ['fill'] : []), ...(hasKSkill(state, 'eyedropper') ? ['eyedropper'] : [])] as DrawingTool[]).map(id => <button key={id} className={tool === id ? 'active' : ''} title={i18n.t(`k.tool.${id}`)} aria-label={i18n.t(`k.tool.${id}`)} onClick={() => { setTool(id); setExtensions(false); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TOOL_PATHS[id]} /></svg></button>)}
        {!mature && <button className="next-tool" disabled={state.resources.pixels < nextCost} title={i18n.t('k.build', { name: i18n.t('k.part.select'), cost: i18n.integer(nextCost) })} aria-label={i18n.t('k.build', { name: i18n.t('k.part.select'), cost: i18n.integer(nextCost) })} onClick={() => act({ type: 'build', id: 'select' })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={TOOL_PATHS.select} /></svg></button>}
      </aside>
      <aside className="k-parts-panel">
        <h2>{i18n.t('k.palette')}</h2>
        <label className="palette-label">{i18n.t('k.color')}</label>
        <div className="palette-swatches">{palette.map((c, index) => <button key={c} style={{ backgroundColor: c }} title={c} aria-label={i18n.t('k.color') + ' ' + c} aria-pressed={color === index}
          className={color === index ? 'chosen' : ''} onClick={() => setColor(index)} />)}</div>
        {hasKSkill(state, 'mirror') && <label className="mirror-option"><input type="checkbox" checked={mirror} onChange={event => setMirror(event.target.checked)} />{i18n.t('k.mirror')}</label>}
        {parts.length > 0 && <><h2>{i18n.t('k.parts')}</h2><div className="part-list">{parts.map(id => <button key={id} className={dragPart === id ? 'active' : ''} draggable={!k.placed.includes(id)}
          onPointerDown={() => { if (!k.placed.includes(id)) { dragRef.current = id; setDragPart(id); } }}
          onDragStart={event => { event.dataTransfer.setData('text/plain', id); dragRef.current = id; setDragPart(id); }}
          onDragEnd={() => { dragRef.current = null; setDragPart(null); }} onClick={() => k.placed.includes(id) ? selectPart(id) : (dragRef.current = id, setDragPart(id))}>
          <span>{i18n.t(`k.part.${id}`)}</span><small>{i18n.t(k.placed.includes(id) ? 'k.placed' : 'k.place')}</small>
        </button>)}</div></>}
        {mature && next && <section className="next-component"><h2>{i18n.t('k.next')}</h2><p>{i18n.t(`k.part.${next}`)}{effect && <small className="purchase-effect">{effect}</small>}</p><button disabled={state.resources.pixels < nextCost}
          onClick={() => act({ type: 'build', id: next })}>{i18n.t('seed.buildPrice', { cost: i18n.integer(nextCost) })}</button><Estimate cost={nextCost} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} i18n={i18n} runtime={runtime} preview={preview}/></section>}
        {!state.persistent.artwork.modern && layers}
        {!embedded && parts.length > 0 && <section className="desktop-exit"><button disabled={!k.built.includes('taskbar') || state.persistent.specs.color === 0 || state.resources.pixels < BALANCE.w2.desktopCost}
          onClick={() => { act({ type: 'exit' }); setConditions(true); }}>{i18n.t('k.desktop')}</button>
          <p>{i18n.t('k.desktopPrice', { pixels: i18n.integer(BALANCE.w2.desktopCost) })}</p>
          <Estimate cost={BALANCE.w2.desktopCost} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} i18n={i18n} runtime={runtime} preview={preview}/><progress value={Math.min(state.resources.pixels, BALANCE.w2.desktopCost)} max={BALANCE.w2.desktopCost} aria-label={i18n.t('k.desktop')} />
          {state.persistent.specs.color === 0 && <p>{i18n.t('k.requirement', { required: i18n.spec('color', 1), current: i18n.spec('color', 0) })}</p>}
          {k.exitInspected && state.persistent.specs.color > 0 && <p role="status">{i18n.t('k.assemblyReady')}</p>}
        </section>}
      </aside>
      <section className="k-workspace">
        <nav className="document-tabs"><button className={!extensions ? 'active' : ''} onClick={() => { setExtensions(false); act({ type: 'configure', change: { homeWindow: 'normal' } }); }}>{i18n.t('k.home')}</button>
          {extensions && <button className="active" onClick={() => setExtensions(false)}>{i18n.t('k.extensions')}</button>}
        </nav>
        {extensions ? <Extensions runtime={runtime} snapshot={snapshot} i18n={i18n} /> : <div className="workbench">
          <HomeDocument runtime={runtime} snapshot={snapshot} i18n={i18n} preview={preview} interactive={interactive} selected={selected} onSelect={selectPart} selecting={tool === 'select' || tool === 'eyedropper'} dragPart={dragPart} onDrop={drop} />
          {k.guide.seen.includes('entered') && <button className="home-comment-pin" onClick={() => readGuide('entered')}>{i18n.t('k.comment', { title: i18n.t('k.home') })}</button>}
        </div>}
        {exportsOpen && <section className="exports-list"><h2>{i18n.t('k.exports')}</h2>{!k.exports.length && <p>{i18n.t('k.emptyExports')}</p>}
          {k.exports.map(work => <button key={work.kind + work.id} onClick={() => { setExportsOpen(false); if (work.kind === 'icon') openDrawing(work.id); else if (k.placed.includes(work.id as PartId)) { setTool('select'); selectPart(work.id); } else { dragRef.current = work.id as PartId; setDragPart(work.id as PartId); } }}>{work.name || (work.kind === 'icon' ? i18n.t(`k.icon.${work.id as 'folder'}`) : i18n.t(`k.part.${work.id as PartId}`))}</button>)}
          {state.persistent.products.length > 0 && <><h2>{i18n.t('release.pastExports')}</h2><ul>{state.persistent.products.flatMap(product => product.exports.map(work => <li key={`${product.id}:${work.kind}:${work.id}`}>{i18n.t('release.guideRead', { version: productLabel(i18n,product.name,i18n.t('release.prototype')), title: work.name || i18n.t(work.kind === 'icon' ? `k.icon.${work.id as 'folder'}` : `k.part.${work.id as PartId}`) })}</li>))}</ul></>}
        </section>}
      </section>
      <aside className="icon-editor">
        <section className="icon-panel">
        <div className="editor-heading"><h2>{i18n.t(drawingId === 'free' ? 'k.file.free' : 'k.document')}</h2>
          <select aria-label={i18n.t('k.document')} value={drawingId} onChange={event => openDrawing(event.target.value)}>
            {(previewDocuments ?? availableIcons(state)).map(id => <option key={id} value={id}>{i18n.t(`k.icon.${id as 'folder'}`)}</option>)}
            <option value="free">{i18n.t('k.file.free')}</option>
          </select>
          {drawing && <span>{i18n.t('k.grid', { size: drawing.size })}</span>}
        </div>
        {drawing && <><DrawingCanvas compact={embedded} drawing={drawing} target={target} palette={palette} frame={frame} zoom={zoom} tool={tool} i18n={i18n} modern={state.persistent.artwork.modern} onBegin={begin} onEnd={runtime.persist} onStroke={stroke} onPosition={(x, y) => setPosition({ x, y })} />
          <p className="drawing-progress">{i18n.t('k.progress', { total: target.filter(c => c >= 0).length, done: target.filter((c, i) => c >= 0 && drawing.frames[0]![i] === c).length })}</p>
          <progress max={Math.max(1, target.filter(c => c >= 0).length)} value={target.filter((c, i) => c >= 0 && drawing.frames[0]![i] === c).length} aria-label={i18n.t('k.progress', { total: target.filter(c => c >= 0).length, done: target.filter((c, i) => c >= 0 && drawing.frames[0]![i] === c).length })} />
          <div className="editor-options"><label>{i18n.t('k.zoom')}<select value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[1,2,3,4].map(value => <option key={value} value={value}>{i18n.t('k.zoomValue', { count: value * 100 })}</option>)}</select></label>
            {hasKSkill(state, 'animation') && <><button disabled={drawing.frames.length === 2} onClick={() => act({ type: 'frame', id: drawingId })}>{i18n.t('k.addFrame')}</button>
              {drawing.frames.map((_, index) => <button key={index} aria-pressed={frame === index} onClick={() => setFrame(index)}>{i18n.t('k.frame', { count: index + 1 })}</button>)}
              {drawing.frames.length === 2 && <button onClick={() => setPlaying(!playing)}>{i18n.t(playing ? 'k.stopAnimation' : 'k.playAnimation')}</button>}
            </>}
            {drawingId === 'free' && hasKSkill(state, 'wallpaper') && <button onClick={() => { act({ type: 'wallpaper' }); setWallpaperNotice(true); }}>{i18n.t('k.wallpaper')}</button>}
          </div>{wallpaperNotice && <p role="status">{i18n.t('k.wallpaperSaved')}</p>}
        </>}
        </section>
        {k.built.includes('select') && (selected ? <section className="property-panel"><h2>{i18n.t('k.properties')}</h2><p>{selected === 'primary' ? i18n.t('k.primary') : i18n.t(`k.part.${selected as PartId}`)}</p>
          <label>{i18n.t('k.fillColor')}<select aria-label={i18n.t('k.fillColor')} value={design.color} onChange={event => change({ color: event.target.value })}>{!palette.includes(design.color) && <option value={design.color}>{design.color}</option>}{palette.map(c => <option value={c} key={c}>{c}</option>)}</select></label>
          <label>{i18n.t('k.radius')}<input aria-label={i18n.t('k.radius')} type="range" min={0} max={16} value={design.radius} onChange={event => change({ radius: Number(event.target.value) })} /><output>{i18n.number(design.radius)}</output></label>
          <label>{i18n.t('k.textSize')}<select aria-label={i18n.t('k.textSize')} value={design.textSize} onChange={event => change({ textSize: event.target.value as Design['textSize'] })}>{(['small','medium','large'] as const).map(id => <option key={id} value={id}>{i18n.t(`k.${id}`)}</option>)}</select></label>
          <label className="shadow-setting"><input type="checkbox" checked={design.shadow} onChange={event => change({ shadow: event.target.checked })} />{i18n.t('k.shadow')}</label>
          {hasKSkill(state, 'snap') && <p>{i18n.t('k.dimensions', dimensions)}</p>}
        </section> : state.persistent.artwork.modern && <section className="property-panel"><h2>{i18n.t('k.properties')}</h2><p>{i18n.t('k.choosePart')}</p></section>)}
        {state.persistent.artwork.modern && layers}
        {k.guide.current && !k.guide.collapsed && <section className="k-comment"><h3>{i18n.t(`k.guide.${k.guide.current}.title`)}</h3><p>{i18n.t(`k.guide.${k.guide.current}`)}</p><p>{i18n.t('guide.signature')}</p>
          {k.guide.current === 'name' && <form onSubmit={event => { event.preventDefault(); act({ type: 'name', name }); readGuide('close'); }}><label>{i18n.t('k.playerName')}<input value={name} maxLength={BALANCE.w2.maxName} onChange={event => setName(event.target.value)} /></label><button type="submit">{i18n.t('k.answer')}</button></form>}
          <button onClick={() => readGuide('close')}>{i18n.t('guide.close')}</button>
        </section>}
        {archive && <section className="comment-archive"><h2>{i18n.t('k.comments')}</h2>{k.guide.seen.map(id => <button key={id} onClick={() => readGuide(id)}>{i18n.t(`k.guide.${id}.title`)}</button>)}<GuideHistory state={state} i18n={i18n} /></section>}
        {snapshot.offline && <section className="k-comment" role="status"><p>{i18n.t('offline.notice', { duration: i18n.duration(snapshot.offline.creditedMs), pixels: i18n.pixels(snapshot.offline.pixels), count: Math.floor(snapshot.offline.pixels) })}</p></section>}
      </aside>
    </div>
    <footer className="k-status"><span>{i18n.t('k.position', { tool: i18n.t(`k.tool.${tool}`), ...position })}</span><span>{i18n.t(k.focus && k.placed.includes('switch') ? 'k.cursorPaused' : 'k.working', { count: state.run.seed.autoCursors })}</span>
      {state.lastSavedAt !== null && <span>{i18n.t('save.saved', { time: i18n.time(state.lastSavedAt) })}</span>}
      <span>{i18n.t('k.zoomValue', { count: zoom * 100 })}</span>
    </footer>
  </main>;
}
