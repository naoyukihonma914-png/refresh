import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {createInitialState} from './state';
import {PAGE_PARTS,initialPageLayout} from './pageDesign';
import {completedSeedPreviewState} from './seedPreview';
const now=1_800_000_000_000;
describe('完成予想の完成形',()=>{
 it('全項目が作られ全パーツが嵌った状態になり、元の状態は変わらない',()=>{
  const s=createInitialState(now),before=structuredClone(s),done=completedSeedPreviewState(s);
  expect(s).toEqual(before);
  expect(done.run.seed.built).toEqual(BALANCE.w1.items.map(item=>item.id));
  expect(done.run.seed.page.fitted).toEqual([...PAGE_PARTS]);
  expect(done.run.seed.autoCursors).toBeGreaterThanOrEqual(1);
  expect(done.run.seed.page.layout).not.toBeNull();
  expect(done.run.seed.guide.current).toBeNull();
 });
 it('自分のレイアウトと部品の色は完成形にも残る',()=>{
  const s=createInitialState(now);
  s.run.seed.page={...s.run.seed.page,layout:{...initialPageLayout(),width:1600},partColors:{heading:{background:'#112233',text:null}}};
  const done=completedSeedPreviewState(s);
  expect(done.run.seed.page.layout?.width).toBe(1600);
  expect(done.run.seed.page.partColors?.heading?.background).toBe('#112233');
 });
});
