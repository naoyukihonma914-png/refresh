import {describe,it,expect} from 'vitest';
import {BALANCE} from '../config/balance';
import {fittingDefinition} from '../content/workshopFitting';
import {getWorkshopPart} from '../content/workshopCatalog';
import {createInitialState,isGameState,type GameState} from './state';
import {actWorkshop,advanceWorkshop,advanceWorkshopAssistance,canExportWorkshop,enterWorkshop} from './workshop';
import {productionCreditMultiplier} from './productionModel';
import {decodeSave,encodeSave} from './save';
import {advanceOfflineTime} from './time';
import {isManagerProcessId} from './desktopState';
const now=1_800_000_000_000;
function job():GameState {
 const source=createInitialState(now);source.run.seed.built=BALANCE.w1.items.map(item=>item.id);source.resources.pixels=source.run.totalPixelsGenerated=100_000;
 let s=advanceWorkshop(enterWorkshop(source),BALANCE.workshop.enterMs);s.run.world='desktop';s.run.desktop.entered=true;s.run.desktop.upgrades=['jobs'];s.run.desktop.jobs.tessera={assigned:true,cursors:1,updates:0};s.persistent.specs.color=1;
 s=actWorkshop(s,{type:'buySet',set:'common'},now);return actWorkshop(s,{type:'selectPart',part:'common-button'},now);
}
const duration=()=>BALANCE.workshop.assistStepMs;
const fittedCount=(s:GameState,id:'common-button'|'common-heading'|'common-frame'='common-button')=>Object.keys(s.run.workshop.parts[id]!.fitting!.sockets).length;

describe('エディタのジョブはピースをはめ、最後のピースで完成する',()=>{
 it('部分時間を保存し、固定された殻を動かさず、一度だけ完成まで支払う',()=>{
  const source=job(),frozen=structuredClone(source),wallet=source.resources.pixels,rect=source.run.workshop.parts['common-button']!.rect;
  const waiting=advanceWorkshopAssistance(source,duration()/2,now+duration()/2);
  expect(fittedCount(waiting)).toBe(0);expect(waiting.resources.pixels).toBe(wallet);expect(waiting.run.workshop.assistance).toEqual({part:'common-button',elapsedMs:duration()/2});
  const restored=decodeSave(encodeSave(waiting)),next=advanceWorkshopAssistance(restored,duration()/2,now+duration());
  expect(next.run.workshop.parts['common-button']!.step).toBe(4);expect(fittedCount(next)).toBe(1);expect(next.run.workshop.parts['common-button']!.rect).toEqual(rect);
  const reward=BALANCE.workshop.categoryStepRewards.small.reduce((sum,value)=>sum+value,0)+BALANCE.workshop.finishRewards.small;
  expect(next.resources.pixels-wallet).toBe(reward*productionCreditMultiplier(source));expect(source).toEqual(frozen);expect(isGameState(next)).toBe(true);
 });
 it('長時間でも選んだパーツだけを完成し、エクスポートとトークンは人の操作まで出さない',()=>{
  const source=job(),next=advanceWorkshopAssistance(source,1e12,now+1e12),part=next.run.workshop.parts['common-button']!;
  expect(part).toMatchObject({step:4,tested:true,exportedAt:null});expect(next.run.workshop.assistance).toEqual({part:'common-button',elapsedMs:0});
  const expected=(BALANCE.workshop.categoryStepRewards.small.reduce((sum,value)=>sum+value,0)+BALANCE.workshop.finishRewards.small)*productionCreditMultiplier(source);
  expect(next.resources.pixels-source.resources.pixels).toBe(expected);expect(next.resources.tokens).toBe(source.resources.tokens);expect(canExportWorkshop(next)).toBe(true);
  const waiting=advanceWorkshopAssistance(next,1e12,now+2e12);expect(waiting.resources).toEqual(next.resources);expect(fittedCount(waiting,'common-heading')).toBe(0);
  const exported=actWorkshop(next,{type:'export',part:'common-button'},now+2e12);expect(exported.resources.tokens).toBe(next.resources.tokens+BALANCE.workshop.exportTokens+BALANCE.workshop.updateGrantTokens);
  expect(advanceWorkshopAssistance(exported,1e12,now+3e12).resources).toEqual(exported.resources);expect(decodeSave(encodeSave(exported))).toEqual(exported);
 });
 it('共有窪みで選んだ記号の座と作風を保ち、欠けたピースを1枚ずつ足す',()=>{
  let s=actWorkshop(job(),{type:'selectPart',part:'common-frame'},now);const rect=getWorkshopPart('common-frame').defaultRect;
  const socket=fittingDefinition('common-frame').sockets.find(candidate=>candidate.accepts.includes('minimize'))!.id;
  s=actWorkshop(s,{type:'spawnPiece',part:'common-frame',piece:'close'},now);
  s=actWorkshop(s,{type:'fitPiece',part:'common-frame',piece:'close',socket},now);
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{titleAlign:'center'}},now);
  const design=s.run.workshop.parts['common-frame']!.design,next=advanceWorkshopAssistance(s,duration(),now+duration());
  expect(fittedCount(next,'common-frame')).toBe(2);expect(next.run.workshop.parts['common-frame']!.fitting!.sockets.close).toBe(socket);
  expect(next.run.workshop.parts['common-frame']!.design).toEqual(design);expect(next.run.workshop.parts['common-frame']!.rect).toEqual(rect);
 });
 it('選択変更やジョブ解除では未消化の時間を他のパーツへ持ち越さない',()=>{
  let s=advanceWorkshopAssistance(job(),duration()/2,now+duration()/2);s=actWorkshop(s,{type:'selectPart',part:'common-heading'},now+duration()/2);
  expect(s.run.workshop.assistance).toEqual({part:'common-heading',elapsedMs:0});s=advanceWorkshopAssistance(s,duration()/2,now+duration());expect(fittedCount(s,'common-heading')).toBe(0);
  s.run.desktop.jobs.tessera.assigned=false;s=advanceWorkshopAssistance(s,duration(),now+duration()*2);expect(s.run.workshop.assistance?.elapsedMs).toBe(0);
  s.run.desktop.jobs.tessera.assigned=true;s=advanceWorkshopAssistance(s,duration()/2,now+duration()*3);expect(fittedCount(s,'common-heading')).toBe(0);
 });
 it('台数・リフレッシュレート・更新でピースをはめる手際を増やす',()=>{
  const source=job(),fast=structuredClone(source);fast.run.desktop.jobs.tessera.cursors=2;fast.run.desktop.jobs.tessera.updates=1;fast.persistent.specs.refresh=1;
  const speed=2*BALANCE.spec.refresh[1].multiplier*BALANCE.w3.updateMultiplier;
  const slowResult=advanceWorkshopAssistance(source,duration()/speed,now+duration()),fastResult=advanceWorkshopAssistance(fast,duration()/speed,now+duration());
  expect(fittedCount(slowResult)).toBe(0);expect(fittedCount(fastResult)).toBe(1);expect(fastResult.run.workshop.parts['common-button']!.step).toBe(4);
 });
 it('ジョブ未解放・未割当・0台・デスクトップ外・起動中には進めず、最小化中は働く',()=>{
  const base=job();for(const configure of [(s:GameState)=>{s.run.desktop.upgrades=[];},(s:GameState)=>{s.run.desktop.jobs.tessera.assigned=false;},(s:GameState)=>{s.run.desktop.jobs.tessera.cursors=0;},(s:GameState)=>{s.run.world='kumiki';},(s:GameState)=>{s.run.workshop.enterMs=1;}]){
   const s=structuredClone(base);configure(s);const next=advanceWorkshopAssistance(s,duration()*3,now+duration()*3);expect(fittedCount(next)).toBe(0);expect(next.resources).toEqual(s.resources);
  }
  base.run.desktop.windows.tessera.minimized=true;expect(fittedCount(advanceWorkshopAssistance(base,duration(),now+duration()))).toBe(1);
 });
 it('不正な時間は無視し、保存した予算も上限と対象を検査する',()=>{
  const source=job();for(const value of [-1,NaN,Infinity])expect(advanceWorkshopAssistance(source,value,now)).toBe(source);
  const invalid=structuredClone(source);invalid.run.workshop.assistance={part:'common-button',elapsedMs:duration()};expect(isGameState(invalid)).toBe(false);
  invalid.run.workshop.assistance={part:'common-heading',elapsedMs:1};expect(isGameState(invalid)).toBe(false);
 });
 it('不在中も最後のピースで完成し、エクスポートは自動で行わない',()=>{
  const s=job(),away=advanceOfflineTime(s,now+BALANCE.time.millisecondsPerHour,'ja',false).state;
  expect(away.run.workshop.parts['common-button']!.step).toBe(4);expect(away.run.workshop.parts['common-button']!.exportedAt).toBeNull();expect(away.resources.tokens).toBe(s.resources.tokens);expect(canExportWorkshop(away)).toBe(true);
 });
});

describe('生成内訳の選択を保存する',()=>{
 it('新しい行IDと過去の行IDを保ち、知らないIDは受け付けない',()=>{
  for(const id of ['home','desktop','app:files','job:photo','seed:border','common-button','shots','feedback','tessera']){
   expect(isManagerProcessId(id)).toBe(true);const s=job();s.run.desktop.managerProcess=id;expect(decodeSave(encodeSave(s)).run.desktop.managerProcess).toBe(id);
  }
  expect(isManagerProcessId('app:unknown')).toBe(false);expect(isManagerProcessId('seed:unknown')).toBe(false);
 });
});
