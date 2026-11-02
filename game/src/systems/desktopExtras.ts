import { hasAppPart, ownFeaturePart } from './appBuild';
import { resizeDesktop,fitWindow,workHeight } from './desktopGeometry';
import { setDesktopStage, type VisualStage } from './appearance';
import { BALANCE, type DesktopSkill } from '../config/balance';
import { createI18n } from '../content/i18n';
import { PRACTICE_IDS } from '../content/kumikiArt';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { desktopFiles } from './desktopFiles';
import { hasDesktopSkill, hasUpgrade, jobCapacity, jobCursorQuote, jobUpdateCost } from './desktopJobs';
import { JOB_IDS, type AppId, type DesktopState, type JobId, type PhotoEdit } from './desktopState';
import { readCapture } from './captureScene';
import type { GameState } from './state';
export type ExtraAction =
 | {type:'job-assign'|'job-buy'|'job-update';app:JobId}
 | {type:'sort';by:'name'|'date'|'type'} | {type:'search';text:string} | {type:'large'}
 | {type:'mail-folder';folder:DesktopState['mailFolder']}
 | {type:'photo';edit:Partial<PhotoEdit>} | {type:'compare'} | {type:'wallpaper'}
 | {type:'trash';id:string} | {type:'undo-trash';id:string} | {type:'empty-trash'}
 | {type:'reserve';at:number} | {type:'cancel-reservation'}
 | {type:'terminal';interval:number;running:boolean}
 | {type:'theme';mode?:'light'|'dark';accent?:string;radius?:number;autoRadius?:boolean;iconSize?:number;slideshow?:boolean}
 | {type:'skill';id:DesktopSkill} | {type:'toggle-skill';id:DesktopSkill}
 | {type:'workspace';workspace:0|1} | {type:'move-workspace';app:AppId}
 | {type:'manager-tab';tab:DesktopState['managerTab']} | {type:'manager-process';process:string} | {type:'calendar-month';at:number}
 | {type:'desktop-stage';stage:VisualStage}
 | {type:'settings-page';page:DesktopState['settingsPage']} | {type:'restart';app:AppId} | {type:'activity'};
const desktop=(s:GameState,patch:Partial<DesktopState>):GameState=>({...s,run:{...s.run,desktop:{...s.run.desktop,...patch}}});
export function completeRequests(s:GameState,kinds:string[],now:number,automatic=false):GameState {
 const pending=s.run.desktop.feedback.filter(f=>f.completedAt===null&&kinds.includes(f.kind));if(!pending.length)return s;
 const reward=BALANCE.w3.feedbackTokens*(automatic?BALANCE.w3.autoFeedbackMultiplier:1);
 return desktop({...s,resources:{...s.resources,tokens:s.resources.tokens+pending.length*reward}},{feedback:s.run.desktop.feedback.map(f=>pending.includes(f)?{...f,completedAt:now,reward}:f),notice:pending.some(f=>f.id===s.run.desktop.notice)?null:s.run.desktop.notice,success:pending.at(-1)!.id});
}
export function recycleValue(s:GameState,id:string):number {
 if(s.run.desktop.recycled.includes(id))return 0;
 if(id.startsWith('shot:'))return passivePixelsPerSecond(s)*BALANCE.w3.recycleShotSeconds;
 const work=s.run.kumiki.exports.find(e=>id===`current:icon:${e.id}`&&PRACTICE_IDS.includes(e.id as 'document'));
 const drawing=work?s.run.kumiki.drawings[work.id]:null;
 return work?(drawing?.earnedPixels??(drawing?.rewarded.filter(Boolean).length??work.frames[0]!.filter(c=>c>=0).length)*BALANCE.w2.dotValue)*BALANCE.w3.recycleIconMultiplier:0;
}
export function actDesktopExtra(s:GameState,a:ExtraAction,now:number,language='ja'):GameState {
 const d=s.run.desktop,p=s.persistent.desktopPrefs;
 switch(a.type){
 case 'activity':return d.idleMs?desktop(s,{idleMs:0}):s;
 case 'job-assign':case 'job-buy':case 'job-update':{
  if(!hasUpgrade(s,'jobs')||!JOB_IDS.includes(a.app)||(a.app!=='tessera'&&!d.apps.includes(a.app)))return s;
  const j=d.jobs[a.app];
  if(a.type==='job-assign'){
   if(!j.assigned&&JOB_IDS.filter(id=>d.jobs[id].assigned).length>=jobCapacity(s))return s;
   return desktop(s,{jobs:{...d.jobs,[a.app]:{...j,assigned:!j.assigned}}});
  }
  const quantity=a.type==='job-buy'?jobCursorQuote(s,a.app).count:1;
  const cost=a.type==='job-buy'?jobCursorQuote(s,a.app).cost:jobUpdateCost(s,a.app);
  if(quantity<1||s.resources.pixels<cost||a.type==='job-buy'&&j.cursors>=10000||a.type==='job-update'&&j.updates>=100)return s;
  return desktop({...s,resources:{...s.resources,pixels:s.resources.pixels-cost}},{jobs:{...d.jobs,[a.app]:{...j,...(a.type==='job-buy'?{cursors:j.cursors+quantity}:{updates:j.updates+1})}}});
 }
 case 'sort':return hasUpgrade(s,'sort')?completeRequests(desktop(s,{fileSort:a.by,fileDescending:d.fileSort===a.by?!d.fileDescending:false}),a.by==='date'?['sort']:[],now):s;
 case 'search':{
  if(!hasUpgrade(s,'search')||a.text.length>120)return s;
  let next=desktop(s,{fileSearch:a.text});
  const names=d.feedback.filter(f=>f.kind==='search'&&f.completedAt===null).map(f=>f.target==='home'?createI18n(language).t('files.home').toLocaleLowerCase():f.target.toLocaleLowerCase());
  if(a.text.trim()&&names.some(name=>a.text.trim().toLocaleLowerCase()===name))next=completeRequests(next,['search'],now);
  return next;
 }
 case 'large':return hasUpgrade(s,'large')?desktop(s,{largeIcons:!d.largeIcons}):s;
 case 'mail-folder':return hasAppPart(s,'mail','folders')&&(hasUpgrade(s,'folders')||hasDesktopSkill(s,'sortMail'))?desktop(s,{mailFolder:a.folder,mailSelection:null}):s;
 case 'photo':{
  if(!d.apps.includes('photo'))return s;
  if(a.type==='photo'&&Object.keys(a.edit).some(key=>!hasAppPart(s,'photo',key==='brightness'?'brightness':key==='tone'?'tone':key==='crop'?'crop':'source')))return s;
  const edit={...d.photo,...a.edit};
  if(!['coast','night','sketch',...s.persistent.screenshots.filter(x=>!x.deleted).map(x=>`shot:${x.id}`)].includes(edit.source))return s;
  if(!Number.isFinite(edit.brightness)||edit.brightness<.5||edit.brightness>1.5||!Number.isFinite(edit.tone)||edit.tone< -50||edit.tone>50||!Number.isFinite(edit.crop)||edit.crop<0||edit.crop>40||!hasUpgrade(s,'crop')&&a.edit.crop!==undefined&&a.edit.crop!==0)return s;
  return desktop(s,{photo:edit});
 }
 case 'compare':return hasUpgrade(s,'compare')?desktop(s,{compare:!d.compare}):s;
 case 'wallpaper':{
  if(!hasAppPart(s,'photo','wallpaper')||!hasAppPart(s,'photo','image'))return s;
  const next={...s,persistent:{...s.persistent,desktopPrefs:{...p,wallpaper:{...d.photo}},artwork:{...s.persistent.artwork,wallpaper:d.photo.source==='sketch'?structuredClone(s.persistent.artwork.sketchbook):null}}};
  return d.photo.brightness>1?completeRequests(next,['bright'],now):next;
 }
 case 'trash':{
  if(!hasAppPart(s,'bin','trash')||d.trash.some(t=>t.id===a.id))return s;
  const file=[...desktopFiles(s,createI18n(language),'screenshots'),...desktopFiles(s,createI18n(language),'exports')].find(f=>f.id===a.id);
  if(!file||!(file.kind==='shot'||file.kind==='icon'&&file.id.startsWith('current:icon:')&&PRACTICE_IDS.includes(file.work!.id as 'document')))return s;
  const reward=recycleValue(s,a.id);
  let next=desktop(creditPixels(s,reward),{trash:[...d.trash,{id:a.id,at:now,reward,first:!d.recycled.includes(a.id)}],recycled:[...new Set([...d.recycled,a.id])],trashCount:d.trashCount+(file.kind==='shot'?1:0),fileSelection:null});
  if(file.kind==='shot'){next=desktop(next,{feedback:next.run.desktop.feedback.map(f=>f.kind==='trash'&&f.completedAt===null?{...f,baseline:[...new Set([...f.baseline,file.shot!.id])]}:f)});if(next.run.desktop.feedback.some(f=>f.kind==='trash'&&f.completedAt===null&&f.baseline.length>=3))next=completeRequests(next,['trash'],now);}
  return next;
 }
 case 'undo-trash':{
  if(!hasUpgrade(s,'undo'))return s;
  const item=d.trash.find(t=>t.id===a.id);if(!item||s.resources.pixels<item.reward)return s;
  // Repay the original reward; repeated discard/restore never creates pixels.
  return desktop({...s,resources:{...s.resources,pixels:s.resources.pixels-item.reward},run:{...s.run,totalPixelsGenerated:s.run.totalPixelsGenerated-item.reward}},{feedback:d.feedback.map(f=>f.kind==='trash'&&f.completedAt===null?{...f,baseline:f.baseline.filter(id=>`shot:${id}`!==a.id)}:f),trash:d.trash.filter(t=>t!==item),recycled:item.first?d.recycled.filter(id=>id!==a.id):d.recycled});
 }
 case 'empty-trash':{
  if(!hasAppPart(s,'bin','empty')||!d.trash.length)return s;
  const ids=new Set(d.trash.map(t=>t.id));
  const screenshots=s.persistent.screenshots.map(shot=>ids.has(`shot:${shot.id}`)?{...shot,deleted:true}:shot);
  let next=desktop({...s,persistent:{...s.persistent,screenshots},run:{...s.run,kumiki:{...s.run.kumiki,exports:s.run.kumiki.exports.filter(e=>!ids.has(`current:${e.kind}:${e.id}`))}}},{trash:[]});
  // Referenced historical previews remain readable; collect only unreachable images.
  const retained=new Set(screenshots.filter(shot=>!shot.deleted).map(shot=>shot.id));
  const rootSources=[p.wallpaper?.source,d.photo.source];for(const source of rootSources)if(source?.startsWith('shot:'))retained.add(Number(source.slice(5)));
  const visit=(id:number)=>{const shot=screenshots.find(x=>x.id===id);if(!shot)return;const scene=readCapture(shot);const refs=scene.files.flatMap(f=>f.shotId?[f.shotId]:[]);if(scene.version!==1)for(const source of [scene.view.photo.source,scene.view.preferences.wallpaper?.source])if(source?.startsWith('shot:'))refs.push(Number(source.slice(5)));for(const ref of refs)if(!retained.has(ref)){retained.add(ref);visit(ref);}};
  for(const id of [...retained])visit(id);
  next={...next,persistent:{...next.persistent,screenshots:screenshots.filter(shot=>retained.has(shot.id))}};
  return next;
 }
 case 'reserve':{
  if(!hasUpgrade(s,'timer')||!Number.isFinite(a.at)||a.at<=now||a.at>now+BALANCE.w3.timerMaxDays*24*BALANCE.time.millisecondsPerHour)return s;
  const actual=new Date(a.at);
  const matches=d.feedback.some(f=>{const requested=new Date(Number(f.target));return f.kind==='timer'&&f.completedAt===null&&actual.getHours()===requested.getHours()&&actual.getMinutes()===requested.getMinutes();});
  const next=desktop(s,{reservation:{at:a.at,done:false}});return matches?completeRequests(next,['timer'],now):next;
 }
 case 'cancel-reservation':return desktop(s,{reservation:null});
 case 'terminal':return hasAppPart(s,'terminal','commands')&&(BALANCE.w3.terminalIntervals as readonly number[]).includes(a.interval)?desktop(s,{terminal:{...d.terminal,interval:a.interval,running:a.running,elapsedMs:0}}):s;
 case 'theme':{
  if((a.mode!==undefined||a.accent!==undefined||a.radius!==undefined||a.autoRadius!==undefined)&&!hasAppPart(s,'theme','appearance'))return s;
  const prefs={...p};
  if(a.mode==='light'||a.mode==='dark')prefs.mode=a.mode;
  if(a.accent&&/^#[0-9a-f]{6}$/i.test(a.accent))prefs.accent=a.accent;
  if(a.radius!==undefined&&Number.isFinite(a.radius)){prefs.radius=Math.max(0,Math.min(8,a.radius));prefs.radiusCustom=true;}
  if(typeof a.autoRadius==='boolean')prefs.radiusCustom=!a.autoRadius;
  if(a.iconSize!==undefined&&[32,48,64].includes(a.iconSize)&&hasUpgrade(s,'iconSize'))prefs.iconSize=a.iconSize;
  if(typeof a.slideshow==='boolean'&&hasUpgrade(s,'slideshow'))prefs.slideshow=a.slideshow;
  let next:GameState={...s,persistent:{...s.persistent,desktopPrefs:prefs},run:{...s.run,seed:{...s.run.seed,page:{...s.run.seed.page,button:prefs.accent}},kumiki:{...s.run.kumiki,design:{...s.run.kumiki.design,primary:{...(s.run.kumiki.design.primary??{radius:0,textSize:'medium' as const,shadow:false}),color:prefs.accent}}}}};
  if(a.iconSize!==undefined)next={...next,run:{...next.run,desktop:resizeDesktop(next.run.desktop,next.run.desktop.screen,prefs.iconSize)}};
  if(prefs.mode==='dark')next=completeRequests(next,['dark'],now);return next;
 }
 case 'skill':{
  if(a.id==='major2'&&!p.skills.includes('major1'))return s;
  const skill=BALANCE.w3.skills.find(x=>x.id===a.id);if(!skill||p.skills.includes(a.id)||skill.band===2&&s.run.version==='v0.1'||s.resources.tokens<skill.cost)return s;
  const next:GameState={...s,resources:{...s.resources,tokens:s.resources.tokens-skill.cost},persistent:{...s.persistent,desktopPrefs:{...p,skills:[...p.skills,a.id]}},run:{...s.run,desktop:{...d,...(a.id==='burst'?{cooldownMs:d.cooldownMs*BALANCE.w3.burstMultiplier}:{}),...(a.id==='sortMail'?{mailFolder:'pending' as const}:{})}}};
  return a.id==='major1'?setDesktopStage(next,1):a.id==='major2'?setDesktopStage(next,2):a.id==='sortMail'?ownFeaturePart(next,'folders','mail'):next;
 }
 case 'toggle-skill':{
  if(!p.skills.includes(a.id)||!BALANCE.w3.skills.find(x=>x.id===a.id)?.playful)return s;
  return {...s,persistent:{...s.persistent,desktopPrefs:{...p,disabled:p.disabled.includes(a.id)?p.disabled.filter(id=>id!==a.id):[...p.disabled,a.id]}}};
 }
 case 'workspace':return hasDesktopSkill(s,'virtual')?desktop(s,{workspace:a.workspace,active:null}):s;
 case 'move-workspace':return hasDesktopSkill(s,'virtual')?desktop(s,{workspaces:{...d.workspaces,[a.app]:d.workspaces[a.app]===0?1:0},active:null}):s;
 case 'manager-tab':return ['processes','performance'].includes(a.tab)?desktop(s,{managerTab:a.tab}):s;
 case 'manager-process':return ['home','shots','feedback',...JOB_IDS].includes(a.process)?desktop(s,{managerProcess:a.process}):s;
 case 'calendar-month':return Number.isFinite(a.at)&&a.at>=0?desktop(s,{calendarMonth:a.at}):s;
 case 'desktop-stage':return setDesktopStage(s,a.stage);
 case 'settings-page':return desktop(s,{settingsPage:a.page});
 case 'restart':return d.stalled===a.app?desktop(creditPixels(s,passivePixelsPerSecond(s)*BALANCE.w3.restartSeconds),{stalled:null,stalledClosed:false,stallMs:BALANCE.w3.stallMinMs+(d.stallSerial*7919)%(BALANCE.w3.stallMaxMs-BALANCE.w3.stallMinMs)}):s;
 }
}

export function refreshDesktop(s:GameState,now:number):GameState {
 if(s.run.world!=='desktop'||!hasAppPart(s,'terminal','commands')||s.persistent.progress.records['secret-clock']===undefined||now-s.run.play.refreshAt<BALANCE.longPlay.refreshCooldownMs)return s;
 const d=s.run.desktop,apps=Object.entries(d.windows).filter(([,w])=>w.open&&!w.minimized).map(([id])=>id as AppId),step=d.screen.width===800?22:d.screen.width===1024?30:34,windows={...d.windows};
 // Cascade when native minimum sizes make a full tile impossible. Keep every title reachable.
 for(const [i,app] of apps.entries())windows[app]={...windows[app],...fitWindow(app,{x:16+i*8,y:16+i*step,width:d.screen.width-32-Math.max(0,apps.length-1)*8,height:Math.max(240,Math.min(360,workHeight(d.screen)-32-Math.max(0,apps.length-1)*step))},d.screen),maximized:false,restore:null};
 const next=desktop(creditPixels(s,passivePixelsPerSecond(s)*BALANCE.longPlay.refreshSeconds),{windows});return {...next,run:{...next.run,play:{...next.run.play,refreshAt:now}}};
}
