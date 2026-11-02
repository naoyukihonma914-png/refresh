import { expect, it } from 'vitest';
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
it('実際の生成倍率から60秒を見積もり、カーソル倍増で30秒になり、手動の連打速度は足さない',()=>{
 const s=createFixture('seed-motion',1800000000000)!;s.resources.pixels=0;s.run.seed.autoCursors=10;
 s.persistent.progress=createProgress();s.persistent.progress.records={'first-pixel':s.createdAt,'save-created':s.createdAt};s.persistent.progress.completed={'no-color':s.createdAt};
 // 10 cursors × .5 presses × Color 1.5 × click 4 × permanent bonus 1.07 = 32.1/s.
 expect(passivePixelsPerSecond(s)).toBeCloseTo(32.1,8);expect(estimateSeconds(1926,0,passivePixelsPerSecond(s))).toBe(60);
 const clicked=pressSeed(s,freshMomentum(),0).state;expect(passivePixelsPerSecond(clicked)).toBeCloseTo(32.1,8);
 expect(estimateSeconds(1926,clicked.resources.pixels,passivePixelsPerSecond(clicked))).toBe(60);
 s.run.seed.autoCursors=20;expect(estimateSeconds(1926,0,passivePixelsPerSecond(s))).toBe(30);
 s.run.seed.autoCursors=0;expect(estimateSeconds(1926,clicked.resources.pixels,passivePixelsPerSecond(s))).toBeNull();
});
it('まとめ買いの推定は選んだ全台数の価格を使い、最大購入では残高内なので待ち時間を出さない',()=>{
 const s=createFixture('seed-motion',1800000000000)!;s.resources.pixels=0;s.run.seed.autoCursors=11;s.persistent.progress=createProgress();
 const rate=passivePixelsPerSecond(s);s.persistent.progress.bulk='one';const one=seedCursorQuote(s);s.persistent.progress.bulk='ten';const ten=seedCursorQuote(s);
 expect(one.count).toBe(1);expect(ten.count).toBe(10);expect(estimateSeconds(ten.cost,0,rate)).toBeGreaterThan(estimateSeconds(one.cost,0,rate)!);
 s.resources.pixels=ten.cost;s.persistent.progress.bulk='max';const max=seedCursorQuote(s);expect(max.count).toBe(10);expect(estimateSeconds(max.cost,s.resources.pixels,rate)).toBeNull();
});
