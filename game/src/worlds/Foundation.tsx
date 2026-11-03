import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { EditorShell } from '../components/EditorShell';
import { Estimate } from '../components/Estimate';
import { LanguageSelect } from '../components/LanguageSelect';
import { BulkControl, ContractStatus } from '../components/LongPlaySettings';
import { BALANCE, type SeedItem } from '../config/balance';
import type { I18n } from '../content/i18n';
import { paletteFor } from '../content/palette';
import { editorName, editorStage } from '../systems/appearance';
import { manualClickValue, cursorPixelsPerSecond, cursorPressesPerSecond, passivePixelsPerSecond } from '../systems/economy';
import { initialPageLayout, pageColors, pageFonts, pagePartColors, PAGE_PARTS, type PagePart } from '../systems/pageDesign';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { canBuildSeed, knownSeedItems, seedCursorQuote, seedReplayQuote, visibleSeedItems } from '../systems/seed';
import { nextSeedHand } from '../systems/nextHand';
import { canSave } from '../systems/state';
import { globalMultiplier } from '../systems/longPlay';
import { PageLayoutSurface, type PageLayoutHandle } from './PageLayoutSurface';
import { PageSettings } from './PageSettings';
import {PagePartControls} from '../components/PagePartControls';
import {SeedFuturePreview} from './SeedFuturePreview';
import {SeedNextHand} from '../components/SeedNextHand';
import {SeedGenerateLabel} from '../components/SeedGenerateLabel';
import {PartCustomizePanel} from '../components/PartCustomizePanel';
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

const zoneIcons={
 goal:<svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="8" cy="8" r="2.4" fill="currentColor"/></svg>,
 hand:<svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><path d="M3.5 14.5v-11h8.6l-2.2 2.8 2.2 2.7H5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
 comments:<svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H8l-3.4 2.6v-2.6H3.5A1.5 1.5 0 0 1 2 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>,
};
/** A framed zone whose body collapses to an icon chip, so the bare page stays readable. */
function SeedZone({zone,icon,label,open,onToggle,children}:{zone:string;icon:ReactNode;label:string;open:boolean;onToggle():void;children:ReactNode}){
 return <section className="seed-zone" data-seed-zone={zone}>
  <button type="button" className="seed-zone-toggle" aria-expanded={open} onClick={onToggle}>{icon}<span className="seed-zone-label">{label}</span><span className="seed-zone-chevron" aria-hidden="true">{open?'▾':'▸'}</span></button>
  {open&&<div className="seed-zone-body">{children}</div>}
 </section>;
}

/** The initial page and its editor share one fixed coordinate space. */
export function Foundation({runtime,snapshot,i18n}:{runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n}){
 const {state,press}=snapshot,seed=state.run.seed,page=seed.page,has=(id:SeedItem)=>seed.built.includes(id);
 const stage=editorStage(state),customization=state.persistent.editorCustomization,colors=pageColors(page,state.persistent.specs.color,customization,stage);
 const [settings,setSettings]=useState(false),[arranging,setArranging]=useState(false),[history,setHistory]=useState(false),[demo,setDemo]=useState(false),[selected,setSelected]=useState<PagePart>('generator');
 const [goalOpen,setGoalOpen]=useState(true),[handOpen,setHandOpen]=useState(true),[commentOpen,setCommentOpen]=useState(true);
 const [customPart,setCustomPart]=useState<PagePart|null>(null);
 const surface=useRef<PageLayoutHandle>(null),button=useRef<HTMLButtonElement>(null),parking=useRef<HTMLDivElement>(null),[flight,setFlight]=useState({x:0,y:0});
 const held=useRef(false),lastHeld=useRef(0),reduced=runtime.platform.animation.reducedMotion(),moving=has('motion')&&!reduced;
 const now=useAnimationClock(runtime,!reduced&&(moving||seed.autoCursors>0),state.persistent.specs.refresh),rate=passivePixelsPerSecond(state),generate=manualClickValue(state);
 const cycle=now/BALANCE.time.millisecondsPerSecond*cursorPressesPerSecond(state),phase=cycle%1;
 const pressed=moving&&(!!press&&now-press.at<BALANCE.w1.numberRollMs||seed.autoCursors>0&&phase>.45&&phase<.65);
 useLayoutEffect(()=>{
  if(settings||!button.current||!parking.current)return;const measure=()=>{const a=button.current!.getBoundingClientRect(),b=parking.current!.getBoundingClientRect(),scale=b.width/parking.current!.offsetWidth||1;setFlight(old=>{const next={x:(a.left+a.width/2-b.left)/scale,y:(a.top+a.height/2-b.top)/scale};return old.x===next.x&&old.y===next.y?old:next;});};measure();const observer=new ResizeObserver(measure);observer.observe(button.current);observer.observe(parking.current);return()=>observer.disconnect();
 },[settings,page.layout,snapshot.uiScale]);
 useLayoutEffect(()=>{
  if(!has('layout')||settings)return;
  if(page.layout===null&&surface.current)runtime.actPage({type:'layout',layout:surface.current.measure()});
  if(state.persistent.examplesEnabled&&!state.persistent.testplay.layoutGuideSeen){setArranging(true);setSelected('generator');setDemo(true);runtime.actPage({type:'layout-guide-seen'});}
 },[has('layout'),page.layout,state.persistent.testplay.layoutGuideSeen,state.persistent.examplesEnabled,settings,runtime]);
 useEffect(()=>{if(!state.persistent.examplesEnabled)setDemo(false);},[state.persistent.examplesEnabled]);
 useEffect(()=>{if(!demo)return;const stop=runtime.platform.every(BALANCE.pageDesign.guideDemoMs,()=>{setDemo(false);stop();});return stop;},[demo,runtime]);
 useEffect(()=>runtime.platform.keyboard.subscribe(key=>{
  if(key.code==='Escape'&&key.pressed&&arranging){key.preventDefault();setArranging(false);setDemo(false);return;}
  if(key.code!=='Space')return;if(!key.pressed){held.current=false;return;}
  if(key.editable||settings||arranging||snapshot.releaseConfirmation||!state.persistent.seedSkills.some(id=>id==='keyboard'||id==='hold'))return;
  key.preventDefault();if(key.repeat||held.current)return;held.current=true;lastHeld.current=runtime.platform.clock.monotonicNow();runtime.pressSeed();
 }),[runtime,settings,arranging,snapshot.releaseConfirmation,state.persistent.seedSkills]);
 useEffect(()=>{if(settings||arranging||!state.persistent.seedSkills.includes('hold'))return;const interval=BALANCE.time.millisecondsPerSecond/(BALANCE.w1.holdPressesPerSecond*BALANCE.spec.refresh[state.persistent.specs.refresh]!.multiplier);return runtime.platform.every(interval,()=>{const at=runtime.platform.clock.monotonicNow();if(held.current&&at-lastHeld.current>=interval){lastHeld.current=at;runtime.pressSeed();}});},[runtime,settings,arranging,state.persistent.seedSkills,state.persistent.specs.refresh]);
 useEffect(()=>{if(settings||arranging)held.current=false;},[settings,arranging]);
 const arrange=()=>{setArranging(value=>!value);setDemo(false);};
 const restore=(type:'recommended'|'reset')=>{runtime.actPage({type});setDemo(false);};
 const purchase=(id:SeedItem|'cursor')=>{
  const item=id==='cursor'?null:BALANCE.w1.items.find(value=>value.id===id)!,quote=id==='cursor'?seedCursorQuote(state):{cost:item!.cost,count:1};
  const label=i18n.t(`seed.buy.${id}`,{cost:i18n.integer(quote.cost)}),effect=id==='border'?i18n.t('effect.clickAdd',{value:BALANCE.w1.border_bonus}):id==='color'?i18n.t('effect.cursorMult',{value:BALANCE.w1.color_cursor_mult}):id==='font'?i18n.t('effect.clickMult',{value:BALANCE.w1.font_mult}):id==='motion'?i18n.t('effect.momentum',{value:BALANCE.w1.momentum.max}):'';
  const production=id==='cursor'?cursorPixelsPerSecond(state)*quote.count:item!.perSecond*BALANCE.spec.color[state.persistent.specs.color]!.multiplier*globalMultiplier(state);
  return <li key={id}><div className="seed-upgrade-name"><span>{i18n.t(id==='cursor'?'seed.cursor':`item.${id}`)}</span>{effect&&<small>{effect}</small>}<small>{i18n.t('seed8.production',{pixels:i18n.rate(production)})}</small>{id==='cursor'&&<BulkControl state={state} runtime={runtime} i18n={i18n}/>}</div><button type="button" data-seed-upgrade={id} aria-label={label} title={label} disabled={!canBuildSeed(state,id)} onClick={()=>runtime.buildSeed(id)}>{i18n.t('seed.buildPrice',{cost:i18n.price(quote.cost)})}</button><Estimate cost={quote.cost} pixels={state.resources.pixels} rate={rate} i18n={i18n} runtime={runtime}/></li>;
 };
 const caption=generate===1?i18n.t('seed.generateSingle'):i18n.t('seed.generate',{count:generate});
 const heading=<SeedZone zone="goal" icon={zoneIcons.goal} label={i18n.t('seed.zone.longTerm')} open={goalOpen} onToggle={()=>setGoalOpen(value=>!value)}><h1>{page.heading||i18n.t('seed8.goal')}</h1><ContractStatus state={state} runtime={runtime} i18n={i18n}/></SeedZone>;
 const pixels=<div className="seed-fixed-resources" data-seed-resources><div className="seed-resource-name">{has('bars')&&<><b>{editorName(state,i18n)}</b><small>{i18n.t('seed8.document')}</small></>}</div><div className="seed-resource-values"><PixelCounter value={state.resources.pixels} now={now} moving={moving} i18n={i18n}/>{rate>0&&<small data-seed-rate={rate}>{i18n.t('seed.rate',{pixels:i18n.rate(rate)})}</small>}</div><button type="button" className="seed-link" data-page-action="settings" onClick={()=>setSettings(true)}>{i18n.t('seed.settings')}</button></div>;
 const generator=<><button ref={button} className="seed-generate generate-button" data-part="primary" aria-label={caption} title={caption} disabled={arranging||snapshot.releaseConfirmation} style={{backgroundColor:has('color')?(pagePartColors(page,'generator').background??colors.button):undefined,color:has('color')?(pagePartColors(page,'generator').text??colors.buttonText):undefined}} onKeyDown={event=>{if(event.code==='Space')event.preventDefault();}} onPointerDown={event=>{if(state.persistent.seedSkills.includes('hold')){held.current=true;lastHeld.current=runtime.platform.clock.monotonicNow();event.currentTarget.setPointerCapture(event.pointerId);}}} onPointerUp={()=>{held.current=false;}} onPointerCancel={()=>{held.current=false;}} onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();runtime.pressSeed(event.detail?{x:(event.clientX-bounds.left)/bounds.width*100,y:(event.clientY-bounds.top)/bounds.height*100}:undefined);}}><SeedGenerateLabel fullCaption={caption} formattedGain={i18n.pixels(generate)} style={{transform:pressed&&page.motion!=='fade'?`translateY(${page.motion==='lift'?-2:2}px)`:undefined,opacity:pressed&&page.motion==='fade'?.8:1}}/></button>{moving&&press&&now-press.at<BALANCE.w1.floatMs&&<span className="seed-gain" style={{left:`${press.x}%`,top:`${press.y}%`,opacity:1-(now-press.at)/BALANCE.w1.floatMs,transform:`translateY(${-36*(now-press.at)/BALANCE.w1.floatMs}px)`}}>{i18n.t('seed.gain',{pixels:i18n.integer(press.pixels)})}</span>}</>;
 const cursorTier=seed.autoCursors<=0?0:1+BALANCE.w1.cursorTierCounts.filter(count=>seed.autoCursors>=count).length;
 const cursorWidth=[0,36,42,48,56][cursorTier]!,cursorHeight=cursorWidth*24/18,cursorFill=['','#000','#1f2937','#c8553d','#c8553d'][cursorTier]!;
 const cursorTravel=!reduced&&seed.autoCursors>0?1-Math.abs(phase-.5)*2:0;
 const cursors=<div ref={parking} className="seed-cursor-parking" data-seed-cursor-parking data-cursor-tier={cursorTier||undefined}>{seed.autoCursors>0&&<svg className="seed-auto-cursor" viewBox="0 0 18 24" width={cursorWidth} height={cursorHeight} aria-hidden="true" style={{width:cursorWidth,height:cursorHeight,left:flight.x*cursorTravel,top:flight.y*cursorTravel}}>{cursorTier>=3&&<path d="M1 1V20L5.5 15.5L9 23L12 21.5L8.5 14H15Z" fill={cursorFill} opacity=".3" transform="translate(2.6 1.8)"/>}<path d="M1 1V20L5.5 15.5L9 23L12 21.5L8.5 14H15Z" fill={cursorFill} stroke={cursorTier>=4?'#ffd34d':'#fff'} strokeWidth={cursorTier>=4?1.8:cursorTier>=2?1.4:1}/>{cursorTier>=4&&<path d="M14.6.6l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" fill="#ffd34d"/>}</svg>}{seed.autoCursors>0&&<small>{i18n.t('seed.cursors',{count:seed.autoCursors})}</small>}</div>;
 const guide=seed.guide;
 const hasComments=!!(state.run.play.achievement||guide.current||snapshot.offline);
 const notice=<div className="seed-notice-stack" aria-live="polite">{nextSeedHand(state)&&<SeedZone zone="hand" icon={zoneIcons.hand} label={i18n.t('seed.zone.shortTerm')} open={handOpen} onToggle={()=>setHandOpen(value=>!value)}><SeedNextHand state={state} i18n={i18n} bare/></SeedZone>}{hasComments&&<SeedZone zone="comments" icon={zoneIcons.comments} label={i18n.t('seed.zone.comments')} open={commentOpen} onToggle={()=>setCommentOpen(value=>!value)}>{state.run.play.achievement&&<p className="achievement-line" role="status">{i18n.t('achievement.notice',{name:i18n.t(`achievement.${state.run.play.achievement.id}`)})}</p>}{guide.current&&!guide.collapsed&&<section className="seed-construction-notice"><p>{i18n.t(`seed8.guide.${guide.current}`)}</p><button type="button" className="seed-link" onClick={()=>runtime.readSeedGuide('close')}>{i18n.t('guide.close')}</button></section>}{guide.current&&guide.collapsed&&<button type="button" className="seed-link" onClick={()=>runtime.readSeedGuide(guide.current!)}>{i18n.t('guide.reopen',{count:guide.seen.length})}</button>}{snapshot.offline&&<p role="status">{i18n.t('offline.notice',{duration:i18n.duration(snapshot.offline.creditedMs),pixels:i18n.pixels(snapshot.offline.pixels),count:Math.floor(snapshot.offline.pixels)})}<button type="button" className="seed-link" onClick={runtime.dismissOffline}>{i18n.t('guide.close')}</button></p>}</SeedZone>}</div>;
 const replay=seedReplayQuote(state),replayAvailable=knownSeedItems(state).length>0,replayNext=replay.remaining[0],replayNextCost=replayNext?BALANCE.w1.items.find(item=>item.id===replayNext)!.cost:0;
 const upgrades=<><h2>{i18n.t('seed8.upgrades')}</h2><ul className="seed-upgrades">{replayAvailable&&<li className="seed-replay-purchase"><div className="seed-upgrade-name"><span title={i18n.t('seed.replayHint')}>{i18n.t('seed.replay')}</span></div><button type="button" data-seed-replay data-seed-replay-count={replay.items.length} data-seed-replay-items={replay.items.join(',')} data-seed-replay-cost={replay.cost} aria-label={i18n.t('seed.replay')} title={i18n.t('seed.replayHint')} disabled={!replay.items.length||arranging} onClick={runtime.buildKnownSeed}>{replay.items.length?i18n.t('seed.replayBuy',{count:replay.items.length,price:i18n.price(replay.cost)}):i18n.t('seed.replayWaiting')}</button>{replayNext&&<Estimate cost={replayNextCost} pixels={state.resources.pixels} rate={rate} i18n={i18n} runtime={runtime}/>}</li>}{visibleSeedItems(state).map(purchase)}{has('save')&&purchase('cursor')}</ul></>;
 const palette=has('color')&&<div className="seed-construction-palette" aria-label={i18n.t('page.color.button')}>{paletteFor(state.persistent.specs.color).map(color=><button type="button" key={color} style={{background:color}} aria-label={i18n.t('seed8.chooseColor',{color})} aria-pressed={page.button===color} onClick={()=>runtime.actPage({type:'color',slot:'button',color})}/>)}</div>;
 const tools=has('workspace')&&<div className="seed-construction-tool" role="img" aria-label={i18n.t('seed8.pencil')}><svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true"><path d="M4 20L6 14L16 4L20 8L10 18Z M14 6L18 10"/></svg></div>;
 const style={'--seed-future-reserve':`${BALANCE.w1.futurePreview.reservedWidth}px`,...(has('color')?{'--seed-background':colors.background,'--seed-text':colors.text,'--seed-button':colors.button}:{}),...(has('font')?{'--seed-font':pageFonts[page.bodyFont],'--seed-heading-font':pageFonts[page.headingFont]}:{})} as CSSProperties;
 const canCustomize=!arranging&&(has('color')||has('layout'));
 const partActions=canCustomize?Object.fromEntries(PAGE_PARTS.map(id=>[id,<Fragment key={id}><button type="button" className="seed-customize-btn" data-customize={id} aria-label={`${i18n.t(`page.part.${id}`)} ${i18n.t('page.customize')}`} title={i18n.t('page.customize')} aria-expanded={customPart===id} onClick={()=>setCustomPart(customPart===id?null:id)}><svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true"><path d="M4 20L6 14L16 4L20 8L10 18Z M14 6L18 10" fill="none" stroke="currentColor" strokeWidth={1.8}/></svg></button>{customPart===id&&<PartCustomizePanel state={state} runtime={runtime} i18n={i18n} part={id} onClose={()=>setCustomPart(null)}/>}</Fragment>])) as Partial<Record<PagePart,ReactNode>>:undefined;
 return <EditorShell stage={stage} background={customization} construction className={`seed-construction ${seed.built.map(id=>`has-${id}`).join(' ')} ${moving?'has-motion':''} ${demo?'seed-layout-revealing':''}`} style={style} top={<div className="seed-shell-title-space" aria-hidden="true"/>} palette={palette} parts={has('workspace')?<div className="seed-panel-outline" aria-hidden="true"/>:undefined} tools={tools} bottom={has('bars')?<span>{i18n.t('seed8.progress',{done:seed.built.length,total:BALANCE.w1.items.length})}</span>:undefined} layers={stage>0&&has('workspace')?<div className="seed-construction-layers">{i18n.t('seed8.workbench')}</div>:undefined} widths={{parts:customization.panelWidth}}>
   {settings?<PageSettings state={state} runtime={runtime} i18n={i18n} onClose={()=>setSettings(false)}/>:<>
    <PageLayoutSurface canvas measureRef={surface} layout={has('layout')?page.layout:initialPageLayout()} design={page} i18n={i18n} editing={arranging} allowArrangement={has('layout')} selectedPart={selected} onSelectPart={setSelected} onRequestEdit={()=>setArranging(true)} firstGuide={demo&&state.persistent.examplesEnabled} reducedMotion={reduced} onChange={layout=>runtime.actPage({type:'layout',layout})} parts={{heading,notice,pixels,generator,cursors,upgrades}} partActions={partActions}/>
    <SeedFuturePreview state={state} i18n={i18n}/>
    {arranging&&<aside className="seed-arrange-inspector"><PagePartControls state={state} runtime={runtime} i18n={i18n} part={selected} onSelect={setSelected}/></aside>}
    <footer className="seed-construction-footer">{has('bars')&&<span data-seed-progress>{i18n.t('seed8.progress',{done:seed.built.length,total:BALANCE.w1.items.length})}</span>}<p className="save-status">{canSave(state)&&state.lastSavedAt!==null?i18n.t('save.saved',{time:i18n.time(state.lastSavedAt)}):i18n.t('save.unavailableUntilBuilt')}</p>{has('layout')&&<div className="seed-layout-actions"><button type="button" data-page-action="arrange" aria-pressed={arranging} className={demo?'first-layout-cue':''} onClick={arrange}>{i18n.t('page.arrange')}</button>{arranging&&<button type="button" data-page-action="finish" onClick={()=>{setArranging(false);setDemo(false);}}>{i18n.t('page.finish')}</button>}<button type="button" data-page-action="recommended" onClick={()=>restore('recommended')}>{i18n.t('builder.recommended')}</button><button type="button" data-page-action="reset" onClick={()=>restore('reset')}>{i18n.t('page.reset')}</button></div>}{state.persistent.seedSkills.includes('history')&&<button type="button" className="seed-link" onClick={()=>setHistory(!history)}>{i18n.t('history.title')}</button>}<LanguageSelect i18n={i18n} onChange={runtime.changeLanguage}/></footer>
    {history&&<section className="seed-history-popup"><h2>{i18n.t('history.title')}</h2><button type="button" onClick={()=>setHistory(false)}>{i18n.t('guide.close')}</button><ul>{seed.history.map((entry,index)=><li key={index}>{i18n.t('history.entry',{date:i18n.date(entry.at),time:i18n.time(entry.at),name:i18n.t(entry.item==='cursor'?'seed.cursor':`item.${entry.item}`)})}</li>)}</ul></section>}
   </>}
 </EditorShell>;
}
