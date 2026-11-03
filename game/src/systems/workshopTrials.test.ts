import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {getWorkshopPart,type WorkshopPartId} from '../content/workshopCatalog';
import {FINISH_TRIALS,finishTrialFor} from '../content/workshopTrials';
import {createFixture} from './fixtures';
import {actWorkshop} from './workshop';
import {advanceFinishTrial,createFinishTrialState,type FinishTrialAction} from './workshopTrials';

const successful:Record<string,FinishTrialAction[]>={
 'common-frame':[{type:'window',mode:'minimized'},{type:'window',mode:'normal'}],
 'common-scrollbar':[{type:'scroll',position:BALANCE.workshop.testplay.scrollOverflowPx,extent:BALANCE.workshop.testplay.scrollOverflowPx}],
 'common-button':[{type:'press',control:'apply'}],
 'common-heading':[{type:'heading',expanded:false},{type:'heading',expanded:true}],
 'common-progress':[{type:'fill-start'},{type:'fill-end'}],
 'foundation-taskbar':[{type:'app',app:'mail'}],
 'foundation-desktop':[{type:'area',x:0,y:0,width:BALANCE.workshop.testplay.selectionMinSize,height:BALANCE.workshop.testplay.selectionMinSize}],
 'foundation-icons':[{type:'icon-open',id:'note'}],
 'foundation-notification':[{type:'press',control:'notification'}],
 'foundation-wallpaper':[{type:'fit',fit:'cover'}],
 'foundation-upgrades':[{type:'press',control:'upgrades'}],
 'files-list':[{type:'file',id:'note'}],
 'files-back':[{type:'folder',folder:'sets'},{type:'back'}],
 'files-sort':[{type:'sort',key:'date'}],
 'files-search':[{type:'query',query:'notes',matches:true}],
 'files-large':[{type:'large',large:true}],
 'files-storage':[{type:'press',control:'storage'}],
 'mail-list':[{type:'message',id:'guide:entered'}],
 'mail-body':[{type:'scroll',position:BALANCE.workshop.testplay.scrollOverflowPx,extent:BALANCE.workshop.testplay.scrollOverflowPx}],
 'mail-reply':[{type:'draft-open'},{type:'draft-input',text:'A saved draft'},{type:'draft-save'}],
 'mail-folders':[{type:'archive'},{type:'mail-folder',folder:'archive'}],
 'mail-unread':[{type:'read-toggle',read:false},{type:'message-read'}],
};
const play=(part:WorkshopPartId,actions:FinishTrialAction[])=>actions.reduce((state,action)=>advanceFinishTrial(part,state,action),createFinishTrialState());

describe('TP3：実部品の固有の仕上げ',()=>{
 for(const definition of FINISH_TRIALS)it(`${definition.part} は固有操作だけで仕上げ、4工程の報酬を増やさない`,()=>{
  const initial=createFinishTrialState(),unchanged=advanceFinishTrial(definition.part,initial,{type:'focus'} as unknown as FinishTrialAction);
  expect(unchanged).toBe(initial);expect(initial.done).toBe(false);
  const complete=play(definition.part,successful[definition.part]!);expect(complete.done).toBe(true);
  const catalog=getWorkshopPart(definition.part);expect([catalog.testInteraction,...catalog.testAlternatives]).toContain(definition.interaction);
  const now=1_800_000_000_000,s=createFixture(`stage8a-part-${definition.part}-step-3-era0`,now)!;
  expect(s.run.workshop.parts[definition.part]?.step).toBe(3);
  const next=actWorkshop(s,{type:'test',part:definition.part,interaction:definition.interaction},now);
  expect(next.run.workshop.parts[definition.part]?.step).toBe(4);expect(next.resources.pixels).toBeGreaterThan(s.resources.pixels);
  expect(next.resources.tokens).toBe(s.resources.tokens);expect(actWorkshop(next,{type:'test',part:definition.part,interaction:definition.interaction},now+1)).toBe(next);
  expect(advanceFinishTrial(definition.part,complete,successful[definition.part]![0]!)).toBe(complete);
 });
 it('操作の開始や不成立だけでは、窓・見出し・バー・返信・振り分け・未読の仕上げにならない',()=>{
  for(const [part,actions] of Object.entries(successful).filter(([,actions])=>actions.length>1))expect(play(part as WorkshopPartId,actions.slice(0,-1)).done,part).toBe(false);
  expect(play('common-frame',[{type:'window',mode:'normal'}]).done).toBe(false);
  expect(play('common-heading',[{type:'heading',expanded:true}]).done).toBe(false);
  expect(play('common-progress',[{type:'fill-end'}]).done).toBe(false);
  expect(play('mail-reply',[{type:'draft-open'},{type:'draft-input',text:' '},{type:'draft-save'}]).done).toBe(false);
  expect(play('mail-folders',[{type:'mail-folder',folder:'archive'}]).done).toBe(false);
  expect(play('mail-unread',[{type:'message-read'}]).done).toBe(false);
 });
 it('スクロールは実際に最後まで動かし、先頭・非overflow・NaNの値では完成しない',()=>{
  for(const part of ['common-scrollbar','mail-body'] as const){
   for(const action of [{type:'scroll',position:0,extent:100},{type:'scroll',position:2,extent:0},{type:'scroll',position:NaN,extent:100},{type:'scroll',position:10,extent:100}] as FinishTrialAction[])expect(play(part,[action]).done).toBe(false);
   expect(play(part,[{type:'scroll',position:100,extent:100}]).done).toBe(true);
  }
 });
 it('文字入力・切り替え・ドラッグは、空や同じ状態や小さすぎる範囲を成功にしない',()=>{
  const openedElsewhere={...createFinishTrialState(),folder:'exports' as const,baseFolder:'exports' as const};
  const moved=advanceFinishTrial('files-back',openedElsewhere,{type:'folder',folder:'sets'});
  expect(advanceFinishTrial('files-back',moved,{type:'back'})).toMatchObject({done:true,folder:'exports'});
  expect(play('files-back',[{type:'folder',folder:'all'},{type:'back'}]).done).toBe(false);
  expect(play('files-search',[{type:'query',query:'',matches:true}]).done).toBe(false);
  expect(play('files-search',[{type:'query',query:'missing',matches:false}]).done).toBe(false);
  expect(play('foundation-taskbar',[{type:'app',app:'files'}]).done).toBe(false);
  expect(play('foundation-wallpaper',[{type:'fit',fit:'contain'}]).done).toBe(false);
  expect(play('foundation-desktop',[{type:'area',x:0,y:0,width:1,height:1}]).done).toBe(false);
  expect(play('foundation-desktop',[{type:'area',x:0,y:0,width:Infinity,height:100}]).done).toBe(false);
  expect(finishTrialFor('photo-brightness')).toBeNull();
 });
});
