import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { EditorShell } from '../components/EditorShell';
import { Estimate } from '../components/Estimate';
import { LanguageSelect } from '../components/LanguageSelect';
import { BulkControl, ContractStatus } from '../components/LongPlaySettings';
import { BALANCE, type SeedItem } from '../config/balance';
import type { I18n } from '../content/i18n';
import { paletteFor } from '../content/palette';
import { editorName, editorStage } from '../systems/appearance';
import { manualClickValue, cursorPixelsPerSecond, cursorPressesPerSecond, passivePixelsPerSecond } from '../systems/economy';
import { pageColors, pageFonts, type PageLayout } from '../systems/pageDesign';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { canBuildSeed, seedCursorQuote, visibleSeedItems } from '../systems/seed';
import { canSave } from '../systems/state';
import { globalMultiplier } from '../systems/longPlay';
import { PageLayoutSurface, type PageLayoutHandle } from './PageLayoutSurface';
import { PageSettings } from './PageSettings';
import './seedConstruction.css';

export function useAnimationClock(runtime: GameRuntime, enabled: boolean, refresh: number) {
  const [now, setNow] = useState(() => runtime.platform.clock.monotonicNow());
  useEffect(() => {
    if (!enabled) return;
    let previous = 0;
    const fps = BALANCE.spec.refresh[refresh]!.animationFps;
    return runtime.platform.animation.subscribe(time => {
      if (fps === null || time - previous >= 1_000 / fps) { previous = time; setNow(time); }
    });
  }, [runtime, enabled, refresh]);
  return now;
}

function PixelCounter({ value, now, moving, i18n }: { value: number; now: number; moving: boolean; i18n: I18n }) {
  const roll = useRef({ from: value, to: value, value, at: now });
  if (roll.current.to !== value) roll.current = { from: roll.current.value, to: value, value, at: now };
  const r = roll.current;
  r.value = moving && r.to >= r.from ? r.from + (r.to - r.from) * Math.min(1, Math.max(0, now - r.at) / BALANCE.w1.numberRollMs) : value;
  return <span data-seed-pixels={value}>{i18n.t('foundation.pixels', { pixels: i18n.pixels(r.value) })}</span>;
}

/** This is the editor under construction. It is never embedded as a separate home document. */
export function Foundation({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state, press } = snapshot, seed = state.run.seed, page = seed.page;
  const has = (id: SeedItem) => seed.built.includes(id);
  const stage = editorStage(state), colors = pageColors(page, state.persistent.specs.color, state.persistent.editorCustomization, stage);
  const customization = state.persistent.editorCustomization;
  const [settings, setSettings] = useState(false), [arranging, setArranging] = useState(false), [history, setHistory] = useState(false);
  const surface = useRef<PageLayoutHandle>(null), [editingLayout, setEditingLayout] = useState<PageLayout | null>(null);
  const held = useRef(false), lastHeld = useRef(0);
  const moving = has('motion') && !runtime.platform.animation.reducedMotion();
  const now = useAnimationClock(runtime, moving, state.persistent.specs.refresh);
  const rate = passivePixelsPerSecond(state), generate = manualClickValue(state);
  const showCursors = Math.min(seed.autoCursors, BALANCE.w1.maxVisibleCursors);
  const cycle = now / 1000 * cursorPressesPerSecond(state) * Math.max(1, showCursors), phase = cycle % 1;
  const pressed = moving && (press && now - press.at < BALANCE.w1.numberRollMs || showCursors > 0 && phase > .45 && phase < .65);
  useEffect(() => runtime.platform.keyboard.subscribe(key => {
    if (key.code !== 'Space') return;
    if (!key.pressed) { held.current = false; return; }
    if (key.editable || settings || arranging || snapshot.releaseConfirmation || !state.persistent.seedSkills.some(id => id === 'keyboard' || id === 'hold')) return;
    key.preventDefault();
    if (key.repeat || held.current) return;
    held.current = true; lastHeld.current = runtime.platform.clock.monotonicNow(); runtime.pressSeed();
  }), [runtime, settings, arranging, snapshot.releaseConfirmation, state.persistent.seedSkills]);
  useEffect(() => {
    if (settings || arranging || !state.persistent.seedSkills.includes('hold')) return;
    const interval = 1000 / (BALANCE.w1.holdPressesPerSecond * BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier);
    return runtime.platform.every(interval, () => {
      const at = runtime.platform.clock.monotonicNow();
      if (held.current && at - lastHeld.current >= interval) { lastHeld.current = at; runtime.pressSeed(); }
    });
  }, [runtime, settings, arranging, state.persistent.seedSkills, state.persistent.specs.refresh]);
  useEffect(() => { if (settings || arranging) held.current = false; }, [settings, arranging]);
  const restore = (type: 'recommended' | 'reset') => { setArranging(false); setEditingLayout(null); runtime.actPage({ type }); };
  const arrange = () => { if (!arranging) setEditingLayout(surface.current?.measure() ?? page.layout); else setEditingLayout(null); setArranging(!arranging); };
  const purchase = (id: SeedItem | 'cursor') => {
    const item = id === 'cursor' ? null : BALANCE.w1.items.find(item => item.id === id)!;
    const quote = id === 'cursor' ? seedCursorQuote(state) : { cost: item!.cost, count: 1 };
    const label = i18n.t(`seed.buy.${id}`, { cost: i18n.integer(quote.cost) });
    const effect = id === 'border' ? i18n.t('effect.clickAdd', { value: BALANCE.w1.border_bonus }) : id === 'color' ? i18n.t('effect.cursorMult', { value: BALANCE.w1.color_cursor_mult }) : id === 'font' ? i18n.t('effect.clickMult', { value: BALANCE.w1.font_mult }) : id === 'motion' ? i18n.t('effect.momentum', { value: BALANCE.w1.momentum.max }) : '';
    const perSecond = id === 'cursor' ? cursorPixelsPerSecond(state) * quote.count : item!.perSecond * BALANCE.spec.color[state.persistent.specs.color]!.multiplier * globalMultiplier(state);
    return <li key={id}><div className="seed-upgrade-name"><span>{i18n.t(id === 'cursor' ? 'seed.cursor' : `item.${id}`)}</span>{effect && <small>{effect}</small>}<small>{i18n.t('seed8.production', { pixels: i18n.number(perSecond) })}</small>{id === 'cursor' && <BulkControl state={state} runtime={runtime} i18n={i18n}/>}</div>
      <button data-seed-upgrade={id} aria-label={label} disabled={!canBuildSeed(state, id)} onClick={() => runtime.buildSeed(id)}>{i18n.t('seed.buildPrice', { cost: i18n.integer(quote.cost) })}</button><Estimate cost={quote.cost} pixels={state.resources.pixels} rate={rate} i18n={i18n} runtime={runtime}/></li>;
  };
  const heading = <><h1>{page.heading || i18n.t('seed8.goal')}</h1><ContractStatus state={state} runtime={runtime} i18n={i18n}/>{state.run.play.achievement && <p className="achievement-line" role="status">{i18n.t('achievement.notice', { name: i18n.t(`achievement.${state.run.play.achievement.id}`) })}</p>}</>;
  const guide = seed.guide;
  const notices = <>{guide.current && !guide.collapsed && <section className="seed-construction-notice"><h2>{i18n.t('guide.title')}</h2><p>{i18n.t(`seed8.guide.${guide.current}`)}</p><p>{i18n.t('guide.signature')}</p><button className="seed-link" onClick={() => runtime.readSeedGuide('close')}>{i18n.t('guide.close')}</button></section>}{guide.collapsed && guide.current && <button className="seed-link" onClick={() => runtime.readSeedGuide(guide.current!)}>{i18n.t('guide.reopen', { count: guide.seen.length })}</button>}{snapshot.offline && <p role="status">{i18n.t('offline.notice', { duration: i18n.duration(snapshot.offline.creditedMs), pixels: i18n.pixels(snapshot.offline.pixels), count: Math.floor(snapshot.offline.pixels) })}<button className="seed-link" onClick={runtime.dismissOffline}>{i18n.t('guide.close')}</button></p>}</>;
  const generator = <><p className="seed-construction-resources"><PixelCounter value={state.resources.pixels} now={now} moving={moving} i18n={i18n}/>{rate > 0 && <small data-seed-rate={rate}>{i18n.t('seed.rate', { pixels: i18n.rate(rate) })}</small>}</p><div className="seed-generator-line"><div className="seed-generator-anchor"><button className="seed-generate generate-button" data-part="primary" onKeyDown={event => { if (event.code === 'Space') event.preventDefault(); }} onPointerDown={event => { if (state.persistent.seedSkills.includes('hold')) { held.current = true; lastHeld.current = runtime.platform.clock.monotonicNow(); event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerUp={() => { held.current = false; }} onPointerCancel={() => { held.current = false; }} style={{ backgroundColor: has('color') ? colors.button : undefined, color: has('color') ? colors.buttonText : undefined, transform: moving && pressed && page.motion !== 'fade' ? `translateY(${page.motion === 'lift' ? -2 : 2}px)` : undefined, filter: moving && pressed && page.motion === 'fade' ? 'brightness(.9)' : undefined }} onClick={event => { const r = event.currentTarget.getBoundingClientRect(); runtime.pressSeed(event.detail ? { x: (event.clientX - r.left) / r.width * 100, y: (event.clientY - r.top) / r.height * 100 } : undefined); }}>{generate === 1 ? i18n.t('seed.generateSingle') : i18n.t('seed.generate', { count: generate })}</button>
    {Array.from({ length: showCursors }, (_, index) => { const rank = (index - Math.floor(cycle) % showCursors + showCursors) % showCursors; const travel = moving && rank === 0 ? 1 - Math.abs(phase - .5) * 2 : 0; return <svg key={index} className="seed-auto-cursor" viewBox="0 0 18 24" aria-hidden="true" style={{ left: 20 + rank % 10 * 18 - travel * 28, top: 44 + Math.floor(rank / 10) * 24 - travel * 40 }}><path d="M1 1V20L5.5 15.5L9 23L12 21.5L8.5 14H15Z" fill="#000" stroke="#fff"/></svg>; })}
    {moving && press && now - press.at < BALANCE.w1.floatMs && <span className="seed-gain" style={{ left: `${press.x}%`, top: `${press.y}%`, opacity: 1 - (now - press.at) / BALANCE.w1.floatMs, transform: `translateY(${-36 * (now - press.at) / BALANCE.w1.floatMs}px)` }}>{i18n.t('seed.gain', { pixels: i18n.integer(press.pixels) })}</span>}</div></div>{seed.autoCursors > showCursors && <small>{i18n.t('seed.cursors', { count: seed.autoCursors })}</small>}</>;
  const upgrades = <><h2>{i18n.t('seed8.upgrades')}</h2><ul className="seed-upgrades">{visibleSeedItems(state).map(purchase)}</ul>{has('save') && <ul className="seed-upgrades seed-cursor-purchase">{purchase('cursor')}</ul>}</>;
  const palette = has('color') && <div className="seed-construction-palette" aria-label={i18n.t('page.color.button')}>{paletteFor(state.persistent.specs.color).map(color => <button key={color} style={{ background: color }} aria-label={i18n.t('seed8.chooseColor', { color })} title={i18n.t('seed8.chooseColor', { color })} aria-pressed={page.button === color} onClick={() => runtime.actPage({ type: 'color', slot: 'button', color })}/>)}</div>;
  const top = has('bars') && <div className="seed-editor-bar"><b>{editorName(state, i18n)}</b><span>{i18n.t('seed8.document')}</span><span>{i18n.t('foundation.pixels', { pixels: i18n.pixels(state.resources.pixels) })}</span><small>{i18n.t('seed.rate', { pixels: i18n.rate(rate) })}</small><button onClick={() => setSettings(!settings)}>{i18n.t('seed.settings')}</button></div>;
  const parts = has('workspace') && <div className="seed-built-parts"><h2>{i18n.t('seed8.parts')}</h2><ul>{seed.built.map(id => <li key={id}>{i18n.t(`item.${id}`)}</li>)}</ul></div>;
  const tools = has('workspace') && <div className="seed-construction-tool" role="img" aria-label={i18n.t('seed8.pencil')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L6 14L16 4L20 8L10 18Z M14 6L18 10"/></svg></div>;
  const bottom = has('bars') && <span>{i18n.t('seed8.progress', { done: seed.built.length, total: BALANCE.w1.items.length })}</span>;
  const style = { ...(has('color') ? { '--seed-background': colors.background, '--seed-text': colors.text, '--seed-button': colors.button } : {}), ...(has('font') ? { '--seed-font': pageFonts[page.bodyFont], '--seed-heading-font': pageFonts[page.headingFont] } : {}) } as CSSProperties;
  return <EditorShell stage={stage} background={customization} construction className={`seed-construction ${seed.built.map(id => `has-${id}`).join(' ')} ${moving ? 'has-motion' : ''}`} style={style} top={top} palette={palette} parts={parts} tools={tools} bottom={bottom} layers={stage > 0 && has('workspace') && <div className="seed-construction-layers">{i18n.t('seed8.workbench')}</div>} positions={stage === 2 && customization.panelPositions.palette === 'left' && customization.panelPositions.tools === 'right' && customization.panelPositions.parts === 'right' ? undefined : stage >= 1 ? { palette: customization.panelPositions.palette, tools: customization.panelPositions.tools, parts: customization.panelPositions.parts, bottom: customization.panelPositions.info } : undefined} widths={{ parts: customization.panelWidth }} bandPosition={customization.bandPosition}>
    {settings ? <PageSettings state={state} runtime={runtime} i18n={i18n} onClose={() => setSettings(false)}/> : <><div className="seed-construction-content">{has('layout') ? <PageLayoutSurface canvas measureRef={surface} layout={editingLayout ?? page.layout} i18n={i18n} editing={arranging} onChange={layout => { setEditingLayout(null); runtime.actPage({ type: 'layout', layout }); }} parts={{ heading, notice: notices, generator, upgrades }}/> : <>{heading}{notices}{generator}{upgrades}</>}</div><div className="seed-construction-footer"><p className="save-status">{canSave(state) && state.lastSavedAt !== null ? i18n.t('save.saved', { time: i18n.time(state.lastSavedAt) }) : i18n.t('save.unavailableUntilBuilt')}</p>{has('color') && <button className="seed-link" onClick={() => setSettings(true)}>{i18n.t('seed.settings')}</button>}{has('layout') && <div className="seed-layout-actions"><button onClick={arrange}>{i18n.t(arranging ? 'page.finish' : 'page.arrange')}</button><button onClick={() => restore('recommended')}>{i18n.t('builder.recommended')}</button><button onClick={() => restore('reset')}>{i18n.t('page.reset')}</button></div>}{state.persistent.seedSkills.includes('history') && <><button className="seed-link" onClick={() => setHistory(!history)}>{i18n.t('history.title')}</button>{history && <ul>{seed.history.map((entry, index) => <li key={index}>{i18n.t('history.entry', { date: i18n.date(entry.at), time: i18n.time(entry.at), name: i18n.t(entry.item === 'cursor' ? 'seed.cursor' : `item.${entry.item}`) })}</li>)}</ul>}</>}<LanguageSelect i18n={i18n} onChange={runtime.changeLanguage}/></div></>}
  </EditorShell>;
}
