import {describe,expect,it} from 'vitest';
import {initialPageLayout,recommendedPage} from './pageDesign';
import {decodeSave,encodeSave} from './save';
import {createInitialState} from './state';
const now=1_800_000_000_000;
describe('形式17の試遊保存は配置を移行せず新規開始へ読み替える',()=>{
 it.each([null,initialPageLayout(),recommendedPage()])('古いページ配置を引き継がない',layout=>{
  const state=createInitialState(now),old={...state,schemaVersion:17,run:{...state.run,seed:{...state.run.seed,page:{...state.run.seed.page,layout}}}};
  const raw=JSON.stringify(old),loaded=decodeSave(raw);expect(loaded).toEqual(createInitialState(now));expect(decodeSave(encodeSave(loaded))).toEqual(loaded);expect(JSON.stringify(old)).toBe(raw);
 });
});
