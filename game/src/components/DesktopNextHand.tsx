import type {CSSProperties} from 'react';
import {BALANCE} from '../config/balance';
import type {I18n,MessageKey} from '../content/i18n';
import {appName} from '../systems/appearance';
import {nextDesktopHand,type DesktopNextHand as Hand} from '../systems/nextHand';
import type {GameRuntime} from '../systems/runtime';
import type {GameState} from '../systems/state';
import './DesktopNextHand.css';

export function desktopNextHandText(next:Hand,state:GameState,i18n:I18n):string {
 if(next.kind==='desktop-offer')return i18n.t(`examples.desktop.offer.${next.offer.kind}` as MessageKey,{app:i18n.t(`desktop.app.${next.offer.id}`)});
 if(next.kind==='desktop-open'||next.kind==='desktop-finishApp')return i18n.t(`examples.desktop.${next.kind==='desktop-open'?'open':'finishApp'}`,{app:appName(state,next.app,i18n)});
 if(next.kind==='desktop-feedback')return i18n.t(next.request===null?'examples.desktop.feedbackWait':'examples.desktop.feedback');
 return i18n.t(`examples.desktop.${next.kind.slice('desktop-'.length)}` as MessageKey);
}
export function DesktopNextHand({state,runtime,i18n,onOffer,onConditions}:{state:GameState;runtime:GameRuntime;i18n:I18n;onOffer():void;onConditions():void}) {
 const next=nextDesktopHand(state);if(!next)return null;
 const text=desktopNextHandText(next,state,i18n);
 const activate=()=>{
  switch(next.kind){
   case 'desktop-offer':onOffer();break;
   case 'desktop-open':runtime.actDesktop({type:'open',app:next.app});break;
   case 'desktop-finishApp':runtime.actDesktop({type:'open',app:'tessera'});break;
   case 'desktop-feedback':runtime.actDesktop({type:'open',app:'mail'});if(next.request!==null)runtime.actDesktop({type:'mail',id:next.request});break;
   case 'desktop-wallpaper':runtime.actDesktop({type:'open',app:'photo'});break;
   case 'desktop-automation':runtime.actDesktop({type:'open',app:'terminal'});break;
   case 'desktop-sets':runtime.actDesktop({type:'open',app:'tessera'});break;
   case 'desktop-release':onConditions();break;
   case 'desktop-world4':onOffer();break;
  }
 };
 const width=state.run.desktop.screen.width<=BALANCE.examples.desktopCompactScreenWidth?BALANCE.examples.desktopNextCompactWidth:BALANCE.examples.desktopNextWidth;
 return <button type="button" className="taskbar-next-hand" data-example-next={next.kind} data-example-offer={next.kind==='desktop-offer'?next.offer.id:undefined} style={{'--example-next-width':`${width}px`} as CSSProperties} title={`${i18n.t('examples.next')}: ${text}`} aria-label={`${i18n.t('examples.next')}: ${text}`} onClick={activate}><span className="example-next-label">{i18n.t('examples.nextCompact')}</span><span className="example-next-action">{text}</span></button>;
}
