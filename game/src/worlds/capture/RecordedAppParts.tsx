import type { CSSProperties, ReactNode } from 'react';
import type { I18n, MessageKey } from '../../content/i18n';
import { WORKSHOP_PARTS, type WorkshopPartId } from '../../content/workshopCatalog';
import { BALANCE, type SpecKey } from '../../config/balance';
import type { CaptureScene, FrozenFile } from '../../systems/captureScene';
import type { BuiltApp } from '../../systems/desktopState';
import { partVisual } from '../workshop/partVisual';
import { LineIcon } from '../desktop-icons';
import { commonDesignStyle } from '../AppComposition';
import { usesNativeComponentColors } from '../../systems/workshopState';

export interface RecordedAppPartsProps {
 app:BuiltApp;scene:CaptureScene;i18n:I18n;
 photograph:ReactNode;document:ReactNode;selectedShot:ReactNode;
}
/** Frozen native slots. Nothing is installed, recomputed, paid, or restored into a GameState. */
export function RecordedAppParts({app,scene,i18n,photograph,document,selectedShot}:RecordedAppPartsProps) {
 const t=i18n.t,client=scene.evaluation?.windowClients[app],project=scene.appProjects?.[app],assembly=project?.installedAssembly;
 if(!client)return null;
 const placements=scene.evaluation?.placements.filter(item=>item.app===app&&!item.role.startsWith('chrome:'))??[];
 const view=scene.view.desktop,files=scene.files,selected=files.find(file=>file.id===scene.desktop.fileSelection),message=scene.desktop.feedback.find(row=>row.id===scene.desktop.mailSelection);
 const button=(text:string)=><button type="button" tabIndex={-1} className="win-button recorded-native-button">{text}</button>;
 const label=(file:FrozenFile)=>file.kind==='set'&&file.edition?t(file.edition==='archive'?'files.oldVersion':'files.currentVersion'):t(`files.type.${file.kind}` as MessageKey);
 const list=<table className="recorded-native-table"><thead><tr><th>{t('files.name')}</th><th>{t('files.modified')}</th><th>{t('files.type')}</th></tr></thead><tbody>{files.map(file=><tr key={file.id}><td>{file.name}</td><td>{file.at===null?t('files.unknownDate'):i18n.dateTime(file.at)}</td><td>{label(file)}</td></tr>)}</tbody></table>;
 const messages=<div className="recorded-native-messages">{scene.desktop.feedback.map(row=><div key={row.id} className={row.readAt===null?'recorded-unread':''}><b>{t(`feedback.sender.${row.sender}`)}</b><span>{row.subject??t('mail.pending')}</span><small>{row.completedAt===null?t('mail.pending'):t('mail.completed',{date:i18n.dateTime(row.completedAt)})}</small></div>)}</div>;
 const performance=<table className="recorded-native-table"><tbody>{(Object.keys(scene.display.specs) as SpecKey[]).map(key=><tr key={key}><th>{t(`spec.${key}`)}</th><td>{i18n.spec(key,scene.display.specs[key])}</td></tr>)}</tbody></table>;
 const ledger=scene.production??[],total=ledger.reduce((sum,row)=>sum+row.perSecond,0);
 const processes=<table className="recorded-native-table"><thead><tr><th>{t('manager.name')}</th><th>{t('manager.rate')}</th><th>{t('manager.share')}</th></tr></thead><tbody>{ledger.map(row=><tr key={row.id} data-recorded-producer={row.id}><td>{row.name}</td><td>{i18n.rate(row.perSecond)}</td><td>{t('number.percent',{value:i18n.number(total?row.perSecond/total*BALANCE.workshop.preview.percentDivisor:0)})}</td></tr>)}</tbody></table>;
 const contents=(role:string):ReactNode=>{
  if(app==='files')switch(role){
   case 'navigation':return <div className="recorded-native-navigation"><LineIcon kind="back"/><LineIcon kind="forward"/><LineIcon kind="up"/>{button(t(scene.desktop.fileFolder==='exports'?'files.sets':`files.${scene.desktop.fileFolder}`))}</div>;
   case 'places':return <div className="recorded-native-places">{(['root','sets','screenshots'] as const).map(folder=><span key={folder}>{t(`files.${folder}`)}</span>)}</div>;
   case 'list':return selected?<div className="recorded-selected-document"><h3>{selected.name}</h3>{selected.kind==='set'?document:selected.kind==='shot'?selectedShot:null}</div>:list;
   case 'status':return <span>{t('files.items',{count:scene.display.fileCount})}</span>;
   case 'sort':return button(t(`files.sort.${String(view.fileSort??'name')}` as MessageKey));
   case 'search':return <span className="recorded-native-input">{String(view.fileSearch??'')||t('files.search')}</span>;
   case 'large':return button(t(view.largeIcons?'files.details':'files.large'));
  }
  if(app==='mail')switch(role){
   case 'messages':return messages;
   case 'body':return message?<article><h3>{message.subject}</h3><p>{message.body}</p>{message.completedAt!==null&&<p>{t('mail.completed',{date:i18n.dateTime(message.completedAt)})}</p>}</article>:<p>{t('mail.choose')}</p>;
   case 'draft':return message&&message.completedAt===null?<div><b>{t('mail.draft')}</b><p>{t('mail.draftText')}</p></div>:null;
   case 'folders':return <>{button(t('mail.all'))}{button(t('mail.pendingFolder'))}{button(t('mail.completedFolder'))}</>;
   case 'unread':return <span>{t('mail.unreadCount',{count:scene.desktop.feedback.filter(row=>row.readAt===null).length})}</span>;
  }
  if(app==='photo')switch(role){
   case 'source':return button(t(scene.view.photo.source==='night'?'photo.night':scene.view.photo.source==='coast'?'photo.coast':'files.screenshots'));
   case 'image':return photograph;
   case 'brightness':case 'tone':return <label>{t(role==='brightness'?'photo.brightness':'photo.tone')}<input type="range" tabIndex={-1} readOnly min={role==='brightness'?BALANCE.capture.photoControls.brightnessMin:BALANCE.capture.photoControls.toneMin} max={role==='brightness'?BALANCE.capture.photoControls.brightnessMax:BALANCE.capture.photoControls.toneMax} value={role==='brightness'?scene.view.photo.brightness:scene.view.photo.tone}/></label>;
   case 'wallpaper':return button(t('photo.wallpaper'));
   case 'crop':return <label>{t('photo.crop')}<output>{i18n.number(scene.view.photo.crop)}</output></label>;
   case 'compare':return button(t('photo.compare'));
  }
  if(app==='clock')switch(role){
   case 'time':return <time>{i18n.time(scene.display.wallTime)}<small>{i18n.date(scene.display.wallTime)}</small></time>;
   case 'calendar':return <time>{i18n.month(typeof view.calendarMonth==='number'?view.calendarMonth:scene.display.wallTime)}</time>;
   case 'timer':return button(t('clock.reserve'));
  }
  if(app==='bin')switch(role){
   case 'trash':return <ul>{(Array.isArray(view.trash)?view.trash:[]).map((row,index)=><li key={index}>{typeof row==='object'&&row!==null&&'id'in row?files.find(file=>file.id===row.id)?.name??String(row.id):null}</li>)}</ul>;
   case 'empty':return button(t('bin.empty'));
   case 'undo':return button(t('bin.restore'));
  }
  if(app==='theme')switch(role){
   case 'appearance':return <>{button(t('theme.light'))}{button(t('theme.dark'))}</>;
   case 'accent':return <span className="recorded-native-swatch" style={{background:scene.view.preferences.accent}}/>;
   case 'radius':return <output>{i18n.number(scene.view.preferences.radius)}</output>;
   case 'slideshow':return <span>{t('theme.slideshow')}</span>;
   case 'iconSize':return <output>{i18n.number(scene.view.preferences.iconSize)}</output>;
  }
  if(app==='terminal'){
   const terminal=typeof view.terminal==='object'&&view.terminal!==null?view.terminal as Record<string,unknown>:{};
   switch(role){
    case 'commands':return <span>{t('terminal.capture')}</span>;
    case 'output':case 'history':return <div>{(Array.isArray(terminal.log)?terminal.log:[]).map((entry,index)=><p key={index}>{typeof entry==='object'&&entry!==null&&'at'in entry?i18n.time(Number(entry.at)):null}</p>)}</div>;
    case 'run':return button(t(terminal.running?'terminal.stop':'terminal.run'));
    case 'interval':return <output>{i18n.duration(typeof terminal.interval==='number'?terminal.interval:0)}</output>;
   }
  }
  if(app==='manager')switch(role){
   case 'tabs':return <>{button(t('manager.processes'))}{button(t('manager.performance'))}</>;
   case 'processes':return view.managerTab==='performance'?null:processes;
   case 'performance':return view.managerTab==='performance'?performance:null;
  }
  return null;
 };
 return <div className="app-layout recorded-native-app" data-recorded-app={app} data-common-control-radius={assembly?.common.some(part=>part.source==='common-button'&&part.design.radius!==BALANCE.workshop.design.radius)||undefined} data-common-scroll-custom={assembly?.common.some(part=>part.source==='common-scrollbar'&&(!usesNativeComponentColors(part.design)||part.design.scrollbarWidth!==BALANCE.workshop.design.scrollbarWidth||part.design.radius!==BALANCE.workshop.design.radius||!part.design.arrows))||undefined} style={commonDesignStyle(assembly??null)}>{placements.map((placement,index)=>{
  const slot=assembly?.slots.find(item=>item.role===placement.role),saved=project?.installed?.parts.find(item=>item.id===placement.role),source=slot?.source??placement.sourcePartId;
  const known=source&&WORKSHOP_PARTS.some(part=>part.id===source),material=slot&&known?partVisual(source as WorkshopPartId,slot.design):null;
  const d=slot?.design,style:CSSProperties={position:'absolute',left:placement.rect.x-client.x,top:placement.rect.y-client.y,width:placement.rect.width,height:placement.rect.height,overflow:'hidden',fontSize:d?.fontSize??saved?.fontSize,
   background:material?.background??saved?.color,color:material?.foreground,borderRadius:d?.radius,boxShadow:d?.shadow?'1px 1px 0 #666':undefined,
   ...(material?{'--app-background':material.background,'--app-foreground':material.foreground}:{}),'--app-row-height':`${Math.max(saved?.rowHeight??BALANCE.appBuild.grid,(d?.fontSize??BALANCE.workshop.design.fontSize)+BALANCE.appBuild.grid)}px`,
   ...(d&&d.radius!==BALANCE.workshop.design.radius?{'--app-part-control-radius':`${d.radius}px`}:{}),...(d&&!usesNativeComponentColors(d)?{'--app-part-control-bg':material?.background,'--app-part-control-fg':material?.foreground}:{}),...(d&&d.fontSize!==BALANCE.workshop.design.fontSize?{'--app-part-control-font':`${d.fontSize}px`}:{}),
  } as CSSProperties;
  const content=contents(placement.role);return content===null?null:<div key={`${placement.role}:${index}`} className={`app-layout-part recorded-native-slot recorded-slot-${placement.role}`} data-own-control-radius={d&&d.radius!==BALANCE.workshop.design.radius||undefined} data-recorded-source={source} data-recorded-role={placement.role} style={style}>{content}</div>;
 })}</div>;
}
