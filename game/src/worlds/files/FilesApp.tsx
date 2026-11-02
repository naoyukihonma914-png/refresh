import { useState } from 'react';
import type { MessageKey } from '../../content/i18n';
import { activeScreenshots, screenshotCapacity } from '../../systems/desktop';
import { desktopFiles, rawDesktopFiles, fileSize, screenshotBytes, type DesktopFile } from '../../systems/desktopFiles';
import { frozenFiles } from '../../systems/captureScene';
import { hasAppPart } from '../../systems/appBuild';
import { hasUpgrade } from '../../systems/desktopJobs';
import type { BuiltApp } from '../../systems/desktopState';
import type { SetDocument } from '../../systems/workshopState';
import { AppPart } from '../AppComposition';
import { AppIcon, LineIcon } from '../desktop-icons';
import type { DesktopProps } from '../desktopTypes';
import { StatusBar } from '../../components/StatusBar';
import { LegacyCapturePreview } from '../LegacyCapturePreview';
import { PhotoEvaluation } from './PhotoEvaluation';
import { SetDocumentView } from './SetDocumentView';
import './files.css';

type Folder=DesktopProps['snapshot']['state']['run']['desktop']['fileFolder'];
export interface FilesAppProps extends DesktopProps {onEditDocument?:(document:SetDocument)=>void;onBuildApp?:(app:BuiltApp)=>void}
export function FilesApp({onEditDocument,onBuildApp,...props}:FilesAppProps) {
 const {snapshot,runtime,i18n,capture}=props,state=snapshot.state,d=state.run.desktop,t=i18n.t;
 const files=capture?frozenFiles(capture,props.catalog??[]):desktopFiles(state,i18n);
 const library=capture?files:rawDesktopFiles(state,i18n);
 const selected=library.find(file=>file.id===d.fileSelection);
 const [selection,setSelection]=useState<string|null>(null),[history,setHistory]=useState<Folder[]>([d.fileFolder]),[historyIndex,setHistoryIndex]=useState(0);
 const go=(folder:Folder,record=true)=>{if(record){setHistory([...history.slice(0,historyIndex+1),folder]);setHistoryIndex(historyIndex+1);}runtime.actDesktop({type:'folder',folder});setSelection(null);};
 const open=(file:DesktopFile)=>{
  if(file.kind==='folder'){go(file.id as Folder);return;}
  if(file.kind==='app'&&file.appId&&onBuildApp){onBuildApp(file.appId);return;}
  if(file.kind==='note'){runtime.actDesktop({type:'open',app:'note'});return;}
  runtime.actDesktop({type:'file',id:file.id});
 };
 const canRecycle=(file:DesktopFile)=>state.run.desktop.apps.includes('bin')&&file.kind==='shot';
 const feature=(part:Parameters<typeof hasAppPart>[2])=>hasAppPart(state,'files',part);
 const featureVisible=(part:Parameters<typeof hasAppPart>[2],upgrade:Parameters<typeof hasUpgrade>[1])=>feature(part)&&hasUpgrade(state,upgrade);
 const sort=featureVisible('sort','sort'),search=featureVisible('search','search'),large=featureVisible('large','large');
 const typeLabel=(file:DesktopFile)=>file.kind==='set'&&file.edition?t(file.edition==='archive'?'files.oldVersion':'files.currentVersion'):t(`files.type.${file.kind}` as MessageKey);
 const date=(file:DesktopFile)=>file.at===null?t('files.unknownDate'):i18n.dateTime(file.at);
 const storedBytes=state.persistent.screenshots.reduce((sum,shot)=>sum+screenshotBytes(shot),0);
 const backToList=()=>runtime.actDesktop({type:'file',id:null});
 return <div className="files-app document-library" data-document-library="true" data-file-folder={d.fileFolder}>
  <AppPart id="navigation"><nav className="files-address" aria-label={t('files.root')}>
   <button type="button" className="nav-button" aria-label={t('files.back')} disabled={historyIndex===0} onClick={()=>{setHistoryIndex(historyIndex-1);go(history[historyIndex-1]!,false);}}><LineIcon kind="back"/></button>
   <button type="button" className="nav-button" aria-label={t('files.forward')} disabled={historyIndex===history.length-1} onClick={()=>{setHistoryIndex(historyIndex+1);go(history[historyIndex+1]!,false);}}><LineIcon kind="forward"/></button>
   <button type="button" className="nav-button" aria-label={t('files.up')} disabled={d.fileFolder==='root'&&!selected} onClick={()=>selected?backToList():go('root')}><LineIcon kind="up"/></button>
   <div className="files-breadcrumb"><button type="button" title={t('files.root')} onClick={()=>go('root')}>{t('files.root')}</button>{d.fileFolder!=='root'&&<><LineIcon kind="forward"/><button type="button" onClick={backToList}>{t(d.fileFolder==='exports'?'files.sets':`files.${d.fileFolder}`)}</button></>}</div>
  </nav></AppPart>
  <div className="document-library-tools">
   {search&&<AppPart id="search"><input type="search" data-files-search aria-label={t('files.search')} placeholder={t('files.search')} value={d.fileSearch} onChange={event=>runtime.actDesktop({type:'search',text:event.target.value})}/></AppPart>}
   {sort&&<AppPart id="sort"><label>{t('builder.part.sort')}<select data-files-sort aria-label={t('builder.part.sort')} value={d.fileSort} onChange={event=>runtime.actDesktop({type:'sort',by:event.target.value as typeof d.fileSort})}>{(['name','date','type'] as const).map(by=><option value={by} key={by}>{t(by==='date'?'files.modified':by==='name'?'files.name':'files.type')}</option>)}</select></label></AppPart>}
   {large&&<AppPart id="large"><button type="button" className="win-button" data-files-large aria-pressed={d.largeIcons} onClick={()=>runtime.actDesktop({type:'large'})}>{t(d.largeIcons?'files.details':'files.large')}</button></AppPart>}
  </div>
  <div className="files-body">
   <AppPart id="places"><aside className="files-sidebar">{(['root','exports','screenshots'] as const).map(folder=><button type="button" key={folder} data-files-folder={folder} className={d.fileFolder===folder?'selected':''} onClick={()=>go(folder)}>{t(folder==='exports'?'files.sets':`files.${folder}`)}</button>)}</aside></AppPart>
   <AppPart id="list">{selected?<section className="file-preview" data-selected-document={selected.id}><header><button type="button" className="win-button" onClick={backToList}><LineIcon kind="back"/>{t('files.backToList')}</button><strong title={selected.name}>{selected.name}</strong></header><div className="file-preview-content">
    {selected.kind==='shot'&&selected.shot&&<><PhotoEvaluation shot={selected.shot} i18n={i18n}/><LegacyCapturePreview shot={selected.shot} catalog={props.catalog??state.persistent.screenshots} i18n={i18n}/></>}
    {selected.kind==='set'&&selected.setDocument&&<SetDocumentView document={selected.setDocument} state={state} i18n={i18n} onEdit={selected.edition==='current'&&state.run.workshop.purchasedSets.includes(selected.setDocument.set)&&onEditDocument?()=>onEditDocument(selected.setDocument!):undefined}/>}
   </div><StatusBar fields={[{id:'file-bytes',priority:1,text:fileSize(selected.bytes,i18n)},...(selected.at===null?[]:[{id:'file-date',priority:0,text:date(selected)}])]}/></section>:<div className={`file-list document-library-list ${large&&d.largeIcons?'large-file-icons':''}`}>
    <table aria-label={t('files.root')}><thead><tr>{(['name','date','type'] as const).map(by=><th key={by}>{sort?<button type="button" aria-label={t(`files.sort.${by}`)} onClick={()=>runtime.actDesktop({type:'sort',by})}>{t(by==='name'?'files.name':by==='date'?'files.modified':'files.type')}{d.fileSort===by?(d.fileDescending?' ↓':' ↑'):''}</button>:t(by==='name'?'files.name':by==='date'?'files.modified':'files.type')}</th>)}<th>{t('files.size')}</th></tr></thead><tbody>{files.map(file=><tr key={file.id} tabIndex={0} className={selection===file.id?'selected':''} data-file={file.id} data-file-kind={file.kind} data-file-edition={file.edition} data-file-version={file.setDocument?.version??file.version} draggable={canRecycle(file)} onDragStart={event=>event.dataTransfer.setData('text/refresh-file',file.id)} onDoubleClick={()=>open(file)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();open(file);}}}>
     <td><button type="button" title={file.name} onClick={()=>setSelection(file.id)}><AppIcon app={file.kind==='folder'?'files':'note'} state={state} palette={capture?.palette}/><span>{file.name}</span></button></td><td title={date(file)}>{date(file)}</td><td title={typeLabel(file)}>{typeLabel(file)}</td><td>{file.kind==='folder'?'':fileSize(file.bytes,i18n)}{canRecycle(file)&&<button type="button" className="file-recycle" aria-label={t('files.recycle')} title={t('files.recycle')} onClick={()=>runtime.actDesktop({type:'trash',id:file.id})}><LineIcon kind="close"/></button>}</td>
    </tr>)}</tbody></table>{!files.length&&<p>{t('files.emptyFolder')}</p>}
   </div>}</AppPart>
  </div>
  <AppPart id="status"><StatusBar className="files-status" fields={[{id:'items',priority:0,text:t('files.items',{count:capture?.display.fileCount??files.length})},{id:'storage',priority:1,text:t('files.storage',{used:capture?.display.shotCount??activeScreenshots(state).length,capacity:screenshotCapacity(state),size:fileSize(capture?.display.shotBytes??storedBytes,i18n)})}]}/></AppPart>
 </div>;
}
