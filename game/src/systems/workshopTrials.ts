import { BALANCE } from '../config/balance';
import { finishTrialFor } from '../content/workshopTrials';
import type { WorkshopPartId } from '../content/workshopCatalog';

export interface FinishTrialState {
 done:boolean;window:'normal'|'minimized'|'maximized'|'closed';expanded:boolean;collapsedOnce:boolean;
 started:boolean;app:'files'|'mail';area:{x:number;y:number;width:number;height:number}|null;
 selected:string|null;folder:'all'|'sets'|'exports';baseFolder:'all'|'sets'|'exports';sort:'name'|'date'|'type';query:string;large:boolean;
 fit:'contain'|'cover';draftOpen:boolean;draft:string;archived:boolean;read:boolean;unreadTried:boolean;
}
export const createFinishTrialState=():FinishTrialState=>({done:false,window:'normal',expanded:true,collapsedOnce:false,started:false,app:'files',area:null,selected:null,folder:'all',baseFolder:'all',sort:'name',query:'',large:false,fit:'contain',draftOpen:false,draft:'',archived:false,read:true,unreadTried:false});
export type FinishTrialAction =
 | {type:'window';mode:FinishTrialState['window']} | {type:'scroll';position:number;extent:number}
 | {type:'press';control:'apply'|'notification'|'upgrades'|'storage'} | {type:'heading';expanded:boolean}
 | {type:'fill-start'} | {type:'fill-end'} | {type:'app';app:'files'|'mail'}
 | {type:'area';x:number;y:number;width:number;height:number} | {type:'icon-open';id:string}
 | {type:'fit';fit:'contain'|'cover'} | {type:'file';id:string}
 | {type:'folder';folder:FinishTrialState['folder']} | {type:'back'} | {type:'sort';key:FinishTrialState['sort']}
 | {type:'query';query:string;matches:boolean} | {type:'large';large:boolean} | {type:'message';id:string}
 | {type:'draft-open'} | {type:'draft-input';text:string} | {type:'draft-save'}
 | {type:'archive'} | {type:'mail-folder';folder:'inbox'|'archive'}
 | {type:'read-toggle';read:boolean} | {type:'message-read'};

/** Local testing evidence only. Completion still goes through the existing four-stage reducer once. */
export function advanceFinishTrial(part:WorkshopPartId,state:FinishTrialState,action:FinishTrialAction):FinishTrialState {
 if(state.done)return state;
 const kind=finishTrialFor(part)?.kind;
 switch(kind){
  case 'window':return action.type==='window'?{...state,window:action.mode,done:action.mode==='normal'&&state.window!=='normal'}:state;
  case 'scroll-page':case 'mail-body':return action.type==='scroll'&&Number.isFinite(action.extent)&&Number.isFinite(action.position)&&action.extent>0&&action.position>0&&action.position>=action.extent-BALANCE.workshop.testplay.minimumScrollPixels?{...state,done:true}:state;
  case 'apply':case 'notification':case 'upgrades':case 'storage':return action.type==='press'&&action.control===kind?{...state,done:true}:state;
  case 'heading':return action.type==='heading'?{...state,expanded:action.expanded,collapsedOnce:state.collapsedOnce||!action.expanded,done:state.collapsedOnce&&action.expanded}:state;
  case 'progress':return action.type==='fill-start'?{...state,started:true}:action.type==='fill-end'&&state.started?{...state,done:true}:state;
  case 'taskbar':return action.type==='app'?{...state,app:action.app,done:action.app!==state.app}:state;
  case 'selection':return action.type==='area'&&[action.x,action.y,action.width,action.height].every(Number.isFinite)&&action.width>=BALANCE.workshop.testplay.selectionMinSize&&action.height>=BALANCE.workshop.testplay.selectionMinSize?{...state,area:{x:action.x,y:action.y,width:action.width,height:action.height},done:true}:state;
  case 'icon':return action.type==='icon-open'&&action.id?{...state,selected:action.id,done:true}:state;
  case 'wallpaper':return action.type==='fit'?{...state,fit:action.fit,done:action.fit!==state.fit}:state;
  case 'file-list':return action.type==='file'&&action.id?{...state,selected:action.id,done:true}:state;
  case 'back':return action.type==='folder'&&action.folder!==state.folder?{...state,folder:action.folder,started:true}:action.type==='back'&&state.started?{...state,folder:state.baseFolder,done:true}:state;
  case 'sort':return action.type==='sort'?{...state,sort:action.key,done:action.key==='date'}:state;
  case 'search':return action.type==='query'?{...state,query:action.query,done:Boolean(action.query.trim())&&action.matches}:state;
  case 'large':return action.type==='large'?{...state,large:action.large,done:action.large}:state;
  case 'mail-list':return action.type==='message'&&action.id?{...state,selected:action.id,done:true}:state;
  case 'reply':return action.type==='draft-open'?{...state,draftOpen:true}:action.type==='draft-input'?{...state,draft:action.text}:action.type==='draft-save'&&state.draftOpen&&state.draft.trim()?{...state,done:true}:state;
  case 'folders':return action.type==='archive'?{...state,archived:true}:action.type==='mail-folder'&&action.folder==='archive'&&state.archived?{...state,done:true}:state;
  case 'unread':return action.type==='read-toggle'?{...state,read:action.read,unreadTried:state.unreadTried||!action.read}:action.type==='message-read'&&state.unreadTried?{...state,read:true,done:true}:state;
  default:return state;
 }
}
