import { BALANCE } from '../config/balance';
import { getWorkshopPart, type UiSetId, type WorkshopPartId, type WorkshopRect } from './workshopCatalog';

export const GROUP_IDS=['required','foundation','photo','bin','clock','theme','terminal','manager','extras','stream'] as const;
export type WorkshopGroupId=typeof GROUP_IDS[number];
export type WorkshopToolId='files'|'mail'|'foundation'|'photo'|'bin'|'clock'|'theme'|'terminal'|'manager'|'tabs'|'table';
export type GroupCategory='required'|'desktop'|'optional';
export interface GroupPieceDefinition {id:string;parts:WorkshopPartId[];rect:WorkshopRect;label:string;slots?:{part:WorkshopPartId;rect:WorkshopRect}[]}
export interface GroupToolDefinition {id:WorkshopToolId;group:WorkshopGroupId;set:UiSetId;base:string;width:number;height:number;tokens:number;pieces:GroupPieceDefinition[]}
const rect=(x:number,y:number,width:number,height:number):WorkshopRect=>({x,y,width,height});
const slot=(part:WorkshopPartId,x:number,y:number,width:number,height:number)=>({part,rect:rect(x,y,width,height)});
const piece=(id:string,label:string,r:WorkshopRect,parts:WorkshopPartId[],slots?:GroupPieceDefinition['slots']):GroupPieceDefinition=>({id,label,rect:r,parts,slots});
const frame=()=>piece('frame','group.piece.frame',rect(0,0,672,448),[]);
export const GROUP_TOOLS:readonly GroupToolDefinition[]=[
 {id:'files',group:'required',set:'files',base:'frame',width:672,height:448,tokens:6,pieces:[frame(),
  piece('heading','ws.part.common-heading',rect(8,40,624,48),[],[slot('common-heading',0,0,624,48)]),
  piece('list','ws.part.files-list',rect(8,224,624,144),['files-list']),
  piece('toolbar','group.piece.toolbar',rect(8,96,624,120),['files-back','files-sort','files-search'],[slot('files-back',0,0,144,44),slot('files-sort',152,0,472,44),slot('files-search',0,52,624,68)]),
  piece('display','group.piece.display',rect(8,376,624,64),['files-large','files-storage'],[slot('files-large',0,0,240,64),slot('files-storage',248,0,376,64)])]},
 {id:'mail',group:'required',set:'mail',base:'frame',width:672,height:448,tokens:5,pieces:[frame(),
  piece('list','ws.part.mail-list',rect(8,40,624,112),['mail-list']),
  piece('body','group.piece.mailBody',rect(8,160,624,176),['mail-body','mail-reply'],[slot('mail-body',0,0,432,176),slot('mail-reply',440,0,184,176)]),
  piece('folders','group.piece.folders',rect(8,344,624,96),['mail-folders','mail-unread'],[slot('mail-folders',0,0,432,96),slot('mail-unread',440,0,184,96)])]},
 {id:'foundation',group:'foundation',set:'foundation',base:'ground',width:640,height:448,tokens:6,pieces:[
  piece('ground','group.piece.ground',rect(0,0,640,448),['foundation-desktop']),
  piece('taskbar','ws.part.foundation-taskbar',rect(8,368,624,72),['foundation-taskbar']),
  piece('icons','ws.part.foundation-icons',rect(432,8,200,136),['foundation-icons']),
  piece('wallpaper','ws.part.foundation-wallpaper',rect(8,8,416,256),['foundation-wallpaper']),
  piece('notice','group.piece.notice',rect(432,152,200,208),['foundation-notification','foundation-upgrades'],[slot('foundation-notification',0,0,200,112),slot('foundation-upgrades',0,120,200,88)])]},
 {id:'photo',group:'photo',set:'photo',base:'frame',width:672,height:448,tokens:7,pieces:[frame(),
  piece('surface','group.piece.photoSurface',rect(8,40,416,280),['photo-display','photo-crop'],[slot('photo-display',0,0,416,280),slot('photo-crop',264,200,144,72)]),
  piece('adjust','group.piece.photoAdjust',rect(432,40,200,280),['photo-brightness','photo-tone'],[slot('photo-brightness',0,0,200,136),slot('photo-tone',0,144,200,136)]),
  piece('finish','group.piece.photoFinish',rect(8,328,624,112),['photo-wallpaper','photo-compare','photo-switch'],[slot('photo-wallpaper',0,0,208,112),slot('photo-compare',216,0,200,112),slot('photo-switch',424,0,200,112)])]},
 {id:'bin',group:'bin',set:'bin',base:'frame',width:672,height:448,tokens:3,pieces:[frame(),
  piece('list','ws.part.bin-list',rect(8,40,624,280),['bin-list']),piece('actions','group.piece.actions',rect(8,328,624,112),['bin-undo','bin-empty'],[slot('bin-undo',0,0,304,112),slot('bin-empty',312,0,312,112)])]},
 {id:'clock',group:'clock',set:'clock',base:'frame',width:672,height:448,tokens:3,pieces:[frame(),
  piece('time','ws.part.clock-time',rect(8,40,624,160),['clock-time']),piece('functions','group.piece.clockFunctions',rect(8,208,624,232),['clock-timer','clock-calendar'],[slot('clock-timer',0,0,240,232),slot('clock-calendar',248,0,376,232)])]},
 {id:'theme',group:'theme',set:'theme',base:'frame',width:672,height:448,tokens:5,pieces:[frame(),
  piece('colors','group.piece.themeColors',rect(8,40,624,160),['theme-mode','theme-accent'],[slot('theme-mode',0,0,304,160),slot('theme-accent',312,0,312,160)]),
  piece('shape','group.piece.themeShape',rect(8,208,624,232),['theme-radius','theme-icons','theme-slideshow'],[slot('theme-radius',0,0,208,232),slot('theme-icons',216,0,200,232),slot('theme-slideshow',424,0,200,232)])]},
 {id:'terminal',group:'terminal',set:'terminal',base:'frame',width:672,height:448,tokens:5,pieces:[frame(),
  piece('surface','ws.part.terminal-output',rect(8,40,624,200),['terminal-output']),
  piece('commands','group.piece.commands',rect(8,248,400,192),['terminal-commands','terminal-history'],[slot('terminal-commands',0,0,192,192),slot('terminal-history',200,0,200,192)]),
  piece('execution','group.piece.execution',rect(416,248,216,192),['terminal-interval','terminal-run'],[slot('terminal-interval',0,0,216,88),slot('terminal-run',0,96,216,96)])]},
 {id:'manager',group:'manager',set:'manager',base:'frame',width:672,height:448,tokens:2,pieces:[frame(),
  piece('processes','ws.part.manager-processes',rect(8,40,624,216),['manager-processes']),piece('performance','ws.part.manager-performance',rect(8,264,624,176),['manager-performance'])]},
 {id:'tabs',group:'extras',set:'extras',base:'tab',width:360,height:240,tokens:1,pieces:[piece('tab','ws.element.tab',rect(0,0,360,240),[]),piece('page','ws.element.page',rect(0,72,360,168),['plugin-tabs'])]},
 {id:'table',group:'extras',set:'extras',base:'time',width:480,height:256,tokens:1,pieces:[piece('time','ws.element.time',rect(0,0,480,256),[]),piece('pixels','ws.element.pixels',rect(240,32,240,224),['plugin-table'])]},
];
export const groupTool=(id:WorkshopToolId)=>GROUP_TOOLS.find(tool=>tool.id===id)!;
export const toolsInGroup=(group:WorkshopGroupId)=>GROUP_TOOLS.filter(tool=>tool.group===group);
export const toolParts=(tool:GroupToolDefinition)=>[...new Set(tool.pieces.flatMap(piece=>piece.parts))];
export const groupCategory=(group:WorkshopGroupId):GroupCategory=>group==='required'?'required':group==='foundation'?'desktop':'optional';
export const groupCost=(group:WorkshopGroupId)=>group==='required'?BALANCE.workshop.setCosts.files+BALANCE.workshop.setCosts.mail:BALANCE.workshop.setCosts[group];
export const toolLabel=(tool:WorkshopToolId)=>tool==='tabs'?'ws.part.plugin-tabs':tool==='table'?'ws.part.plugin-table':`ws.set.${tool}`;
export const groupLabel=(group:WorkshopGroupId)=>group==='required'?'group.required':`ws.set.${group}`;
export const commonPartIds:readonly WorkshopPartId[]=['common-frame','common-button','common-heading','common-progress'];
export const toolPieceReward=(tool:GroupToolDefinition)=>toolParts(tool).reduce((sum,id)=>sum+BALANCE.workshop.fitting.pieceRewardTotals[getWorkshopPart(id).category],0)/tool.pieces.length;
export const toolFinishReward=(tool:GroupToolDefinition)=>toolParts(tool).reduce((sum,id)=>sum+BALANCE.workshop.finishRewards[getWorkshopPart(id).category],0);
