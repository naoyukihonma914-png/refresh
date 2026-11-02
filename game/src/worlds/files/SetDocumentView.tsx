import { useLayoutEffect, useRef, useState } from 'react';
import type { I18n, MessageKey } from '../../content/i18n';
import { partsForSet } from '../../content/workshopCatalog';
import { BALANCE } from '../../config/balance';
import type { GameState } from '../../systems/state';
import { editorStage } from '../../systems/appearance';
import { usesNativeComponentColors, type SetDocument } from '../../systems/workshopState';
import { setDocumentPresentation } from '../../systems/setDocumentPresentation';
import { WorkshopSnapshot } from '../LegacyCapturePreview';

/** Saved parts are rendered from a presentation DTO; the live game is never restored or edited. */
export function SetDocumentView({document,state,i18n,onEdit}:{document:SetDocument;state:GameState;i18n:I18n;onEdit?:()=>void}) {
 const t=i18n.t,archived=document.version!==state.run.version;
 const definitions=partsForSet(document.set);
 const {customization,workshop}=setDocumentPresentation(document);
 const logicalWidth=BALANCE.workshop.canvas.width+customization.panelWidth+customization.fontSize*2;
 const logicalHeight=BALANCE.workshop.canvas.height+customization.fontSize*4;
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1),[actualSize,setActualSize]=useState(false);
 useLayoutEffect(()=>{const host=viewport.current;if(!host)return;const fit=()=>setScale(actualSize?1:Math.min(1,host.clientWidth/logicalWidth));fit();const observer=new ResizeObserver(fit);observer.observe(host);return()=>observer.disconnect();},[actualSize,logicalWidth]);
 return <article className="set-document-view" data-document-id={document.id} data-document-version={document.version} data-document-edition={archived?'archive':'current'} data-document-readonly="true">
  <header><h2>{t('ws.setDocument',{set:t(`ws.set.${document.set}` as MessageKey)})}</h2><span>{t(archived?'files.oldVersion':'files.currentVersion')}</span></header>
  <p className="set-document-meta"><span>{t('files.documentVersion',{version:document.version})}</span><span>{t('files.documentPartCount',{count:i18n.integer(Object.keys(document.parts).length)})}</span><time>{i18n.dateTime(document.at)}</time></p>
  {archived&&<p className="set-document-readonly">{t('files.documentOldReadOnly')}</p>}
  <div className="set-document-toolbar"><span>{t('files.documentReadOnly')}</span><button type="button" aria-pressed={!actualSize} onClick={()=>setActualSize(!actualSize)}>{actualSize?t('ws.percent',{count:i18n.integer(BALANCE.workshop.preview.percentDivisor)}):t('ws.fit')}</button>{!archived&&onEdit&&<button type="button" data-document-open-editor onClick={onEdit}>{t('files.documentOpenEditor')}</button>}</div>
  <div className="set-document-viewport" ref={viewport}><div style={{width:actualSize?logicalWidth:'100%',height:logicalHeight*scale}}><div className="set-document-snapshot" style={{width:logicalWidth,height:logicalHeight,transform:`scale(${scale})`}}><WorkshopSnapshot workshop={workshop} customization={customization} stage={editorStage(state)} desktopStage={state.persistent.appearance.desktop} i18n={i18n} now={document.at}/></div></div></div>
  <details className="set-document-parts"><summary>{t('files.documentParts')}</summary><table><thead><tr><th>{t('files.documentPart')}</th><th>{t('files.documentDimensions')}</th><th>{t('files.documentPosition')}</th><th>{t('files.documentColor')}</th></tr></thead><tbody>{definitions.map(definition=>{const part=document.parts[definition.id];if(!part)return null;return <tr key={definition.id} data-document-part={definition.id}><td>{t(definition.labelKey as MessageKey)}</td><td>{t('ws.dimensions',{width:i18n.integer(part.rect.width),height:i18n.integer(part.rect.height)})}</td><td>{t('files.documentCoordinates',{x:i18n.integer(part.rect.x),y:i18n.integer(part.rect.y)})}</td><td>{usesNativeComponentColors(part.design)?t('files.documentStandardColors'):`${part.design.color} / ${part.design.textColor}`}</td></tr>;})}</tbody></table></details>
 </article>;
}
