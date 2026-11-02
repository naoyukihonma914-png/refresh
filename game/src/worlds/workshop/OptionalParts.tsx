import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BALANCE, type SpecKey } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { paletteFor } from '../../content/palette';
import type { TestInteraction, WorkshopPartDefinition } from '../../content/workshopCatalog';
import { completedParts } from '../../systems/workshop';
import { homePixelsPerSecond, passivePixelsPerSecond, seedPartsPixelsPerSecond, workshopPartsPixelsPerSecond } from '../../systems/economy';
import { JOB_IDS } from '../../systems/desktopState';
import { jobRate } from '../../systems/desktopJobs';
import type { GameState } from '../../systems/state';
import { colorContrast, type PartProduction } from '../../systems/workshopState';
import { WorkshopGlyph } from './WorkshopGlyph';
import { partVisual } from './partVisual';
import { useWorkshopTarget } from './WorkshopTargetContext';
import './optional-parts.css';

const P=BALANCE.workshop.preview;
const SPECS:readonly SpecKey[]=['color','storage','memory','resolution','network','refresh','graphics'];
function frameForeground(s:GameState):string {
 const frame=s.run.workshop.parts['common-frame'];return frame?partVisual('common-frame',frame.design).foreground:'#ffffff';
}
function readableAccent(s:GameState,candidate:string):string {
 const palette=paletteFor(s.persistent.specs.color),foreground=frameForeground(s);
 return palette.includes(candidate)&&colorContrast(candidate,foreground)>=BALANCE.workshop.design.minContrast?candidate:palette.find(color=>colorContrast(color,foreground)>=BALANCE.workshop.design.minContrast)!;
}
type TargetCommand='list'|'photo'|'export';
interface CommandEntry {at:number;command:TargetCommand;result:string;lines:string[]}
interface ProductionEntry {at:number;pixels:number}
interface OptionalValue {
 theme:{mode:'light'|'dark';accent:string;radius:number;iconSize:number;slideshow:boolean};
 clock:{format12:boolean;duration:number;remaining:number;running:boolean;done:boolean;monthOffset:number;selectedDay:number};
 terminal:{command:TargetCommand;interval:number;running:boolean;history:CommandEntry[]};
 manager:{sortRate:boolean;selected:string|null;spec:SpecKey};plugin:'files'|'history';history:ProductionEntry[];
 actions:{theme:(patch:Partial<OptionalValue['theme']>)=>void;clockFormat:()=>void;timerDuration:(seconds:number)=>void;timerToggle:()=>void;timerReset:()=>void;month:(delta:number)=>void;day:(at:number)=>void;command:(command:TargetCommand)=>void;interval:(seconds:number)=>void;runOnce:()=>void;toggleRun:()=>void;sortProcesses:()=>void;selectProcess:(id:string)=>void;spec:(key:SpecKey)=>void;tab:(tab:'files'|'history')=>void};
}
const OptionalContext=createContext<OptionalValue|null>(null);
export function useOptionalTarget():OptionalValue {
 const value=useContext(OptionalContext);if(!value)throw new Error('Optional parts require their shared target provider');return value;
}
/** One session for every optional slot; its controls act on the same files, photo, timer and command history. */
export function OptionalTargetProvider({gameState,i18n,onExport,children}:{gameState:GameState;i18n:I18n;onExport?:()=>void;children:ReactNode}) {
 const target=useWorkshopTarget(),now=gameState.lastTickAt,runKey=`${gameState.createdAt}:${gameState.run.version}`;
 const lastRun=useRef(runKey);
 const [theme,setTheme]=useState<OptionalValue['theme']>(()=>({mode:gameState.persistent.desktopPrefs.mode,accent:readableAccent(gameState,gameState.persistent.desktopPrefs.accent),radius:gameState.persistent.desktopPrefs.radius,iconSize:gameState.persistent.desktopPrefs.iconSize,slideshow:false}));
 const safeAccent=readableAccent(gameState,theme.accent);
 useEffect(()=>{if(safeAccent!==theme.accent)setTheme(previous=>({...previous,accent:safeAccent}));},[safeAccent,theme.accent]);
 const [clock,setClock]=useState({format12:false,duration:P.intervals.at(-1)!*P.timerTickMs,remaining:P.intervals.at(-1)!*P.timerTickMs,running:false,done:false,monthOffset:0,selectedDay:now});
 const timerStart=useRef<{at:number;remaining:number}|null>(null);
 const [terminal,setTerminal]=useState<OptionalValue['terminal']>({command:'list',interval:P.intervals[0]!,running:false,history:[]});
 const [manager,setManager]=useState<OptionalValue['manager']>({sortRate:true,selected:null,spec:'memory'}),[plugin,setPlugin]=useState<OptionalValue['plugin']>('files');
 const [history,setHistory]=useState<ProductionEntry[]>([{at:now,pixels:gameState.resources.pixels}]);
 const previousProduction=useRef(''),lastCommand=useRef(now),lastSlide=useRef(now);
 const latest=useRef({gameState,target,i18n,onExport,terminal,now});latest.current={gameState,target,i18n,onExport,terminal,now};
 const execute=()=>{
  const current=latest.current,{gameState:s,target:app,i18n:language}=current,command=current.terminal.command;
  const translate=(key:string,params:Record<string,string|number>={})=>language.t(key as MessageKey,params);
  let result:string,lines:string[];
  if(command==='list'){
   app.actions.openFolder('all');app.actions.selectFoundation('files');
   const available=app.files.entries.filter(entry=>!app.trash.ids.includes(entry.id)&&!app.trash.deletedIds.includes(entry.id));
   lines=available.map(entry=>entry.name);result=translate('ws.optional.commandListed',{count:available.length});
  }else if(command==='photo'){
   app.actions.nextPhoto();
   const next=app.photo.sources[(app.photo.index+1)%app.photo.sources.length]!;
   result=translate('ws.optional.commandPhotoOpened',{name:next.label});lines=[result];
  }else{
   const count=completedParts(s).filter(id=>s.run.workshop.parts[id]!.exportedAt===null).length;
   if(count&&current.onExport){current.onExport();result=translate('ws.optional.commandExported',{count});}
   else result=translate('ws.optional.commandNothing');
   lines=[result];
  }
  lastCommand.current=current.now;
  setTerminal(previous=>({...previous,history:[...previous.history,{at:current.now,command,result,lines}].slice(-P.terminalRows)}));
 };
 const fingerprint=Object.entries(gameState.run.workshop.parts).map(([id,p])=>`${id}:${p?.step}:${p?.exportedAt}`).join('|');
 useEffect(()=>{
  if(lastRun.current===runKey)return;lastRun.current=runKey;timerStart.current=null;lastCommand.current=now;lastSlide.current=now;previousProduction.current='';
  setTheme({mode:gameState.persistent.desktopPrefs.mode,accent:readableAccent(gameState,gameState.persistent.desktopPrefs.accent),radius:gameState.persistent.desktopPrefs.radius,iconSize:gameState.persistent.desktopPrefs.iconSize,slideshow:false});
  setClock({format12:false,duration:P.intervals.at(-1)!*P.timerTickMs,remaining:P.intervals.at(-1)!*P.timerTickMs,running:false,done:false,monthOffset:0,selectedDay:now});
  setTerminal({command:'list',interval:P.intervals[0]!,running:false,history:[]});setManager({sortRate:true,selected:null,spec:'memory'});setPlugin('files');setHistory([{at:now,pixels:gameState.resources.pixels}]);
 },[runKey]);
 useEffect(()=>{if(previousProduction.current===fingerprint)return;const first=previousProduction.current==='';previousProduction.current=fingerprint;if(!first)setHistory(rows=>[...rows,{at:now,pixels:gameState.resources.pixels}].slice(-P.listRows));},[fingerprint,now,gameState.resources.pixels,runKey]);
 useEffect(()=>{
  if(!clock.running||!timerStart.current)return;
  const remaining=Math.max(0,timerStart.current.remaining-Math.max(0,now-timerStart.current.at));
  setClock(value=>remaining===value.remaining?value:{...value,remaining,running:remaining>0,done:remaining===0});
 },[now,clock.running]);
 useEffect(()=>{if(terminal.running&&now-lastCommand.current>=terminal.interval*P.timerTickMs)execute();},[now,terminal.running,terminal.interval]);
 useEffect(()=>{
  if(!theme.slideshow||now-lastSlide.current<P.slideshowMs)return;
  const steps=Math.floor((now-lastSlide.current)/P.slideshowMs);lastSlide.current=now;
  target.actions.nextPhoto(steps);target.actions.applyWallpaper();
 },[now,theme.slideshow,target.actions]);
 const value:OptionalValue={theme,clock,terminal,manager,plugin,history,actions:{
  theme:patch=>{if(patch.accent!==undefined&&readableAccent(gameState,patch.accent)!==patch.accent)return;if(patch.slideshow!==undefined)lastSlide.current=now;setTheme(old=>({...old,...patch}));},
  clockFormat:()=>setClock(old=>({...old,format12:!old.format12})),
  timerDuration:seconds=>{if(!P.intervals.includes(seconds as typeof P.intervals[number]))return;timerStart.current=null;setClock(old=>({...old,duration:seconds*P.timerTickMs,remaining:seconds*P.timerTickMs,running:false,done:false}));},
  timerToggle:()=>{if(clock.running){timerStart.current=null;setClock(old=>({...old,running:false}));}else{const remaining=clock.remaining>0?clock.remaining:clock.duration;timerStart.current={at:now,remaining};setClock(old=>({...old,remaining,running:true,done:false}));}},
  timerReset:()=>{timerStart.current=null;setClock(old=>({...old,remaining:old.duration,running:false,done:false}));},
  month:delta=>setClock(old=>({...old,monthOffset:old.monthOffset+delta})),day:at=>setClock(old=>({...old,selectedDay:at})),
  command:command=>setTerminal(old=>({...old,command})),interval:interval=>{if(P.intervals.includes(interval as typeof P.intervals[number]))setTerminal(old=>({...old,interval}));},
  runOnce:execute,toggleRun:()=>{if(!terminal.running){lastCommand.current=now;execute();}setTerminal(old=>({...old,running:!old.running}));},
  sortProcesses:()=>setManager(old=>({...old,sortRate:!old.sortRate})),selectProcess:selected=>setManager(old=>({...old,selected})),spec:spec=>setManager(old=>({...old,spec})),tab:setPlugin,
 }};
 return <OptionalContext.Provider value={value}>{children}</OptionalContext.Provider>;
}
export interface OptionalPartProps {part:WorkshopPartDefinition;production:PartProduction;state:GameState;i18n:I18n;onInteract:(interaction:TestInteraction)=>void;disabled?:boolean}
export function OptionalPart({part,production:p,state,i18n,onInteract,disabled=false}:OptionalPartProps) {
 const app=useWorkshopTarget(),shared=useOptionalTarget(),a=shared.actions,d=p.design,now=state.lastTickAt;
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params),has=(element:string)=>p.elements.includes(element);
 const act=(interaction:TestInteraction,run:()=>void)=>{if(disabled)return;run();onInteract(interaction);};
 const button=(element:string,label:string,run:()=>void,interaction:TestInteraction='press',unavailable=false)=>has(element)&&<button type="button" disabled={disabled||unavailable} data-workshop-control={element} onClick={()=>act(interaction,run)}>{label}</button>;
 const scroll=(element:string,children:ReactNode)=>has(element)&&<div className="ws-optional-scroll" tabIndex={0} data-workshop-control={element} onFocus={()=>!disabled&&onInteract('select')} onScroll={()=>!disabled&&onInteract('scroll')}>{children}</div>;
 const visual=partVisual(part.id,d);
 const styles={'--ws-part-bg':visual.background,'--ws-part-fg':visual.foreground,'--ws-part-radius':`${d.radius}px`,color:visual.foreground,background:visual.background,borderRadius:d.radius,fontSize:d.fontSize,boxShadow:d.shadow?'1px 1px 0 #666':'none'} as CSSProperties;
 const commandName=(command:TargetCommand)=>t(`ws.optional.command.${command}`);
 let contents:ReactNode;
 switch(part.id){
  case 'bin-list':contents=<>{has('item')&&<div className="ws-optional-bin-source"><select aria-label={t('ws.optional.binSource')} value={app.files.selected?.id??''} disabled={disabled||!app.files.visible.length} onChange={e=>act('select',()=>app.actions.selectFile(e.target.value))}>{app.files.visible.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><button type="button" disabled={disabled||!app.files.selected} onClick={()=>act('press',()=>app.actions.trashFile())}>{t('ws.optional.binMove')}</button></div>}{scroll('item',app.trash.entries.length?<ul className="ws-optional-item-list">{app.trash.entries.map(entry=><li key={entry.id}><button type="button" disabled={disabled} aria-pressed={app.trash.selected?.id===entry.id} onClick={()=>act('select',()=>app.actions.selectTrashFile(entry.id))}><span>{entry.name}</span>{has('date')&&<time>{i18n.legacyDate(entry.date)}</time>}</button></li>)}</ul>:<p>{t('bin.none')}</p>)}</>;break;
  case 'bin-undo':contents=<div className="ws-optional-action">{has('item')&&<span>{app.trash.selected?.name??t('bin.none')}</span>}{button('restore',t('bin.restore'),()=>app.actions.restoreFile(),'press',!app.trash.selected)}</div>;break;
  case 'bin-empty':contents=<div className="ws-optional-action">{has('count')&&<output>{t('ws.optional.binCount',{count:app.trash.entries.length})}</output>}{button('empty',t(app.trash.entries.length?'bin.empty':'ws.optional.binUndoEmpty'),()=>app.trash.entries.length?app.actions.emptyTrash():app.actions.undoEmptyTrash(),'press',!app.trash.entries.length&&!app.trash.lastEmptiedIds.length)}</div>;break;
  case 'clock-time':{
   const formatter=new Intl.DateTimeFormat(i18n.language==='en-XA'?'en':i18n.language,{hour:has('hours')?'2-digit':undefined,minute:has('minutes')?'2-digit':undefined,second:has('seconds')?'2-digit':undefined,hour12:shared.clock.format12});
   contents=<div className="ws-optional-clock-time">{p.elements.some(e=>['hours','minutes','seconds'].includes(e))&&<><button type="button" disabled={disabled} aria-label={t('clock.now')} onClick={()=>act('select',a.clockFormat)}><time dateTime={new Date(now).toISOString()}>{formatter.format(now)}</time></button><span>{t(shared.clock.format12?'ws.preview.clock12':'ws.preview.clock24')}</span></>}</div>;break;
  }
  case 'clock-timer':contents=<div className="ws-optional-timer">{has('duration')&&<><label>{t('ws.optional.timerDuration')}<select value={shared.clock.duration/P.timerTickMs} disabled={disabled} onChange={e=>act('select',()=>a.timerDuration(Number(e.target.value)))}>{P.intervals.map(seconds=><option key={seconds} value={seconds}>{t('ws.optional.seconds',{count:seconds})}</option>)}</select></label><output role="timer">{shared.clock.done?t('ws.optional.timerDone'):i18n.duration(shared.clock.remaining)}</output></>}{button('start',t(shared.clock.running?'ws.preview.pauseTimer':'ws.preview.startTimer'),a.timerToggle)}{button('start',t('ws.optional.timerReset'),a.timerReset)}</div>;break;
  case 'clock-calendar':{
   const today=new Date(now),first=new Date(today.getFullYear(),today.getMonth()+shared.clock.monthOffset,1),month=first.getMonth(),days=new Date(first.getFullYear(),month+1,0).getDate(),offset=first.getDay(),selected=new Date(shared.clock.selectedDay);
   contents=<div className="ws-optional-calendar">{has('month')&&<header><button type="button" disabled={disabled} aria-label={t('clock.previous')} onClick={()=>act('select',()=>a.month(-1))}><WorkshopGlyph name="up"/></button><strong>{i18n.month(first.getTime())}</strong><button type="button" disabled={disabled} aria-label={t('clock.next')} onClick={()=>act('select',()=>a.month(1))}><WorkshopGlyph name="down"/></button></header>}{has('days')&&<div className="ws-optional-calendar-days">{Array.from({length:7},(_,weekday)=><b key={`day-${weekday}`}>{t(`clock.weekday.${weekday}`)}</b>)}{Array.from({length:offset},(_,index)=><span key={`empty-${index}`}/>)}{Array.from({length:days},(_,index)=>{const at=new Date(first.getFullYear(),month,index+1).getTime(),chosen=selected.getFullYear()===first.getFullYear()&&selected.getMonth()===month&&selected.getDate()===index+1;return <button type="button" key={index} disabled={disabled} aria-pressed={chosen} aria-label={i18n.date(at)} onClick={()=>act('select',()=>a.day(at))}>{i18n.integer(index+1)}</button>;})}</div>}</div>;break;
  }
  case 'theme-mode':contents=<div className="ws-optional-theme-mode">{has('light')&&<button type="button" disabled={disabled} aria-pressed={shared.theme.mode==='light'} onClick={()=>act('toggle',()=>a.theme({mode:'light'}))}>{t('theme.light')}</button>}{has('dark')&&<button type="button" disabled={disabled} aria-pressed={shared.theme.mode==='dark'} onClick={()=>act('toggle',()=>a.theme({mode:'dark'}))}>{t('theme.dark')}</button>}</div>;break;
  case 'theme-accent':contents=<div className="ws-optional-accent">{has('palette')&&<label>{t('theme.accent')}<select value={shared.theme.accent} disabled={disabled} onChange={e=>act('select',()=>a.theme({accent:e.target.value}))}>{paletteFor(state.persistent.specs.color).map(color=><option key={color} value={color} disabled={colorContrast(color,frameForeground(state))<BALANCE.workshop.design.minContrast}>{color}</option>)}</select></label>}{has('sample')&&<output style={{background:shared.theme.accent}} aria-label={t('theme.accent')}/>}</div>;break;
  case 'theme-radius':contents=<div className="ws-optional-range">{(has('track')||has('thumb'))&&<label>{t('theme.radius')}<input type="range" data-show-track={has('track')} data-show-thumb={has('thumb')} min={0} max={BALANCE.workshop.design.radiusMax} value={shared.theme.radius} disabled={disabled||!has('thumb')} onChange={e=>act('slide',()=>a.theme({radius:Number(e.target.value)}))}/></label>}{has('sample')&&<output>{i18n.integer(shared.theme.radius)}</output>}</div>;break;
  case 'theme-slideshow':contents=<div className="ws-optional-slideshow">{has('images')&&<><img src={app.photo.current.src} alt={app.photo.current.label}/><label><input type="checkbox" checked={shared.theme.slideshow} disabled={disabled} onChange={e=>act('toggle',()=>a.theme({slideshow:e.target.checked}))}/>{t('theme.slideshow')}</label></>}{has('interval')&&<span>{t('ws.optional.seconds',{count:P.slideshowMs/P.timerTickMs})}</span>}</div>;break;
  case 'theme-icons':contents=<div className="ws-optional-icons">{(has('track')||has('thumb'))&&<label>{t('theme.iconSize')}<input type="range" data-show-track={has('track')} data-show-thumb={has('thumb')} min={P.iconSizes[0]} max={P.iconSizes.at(-1)} step={P.iconSizes[1]-P.iconSizes[0]} value={shared.theme.iconSize} disabled={disabled||!has('thumb')} onChange={e=>act('slide',()=>a.theme({iconSize:Number(e.target.value)}))}/></label>}{has('icon')&&<span style={{width:shared.theme.iconSize,height:shared.theme.iconSize}}><WorkshopGlyph name="file"/></span>}</div>;break;
  case 'terminal-output':contents=<div className="ws-optional-terminal">{has('prompt')&&<button type="button" disabled={disabled} className="ws-optional-prompt" data-workshop-control="prompt" onClick={()=>act('press',a.runOnce)}>{commandName(shared.terminal.command)}<WorkshopGlyph name="down"/></button>}{scroll('output',shared.terminal.history.length?<pre role="log">{shared.terminal.history.at(-1)!.lines.join('\n')}</pre>:<p>{t('ws.preview.terminalHint')}</p>)}</div>;break;
  case 'terminal-commands':contents=(has('command')||has('description'))&&<div className="ws-optional-commands">{(['list','photo','export'] as const).map(command=><button type="button" key={command} disabled={disabled} aria-pressed={shared.terminal.command===command} onClick={()=>act('select',()=>a.command(command))}>{has('command')&&<strong>{commandName(command)}</strong>}{has('description')&&<span>{t(`ws.optional.commandDescription.${command}`)}</span>}</button>)}</div>;break;
  case 'terminal-interval':contents=has('interval')&&<label className="ws-optional-interval">{t('terminal.interval')}<select value={shared.terminal.interval} disabled={disabled} onChange={e=>act('select',()=>a.interval(Number(e.target.value)))}>{P.intervals.map(seconds=><option key={seconds} value={seconds}>{has('unit')?t('ws.optional.seconds',{count:seconds}):i18n.integer(seconds)}</option>)}</select></label>;break;
  case 'terminal-run':contents=<div className="ws-optional-action">{button('run',t('ws.preview.runCommand'),()=>{if(!shared.terminal.running)a.toggleRun();},'press',shared.terminal.running)}{button('stop',t('ws.preview.stopCommand'),()=>{if(shared.terminal.running)a.toggleRun();},'press',!shared.terminal.running)}<output>{t(shared.terminal.running?'ws.preview.running':'ws.preview.stopped')}</output></div>;break;
  case 'terminal-history':contents=scroll('command',shared.terminal.history.length?<ol className="ws-optional-command-log">{shared.terminal.history.map((entry,index)=><li key={`${entry.at}:${index}`}><time>{i18n.time(entry.at)}</time><strong>{commandName(entry.command)}</strong>{has('result')&&<span>{entry.result}</span>}</li>)}</ol>:<p>{t('ws.optional.historyEmpty')}</p>);break;
  case 'manager-processes':{
   const complete=completedParts(state),base=complete.reduce((sum,id)=>sum+BALANCE.workshop.partRates[id],0),factor=base?workshopPartsPixelsPerSecond(state)/base:0,total=passivePixelsPerSecond(state);
   const rows=[{id:'cursors',name:t('manager.home'),rate:homePixelsPerSecond(state)},{id:'seed',name:t('ws.optional.seedParts'),rate:seedPartsPixelsPerSecond(state)},...complete.map(id=>({id,name:t(`ws.part.${id}`),rate:BALANCE.workshop.partRates[id]*factor})),...JOB_IDS.filter(id=>state.run.desktop.jobs[id].assigned).map(id=>({id:`job:${id}`,name:t(`desktop.app.${id}`),rate:jobRate(state,id)}))].sort((x,y)=>shared.manager.sortRate?y.rate-x.rate:x.name.localeCompare(y.name,i18n.language==='en-XA'?'en':i18n.language));
   contents=<div className="ws-optional-processes">{has('rate')&&<button type="button" disabled={disabled} onClick={()=>act('select',a.sortProcesses)}>{t(shared.manager.sortRate?'ws.optional.sortName':'ws.preview.sortRate')}</button>}<div className="ws-optional-scroll" tabIndex={0} onFocus={()=>!disabled&&onInteract('select')} onScroll={()=>!disabled&&onInteract('scroll')}><table><thead><tr>{has('process')&&<th>{t('manager.name')}</th>}{has('rate')&&<th>{t('manager.rate')}</th>}{has('share')&&<th>{t('manager.share')}</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id} aria-selected={shared.manager.selected===row.id}>{has('process')&&<td><button type="button" disabled={disabled} onClick={()=>act('select',()=>a.selectProcess(row.id))}>{row.name}</button></td>}{has('rate')&&<td>{i18n.rate(row.rate)}</td>}{has('share')&&<td>{t('number.percent',{value:i18n.number(total?row.rate/total*P.percentDivisor:0)})}</td>}</tr>)}</tbody></table></div></div>;break;
  }
  case 'manager-performance':contents=<div className="ws-optional-specs">{has('specs')&&<select aria-label={t('manager.performance')} value={shared.manager.spec} disabled={disabled} onChange={e=>act('select',()=>a.spec(e.target.value as SpecKey))}>{SPECS.map(key=><option key={key} value={key}>{t(`spec.${key}`)}</option>)}</select>}{has('values')&&<dl>{SPECS.map(key=><div key={key} data-selected-spec={shared.manager.spec===key||undefined}>{has('specs')&&<dt>{t(`spec.${key}`)}</dt>}<dd>{i18n.spec(key,state.persistent.specs[key])}</dd></div>)}</dl>}</div>;break;
  case 'plugin-tabs':contents=<div className="ws-optional-tabs">{has('tab')&&<div role="tablist">{(['files','history'] as const).map(tab=><button type="button" key={tab} role="tab" disabled={disabled} aria-selected={shared.plugin===tab} onClick={()=>act('select',()=>a.tab(tab))}>{t(tab==='files'?'ws.set.files':'ws.optional.productionHistory')}</button>)}</div>}{has('page')&&<div role="tabpanel" className="ws-optional-scroll">{shared.plugin==='files'?<ul>{app.files.visible.map(entry=><li key={entry.id}>{entry.name}</li>)}</ul>:<HistoryTable rows={shared.history} i18n={i18n}/>}</div>}</div>;break;
  case 'plugin-table':contents=<div className="ws-optional-scroll" tabIndex={0} onFocus={()=>!disabled&&onInteract('select')} onScroll={()=>!disabled&&onInteract('scroll')}><HistoryTable rows={shared.history} i18n={i18n} showTime={has('time')} showPixels={has('pixels')}/></div>;break;
  default:return null;
 }
 return <div className={`ws-destination-part ws-optional-part ws-optional-${part.id}`} data-workshop-preview={part.kind} data-workshop-test-part={part.id} style={styles}>{contents}</div>;
}
function HistoryTable({rows,i18n,showTime=true,showPixels=true}:{rows:ProductionEntry[];i18n:I18n;showTime?:boolean;showPixels?:boolean}) {
 return <table className="ws-optional-history"><thead><tr>{showTime&&<th>{i18n.t('ws.element.time')}</th>}{showPixels&&<th>{i18n.t('ws.preview.pixels')}</th>}</tr></thead><tbody>{rows.map((entry,index)=><tr key={`${entry.at}:${index}`}>{showTime&&<td>{i18n.time(entry.at)}</td>}{showPixels&&<td>{i18n.pixels(entry.pixels)}</td>}</tr>)}</tbody></table>;
}
