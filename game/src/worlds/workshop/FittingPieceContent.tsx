import { useState, type CSSProperties, type ReactNode } from 'react';
import { BALANCE, type SpecKey } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { paletteFor } from '../../content/palette';
import type { WorkshopPartDefinition, WorkshopPartId } from '../../content/workshopCatalog';
import type { GameState } from '../../systems/state';
import type { PartProduction } from '../../systems/workshopState';
import { completedParts } from '../../systems/workshop';
import { passivePixelsPerSecond, producerLedger } from '../../systems/economy';
import { producerName } from '../productionLabels';
import { WorkshopGlyph } from './WorkshopGlyph';
import { useWorkshopTarget, type TargetFileSort } from './WorkshopTargetContext';
import { useOptionalTarget } from './OptionalParts';
import { partVisual } from './partVisual';
import { fittingWindowControlPalette } from '../../systems/commonChrome';
import './fitting-piece-content.css';

const SPECS:readonly SpecKey[]=['color','storage','memory','resolution','network','refresh','graphics'];
type WindowAction='minimize'|'maximize'|'close';
export interface FittingPieceContentProps {
 part:WorkshopPartDefinition;piece:string;production:PartProduction;state:GameState;i18n:I18n;loose?:boolean;
 onWindowAction?:(symbol:WindowAction)=>void;
}

/** A pair occupies one physical seat, while its current state chooses the face. */
export function useFittingPieceFront(part:WorkshopPartId,piece:string,production:PartProduction,loose=false):boolean {
 const {mail}=useWorkshopTarget(),{terminal}=useOptionalTarget();
 if(loose)return true;
 const fitted=(id:string)=>production.elements.includes(id);
 if(part==='mail-unread'&&fitted('unread')&&fitted('read'))return piece===(mail.selected&&mail.readIds.includes(mail.selected.id)?'read':'unread');
 if(part==='terminal-run'&&fitted('run')&&fitted('stop'))return piece===(terminal.running?'stop':'run');
 return true;
}

/** Each fitted piece is a live part of the destination app, with no trial stage. */
export function FittingPieceContent({part,piece,production,state,i18n,loose=false,onWindowAction}:FittingPieceContentProps){
 const target=useWorkshopTarget(),shared=useOptionalTarget(),{files,mail,photo,trash,foundation,stream,actions:a}=target,b=shared.actions;
 const [folded,setFolded]=useState(false),[applied,setApplied]=useState(false);
 const front=useFittingPieceFront(part.id,piece,production,loose),P=BALANCE.workshop.preview;
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params);
 const label=t(`ws.element.${piece}`),visual=partVisual(part.id,production.design),d=production.design;
 const button=(text:string,action:()=>void,disabled=false,children?:ReactNode)=><button type="button" disabled={loose||disabled} onClick={action} data-workshop-control={piece}>{children??text}</button>;
 const range=(value:number,min:number,max:number,action:(value:number)=>void)=><input type="range" aria-label={t(part.labelKey)} disabled={loose} min={min} max={max} value={value} data-workshop-control={piece} onChange={e=>action(Number(e.target.value))}/>;
 const image=(original=false)=><img src={photo.current.src} alt={photo.current.label} draggable={false} style={{filter:original?undefined:photo.filter}}/>;
 const fileRows=(content:(entry:typeof files.visible[number])=>ReactNode)=>files.visible.map(entry=><button type="button" key={entry.id} disabled={loose} aria-pressed={files.selectedId===entry.id} onClick={()=>a.selectFile(entry.id)}>{content(entry)}</button>);
 const commandName=(command:'list'|'photo'|'export')=>t(`ws.optional.command.${command}`);
 let content:ReactNode=null;
 switch(part.id){
  case 'common-frame':
   if(piece==='title')content=<strong style={{inlineSize:'100%',textAlign:d.titleAlign==='start'?'left':d.titleAlign==='end'?'right':'center'}}>{t('ws.set.common')}</strong>;
   else if(piece==='scrollbar')content=<div className="wf-native-scrollbar" aria-label={t('ws.element.scrollbar')}><span/><span/><span/></div>;
   else content=<button type="button" disabled={loose} aria-label={t(`ws.window.${piece}`)} data-workshop-control={piece} onClick={()=>onWindowAction?.(piece as WindowAction)} style={fittingWindowControlPalette}><WorkshopGlyph name={piece as WindowAction}/></button>;
   break;
  case 'common-button':content=button(t(foundation.upgradeOpen?'ws.close':'ws.preview.press'),a.toggleUpgrade);break;
  case 'common-heading':content=piece==='separator'?<hr hidden={!d.separator}/>:button(t('ws.preview.folderHeading'),()=>setFolded(!folded),false,<span>{t('ws.preview.folderHeading')}{!folded&&<small>{files.selected?.name??t('ws.preview.files')}</small>}</span>);break;
  case 'common-progress':{
   const percent=completedParts(state).length/Math.max(1,Object.keys(state.run.workshop.parts).length)*P.percentDivisor;
   content=piece==='percent'?<output hidden={!d.showPercent}>{t('ws.percent',{count:i18n.number(percent)})}</output>:<progress className={piece==='track'?'wf-empty-progress':''} max={P.percentDivisor} value={piece==='fill'?percent:0} style={{accentColor:visual.background,height:d.progressHeight,borderRadius:d.radius}}/>;break;
  }
  case 'foundation-taskbar':content=piece==='resource-area'?<span>{t('ws.pixels',{count:i18n.pixels(state.resources.pixels)})}<small>{t('ws.tokens',{count:i18n.integer(state.resources.tokens)})}</small></span>:<div className="wf-row">{(['files','mail'] as const).map(app=><button key={app} type="button" disabled={loose} aria-pressed={foundation.activeApp===app} onClick={()=>a.selectFoundation(app)}>{t(`ws.set.${app}`)}</button>)}</div>;break;
  case 'foundation-desktop':content=piece==='surface'?button(t('ws.preview.desktopSelect'),()=>a.selectFoundationIcon(null),false,<span className="wf-desktop-surface" style={photo.wallpaperSource?{backgroundImage:`url(${photo.wallpaperSource.src})`}:undefined}/>):button(t('ws.preview.desktopSelect'),()=>a.selectFoundationIcon(files.entries[0]?.id??null),false,<span className="wf-selection-frame"/>);break;
  case 'foundation-icons':content=button(files.entries[0]?.name??t('ws.preview.files'),()=>{a.selectFoundationIcon(files.entries[0]?.id??null);a.selectFoundation('files');},false,piece==='icon'?<WorkshopGlyph name="file"/>:<span>{files.entries[0]?.name??t('ws.preview.files')}</span>);break;
  case 'foundation-notification':content=piece==='message'?<span>{t(foundation.noticeRead?'ws.preview.noticeRead':'ws.preview.noticeBody')}</span>:button(t('ws.preview.open'),a.readNotice);break;
  case 'foundation-wallpaper':content=piece==='image'?button(photo.current.label,()=>{a.nextPhoto();a.applyWallpaper();},false,image()):button(t('ws.element.fit'),a.applyWallpaper);break;
  case 'foundation-upgrades':content=piece==='item'?<strong>{t('ws.set.clock')}</strong>:piece==='price'?<span>{t('ws.price',{count:i18n.price(BALANCE.workshop.setCosts.clock)})}</span>:button(t(foundation.upgradeOpen?'ws.close':'ws.preview.open'),a.toggleUpgrade);break;
  case 'files-list':content=piece==='columns'?<div className="wf-row wf-column-head"><span>{t('ws.fileName')}</span><span>{t('ws.fileType')}</span><span>{t('ws.fileDate')}</span></div>:<div className="wf-list">{fileRows(entry=><span><WorkshopGlyph name="file"/>{entry.name}</span>)}</div>;break;
  case 'files-back':content=piece==='back'?button(t('ws.preview.back'),a.back,false,<WorkshopGlyph name="up"/>):<select aria-label={t('ws.preview.folderHeading')} disabled={loose} value={files.folder} onChange={e=>a.openFolder(e.target.value as 'all'|'sets'|'exports')}><option value="all">{t('ws.preview.home')}</option><option value="sets">{t('ws.set')}</option><option value="exports">{t('ws.exports')}</option></select>;break;
  case 'files-sort':content=piece==='sort-key'?<select aria-label={t('ws.fileSort')} disabled={loose} value={files.sort} onChange={e=>a.setFileSort(e.target.value as TargetFileSort)}>{(['name','date','type'] as const).map(key=><option key={key} value={key}>{t(`ws.fileSort.${key}`)}</option>)}</select>:button(t(files.ascending?'ws.preview.sortAscending':'ws.preview.sortDescending'),()=>a.setFileSort(files.sort));break;
  case 'files-search':content=piece==='query'?<input aria-label={t('ws.preview.search')} disabled={loose} value={files.query} data-workshop-control="query" onChange={e=>a.setFileQuery(e.target.value)}/>:button(t('ws.preview.search'),()=>a.setFileQuery(files.query));break;
  case 'files-large':content=piece==='icon'?button(t('ws.part.files-large'),a.toggleFileLarge,false,<WorkshopGlyph name="file"/>):<label><input type="checkbox" disabled={loose} checked={files.large} onChange={a.toggleFileLarge}/>{t('ws.part.files-large')}</label>;break;
  case 'files-storage':content=piece==='used'?<meter min={0} max={Math.max(1,files.capacity)} value={files.used}/>:<output>{t('ws.storageCount',{used:i18n.integer(files.used),capacity:i18n.integer(files.capacity)})}</output>;break;
  case 'mail-list':content=<div className="wf-list wf-mail-column"><strong>{t(`ws.element.${piece}`)}</strong>{mail.visible.map(message=><button type="button" key={message.id} disabled={loose} aria-pressed={mail.selected?.id===message.id} onClick={()=>a.selectMail(message.id)}>{piece==='sender'?message.sender:piece==='subject'?message.subject:i18n.legacyDate(message.date)}</button>)}</div>;break;
  case 'mail-body':content=piece==='subject'?<strong>{mail.selected?.subject??t('ws.element.subject')}</strong>:<article>{mail.selected?.body??t('ws.preview.noticeBody')}</article>;break;
  case 'mail-reply':content=piece==='reply'?button(t('ws.preview.reply'),()=>a.openReply(!mail.replyOpen)):<textarea aria-label={t('ws.preview.draft')} disabled={loose} value={mail.draft} onChange={e=>a.setDraft(e.target.value)}/>;break;
  case 'mail-folders':content=button(t(`ws.preview.${piece}`),()=>a.setMailFolder(piece as 'inbox'|'archive'));break;
  case 'mail-unread':content=button(t(piece==='read'?'ws.preview.read':'ws.preview.unread'),()=>{if(mail.selected)a.markMailRead(piece==='unread');else if(mail.visible[0]){a.selectMail(mail.visible[0].id);}},false,<span className={`wf-envelope ${piece==='read'?'is-read':''}`}><svg viewBox="0 0 20 14" aria-hidden="true"><path d={piece==='read'?'M1 5L10 1L19 5V13H1ZM1 5L10 10L19 5':'M1 1H19V13H1ZM1 1L10 8L19 1'}/></svg><span>{t(piece==='read'?'ws.preview.read':'ws.preview.unread')}</span></span>);break;
  case 'photo-display':content=piece==='image'?button(photo.current.label,()=>a.selectPhoto(photo.index),false,image()):button(t('ws.element.fit'),()=>a.setCrop(P.rangeMax));break;
  case 'photo-brightness':case 'photo-tone':{
   const brightness=part.id==='photo-brightness',value=brightness?photo.brightness:photo.tone;
   content=piece==='thumb'?range(value,P.rangeMin,P.rangeMax,brightness?a.setBrightness:a.setTone):piece==='track'?<div className="wf-slider-track"/>:<output>{i18n.number(value)}</output>;break;
  }
  case 'photo-wallpaper':content=piece==='image'?image():button(applied?t('ws.wallpaperApplied',{name:photo.current.label}):t('ws.preview.setWallpaper'),()=>{a.applyWallpaper();setApplied(true);});break;
  case 'photo-crop':content=piece==='image'?image():<label className="wf-crop-frame">{range(photo.crop,P.cropMin,P.rangeMax,a.setCrop)}</label>;break;
  case 'photo-compare':content=button(t(piece==='before'?'ws.preview.original':'ws.preview.edited'),()=>{if(photo.compare!==(piece==='before'))a.toggleCompare();},false,image(piece==='before'));break;
  case 'photo-switch':content=button(t(piece==='previous'?'ws.preview.previousPhoto':'ws.preview.nextPhoto'),()=>a.nextPhoto(piece==='previous'?-1:1),false,<WorkshopGlyph name={piece==='previous'?'up':'down'}/>);break;
  case 'bin-list':content=piece==='date'?<div className="wf-list">{trash.entries.map(entry=><time key={entry.id}>{i18n.legacyDate(entry.date)}</time>)}</div>:<div className="wf-list"><select aria-label={t('ws.optional.binSource')} disabled={loose} value={files.selectedId??''} onChange={e=>a.selectFile(e.target.value)}>{files.visible.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{button(t('ws.optional.binMove'),()=>a.trashFile(),!files.selected)}{trash.entries.map(entry=><button key={entry.id} type="button" disabled={loose} onClick={()=>a.selectTrashFile(entry.id)}>{entry.name}</button>)}</div>;break;
  case 'bin-undo':content=piece==='item'?<span>{trash.selected?.name??t('bin.none')}</span>:button(t('bin.restore'),()=>a.restoreFile(),!trash.selected);break;
  case 'bin-empty':content=piece==='count'?<output>{t('ws.optional.binCount',{count:trash.entries.length})}</output>:button(t(trash.entries.length?'bin.empty':'ws.optional.binUndoEmpty'),()=>trash.entries.length?a.emptyTrash():a.undoEmptyTrash(),!trash.entries.length&&!trash.lastEmptiedIds.length);break;
  case 'clock-time':{
   const date=new Date(state.lastTickAt),value=piece==='hours'?date.getHours():piece==='minutes'?date.getMinutes():date.getSeconds();
   content=button(t('clock.now'),b.clockFormat,false,<time>{i18n.integer(value).padStart(2,i18n.integer(0))}</time>);break;
  }
  case 'clock-timer':content=piece==='duration'?<div className="wf-row"><select aria-label={t('ws.optional.timerDuration')} disabled={loose} value={shared.clock.duration/P.timerTickMs} onChange={e=>b.timerDuration(Number(e.target.value))}>{P.intervals.map(seconds=><option key={seconds} value={seconds}>{t('ws.optional.seconds',{count:seconds})}</option>)}</select><output>{i18n.duration(shared.clock.remaining)}</output></div>:button(t(shared.clock.running?'ws.preview.pauseTimer':'ws.preview.startTimer'),b.timerToggle);break;
  case 'clock-calendar':{
   const now=new Date(state.lastTickAt),first=new Date(now.getFullYear(),now.getMonth()+shared.clock.monthOffset,1),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
   content=piece==='month'?<div className="wf-row">{button(t('clock.previous'),()=>b.month(-1),false,<WorkshopGlyph name="up"/>)}<strong>{i18n.month(first.getTime())}</strong>{button(t('clock.next'),()=>b.month(1),false,<WorkshopGlyph name="down"/>)}</div>:<div className="wf-calendar">{Array.from({length:days},(_,index)=><button type="button" key={index} disabled={loose} onClick={()=>b.day(new Date(first.getFullYear(),first.getMonth(),index+1).getTime())}>{i18n.integer(index+1)}</button>)}</div>;break;
  }
  case 'theme-mode':content=button(t(piece==='light'?'theme.light':'theme.dark'),()=>b.theme({mode:piece as 'light'|'dark'}));break;
  case 'theme-accent':content=piece==='palette'?<select aria-label={t('theme.accent')} disabled={loose} value={shared.theme.accent} onChange={e=>b.theme({accent:e.target.value})}>{paletteFor(state.persistent.specs.color).map(color=><option key={color} value={color}>{color}</option>)}</select>:<span className="wf-accent-sample" style={{background:shared.theme.accent}}/>;break;
  case 'theme-radius':content=piece==='thumb'?range(shared.theme.radius,0,BALANCE.workshop.design.radiusMax,value=>b.theme({radius:value})):piece==='track'?<div className="wf-slider-track"/>:<span className="wf-radius-sample" style={{borderRadius:shared.theme.radius}}/>;break;
  case 'theme-slideshow':content=piece==='images'?<label className="wf-slideshow">{image()}<input type="checkbox" disabled={loose} checked={shared.theme.slideshow} onChange={e=>b.theme({slideshow:e.target.checked})}/>{t('theme.slideshow')}</label>:<span>{t('ws.optional.seconds',{count:P.slideshowMs/P.timerTickMs})}</span>;break;
  case 'theme-icons':content=piece==='thumb'?range(shared.theme.iconSize,P.iconSizes[0],P.iconSizes.at(-1)!,value=>b.theme({iconSize:value})):piece==='track'?<div className="wf-slider-track"/>:<span style={{width:shared.theme.iconSize,height:shared.theme.iconSize}}><WorkshopGlyph name="file"/></span>;break;
  case 'terminal-output':content=piece==='prompt'?button(commandName(shared.terminal.command),b.runOnce):<pre>{shared.terminal.history.at(-1)?.lines.join('\n')??t('ws.preview.terminalHint')}</pre>;break;
  case 'terminal-commands':content=<div className="wf-list">{(['list','photo','export'] as const).map(command=><button type="button" key={command} disabled={loose} aria-pressed={shared.terminal.command===command} onClick={()=>b.command(command)}>{piece==='command'?commandName(command):t(`ws.optional.commandDescription.${command}`)}</button>)}</div>;break;
  case 'terminal-interval':content=piece==='interval'?<select aria-label={t('terminal.interval')} disabled={loose} value={shared.terminal.interval} onChange={e=>b.interval(Number(e.target.value))}>{P.intervals.map(seconds=><option key={seconds} value={seconds}>{i18n.integer(seconds)}</option>)}</select>:<span>{t('ws.optional.seconds',{count:shared.terminal.interval})}</span>;break;
  case 'terminal-run':content=button(t(piece==='run'?'ws.preview.runCommand':'ws.preview.stopCommand'),()=>{if(shared.terminal.running===(piece==='stop'))b.toggleRun();});break;
  case 'terminal-history':content=<ol className="wf-list">{shared.terminal.history.length?shared.terminal.history.map((entry,index)=><li key={`${entry.at}:${index}`}>{piece==='command'?commandName(entry.command):entry.result}</li>):<li>{t('ws.optional.historyEmpty')}</li>}</ol>;break;
  case 'manager-processes':{
   const total=passivePixelsPerSecond(state),rows=producerLedger(state).map(entry=>({...entry,name:producerName(entry,state,i18n)})).sort((a,c)=>shared.manager.sortRate?c.perSecond-a.perSecond:a.name.localeCompare(c.name));
   content=<div className="wf-list wf-manager-column">{button(t(piece==='process'?'manager.name':piece==='rate'?'manager.rate':'manager.share'),b.sortProcesses)}{rows.map(row=><button type="button" key={row.id} disabled={loose} aria-pressed={shared.manager.selected===row.id} onClick={()=>b.selectProcess(row.id)}>{piece==='process'?row.name:piece==='rate'?i18n.rate(row.perSecond):t('number.percent',{value:i18n.number(total?row.perSecond/total*P.percentDivisor:0)})}</button>)}</div>;break;
  }
  case 'manager-performance':content=piece==='specs'?<select aria-label={t('manager.performance')} disabled={loose} value={shared.manager.spec} onChange={e=>b.spec(e.target.value as SpecKey)}>{SPECS.map(key=><option key={key} value={key}>{t(`spec.${key}`)}</option>)}</select>:<output>{i18n.spec(shared.manager.spec,state.persistent.specs[shared.manager.spec])}</output>;break;
  case 'plugin-tabs':content=piece==='tab'?<div className="wf-row">{(['files','history'] as const).map(tab=><button type="button" key={tab} disabled={loose} aria-pressed={shared.plugin===tab} onClick={()=>b.tab(tab)}>{t(tab==='files'?'ws.set.files':'ws.optional.productionHistory')}</button>)}</div>:<div className="wf-list">{shared.plugin==='files'?fileRows(entry=>entry.name):shared.history.map((entry,index)=><output key={index}>{i18n.pixels(entry.pixels)}</output>)}</div>;break;
  case 'plugin-table':content=<div className="wf-list"><strong>{t(piece==='time'?'ws.element.time':'ws.preview.pixels')}</strong>{shared.history.map((entry,index)=><output key={index}>{piece==='time'?i18n.time(entry.at):i18n.pixels(entry.pixels)}</output>)}</div>;break;
  case 'stream-preview':content=piece==='source'?<span>{stream.scene==='source'?photo.current.label:t('ws.stream.messages')}</span>:button(t('ws.stream.preview'),a.toggleStreamPreview,false,stream.scene==='source'?image():<span>{mail.selected?.body??t('ws.stream.noMessages')}</span>);break;
  case 'stream-sources':content=piece==='source'?<span>{photo.current.label}</span>:<select aria-label={t('ws.stream.source')} disabled={loose} value={photo.index} onChange={e=>a.selectPhoto(Number(e.target.value))}>{photo.sources.map((source,index)=><option key={source.id} value={index}>{source.label}</option>)}</select>;break;
  case 'stream-scenes':content=piece==='scene'?<div className="wf-row">{(['source','messages'] as const).map(scene=><button type="button" key={scene} disabled={loose} aria-pressed={stream.scene===scene} onClick={()=>a.setStreamScene(scene)}>{t(scene==='source'?'ws.stream.sourceScene':'ws.stream.messages')}</button>)}</div>:<output>{t(stream.scene==='source'?'ws.stream.sourceScene':'ws.stream.messages')}</output>;break;
  case 'stream-comments':content=piece==='message'?<div className="wf-list">{mail.messages.map(message=><button type="button" key={message.id} disabled={loose} aria-pressed={stream.selectedMessage===message.id} onClick={()=>a.selectStreamMessage(message.id)}><strong>{message.sender}</strong><span>{message.body}</span></button>)}</div>:<select aria-label={t('ws.stream.messages')} disabled={loose} value={stream.selectedMessage??mail.messages[0]?.id??''} onChange={e=>a.selectStreamMessage(e.target.value)}>{mail.messages.map(message=><option key={message.id} value={message.id}>{message.sender}</option>)}</select>;break;
  default:content=<span>{label}</span>;
 }
 const nativeTitle=part.id==='common-frame'&&piece==='title'&&!visual.customColors;
 const windowControl=part.id==='common-frame'&&['minimize','maximize','close'].includes(piece);
 const foreground=windowControl?fittingWindowControlPalette.color:nativeTitle?'#fff':visual.foreground,background=windowControl?fittingWindowControlPalette.backgroundColor:nativeTitle?'#000080':visual.background;
 const style={color:foreground,backgroundColor:background,borderRadius:d.radius,fontSize:d.fontSize,boxShadow:d.shadow?'1px 1px 0 #555':undefined,'--wf-piece-radius':`${d.radius}px`,'--wf-piece-foreground':foreground,'--wf-piece-background':background} as CSSProperties;
 return <div className={`wf-piece-content wf-content-${part.id} wf-element-${piece}`} data-workshop-control-piece={piece} data-piece-front={front} hidden={!front} style={style}>{content}</div>;
}
