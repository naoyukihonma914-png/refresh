import { workHeight,taskbarHeight,LEGACY_DESKTOP } from '../systems/desktopGeometry';
import { appName,desktopStage,editorName } from '../systems/appearance';
import { PhotoSurface } from './PhotoSurface';
import { ExtraApp, JobControls, WorkingCursors, Photograph } from './DesktopApps';
import type { DesktopProps as Props } from './desktopTypes';
import { JOB_IDS, type JobId } from '../systems/desktopState';
import { FEATURE_APPS, hasDesktopSkill, hasUpgrade, jobCapacity } from '../systems/desktopJobs';
import { activeScreenshots, followingDesktopApp, screenshotCooldown } from '../systems/desktop';
import type { DesktopUpgrade } from '../config/balance';
import { frozenFiles, readCapture } from '../systems/captureScene';
import { Estimate } from '../components/Estimate';
import { productLabel } from '../content/products';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BALANCE } from '../config/balance';
import { createI18n, type I18n } from '../content/i18n';
import { paletteFor } from '../content/kumikiArt';
import coast from '../assets/wallpaper/coast.webp';
import { desktopAppShotGain, desktopConditions, installedApps, nextDesktopApp, restoreScreenshot, screenshotCapacity, screenshotParts, screenshotReward } from '../systems/desktop';
import { defaultNote, desktopFiles, screenshotBytes, fileSize, type DesktopFile } from '../systems/desktopFiles';
import type { AppId, Feedback, Screenshot } from '../systems/desktopState';
import { passivePixelsPerSecond } from '../systems/economy';
import { AppIcon, ProductGlyph, LineIcon, PixelArt, CursorGlyph } from './desktop-icons';
import { Kumiki } from './Kumiki';
import { HomeDocument } from './kumiki/HomeDocument';
import { LanguageSelect } from '../components/LanguageSelect';

const noop = () => {};
function feedbackName(f: Feedback, i18n: I18n): string { return ['redraw','practice'].includes(f.kind) ? i18n.t(`k.icon.${f.target as 'folder'}`) : f.kind==='search'?i18n.t('files.home'):''; }
function feedbackSubject(f: Feedback, i18n: I18n) { return i18n.t(`feedback.subject.${f.kind}`,{name:feedbackName(f,i18n),time:i18n.time(Number(f.target)||0)}); }
function FeedbackBody({ feedback: f, i18n }: { feedback: Feedback; i18n: I18n }) {
  return <p className="feedback-body">{i18n.t(`feedback.body.${f.kind}`,{name:feedbackName(f,i18n),count:BALANCE.w3.redrawCells,time:i18n.time(Number(f.target)||0)})}</p>;
}
function fixLabel(f:Feedback){return f.kind==='screenshot'?'desktop.fix.screenshot':f.kind==='sort'||f.kind==='search'?'desktop.fix.files':f.kind==='bright'?'desktop.fix.photo':f.kind==='trash'?'desktop.fix.bin':f.kind==='timer'?'desktop.fix.clock':f.kind==='dark'?'desktop.fix.theme':'desktop.fix.tessera';}
function DesktopWindow({ app, children,jobMenu,onJobMenu, ...props }: Props & {app: AppId; children: ReactNode;jobMenu:JobId|null;onJobMenu:(app:JobId|null)=>void}) {
  const { runtime, snapshot, i18n, preview } = props;
  const d = snapshot.state.run.desktop, w = d.windows[app];
  const active = d.active === app;
  const jobApp=JOB_IDS.includes(app as JobId)?app as JobId:null,canAssign=hasUpgrade(snapshot.state,'jobs')&&jobApp!==null;
  const assigned=jobApp!==null&&d.jobs[jobApp].assigned;
  const [dropTarget,setDropTarget]=useState(false);const jobButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(jobMenu===app&&(!assigned||!active||w.minimized||!w.open))onJobMenu(null);},[assigned,active,w.minimized,w.open,jobMenu,app,onJobMenu]);
  const drag = useRef<{ x:number; y:number; scale:number; kind:'move'|'resize'; rect:typeof w } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(jobMenu!==app)return;const menu=host.current?.querySelector<HTMLElement>('.job-controls'),anchor=jobButton.current?.parentElement;if(menu&&anchor){menu.style.left=`${Math.min(0,w.width-anchor.offsetLeft-328)}px`;menu.style.maxHeight=`${w.height-44}px`;}},[jobMenu,app,w.width,w.height]);
  const end = () => { if (drag.current) {
    if(drag.current.kind==='move'&&hasDesktopSkill(snapshot.state,'snap')){const node=host.current!,left=parseFloat(node.style.left);if(left<=8||left+parseFloat(node.style.width)>=d.screen.width-8)runtime.actDesktop({type:'rect',app,rect:{x:left<=8?0:d.screen.width/2,y:0,width:d.screen.width/2,height:workHeight(d.screen)}});}
    drag.current = null; runtime.persist(); } };
  const start = (event: React.PointerEvent<HTMLElement>, kind:'move'|'resize') => {
    if (preview || event.button !== 0 || w.maximized || kind === 'move' && (event.target as HTMLElement).closest('button,.job-controls')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {x:event.clientX,y:event.clientY,scale:host.current!.getBoundingClientRect().width / host.current!.offsetWidth,kind,rect:{...w}};
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const p = drag.current; if (!p) return;
    const dx=(event.clientX-p.x)/p.scale, dy=(event.clientY-p.y)/p.scale;
    runtime.actDesktop({type:'rect',app,rect:{...p.rect,...(p.kind==='move'?{x:p.rect.x+dx,y:p.rect.y+dy}:{width:p.rect.width+dx,height:p.rect.height+dy})}});
  };
  return <section ref={host} className={`desktop-window ${active?'is-active':''} ${w.maximized?'is-maximized':''} app-${app}`} data-app={app}
    style={{left:w.x,top:w.y,width:w.width,height:w.height,zIndex:w.z+10,display:w.minimized?'none':undefined}}
    onPointerDownCapture={() => { if (!preview && !active) runtime.actDesktop({type:'open',app}); }} aria-label={appName(snapshot.state,app,i18n)}>
    <header data-job-target={canAssign?app:undefined} className={`window-title ${dropTarget?'job-drop-target':''}`} onDragOver={event=>{if(canAssign&&event.dataTransfer.types.includes('text/refresh-job')){event.preventDefault();setDropTarget(true);}}} onDragLeave={()=>setDropTarget(false)} onDrop={event=>{setDropTarget(false);if(canAssign&&event.dataTransfer.getData('text/refresh-job')==='cursor'){event.preventDefault();if(!assigned)runtime.actDesktop({type:'job-assign',app:jobApp!});}}} onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onDoubleClick={event=>{ if (!(event.target as HTMLElement).closest('button,.job-controls') && !preview) runtime.actDesktop({type:'maximize',app}); }}>
      <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette}/><span>{appName(snapshot.state,app,i18n)}{JOB_IDS.includes(app as JobId)&&hasUpgrade(snapshot.state,'jobs')?` 1.${d.jobs[app as JobId].updates}`:''}{d.stalled===app?i18n.t('desktop.stalled'):''}</span>
      {canAssign&&assigned&&<div className="job-control-anchor" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onJobMenu(null);jobButton.current?.focus();}}}>
        <button ref={jobButton} className="job-slot assigned" aria-label={i18n.t('jobs.slot',{app:appName(snapshot.state,app,i18n)})} aria-expanded={jobMenu===app} aria-haspopup="dialog" onClick={()=>onJobMenu(jobMenu===app?null:jobApp)}><CursorGlyph/></button>
        {jobMenu===app&&<JobControls {...props} app={jobApp!}/>}
      </div>}
      {hasDesktopSkill(snapshot.state,'virtual')&&<button className="workspace-move" aria-label={i18n.t('desktop.moveWorkspace')} title={i18n.t('desktop.moveWorkspace')} onClick={()=>runtime.actDesktop({type:'move-workspace',app})}><LineIcon kind="workspace"/></button>}
      {d.stalled===app&&<button className="win-button restart-button" title={i18n.t('desktop.restartReward',{count:BALANCE.w3.restartSeconds})} onClick={()=>runtime.actDesktop({type:'restart',app})}>{i18n.t('desktop.restart')}</button>}
      <div className="window-controls">{(['minimize',w.maximized?'restore':'maximize','close'] as const).map(kind=><button key={kind} className={kind==='close'?'window-close':''} aria-label={i18n.t(`desktop.${kind}`)} onClick={()=>runtime.actDesktop({type:kind==='restore'?'maximize':kind,app})}><LineIcon kind={kind}/></button>)}</div>
    </header>
    <div className={`window-content ${d.stalled===app?'is-stalled':''}`} inert={d.stalled===app||preview}>{children}</div>
    {hasUpgrade(snapshot.state,'jobs')&&JOB_IDS.includes(app as JobId)&&<WorkingCursors {...props} app={app as JobId}/>}
    {!w.maximized && <button className="window-resize" aria-label={i18n.t('desktop.resize')} onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onKeyDown={e=>{ if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();runtime.actDesktop({type:'rect',app,rect:{...w,width:w.width+(e.key==='ArrowRight'?16:e.key==='ArrowLeft'?-16:0),height:w.height+(e.key==='ArrowDown'?16:e.key==='ArrowUp'?-16:0)}});runtime.persist();} }}><LineIcon kind="resize"/></button>}
  </section>;
}
function DesktopShortcut({app,frame,...props}: Props & {app:AppId;frame:number}) {
  const {snapshot,runtime,i18n,preview} = props, p=snapshot.state.run.desktop.icons[app];
  const drag=useRef<{x:number;y:number;scale:number;px:number;py:number; moved:boolean}|null>(null);
  const finish=()=>{if(drag.current){drag.current=null;runtime.persist();}};
  return <button className="desktop-shortcut" data-shortcut={app} style={{left:p.x,top:p.y,'--desktop-icon-size':`${hasUpgrade(snapshot.state,'iconSize')?snapshot.state.persistent.desktopPrefs.iconSize:desktopStage(snapshot.state)===2?40:32}px`} as React.CSSProperties} onDragOver={e=>{if(app==='bin')e.preventDefault();}} onDrop={e=>{if(app==='bin'){e.preventDefault();runtime.actDesktop({type:'trash',id:e.dataTransfer.getData('text/refresh-file')});}}} onDoubleClick={()=>!preview&&runtime.actDesktop({type:'open',app})}
    onKeyDown={e=>{if(e.key==='Enter')runtime.actDesktop({type:'open',app});}}
    onPointerDown={e=>{if(preview||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,scale:e.currentTarget.getBoundingClientRect().width/78,px:p.x,py:p.y,moved:false};}}
    onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.x)/d.scale,dy=(e.clientY-d.y)/d.scale;if(Math.hypot(dx,dy)<4&&!d.moved)return;d.moved=true;runtime.actDesktop({type:'icon',app,x:d.px+dx,y:d.py+dy});}}
    onPointerUp={finish} onLostPointerCapture={finish}>
    <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette} frame={frame}/><span>{appName(snapshot.state,app,i18n)}</span>
  </button>;
}
function NoteApp({snapshot,runtime,i18n,preview}: Props) {
  const text=snapshot.state.persistent.productionNote??defaultNote(i18n);
  return <div className="note-app"><textarea aria-label={i18n.t('note.text')} spellCheck={false} value={text} readOnly={preview} maxLength={BALANCE.w3.maxNote}
    onChange={e=>runtime.actDesktop({type:'note',text:e.target.value})} onBlur={runtime.persist}/>
    <footer><span>{i18n.t('note.characters',{count:[...text].length})}</span><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} includeTest={runtime.platform.launch.debug}/></footer>
  </div>;
}
function MailApp(props: Props) {
  const {snapshot,runtime,i18n}=props,d=snapshot.state.run.desktop;
  const selected=d.feedback.find(f=>f.id===d.mailSelection);
  const folders=hasUpgrade(snapshot.state,'folders')||hasDesktopSkill(snapshot.state,'sortMail');
  const messages=[...d.feedback].filter(f=>!folders||d.mailFolder==='all'||(d.mailFolder==='pending'?f.completedAt===null:f.completedAt!==null)).reverse();
  return <div className="mail-app"><aside aria-label={i18n.t('mail.list')}><h2>{i18n.t('desktop.notifications')}</h2>
    {folders&&<nav className="mail-folders">{(['all','pending','completed'] as const).map(folder=><button key={folder} className={d.mailFolder===folder?'selected':''} onClick={()=>runtime.actDesktop({type:'mail-folder',folder})}>{i18n.t(folder==='all'?'mail.all':folder==='pending'?'mail.pendingFolder':'mail.completedFolder')}</button>)}</nav>}{!messages.length&&<p>{i18n.t('mail.empty')}</p>}{messages.map(f=><button key={f.id} className={`${selected?.id===f.id?'selected':''} ${f.completedAt===null?'unread':''}`} onClick={()=>runtime.actDesktop({type:'mail',id:f.id})}>
      <b>{i18n.t(`feedback.sender.${f.sender}`)}</b><span>{feedbackSubject(f,i18n)}</span><small>{f.completedAt===null?i18n.t('mail.pending'):i18n.t('mail.completed',{date:i18n.dateTime(f.completedAt)})}</small>
    </button>)}</aside><article>{selected?<><h1>{feedbackSubject(selected,i18n)}</h1><p className="mail-sender">{i18n.t('mail.from',{name:i18n.t(`feedback.sender.${selected.sender}`)})}</p><p className="mail-date">{i18n.t('mail.received',{date:i18n.dateTime(selected.at)})}</p>
      <FeedbackBody feedback={selected} i18n={i18n}/>{selected.completedAt===null&&hasUpgrade(snapshot.state,'draft')?<><div className="mail-draft"><b>{i18n.t('mail.draft')}</b><p>{i18n.t('mail.draftText')}</p></div><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:selected.id})}>{selected.kind==='redraw'||selected.kind==='practice'||selected.kind==='color'?i18n.t('desktop.fix.editor',{app:editorName(snapshot.state,i18n)}):i18n.t(fixLabel(selected))}</button></>:selected.completedAt!==null?<p className="mail-completed">{i18n.t('mail.completed',{date:i18n.dateTime(selected.completedAt)})}</p>:null}
    </>:<p className="mail-placeholder">{i18n.t('mail.choose')}</p>}</article></div>;
}
export function ScreenshotPreview({shot,catalog, ...props}:Props & {shot:Screenshot;catalog:Screenshot[]}) {
  const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(600);
  const state=useMemo(()=>restoreScreenshot(shot,catalog),[shot,catalog]);
  const capture=useMemo(()=>readCapture(shot),[shot]);
  const screen=capture.version===4?capture.screen:LEGACY_DESKTOP;
  const i18n=useMemo(()=>createI18n(shot.language,{numberNotation:state.persistent.numberNotation}),[shot.language,state.persistent.numberNotation]);
  useLayoutEffect(()=>{const node=host.current;if(!node)return;const observer=new ResizeObserver(()=>setWidth(node.clientWidth));observer.observe(node);setWidth(node.clientWidth);return()=>observer.disconnect();},[]);
  return <div ref={host} className="screenshot-preview" role="img" aria-label={props.i18n.t('files.recorded',{date:props.i18n.dateTime(shot.at)})}>
    <div style={{height:width*screen.height/screen.width}}><div className="screenshot-stage" inert style={{width:screen.width,height:screen.height,transform:`scale(${width/screen.width})`}}><DesktopScene {...props} snapshot={{...props.snapshot,state,language:shot.language,press:null,offline:null,notice:null,frozenRate:capture.display.rate}} capture={capture} i18n={i18n} preview catalog={catalog}/></div></div>
  </div>;
}
function FilePreview({file, ...props}: Props & {file:DesktopFile}) {
  const {runtime,snapshot,i18n,catalog}=props;
  const work=file.work, drawing=file.drawing;
  const frames=work?.frames??drawing?.frames, size=work?.size??drawing?.size;
  return <section className="file-preview"><header><button className="win-button" onClick={()=>runtime.actDesktop({type:'file',id:null})}><LineIcon kind="back"/>{i18n.t('files.backToList')}</button><strong>{file.name}</strong></header>
    <div className="file-preview-content">
      {file.kind==='shot'&&file.shot&&<ScreenshotPreview {...props} shot={file.shot} catalog={catalog??snapshot.state.persistent.screenshots}/>}
      {(file.kind==='icon'||file.kind==='sketch')&&frames&&size&&<div className="art-preview">{frames.map((_,frame)=><PixelArt key={frame} frames={frames} size={size} frame={frame} palette={props.capture?.palette??paletteFor(snapshot.state.persistent.specs.color)}/>)}</div>}
      {file.kind==='part'&&<div className="part-file-preview"><button className="win-button" onClick={()=>{runtime.actDesktop({type:'open',app:'tessera'});}}>{i18n.t('files.edit')}</button><p>{i18n.t(`k.part.${work!.id as 'button'}`)}</p></div>}
      {file.kind==='home'&&<div className="file-home-preview" inert><HomeDocument {...props} selected={null} onSelect={noop} selecting={false} dragPart={null} onDrop={noop} preview interactive={false}/></div>}
    </div><footer>{fileSize(file.bytes,i18n)}{file.at!==null&&<span>{i18n.dateTime(file.at)}</span>}</footer>
  </section>;
}
function FilesApp(props: Props) {
  const {snapshot,runtime,i18n}=props,d=snapshot.state.run.desktop;
  const files=props.capture?frozenFiles(props.capture,props.catalog??[]):desktopFiles(snapshot.state,i18n);
  const canRecycle=(file:DesktopFile)=>snapshot.state.run.desktop.apps.includes('bin')&&(file.kind==='shot'||file.kind==='icon'&&file.id.startsWith('current:icon:')&&!['folder','bin','clock','mail','photo','settings'].includes(file.work?.id??''));
  const [selectedRow,setSelectedRow]=useState<string|null>(null);
  const [history,setHistory]=useState<('root'|'exports'|'screenshots')[]>([d.fileFolder]),[index,setIndex]=useState(0);
  const go=(folder:typeof d.fileFolder,record=true)=>{if(record){setHistory([...history.slice(0,index+1),folder]);setIndex(index+1);}runtime.actDesktop({type:'folder',folder});};
  const selected=files.find(f=>f.id===d.fileSelection);
  const open=(file:DesktopFile)=>{
    if(file.kind==='folder')go(file.id as typeof d.fileFolder);
    else if(file.kind==='note')runtime.actDesktop({type:'open',app:'note'});
    else runtime.actDesktop({type:'file',id:file.id});
  };
  const shotBytes=props.capture?.display.shotBytes ?? snapshot.state.persistent.screenshots.reduce((sum,s)=>sum+screenshotBytes(s),0);
  return <div className="files-app"><nav className="files-address">
    <button className="nav-button" aria-label={i18n.t('files.back')} disabled={index===0} onClick={()=>{setIndex(index-1);go(history[index-1]!,false);}}><LineIcon kind="back"/></button>
    <button className="nav-button" aria-label={i18n.t('files.forward')} disabled={index===history.length-1} onClick={()=>{setIndex(index+1);go(history[index+1]!,false);}}><LineIcon kind="forward"/></button>
    <button className="nav-button" aria-label={i18n.t('files.up')} disabled={d.fileFolder==='root'&&!selected} onClick={()=>selected?runtime.actDesktop({type:'file',id:null}):go('root')}><LineIcon kind="up"/></button>
    <div className="files-breadcrumb"><button onClick={()=>go('root')}>{i18n.t('files.root')}</button>{d.fileFolder!=='root'&&<><LineIcon kind="forward"/><button onClick={()=>runtime.actDesktop({type:'file',id:null})}>{i18n.t(`files.${d.fileFolder}`)}</button></>}</div>
  </nav>{(hasUpgrade(snapshot.state,'search')||hasUpgrade(snapshot.state,'large'))&&<div className="app-toolbar files-tools">{hasUpgrade(snapshot.state,'search')&&<input type="search" aria-label={i18n.t('files.search')} placeholder={i18n.t('files.search')} value={d.fileSearch} onChange={e=>runtime.actDesktop({type:'search',text:e.target.value})}/>} {hasUpgrade(snapshot.state,'large')&&<button className="win-button" onClick={()=>runtime.actDesktop({type:'large'})}>{i18n.t(d.largeIcons?'files.details':'files.large')}</button>}</div>}<div className="files-body"><aside className="files-sidebar">{(['root','exports','screenshots'] as const).map(folder=><button key={folder} className={d.fileFolder===folder?'selected':''} onClick={()=>go(folder)}>{i18n.t(`files.${folder}`)}</button>)}</aside>
    {selected?<FilePreview {...props} file={selected}/>:<div className={`file-list ${d.largeIcons?'large-file-icons':''}`}><table><thead><tr>{(['name','date','type'] as const).map(by=><th key={by}>{hasUpgrade(snapshot.state,'sort')?<button aria-label={i18n.t(`files.sort.${by}`)} onClick={()=>runtime.actDesktop({type:'sort',by})}>{i18n.t(by==='date'?'files.modified':by==='name'?'files.name':'files.type')}{d.fileSort===by?(d.fileDescending?' ↓':' ↑'):''}</button>:i18n.t(by==='date'?'files.modified':by==='name'?'files.name':'files.type')}</th>)}<th>{i18n.t('files.size')}</th></tr></thead><tbody>
      {files.map(file=><tr draggable={canRecycle(file)} onDragStart={e=>e.dataTransfer.setData('text/refresh-file',file.id)} key={file.id} className={selectedRow===file.id?'selected':''} tabIndex={0} onDoubleClick={()=>open(file)} onKeyDown={e=>{if(e.key==='Enter')open(file);}} data-file={file.id}><td>
        <button onClick={()=>setSelectedRow(file.id)}>{file.kind==='icon'&&file.work?<PixelArt frames={file.work.frames} size={file.work.size} palette={props.capture?.palette??paletteFor(snapshot.state.persistent.specs.color)}/>:file.kind==='folder'?<AppIcon app="files" state={snapshot.state} palette={props.capture?.palette}/>:<AppIcon app="note" state={snapshot.state} palette={props.capture?.palette}/>}<span>{file.name}</span></button>
      </td><td title={file.at===null?undefined:i18n.dateTime(file.at)}>{file.at===null?i18n.t('files.unknownDate'):i18n.dateTime(file.at)}</td><td>{i18n.t(`files.type.${file.kind}`)}</td><td>{file.kind==='folder'?'':fileSize(file.bytes,i18n)}{canRecycle(file)&&<button className="file-recycle" aria-label={i18n.t('files.recycle')} title={i18n.t('files.recycle')} onClick={()=>runtime.actDesktop({type:'trash',id:file.id})}><LineIcon kind="close"/></button>}</td></tr>)}
    </tbody></table>{!files.length&&<p>{i18n.t('files.empty')}</p>}</div>}
  </div><footer className="files-status"><span>{i18n.t('files.items',{count:props.capture?.display.fileCount??files.length})}</span><span>{i18n.t('files.storage',{used:props.capture?.display.shotCount??activeScreenshots(snapshot.state).length,capacity:screenshotCapacity(snapshot.state),size:fileSize(shotBytes,i18n)})}</span></footer></div>;
}
function DesktopScene(props: Props): React.ReactElement {
  const {runtime,snapshot,i18n,preview=false}=props;
  const {state}=snapshot,d=state.run.desktop,prefs=state.persistent.desktopPrefs,legacy=!!props.capture&&props.capture.version<3,era=desktopStage(state);
  const [jobMenu,setJobMenu]=useState<JobId|null>(null),[assignments,setAssignments]=useState(false);
  const assignmentMenu=useRef<HTMLElement>(null),jobSource=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(assignments)assignmentMenu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[assignments]);
  const [upgrades,setUpgrades]=useState(false),[conditions,setConditions]=useState(false),[notifications,setNotifications]=useState(false),[flash,setFlash]=useState(false),[frame,setFrame]=useState(0);
  useEffect(()=>{if(preview||!state.persistent.artwork.skills.includes('animation'))return;return runtime.platform.every(BALANCE.w2.animationFrameMs,()=>setFrame(f=>1-f));},[runtime,preview,state.persistent.artwork.skills]);
  useEffect(()=>{if(!flash)return;const stop=runtime.platform.every(180,()=>{setFlash(false);stop();});return stop;},[flash,runtime]);
  const apps=installedApps(state),checks=props.capture?.display.checks??desktopConditions(state),next=nextDesktopApp(state),following=followingDesktopApp(state),pending=d.feedback.filter(f=>f.completedAt===null);
  const notification=d.feedback.find(f=>f.id===d.notice),success=d.feedback.find(f=>f.id===d.success);
  const cooldown=props.capture?.display.cooldown??screenshotCooldown(state);
  const toolbar=useRef<HTMLDivElement>(null);
  const [shotHint,setShotHint]=useState(false);
  useEffect(()=>{if(preview||!snapshot.shotHintSerial)return;setShotHint(true);toolbar.current?.querySelector<HTMLButtonElement>('button')?.focus();const stop=runtime.platform.every(4000,()=>{setShotHint(false);stop();});return stop;},[snapshot.shotHintSerial,preview,runtime]);
  const taskbar=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const root=taskbar.current;if(!root)return;
    const apps=root.querySelector<HTMLElement>('.taskbar-apps')!,right=root.querySelector<HTMLElement>('.taskbar-right')!;
    const fit=()=>root.style.setProperty('--taskbar-max-center',`${d.screen.width-right.offsetWidth-apps.offsetWidth/2-12}px`);
    const observer=new ResizeObserver(fit);observer.observe(apps);observer.observe(right);fit();return()=>observer.disconnect();
  },[]);
  const previousEra=useRef(era),[updating,setUpdating]=useState(false),[backwards,setBackwards]=useState(false),[appearanceMessage,setAppearanceMessage]=useState(false);
  useLayoutEffect(()=>{if(!preview&&previousEra.current!==era){setBackwards(era<previousEra.current);setUpdating(true);setAppearanceMessage(true);}previousEra.current=era;},[era,preview]);
  useEffect(()=>{if(!updating)return;const stop=runtime.platform.every(BALANCE.appearance.transitionMs,()=>{setUpdating(false);stop();});return stop;},[updating,era,runtime]);
  const entered=!preview&&state.elapsedMs-d.enteredAt<BALANCE.w3.enterMs;
  const wallTime=props.capture&&props.capture.version!==1?props.capture.display.wallTime:preview?state.createdAt:runtime.platform.clock.wallNow();
  const hour=new Date(wallTime).getHours(),daylight=BALANCE.w3.daylight;
  const choseWallpaper=prefs.wallpaper!==null||state.persistent.artwork.wallpaper!==null;
  const wallpaper=!legacy&&!choseWallpaper?null:prefs.slideshow?{source:Math.floor(wallTime/BALANCE.w3.slideshowMs)%2?'night':'coast',brightness:1,tone:0,crop:0}:hasDesktopSkill(state,'daylight')?{source:hour<daylight.morningHour||hour>=daylight.nightHour?'night':'coast',brightness:hour>=daylight.morningHour&&hour<daylight.dayHour?daylight.morningBrightness:1,tone:hour>=daylight.dayHour&&hour<daylight.nightHour?daylight.dayTone:0,crop:0}:prefs.wallpaper;
  const saver=!preview&&hasDesktopSkill(state,'screensaver')&&d.idleMs>=BALANCE.w3.screensaverMs&&activeScreenshots(state).length>0;
  const saverShots=activeScreenshots(state),saverShot=saver?saverShots[Math.floor(d.idleMs/BALANCE.w3.screensaverFrameMs)%saverShots.length]:null;
  const upgradeApp=(id:DesktopUpgrade):AppId=>FEATURE_APPS[id as keyof typeof FEATURE_APPS]??(id==='jobs'?'tessera':id as AppId);
  const upgradeEffect=(id:DesktopUpgrade)=>FEATURE_APPS[id as keyof typeof FEATURE_APPS]?i18n.t('effect.featureParts',{count:BALANCE.w3.featureParts})+(JOB_IDS.includes(upgradeApp(id) as JobId)?` · ${i18n.t('jobs.feature',{factor:BALANCE.w3.featureMultiplier})}`:''):id==='jobs'?i18n.t('jobs.capacity',{used:0,capacity:jobCapacity(state)}):i18n.t('effect.screenshotAdd',{value:i18n.pixels(desktopAppShotGain(state))});
  const compactResources=d.screen.width<=1024;
  const resourceControls:ReactNode=<div className="desktop-resources"><button className="taskbar-progress" aria-expanded={conditions} onClick={()=>{setConditions(!conditions);setUpgrades(false);}}><span className="era-progress" aria-hidden="true">{checks.map((done,index)=><i key={index} className={done?'done':''}/>)}</span><span className="progress-caption">{i18n.t('desktop.progress',{product:productLabel(i18n,state.persistent.productName),done:checks.filter(Boolean).length,total:checks.length})}</span></button>
        <button className="taskbar-pixels" title={i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})} aria-expanded={upgrades} onClick={()=>{setUpgrades(!upgrades);setConditions(false);}}><i className="pixel-resource"/><span><b data-desktop-pixels={state.resources.pixels}>{compactResources?i18n.pixels(state.resources.pixels):i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})}</b><small>{i18n.t(compactResources?'desktop.rateCompact':'desktop.rate',{pixels:i18n.rate(props.capture?.display.rate??passivePixelsPerSecond(state))})}</small></span></button>
        <button className="taskbar-tokens" aria-label={i18n.t('desktop.app.settings')} onClick={()=>runtime.actDesktop({type:'open',app:'settings'})}><i className="token-resource"/>{compactResources?i18n.integer(state.resources.tokens):i18n.t('desktop.tokens',{count:state.resources.tokens})}</button></div>;
  return <main style={{'--desktop-width':`${d.screen.width}px`,'--desktop-height':`${d.screen.height}px`,'--desktop-taskbar':`${taskbarHeight(d.screen)}px`,'--desktop-accent':prefs.accent,'--window-radius':`${legacy||prefs.radiusCustom?prefs.radius:era===0?0:era===1?8:7}px`} as React.CSSProperties} onKeyDownCapture={event=>{if(saver){event.preventDefault();event.stopPropagation();runtime.desktopActivity();}}} onPointerMove={()=>!preview&&runtime.desktopActivity()} onKeyDown={()=>!preview&&runtime.desktopActivity()} onPointerDown={event=>{if(!preview)runtime.desktopActivity();if(saver){event.preventDefault();return;}const target=event.target as HTMLElement;if(!target.closest('.job-control-anchor'))setJobMenu(null);if(!target.closest('.job-assignment-menu,.taskbar-job-source'))setAssignments(false);if(!target.closest('.desktop-upgrades,.taskbar-pixels'))setUpgrades(false);if(!target.closest('.desktop-conditions,.taskbar-progress'))setConditions(false);if(!target.closest('.notification-center,.notification-button'))setNotifications(false);}} className={`desktop ${!legacy?`desktop-era-${era}`:''} ${updating?'desktop-updating':''} ${prefs.mode==='dark'?'desktop-dark':''} ${entered?'desktop-entering':''} ${preview?'desktop-frozen':'desktop-live'}`}>
    {legacy&&<PhotoSurface specs={state.persistent.specs} className="desktop-wallpaper-surface"><img className="desktop-wallpaper" src={coast} alt="" draggable={false}/></PhotoSurface>}
    {wallpaper&&<Photograph {...props} edit={wallpaper} wallpaper/>}
    {!wallpaper&&state.persistent.artwork.wallpaper&&<PixelArt frames={state.persistent.artwork.wallpaper.frames} size={state.persistent.artwork.wallpaper.size} palette={props.capture?.palette??paletteFor(state.persistent.specs.color)} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>}
    {!legacy&&era===2&&resourceControls}
    {apps.filter(app=>app!=='settings').map(app=><DesktopShortcut key={app} {...props} app={app} frame={frame}/>)}
    {apps.filter(app=>d.windows[app].open&&(!hasDesktopSkill(state,'virtual')||d.workspaces[app]===d.workspace)).map(app=><DesktopWindow key={app} {...props} app={app} jobMenu={jobMenu} onJobMenu={setJobMenu}>
      {app==='tessera'?<Kumiki runtime={runtime} snapshot={snapshot} i18n={i18n} embedded preview={preview} legacyAppearance={legacy} previewPalette={props.capture?.palette} previewReady={props.capture?.editor.ready} previewDocuments={props.capture?.editor.documents} interactive={!preview&&d.active===app&&!d.windows[app].minimized}/>:app==='note'?<NoteApp {...props}/>:app==='files'?<FilesApp {...props}/>:app==='mail'?<MailApp {...props}/>:<ExtraApp {...props} app={app}/>}
    </DesktopWindow>)}
    <div ref={toolbar} className={`screenshot-toolbar ${shotHint?'shot-hint':''}`}><LineIcon kind="capture"/><strong>{i18n.t('desktop.shot')}</strong><span>{i18n.t('desktop.parts',{count:props.capture?.display.parts??screenshotParts(state)})}</span><span>{i18n.t('desktop.reward',{pixels:i18n.pixels(props.capture?.display.reward??screenshotReward(state))})}</span>
      <button className="win-button accent capture-button" disabled={d.cooldownMs>0} onClick={()=>{if(runtime.takeScreenshot())setFlash(true);}} title={i18n.t('desktop.capture')}>
        {d.cooldownMs>0?<><svg viewBox="0 0 24 24" className="cooldown-ring" aria-hidden="true"><circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray={`${d.cooldownMs/cooldown} 1`}/></svg>{i18n.t('desktop.wait',{count:Math.ceil(d.cooldownMs/1000)})}</>:i18n.t('desktop.capture')}
      </button>
    </div>
    {(notification||success)&&<aside className={`feedback-toast ${success?'is-success':''}`} aria-live={preview?'off':'polite'}>
      <header><AppIcon app="mail" state={state} palette={props.capture?.palette}/><b>{i18n.t(success?'desktop.thanks':'desktop.notifications')}</b><button className="nav-button" aria-label={i18n.t('desktop.close')} onClick={()=>runtime.actDesktop(success?{type:'success-close'}:{type:'notice',id:null})}><LineIcon kind="close"/></button></header>
      {success?<p>{i18n.t('desktop.tokenReward',{count:success.reward??BALANCE.w3.feedbackTokens})}</p>:notification&&<><b className="toast-sender">{i18n.t(`feedback.sender.${notification.sender}`)}</b><FeedbackBody feedback={notification} i18n={i18n}/><div className="toast-actions"><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:notification.id})}>{notification.kind==='redraw'||notification.kind==='practice'||notification.kind==='color'?i18n.t('desktop.fix.editor',{app:editorName(state,i18n)}):i18n.t(fixLabel(notification))}</button><button className="win-button" onClick={()=>runtime.actDesktop({type:'notice',id:null})}>{i18n.t('desktop.later')}</button></div></>}
    </aside>}
    {notifications&&<section className="notification-center"><h2>{i18n.t('desktop.pending',{count:pending.length})}</h2>{pending.length?pending.map(f=><button key={f.id} className="win-button" onClick={()=>{runtime.actDesktop({type:'notice',id:f.id});setNotifications(false);}}>{feedbackSubject(f,i18n)}</button>):<p>{i18n.t('desktop.noPending')}</p>}</section>}
    {conditions&&<section className="desktop-conditions">{!legacy&&<nav className="desktop-programs">{apps.map(app=><button key={app} data-app-launcher={app} onClick={()=>{runtime.actDesktop({type:'open',app});setConditions(false);}}><AppIcon app={app} state={state}/><span>{appName(state,app,i18n)}</span></button>)}</nav>}<h2>{i18n.t('k.conditions')}</h2>{(['apps','requests','icons','wallpaper','automation'] as const).map((id,index)=><label key={id}><input type="checkbox" readOnly checked={checks[index]}/>{i18n.t(`seed.condition.${id}`)}</label>)}</section>}
    {upgrades&&<section className="desktop-upgrades"><h2>{i18n.t('desktop.upgrades')}</h2>{d.upgrades.slice(-4).map(id=><div className="upgrade-owned" key={id}><AppIcon app={upgradeApp(id)} state={state} palette={props.capture?.palette}/><span>{appName(state,id as AppId,i18n)}</span><small>{i18n.t('desktop.owned')}</small></div>)}
      {next&&<div className="upgrade-current"><AppIcon app={upgradeApp(next.id)} state={state} palette={props.capture?.palette}/><div><strong>{i18n.t(`desktop.app.${next.id}`)}<small className="purchase-effect">{upgradeEffect(next.id)}</small></strong><button className="win-button accent" disabled={state.resources.pixels<next.cost} onClick={()=>{runtime.actDesktop({type:'buy',app:next.id});setUpgrades(false);}}>{i18n.t('desktop.build',{cost:i18n.price(next.cost)})}</button><Estimate cost={next.cost} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} i18n={i18n} runtime={runtime} preview={preview}/></div></div>}
      {following&&<div className="upgrade-next"><span>{i18n.t('desktop.next')}</span><strong>{i18n.t(`desktop.app.${following.id}`)}<small className="purchase-effect">{upgradeEffect(following.id)}</small></strong><small>{i18n.t('desktop.build',{cost:i18n.price(following.cost)})}</small></div>}
      {!next&&<div className="upgrade-next"><strong>{i18n.t('desktop.streaming')}</strong><span>{state.persistent.specs.refresh<2?i18n.t('desktop.streamingRequirement',{spec:i18n.spec('refresh',state.persistent.specs.refresh)}):i18n.t('desktop.streamingLater')}</span></div>}
    </section>}
    {assignments&&<section ref={assignmentMenu} className="job-assignment-menu" role="menu" aria-label={i18n.t('jobs.assignmentMenu')} onKeyDown={event=>{
      if(event.key==='Escape'){setAssignments(false);jobSource.current?.focus();event.preventDefault();}
      if(['ArrowDown','ArrowUp'].includes(event.key)){const buttons=Array.from(assignmentMenu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),at=buttons.indexOf(event.target as HTMLButtonElement);buttons[(at+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();event.preventDefault();}
    }}><header>{i18n.t('jobs.assignmentMenu')}<small>{i18n.t('jobs.capacity',{used:JOB_IDS.filter(id=>d.jobs[id].assigned).length,capacity:jobCapacity(state)})}</small></header>
      {JOB_IDS.filter(id=>id==='tessera'||d.apps.includes(id)).map(app=><button key={app} role="menuitemcheckbox" aria-checked={d.jobs[app].assigned} disabled={!d.jobs[app].assigned&&JOB_IDS.filter(id=>d.jobs[id].assigned).length>=jobCapacity(state)} onClick={()=>{runtime.actDesktop({type:'job-assign',app});if(!d.jobs[app].assigned)runtime.actDesktop({type:'open',app});setAssignments(false);jobSource.current?.focus();}}><AppIcon app={app} state={state}/><span>{appName(snapshot.state,app,i18n)}</span><small>{i18n.t(d.jobs[app].assigned?'jobs.remove':'jobs.assign')}</small></button>)}
    </section>}
    <footer ref={taskbar} className="desktop-taskbar">{!legacy&&<button className="taskbar-product" aria-label={i18n.t('appearance.productMenu')} title={productLabel(i18n,state.persistent.productName)} aria-expanded={conditions} onClick={()=>setConditions(!conditions)}><ProductGlyph/><span>{productLabel(i18n,state.persistent.productName)}</span></button>}{hasUpgrade(state,'jobs')&&<button ref={jobSource} className="taskbar-job-source" aria-label={i18n.t('jobs.drag')} aria-expanded={assignments} aria-haspopup="menu" draggable title={i18n.t('jobs.drag')} onDragStart={e=>{setAssignments(false);e.dataTransfer.setData('text/refresh-job','cursor');}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setAssignments(true);}}} onClick={()=>setAssignments(!assignments)}><CursorGlyph/><span>{i18n.t('jobs.cursor')}<small>{i18n.t('jobs.capacity',{used:JOB_IDS.filter(id=>d.jobs[id].assigned).length,capacity:jobCapacity(state)})}</small></span></button>}
      {hasDesktopSkill(state,'virtual')&&<nav className="taskbar-workspaces">{([0,1] as const).map(workspace=><button key={workspace} aria-label={i18n.t('desktop.workspace',{count:workspace+1})} aria-pressed={d.workspace===workspace} onClick={()=>runtime.actDesktop({type:'workspace',workspace})}>{i18n.integer(workspace+1)}</button>)}</nav>}<div className="taskbar-apps">{apps.filter(app=>legacy?!['note','settings'].includes(app)||d.windows[app].open:era===2?app!=='note'||d.windows[app].open:d.windows[app].open).map(app=><button key={app} aria-label={appName(snapshot.state,app,i18n)} title={appName(snapshot.state,app,i18n)} className={`${d.windows[app].open?'running':''} ${d.active===app&&!d.windows[app].minimized?'active':''}`} onClick={()=>runtime.actDesktop({type:'taskbar',app})}><AppIcon app={app} state={state} palette={props.capture?.palette} frame={frame}/><span className="taskbar-app-name">{appName(state,app,i18n,legacy)}</span></button>)}</div>
      <div className="taskbar-right">{(legacy||era!==2)&&resourceControls}
        {d.apps.includes('clock')&&<button className="taskbar-clock" onClick={()=>runtime.actDesktop({type:'open',app:'clock'})}><span>{i18n.time(wallTime)}</span><span>{i18n.date(wallTime)}</span></button>}
        {d.feedback.length>0&&<button className="notification-button" aria-label={i18n.t('desktop.notifications')} aria-expanded={notifications} onClick={()=>setNotifications(!notifications)}><LineIcon kind="bell"/>{pending.length>0&&<small>{i18n.integer(pending.length)}</small>}</button>}
      </div>
    </footer>
    {saverShot&&<div className="desktop-screensaver"><ScreenshotPreview {...props} shot={saverShot} catalog={state.persistent.screenshots}/><span>{i18n.t('desktop.screensaver')}</span></div>}
    {appearanceMessage&&!preview&&<aside className="appearance-guide" role="status"><p>{i18n.t(backwards?'appearance.guide.previous':era===2?'appearance.guide.desktop2':'appearance.guide.desktop1')}</p><small>{i18n.t('guide.signature')}</small><button onClick={()=>setAppearanceMessage(false)}>{i18n.t('guide.close')}</button></aside>}
    {flash&&!runtime.platform.animation.reducedMotion()&&<div className="screenshot-flash"/>}
  </main>;
}
export function Desktop(props: Props) { return <DesktopScene {...props}/>; }
