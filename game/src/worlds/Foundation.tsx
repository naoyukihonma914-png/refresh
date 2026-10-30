import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BALANCE, type SeedItem } from '../config/balance';
import type { I18n } from '../content/i18n';
import { canSave } from '../systems/state';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { canBuildSeed, cursorPrice, visibleSeedItems } from '../systems/seed';
import { cursorPressesPerSecond, manualClickValue } from '../systems/economy';
import { LanguageSelect } from '../components/LanguageSelect';
import { PageSettings } from './PageSettings';

function useAnimationClock(runtime: GameRuntime, enabled: boolean, refresh: number) {
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

function RollingPixels({ value, now, enabled, i18n }: { value: number; now: number; enabled: boolean; i18n: I18n }) {
  const rolling = useRef({ target: value, from: value, displayed: value, at: now });
  if (rolling.current.target !== value) rolling.current = { target: value, from: rolling.current.displayed, displayed: rolling.current.displayed, at: now };
  const roll = rolling.current;
  const progress = Math.min(1, Math.max(0, now - roll.at) / BALANCE.w1.numberRollMs);
  roll.displayed = enabled && value >= roll.from ? roll.from + (value - roll.from) * progress : value;
  return <span className="pixel-count" data-value={value}>{i18n.t('foundation.pixels', { pixels: i18n.pixels(roll.displayed) })}</span>;
}

export function Foundation({ snapshot, i18n, runtime }: { snapshot: RuntimeSnapshot; i18n: I18n; runtime: GameRuntime }) {
  const { state, offline, press } = snapshot;
  const { seed } = state.run;
  const has = (id: SeedItem) => seed.built.includes(id);
  const [settings, setSettings] = useState(false);
  const [conditions, setConditions] = useState(false);
  const [archive, setArchive] = useState(false);
  const held = useRef(false);
  const motion = has('motion') && !runtime.platform.animation.reducedMotion();
  const now = useAnimationClock(runtime, seed.autoCursors > 0 || has('motion') || state.persistent.seedSkills.includes('hold'), state.persistent.specs.refresh);
  const [floating, setFloating] = useState<NonNullable<RuntimeSnapshot['press']>[]>([]);
  useEffect(() => {
    if (!motion || !press) { setFloating([]); return; }
    setFloating(previous => [...previous.filter(item => press.at - item.at < BALANCE.w1.floatMs).slice(-(BALANCE.w1.maxFloatingGains - 1)), press]);
  }, [press, motion]);
  const lastHeld = useRef(0);
  const skills = state.persistent.seedSkills;
  useEffect(() => runtime.platform.keyboard.subscribe(key => {
    if (key.code !== 'Space') return;
    if (!key.pressed) { held.current = false; return; }
    if (key.editable || settings) return;
    key.preventDefault();
    if (!skills.includes('keyboard') && !skills.includes('hold')) return;
    if (key.repeat || held.current) return;
    held.current = true;
    lastHeld.current = runtime.platform.clock.monotonicNow();
    runtime.pressSeed();
  }), [runtime, skills, settings]);
  useEffect(() => {
    if (!skills.includes('hold') || settings) return;
    const interval = 1_000 / (BALANCE.w1.holdPressesPerSecond * BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier);
    return runtime.platform.every(interval, () => {
      const time = runtime.platform.clock.monotonicNow();
      if (held.current && time - lastHeld.current >= interval) { lastHeld.current = time; runtime.pressSeed(); }
    });
  }, [runtime, skills, settings, state.persistent.specs.refresh]);
  const items = visibleSeedItems(state);
  const guide = seed.guide;
  const showCursors = Math.min(BALANCE.w1.maxVisibleCursors, seed.autoCursors);
  const generate = manualClickValue(state);
  const activePress = motion && press && now - press.at < BALANCE.w1.numberRollMs;
  const cursorCycle = now / 1_000 * cursorPressesPerSecond(state) * showCursors;
  const cursorPhase = cursorCycle % 1;
  const autoPressed = motion && showCursors > 0 && cursorPhase > 0.45 && cursorPhase < 0.65;
  const appearance = state.persistent.seedAppearance;
  const className = ['foundation', 'seed-page', has('border') && 'has-border', has('color') && 'has-color',
    has('font') && 'has-font', has('layout') && 'has-layout', motion && 'has-motion',
    state.persistent.specs.color > 0 && 'modern-colors', skills.includes('pattern') && `pattern-${appearance.pattern}`,
    skills.includes('marquee') && appearance.marquee && 'has-marquee'].filter(Boolean).join(' ');
  const purchase = (id: SeedItem | 'cursor') => {
    const cost = id === 'cursor' ? cursorPrice(state) : BALANCE.w1.items.find(item => item.id === id)!.cost;
    const label = i18n.t(`seed.buy.${id}`, { cost: i18n.price(cost) });
    const name = id === 'cursor' ? i18n.t('seed.cursor') : i18n.t(`item.${id}`);
    return <li key={id}>{has('layout') && <span>{name}</span>}
      <button className="build-button" disabled={!canBuildSeed(state, id)} onClick={() => runtime.buildSeed(id)} aria-label={label}>
        {has('layout') ? i18n.t('seed.buildPrice', { cost: i18n.price(cost) }) : label}
      </button></li>;
  };
  return <main className={className}>
    {settings ? <PageSettings key={state.createdAt} state={state} runtime={runtime} i18n={i18n} onClose={() => setSettings(false)} /> : <div className="seed-content">
      <p className="goal"><b>{i18n.t('foundation.goalLabel')}</b>{i18n.t('foundation.goal')}
        <button className="text-button goal-progress" onClick={() => setConditions(!conditions)} aria-expanded={conditions}>{i18n.t('seed.goalProgress', { done: 0, total: 5 })}</button>
      </p>
      {conditions && <section className="release-conditions"><h2>{i18n.t('seed.conditions')}</h2><ul>
        {(['apps', 'requests', 'icons', 'wallpaper', 'automation'] as const).map(id => <li key={id}>{i18n.t(`seed.condition.${id}`)}</li>)}
      </ul></section>}
      {guide.seen.length > 0 && <section className="guide-notices">
        {guide.collapsed ? <button className="text-button" onClick={() => { runtime.readSeedGuide(guide.current!); setArchive(true); }}>{i18n.t('guide.reopen', { count: guide.seen.length })}</button>
          : <><h2>{i18n.t('guide.title')}</h2>
            <p className="guide-body">{guide.current && i18n.t(`guide.${guide.current}`)}</p>
            <p className="guide-signature">{i18n.t('guide.signature')}</p>
            <div className="guide-actions">
              {guide.current === 'intro' && !guide.seen.includes('instructions') && <button className="text-button" onClick={() => runtime.readSeedGuide('listen')}>{i18n.t('guide.listen')}</button>}
              <button className="text-button" onClick={() => { runtime.readSeedGuide('close'); setArchive(false); }}>{i18n.t(guide.current === 'intro' ? 'guide.later' : 'guide.close')}</button>
              {guide.seen.length > 1 && <button className="text-button" onClick={() => setArchive(!archive)}>{i18n.t('guide.reopen', { count: guide.seen.length })}</button>}
            </div></>}
        {archive && <ul className="notice-archive">{guide.seen.map(id => <li key={id}><button className="text-button" onClick={() => runtime.readSeedGuide(id)}>{i18n.t('guide.read', { title: i18n.t(`guide.${id}.title`) })}</button></li>)}</ul>}
      </section>}
      {seed.installer && <section className="installer" role="status"><p>{i18n.t('installer.title')}</p>
        <progress max={BALANCE.w1.inheritMs} value={seed.installer.elapsedMs} aria-label={i18n.t('installer.title')} />
        <p>{i18n.t('installer.progress', { done: seed.built.length, total: seed.installer.items.length })}</p></section>}
      <p className="pixels-line"><RollingPixels value={state.resources.pixels} now={now} enabled={motion} i18n={i18n} /></p>
      <p className="generator-line" style={{ minBlockSize: showCursors > 0 ? 70 : undefined }}><span className="generator-anchor">
        <button type="button" className="generate-button" onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          runtime.pressSeed(event.detail === 0 ? undefined : { x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 });
        }} disabled={!!seed.installer}
          style={{ '--press-depth': activePress ? `${1 + (press.momentum - 1) * 5}px` : autoPressed ? '1px' : '0px' } as CSSProperties}>
          {generate === 1 ? i18n.t('seed.generateSingle') : i18n.t('seed.generate', { count: generate })}</button>
        {Array.from({ length: showCursors }, (_, index) => {
          const rank = (index - Math.floor(cursorCycle) % showCursors + showCursors) % showCursors;
          const atButton = cursorPhase > 0.45 && cursorPhase < 0.65;
          const travel = rank !== 0 ? 0 : motion ? 1 - Math.abs(cursorPhase - 0.5) * 2 : atButton ? 1 : 0;
          const queueX = 18 + rank % 10 * 18;
          const queueY = 8 + Math.floor(rank / 10) * 24;
          return <svg className="auto-cursor" key={index} viewBox="0 0 18 24" aria-hidden="true"
            style={{ insetInlineStart: `calc(${100 - 65 * travel}% + ${queueX * (1 - travel)}px)`, insetBlockStart: `${queueY * (1 - travel)}px` }}>
            <path d="M1 1V20L5.5 15.5L9 23L12 21.5L8.5 14H15Z" fill="#000" stroke="#fff" strokeWidth="1.5" /></svg>;
        })}
        {motion && floating.filter(item => now - item.at < BALANCE.w1.floatMs).map(item => <span key={item.serial} className="pixel-gain" aria-hidden="true"
          style={{ insetInlineStart: `${item.x}%`, insetBlockStart: `${item.y}%`, transform: `translateY(${-36 * Math.max(0, now - item.at) / BALANCE.w1.floatMs}px)`, opacity: Math.max(0, 1 - (now - item.at) / BALANCE.w1.floatMs) }}>
          {i18n.t('seed.gain', { pixels: i18n.number(item.pixels) })}</span>)}
      </span></p>
      {seed.autoCursors > BALANCE.w1.maxVisibleCursors && <p className="cursor-summary">{i18n.t('seed.cursors', { count: seed.autoCursors })}</p>}
      <hr />
      {!has('kumiki') && <><p className="available-heading"><span>{i18n.t('seed.available')}</span></p><ul className="build-list">
        {canSave(state) && purchase('cursor')}{items.map(purchase)}</ul></>}
      {has('kumiki') && <><p className="seed-complete" role="status">{i18n.t('seed.complete')}</p><ul className="build-list">{purchase('cursor')}</ul></>}
      <p className="save-status">{canSave(state) && state.lastSavedAt !== null
        ? i18n.t('save.saved', { time: i18n.time(state.lastSavedAt) }) : i18n.t('save.unavailableUntilBuilt')}</p>
      {offline && <p role="status">{i18n.t('offline.notice', { duration: i18n.duration(offline.creditedMs), pixels: i18n.pixels(offline.pixels), count: Math.floor(offline.pixels) })}</p>}
      {state.run.version !== 'v0.1' && <p><button className="text-button" onClick={() => setSettings(true)}>{i18n.t('seed.settings')}</button></p>}
      {skills.includes('history') && <section className="change-history"><h2>{i18n.t('history.title')}</h2>
        {seed.history.length === 0 ? <p>{i18n.t('history.empty')}</p> : <ul>{seed.history.map((entry, index) => <li key={index}>
          {i18n.t('history.entry', { date: i18n.date(entry.at), time: i18n.time(entry.at), name: entry.item === 'cursor' ? i18n.t('seed.cursor') : i18n.t(`item.${entry.item}`) })}</li>)}</ul>}
      </section>}
      <p className="language-settings"><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} /></p>
    </div>}
  </main>;
}
