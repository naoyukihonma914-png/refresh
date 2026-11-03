import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import { getWorkshopPart } from '../../content/workshopCatalog';
import type { Platform } from '../../platform/types';
import { passivePixelsPerSecond } from '../../systems/economy';
import type { RuntimeSnapshot } from '../../systems/runtime';
import type { GameState } from '../../systems/state';
import { workshopComboMultiplier } from '../../systems/workshopExamples';
import { feedbackCounterValue, workshopFeedbackRun, workshopVisible, type WorkshopCompletionFeedbackEvent } from '../../systems/workshopFeedback';
import './workshop-completion-feedback.css';

interface Point {x:number;y:number}
interface FeedbackGeometry {source:Point;target:Point;targetWidth:number;targetHeight:number;targetFont:string;message:Point}
interface ActiveFeedback {event:WorkshopCompletionFeedbackEvent;started:number;geometry:FeedbackGeometry;reducedMotion:boolean}
interface FeedbackProps {snapshot:RuntimeSnapshot;i18n:I18n;platform:Platform;containerRef:RefObject<HTMLElement|null>}

function geometry(root:HTMLElement,part:WorkshopCompletionFeedbackEvent['part']):FeedbackGeometry|null {
 const target=root.querySelector<HTMLElement>('[data-workshop-rate]');
 if(!target)return null;
 const bounds=root.getBoundingClientRect(),rate=target.getBoundingClientRect();
 if(bounds.width<=0||bounds.height<=0)return null;
 const scale={x:root.clientWidth/bounds.width,y:root.clientHeight/bounds.height};
 const width=Math.min(BALANCE.workshop.feedback.maxWidth,root.clientWidth),clamp=(value:number,max:number)=>Math.max(0,Math.min(max,value));
 const center=(rect:DOMRect):Point=>({x:clamp((rect.left+rect.width/2-bounds.left)*scale.x,root.clientWidth-width),y:clamp((rect.top+rect.height/2-bounds.top)*scale.y,root.clientHeight)});
 const source=root.querySelector<HTMLElement>(`[data-workshop-canvas-part="${part}"]`)?.getBoundingClientRect();
 const targetPoint={x:(rate.left-bounds.left)*scale.x,y:(rate.top-bounds.top)*scale.y};
 const targetFont=target.ownerDocument.defaultView?.getComputedStyle(target).font??'';
 return {source:source?center(source):center(rate),target:targetPoint,targetWidth:rate.width*scale.x,targetHeight:rate.height*scale.y,targetFont,message:{x:clamp(targetPoint.x+rate.width*scale.x-width,root.clientWidth-width),y:clamp(targetPoint.y+rate.height*scale.y,root.clientHeight)}};
}

/** Transient completion paint. The live rate text keeps the real state value throughout. */
export function WorkshopCompletionFeedback({snapshot,i18n,platform,containerRef}:FeedbackProps){
 const event=snapshot.workshopCompletion,run=workshopFeedbackRun(snapshot.state),config=BALANCE.workshop.feedback;
 const observed=useRef(event?.serial),[active,setActive]=useState<ActiveFeedback[]>([]),[now,setNow]=useState(platform.clock.monotonicNow);
 const visible=workshopVisible(snapshot.state),current=active.at(-1),liveRate=passivePixelsPerSecond(snapshot.state);
 useEffect(()=>{
  if(!event){observed.current=undefined;setActive([]);return;}
  if(observed.current===event.serial)return;
  observed.current=event.serial;
  const root=containerRef.current;
  if(!root||event.run!==run||!visible)return;
  const measured=geometry(root,event.part);if(!measured)return;
  const started=platform.clock.monotonicNow();setNow(started);
  setActive(items=>[...items,{event,started,geometry:measured,reducedMotion:platform.animation.reducedMotion()}].slice(-config.queueLimit));
 },[event,run,visible,containerRef,platform,config.queueLimit]);
 useEffect(()=>{if(!visible)setActive([]);},[visible,run]);
 useEffect(()=>{
  if(!active.length)return;
  return platform.every(config.frameMs,()=>{const tick=platform.clock.monotonicNow();setNow(tick);setActive(items=>items.filter(item=>tick-item.started<config.messageMs&&item.event.run===run));});
 },[active.length,platform,config.frameMs,config.messageMs,run]);
 const elapsed=current?Math.max(0,now-current.started):0;
 const growing=Boolean(current&&current.event.activePartRate>0&&current.event.rateAfter>current.event.rateBefore);
 const counter=Boolean(current&&growing&&!current.reducedMotion&&elapsed<=config.pulseMs&&liveRate===current.event.rateAfter);
 useEffect(()=>{
  const target=containerRef.current?.querySelector<HTMLElement>('[data-workshop-rate]');if(!target||!current||!counter)return;
  const serial=String(current.event.serial);target.setAttribute('data-workshop-rate-feedback',serial);
  return()=>{if(target.getAttribute('data-workshop-rate-feedback')===serial)target.removeAttribute('data-workshop-rate-feedback');};
 },[containerRef,current?.event.serial,counter]);
 const t=(key:string,params:Record<string,string|number>={})=>i18n.t(key as MessageKey,params);
 if(!current||!visible)return null;
 const name=t(getWorkshopPart(current.event.part).labelKey),message=current.event.partRate===0?t('examples.feedback.completedZero',{name}):growing?t('examples.feedback.completed',{name,partRate:i18n.rate(current.event.partRate),total:i18n.rate(current.event.rateAfter)}):t('examples.feedback.pending',{name,partRate:i18n.rate(current.event.partRate)});
 return <div className="ws-completion-feedback" data-workshop-completion={current.event.part} data-workshop-completion-serial={current.event.serial} data-workshop-completion-growing={growing} style={{'--ws-feedback-max-width':`${config.maxWidth}px`} as CSSProperties}>
  {active.filter(item=>item.event.activePartRate>0&&item.event.rateAfter>item.event.rateBefore&&!item.reducedMotion&&now-item.started<config.flightMs).map(item=>{
   const progress=Math.min(1,Math.max(0,(now-item.started)/config.flightMs)),eased=progress*progress*(3-2*progress),from=item.geometry.source,to=item.geometry.target;
   return <span key={item.event.serial} data-workshop-rate-flight={item.event.part} className="ws-completion-flight" aria-hidden="true" style={{left:from.x+(to.x-from.x)*eased,top:from.y+(to.y-from.y)*eased-config.originLift*(1-eased),opacity:1-progress}}>{t('ws.baseRate',{count:i18n.rate(item.event.partRate)})}</span>;
  })}
  {counter&&<span className="ws-completion-counter" data-workshop-feedback-counter aria-hidden="true" style={{left:current.geometry.target.x,top:current.geometry.target.y,width:current.geometry.targetWidth,height:current.geometry.targetHeight,font:current.geometry.targetFont}}>{t('ws.rate',{count:i18n.rate(feedbackCounterValue(current.event,Math.min(1,elapsed/config.flightMs)))})}</span>}
  <p className={`ws-completion-message ${growing?'is-growing':''}`} data-workshop-completion-message role="status" style={{left:current.geometry.message.x,top:current.geometry.message.y}}>{message}</p>
 </div>;
}

/** This describes the next small step payment, not the reward already received. */
export function WorkshopCombo({state,i18n,platform}:{state:GameState;i18n:I18n;platform:Platform}){
 const [now,setNow]=useState(platform.clock.wallNow),combo=state.run.workshop.combo;
 const multiplier=workshopComboMultiplier(state,now),active=multiplier>1;
 useEffect(()=>{setNow(platform.clock.wallNow());if(!active)return;return platform.every(BALANCE.workshop.feedback.frameMs,()=>setNow(platform.clock.wallNow()));},[combo?.lastCompletedAt,active,platform]);
 if(!active||!combo)return null;
 return <small className="ws-workshop-combo" data-workshop-combo={combo.count} data-workshop-next-step-multiplier={multiplier} role="status">{i18n.t('examples.feedback.combo' as MessageKey,{count:combo.count,multiplier:i18n.number(multiplier)})}</small>;
}
