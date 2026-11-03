import type { CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n,MessageKey } from '../../content/i18n';
import { partsForSet,getWorkshopPart,type UiSetId,type WorkshopPartId } from '../../content/workshopCatalog';
import { workshopHelpFor,workshopHelpRegion,type WorkshopHelpRegion } from '../../content/workshopHelp';
import { AppGlyph } from '../desktop-icons';
import type { AppId } from '../../systems/desktopState';
import './workshop-navigation.css';

const destinationApps:Partial<Record<UiSetId,AppId>>={files:'files',mail:'mail',photo:'photo',bin:'bin',clock:'clock',theme:'theme',terminal:'terminal',manager:'manager'};
/** These symbols describe destinations, rather than a real operating-system brand. */
export function WorkshopDestinationGlyph({set}:{set:UiSetId}){
 const app=destinationApps[set];
 return <span className={`ws-destination-glyph ws-destination-${set}`} aria-hidden="true">{app?<AppGlyph app={app}/>:<svg viewBox="0 0 32 32" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
  {set==='foundation'?<><rect x="2" y="4" width="28" height="24" fill="#b6c7c7"/><path d="M3 23H29M6 8H10V12H6ZM6 15H10V19H6Z"/><path d="M5 26H11M24 26H27"/></>:set==='stream'?<><rect x="2" y="5" width="28" height="22" fill="#b6c7c7"/><path d="M5 9H19V22H5ZM22 9H27M22 13H27M22 18H27M22 22H27"/><path d="m9 12 6 4-6 4z" fill="currentColor"/></>:set==='extras'?<><rect x="2" y="5" width="28" height="22" fill="#d9cfb8"/><path d="M3 12H29M9 6V12M17 6V12M3 18H29M12 13V26M21 13V26"/></>:<><rect x="2" y="9" width="23" height="20" fill="#b5c4ce"/><rect x="8" y="3" width="22" height="20" fill="#d9cfb8"/><path d="M9 8H29M22 5H24M26 5H28"/></>}
 </svg>}</span>;
}
function PartArtwork({id,rect}:{id:WorkshopPartId;rect:WorkshopHelpRegion}){
 const {width:w,height:h}=rect,kind=getWorkshopPart(id).kind;
 const panel=<rect x="0" y="0" width={w} height={h} className="ws-schematic-panel"/>;
 const lines=(rows:number,columns=false)=>Array.from({length:rows},(_,index)=><path key={index} d={`M4 ${4+(h-8)*(index+1)/(rows+1)}H${w-4}${columns?`M${w*.42} 3V${h-3}`:''}`}/>);
 const button=<>{panel}<path d={`M${w*.25} ${h/2}H${w*.75}`}/></>;
 if(id==='common-frame')return <><rect width={w} height={h} className="ws-schematic-frame"/><rect x="1" y="1" width={w-2} height="20" className="ws-schematic-title"/><path d={`M${w-46} 9h9m5-5h9v9h-9zm15 0 9 9m0-9-9 9`}/><rect x={w-9} y={24} width={6} height={Math.max(0,h-28)} className="ws-schematic-panel"/><rect x={w-9} y={24+(h-28)*.3} width={6} height={Math.max(2,(h-28)*.3)} className="ws-schematic-thumb"/></>;
 if(id==='foundation-desktop')return <rect width={w} height={h} className="ws-schematic-desktop"/>;
 if(id==='foundation-wallpaper'||id==='photo-display'||id==='stream-preview')return <>{panel}<path d={`M2 ${h-3} ${w*.28} ${h*.32} ${w*.51} ${h*.7} ${w*.72} ${h*.4} ${w-2} ${h-3}Z`} className="ws-schematic-landscape"/><circle cx={w*.76} cy={h*.22} r={Math.min(w,h)*.08}/></>;
 if(id==='foundation-icons')return <>{Array.from({length:4},(_,index)=><g key={index} transform={`translate(5 ${6+index*(h-18)/4})`}><rect width="15" height="13" className="ws-schematic-panel"/><path d="M0 18H21"/></g>)}</>;
 if(id==='foundation-taskbar')return <>{panel}<path d={`M3 3H17V${h-3}H3ZM23 4H39V${h-4}H23ZM45 4H61V${h-4}H45ZM${w-54} 5H${w-5}M${w-54} 11H${w-18}`}/></>;
 if(id==='foundation-notification')return <>{panel}<path d={`M3 14H${w-3}M6 7H${w*.7}M6 23H${w-6}M6 31H${w*.7}`}/></>;
 if(id==='mail-unread')return <rect width={w} height={h} className="ws-schematic-mark"/>;
 if(kind==='button')return button;
 if(kind==='heading')return <><path d={`M0 ${h*.3}H${w*.65}`} strokeWidth="4"/><path d={`M0 ${h-2}H${w}`}/></>;
 if(kind==='progress')return <>{panel}<rect x="3" y="3" width={w*.62} height={Math.max(1,h-6)} className="ws-schematic-thumb"/></>;
 if(kind==='slider')return <><path d={`M0 ${h/2}H${w}`}/><rect x={w*.57} y={h*.1} width="6" height={h*.8} className="ws-schematic-thumb"/></>;
 if(kind==='input')return <>{panel}<path d={`M5 4V${h-4}`}/></>;
 if(kind==='toggle')return <><rect x="1" y="1" width={Math.min(h-2,16)} height={Math.min(h-2,16)} className="ws-schematic-panel"/><path d={`M${Math.min(h+4,22)} ${h/2}H${w-2}`}/></>;
 if(kind==='select')return <>{panel}<path d={`m${w-11} ${h/2-2} 4 4 4-4M4 ${h/2}H${Math.max(5,w-20)}`}/></>;
 if(kind==='calendar')return <>{panel}<path d={`M2 15H${w-2}${Array.from({length:6},(_,n)=>`M${w*(n+1)/7} 18V${h-2}`).join('')}${Array.from({length:4},(_,n)=>`M2 ${18+(h-18)*(n+1)/5}H${w-2}`).join('')}`}/></>;
 if(kind==='tabs')return <>{panel}<path d={`M${w/3} 0V${h}M${w*2/3} 0V${h}M4 ${h/2}H${w/3-4}`}/></>;
 if(kind==='timer')return <>{panel}<rect x="4" y="4" width={w-8} height={Math.min(18,h*.4)} className="ws-schematic-input"/><path d={`M4 ${h-9}H${w*.55}M${w*.65} ${h-9}H${w-4}`}/></>;
 return <>{panel}{lines(kind==='list'||kind==='table'?4:3,kind==='list'||kind==='table')}</>;
}
export interface WorkshopSchematicProps {
 set:UiSetId;part?:WorkshopPartId;i18n:I18n;completedParts?:readonly WorkshopPartId[];
 trialPart?:WorkshopPartId;trialOpen?:boolean;className?:string;highlight?:boolean;thumbnail?:boolean;
}
/** A diagram of the player's future desktop. No game state, commands, or fake live data. */
export function WorkshopSchematic({set,part,i18n,completedParts,trialPart,trialOpen,className='',highlight=true,thumbnail=false}:WorkshopSchematicProps){
 const dimensions=BALANCE.workshopHelp,help=workshopHelpFor(set,part),parts=partsForSet(set),frame=dimensions.window;
 const highlighted=new Set<WorkshopPartId>(highlight?help.regions:[]);if(trialPart)highlighted.add(trialPart);
 const backgroundIds:WorkshopPartId[]=['foundation-desktop','foundation-wallpaper','foundation-icons','foundation-taskbar'];
 const ordered=set==='foundation'?[...parts].sort((a,b)=>[...backgroundIds,'foundation-notification','foundation-upgrades'].indexOf(a.id)-[...backgroundIds,'foundation-notification','foundation-upgrades'].indexOf(b.id)):parts;
 const region=(id:WorkshopPartId)=>{const rect=workshopHelpRegion(id),built=completedParts===undefined||completedParts.includes(id);return <g key={id} data-help-region={id} data-highlighted={highlighted.has(id)||undefined} data-part-complete={built} className={`ws-schematic-region ${!built?'is-unbuilt':''}`} transform={`translate(${rect.x} ${rect.y})`}><PartArtwork id={id} rect={rect}/></g>;};
 const sharedFrame=set!=='common'&&set!=='foundation'?region('common-frame'):null;
 const windowContents=<g className="ws-schematic-window">{sharedFrame}{ordered.map(definition=>region(definition.id))}{set!=='foundation'&&<text x={frame.x+9} y={frame.y+14} className="ws-schematic-window-label">{i18n.t(`ws.set.${set}`)}</text>}</g>;
 return <svg className={`ws-workshop-schematic ${className}`} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} width={dimensions.width} height={dimensions.height} role={thumbnail?undefined:'img'} aria-hidden={thumbnail||undefined} aria-label={thumbnail?undefined:i18n.t('tp.workshop.helpDiagram' as MessageKey,{name:i18n.t(help.labelKey as MessageKey)})} data-schematic-set={set} data-schematic-part={part} data-trial-open={trialOpen} style={{'--ws-help-highlight':dimensions.highlight} as CSSProperties}>
  <rect x="0" y="0" width={dimensions.width} height={dimensions.height} className="ws-schematic-background"/>
  {set!=='foundation'&&<g className="ws-schematic-context">{backgroundIds.map(region)}</g>}
  {windowContents}
 </svg>;
}
