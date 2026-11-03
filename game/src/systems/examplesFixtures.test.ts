import {describe,expect,it} from 'vitest';
import {createFixture,FIXTURE_NAMES} from './fixtures';
import {isGameState,SCHEMA_VERSION} from './state';
import {encodeSave,decodeSave} from './save';
import {getWorkshopPart} from '../content/workshopCatalog';
import {completedParts,partRectValid} from './workshop';
import {BALANCE} from '../config/balance';
const now=1_800_000_000_000;

describe('お手本の実操作用固定状態',()=>{
 it('全公開examples URLが現在の保存形式で復元できる',()=>{
  const names=FIXTURE_NAMES.filter(name=>name.startsWith('examples-'));
  expect(names).toHaveLength(56);
  for(const name of names){
   const state=createFixture(name,now)!;
   expect(state.schemaVersion,name).toBe(SCHEMA_VERSION);expect(isGameState(state),name).toBe(true);
   expect(decodeSave(encodeSave(state)),name).toEqual(state);
  }
 });
 it('ON/OFFの比較は設定以外の工程・所持量・作品が同じ状態から始まる',()=>{
  for(const era of [0,1,2])for(const mode of ['seed','seed-layout','seed-custom','route','place','adjust','finish']){
   const on=createFixture(`examples-${mode}-on-era${era}`,now)!,off=createFixture(`examples-${mode}-off-era${era}`,now)!;
   expect(on.persistent.examplesEnabled).toBe(true);expect(off.persistent.examplesEnabled).toBe(false);
   expect({...on,persistent:{...on.persistent,examplesEnabled:false}}).toEqual(off);
  }
 });
 it('配置は未着手、調整は工程2、仕上げは工程3で、以前の作品は完成を保つ',()=>{
  for(const era of [0,1,2])for(const [mode,step] of [['place-on',0],['adjust-on',2],['finish-on',3]] as const){
   const state=createFixture(`examples-${mode}-era${era}`,now)!;
   expect(state.run.workshop.activePart).toBe('common-button');expect(state.run.workshop.parts['common-button']!.step).toBe(step);
   expect(completedParts(state)).toEqual(['common-frame','common-scrollbar']);
   expect(state.run.workshop.parts['common-button']!.tested).toBe(false);
  }
 });
 it('自由配置と非標準designを持つ調整の途中が有効である',()=>{
  for(const era of [0,1,2]){
   const state=createFixture(`examples-adjust-custom-era${era}`,now)!,p=state.run.workshop.parts['common-button']!,standard=getWorkshopPart('common-button').defaultRect;
   expect(p.step).toBe(2);expect(p.rect.x).toBe(standard.x+32);expect(p.rect.y).toBe(standard.y+32);
   expect(p.design).toMatchObject({radius:8,shadow:true});expect(partRectValid(state,'common-button',p.rect,p.design)).toBe(true);
  }
 });
 it('次runのOFFは実出荷製品を残し、作るものを未完成へ戻す',()=>{
  for(const era of [0,1,2]){
   const state=createFixture(`examples-replay-off-era${era}`,now)!;
   expect(state.persistent.examplesEnabled).toBe(false);expect(state.run.world).toBe('seed');expect(state.run.version).toBe('v2');
   expect(state.persistent.products).toHaveLength(1);expect(state.run.seed.built).toEqual([]);expect(completedParts(state)).toEqual([]);
  }
 });
 it('4デスクトップ時代のembedded状態は正規の狭い内部viewportも含む',()=>{
  for(const era of [0,1,2,3]){
   const state=createFixture(`examples-desktop-era${era}`,now)!;
   expect(state.run.world).toBe('desktop');expect(state.run.desktop.screen).toEqual(BALANCE.appearance.screens[era]);
   expect(state.run.desktop.active).toBe('tessera');expect(state.persistent.examplesEnabled).toBe(true);
  }
 });
});
