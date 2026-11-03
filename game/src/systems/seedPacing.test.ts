import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {reconcileProgress} from './longPlay';
import {observeProgress} from './longPlayEvents';
import {buildSeed,canBuildSeed,freshMomentum,pressSeed} from './seed';
import {actPageDesign} from './pageDesign';
import {createInitialState} from './state';
import {advanceActiveTime} from './time';

describe('TP-3：最初の1分でカラーを作れる',()=>{
 for(const cursors of [false,true])it(`1回/秒と購入ごとの判断4秒でもカラーまで1分（途中のカーソル${cursors?'1台':'なし'}）`,()=>{
  const now=1_800_000_000_000;let state=createInitialState(now),momentum=freshMomentum(),wall=0,pressBudget=0,cursorBought=false;
  const apply=(next:typeof state)=>{state=reconcileProgress(observeProgress(state,next),now+wall);};
  const drainFits=()=>{for(const part of ['heading','notice','upgrades','cursors'] as const)apply(actPageDesign(state,{type:'fit',part}));};
  const tick=(ms:number,manual:boolean)=>{
   for(let remaining=ms;remaining>0;){const step=Math.min(remaining,BALANCE.time.tickMs);remaining-=step;wall+=step;
    apply({...advanceActiveTime(state,step,'ja',false).state,lastTickAt:now+wall});
    if(manual){pressBudget+=step;while(pressBudget>=1000){const pressed=pressSeed(state,momentum,wall);momentum=pressed.momentum;apply(pressed.state);pressBudget-=1000;}}
   }
  };
  for(const item of ['border','save','color'] as const){
   while(!canBuildSeed(state,item)){
    expect(wall).toBeLessThan(60_000);
    if(cursors&&!cursorBought&&state.run.seed.built.includes('save')&&canBuildSeed(state,'cursor')){apply(buildSeed(state,'cursor',now+wall));cursorBought=true;drainFits();tick(4_000,false);}
    else tick(BALANCE.time.tickMs,true);
   }
   apply(buildSeed(state,item,now+wall));drainFits();
   if(item!=='color')tick(4_000,false);
  }
  expect(state.run.seed.built).toEqual(['border','save','color']);expect(wall).toBeLessThanOrEqual(60_000);expect(state.resources.pixels).toBeGreaterThanOrEqual(0);
 });
});
