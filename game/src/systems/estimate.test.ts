import { expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { estimateSeconds } from './estimate';
import {createFixture} from './fixtures';
import {createProgress} from './longPlay';
import {passivePixelsPerSecond} from './economy';
import {pressSeed,freshMomentum,seedCursorQuote} from './seed';
it('推定時間は自動生成だけで求め、買える・毎秒0・99時間超を非表示にし、長い値を丸める',()=>{
  expect(estimateSeconds(100,60,1)).toBe(40);
  expect(estimateSeconds(100,100,1)).toBeNull();expect(estimateSeconds(100,0,0)).toBeNull();expect(estimateSeconds(100,0,NaN)).toBeNull();
  expect(estimateSeconds(99*3600+1,0,1)).toBeNull();expect(estimateSeconds(99*3600,0,1)).toBe(99*3600);
  expect(estimateSeconds(600,0,1)).toBe(600);expect(estimateSeconds(601,0,1)).toBe(660);
  expect(estimateSeconds(3601,0,1)).toBe(4200);expect(estimateSeconds(3700,0,2)).toBe(1860);
});
it('推定は自動カーソルと完成部品の合計だけを使い、手動連打を含めない',()=>{
 const s=createFixture('seed-motion',1800000000000)!;s.resources.pixels=0;s.run.seed.autoCursors=10;
 s.persistent.progress=createProgress();s.persistent.progress.records={'first-pixel':s.createdAt,'save-created':s.createdAt};s.persistent.progress.completed={'no-color':s.createdAt};
 const permanent=1+2*BALANCE.longPlay.achievementBonus+BALANCE.longPlay.contractBonus;
 const partRate=BALANCE.w1.items.filter(item=>s.run.seed.built.includes(item.id)).reduce((n,item)=>n+item.perSecond,0)*permanent;
 const cursorRate=10*BALANCE.w1.cursor_press_per_sec*BALANCE.w1.color_cursor_mult*(BALANCE.w1.base_click+BALANCE.w1.border_bonus)*BALANCE.w1.font_mult*permanent;
 const rate=cursorRate+partRate,cost=rate*59.9;
 expect(passivePixelsPerSecond(s)).toBeCloseTo(rate,8);expect(estimateSeconds(cost,0,passivePixelsPerSecond(s))).toBe(60);
 const clicked=pressSeed(s,freshMomentum(),0).state;expect(passivePixelsPerSecond(clicked)).toBeCloseTo(rate,8);
 expect(estimateSeconds(cost,clicked.resources.pixels,passivePixelsPerSecond(clicked))).toBe(60);
 s.run.seed.autoCursors=20;expect(passivePixelsPerSecond(s)).toBeCloseTo(cursorRate*2+partRate);
 expect(estimateSeconds(cost,0,passivePixelsPerSecond(s))).toBe(Math.ceil(cost/(cursorRate*2+partRate)));
 // Existing parts continue generating even after the last cursor is removed.
 s.run.seed.autoCursors=0;expect(passivePixelsPerSecond(s)).toBeCloseTo(partRate);
 expect(estimateSeconds(cost,clicked.resources.pixels,passivePixelsPerSecond(s))).toBe(Math.ceil((cost-clicked.resources.pixels)/partRate));
});
it('まとめ買いの推定は選んだ全台数の価格を使い、最大購入では残高内なので待ち時間を出さない',()=>{
 const s=createFixture('seed-motion',1800000000000)!;s.resources.pixels=0;s.run.seed.autoCursors=11;s.persistent.progress=createProgress();
 const rate=passivePixelsPerSecond(s);s.persistent.progress.bulk='one';const one=seedCursorQuote(s);s.persistent.progress.bulk='ten';const ten=seedCursorQuote(s);
 expect(one.count).toBe(1);expect(ten.count).toBe(10);expect(estimateSeconds(ten.cost,0,rate)).toBeGreaterThan(estimateSeconds(one.cost,0,rate)!);
 s.resources.pixels=ten.cost;s.persistent.progress.bulk='max';const max=seedCursorQuote(s);expect(max.count).toBe(10);expect(estimateSeconds(max.cost,s.resources.pixels,rate)).toBeNull();
});
