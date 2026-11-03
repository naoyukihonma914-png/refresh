import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { fittingPartsForSet as partsForSet } from '../content/workshopFitting';
import { completeWorkshopPartFixture,createFixture } from './fixtures';
import { actWorkshop,advanceWorkshop,enterWorkshop } from './workshop';
import { createSeedVersion } from './seed';
import { decodeSave,encodeSave } from './save';
import { nextWorkshopTarget,workshopRowStatus,WORKSHOP_MAINLINE } from './workshopNavigation';
const now=1_800_000_000_000;
const entry=()=>createFixture('stage8a-entry-era0',now)!;

describe('TP2：必須ルートで次に作るものを1つだけ示す',()=>{
 it('購入と完成を区別し、選択中のセットや財布に左右されず本線21パーツを案内する',()=>{
  let s=entry();expect(nextWorkshopTarget(s)).toEqual({kind:'set',set:'common'});
  for(const set of WORKSHOP_MAINLINE){
   expect(nextWorkshopTarget(s)).toEqual({kind:'set',set});
   expect(workshopRowStatus(s,set)).toBe('unowned');
   s=actWorkshop(s,{type:'buySet',set},now);s=actWorkshop(s,{type:'help',target:null},now);
   expect(workshopRowStatus(s,set)).toBe('ready');
   for(const part of partsForSet(set)){
    expect(nextWorkshopTarget(s)).toEqual({kind:'part',set,part:part.id});
    s=completeWorkshopPartFixture(s,part.id,now,false);
    expect(workshopRowStatus(s,set,part.id)).toBe('complete');
   }
   expect(workshopRowStatus(s,set)).toBe('complete');
  }
  expect(nextWorkshopTarget(s)).toEqual({kind:'exit'});
  s.run.world='desktop';expect(nextWorkshopTarget(s)).toBeNull();
 });
 it('任意セットを先に選んでも本線の案内は変わらず、買えない間も次を隠さない',()=>{
  let s=entry();s=actWorkshop(s,{type:'buySet',set:'clock'},now);s.resources.pixels=0;
  expect(s.run.workshop.activePart).toBe('clock-time');
  expect(nextWorkshopTarget(s)).toEqual({kind:'set',set:'common'});
  expect(workshopRowStatus(s,'clock')).toBe('ready');
 });
});

describe('TP2：初回購入の説明と手動ヘルプ',()=>{
 it('購入で完成品を渡さず、初回の説明を1回開き、財布と記録を保存できる',()=>{
  const original=entry(),pixels=original.resources.pixels;
  const purchased=actWorkshop(original,{type:'buySet',set:'common'},now);
  expect(purchased.resources.pixels).toBe(pixels-BALANCE.workshop.setCosts.common);
  expect(purchased.run.workshop.helpTarget).toEqual({set:'common'});
  expect(purchased.persistent.testplay.helpSeen).toEqual(['common']);
  expect(Object.values(purchased.run.workshop.parts).every(part=>part?.step===1&&Object.keys(part.fitting!.sockets).length===0)).toBe(true);
  expect(actWorkshop(purchased,{type:'buySet',set:'common'},now+1)).toBe(purchased);
  expect(decodeSave(encodeSave(purchased))).toEqual(purchased);
  const closed=actWorkshop(purchased,{type:'help',target:null},now+1);
  expect(closed.run.workshop.helpTarget).toBeNull();expect(closed.persistent.testplay.helpSeen).toEqual(['common']);
  let second=createSeedVersion(closed,'v1',now+1000);
  second.run.seed.built=BALANCE.w1.items.map(item=>item.id);second.resources.pixels=1e12;
  second=advanceWorkshop(enterWorkshop(second),BALANCE.workshop.enterMs);
  second=actWorkshop(second,{type:'buySet',set:'common'},now+2001);
  expect(second.run.workshop.helpTarget).toBeNull();expect(second.persistent.testplay.helpSeen).toEqual(['common']);
 });
 it('追加パーツの技能で得るセットも初回だけ説明し、次版で材料を受け取っても繰り返さない',()=>{
  let s=entry();s.run.version='v1';const skill=BALANCE.workshop.skills.find(item=>item.id==='extraParts')!;s.resources.tokens=skill.cost;
  const pixels=s.resources.pixels;s=actWorkshop(s,{type:'skill',id:'extraParts'},now);
  expect(s.resources).toMatchObject({pixels,tokens:0});
  expect(s.run.workshop.helpTarget).toEqual({set:'extras'});expect(s.persistent.testplay.helpSeen).toEqual(['extras']);
  for(const part of partsForSet('extras'))expect(s.run.workshop.parts[part.id]).toMatchObject({step:1,completedAt:null});
  s=actWorkshop(s,{type:'help',target:null},now+1);expect(actWorkshop(s,{type:'skill',id:'extraParts'},now+2)).toBe(s);
  let next=createSeedVersion(s,'v2',now+1000);next.run.seed.built=BALANCE.w1.items.map(item=>item.id);
  const before=next.resources;next=enterWorkshop(next);
  expect(next.run.workshop.purchasedSets).toContain('extras');expect(next.resources).toEqual(before);
  expect(next.run.workshop.helpTarget).toBeNull();expect(next.persistent.testplay.helpSeen).toEqual(['extras']);
  expect(enterWorkshop(next)).toBe(next);
 });
 it('未購入セットやパーツの説明も読め、閉じても購入や進行に影響しない',()=>{
  const s=entry(),opened=actWorkshop(s,{type:'help',target:{set:'mail',part:'mail-body'}},now);
  expect(opened.run.workshop.helpTarget).toEqual({set:'mail',part:'mail-body'});
  expect(opened.resources).toEqual(s.resources);expect(opened.persistent.testplay.helpSeen).toEqual([]);
  expect(opened.run.workshop.purchasedSets).toEqual([]);expect(nextWorkshopTarget(opened)).toEqual(nextWorkshopTarget(s));
  expect(actWorkshop(opened,{type:'help',target:null},now).run.workshop.helpTarget).toBeNull();
 });
 it('知らないセットや、別のセットのパーツを示す壊れたヘルプを拒む',()=>{
  const s=entry();
  expect(actWorkshop(s,{type:'help',target:{set:'files',part:'mail-body'}},now)).toBe(s);
  expect(actWorkshop(s,{type:'help',target:{set:'unknown' as 'files'}},now)).toBe(s);
 });
});
