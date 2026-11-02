import { hasAppPart } from '../systems/appBuild';
import { hasUpgrade } from '../systems/desktopJobs';
import type { DesktopProps } from '../worlds/desktopTypes';
import { AppIcon, LineIcon } from '../worlds/desktop-icons';

/** Native window chrome; the player's installed composition remains inside it. */
export function FilesRibbon({snapshot,runtime,i18n,preview}:DesktopProps) {
 const state=snapshot.state,d=state.run.desktop;
 const places=hasAppPart(state,'files','places');
 const sort=hasUpgrade(state,'sort')&&hasAppPart(state,'files','sort');
 const large=hasUpgrade(state,'large')&&hasAppPart(state,'files','large');
 if(!places&&!sort&&!large)return null;
 return <nav className="files-ribbon" aria-label={i18n.t('files.ribbon')} inert={preview||d.stalled==='files'}>
  <div className="ribbon-tabs"><span>{i18n.t('desktop.app.files')}</span><b>{i18n.t('files.ribbon.home')}</b></div>
  <div className="ribbon-groups">
   {places&&<div className="ribbon-group">
    <div className="ribbon-actions">{(['root','exports','screenshots'] as const).map(folder=><button className="ribbon-command" key={folder} aria-pressed={d.fileFolder===folder} onClick={()=>runtime.actDesktop({type:'folder',folder})}>
     {folder==='screenshots'?<LineIcon kind="capture"/>:<AppIcon app="files" state={state}/>}<span>{i18n.t(`files.${folder}`)}</span>
    </button>)}</div><small>{i18n.t('files.ribbon.places')}</small>
   </div>}
   {(sort||large)&&<div className="ribbon-group">
    <div className="ribbon-actions">{sort&&<button className="ribbon-command" onClick={()=>runtime.actDesktop({type:'sort',by:'date'})} aria-pressed={d.fileSort==='date'}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7h20M5 14h15M5 21h10M25 13v14m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2"/></svg><span>{i18n.t('files.sort.date')}</span></button>}
    {large&&<button className="ribbon-command" onClick={()=>runtime.actDesktop({type:'large'})} aria-pressed={d.largeIcons}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 4h9v9H4zm15 0h9v9h-9zM4 19h9v9H4zm15 0h9v9h-9z" fill="none" stroke="currentColor" strokeWidth="2"/></svg><span>{i18n.t(d.largeIcons?'files.details':'files.large')}</span></button>}</div><small>{i18n.t('files.ribbon.view')}</small>
   </div>}
  </div>
 </nav>;
}
