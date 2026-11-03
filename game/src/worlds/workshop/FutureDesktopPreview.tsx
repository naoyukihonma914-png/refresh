import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart, WORKSHOP_PARTS, type WorkshopPartId } from '../../content/workshopCatalog';
import type { Platform } from '../../platform/types';
import { newlyCompletedPreviewParts,workshopPreviewObservation } from '../../systems/workshopPreview';
import type { GameState } from '../../systems/state';
import { WorkshopSchematic } from './WorkshopSchematic';
import './future-desktop-preview.css';

export interface FutureDesktopPreviewProps {state:GameState;i18n:I18n;platform:Platform}
/** The future desktop is a projection of completed materials, never an installed app or a producer. */
export function FutureDesktopPreview({state,i18n,platform}:FutureDesktopPreviewProps){
 const observation=useMemo(()=>workshopPreviewObservation(state),[state.createdAt,state.run.version,state.run.workshop.enteredAt,state.run.workshop.parts]);
 const previous=useRef(observation),[queue,setQueue]=useState<WorkshopPartId[]>([]);
 const completed=WORKSHOP_PARTS.map(part=>part.id).filter(id=>observation.completed[id]!==undefined),playing=queue[0]??null;
 const config=BALANCE.workshop.testplay.preview;
 useEffect(()=>{const added=newlyCompletedPreviewParts(previous.current,observation),changedRun=previous.current.run!==observation.run;previous.current=observation;if(changedRun)setQueue([]);else if(added.length)setQueue(current=>[...current,...added].slice(-WORKSHOP_PARTS.length));},[observation]);
 useEffect(()=>{if(!playing)return;const started=platform.clock.monotonicNow();let stop=()=>{};stop=platform.every(config.frameMs,()=>{if(platform.clock.monotonicNow()-started>=config.runMs){stop();setQueue(current=>current[0]===playing?current.slice(1):current);}});return()=>stop();},[playing,platform,config.frameMs,config.runMs]);
 const last=completed.at(-1),focus=playing??last??'common-frame',set=getWorkshopPart(focus).set;
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params);
 return <aside className="tp-future-desktop" data-future-desktop data-completed-count={completed.length} data-trial-part={playing??undefined} data-trial-open={Boolean(playing)} style={{'--tp-preview-width':`${config.width}px`,'--tp-preview-height':`${config.height}px`} as CSSProperties}>
  <header><strong>{t('tp.preview.title')}</strong><span>{t('tp.preview.completedCount',{count:completed.length})}</span></header>
  <div role="img" aria-label={t('tp.preview.label',{count:completed.length})} className="tp-future-desktop-image"><WorkshopSchematic key={playing??'settled'} set={set} i18n={i18n} completedParts={completed} trialPart={playing??undefined} trialOpen={Boolean(playing)} highlight={false} thumbnail/></div>
  <p role={playing?'status':undefined}>{playing?t('tp.preview.running',{name:t(getWorkshopPart(playing).labelKey)}):t('tp.preview.wait')}</p>
 </aside>;
}
