import { useLayoutEffect,useRef,useState,type CSSProperties } from 'react';
import coast from '../assets/wallpaper/coast.webp';
import { DesktopAppearance } from '../components/AppearanceSelect';
import { ClockFace,ClockTimerContents } from '../components/ClockContents';
import { Estimate } from '../components/Estimate';
import { LanguageSelect } from '../components/LanguageSelect';
import { BulkControl,CosmeticSelection,Records,SoundSettings } from '../components/LongPlaySettings';
import { ProductSettings } from '../components/ProductSettings';
import { BALANCE,type SpecKey } from '../config/balance';
import { productLabel } from '../content/products';
import { appName,unlockedDesktopStage } from '../systems/appearance';
import { activeScreenshots } from '../systems/desktop';
import { hasDesktopSkill,hasUpgrade,jobCursorQuote,jobCursorRate,jobRate,jobUpdateCost } from '../systems/desktopJobs';
import { type AppId,type JobId,type PhotoEdit } from '../systems/desktopState';
import { passivePixelsPerSecond,producerLedger } from '../systems/economy';
import {hasAppPart} from '../systems/appBuild';
import {producerName} from './productionLabels';
import type {MessageKey} from '../content/i18n';
import { previousWorldMultiplier } from '../systems/longPlay';
import { AppPart } from './AppComposition';
import { ScreenshotPreview } from './Desktop';
import { LineIcon } from './desktop-icons';
import type { DesktopProps as Props } from './desktopTypes';
import { PhotoSurface } from './PhotoSurface';
import {UiScaleControl} from '../components/UiScaleControl';
import {PhotoAdjustment} from '../components/PhotoAdjustment';
// The second original photo is bundled, like the coast, and is never fetched at runtime.
import night from '../assets/wallpaper/night.webp';
export function Photograph({edit,wallpaper=false,...props}:Props&{edit:PhotoEdit;wallpaper?:boolean}) {
 const {snapshot,i18n}=props,s=snapshot.state;
 const shot=edit.source.startsWith('shot:')?(props.catalog??s.persistent.screenshots).find(x=>x.id===Number(edit.source.slice(5))):null;
 const style={filter:`brightness(${edit.brightness}) sepia(${Math.abs(edit.tone)/100}) hue-rotate(${edit.tone*2}deg)`,transform:`scale(${1/(1-edit.crop/50)})`} as CSSProperties;
 return <div className={`photograph ${wallpaper?'wallpaper-photo':''}`} ><PhotoSurface specs={s.persistent.specs}><div className="photo-transform" style={style}>
 {shot?<ScreenshotPreview {...props} shot={shot} catalog={props.catalog??s.persistent.screenshots}/>:<img src={edit.source==='night'?night:coast} alt={wallpaper?'':i18n.t(edit.source==='night'?'photo.night':'photo.coast')} draggable={false}/>}
 </div></PhotoSurface></div>;
}
function JobActivity({app,...props}:Props&{app:JobId}) {
 const s=props.snapshot.state,phase=props.preview||props.runtime.platform.animation.reducedMotion()?0.5:(s.elapsedMs%BALANCE.w3.jobAnimationMs)/BALANCE.w3.jobAnimationMs;
 return <svg className="job-activity" data-job-preview={app} viewBox="0 0 64 24" aria-hidden="true">
 {app==='tessera'?<g><rect x="4" y="4" width="54" height="17" fill="#e3e5dc" stroke="#7d8a83"/><rect x="8" y="8" width={Math.max(4,46*phase)} height="3" fill="#7a947a"/><path d="M8 15h30m-30 3h42" stroke="#9ca79b"/></g>:app==='files'?Array.from({length:3},(_,i)=><g key={i} transform={`translate(0,${((i+Math.floor(phase*3))%3)*7+2})`}><rect x="2" y="0" width="58" height="6" fill={i===0?'#cce4f7':'#e7e7e7'}/><path d={`M7 3h${16+i*8}`} stroke="#72818b" strokeWidth="1"/></g>):app==='photo'?Array.from({length:3},(_,i)=><g key={i}><path d={`M4 ${5+i*7}h54`} stroke="#aaa"/><circle cx={12+(Math.sin(phase*Math.PI*2+i)+1)*18} cy={5+i*7} r="2.5" fill="#537e9a"/></g>):Array.from({length:4},(_,i)=><path key={i} d={`M4 ${3+i*6}h${12+((i+Math.floor(phase*4))%4)*12}`} stroke="#608d78" strokeWidth="2"/>)}
 </svg>;
}
export function JobControls({app,...props}:Props&{app:JobId}){
 const {snapshot,runtime,i18n,preview}=props,s=snapshot.state,j=s.run.desktop.jobs[app];
 if(!hasUpgrade(s,'jobs')||!j.assigned)return null;
 const quantity=jobCursorQuote(s,app).count,cost=jobCursorQuote(s,app).cost,updateCost=jobUpdateCost(s,app),rate=passivePixelsPerSecond(s);
 return <div className="job-controls" role="dialog" aria-label={i18n.t('jobs.menu',{app:appName(s,app,i18n)})}>
  <div className="job-metrics"><b>{i18n.t('jobs.count',{count:j.cursors})}</b><span>{i18n.t('jobs.rate',{rate:i18n.rate(jobRate(s,app))})}</span></div>
  <small>{i18n.t('record.previous',{factor:i18n.number(previousWorldMultiplier(s))})}</small><BulkControl state={s} runtime={runtime} i18n={i18n}/><span className="bulk-count">{quantity!==1?i18n.t('bulk.count',{count:quantity}):''}</span>
  <div className="job-purchase"><button className="win-button" disabled={quantity===0||s.resources.pixels<cost} onClick={()=>runtime.actDesktop({type:'job-buy',app})}>{i18n.t('jobs.buy',{cost:i18n.price(cost)})}</button><span>{i18n.t('jobs.effect',{rate:i18n.rate(jobCursorRate(s,app)*quantity)})}</span><Estimate cost={cost} pixels={s.resources.pixels} rate={rate} i18n={i18n} runtime={runtime} preview={preview}/></div>
  <div className="job-purchase"><button className="win-button" disabled={s.resources.pixels<updateCost||j.cursors===0} title={i18n.t('jobs.update',{version:`1.${j.updates}`,next:`1.${j.updates+1}`})} onClick={()=>runtime.actDesktop({type:'job-update',app})}>{i18n.t('jobs.updateCost',{cost:i18n.price(updateCost)})}</button><span>{i18n.t('jobs.double',{factor:BALANCE.w3.updateMultiplier})}</span><Estimate cost={updateCost} pixels={s.resources.pixels} rate={rate} i18n={i18n} runtime={runtime} preview={preview}/></div>
  <button className="win-button job-remove" onClick={()=>runtime.actDesktop({type:'job-assign',app})}>{i18n.t('jobs.remove')}</button>
 </div>;
}
export function WorkingCursors({app,...props}:Props&{app:JobId}){
 const {snapshot,i18n,preview,runtime}=props,s=snapshot.state,j=s.run.desktop.jobs[app];
 const root=useRef<HTMLDivElement>(null),[area,setArea]=useState<CSSProperties>({});
 const layout=app==='tessera'?null:s.run.desktop.projects[app]?.installed;
 useLayoutEffect(()=>{const node=root.current,host=node?.closest<HTMLElement>('.desktop-window');if(!node||!host||!layout)return;
  const place=()=>{const target=host.querySelector<HTMLElement>(`[data-app-part="${app==='files'?'list':app==='photo'?'image':'output'}"]`);if(!target){setArea({visibility:'hidden'});return;}const a=host.getBoundingClientRect(),b=target.getBoundingClientRect(),scale=a.width/host.offsetWidth;const next={left:(b.left-a.left)/scale-host.clientLeft,top:(b.top-a.top)/scale-host.clientTop,width:b.width/scale,height:Math.min(72,b.height/scale),right:'auto',bottom:'auto'};setArea(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);};place();const observer=new ResizeObserver(place);observer.observe(host);const target=host.querySelector<HTMLElement>('.app-layout');if(target)observer.observe(target);const changes=new MutationObserver(place);if(target)changes.observe(target,{subtree:true,attributes:true,attributeFilter:['style']});return()=>{observer.disconnect();changes.disconnect();};
 },[layout,j.assigned,j.cursors,s.run.desktop.windows[app].width,s.run.desktop.windows[app].height,props.i18n.language]);
 if(!j.assigned||!j.cursors)return null;
 return <div ref={root} style={layout?area:undefined} data-layout-job={layout?app:undefined} className={`working-cursors job-motion-${app} ${preview||runtime.platform.animation.reducedMotion()?'no-motion':''}`} aria-label={i18n.t('jobs.count',{count:j.cursors})}>
 <JobActivity {...props} app={app}/>{Array.from({length:Math.min(j.cursors,BALANCE.w3.maxVisibleJobCursors)},(_,i)=><svg key={i} viewBox="0 0 16 20" width={16} height={20} aria-hidden="true" style={{left:`${14+i*15}%`,animationDelay:`${-i*.37}s`}}><path d="M1 1v14l4-3 3 6 3-2-3-5h6z" fill="#fff" stroke="#283744"/></svg>)}<span>{i18n.t('jobs.count',{count:j.cursors})}</span></div>;
}
export function PhotoApp(props:Props){
 const {snapshot,runtime,i18n}=props,s=snapshot.state,d=s.run.desktop,edit=d.photo;
 const change=(patch:Partial<PhotoEdit>)=>runtime.actDesktop({type:'photo',edit:patch});
 return <div className="photo-app"><div className="app-toolbar"><AppPart id="source"><label>{i18n.t('photo.source')}<select aria-label={i18n.t('photo.source')} value={edit.source} onChange={e=>change({source:e.target.value})}>
 {(['coast','night'] as const).map(id=><option value={id} key={id}>{i18n.t(`photo.${id}`)}</option>)}{activeScreenshots(s).map(shot=><option key={shot.id} value={`shot:${shot.id}`}>{i18n.t('files.shot',{count:shot.id})}</option>)}</select></label></AppPart>
 {hasUpgrade(s,'compare')&&<AppPart id="compare"><button className="win-button" aria-pressed={d.compare} onClick={()=>runtime.actDesktop({type:'compare'})}>{i18n.t('photo.compare')}</button></AppPart>}
 <AppPart id="wallpaper"><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'wallpaper'})}>{i18n.t('photo.wallpaper')}</button></AppPart></div>
 <AppPart id="image"><div className="photo-workbench">{d.compare&&hasUpgrade(s,'compare')&&<figure><figcaption>{i18n.t('photo.before')}</figcaption><Photograph {...props} edit={{...edit,brightness:1,tone:0,crop:0}}/></figure>}<figure><figcaption>{i18n.t('photo.after')}</figcaption><Photograph {...props} edit={edit}/></figure></div></AppPart>
 <div className="photo-adjustments"><AppPart id="brightness"><PhotoAdjustment label={i18n.t('photo.brightness')} min={.5} max={1.5} step={.05} value={edit.brightness} onChange={brightness=>change({brightness})}>{i18n.number(edit.brightness)}</PhotoAdjustment></AppPart>
 <AppPart id="tone"><PhotoAdjustment label={i18n.t('photo.tone')} min={-50} max={50} value={edit.tone} onChange={tone=>change({tone})}>{i18n.integer(edit.tone)}</PhotoAdjustment></AppPart>
 {hasUpgrade(s,'crop')&&<AppPart id="crop"><PhotoAdjustment label={i18n.t('photo.crop')} min={0} max={40} value={edit.crop} onChange={crop=>change({crop})} title={i18n.t('photo.cropValue',{count:edit.crop})}>{i18n.t('number.percent',{value:i18n.integer(edit.crop)})}</PhotoAdjustment></AppPart>}</div></div>;
}
export function BinApp({snapshot,runtime,i18n}:Props){
 const s=snapshot.state,d=s.run.desktop;
 const name=(id:string)=>id.startsWith('shot:')?i18n.t('bin.itemShot',{count:Number(id.slice(5))}):i18n.t('bin.archivedItem');
 return <div className="bin-app"><div className="app-toolbar"><AppPart id="empty"><button className="win-button" disabled={!d.trash.length} onClick={()=>runtime.actDesktop({type:'empty-trash'})}>{i18n.t('bin.empty')}</button></AppPart></div>
 <AppPart id="trash"><table className="native-table"><thead><tr><th>{i18n.t('files.name')}</th><th>{i18n.t('bin.deleted')}</th><th>{i18n.t('files.size')}</th></tr></thead><tbody>{d.trash.map(t=><tr key={t.id}><td>{name(t.id)}</td><td>{i18n.dateTime(t.at)}</td><td>{i18n.t('bin.reward',{pixels:i18n.pixels(t.reward)})}{hasUpgrade(s,'undo')&&<button className="win-button" title={i18n.t('bin.repay',{pixels:i18n.pixels(t.reward)})} disabled={s.resources.pixels<t.reward} onClick={()=>runtime.actDesktop({type:'undo-trash',id:t.id})}>{i18n.t('bin.restore')}</button>}</td></tr>)}</tbody></table>{!d.trash.length&&<p className="app-empty">{i18n.t('bin.none')}</p>}</AppPart>{hasUpgrade(s,'undo')&&s.run.desktop.projects.bin&&<AppPart id="undo"><button className="win-button" disabled={!d.trash.length||s.resources.pixels<(d.trash[0]?.reward??0)} onClick={()=>d.trash[0]&&runtime.actDesktop({type:'undo-trash',id:d.trash[0].id})}>{i18n.t('bin.restore')}</button></AppPart>}</div>;
}
export function ClockApp(props:Props){
 const {snapshot,runtime,i18n,capture}=props,s=snapshot.state,d=s.run.desktop,now=capture&&capture.version!==1?capture.display.wallTime:runtime.platform.clock.wallNow();
 const [at,setAt]=useState('');const current=new Date(d.calendarMonth??now),month=new Date(current.getFullYear(),current.getMonth(),1);const setMonth=(date:Date)=>runtime.actDesktop({type:'calendar-month',at:date.getTime()});
 const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const match=/^(\d{1,2}):(\d{2})$/.exec(at);
 let scheduledAt:number|null=null;
 if(match&&Number(match[1])<24&&Number(match[2])<60){const date=new Date(now);date.setHours(Number(match[1]),Number(match[2]),0,0);if(date.getTime()<=now)date.setDate(date.getDate()+1);scheduledAt=date.getTime();}
 const events=[...Object.entries(d.builtAt).map(([id,at])=>({at,name:id==='desktop'?i18n.t('clock.created'):i18n.t('clock.built',{app:i18n.t(`desktop.app.${id as 'files'}`)})})),...s.persistent.products.map(p=>({at:p.releasedAt,name:i18n.t('clock.release',{product:productLabel(i18n,p.name,p.version)})}))];
 return <div className="clock-app"><AppPart id="time"><ClockFace i18n={i18n} now={now}/></AppPart>
 {hasUpgrade(s,'timer')&&<AppPart id="timer"><ClockTimerContents i18n={i18n} at={at} onAt={setAt} disabled={scheduledAt===null} onReserve={()=>scheduledAt!==null&&runtime.actDesktop({type:'reserve',at:scheduledAt})}>
 {d.reservation&&<p>{d.reservation.done?i18n.t(d.reservation.result==='expired'?'clock.expired':d.reservation.result==='skipped'?'clock.skipped':'clock.done'):i18n.t('clock.scheduled',{time:i18n.dateTime(d.reservation.at)})}<button className="win-button" onClick={()=>runtime.actDesktop({type:'cancel-reservation'})}>{i18n.t('clock.cancel')}</button></p>}</ClockTimerContents></AppPart>}
 {hasUpgrade(s,'calendar')&&<AppPart id="calendar"><section className="clock-calendar"><header><button className="win-button" aria-label={i18n.t('clock.previous')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><LineIcon kind="back"/></button><h2>{i18n.month(month.getTime())}</h2><button className="win-button" aria-label={i18n.t('clock.next')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><LineIcon kind="forward"/></button></header><div className="calendar-days">{Array.from({length:7},(_,i)=><b key={`weekday${i}`} className="calendar-weekday">{i18n.t(`clock.weekday.${i as 0}`)}</b>)}{Array.from({length:month.getDay()},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=new Date(month.getFullYear(),month.getMonth(),i+1),dayEvents=events.filter(e=>new Date(e.at).toDateString()===date.toDateString());return <span key={i} className={dayEvents.length?'has-events':''} title={dayEvents.map(e=>e.name).join('\n')||i18n.t('clock.noEvents')}>{i18n.integer(i+1)}</span>;})}</div>{events.filter(e=>new Date(e.at).getMonth()===month.getMonth()&&new Date(e.at).getFullYear()===month.getFullYear()).map((e,i)=><p key={i}>{i18n.date(e.at)}　{e.name}</p>)}</section></AppPart>}</div>;
}
export function ThemeApp({snapshot,runtime,i18n}:Props){
 const s=snapshot.state,p=s.persistent.desktopPrefs;
 return <div className="theme-app"><AppPart id="appearance"><CosmeticSelection state={s} runtime={runtime} i18n={i18n}/><h1>{i18n.t('desktop.app.theme')}</h1><label>{i18n.t('theme.mode')}<select aria-label={i18n.t('theme.mode')} value={p.mode} onChange={e=>runtime.actDesktop({type:'theme',mode:e.target.value as 'light'|'dark'})}><option value="light">{i18n.t('theme.light')}</option><option value="dark">{i18n.t('theme.dark')}</option></select></label></AppPart>
 <AppPart id="accent"><label>{i18n.t('theme.accent')}<input aria-label={i18n.t('theme.accent')} type="color" value={p.accent} onChange={e=>runtime.actDesktop({type:'theme',accent:e.target.value})}/></label></AppPart>
 <AppPart id="radius"><label>{i18n.t('theme.nativeRadius')}<input type="checkbox" checked={!p.radiusCustom} onChange={e=>runtime.actDesktop({type:'theme',autoRadius:e.target.checked})}/></label><label>{i18n.t('theme.radius')}<input disabled={!p.radiusCustom} aria-label={i18n.t('theme.radius')} type="range" min="0" max="8" value={p.radius} onChange={e=>runtime.actDesktop({type:'theme',radius:Number(e.target.value)})}/><output>{i18n.integer(p.radius)}</output></label></AppPart>
 {hasUpgrade(s,'slideshow')&&<AppPart id="slideshow"><label>{i18n.t('theme.slideshow')}<input aria-label={i18n.t('theme.slideshow')} type="checkbox" checked={p.slideshow} onChange={e=>runtime.actDesktop({type:'theme',slideshow:e.target.checked})}/><small>{i18n.t('theme.slideshowInterval')}</small></label></AppPart>}
 {hasUpgrade(s,'iconSize')&&<AppPart id="iconSize"><label>{i18n.t('theme.iconSize')}<select aria-label={i18n.t('theme.iconSize')} value={p.iconSize} onChange={e=>runtime.actDesktop({type:'theme',iconSize:Number(e.target.value)})}>{BALANCE.workshop.preview.iconSizes.map((size,i)=><option key={size} value={size}>{i18n.t((['theme.small','theme.medium','theme.large'] as const)[i]!)}</option>)}</select></label></AppPart>}</div>;
}
export function TerminalApp({snapshot,runtime,i18n}:Props){
 const s=snapshot.state,t=s.run.desktop.terminal;
 return <div className="terminal-app"><AppPart id="commands"><label>{i18n.t('terminal.command')}<select aria-label={i18n.t('terminal.command')} value={s.run.play.terminalCommand} onChange={e=>runtime.common({type:'terminal-command',command:e.target.value as 'capture'})}>{(['capture','export',...(s.persistent.progress.records['secret-clock']!==undefined?['refresh']:[])] as const).map(command=><option value={command} key={command}>{i18n.t(command==='capture'?'terminal.capture':command==='export'?'terminal.export':'terminal.refresh')}</option>)}</select></label></AppPart>
 <AppPart id="interval"><label>{i18n.t('terminal.interval')}<select aria-label={i18n.t('terminal.interval')} value={t.interval} onChange={e=>runtime.actDesktop({type:'terminal',interval:Number(e.target.value),running:t.running})}>{BALANCE.w3.terminalIntervals.map((n,i)=><option key={n} value={n}>{i18n.t(i===0?'terminal.minute':'terminal.hour')}</option>)}</select></label></AppPart>
 <AppPart id="run"><div className="app-toolbar"><button className="win-button" onClick={()=>runtime.actDesktop({type:'terminal',interval:t.interval,running:!t.running})}>{i18n.t(t.running?'terminal.stop':'terminal.start')}</button><button className="win-button terminal-run" onClick={()=>s.run.play.terminalCommand==='export'?runtime.terminalExport():s.run.play.terminalCommand==='refresh'?runtime.refreshWindows():runtime.takeScreenshot()}>{i18n.t('terminal.run')}</button></div></AppPart>
 <AppPart id="output"><div className="terminal-output">{s.run.desktop.jobs.terminal.assigned&&s.run.desktop.jobs.terminal.cursors>0&&<div className="terminal-job-stream" aria-live="off">{Array.from({length:BALANCE.w3.maxVisibleJobCursors},(_,i)=><p key={i}>{i18n.t('jobs.processing',{rate:i18n.rate(jobRate(s,'terminal'))})}</p>)}</div>}<p>{i18n.t(t.running?'terminal.executing':'terminal.paused',{count:t.executions})}</p>{!t.log.length&&<p>{i18n.t('terminal.idle')}</p>}</div></AppPart>
 <AppPart id="history"><div className="terminal-output">{!t.log.length&&<p>{i18n.t('terminal.idle')}</p>}{t.log.map((l,i)=><p key={i}>{i18n.t(l.ok?'terminal.log.success':'terminal.log.skipped',{time:i18n.time(l.at)})}</p>)}</div></AppPart></div>;
}
export function SettingsApp(props:Props){
 const {snapshot,runtime,i18n}=props,s=snapshot.state,d=s.run.desktop,p=s.persistent.desktopPrefs;
 return <div className="settings-app"><aside>{(['skills','general','records','sound','data','specs'] as const).map(page=><button className={page===d.settingsPage?'selected':''} key={page} onClick={()=>runtime.actDesktop({type:'settings-page',page})}>{i18n.t(`settings.${page}`)}</button>)}</aside><article><h1>{i18n.t(`settings.${d.settingsPage}`)}</h1>
 {d.settingsPage==='skills'&&<><p>{i18n.t('desktop.tokens',{count:s.resources.tokens})}</p>{([1,2] as const).filter(band=>band===1||s.run.version!=='v0.1').map(band=><fieldset key={band}><legend>{i18n.t(band===1?'settings.band1':'settings.band2')}</legend>{BALANCE.w3.skills.filter(skill=>skill.band===band&&(skill.id!=='major2'||unlockedDesktopStage(s)>=1)&&(skill.id!=='major3'||unlockedDesktopStage(s)>=2)).map(skill=><div className="desktop-skill" key={skill.id}><div><b>{i18n.t(`desktop.skill.${skill.id}`)}</b><p>{i18n.t(`desktop.skill.${skill.id}.description`)}</p>{skill.id==='major3'&&!d.apps.includes('terminal')&&<p className="appearance-requirement">{i18n.t('desktop.skill.major3.requirement')}</p>}</div><span>{i18n.t('k.skillCost',{count:skill.cost})}</span>{p.skills.includes(skill.id)?skill.playful?<input aria-label={i18n.t(`desktop.skill.${skill.id}`)} type="checkbox" checked={hasDesktopSkill(s,skill.id)} onChange={()=>runtime.actDesktop({type:'toggle-skill',id:skill.id})}/>:<span>{i18n.t('k.acquired')}</span>:<button className="win-button" disabled={s.resources.tokens<skill.cost||skill.id==='major3'&&!d.apps.includes('terminal')} onClick={()=>runtime.actDesktop({type:'skill',id:skill.id})}>{i18n.t('k.acquire')}</button>}</div>)}</fieldset>)}</>}
 {d.settingsPage==='general'&&<><UiScaleControl runtime={runtime} i18n={i18n}/><DesktopAppearance state={s} runtime={runtime} i18n={i18n}/><ProductSettings state={s} runtime={runtime} i18n={i18n}/><p><label className="author-name-setting">{i18n.t('settings.playerName')}<input value={s.persistent.playerName??''} maxLength={BALANCE.w2.maxName} onChange={e=>runtime.setPlayerName(e.target.value)}/></label></p><p><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} includeTest={runtime.platform.launch.debug}/></p></>}
 {d.settingsPage==='records'&&<Records state={s} i18n={i18n}/>}
 {d.settingsPage==='sound'&&<SoundSettings state={s} runtime={runtime} i18n={i18n}/>}
 {d.settingsPage==='data'&&<div className="data-buttons"><button className="win-button" onClick={runtime.downloadData}>{i18n.t('data.export')}</button><button className="win-button" onClick={()=>void runtime.requestImport()}>{i18n.t('data.import')}</button><button className="win-button" onClick={()=>runtime.requestReset()}>{i18n.t('data.reset')}</button></div>}
 {d.settingsPage==='specs'&&<><p>{i18n.t('settings.specReadOnly')}</p><table className="native-table"><tbody>{(Object.keys(BALANCE.spec) as SpecKey[]).map(key=><tr key={key}><th>{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,s.persistent.specs[key])}</td></tr>)}</tbody></table></>}
 </article></div>;
}
export function ManagerApp(props:Props){
 const {snapshot,i18n,capture}=props,s=snapshot.state,d=s.run.desktop;
 const rows=producerLedger(s),total=rows.reduce((sum,row)=>sum+row.perSecond,0),selected=rows.find(row=>row.id===d.managerProcess)??rows[0];
 const availablePerformance=hasAppPart(s,'manager','performance'),availableProcesses=hasAppPart(s,'manager','processes'),tab=availablePerformance&&(!availableProcesses||d.managerTab==='performance')?'performance':'processes';
 const now=capture&&capture.version!==1?capture.display.wallTime:props.runtime.platform.clock.wallNow(),recentShots=d.shotHistory.filter(h=>h.at>=now-BALANCE.w3.historyMs).length;
 const sourceName=(id:string)=>i18n.t((id.startsWith('seed:')?`item.${id.slice('seed:'.length)}`:`ws.part.${id}`) as MessageKey);
 const sourceRate=(id:string)=>id.startsWith('seed:')?BALANCE.w1.items.find(item=>`seed:${item.id}`===id)?.perSecond??0:BALANCE.workshop.partRates[id as keyof typeof BALANCE.workshop.partRates]??0;
 return <div className="manager-app" data-producer-total={total}><AppPart id="tabs"><nav>{(['processes','performance'] as const).filter(id=>id==='processes'?availableProcesses:availablePerformance).map(id=><button className={tab===id?'selected':''} key={id} onClick={()=>props.runtime.actDesktop({type:'manager-tab',tab:id})}>{i18n.t(`manager.${id}`)}</button>)}</nav></AppPart>
 {tab==='processes'?<AppPart id="processes"><article><table className="native-table"><thead><tr><th>{i18n.t('manager.name')}</th><th>{i18n.t('manager.rate')}</th><th>{i18n.t('manager.share')}</th></tr></thead><tbody>{rows.map(row=><tr data-producer-id={row.id} data-producer-rate={row.perSecond} data-producer-base={row.baseRate} data-producer-sources={row.sourceIds.join(' ')} className={selected===row?'selected':''} key={row.id}><td><button onClick={()=>props.runtime.actDesktop({type:'manager-process',process:row.id})}>{producerName(row,s,i18n)}</button></td><td>{i18n.rate(row.perSecond)}</td><td>{i18n.t('number.percent',{value:i18n.number(total?row.perSecond/total*BALANCE.workshop.preview.percentDivisor:0)})}</td></tr>)}</tbody><tfoot><tr><th>{i18n.t('manager.total')}</th><td data-producer-total-value={total}>{i18n.rate(total)}</td><td/></tr></tfoot></table>
 {selected&&<section className="manager-details"><h2>{producerName(selected,s,i18n)}</h2><p>{i18n.t('manager.baseRate',{rate:i18n.rate(selected.baseRate),count:i18n.integer(selected.count)})}</p><h3>{i18n.t('manager.details')}</h3>{Object.entries(selected.multipliers).map(([name,factor])=><p key={name} data-producer-factor={name}>{i18n.t(`manager.factor.${name}` as MessageKey,{factor:i18n.number(factor)})}</p>)}{selected.kind!=='cursor'&&<><h3>{i18n.t('manager.sourceParts')}</h3><ul>{selected.sourceIds.map(id=><li key={id}>{sourceName(id)} <span>{i18n.rate(sourceRate(id))}</span></li>)}</ul></>}</section>}
 <p className="manager-record-only">{i18n.t('manager.shotRecords',{count:i18n.integer(recentShots)})}</p></article></AppPart>:<AppPart id="performance"><article><h1>{i18n.t('manager.performance')}</h1><table className="native-table"><tbody>{(Object.keys(BALANCE.spec) as SpecKey[]).map(key=><tr key={key}><th>{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,s.persistent.specs[key])}</td></tr>)}</tbody></table></article></AppPart>}
 </div>;
}
export function ExtraApp({app,...props}:Props&{app:AppId}){
 switch(app){case 'photo':return <PhotoApp {...props}/>;case 'bin':return <BinApp {...props}/>;case 'clock':return <ClockApp {...props}/>;case 'theme':return <ThemeApp {...props}/>;case 'terminal':return <TerminalApp {...props}/>;case 'settings':return <SettingsApp {...props}/>;case 'manager':return <ManagerApp {...props}/>;default:return null;}
}
