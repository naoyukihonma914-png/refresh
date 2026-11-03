import { BALANCE } from '../config/balance';
import type { WorkshopPartDefinition, WorkshopRect } from './workshopCatalog';
import { fittingDefinition } from './workshopFitting';

/** Socket outlines are native control surfaces, measured inside each part's shell. */
export function fittingSocketRects(part:WorkshopPartDefinition,rect:WorkshopRect,scrollbarWidth:number=BALANCE.workshop.design.scrollbarWidth):Record<string,WorkshopRect> {
 const definition=fittingDefinition(part.id),w=rect.width,h=rect.height;
 const box=(x:number,y:number,width:number,height:number):WorkshopRect=>({x:Math.round(x*w),y:Math.round(y*h),width:Math.max(1,Math.round(width*w)),height:Math.max(1,Math.round(height*h))});
 const out:Record<string,WorkshopRect>={};
 const row=(weights:number[]=definition.sockets.map(()=>1))=>{
  const total=weights.reduce((sum,value)=>sum+value,0);let x=0;
  definition.sockets.forEach((socket,index)=>{const width=(weights[index]??1)/total;out[socket.id]=box(x,0,width,1);x+=width;});
 };
 switch(part.id){
  case 'common-frame':{
   const c=BALANCE.workshop.fitting,size=c.frameControlSize,gap=c.frameControlGap,title=c.frameTitleHeight;
   out.title={x:4,y:4,width:w-(size+gap)*3-12,height:title-8};
   for(let i=0;i<3;i++)out[`control-${i}`]={x:w-(size+gap)*(3-i)-4,y:4,width:size,height:size};
   out.scrollbar={x:w-scrollbarWidth-4,y:title,width:scrollbarWidth,height:h-title-4};
   break;
  }
  case 'common-button':out.label=box(.02,.06,.96,.88);break;
  case 'common-heading':out.label=box(.02,.04,.96,.78);out.separator=box(.02,.88,.96,.08);break;
  case 'common-progress':out.track=box(.02,.18,.96,.55);out.fill=box(.04,.25,.64,.39);out.percent=box(.7,.23,.26,.43);break;
  case 'foundation-taskbar':row([3,2]);break;
  case 'foundation-desktop':out.surface=box(.02,.02,.96,.96);out.selection=box(.1,.15,.45,.55);break;
  case 'foundation-icons':out.icon=box(.1,.08,.8,.58);out.caption=box(.05,.7,.9,.25);break;
  case 'foundation-notification':out.message=box(.04,.04,.92,.55);out.action=box(.26,.65,.7,.3);break;
  case 'foundation-wallpaper':case 'photo-display':out.image=box(.02,.02,.96,.96);out.fit=box(.72,.76,.26,.22);break;
  case 'foundation-upgrades':row([3,2,2]);break;
  case 'files-list':out.columns=box(.02,.02,.96,.2);out.rows=box(.02,.25,.96,.73);break;
  case 'files-back':row([1,2]);break;
  case 'files-sort':row([3,1]);break;
  case 'files-search':row([4,1]);break;
  case 'files-large':row([1,2]);break;
  case 'files-storage':out.used=box(.03,.12,.94,.4);out.capacity=box(.03,.58,.94,.34);break;
  case 'mail-list':row([3,5,2]);break;
  case 'mail-body':out.subject=box(.02,.02,.96,.23);out.body=box(.02,.3,.96,.68);break;
  case 'mail-reply':out.reply=box(.02,.02,.37,.96);out.draft=box(.43,.02,.55,.96);break;
  case 'mail-folders':out.inbox=box(.02,.02,.96,.44);out.archive=box(.02,.54,.96,.44);break;
  case 'mail-unread':case 'terminal-run':out.state=box(.05,.08,.9,.84);break;
  case 'photo-brightness':case 'photo-tone':case 'theme-radius':case 'theme-icons':
   out.track=box(.04,.43,.7,.14);out.thumb=box(.04,.22,.7,.57);
   out[part.id==='theme-radius'?'sample':part.id==='theme-icons'?'icon':'value']=box(.78,.18,.2,.64);break;
  case 'photo-wallpaper':row([1,2]);break;
  case 'photo-crop':out.image=box(.02,.02,.96,.96);out['crop-frame']=box(.12,.1,.76,.8);break;
  case 'photo-compare':row();break;
  case 'photo-switch':out['navigation-0']=box(.05,.1,.42,.8);out['navigation-1']=box(.53,.1,.42,.8);break;
  case 'bin-list':row([3,1]);break;
  case 'bin-undo':case 'bin-empty':row([2,3]);break;
  case 'clock-time':row();break;
  case 'clock-timer':out.duration=box(.02,.02,.96,.5);out.start=box(.02,.58,.96,.4);break;
  case 'clock-calendar':out.month=box(.02,.02,.96,.25);out.days=box(.02,.3,.96,.68);break;
  case 'theme-mode':case 'theme-accent':row();break;
  case 'theme-slideshow':row([3,1]);break;
  case 'terminal-output':out.prompt=box(.02,.02,.96,.23);out.output=box(.02,.3,.96,.68);break;
  case 'terminal-commands':case 'terminal-history':row([2,3]);break;
  case 'terminal-interval':row([3,1]);break;
  case 'manager-processes':row([5,3,2]);break;
  case 'manager-performance':row([2,3]);break;
  case 'plugin-tabs':case 'stream-scenes':out[part.id==='plugin-tabs'?'tab':'scene']=box(.02,.02,.96,.25);out[part.id==='plugin-tabs'?'page':'preview']=box(.02,.3,.96,.68);break;
  case 'plugin-table':row();break;
  case 'stream-preview':out.image=box(.02,.02,.96,.96);out.source=box(.02,.8,.96,.18);break;
  case 'stream-sources':row([3,1]);break;
  case 'stream-comments':row([4,1]);break;
  default:row();
 }
 return out;
}
