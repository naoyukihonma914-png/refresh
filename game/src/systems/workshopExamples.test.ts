import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { getWorkshopPart,type WorkshopPartId } from '../content/workshopCatalog';
import { creditPixels,passivePixelsPerSecond,workshopPartsPixelsPerSecond } from './economy';
import { productionCreditMultiplier } from './productionModel';
import { createSeedVersion } from './seed';
import { decodeSave,encodeSave } from './save';
import { createInitialState,isGameState,type GameState } from './state';
import { actWorkshop,advanceWorkshop,enterWorkshop } from './workshop';
import { completionCombo,examplePlacement,setExamplesEnabled,workshopComboMultiplier } from './workshopExamples';
import { createComponentDesign,isWorkshopState } from './workshopState';

const now=1_800_000_000_000;
function workshop():GameState {
 let s=createInitialState(now);s.run.seed.built=BALANCE.w1.items.map(item=>item.id);
 s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000_000)),BALANCE.workshop.enterMs);
 return actWorkshop(s,{type:'buySet',set:'common'},now);
}
function prepared(s:GameState,id:WorkshopPartId,time=now):GameState {
 const descriptor=getWorkshopPart(id);
 s=actWorkshop(s,{type:'place',part:id,rect:descriptor.defaultRect},time);
 for(const element of descriptor.elements)s=actWorkshop(s,{type:'addElement',part:id,element},time);
 return s;
}
function complete(s:GameState,id:WorkshopPartId,time=now):GameState {
 s=actWorkshop(prepared(s,id,time),{type:'confirmAdjustment',part:id},time);
 return actWorkshop(s,{type:'test',part:id,interaction:getWorkshopPart(id).testInteraction},time);
}

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
 it('工程1だけ、近傍かつ安全な標準矩形に吸着する',()=>{
  const s=workshop(),id='common-button',target=getWorkshopPart(id).defaultRect;
  const near={...target,x:target.x+BALANCE.workshop.examples.snapDistance,y:target.y+8};
  expect(examplePlacement(s,id,near)).toEqual({rect:target,snapped:true});
  expect(near.x).toBe(target.x+BALANCE.workshop.examples.snapDistance);
  expect(examplePlacement(s,id,{...near,x:target.x+BALANCE.workshop.examples.snapDistance+1}).snapped).toBe(false);
  expect(examplePlacement(setExamplesEnabled(s,false),id,near)).toEqual({rect:near,snapped:false});
  expect(actWorkshop(setExamplesEnabled(s,false),{type:'place',part:id,rect:near,example:true},now).run.workshop.parts[id]!.rect).toEqual(near);
  for(const invalid of [{...near,x:NaN},{...near,height:Infinity},{...target,width:-1}])expect(examplePlacement(s,id,invalid).snapped).toBe(false);
  const placed=actWorkshop(s,{type:'place',part:id,rect:near,example:true},now);
  expect(placed.run.workshop.parts[id]!.rect).toEqual(target);
  expect(examplePlacement(placed,id,near)).toEqual({rect:near,snapped:false});
 });
 it('明示フラグのない配置と完成後の自由編集は吸着しない',()=>{
  const s=workshop(),id='common-button',target=getWorkshopPart(id).defaultRect,free={...target,x:target.x+8};
  expect(actWorkshop(s,{type:'place',part:id,rect:free},now).run.workshop.parts[id]!.rect).toEqual(free);
  expect(actWorkshop(s,{type:'place',part:id,rect:free,example:false},now).run.workshop.parts[id]!.rect).toEqual(free);
  const finished=complete(s,id),wallet=finished.resources;
  const moved=actWorkshop(finished,{type:'place',part:id,rect:free,example:true},now+1);
  expect(moved.run.workshop.parts[id]!.rect).toEqual(free);expect(moved.resources).toBe(wallet);
 });
 it('既存の部品と標準位置が重なる場合は吸着を押し付けない',()=>{
  let s=workshop();const id='common-button',target=getWorkshopPart(id).defaultRect;
  const scrollbar={...getWorkshopPart('common-scrollbar').defaultRect,x:target.x,y:target.y};
  s=actWorkshop(s,{type:'place',part:'common-scrollbar',rect:scrollbar},now);
  expect(s.run.workshop.parts['common-scrollbar']!.step).toBe(1);
  expect(examplePlacement(s,id,target)).toEqual({rect:target,snapped:false});
 });
 it('おまかせは標準designと工程3を一度だけ適用し、通常の確認と同じ払い',()=>{
  let s=prepared(workshop(),'common-button');
  s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:8,shadow:true}},now);
  const normal=actWorkshop(s,{type:'confirmAdjustment',part:'common-button'},now),automatic=actWorkshop(s,{type:'useExample',part:'common-button'},now);
  expect(automatic.run.workshop.parts['common-button']!.design).toEqual(createComponentDesign());
  expect(automatic.run.workshop.parts['common-button']!.step).toBe(3);expect(automatic.resources).toEqual(normal.resources);
  expect(actWorkshop(automatic,{type:'useExample',part:'common-button'},now)).toBe(automatic);
  expect(actWorkshop(automatic,{type:'confirmAdjustment',part:'common-button'},now)).toBe(automatic);
  const off=setExamplesEnabled(s,false);expect(actWorkshop(off,{type:'useExample',part:'common-button'},now)).toBe(off);
  expect(actWorkshop(workshop(),{type:'useExample',part:'common-button'},now).run.workshop.parts['common-button']!.step).toBe(0);
 });
 it('ON/OFF・標準位置・自由designは工程払いと毎秒に影響しない',()=>{
  const original=complete(workshop(),'common-scrollbar'),id='common-button';
  let example=prepared(original,id,now+1),free=prepared(setExamplesEnabled(original,false),id,now+1);
  example=actWorkshop(example,{type:'useExample',part:id},now+1);
  free=actWorkshop(free,{type:'adjust',part:id,patch:{radius:8,shadow:true}},now+1);
  free=actWorkshop(free,{type:'place',part:id,rect:{...getWorkshopPart(id).defaultRect,x:getWorkshopPart(id).defaultRect.x+8}},now+1);
  free=actWorkshop(free,{type:'confirmAdjustment',part:id},now+1);
  example=actWorkshop(example,{type:'test',part:id,interaction:'press'},now+1);
  free=actWorkshop(free,{type:'test',part:id,interaction:'press'},now+1);
  expect(example.resources).toEqual(free.resources);expect(example.run.workshop.combo).toEqual(free.run.workshop.combo);
  expect(workshopPartsPixelsPerSecond(example)).toBe(workshopPartsPixelsPerSecond(free));expect(passivePixelsPerSecond(example)).toBe(passivePixelsPerSecond(free));
 });
});

describe('連続制作は工程払いだけ',()=>{
 it('最初の完了を1倍で払い、次の工程から旧countの倍率を使う',()=>{
  let s=actWorkshop(prepared(workshop(),'common-button'),{type:'confirmAdjustment',part:'common-button'},now);
  const rewards=BALANCE.workshop.categoryStepRewards.small,finish=BALANCE.workshop.finishRewards.small,before=s.resources.pixels;
  s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
  expect(s.resources.pixels-before).toBe(rewards[3]+finish);expect(s.run.workshop.combo).toEqual({count:1,lastCompletedAt:now});
  expect(workshopComboMultiplier(s,now)).toBe(1+BALANCE.workshop.examples.comboStepBonus);
  const first=s.resources.pixels;s=prepared(s,'common-heading',now+1);
  expect(s.resources.pixels-first).toBeCloseTo((rewards[0]+rewards[1])*(1+BALANCE.workshop.examples.comboStepBonus));
  s=actWorkshop(s,{type:'confirmAdjustment',part:'common-heading'},now+1);const beforeSecond=s.resources.pixels;
  s=actWorkshop(s,{type:'test',part:'common-heading',interaction:'select'},now+1);
  expect(s.resources.pixels-beforeSecond).toBeCloseTo(rewards[3]*(1+BALANCE.workshop.examples.comboStepBonus)+finish);
  expect(s.run.workshop.combo).toEqual({count:2,lastCompletedAt:now+1});
  expect(workshopComboMultiplier(s,now+1)).toBe(1+2*BALANCE.workshop.examples.comboStepBonus);
  expect(actWorkshop(s,{type:'test',part:'common-heading',interaction:'select'},now+2)).toBe(s);
 });
 it('最大10%で止まり、手際と既存生成倍率は工程部分へ掛かり完成一括額は変わらない',()=>{
  let s=workshop();s.run.workshop.combo={count:100,lastCompletedAt:now};s.persistent.editorSkills.push('efficiency');s.persistent.specs.color=1;
  expect(workshopComboMultiplier(s,now)).toBe(1+BALANCE.workshop.examples.comboMaxBonus);
  s=actWorkshop(prepared(s,'common-button'),{type:'confirmAdjustment',part:'common-button'},now);
  const before=s.resources.pixels,rate=productionCreditMultiplier(s),rewards=BALANCE.workshop.categoryStepRewards.small;
  s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
  const expected=(rewards[3]*BALANCE.workshop.efficiencyMultiplier*(1+BALANCE.workshop.examples.comboMaxBonus)+BALANCE.workshop.finishRewards.small)*rate;
  expect(s.resources.pixels-before).toBeCloseTo(expected);
 });
 it('15秒の境界を越す・時計が戻ると通常倍率に戻り、次の完了をcount1から始める',()=>{
  const s=complete(workshop(),'common-button'),window=BALANCE.workshop.examples.comboWindowMs;
  expect(workshopComboMultiplier(s,now+window)).toBeGreaterThan(1);
  for(const time of [now+window+1,now-1]){
   expect(workshopComboMultiplier(s,time)).toBe(1);expect(completionCombo(s,time)).toEqual({count:1,lastCompletedAt:time});
   const base=prepared(s,'common-heading',time),normal=actWorkshop(base,{type:'confirmAdjustment',part:'common-heading'},time),before=normal.resources.pixels;
   const done=actWorkshop(normal,{type:'test',part:'common-heading',interaction:'select'},time);
   expect(done.resources.pixels-before).toBe(BALANCE.workshop.categoryStepRewards.small[3]+BALANCE.workshop.finishRewards.small);
   expect(done.run.workshop.combo).toEqual({count:1,lastCompletedAt:time});
  }
 });
 it('保存往復で有効な残り時間を保ち、古い写真のcombo無しも読み取る',()=>{
  const s=complete(workshop(),'common-button'),loaded=decodeSave(encodeSave(s));
  expect(loaded.run.workshop.combo).toEqual(s.run.workshop.combo);expect(workshopComboMultiplier(loaded,now+1)).toBe(workshopComboMultiplier(s,now+1));
  expect(workshopComboMultiplier(loaded,now+BALANCE.workshop.examples.comboWindowMs+1)).toBe(1);
  const historical=structuredClone(s.run.workshop);delete historical.combo;expect(isWorkshopState(historical)).toBe(true);
  expect(isGameState(s)).toBe(true);
 });
 it('不正な保存設定・回数・日時の組み合わせは拒む',()=>{
  const s=workshop(),invalid=structuredClone(s) as unknown as {persistent:{examplesEnabled:unknown}};invalid.persistent.examplesEnabled='true';expect(isGameState(invalid)).toBe(false);
  for(const combo of [{count:-1,lastCompletedAt:now},{count:1.5,lastCompletedAt:now},{count:0,lastCompletedAt:now},{count:1,lastCompletedAt:null},{count:1,lastCompletedAt:Infinity}])expect(isWorkshopState({...s.run.workshop,combo})).toBe(false);
 });
});
