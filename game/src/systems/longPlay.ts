import {BALANCE} from '../config/balance';
import {ICON_IDS,PRACTICE_IDS} from '../content/kumikiArt';
import type {GameState} from './state';
export const ACHIEVEMENTS=['first-pixel','save-created','cursors10','cursors50','kumiki-created','first-export','icons6','practice10','parts-all','repairs10','editor-update','editor-modern','desktop-update','product-name','prototype-released','v1-released','first-shot','shots100','feedback10','feedback50','jobs-full','apps7','wallpaper','terminal','restarts10','secret-button','secret-art','secret-clock'] as const;
export type AchievementId=typeof ACHIEVEMENTS[number];
export const CONTRACTS=[{id:'no-cursors',blocked:'cursor',reward:'wallpaper'},{id:'no-color',blocked:'color',reward:'theme'}] as const;
export type ContractId=typeof CONTRACTS[number]['id'];
export type BulkMode='one'|'ten'|'max';
export interface Progress {
 records:Partial<Record<AchievementId,number>>;
 counts:{repairs:number;restarts:number;shots:number;feedback:number;preBorder:number;icons:number};
 completed:Partial<Record<ContractId,number>>;selected:ContractId|null;cosmetic:ContractId|null;
 sound:{enabled:boolean;volume:number};bulk:BulkMode;unknownArt:{size:number;frames:number[][]}|null;noteOverflow:boolean;
}
export interface PlayState {
 achievement:{id:AchievementId;until:number}|null;contract:{id:ContractId;status:'active'|'complete'|'cancelled'}|null;
 stray:{waitMs:number;lifeMs:number;x:number;y:number;serial:number};
 clock:{count:number;lastAt:number};refreshAt:number;letterOpen:boolean;terminalCommand:'capture'|'export'|'refresh';
}
export const createProgress=():Progress=>({records:{},counts:{repairs:0,restarts:0,shots:0,feedback:0,preBorder:0,icons:0},completed:{},selected:null,cosmetic:null,sound:{enabled:true,volume:BALANCE.longPlay.soundVolume},bulk:'one',unknownArt:null,noteOverflow:false});
export const createPlay=():PlayState=>({achievement:null,contract:null,stray:{waitMs:BALANCE.longPlay.strayMinMs,lifeMs:0,x:0,y:0,serial:0},clock:{count:0,lastAt:0},refreshAt:0,letterOpen:false,terminalCommand:'capture'});
export const globalMultiplier=(s:GameState)=>s.legacyGeneration||!s.persistent.progress?1:1+Object.keys(s.persistent.progress.records).length*BALANCE.longPlay.achievementBonus+Object.keys(s.persistent.progress.completed).length*BALANCE.longPlay.contractBonus;
export function previousWorldMultiplier(s:GameState){if(s.legacyGeneration||!s.persistent.progress)return 1;const icons=new Set([...s.run.kumiki.exports,...s.persistent.products.flatMap(p=>p.exports)].filter(w=>w.kind==='icon').map(w=>`${w.at}:${w.id}`)).size;return (1+Math.min(BALANCE.longPlay.iconCap,Math.max(icons,s.persistent.progress.counts.icons))*BALANCE.longPlay.iconBonus)*(1+s.run.seed.autoCursors*BALANCE.longPlay.cursorBonus);}
export const activeContract=(s:GameState)=>s.run.play.contract?.status==='active'?s.run.play.contract.id:null;
export const contractBlocks=(s:GameState,id:string)=>CONTRACTS.some(c=>c.id===activeContract(s)&&c.blocked===id);
export function reconcileProgress(s:GameState,now:number):GameState {
 const p=s.persistent.progress,k=s.run.kumiki,d=s.run.desktop,archived=s.persistent.products;
 const known=[...k.exports,...archived.flatMap(p=>p.exports)];
 const tests:Record<AchievementId,boolean>={
 'first-pixel':s.run.totalPixelsGenerated>0||archived.some(p=>p.generatedPixels>0),'save-created':s.run.seed.built.includes('save')||archived.some(p=>p.screen.built.includes('save')),
 cursors10:s.run.seed.autoCursors>=10||archived.some(p=>p.screen.cursors>=10),cursors50:s.run.seed.autoCursors>=50||archived.some(p=>p.screen.cursors>=50),
 'kumiki-created':s.run.seed.built.includes('kumiki')||k.entered||archived.length>0,'first-export':known.length>0,
 icons6:ICON_IDS.every(id=>known.some(w=>w.kind==='icon'&&w.id===id)),practice10:PRACTICE_IDS.every(id=>known.some(w=>w.kind==='icon'&&w.id===id)),
 'parts-all':['button','input','frame','taskbar'].every(id=>k.placed.includes(id as 'input'))||archived.some(p=>['button','input','frame','taskbar'].every(id=>p.screen.placed.includes(id as 'input'))),
 repairs10:p.counts.repairs>=10,'editor-update':s.persistent.artwork.skills.includes('update'),'editor-modern':s.persistent.artwork.skills.includes('modern'),'desktop-update':s.persistent.desktopPrefs.skills.includes('major1'),
 'product-name':!!s.persistent.productName||archived.some(p=>!!p.name),'prototype-released':archived.length>0,'v1-released':s.run.version==='v2',
 'first-shot':p.counts.shots>0||s.persistent.screenshots.length>0,shots100:p.counts.shots>=100||s.persistent.screenshots.length>=100,
 feedback10:p.counts.feedback>=10||d.feedback.filter(f=>f.completedAt!==null).length>=10,feedback50:p.counts.feedback>=50||d.feedback.filter(f=>f.completedAt!==null).length>=50,
 'jobs-full':d.upgrades.includes('jobs')&&Object.values(d.jobs).filter(j=>j.assigned&&j.cursors>0).length>=BALANCE.spec.memory[s.persistent.specs.memory]!.posts+(s.persistent.desktopPrefs.skills.includes('posts')&&!s.persistent.desktopPrefs.disabled.includes('posts')?BALANCE.w3.extraPosts:0),
 apps7:d.entered&&d.apps.length+1>=7,wallpaper:s.persistent.desktopPrefs.wallpaper!==null,terminal:d.terminal.executions>0,restarts10:p.counts.restarts>=10,
 'secret-button':p.counts.preBorder>=BALANCE.longPlay.secretPresses,'secret-art':p.unknownArt!==null,'secret-clock':p.records['secret-clock']!==undefined,
 };
 let records=p.records;for(const id of ACHIEVEMENTS)if(tests[id]&&records[id]===undefined)records={...records,[id]:now};
 let next=records===p.records?s:{...s,persistent:{...s.persistent,progress:{...p,records}}};
 const contract=next.run.play.contract;
 if(contract?.status==='active'&&k.entered){
  const definition=CONTRACTS.find(c=>c.id===contract.id)!;
  const ok=definition.blocked==='cursor'?s.run.seed.autoCursors===0:!s.run.seed.built.includes(definition.blocked);
  const completed=ok?{...next.persistent.progress.completed,[contract.id]:next.persistent.progress.completed[contract.id]??now}:next.persistent.progress.completed;
  next={...next,persistent:{...next.persistent,progress:{...next.persistent.progress,completed}},run:{...next.run,play:{...next.run.play,contract:{...contract,status:ok?'complete':'cancelled'}}}};
 }
 return next;
}
export function migrateProgress(s:GameState):GameState {
 const p=s.persistent.progress;
 return reconcileProgress({...s,persistent:{...s.persistent,progress:{...p,counts:{...p.counts,shots:Math.max(s.persistent.screenshots.length,s.persistent.desktopPrefs.lastShotId),icons:new Set([...s.run.kumiki.exports,...s.persistent.products.flatMap(p=>p.exports)].filter(w=>w.kind==='icon').map(w=>`${w.at}:${w.id}`)).size,feedback:s.run.desktop.feedback.filter(f=>f.completedAt!==null).length}}}},s.lastTickAt);
}
export const bulkVisible=(s:GameState)=>s.run.seed.autoCursors>BALANCE.longPlay.bulkUnlock;
export function advanceStray(s:GameState,ms:number):GameState {
 if(s.run.world!=='seed'||!s.run.seed.built.includes('color')||activeContract(s)==='no-color'||s.run.seed.installer||s.run.restartMs)return s;
 const old=s.run.play.stray;let stray={...old};
 if(stray.lifeMs>0){stray.lifeMs=Math.max(0,stray.lifeMs-ms);if(!stray.lifeMs)stray.waitMs=BALANCE.longPlay.strayMinMs+(stray.serial*7919)%(BALANCE.longPlay.strayMaxMs-BALANCE.longPlay.strayMinMs)-BALANCE.longPlay.strayLifeMs;}
 else{stray.waitMs=Math.max(0,stray.waitMs-ms);if(!stray.waitMs){stray.serial++;stray.lifeMs=BALANCE.longPlay.strayLifeMs;stray.x=.08+(stray.serial*37%80)/100;stray.y=.08+(stray.serial*19%70)/100;}}
 return {...s,run:{...s.run,play:{...s.run.play,stray}}};
}
export type CommonAction={type:'sound';enabled?:boolean;volume?:number}|{type:'bulk';mode:BulkMode}|{type:'contract-select';id:ContractId|null}|{type:'contract-cancel'}|{type:'cosmetic';id:ContractId|null}|{type:'letter-open'|'letter-close'|'clock-click'}|{type:'terminal-command';command:PlayState['terminalCommand']};
export function actCommon(s:GameState,a:CommonAction,now:number):GameState {
 let p=s.persistent.progress,play=s.run.play;
 if(a.type!=='clock-click'&&play.clock.count)play={...play,clock:{...play.clock,count:0}};
 if(a.type==='terminal-command'){if(s.run.world!=='desktop'||!['capture','export','refresh'].includes(a.command)||a.command==='refresh'&&p.records['secret-clock']===undefined)return s;play={...play,terminalCommand:a.command};}
 if(a.type==='sound'){if(a.volume!==undefined&&(!Number.isFinite(a.volume)||a.volume<0||a.volume>1))return s;p={...p,sound:{enabled:a.enabled??p.sound.enabled,volume:a.volume??p.sound.volume}};}
 if(a.type==='bulk'){if(!bulkVisible(s)||!['one','ten','max'].includes(a.mode))return s;p={...p,bulk:a.mode};}
 if(a.type==='contract-select'){if(s.run.world!=='release'||p.records['v1-released']===undefined||a.id!==null&&(!CONTRACTS.some(c=>c.id===a.id)||p.completed[a.id]!==undefined))return s;p={...p,selected:a.id};}
 if(a.type==='contract-cancel'){if(!activeContract(s))return s;play={...play,contract:{...play.contract!,status:'cancelled'}};}
 if(a.type==='cosmetic'){if(a.id!==null&&p.completed[a.id]===undefined)return s;p={...p,cosmetic:a.id};}
 if(a.type==='letter-open'){if(s.run.world!=='desktop'||!p.unknownArt)return s;play={...play,letterOpen:true};}
 if(a.type==='letter-close')play={...play,letterOpen:false};
 if(a.type==='clock-click'){
  if(s.run.world!=='desktop'||!s.run.desktop.apps.includes('clock'))return s;
  const count=now-play.clock.lastAt>BALANCE.longPlay.clockChainMs?1:play.clock.count+1;play={...play,clock:{count,lastAt:now}};
  if(count>=BALANCE.longPlay.secretClockClicks&&p.records['secret-clock']===undefined)p={...p,records:{...p.records,'secret-clock':now}};
 }
 return {...s,persistent:{...s.persistent,progress:p},run:{...s.run,play}};
}
export function isProgress(v:unknown):v is Progress {
 if(!v||typeof v!=='object')return false;const p=v as Progress,amount=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,table=(v:unknown,ids:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([id,at])=>ids.includes(id)&&amount(at));
 return table(p.records,ACHIEVEMENTS)&&table(p.completed,CONTRACTS.map(c=>c.id))&&!!p.counts&&['repairs','restarts','shots','feedback','preBorder','icons'].every(k=>Number.isSafeInteger(p.counts[k as keyof Progress['counts']])&&p.counts[k as keyof Progress['counts']]>=0)&&(p.selected===null||CONTRACTS.some(c=>c.id===p.selected))&&(p.cosmetic===null||CONTRACTS.some(c=>c.id===p.cosmetic))&&!!p.sound&&typeof p.sound.enabled==='boolean'&&amount(p.sound.volume)&&p.sound.volume<=1&&typeof p.noteOverflow==='boolean'&&['one','ten','max'].includes(p.bulk)&&(p.unknownArt===null||!!p.unknownArt&&[16,32,64,128].includes(p.unknownArt.size)&&Array.isArray(p.unknownArt.frames)&&p.unknownArt.frames.length>0&&p.unknownArt.frames.length<=2&&p.unknownArt.frames.every(f=>Array.isArray(f)&&f.length===p.unknownArt!.size**2&&f.every(c=>Number.isInteger(c)&&c>=-1&&c<256)));
}
export function isPlay(v:unknown):v is PlayState {
 if(!v||typeof v!=='object')return false;const p=v as PlayState,n=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 return (p.achievement===null||!!p.achievement&&ACHIEVEMENTS.includes(p.achievement.id)&&n(p.achievement.until))&&(p.contract===null||!!p.contract&&CONTRACTS.some(c=>c.id===p.contract!.id)&&['active','complete','cancelled'].includes(p.contract.status))&&!!p.stray&&[p.stray.waitMs,p.stray.lifeMs,p.stray.x,p.stray.y,p.stray.serial].every(n)&&p.stray.lifeMs<=BALANCE.longPlay.strayLifeMs&&p.stray.x<=1&&p.stray.y<=1&&Number.isSafeInteger(p.stray.serial)&&!!p.clock&&Number.isSafeInteger(p.clock.count)&&n(p.clock.count)&&n(p.clock.lastAt)&&n(p.refreshAt)&&typeof p.letterOpen==='boolean'&&['capture','export','refresh'].includes(p.terminalCommand);
}
