import type { CSSProperties } from 'react';
import type { I18n } from '../../content/i18n';
import type { WorkshopPartDefinition, TestInteraction } from '../../content/workshopCatalog';
import type { PartProduction } from '../../systems/workshopState';
import { useWorkshopTarget } from './WorkshopTargetContext';
import { partVisual } from './partVisual';
import './streaming-parts.css';

/** The next world's parts share actual sources and messages; no broadcast simulation is started. */
export function StreamingPart({part,production,i18n,disabled,onInteract}:{part:WorkshopPartDefinition;production:PartProduction;i18n:I18n;disabled:boolean;onInteract:(interaction:TestInteraction)=>void}) {
 const {photo,mail,stream,actions}=useWorkshopTarget(),t=i18n.t,design=production.design;
 const visual=partVisual(part.id,design),has=(element:string)=>production.elements.includes(element);
 const message=mail.messages.find(entry=>entry.id===stream.selectedMessage)??mail.selected;
 const act=(interaction:TestInteraction,run:()=>void)=>{if(disabled)return;run();onInteract(interaction);};
 const styles={background:visual.background,color:visual.foreground,borderRadius:design.radius,fontSize:design.fontSize,boxShadow:design.shadow?'1px 1px 0 #666':undefined} as CSSProperties;
 let body;
 switch(part.id){
  case 'stream-preview':body=<button type="button" className="ws-stream-preview" data-workshop-control="image" data-stream-preview-source={photo.current.id} data-stream-preview-scene={stream.scene} disabled={disabled} aria-pressed={stream.previewSelected} aria-label={t('ws.stream.preview')} onClick={()=>act('select',actions.toggleStreamPreview)}>{has('image')&&(stream.scene==='source'?<img src={photo.current.src} alt={photo.current.label} style={{filter:photo.filter}}/>:<span className="ws-stream-message-preview">{message?<><strong>{message.subject}</strong><span>{message.body}</span></>:t('ws.stream.noMessages')}</span>)}{has('source')&&<span className="ws-stream-source-caption">{stream.scene==='source'?photo.current.label:t('ws.stream.messages')}</span>}</button>;break;
  case 'stream-sources':body=has('source')&&<label>{t('ws.stream.source')}{has('selection')&&<select data-workshop-control="source" data-stream-source value={photo.index} disabled={disabled} onChange={event=>act('select',()=>actions.selectPhoto(Number(event.target.value)))}>{photo.sources.map((source,index)=><option key={source.id} value={index}>{source.label}</option>)}</select>}</label>;break;
  case 'stream-scenes':body=has('scene')&&<div className="ws-stream-scenes" role="tablist" aria-label={t('ws.stream.scene')}>{(['source','messages'] as const).map(scene=><button type="button" key={scene} data-workshop-control={scene} data-stream-scene={scene} role="tab" disabled={disabled} aria-selected={stream.scene===scene} onClick={()=>act('select',()=>actions.setStreamScene(scene))}>{t(scene==='source'?'ws.stream.sourceScene':'ws.stream.messages')}</button>)}{has('preview')&&<output>{t(stream.scene==='source'?'ws.stream.sourceScene':'ws.stream.messages')}</output>}</div>;break;
  case 'stream-comments':body=has('message')&&<div className="ws-stream-comments" data-workshop-control="message" tabIndex={0} onFocus={()=>!disabled&&onInteract('select')} onScroll={()=>!disabled&&onInteract('scroll')}>{mail.messages.length?mail.messages.map(entry=><button type="button" key={entry.id} data-stream-message={entry.id} disabled={disabled||!has('selection')} aria-pressed={message?.id===entry.id} onClick={()=>act('select',()=>actions.selectStreamMessage(entry.id))}><strong>{entry.sender}</strong><span>{entry.body}</span></button>):<p>{t('ws.stream.noMessages')}</p>}</div>;break;
  default:return null;
 }
 return <div className={`ws-destination-part ws-stream-part ws-stream-${part.id}`} data-workshop-preview={part.kind} data-workshop-test-part={part.id} data-stream-part={part.id} style={styles}>{body}</div>;
}
