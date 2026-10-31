import { expect, it } from 'vitest';
import { estimateSeconds } from './estimate';
it('推定時間は自動生成だけで求め、買える・毎秒0・99時間超を非表示にし、長い値を丸める',()=>{
  expect(estimateSeconds(100,60,1)).toBe(40);
  expect(estimateSeconds(100,100,1)).toBeNull();expect(estimateSeconds(100,0,0)).toBeNull();expect(estimateSeconds(100,0,NaN)).toBeNull();
  expect(estimateSeconds(99*3600+1,0,1)).toBeNull();expect(estimateSeconds(99*3600,0,1)).toBe(99*3600);
  expect(estimateSeconds(600,0,1)).toBe(600);expect(estimateSeconds(601,0,1)).toBe(660);
  expect(estimateSeconds(3601,0,1)).toBe(4200);expect(estimateSeconds(3700,0,2)).toBe(1860);
});
