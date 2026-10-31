import { frozenFiles, readCapture, type CaptureSceneV1 } from '../systems/captureScene';
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
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { AppIcon, LineIcon, PixelArt } from './desktop-icons';
import { Kumiki } from './Kumiki';
import { HomeDocument } from './kumiki/HomeDocument';
import { LanguageSelect } from '../components/LanguageSelect';

interface Props { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n; preview?: boolean; catalog?: Screenshot[]; capture?:CaptureSceneV1 }
const noop = () => {};
function feedbackName(f: Feedback, i18n: I18n): string { return ['redraw','practice'].includes(f.kind) ? i18n.t(`k.icon.${f.target as 'folder'}`) : ''; }
function feedbackSubject(f: Feedback, i18n: I18n) { return i18n.t(`feedback.subject.${f.kind}`,{name:feedbackName(f,i18n)}); }
function FeedbackBody({ feedback: f, i18n }: { feedback: Feedback; i18n: I18n }) {
  return <p className="feedback-body">{i18n.t(`feedback.body.${f.kind}`,{name:feedbackName(f,i18n),count:BALANCE.w3.redrawCells})}</p>;
}
function DesktopWindow({ app, children, ...props }: Props & {app: AppId; children: ReactNode}) {
  const { runtime, snapshot, i18n, preview } = props;
  const d = snapshot.state.run.desktop, w = d.windows[app];
  const active = d.active === app;
  const drag = useRef<{ x:number; y:number; scale:number; kind:'move'|'resize'; rect:typeof w } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const end = () => { if (drag.current) { drag.current = null; runtime.persist(); } };
  const start = (event: React.PointerEvent<HTMLElement>, kind:'move'|'resize') => {
    if (preview || event.button !== 0 || w.maximized || kind === 'move' && (event.target as HTMLElement).closest('button')) return;
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
    onPointerDownCapture={() => { if (!preview && !active) runtime.actDesktop({type:'open',app}); }} aria-label={i18n.t(`desktop.app.${app}`)}>
    <header className="window-title" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onDoubleClick={event=>{ if (!(event.target as HTMLElement).closest('button') && !preview) runtime.actDesktop({type:'maximize',app}); }}>
      <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette}/><span>{i18n.t(`desktop.app.${app}`)}</span>
      <div className="window-controls">{(['minimize',w.maximized?'restore':'maximize','close'] as const).map(kind=><button key={kind} className={kind==='close'?'window-close':''} aria-label={i18n.t(`desktop.${kind}`)} onClick={()=>runtime.actDesktop({type:kind==='restore'?'maximize':kind,app})}><LineIcon kind={kind}/></button>)}</div>
    </header>
    <div className="window-content">{children}</div>
    {!w.maximized && <button className="window-resize" aria-label={i18n.t('desktop.resize')} onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onKeyDown={e=>{ if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();runtime.actDesktop({type:'rect',app,rect:{...w,width:w.width+(e.key==='ArrowRight'?16:e.key==='ArrowLeft'?-16:0),height:w.height+(e.key==='ArrowDown'?16:e.key==='ArrowUp'?-16:0)}});runtime.persist();} }}><LineIcon kind="resize"/></button>}
  </section>;
}
function DesktopShortcut({app,frame,...props}: Props & {app:AppId;frame:number}) {
  const {snapshot,runtime,i18n,preview} = props, p=snapshot.state.run.desktop.icons[app];
  const drag=useRef<{x:number;y:number;scale:number;px:number;py:number; moved:boolean}|null>(null);
  const finish=()=>{if(drag.current){drag.current=null;runtime.persist();}};
  return <button className="desktop-shortcut" data-shortcut={app} style={{left:p.x,top:p.y}} onDoubleClick={()=>!preview&&runtime.actDesktop({type:'open',app})}
    onKeyDown={e=>{if(e.key==='Enter')runtime.actDesktop({type:'open',app});}}
    onPointerDown={e=>{if(preview||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,scale:e.currentTarget.getBoundingClientRect().width/78,px:p.x,py:p.y,moved:false};}}
    onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.x)/d.scale,dy=(e.clientY-d.y)/d.scale;if(Math.hypot(dx,dy)<4&&!d.moved)return;d.moved=true;runtime.actDesktop({type:'icon',app,x:d.px+dx,y:d.py+dy});}}
    onPointerUp={finish} onLostPointerCapture={finish}>
    <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette} frame={frame}/><span>{i18n.t(`desktop.app.${app}`)}</span>
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
  const messages=[...d.feedback].reverse();
  return <div className="mail-app"><aside aria-label={i18n.t('mail.list')}><h2>{i18n.t('desktop.notifications')}</h2>
    {!messages.length&&<p>{i18n.t('mail.empty')}</p>}{messages.map(f=><button key={f.id} className={`${selected?.id===f.id?'selected':''} ${f.completedAt===null?'unread':''}`} onClick={()=>runtime.actDesktop({type:'mail',id:f.id})}>
      <b>{i18n.t(`feedback.sender.${f.sender}`)}</b><span>{feedbackSubject(f,i18n)}</span><small>{f.completedAt===null?i18n.t('mail.pending'):i18n.t('mail.completed',{date:i18n.dateTime(f.completedAt)})}</small>
    </button>)}</aside><article>{selected?<><h1>{feedbackSubject(selected,i18n)}</h1><p className="mail-sender">{i18n.t('mail.from',{name:i18n.t(`feedback.sender.${selected.sender}`)})}</p><p className="mail-date">{i18n.t('mail.received',{date:i18n.dateTime(selected.at)})}</p>
      <FeedbackBody feedback={selected} i18n={i18n}/>{selected.completedAt===null?<button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:selected.id})}>{i18n.t(selected.kind==='screenshot'?'desktop.fix.screenshot':'desktop.fix.tessera')}</button>:<p className="mail-completed">{i18n.t('mail.completed',{date:i18n.dateTime(selected.completedAt)})}</p>}
    </>:<p className="mail-placeholder">{i18n.t('mail.choose')}</p>}</article></div>;
}
function ScreenshotPreview({shot,catalog, ...props}:Props & {shot:Screenshot;catalog:Screenshot[]}) {
  const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(600);
  const state=useMemo(()=>restoreScreenshot(shot,catalog),[shot,catalog]);
  const capture=useMemo(()=>readCapture(shot),[shot]);
  const i18n=useMemo(()=>createI18n(shot.language,{numberNotation:state.persistent.numberNotation}),[shot.language,state.persistent.numberNotation]);
  useLayoutEffect(()=>{const node=host.current;if(!node)return;const observer=new ResizeObserver(()=>setWidth(node.clientWidth));observer.observe(node);setWidth(node.clientWidth);return()=>observer.disconnect();},[]);
  return <div ref={host} className="screenshot-preview" role="img" aria-label={props.i18n.t('files.recorded',{date:props.i18n.dateTime(shot.at)})}>
    <div style={{height:width*1080/1920}}><div className="screenshot-stage" inert style={{transform:`scale(${width/1920})`}}><DesktopScene {...props} snapshot={{...props.snapshot,state,language:shot.language,press:null,offline:null,notice:null,frozenRate:capture.display.rate}} capture={capture} i18n={i18n} preview catalog={catalog}/></div></div>
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
  </nav><div className="files-body"><aside className="files-sidebar">{(['root','exports','screenshots'] as const).map(folder=><button key={folder} className={d.fileFolder===folder?'selected':''} onClick={()=>go(folder)}>{i18n.t(`files.${folder}`)}</button>)}</aside>
    {selected?<FilePreview {...props} file={selected}/>:<div className="file-list"><table><thead><tr><th>{i18n.t('files.name')}</th><th>{i18n.t('files.modified')}</th><th>{i18n.t('files.type')}</th><th>{i18n.t('files.size')}</th></tr></thead><tbody>
      {files.map(file=><tr key={file.id} className={selectedRow===file.id?'selected':''} tabIndex={0} onDoubleClick={()=>open(file)} onKeyDown={e=>{if(e.key==='Enter')open(file);}} data-file={file.id}><td>
        <button onClick={()=>setSelectedRow(file.id)}>{file.kind==='icon'&&file.work?<PixelArt frames={file.work.frames} size={file.work.size} palette={props.capture?.palette??paletteFor(snapshot.state.persistent.specs.color)}/>:file.kind==='folder'?<AppIcon app="files" state={snapshot.state} palette={props.capture?.palette}/>:<AppIcon app="note" state={snapshot.state} palette={props.capture?.palette}/>}<span>{file.name}</span></button>
      </td><td title={file.at===null?undefined:i18n.dateTime(file.at)}>{file.at===null?i18n.t('files.unknownDate'):i18n.dateTime(file.at)}</td><td>{i18n.t(`files.type.${file.kind}`)}</td><td>{file.kind==='folder'?'':fileSize(file.bytes,i18n)}</td></tr>)}
    </tbody></table>{!files.length&&<p>{i18n.t('files.empty')}</p>}</div>}
  </div><footer className="files-status"><span>{i18n.t('files.items',{count:props.capture?.display.fileCount??files.length})}</span><span>{i18n.t('files.storage',{used:props.capture?.display.shotCount??snapshot.state.persistent.screenshots.length,capacity:screenshotCapacity(snapshot.state),size:fileSize(shotBytes,i18n)})}</span></footer></div>;
}
function DesktopScene(props: Props) {
  const {runtime,snapshot,i18n,preview=false}=props;
  const {state}=snapshot,d=state.run.desktop;
  const [upgrades,setUpgrades]=useState(false),[conditions,setConditions]=useState(false),[notifications,setNotifications]=useState(false),[flash,setFlash]=useState(false),[frame,setFrame]=useState(0);
  useEffect(()=>{if(preview||!state.persistent.artwork.skills.includes('animation'))return;return runtime.platform.every(BALANCE.w2.animationFrameMs,()=>setFrame(f=>1-f));},[runtime,preview,state.persistent.artwork.skills]);
  useEffect(()=>{if(!flash)return;const stop=runtime.platform.every(180,()=>{setFlash(false);stop();});return stop;},[flash,runtime]);
  const apps=installedApps(state),checks=props.capture?.display.checks??desktopConditions(state),next=nextDesktopApp(state),pending=d.feedback.filter(f=>f.completedAt===null);
  const notification=d.feedback.find(f=>f.id===d.notice),success=d.feedback.find(f=>f.id===d.success);
  const cooldown=props.capture?.display.cooldown??BALANCE.spec.graphics[state.persistent.specs.graphics]!.shotCooldownSeconds*1000;
  const toolbar=useRef<HTMLDivElement>(null);
  const [shotHint,setShotHint]=useState(false);
  useEffect(()=>{if(preview||!snapshot.shotHintSerial)return;setShotHint(true);toolbar.current?.querySelector<HTMLButtonElement>('button')?.focus();const stop=runtime.platform.every(4000,()=>{setShotHint(false);stop();});return stop;},[snapshot.shotHintSerial,preview,runtime]);
  const entered=!preview&&state.elapsedMs-d.enteredAt<BALANCE.w3.enterMs;
  return <main onPointerDown={event=>{const target=event.target as HTMLElement;if(!target.closest('.desktop-upgrades,.taskbar-pixels'))setUpgrades(false);if(!target.closest('.desktop-conditions,.taskbar-progress'))setConditions(false);if(!target.closest('.notification-center,.notification-button'))setNotifications(false);}} className={`desktop ${entered?'desktop-entering':''} ${preview?'desktop-frozen':'desktop-live'}`}>
    <svg className="desktop-filters" aria-hidden="true"><defs><filter id={preview?'coast-256-preview':'coast-256'} colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1"/></feComponentTransfer></filter></defs></svg>
    <img className="desktop-wallpaper" src={coast} alt="" draggable={false} style={{filter:state.persistent.specs.color===1?`url(#${preview?'coast-256-preview':'coast-256'})`:undefined}}/>
    {state.persistent.artwork.wallpaper&&<PixelArt frames={state.persistent.artwork.wallpaper.frames} size={state.persistent.artwork.wallpaper.size} palette={props.capture?.palette??paletteFor(state.persistent.specs.color)} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>}
    {apps.map(app=><DesktopShortcut key={app} {...props} app={app} frame={frame}/>)}
    {apps.filter(app=>d.windows[app].open).map(app=><DesktopWindow key={app} {...props} app={app}>
      {app==='tessera'?<Kumiki runtime={runtime} snapshot={snapshot} i18n={i18n} embedded preview={preview} previewPalette={props.capture?.palette} previewReady={props.capture?.editor.ready} previewDocuments={props.capture?.editor.documents} interactive={!preview&&d.active===app&&!d.windows[app].minimized}/>:app==='note'?<NoteApp {...props}/>:app==='files'?<FilesApp {...props}/>:<MailApp {...props}/>}
    </DesktopWindow>)}
    <div ref={toolbar} className={`screenshot-toolbar ${shotHint?'shot-hint':''}`}><LineIcon kind="capture"/><strong>{i18n.t('desktop.shot')}</strong><span>{i18n.t('desktop.parts',{count:props.capture?.display.parts??screenshotParts(state)})}</span><span>{i18n.t('desktop.reward',{pixels:i18n.pixels(props.capture?.display.reward??screenshotReward(state))})}</span>
      <button className="win-button accent capture-button" disabled={d.cooldownMs>0} onClick={()=>{if(runtime.takeScreenshot())setFlash(true);}} title={i18n.t('desktop.capture')}>
        {d.cooldownMs>0?<><svg viewBox="0 0 24 24" className="cooldown-ring" aria-hidden="true"><circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray={`${d.cooldownMs/cooldown} 1`}/></svg>{i18n.t('desktop.wait',{count:Math.ceil(d.cooldownMs/1000)})}</>:i18n.t('desktop.capture')}
      </button>
    </div>
    {(notification||success)&&<aside className={`feedback-toast ${success?'is-success':''}`} aria-live={preview?'off':'polite'}>
      <header><AppIcon app="mail" state={state} palette={props.capture?.palette}/><b>{i18n.t(success?'desktop.thanks':'desktop.notifications')}</b><button className="nav-button" aria-label={i18n.t('desktop.close')} onClick={()=>runtime.actDesktop(success?{type:'success-close'}:{type:'notice',id:null})}><LineIcon kind="close"/></button></header>
      {success?<p>{i18n.t('desktop.tokenReward',{count:BALANCE.w3.feedbackTokens})}</p>:notification&&<><b className="toast-sender">{i18n.t(`feedback.sender.${notification.sender}`)}</b><FeedbackBody feedback={notification} i18n={i18n}/><div className="toast-actions"><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:notification.id})}>{i18n.t(notification.kind==='screenshot'?'desktop.fix.screenshot':'desktop.fix.tessera')}</button><button className="win-button" onClick={()=>runtime.actDesktop({type:'notice',id:null})}>{i18n.t('desktop.later')}</button></div></>}
    </aside>}
    {notifications&&<section className="notification-center"><h2>{i18n.t('desktop.pending',{count:pending.length})}</h2>{pending.length?pending.map(f=><button key={f.id} className="win-button" onClick={()=>{runtime.actDesktop({type:'notice',id:f.id});setNotifications(false);}}>{feedbackSubject(f,i18n)}</button>):<p>{i18n.t('desktop.noPending')}</p>}</section>}
    {conditions&&<section className="desktop-conditions"><h2>{i18n.t('k.conditions')}</h2>{(['apps','requests','icons','wallpaper','automation'] as const).map((id,index)=><label key={id}><input type="checkbox" readOnly checked={checks[index]}/>{i18n.t(`seed.condition.${id}`)}</label>)}</section>}
    {upgrades&&<section className="desktop-upgrades"><h2>{i18n.t('desktop.upgrades')}</h2>{d.apps.map(id=><div className="upgrade-owned" key={id}><AppIcon app={id} state={state} palette={props.capture?.palette}/><span>{i18n.t(`desktop.app.${id}`)}</span><small>{i18n.t('desktop.owned')}</small></div>)}
      {next&&<div className="upgrade-current"><AppIcon app={next.id} state={state} palette={props.capture?.palette}/><div><strong>{i18n.t(`desktop.app.${next.id}`)}<small className="purchase-effect">{i18n.t('effect.screenshotAdd',{value:i18n.pixels(desktopAppShotGain(state))})}</small></strong><button className="win-button accent" disabled={state.resources.pixels<next.cost} onClick={()=>{runtime.actDesktop({type:'buy',app:next.id});setUpgrades(false);}}>{i18n.t('desktop.build',{cost:i18n.price(next.cost)})}</button><Estimate cost={next.cost} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} i18n={i18n} runtime={runtime} preview={preview}/></div></div>}
      {next&&BALANCE.w3.apps[d.apps.length+1]&&<div className="upgrade-next"><span>{i18n.t('desktop.next')}</span><strong>{i18n.t(`desktop.app.${BALANCE.w3.apps[d.apps.length+1]!.id}`)}<small className="purchase-effect">{i18n.t('effect.screenshotAdd',{value:i18n.pixels(desktopAppShotGain(state))})}</small></strong><small>{i18n.t('desktop.build',{cost:i18n.price(BALANCE.w3.apps[d.apps.length+1]!.cost)})}</small></div>}
    </section>}
    <footer className="desktop-taskbar"><div className="taskbar-apps">{apps.filter(app=>app!=='note'||d.windows.note.open).map(app=><button key={app} aria-label={i18n.t(`desktop.app.${app}`)} title={i18n.t(`desktop.app.${app}`)} className={`${d.windows[app].open?'running':''} ${d.active===app&&!d.windows[app].minimized?'active':''}`} onClick={()=>runtime.actDesktop({type:'taskbar',app})}><AppIcon app={app} state={state} palette={props.capture?.palette} frame={frame}/></button>)}</div>
      <div className="taskbar-right"><button className="taskbar-progress" aria-expanded={conditions} onClick={()=>{setConditions(!conditions);setUpgrades(false);}}>{i18n.t('desktop.progress',{product:productLabel(i18n,state.persistent.productName),done:checks.filter(Boolean).length,total:checks.length})}</button>
        <button className="taskbar-pixels" aria-expanded={upgrades} onClick={()=>{setUpgrades(!upgrades);setConditions(false);}}><i className="pixel-resource"/><span><b data-desktop-pixels={state.resources.pixels}>{i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})}</b><small>{i18n.t('desktop.rate',{pixels:i18n.rate(props.capture?.display.rate??passivePixelsPerSecond(state))})}</small></span></button>
        <span className="taskbar-tokens"><i className="token-resource"/>{i18n.t('desktop.tokens',{count:state.resources.tokens})}</span>
        {d.feedback.length>0&&<button className="notification-button" aria-label={i18n.t('desktop.notifications')} aria-expanded={notifications} onClick={()=>setNotifications(!notifications)}><LineIcon kind="bell"/>{pending.length>0&&<small>{i18n.integer(pending.length)}</small>}</button>}
      </div>
    </footer>
    {flash&&!runtime.platform.animation.reducedMotion()&&<div className="screenshot-flash"/>}
  </main>;
}
export function Desktop(props: Props) { return <DesktopScene {...props}/>; }
