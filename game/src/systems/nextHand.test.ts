import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {creditPixels} from './economy';
import {createFixture} from './fixtures';
import {desktopConditions} from './desktop';
import {nextDesktopHand,nextSeedHand} from './nextHand';
import {buildSeed} from './seed';
import {actPageDesign} from './pageDesign';
import {createInitialState} from './state';

const now=1_800_000_000_000;
describe('お手本：世界1と世界3の次の手',()=>{
 it('新規開始から生成→買う→次の生成を、実際の価格と制作の順序で案内する',()=>{
  let state=createInitialState(now);
  for(const part of ['heading','notice','upgrades'] as const){
   expect(nextSeedHand(state)).toEqual({kind:'seed-fit',part});
   state=actPageDesign(state,{type:'fit',part});
  }
  for(const item of BALANCE.w1.items){
   expect(nextSeedHand(state)).toMatchObject({kind:'seed-generate',item:item.id});
   const before=structuredClone(state),hand=nextSeedHand(state)!;expect(state).toEqual(before);
   expect(hand).toHaveProperty('missing',item.cost-state.resources.pixels);
   state=creditPixels(state,item.cost);
   expect(nextSeedHand(state)).toMatchObject({kind:'seed-buy',item:item.id,missing:0});
   state=buildSeed(state,item.id,now);
  }
  expect(state.run.world).toBe('kumiki');expect(nextSeedHand(state)).toBeNull();
 });
 it('16色の案件でカラーを作るよう案内せず、世界外やOFFで出さない',()=>{
  const state=createFixture('contract-no-color',now)!;state.run.world='seed';state.run.seed.built=['border','save'];state.run.seed.page.fitted=['pixels','generator','heading','notice','upgrades','cursors'];
  expect(nextSeedHand(state)).toMatchObject({item:'font'});
  state.persistent.examplesEnabled=false;expect(nextSeedHand(state)).toBeNull();
  const desktop=createFixture('desktop-early',now)!;desktop.persistent.examplesEnabled=false;expect(nextDesktopHand(desktop)).toBeNull();
 });
 it('閉じた機能するアプリを開く案内を、不要な追加制作より先に出す',()=>{
  const state=createFixture('desktop-ready',now)!;state.run.desktop.editingApp=null;
  state.run.desktop.windows.tessera.open=false;
  expect(desktopConditions(state)[0]).toBe(false);
  expect(nextDesktopHand(state)).toEqual({kind:'desktop-open',app:'tessera'});
 });
 it('現在の組み立て作業を案内し、パーツや条件の状態を変更しない',()=>{
  const state=createFixture('app-build-empty',now)!;state.run.desktop.editingApp='files';
  const before=structuredClone(state);expect(nextDesktopHand(state)).toEqual({kind:'desktop-finishApp',app:'files'});expect(state).toEqual(before);
 });
 it('壁紙・自動化・要望の条件ごとに、使える道具へ案内する',()=>{
  const ready=createFixture('stage7-ready0',now)!;ready.run.desktop.editingApp=null;
  const wallpaper=structuredClone(ready);wallpaper.persistent.desktopPrefs.wallpaper=null;expect(nextDesktopHand(wallpaper)).toEqual({kind:'desktop-wallpaper'});
  const automation=structuredClone(ready);automation.run.desktop.terminal.executions=0;expect(nextDesktopHand(automation)).toEqual({kind:'desktop-automation'});
  const feedback=structuredClone(ready);feedback.run.desktop.feedback.forEach(request=>{request.completedAt=null;});expect(nextDesktopHand(feedback)).toEqual({kind:'desktop-feedback',request:feedback.run.desktop.feedback[0]!.id});
  feedback.run.desktop.feedback=[];expect(nextDesktopHand(feedback)).toEqual({kind:'desktop-feedback',request:null});
 });
 it('出荷可能な実fixtureでリリース、次版で世界4の準備へ切り替わる',()=>{
  const state=createFixture('stage7-ready0',now)!;state.run.desktop.editingApp=null;
  expect(desktopConditions(state).every(Boolean)).toBe(true);
  expect(nextDesktopHand(state)).toEqual({kind:'desktop-release'});
  state.run.version='v2';expect(nextDesktopHand(state)).toEqual({kind:'desktop-world4'});
 });
});
