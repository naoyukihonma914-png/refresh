import {describe,it,expect} from 'vitest';
import {createFixture,FIXTURE_NAMES} from './fixtures';
import {isGameState} from './state';
import {encodeSave,decodeSave} from './save';
import {WORKSHOP_PARTS} from '../content/workshopCatalog';
const now=1_800_000_000_000;
describe('第3版：ブラウザ固定状態の整合性',()=>{
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
});
