import {describe,it,expect} from 'vitest';
import {createFixture,FIXTURE_NAMES,completeWorkshopPartFixture} from './fixtures';
import {isGameState} from './state';
import {encodeSave,decodeSave} from './save';
import {WORKSHOP_PARTS} from '../content/workshopCatalog';
const now=1_800_000_000_000;
describe('第3版：ブラウザ固定状態の整合性',()=>{
 it('新しい工程helperは支払い用の予算を含めて保存可能な完成部品を作る',()=>{
  let state=createFixture('stage8a-entry',now)!;state.resources.pixels=0;state.run.totalPixelsGenerated=0;
  state=completeWorkshopPartFixture(state,'common-button',now);
  expect(state.run.workshop.parts['common-button']).toMatchObject({step:4,tested:true,completedAt:now,exportedAt:now});
  expect(isGameState(state)).toBe(true);
  const repeated=completeWorkshopPartFixture(state,'common-button',now+1);
  expect(repeated.resources).toEqual(state.resources);expect(isGameState(repeated)).toBe(true);
 });
 it('新制作全段階と旧公開名が新スキーマで保存復元できる',()=>{
  for(const name of FIXTURE_NAMES){const state=createFixture(name,now);expect(state,name).not.toBeNull();expect(isGameState(state),name).toBe(true);expect(decodeSave(encodeSave(state!)),name).toEqual(state);}
 },30_000);
 it('セットの材料購入と完成を区別し、必須22部品の書類を格納する',()=>{
  const empty=createFixture('stage8a-main',now)!;expect(Object.values(empty.run.workshop.parts).every(p=>p?.step===0)).toBe(true);
  expect(empty.persistent.setDocuments).toHaveLength(0);
  const ready=createFixture('stage8a-required-complete-16color',now)!;
  expect(Object.values(ready.run.workshop.parts).filter(p=>p?.step===4)).toHaveLength(22);
  expect(ready.persistent.setDocuments.map(d=>d.set)).toEqual(['common','foundation','files','mail']);
  expect(ready.persistent.specs.color).toBe(0);
  expect(WORKSHOP_PARTS.filter(p=>p.set!=='extras')).toHaveLength(47);
 });
 it('ファイル完成の固定状態は6パーツの書類ができたエクスポート直前を示す',()=>{
  const state=createFixture('stage8a-files-complete-era0',now)!;
  expect(state.run.workshop.activePart).toBe('files-list');expect(state.run.workshop.view).toBe('workbench');
  expect(state.run.workshop.purchasedSets).toEqual(['common','foundation','files']);
  expect(state.persistent.setDocuments.map(document=>document.set)).toEqual(['common','foundation','files']);
  for(const [id,production] of Object.entries(state.run.workshop.parts)){
   expect(production?.step).toBe(4);
   expect(production?.exportedAt).toBe(id.startsWith('files-')?null:now);
  }
 });
 it('実デスクトップの共通枠には移動前に選んだ色と左右の記号を引き継ぐ',()=>{
  for(const era of [0,1,2,3]){
   const state=createFixture(`stage8a-desktop-common-custom-era${era}`,now)!;
   expect(state.run.world).toBe('desktop');
   expect(state.run.workshop.parts['common-frame']?.design).toMatchObject({nativeColors:false,color:'#1f3f7a',textColor:'#f4efe4',controlSides:{close:'start',minimize:'end',maximize:'end'}});
  }
 });
});
