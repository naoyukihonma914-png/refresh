import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { BALANCE } from '../../config/balance';
import { getWorkshopPart, type WorkshopPartId } from '../../content/workshopCatalog';
import type { I18n, MessageKey } from '../../content/i18n';
import type { GameState } from '../../systems/state';
import { workshopShelf } from '../../systems/workshopShelf';
import type { Platform } from '../../platform/types';
import { CompletedPartImage } from './WorkshopHoverPreview';
import { WorkshopDestinationGlyph } from './WorkshopSchematic';
import { WorkshopGlyph } from './WorkshopGlyph';
import { usePieceTextFit } from './usePieceTextFit';

interface Flight {part:WorkshopPartId;style:CSSProperties;scale:number;entry:string}
export function WorkshopExportShelf({state,i18n,platform,viewport,reducedMotion}:{state:GameState;i18n:I18n;platform:Platform;viewport:RefObject<HTMLDivElement|null>;reducedMotion:boolean}){
 const w=state.run.workshop,entries=workshopShelf(w),f=BALANCE.workshop.fitting,run=`${state.createdAt}:${state.run.version}`;
 const previous=useRef({run,ids:entries.flatMap(entry=>entry.parts)}),[flights,setFlights]=useState<Flight[]>([]);
 useLayoutEffect(()=>{
  const ids=entries.flatMap(entry=>entry.parts),added=previous.current.run===run?ids.filter(id=>!previous.current.ids.includes(id)):[];
  previous.current={run,ids};
  if(reducedMotion){setFlights(current=>current.length?[]:current);return;}
  if(!added.length)return;
  const root=viewport.current;if(!root)return;
  const bounds=root.getBoundingClientRect(),scale=bounds.width/root.offsetWidth;
  setFlights(added.flatMap(part=>{
   const entry=entries.find(item=>item.parts.includes(part))!,to=root.querySelector(`[data-shelf-entry="${entry.id}"] .ws-shelf-image`)?.getBoundingClientRect();
   const source=root.querySelector(`[data-fitting-shell="${part}"]`)??root.closest('.workshop-root')?.querySelector('.ws-export-button');
   const from=source?.getBoundingClientRect();if(!to||!from)return [];
   const width=from.width/scale,height=from.height/scale,native=w.parts[part]?.rect??getWorkshopPart(part).defaultRect;
   return [{part,entry:entry.id,scale:width/native.width,style:{left:(from.left-bounds.left)/scale,top:(from.top-bounds.top)/scale,width,height,'--flight-x':`${(to.left-from.left)/scale}px`,'--flight-y':`${(to.top-from.top)/scale}px`,'--flight-width':`${to.width/scale}px`,'--flight-height':`${to.height/scale}px`,'--art-from':width/native.width,'--art-to':Math.min(to.width/scale/native.width,to.height/scale/native.height)} as CSSProperties}];
  }));
 },[w.parts,run,reducedMotion,viewport]);
 useLayoutEffect(()=>{
  if(!flights.length)return;let stop=()=>{};
  stop=platform.every(f.exportFlightMs+f.exportMergeMs,()=>{stop();setFlights([]);});return stop;
 },[flights,platform,f.exportFlightMs,f.exportMergeMs]);
 const animationStyle={'--export-flight':`${f.exportFlightMs}ms`,'--export-merge':`${f.exportMergeMs}ms`} as CSSProperties;
 return <>
  <aside className="ws-desktop-shelf" data-workshop-shelf data-reduced-motion={reducedMotion||undefined} aria-label={i18n.t('ws.shelfDesktop' as MessageKey)} style={{...animationStyle,'--shelf-rows':Math.max(1,Math.ceil(entries.length/2)),'--shelf-height':`${entries.length?Math.ceil(entries.length/2)*62+26:26}px`} as CSSProperties}>
   <strong>{i18n.t('ws.shelfDesktop' as MessageKey)}</strong>
   <div className="ws-shelf-icons">{entries.map(entry=>{
    const name=i18n.t((entry.part?getWorkshopPart(entry.part).labelKey:`ws.set.${entry.set}`) as MessageKey),incoming=flights.some(flight=>flight.entry===entry.id);
    return <figure key={entry.id} data-shelf-entry={entry.id} data-shelf-merging={!entry.part&&incoming&&!reducedMotion||undefined} title={name}>
     <span className="ws-shelf-image">{entry.part?<><WorkshopGlyph name="file"/><span className="ws-shelf-part-mark"><WorkshopDestinationGlyph set={entry.set}/></span></>:<WorkshopDestinationGlyph set={entry.set}/>}</span><figcaption><ShelfLabel name={name}/></figcaption>
    </figure>;
   })}</div>
  </aside>
  {!reducedMotion&&flights.map(flight=><div key={flight.part} className="ws-export-flight" data-export-flight={flight.part} style={{...animationStyle,...flight.style}} aria-hidden="true">
   <div className="ws-export-flight-art" style={{transform:`scale(${flight.scale})`}}><CompletedPartImage state={state} i18n={i18n} part={flight.part}/></div><span className="ws-export-flight-icon"><WorkshopGlyph name="file"/></span>
  </div>)}
 </>;
}
function ShelfLabel({name}:{name:string}){
 const root=useRef<HTMLDivElement>(null);usePieceTextFit(root,10);
 return <div ref={root} className="ws-shelf-label">{name}</div>;
}
