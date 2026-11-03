import { useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode } from 'react';
import coast from '../assets/wallpaper/coast.webp';
import { Estimate } from '../components/Estimate';
import { FilesRibbon } from '../components/FilesRibbon';
import { LanguageSelect } from '../components/LanguageSelect';
import { ReleaseProgress } from '../components/ReleaseProgress';
import { StatusBar } from '../components/StatusBar';
import {DesktopNextHand} from '../components/DesktopNextHand';
import { AdviceHistory,AdviceMessage } from '../components/WorldAdvice';
import type { DesktopUpgrade } from '../config/balance';
import { BALANCE } from '../config/balance';
import { feedbackBodyText,feedbackSubject } from '../content/feedback';
import { productLabel } from '../content/products';
import { hasAppPart,missingConditionParts,missingFeedbackPart } from '../systems/appBuild';
import { appName,desktopStage,editorName } from '../systems/appearance';
import { isBuildable } from '../systems/appLayout';
import { producedWindowChrome } from '../systems/commonChrome';
import { activeScreenshots,desktopConditions,followingDesktopApp,installedApps,nextDesktopApp,screenshotCooldown,screenshotParts,screenshotReward } from '../systems/desktop';
import { defaultNote } from '../systems/desktopFiles';
import { taskbarHeight,workHeight } from '../systems/desktopGeometry';
import { FEATURE_APPS,hasDesktopSkill,hasUpgrade,jobCapacity } from '../systems/desktopJobs';
import type { AppId,BuiltApp,Feedback,Screenshot } from '../systems/desktopState';
import { JOB_IDS,type JobId } from '../systems/desktopState';
import { passivePixelsPerSecond } from '../systems/economy';
import { canRelease } from '../systems/release';
import { AppBuilder } from './AppBuilder';
import { AppPart,AppSurface,partLabel } from './AppComposition';
import './common-chrome.css';
import { CommonWindowControls } from './CommonWindowControls';
import { AppIcon,CursorGlyph,LineIcon,ProductGlyph } from './desktop-icons';
import { ExtraApp,JobControls,Photograph,WorkingCursors } from './DesktopApps';
import type { DesktopProps as Props } from './desktopTypes';
import { LegacyCapturePreview } from './LegacyCapturePreview';
import { PhotoSurface } from './PhotoSurface';
import { ReleaseConfirmation } from './release/ReleaseConfirmation';
import { Workshop } from './Workshop';
import { FilesApp as DocumentFilesApp } from './files/FilesApp';
import { World4Preparation } from './workshop/World4Preparation';
import { useCaptureGeometry,collectCaptureGeometry } from './useCaptureGeometry';
import { partsForSet } from '../content/workshopCatalog';
import type { DesktopOffer } from '../systems/desktopOffers';
import { shellPartProps } from './shellParts';

function FeedbackBody({feedback:f,...props}:Props&{feedback:Feedback}) {
 const missing=f.completedAt===null?missingFeedbackPart(props.snapshot.state,f.kind):null;
 return <><p className="feedback-body">{feedbackBodyText(props.snapshot.state,f,props.i18n,!!props.capture&&props.capture.version<3)}</p>{missing&&<p className="missing-app-part">{props.i18n.t('builder.missing',{part:partLabel(missing.part,props.i18n)})}</p>}</>;
}
function fixLabel(f:Feedback){return f.kind==='screenshot'||f.kind==='capture'?'desktop.fix.screenshot':f.kind==='sort'||f.kind==='search'?'desktop.fix.files':f.kind==='bright'?'desktop.fix.photo':f.kind==='trash'?'desktop.fix.bin':f.kind==='timer'?'desktop.fix.clock':f.kind==='dark'?'desktop.fix.theme':'desktop.fix.tessera';}
function DesktopWindow({ app, children,jobMenu,onJobMenu, ...props }: Props & {app: AppId; children: ReactNode;jobMenu:JobId|null;onJobMenu:(app:JobId|null)=>void}) {
  const { runtime, snapshot, i18n, preview } = props;
  const d = snapshot.state.run.desktop, w = d.windows[app];
  const active = d.active === app;
  const chrome=producedWindowChrome(snapshot.state,app),titleStyle=chrome?.custom?{...(chrome.customColors?{'--produced-title-color':chrome.design.color,'--produced-title-text':chrome.design.textColor}:{}),'--produced-title-align':chrome.design.titleAlign,'--produced-title-font':`${chrome.design.fontSize}px`,'--produced-title-radius':`${chrome.design.radius}px`} as React.CSSProperties:undefined;
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
  return <section ref={host} className={`desktop-window ${active?'is-active':''} ${w.maximized?'is-maximized':''} app-${app}`} data-app={app} data-produced-shadow={chrome?.design.shadow||undefined}
    style={{left:w.x,top:w.y,width:w.width,height:w.height,zIndex:w.z+10,display:w.minimized?'none':undefined,...(chrome&&chrome.design.radius!==BALANCE.workshop.design.radius?{'--window-radius':`${chrome.design.radius}px`}:{})} as React.CSSProperties}
    onPointerDownCapture={() => { if (!preview && !active) runtime.actDesktop({type:'open',app}); }} aria-label={appName(snapshot.state,app,i18n)}>
    <header data-job-target={canAssign?app:undefined} className={`window-title ${dropTarget?'job-drop-target':''} ${chrome?.custom?'has-produced-chrome':''} ${chrome?.customColors?'has-produced-colors':''}`} style={titleStyle} onDragOver={event=>{if(canAssign&&event.dataTransfer.types.includes('text/refresh-job')){event.preventDefault();setDropTarget(true);}}} onDragLeave={()=>setDropTarget(false)} onDrop={event=>{setDropTarget(false);if(canAssign&&event.dataTransfer.getData('text/refresh-job')==='cursor'){event.preventDefault();if(!assigned)runtime.actDesktop({type:'job-assign',app:jobApp!});}}} onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onDoubleClick={event=>{ if (!(event.target as HTMLElement).closest('button,.job-controls') && !preview) runtime.actDesktop({type:'maximize',app}); }}>
      <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette}/><span>{appName(snapshot.state,app,i18n)}{JOB_IDS.includes(app as JobId)&&hasUpgrade(snapshot.state,'jobs')?` 1.${d.jobs[app as JobId].updates}`:''}{d.stalled===app?i18n.t('desktop.stalled'):''}</span>
      {canAssign&&assigned&&<div className="job-control-anchor" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onJobMenu(null);jobButton.current?.focus();}}}>
        <button ref={jobButton} className="job-slot assigned" aria-label={i18n.t('jobs.slot',{app:appName(snapshot.state,app,i18n)})} aria-expanded={jobMenu===app} aria-haspopup="dialog" onClick={()=>onJobMenu(jobMenu===app?null:jobApp)}><CursorGlyph/></button>
        {jobMenu===app&&<JobControls {...props} app={jobApp!}/>}
      </div>}
      {hasDesktopSkill(snapshot.state,'virtual')&&<button className="workspace-move" aria-label={i18n.t('desktop.moveWorkspace')} title={i18n.t('desktop.moveWorkspace')} onClick={()=>runtime.actDesktop({type:'move-workspace',app})}><LineIcon kind="workspace"/></button>}
      {d.stalled===app&&<button className="win-button restart-button" title={i18n.t('desktop.restartReward',{count:BALANCE.w3.restartSeconds})} onClick={()=>runtime.actDesktop({type:'restart',app})}>{i18n.t('desktop.restart')}</button>}
      {isBuildable(app)&&!preview&&<button className="app-rebuild" title={i18n.t('builder.edit')} onClick={()=>{runtime.actDesktop({type:'app-edit',app});runtime.actDesktop({type:'open',app:'tessera'});}}>{i18n.t('builder.editShort')}</button>}
      <CommonWindowControls chrome={chrome} side="start" maximized={w.maximized} i18n={i18n} onAction={symbol=>runtime.actDesktop({type:symbol,app})}/>
      <CommonWindowControls chrome={chrome} side="end" maximized={w.maximized} i18n={i18n} onAction={symbol=>runtime.actDesktop({type:symbol,app})}/>
    </header>
    {app==='files'&&desktopStage(snapshot.state)===3&&<FilesRibbon {...props}/>}
    <div className={`window-content ${d.stalled===app?'is-stalled':''}`} inert={d.stalled===app||preview}>{isBuildable(app)?<AppSurface {...props} app={app}>{children}</AppSurface>:children}</div>
    {hasUpgrade(snapshot.state,'jobs')&&JOB_IDS.includes(app as JobId)&&<WorkingCursors {...props} app={app as JobId}/>}
    {!w.maximized && <button className="window-resize" aria-label={i18n.t('desktop.resize')} onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onKeyDown={e=>{ if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();runtime.actDesktop({type:'rect',app,rect:{...w,width:w.width+(e.key==='ArrowRight'?16:e.key==='ArrowLeft'?-16:0),height:w.height+(e.key==='ArrowDown'?16:e.key==='ArrowUp'?-16:0)}});runtime.persist();} }}><LineIcon kind="resize"/></button>}
  </section>;
}
function DesktopShortcut({app,frame,...props}: Props & {app:AppId;frame:number}) {
  const {snapshot,runtime,i18n,preview} = props, p=snapshot.state.run.desktop.icons[app];
  const drag=useRef<{x:number;y:number;scale:number;px:number;py:number; moved:boolean}|null>(null);
  const finish=()=>{if(drag.current){drag.current=null;runtime.persist();}};
  return <button className="desktop-shortcut" data-shortcut={app} style={{left:p.x,top:p.y,'--desktop-icon-size':`${hasUpgrade(snapshot.state,'iconSize')?snapshot.state.persistent.desktopPrefs.iconSize:desktopStage(snapshot.state)>=2?40:32}px`} as React.CSSProperties} onDragOver={e=>{if(app==='bin')e.preventDefault();}} onDrop={e=>{if(app==='bin'){e.preventDefault();runtime.actDesktop({type:'trash',id:e.dataTransfer.getData('text/refresh-file')});}}} onDoubleClick={()=>!preview&&runtime.actDesktop({type:'open',app})}
    onKeyDown={e=>{if(e.key==='Enter')runtime.actDesktop({type:'open',app});}}
    onPointerDown={e=>{if(preview||e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,scale:e.currentTarget.getBoundingClientRect().width/78,px:p.x,py:p.y,moved:false};}}
    onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.x)/d.scale,dy=(e.clientY-d.y)/d.scale;if(Math.hypot(dx,dy)<4&&!d.moved)return;d.moved=true;runtime.actDesktop({type:'icon',app,x:d.px+dx,y:d.py+dy});}}
    onPointerUp={finish} onLostPointerCapture={finish}>
    <AppIcon app={app} state={snapshot.state} palette={props.capture?.palette} frame={frame}/><span {...shellPartProps(snapshot.state,'foundation-icons')} title={appName(snapshot.state,app,i18n)}>{appName(snapshot.state,app,i18n)}</span>
  </button>;
}
function NoteApp({snapshot,runtime,i18n,preview}: Props) {
  if(snapshot.state.run.play.letterOpen)return <article className="secret-letter"><h2>{i18n.t('secret.mail.title')}</h2><p>{i18n.t('secret.mail.body')}</p><p>{i18n.t('guide.signature')}</p><button onClick={()=>runtime.common({type:'letter-close'})}>{i18n.t('secret.noteBack')}</button></article>;
  const text=snapshot.state.persistent.productionNote??defaultNote(i18n);
  return <div className="note-app"><textarea aria-label={i18n.t('note.text')} spellCheck={false} value={text} readOnly={preview} maxLength={BALANCE.w3.maxNote}
    onChange={e=>runtime.actDesktop({type:'note',text:e.target.value})} onBlur={runtime.persist}/>{snapshot.state.persistent.progress.noteOverflow&&<p className="secret-note-line">{i18n.t('secret.note')}</p>}
    <StatusBar fields={[{id:'characters',priority:0,text:i18n.t('note.characters',{count:[...text].length})}]}><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} includeTest={runtime.platform.launch.debug}/></StatusBar>
  </div>;
}
function MailApp(props: Props) {
 const {snapshot,runtime,i18n}=props,d=snapshot.state.run.desktop;
 const selected=d.feedback.find(f=>f.id===d.mailSelection),folders=hasAppPart(snapshot.state,'mail','folders')&&(hasUpgrade(snapshot.state,'folders')||hasDesktopSkill(snapshot.state,'sortMail'));
 const messages=[...d.feedback].filter(f=>!folders||d.mailFolder==='all'||(d.mailFolder==='pending'?f.completedAt===null:f.completedAt!==null)).reverse();
 const folderNav=folders?<nav className="mail-folders">{(['all','pending','completed'] as const).map(folder=><button className={d.mailFolder===folder?'selected':''} key={folder} onClick={()=>runtime.actDesktop({type:'mail-folder',folder})}>{i18n.t(folder==='all'?'mail.all':folder==='pending'?'mail.pendingFolder':'mail.completedFolder')}</button>)}</nav>:null;
 const reply=selected&&selected.completedAt===null&&hasUpgrade(snapshot.state,'draft')?<><div className="mail-draft"><b>{i18n.t('mail.draft')}</b><p>{i18n.t('mail.draftText')}</p></div><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:selected.id})}>{selected.kind==='color'?i18n.t('desktop.fix.editor',{app:editorName(snapshot.state,i18n)}):i18n.t(fixLabel(selected))}</button></>:null;
 return <div className="mail-app"><AppPart id="messages"><aside aria-label={i18n.t('mail.list')}><h2>{i18n.t('desktop.notifications')}</h2>{!d.projects.mail&&folderNav}
 {!messages.length&&<p>{i18n.t('mail.empty')}</p>}{messages.map(f=><button key={f.id} className={`${selected?.id===f.id?'selected':''} ${hasAppPart(snapshot.state,'mail','unread')&&f.readAt==null?'unread':''}`} onClick={()=>runtime.actDesktop({type:'mail',id:f.id})}><b>{i18n.t(`feedback.sender.${f.sender}`)}</b><span>{feedbackSubject(f,i18n)}</span><small>{f.completedAt===null?i18n.t('mail.pending'):i18n.t('mail.completed',{date:i18n.dateTime(f.completedAt)})}</small></button>)}</aside></AppPart>
 <AppPart id="body"><article>{selected?<><h1>{feedbackSubject(selected,i18n)}</h1><p className="mail-sender">{i18n.t('mail.from',{name:i18n.t(`feedback.sender.${selected.sender}`)})}</p><p className="mail-date">{i18n.t('mail.received',{date:i18n.dateTime(selected.at)})}</p><FeedbackBody {...props} feedback={selected}/>{!d.projects.mail&&reply}{selected.completedAt!==null&&<p className="mail-completed">{i18n.t('mail.completed',{date:i18n.dateTime(selected.completedAt)})}</p>}</>:<p className="mail-placeholder">{i18n.t('mail.choose')}</p>}</article></AppPart>
 {d.projects.mail&&<AppPart id="unread"><p>{i18n.t('mail.unreadCount',{count:messages.filter(message=>message.readAt==null).length})}</p></AppPart>}{d.projects.mail&&<AppPart id="folders">{folderNav}</AppPart>}{d.projects.mail&&<AppPart id="draft">{reply}</AppPart>}</div>;
}
export function ScreenshotPreview({shot,catalog, ...props}:Props & {shot:Screenshot;catalog:Screenshot[]}) {
  return <LegacyCapturePreview shot={shot} catalog={catalog} i18n={props.i18n}/>;
}
function FilesApp(props:Props) {
 const {runtime,snapshot}=props;
 return <DocumentFilesApp {...props} onBuildApp={app=>{runtime.actDesktop({type:'app-edit',app});runtime.actDesktop({type:'open',app:'tessera'});}} onEditDocument={document=>{
  const editing=snapshot.state.run.desktop.editingApp;
  if(editing)runtime.actDesktop({type:'app-close',app:editing});
  runtime.actDesktop({type:'open',app:'tessera'});
  const part=Object.keys(document.parts)[0] as import('../content/workshopCatalog').WorkshopPartId|undefined;
  if(part)runtime.actWorkshop({type:'selectPart',part});
  runtime.actWorkshop({type:'view',view:'workbench'});
 }}/>;
}
export function BuiltAppContent({app,...props}:Props&{app:BuiltApp}) {return app==='files'?<FilesApp {...props}/>:app==='mail'?<MailApp {...props}/>:<ExtraApp {...props} app={app}/>;}
function DesktopScene(props: Props): React.ReactElement {
  const {runtime,snapshot,i18n,preview=false}=props;
  const {state}=snapshot,d=state.run.desktop,prefs=state.persistent.desktopPrefs,legacy=!!props.capture&&props.capture.version<3,era=desktopStage(state);
  const [jobMenu,setJobMenu]=useState<JobId|null>(null),[assignments,setAssignments]=useState(false);
  const assignmentMenu=useRef<HTMLElement>(null),jobSource=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(assignments)assignmentMenu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[assignments]);
  const [upgrades,setUpgrades]=useState(false),[conditions,setConditions]=useState(false),[notifications,setNotifications]=useState(false),[flash,setFlash]=useState(false),[frame]=useState(0);
  useEffect(()=>{if(!flash)return;const stop=runtime.platform.every(180,()=>{setFlash(false);stop();});return stop;},[flash,runtime]);
  const apps=installedApps(state),checks=props.capture?.display.checks??desktopConditions(state),next=nextDesktopApp(state),following=followingDesktopApp(state),pending=d.feedback.filter(f=>f.completedAt===null);
  const notification=d.feedback.find(f=>f.id===d.notice),success=d.feedback.find(f=>f.id===d.success);
  const cooldown=props.capture?.display.cooldown??screenshotCooldown(state);
  const toolbar=useRef<HTMLDivElement>(null),shotToggle=useRef<HTMLButtonElement>(null),toolbarId=useId();
  const [shotOpen,setShotOpen]=useState(false);
  const [shotHint,setShotHint]=useState(false);
  useEffect(()=>{if(preview||!snapshot.shotHintSerial)return;setShotHint(true);shotToggle.current?.focus();const stop=runtime.platform.every(4000,()=>{setShotHint(false);stop();});return stop;},[snapshot.shotHintSerial,preview,runtime]);
  const taskbar=useRef<HTMLElement>(null),taskbarApps=useRef<HTMLDivElement>(null);
  // Reveal only inside the taskbar's local scroller; never scroll the scaled desktop or the page.
  const revealTaskbarApp=(node:HTMLElement)=>{
    const host=taskbarApps.current;if(!host||!host.contains(node))return;
    const a=host.getBoundingClientRect(),b=node.getBoundingClientRect(),scale=a.width/host.offsetWidth||1;
    const left=(b.left-a.left)/scale-host.clientLeft,right=(b.right-a.left)/scale-host.clientLeft;
    if(left<0)host.scrollLeft+=left;else if(right>host.clientWidth)host.scrollLeft+=right-host.clientWidth;
  };
  useLayoutEffect(()=>{
    const host=taskbarApps.current;if(preview||!host)return;
    const reveal=()=>{const focused=host.contains(host.ownerDocument.activeElement)?host.ownerDocument.activeElement as HTMLElement:null;const active=host.querySelector<HTMLElement>('button.active');if(focused||active)revealTaskbarApp((focused||active)!);};
    const wheel=(event:WheelEvent)=>{
      if(host.scrollWidth<=host.clientWidth||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
      const unit=event.deltaMode===WheelEvent.DOM_DELTA_LINE?host.clientHeight:event.deltaMode===WheelEvent.DOM_DELTA_PAGE?host.clientWidth:1,before=host.scrollLeft;
      host.scrollLeft+=event.deltaY*unit;if(host.scrollLeft!==before){event.preventDefault();event.stopPropagation();}
    };
    const observer=new ResizeObserver(reveal);observer.observe(host);host.addEventListener('wheel',wheel,{passive:false});reveal();
    return()=>{observer.disconnect();host.removeEventListener('wheel',wheel);};
  },[preview,d.active,d.screen.width,apps.length,state.persistent.examplesEnabled]);
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
  const choseWallpaper=prefs.wallpaper!==null;
  const wallpaper=!legacy&&!choseWallpaper?null:prefs.slideshow?{source:Math.floor(wallTime/BALANCE.w3.slideshowMs)%2?'night':'coast',brightness:1,tone:0,crop:0}:hasDesktopSkill(state,'daylight')?{source:hour<daylight.morningHour||hour>=daylight.nightHour?'night':'coast',brightness:hour>=daylight.morningHour&&hour<daylight.dayHour?daylight.morningBrightness:1,tone:hour>=daylight.dayHour&&hour<daylight.nightHour?daylight.dayTone:0,crop:0}:prefs.wallpaper;
  const saver=!preview&&hasDesktopSkill(state,'screensaver')&&d.idleMs>=BALANCE.w3.screensaverMs&&activeScreenshots(state).length>0;
  const saverShots=activeScreenshots(state),saverShot=saver?saverShots[Math.floor(d.idleMs/BALANCE.w3.screensaverFrameMs)%saverShots.length]:null;
  const upgradeApp=(id:DesktopUpgrade):AppId=>FEATURE_APPS[id as keyof typeof FEATURE_APPS]??(id==='jobs'?'tessera':id as AppId);
  const offerTitle=(offer:DesktopOffer)=>offer.kind==='set'?i18n.t('desktop.offerSet',{app:i18n.t(`desktop.app.${offer.id}`)}):i18n.t(`desktop.app.${offer.id}`);
  const offerAction=(offer:DesktopOffer)=>offer.kind==='craft'?i18n.t('desktop.offerCraft'):offer.kind==='assemble'?i18n.t('desktop.offerAssemble'):i18n.t('desktop.build',{cost:i18n.price(offer.cost)});
  const upgradeEffect=(offer:DesktopOffer)=>offer.id==='jobs'?i18n.t('jobs.capacity',{used:0,capacity:jobCapacity(state)}):i18n.t('desktop.offerMaterials',{count:partsForSet(offer.id).length});
  const noticeHost=useRef<HTMLElement>(null);
  useCaptureGeometry(noticeHost,state);
  useLayoutEffect(()=>{
    const root=noticeHost.current,aux=root?.querySelector<HTMLElement>(':scope>.desktop-aux-notices');
    if(!root||!aux)return;
    const toasts=[...root.querySelectorAll<HTMLElement>(':scope>.feedback-toast')];
    const fit=()=>{
      if(era===3){const top=Math.max(12,...toasts.map(node=>node.offsetTop+node.offsetHeight+12));aux.style.insetBlockStart=`${top}px`;aux.style.insetBlockEnd='auto';aux.style.maxBlockSize=`${Math.max(80,d.screen.height-taskbarHeight(d.screen)-top-12)}px`;}
      else{const bottom=Math.max(taskbarHeight(d.screen)+16,...toasts.map(node=>d.screen.height-node.offsetTop+12));aux.style.insetBlockEnd=`${bottom}px`;aux.style.insetBlockStart='auto';aux.style.maxBlockSize=`${Math.max(80,d.screen.height-bottom-12)}px`;}
    };
    fit();const observer=new ResizeObserver(fit);for(const node of toasts)observer.observe(node);return()=>observer.disconnect();
  },[snapshot.offline,state.run.advice.current,state.run.play.achievement?.id,notification?.id,success?.id,era,d.screen.height,i18n.language]);
  const compactResources=d.screen.width<=1024;
  const releaseControl:ReactNode=<button className="taskbar-progress" aria-label={i18n.t(props.capture&&props.capture.version<9?'desktop.progress':'release.progress',{product:productLabel(i18n,state.persistent.productName),done:checks.filter(Boolean).length,total:checks.length})} title={i18n.t(props.capture&&props.capture.version<9?'desktop.progress':'release.progress',{product:productLabel(i18n,state.persistent.productName),done:checks.filter(Boolean).length,total:checks.length})} aria-expanded={conditions} onClick={()=>{setConditions(!conditions);setUpgrades(false);}}>{props.capture&&props.capture.version<9?<span className="era-progress" aria-hidden="true">{checks.map((done,index)=><i key={index} className={done?'done':''}/>)}</span>:<ReleaseProgress done={checks.filter(Boolean).length} total={checks.length}/>}{(!props.capture||props.capture.version>=9)&&<span className="release-progress-count">{i18n.t('release.conditionsDone',{done:checks.filter(Boolean).length,total:checks.length})}</span>}<span className="progress-caption">{i18n.t(props.capture&&props.capture.version<9?'desktop.progress':'release.progress',{product:productLabel(i18n,state.persistent.productName),done:checks.filter(Boolean).length,total:checks.length})}</span></button>;
  const resourceControls:ReactNode=<div className="desktop-resources" {...shellPartProps(state,'foundation-taskbar')}>{(era!==2||props.capture&&props.capture.version<9)&&releaseControl}
        <button className="taskbar-pixels" title={i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})} aria-expanded={upgrades} onClick={()=>{setUpgrades(!upgrades);setConditions(false);}}><i className="pixel-resource"/><span><b data-desktop-pixels={state.resources.pixels}>{compactResources?i18n.pixels(state.resources.pixels):i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})}</b><small>{i18n.t(compactResources?'desktop.rateCompact':'desktop.rate',{pixels:i18n.rate(props.capture?.display.rate??passivePixelsPerSecond(state))})}</small></span></button>
        <button className="taskbar-tokens" aria-label={i18n.t('desktop.app.settings')} onClick={()=>runtime.actDesktop({type:'open',app:'settings'})}><i className="token-resource"/>{compactResources?i18n.integer(state.resources.tokens):i18n.t('desktop.tokens',{count:state.resources.tokens})}</button></div>;
  return <main ref={noticeHost} {...shellPartProps(state,'foundation-desktop',{'--desktop-width':`${d.screen.width}px`,'--desktop-height':`${d.screen.height}px`,'--desktop-taskbar':`${taskbarHeight(d.screen)}px`,'--desktop-accent':prefs.accent,'--window-radius':`${legacy||prefs.radiusCustom?prefs.radius:era===0||era===3?0:era===1?8:7}px`} as React.CSSProperties)} onPointerDownCapture={event=>{if(shotOpen&&!(event.target as HTMLElement).closest('.screenshot-toolbar,.screenshot-toggle'))setShotOpen(false);}} onKeyDownCapture={event=>{if(shotOpen&&event.key==='Escape'){event.preventDefault();setShotOpen(false);shotToggle.current?.focus();}if(saver){event.preventDefault();event.stopPropagation();runtime.desktopActivity();}}} onPointerMove={()=>!preview&&runtime.desktopActivity()} onKeyDown={()=>!preview&&runtime.desktopActivity()} onPointerDown={event=>{if(!preview)runtime.desktopActivity();if(saver){event.preventDefault();return;}const target=event.target as HTMLElement;if(!target.closest('.job-control-anchor'))setJobMenu(null);if(!target.closest('.job-assignment-menu,.taskbar-job-source'))setAssignments(false);if(!target.closest('.desktop-upgrades,.taskbar-pixels'))setUpgrades(false);if(!target.closest('.desktop-conditions,.taskbar-progress'))setConditions(false);if(!target.closest('.notification-center,.notification-button'))setNotifications(false);}} className={`desktop ${!legacy?`desktop-era-${era}`:''} ${updating?'desktop-updating':''} ${prefs.mode==='dark'?'desktop-dark':''} ${state.persistent.progress.cosmetic==='no-color'?'contract-amber':''} ${entered?'desktop-entering':''} ${preview?'desktop-frozen':'desktop-live'}`}>
    {legacy&&<div className="desktop-wallpaper-surface" {...shellPartProps(state,'foundation-wallpaper')}><PhotoSurface specs={state.persistent.specs} className="desktop-wallpaper-surface"><img className="desktop-wallpaper" src={coast} alt="" draggable={false}/></PhotoSurface></div>}
    {wallpaper&&<div className="desktop-wallpaper-surface" {...shellPartProps(state,'foundation-wallpaper')}><Photograph {...props} edit={wallpaper} wallpaper/></div>}

    {state.persistent.progress.cosmetic==='no-cursors'&&<div className="contract-wallpaper"/>}
    {!legacy&&era===2&&resourceControls}
    {state.persistent.progress.secretPart&&<button className="desktop-shortcut secret-icon" style={{right:8,top:80}} data-secret-icon onDoubleClick={()=>runtime.common({type:'letter-open'})}><ProductGlyph/><span>{i18n.t('secret.icon')}</span></button>}
    {apps.filter(app=>app!=='settings').map(app=><DesktopShortcut key={app} {...props} app={app} frame={frame}/>)}
    {apps.filter(app=>d.windows[app].open&&(!hasDesktopSkill(state,'virtual')||d.workspaces[app]===d.workspace)).map(app=><DesktopWindow key={app} {...props} app={app} jobMenu={jobMenu} onJobMenu={setJobMenu}>
      {app==='tessera'?(d.editingApp&&d.projects[d.editingApp]?<AppBuilder {...props} app={d.editingApp}/>:<Workshop runtime={runtime} snapshot={snapshot} i18n={i18n} embedded onAssembleApp={app=>{runtime.actDesktop({type:'app-edit',app});runtime.actDesktop({type:'open',app:'tessera'});}}/>):app==='note'?<NoteApp {...props}/>:app==='files'?<FilesApp {...props}/>:app==='mail'?<MailApp {...props}/>:<ExtraApp {...props} app={app}/>}
    </DesktopWindow>)}
    <button ref={shotToggle} className={`screenshot-toggle ${shotHint?'shot-hint':''}`} aria-label={i18n.t('desktop.shot')} aria-expanded={shotOpen} aria-controls={toolbarId} onClick={()=>setShotOpen(!shotOpen)}/>
    <div id={toolbarId} ref={toolbar} hidden={!shotOpen} role="region" aria-label={i18n.t('desktop.shot')} className={`screenshot-toolbar ${shotHint?'shot-hint':''}`}><LineIcon kind="capture"/><strong>{i18n.t('desktop.shot')}</strong><span>{i18n.t('desktop.parts',{count:props.capture?.display.parts??screenshotParts(state)})}</span><span>{i18n.t('desktop.reward',{pixels:i18n.pixels(props.capture?.display.reward??screenshotReward(state))})}</span>
      <button className="win-button accent capture-button" disabled={d.cooldownMs>0} onClick={()=>{const geometry=noticeHost.current?collectCaptureGeometry(noticeHost.current,state):undefined;setShotOpen(false);if(runtime.takeScreenshot(geometry))setFlash(true);}} title={i18n.t('desktop.capture')}>
        {d.cooldownMs>0?<><svg viewBox="0 0 24 24" className="cooldown-ring" aria-hidden="true"><circle cx="12" cy="12" r="9" pathLength="1" strokeDasharray={`${d.cooldownMs/cooldown} 1`}/></svg>{i18n.t('desktop.wait',{count:Math.ceil(d.cooldownMs/1000)})}</>:i18n.t('desktop.capture')}
      </button>
    </div>
    {(notification||success)&&<aside {...shellPartProps(state,'foundation-notification')} className={`feedback-toast ${success?'is-success':''}`} aria-live={preview?'off':'polite'}>
      <header><AppIcon app="mail" state={state} palette={props.capture?.palette}/><b>{i18n.t(success?'desktop.thanks':'desktop.notifications')}</b><button className="nav-button" aria-label={i18n.t('desktop.close')} onClick={()=>runtime.actDesktop(success?{type:'success-close'}:{type:'notice',id:null})}><LineIcon kind="close"/></button></header>
      {success?<p>{i18n.t('desktop.tokenReward',{count:success.reward??BALANCE.w3.feedbackTokens})}</p>:notification&&<><b className="toast-sender">{i18n.t(`feedback.sender.${notification.sender}`)}</b><FeedbackBody {...props} feedback={notification}/><div className="toast-actions"><button className="win-button accent" onClick={()=>runtime.actDesktop({type:'fix',id:notification.id})}>{notification.kind==='color'?i18n.t('desktop.fix.editor',{app:editorName(state,i18n)}):i18n.t(fixLabel(notification))}</button><button className="win-button" onClick={()=>runtime.actDesktop({type:'notice',id:null})}>{i18n.t('desktop.later')}</button></div></>}
    </aside>}
    {state.run.play.achievement&&<aside {...shellPartProps(state,'foundation-notification')} className={`feedback-toast achievement-toast ${notification||success?'beside-feedback':''}`} role="status"><header><AppIcon app="note" state={state}/><b>{i18n.t('settings.records')}</b><button aria-label={i18n.t('desktop.close')} onClick={runtime.dismissAchievement}><LineIcon kind="close"/></button></header><p>{i18n.t('achievement.notice',{name:i18n.t(`achievement.${state.run.play.achievement.id}`)})}</p></aside>}
    {notifications&&<section className="notification-center" {...shellPartProps(state,'foundation-notification')}><AdviceHistory memory={state.run.advice} i18n={i18n} app={editorName(state,i18n)} onRead={runtime.readAdvice}/><h2>{i18n.t('desktop.pending',{count:pending.length})}</h2>{pending.length?pending.map(f=><button key={f.id} className="win-button" onClick={()=>{runtime.actDesktop({type:'notice',id:f.id});setNotifications(false);}}>{feedbackSubject(f,i18n)}</button>):<p>{i18n.t('desktop.noPending')}</p>}</section>}
    {!preview&&snapshot.releaseConfirmation&&<ReleaseConfirmation runtime={runtime} snapshot={snapshot} i18n={i18n}/>}
    {conditions&&<section className="desktop-conditions">{!legacy&&<nav className="desktop-programs">{apps.map(app=><button key={app} data-app-launcher={app} onClick={()=>{runtime.actDesktop({type:'open',app});setConditions(false);}}><AppIcon app={app} state={state}/><span>{appName(state,app,i18n)}</span></button>)}</nav>}<h2>{i18n.t('k.conditions')}</h2>{(['apps','requests','sets','wallpaper','automation'] as const).map((id,index)=><label key={id}><input type="checkbox" readOnly checked={checks[index]}/>{id==='sets'?i18n.t('release.condition.sets'):i18n.t(`seed.condition.${id}`)}</label>)}{!preview&&canRelease(state)&&<button className="desktop-release-action win-button accent" onClick={runtime.requestPrototypeRelease}>{i18n.t('release.action')}</button>}{missingConditionParts(state,checks).map(({app,part})=><div className="condition-app-part" data-condition-app={app} key={app+part}><p>{i18n.t('builder.missing',{part:partLabel(part,i18n)})}</p><button onClick={()=>{runtime.actDesktop({type:'app-edit',app});runtime.actDesktop({type:'open',app:'tessera'});setConditions(false);}}>{i18n.t('builder.title',{app:i18n.t(`desktop.app.${app}`)})}</button></div>)}</section>}
    {upgrades&&<section className="desktop-upgrades" {...shellPartProps(state,'foundation-upgrades')}><h2>{i18n.t('desktop.upgrades')}</h2>{d.upgrades.slice(-4).map(id=><div className="upgrade-owned" key={id}><AppIcon app={upgradeApp(id)} state={state} palette={props.capture?.palette}/><span>{appName(state,id as AppId,i18n)}</span><small>{i18n.t('desktop.owned')}</small></div>)}
      {next&&<div className="upgrade-current" data-desktop-offer={next.id} data-offer-kind={next.kind}><AppIcon app={upgradeApp(next.id)} state={state} palette={props.capture?.palette}/><div><strong>{offerTitle(next)}<small className="purchase-effect">{upgradeEffect(next)}</small></strong><button className="win-button accent" disabled={state.resources.pixels<next.cost} onClick={()=>{runtime.actDesktop({type:'buy',app:next.id});setUpgrades(false);}}>{offerAction(next)}</button>{next.cost>0&&<Estimate cost={next.cost} pixels={state.resources.pixels} rate={passivePixelsPerSecond(state)} i18n={i18n} runtime={runtime} preview={preview}/>}</div></div>}
      {following&&<div className="upgrade-next"><span>{i18n.t('desktop.next')}</span><strong>{offerTitle(following)}</strong><small className="purchase-effect">{upgradeEffect(following)}</small><small>{offerAction(following)}</small></div>}
      {(!next||state.run.version==='v2'||d.apps.includes('terminal'))&&<World4Preparation state={state} i18n={i18n} dispatch={runtime.actWorkshop} onOpenWorkshop={()=>{const editing=snapshot.state.run.desktop.editingApp;if(editing)runtime.actDesktop({type:'app-close',app:editing});runtime.actDesktop({type:'open',app:'tessera'});setUpgrades(false);}}/>}

    </section>}
    {assignments&&<section ref={assignmentMenu} className="job-assignment-menu" role="menu" aria-label={i18n.t('jobs.assignmentMenu')} onKeyDown={event=>{
      if(event.key==='Escape'){setAssignments(false);jobSource.current?.focus();event.preventDefault();}
      if(['ArrowDown','ArrowUp'].includes(event.key)){const buttons=Array.from(assignmentMenu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),at=buttons.indexOf(event.target as HTMLButtonElement);buttons[(at+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();event.preventDefault();}
    }}><header>{i18n.t('jobs.assignmentMenu')}<small>{i18n.t('jobs.capacity',{used:JOB_IDS.filter(id=>d.jobs[id].assigned).length,capacity:jobCapacity(state)})}</small></header>
      {JOB_IDS.filter(id=>id==='tessera'||d.apps.includes(id)).map(app=><button key={app} role="menuitemcheckbox" aria-checked={d.jobs[app].assigned} disabled={!d.jobs[app].assigned&&JOB_IDS.filter(id=>d.jobs[id].assigned).length>=jobCapacity(state)} onClick={()=>{runtime.actDesktop({type:'job-assign',app});if(!d.jobs[app].assigned)runtime.actDesktop({type:'open',app});setAssignments(false);jobSource.current?.focus();}}><AppIcon app={app} state={state}/><span>{appName(snapshot.state,app,i18n)}</span><small>{i18n.t(d.jobs[app].assigned?'jobs.remove':'jobs.assign')}</small></button>)}
    </section>}
    <footer ref={taskbar} className="desktop-taskbar" {...shellPartProps(state,'foundation-taskbar')}>{!legacy&&<button className="taskbar-product" aria-label={i18n.t('appearance.productMenu')} title={productLabel(i18n,state.persistent.productName)} aria-expanded={conditions} onClick={()=>setConditions(!conditions)}><ProductGlyph/><span>{productLabel(i18n,state.persistent.productName)}</span></button>}{hasUpgrade(state,'jobs')&&<button ref={jobSource} className="taskbar-job-source" aria-label={i18n.t('jobs.drag')} aria-expanded={assignments} aria-haspopup="menu" draggable title={i18n.t('jobs.drag')} onDragStart={e=>{setAssignments(false);e.dataTransfer.setData('text/refresh-job','cursor');}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setAssignments(true);}}} onClick={()=>setAssignments(!assignments)}><CursorGlyph/><span>{i18n.t('jobs.cursor')}<small>{i18n.t('jobs.capacity',{used:JOB_IDS.filter(id=>d.jobs[id].assigned).length,capacity:jobCapacity(state)})}</small></span></button>}
      {hasDesktopSkill(state,'virtual')&&<nav className="taskbar-workspaces">{([0,1] as const).map(workspace=><button key={workspace} aria-label={i18n.t('desktop.workspace',{count:workspace+1})} aria-pressed={d.workspace===workspace} onClick={()=>runtime.actDesktop({type:'workspace',workspace})}>{i18n.integer(workspace+1)}</button>)}</nav>}{!preview&&!legacy&&<DesktopNextHand state={state} runtime={runtime} i18n={i18n} onOffer={()=>{setUpgrades(true);setConditions(false);}} onConditions={()=>{setConditions(true);setUpgrades(false);}}/>}<div ref={taskbarApps} className="taskbar-apps" style={!preview?{'--example-taskbar-glass-app-width':`${BALANCE.examples.desktopTaskbarGlassAppWidth}px`,'--example-taskbar-flat-app-min':`${BALANCE.examples.desktopTaskbarFlatAppMinWidth}px`} as React.CSSProperties:undefined} onFocusCapture={event=>{if(!preview){const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(target)revealTaskbarApp(target);}}}>{apps.filter(app=>legacy?!['note','settings'].includes(app)||d.windows[app].open:era===2?app!=='note'||d.windows[app].open:d.windows[app].open).map(app=><button key={app} aria-label={appName(snapshot.state,app,i18n)} title={appName(snapshot.state,app,i18n)} className={`${d.windows[app].open?'running':''} ${d.active===app&&!d.windows[app].minimized?'active':''}`} onClick={()=>runtime.actDesktop({type:'taskbar',app})}><AppIcon app={app} state={state} palette={props.capture?.palette} frame={frame}/><span className="taskbar-app-name">{appName(state,app,i18n,legacy)}</span></button>)}</div>
      <div className="taskbar-right">{(legacy||era!==2)&&resourceControls}{!legacy&&era===2&&(!props.capture||props.capture.version>=9)&&releaseControl}
        {!legacy&&era===2&&<button className="taskbar-pixels taskbar-balance" title={i18n.t('desktop.pixels',{pixels:i18n.pixels(state.resources.pixels)})} aria-expanded={upgrades} onClick={()=>{setUpgrades(!upgrades);setConditions(false);}}><i className="pixel-resource"/><span><b data-taskbar-pixels={state.resources.pixels}>{i18n.pixels(state.resources.pixels)}</b><small>{i18n.t('desktop.rateCompact',{pixels:i18n.rate(props.capture?.display.rate??passivePixelsPerSecond(state))})}</small></span></button>}
        {hasAppPart(state,'clock','time')&&<button className="taskbar-clock" onClick={()=>runtime.common({type:'clock-click'})}><span>{i18n.time(wallTime)}</span><span>{i18n.date(wallTime)}</span></button>}
        {d.feedback.length>0&&<button className="notification-button" aria-label={i18n.t('desktop.notifications')} aria-expanded={notifications} onClick={()=>setNotifications(!notifications)}><LineIcon kind="bell"/>{pending.length>0&&<small>{i18n.integer(pending.length)}</small>}</button>}
      </div>
    </footer>
    {!preview&&(snapshot.offline||state.run.advice.current)&&<aside className="desktop-aux-notices">
      {snapshot.offline&&<section className="offline-notification" role="status"><h2>{i18n.t('desktop.notifications')}</h2><p>{i18n.t('offline.notice',{duration:i18n.duration(snapshot.offline.creditedMs),pixels:i18n.pixels(snapshot.offline.pixels),count:Math.floor(snapshot.offline.pixels)})}</p><button onClick={runtime.dismissOffline}>{i18n.t('guide.close')}</button></section>}
      {state.run.advice.current&&<section className="advice-notification"><h2>{i18n.t('guide.signature')}</h2><AdviceMessage memory={state.run.advice} i18n={i18n} app={editorName(state,i18n)} onRead={runtime.readAdvice}/></section>}
    </aside>}
    {saverShot&&<div className="desktop-screensaver"><ScreenshotPreview {...props} shot={saverShot} catalog={state.persistent.screenshots}/><span>{i18n.t('desktop.screensaver')}</span></div>}
    {appearanceMessage&&!preview&&<aside className="appearance-guide" role="status"><p>{i18n.t(backwards?'appearance.guide.previous':era===3?'appearance.guide.desktop3':era===2?'appearance.guide.desktop2':'appearance.guide.desktop1')}</p><small>{i18n.t('guide.signature')}</small><button onClick={()=>setAppearanceMessage(false)}>{i18n.t('guide.close')}</button></aside>}
    {flash&&!runtime.platform.animation.reducedMotion()&&<div className="screenshot-flash"/>}
  </main>;
}
export function Desktop(props: Props) { return <DesktopScene {...props}/>; }
