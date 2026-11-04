import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { getWorkshopPart,type WorkshopPartId } from '../content/workshopCatalog';
import { fittingDefinition } from '../content/workshopFitting';
import { creditPixels,passivePixelsPerSecond,workshopPartsPixelsPerSecond } from './economy';
import { productionCreditMultiplier } from './productionModel';
import { createSeedVersion } from './seed';
import { decodeSave,encodeSave } from './save';
import { createInitialState,isGameState,type GameState } from './state';
import { actWorkshop,advanceWorkshop,enterWorkshop } from './workshop';
import { completionCombo,setExamplesEnabled,workshopComboMultiplier } from './workshopExamples';
import { defaultPieceSocket } from './workshopFitting';
import { createComponentDesign,isWorkshopState } from './workshopState';

const now=1_800_000_000_000;
function workshop():GameState {
 let s=createInitialState(now);delete s.run.workshop.groupPuzzle;s.run.seed.built=BALANCE.w1.items.map(item=>item.id);
 s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000_000)),BALANCE.workshop.enterMs);
 return actWorkshop(s,{type:'buySet',set:'common'},now);
}
function fit(s:GameState,id:WorkshopPartId,piece:string,time=now):GameState {
 const socket=defaultPieceSocket(fittingDefinition(id),s.run.workshop.parts[id]!.fitting!,piece)!;
 s=actWorkshop(s,{type:'spawnPiece',part:id,piece},time);
 return actWorkshop(s,{type:'fitPiece',part:id,piece,socket},time);
}
function complete(s:GameState,id:WorkshopPartId,time=now):GameState {
 for(const piece of fittingDefinition(id).pieces)s=fit(s,id,piece,time);
 return s;
}
const totalSteps=(category:'small'|'medium'|'large')=>BALANCE.workshop.categoryStepRewards[category].reduce((sum,value)=>sum+value,0);

describe('お手本と自由制作',()=>{
 it('初回ON、設定は資源や制作を変えず、保存と次の版にも残る',()=>{
  const initial=createInitialState(now);expect(initial.persistent.examplesEnabled).toBe(true);
  const s=workshop(),before=structuredClone(s),off=setExamplesEnabled(s,false);
  expect(s).toEqual(before);expect(off.run).toBe(s.run);expect(off.resources).toBe(s.resources);
  expect(setExamplesEnabled(off,false)).toBe(off);expect(setExamplesEnabled(off,'true' as unknown as boolean)).toBe(off);
  expect(decodeSave(encodeSave(off)).persistent.examplesEnabled).toBe(false);
  const next=createSeedVersion(complete(off,'common-button'),'v1',now+1);
  expect(next.persistent.examplesEnabled).toBe(false);expect(next.run.workshop.combo).toEqual({count:0,lastCompletedAt:null});
  expect(createSeedVersion(next,'v2',now+2).persistent.examplesEnabled).toBe(false);
 });
 it('殻の居場所と窪みはON/OFFで変わらず、旧配置操作では移動も報酬も起きない',()=>{
  const s=workshop(),off=setExamplesEnabled(s,false),id='common-button',target=getWorkshopPart(id).defaultRect;
  expect(s.run.workshop.parts[id]!.rect).toEqual(target);expect(off.run.workshop.parts[id]).toEqual(s.run.workshop.parts[id]);
  expect(fittingDefinition(id).sockets).toHaveLength(1);
  const moved={...target,x:target.x+8};
  for(const input of [s,off]){
   const result=actWorkshop(input,{type:'place',part:id,rect:moved,example:true},now);
   expect(result.run.workshop.parts[id]!.rect).toEqual(target);expect(result.resources).toEqual(input.resources);
  }
 });
 it('おまかせは途中でも完成後でも標準designだけを適用し、ピースと払いを変えない',()=>{
  for(const source of [workshop(),complete(workshop(),'common-button')])for(const enabled of [true,false]){
   const s=actWorkshop(setExamplesEnabled(source,enabled),{type:'adjust',part:'common-button',patch:{radius:8,shadow:true}},now);
   expect(s.run.workshop.parts['common-button']!.design.radius).toBe(8);
   const before=s.run.workshop.parts['common-button']!,automatic=actWorkshop(s,{type:'useExample',part:'common-button'},now);
   expect(automatic.run.workshop.parts['common-button']!.design).toEqual(createComponentDesign());
   expect(automatic.run.workshop.parts['common-button']!.fitting).toEqual(before.fitting);
   expect(automatic.run.workshop.parts['common-button']!.step).toBe(before.step);expect(automatic.resources).toEqual(s.resources);
   expect(actWorkshop(automatic,{type:'useExample',part:'common-button'},now).resources).toEqual(automatic.resources);
  }
 });
 it('ON/OFF・任意designはピース払い・完成払い・毎秒に影響しない',()=>{
  const original=complete(workshop(),'common-heading'),id='common-button';
  const example=complete(original,id,now+1);
  let free=actWorkshop(setExamplesEnabled(original,false),{type:'adjust',part:id,patch:{radius:8,shadow:true}},now+1);
  free=complete(free,id,now+1);
  expect(example.resources).toEqual(free.resources);expect(example.run.workshop.combo).toEqual(free.run.workshop.combo);
  expect(workshopPartsPixelsPerSecond(example)).toBe(workshopPartsPixelsPerSecond(free));expect(passivePixelsPerSecond(example)).toBe(passivePixelsPerSecond(free));
 });
});

describe('連続制作はピース払いだけ',()=>{
 it('最初の完成は1倍で払い、次のピースから既存countの倍率を使う',()=>{
  let s=workshop();const finish=BALANCE.workshop.finishRewards.small,before=s.resources.pixels;
  s=complete(s,'common-button');
  expect(s.resources.pixels-before).toBe(totalSteps('small')+finish);expect(s.run.workshop.combo).toEqual({count:1,lastCompletedAt:now});
  const multiplier=1+BALANCE.workshop.examples.comboStepBonus;
  expect(workshopComboMultiplier(s,now)).toBe(multiplier);
  const first=s.resources.pixels;s=fit(s,'common-heading','label',now+1);
  expect(s.resources.pixels-first).toBeCloseTo(totalSteps('small')/2*multiplier);
  const beforeSecond=s.resources.pixels;s=fit(s,'common-heading','separator',now+1);
  expect(s.resources.pixels-beforeSecond).toBeCloseTo(totalSteps('small')/2*multiplier+finish);
  expect(s.run.workshop.combo).toEqual({count:2,lastCompletedAt:now+1});
  expect(workshopComboMultiplier(s,now+1)).toBe(1+2*BALANCE.workshop.examples.comboStepBonus);
  const paid=s.resources;s=actWorkshop(s,{type:'removePiece',part:'common-heading',piece:'label'},now+2);s=fit(s,'common-heading','label',now+2);
  expect(s.resources).toEqual(paid);expect(s.run.workshop.combo).toEqual({count:2,lastCompletedAt:now+1});
 });
 it('最大10%で止まり、手際と既存生成倍率はピース部分へ掛かり完成一括額は変わらない',()=>{
  let s=workshop();s.run.workshop.combo={count:100,lastCompletedAt:now};s.persistent.editorSkills.push('efficiency');s.persistent.specs.color=1;
  expect(workshopComboMultiplier(s,now)).toBe(1+BALANCE.workshop.examples.comboMaxBonus);
  const before=s.resources.pixels,rate=productionCreditMultiplier(s);s=complete(s,'common-button');
  const expected=(totalSteps('small')*BALANCE.workshop.efficiencyMultiplier*(1+BALANCE.workshop.examples.comboMaxBonus)+BALANCE.workshop.finishRewards.small)*rate;
  expect(s.resources.pixels-before).toBeCloseTo(expected);
 });
 it('15秒の境界を越す・時計が戻ると通常倍率に戻り、次の完成をcount1から始める',()=>{
  const s=complete(workshop(),'common-button'),window=BALANCE.workshop.examples.comboWindowMs;
  expect(workshopComboMultiplier(s,now+window)).toBeGreaterThan(1);
  for(const time of [now+window+1,now-1]){
   expect(workshopComboMultiplier(s,time)).toBe(1);expect(completionCombo(s,time)).toEqual({count:1,lastCompletedAt:time});
   const before=s.resources.pixels,done=complete(s,'common-heading',time);
   expect(done.resources.pixels-before).toBe(totalSteps('small')+BALANCE.workshop.finishRewards.small);
   expect(done.run.workshop.combo).toEqual({count:1,lastCompletedAt:time});
  }
 });
 it('保存往復で有効な残り時間を保ち、古い写真のcombo無しも読み取る',()=>{
  const s=complete(workshop(),'common-button'),loaded=decodeSave(encodeSave(s));
  expect(loaded.run.workshop.combo).toEqual(s.run.workshop.combo);expect(workshopComboMultiplier(loaded,now+1)).toBe(workshopComboMultiplier(s,now+1));
  expect(workshopComboMultiplier(loaded,now+BALANCE.workshop.examples.comboWindowMs+1)).toBe(1);
  const historical=structuredClone(s.run.workshop);delete historical.combo;expect(isWorkshopState(historical)).toBe(true);expect(isGameState(s)).toBe(true);
 });
 it('不正な保存設定・回数・日時の組み合わせは拒む',()=>{
  const s=workshop(),invalid=structuredClone(s) as unknown as {persistent:{examplesEnabled:unknown}};invalid.persistent.examplesEnabled='true';expect(isGameState(invalid)).toBe(false);
  for(const combo of [{count:-1,lastCompletedAt:now},{count:1.5,lastCompletedAt:now},{count:0,lastCompletedAt:now},{count:1,lastCompletedAt:null},{count:1,lastCompletedAt:Infinity}])expect(isWorkshopState({...s.run.workshop,combo})).toBe(false);
 });
});
