import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';
import { migrateExampleSave } from './exampleMigration';
import { migratePageLayoutSave } from './pageLayoutMigration';
import { decodeSave,encodeSave } from './save';
import { isGameState } from './state';

const fixtures=['seed-customized','workshop-step2','workshop-step3-free','desktop-records','next-run','shipping'] as const;
const oldSave=(name:typeof fixtures[number])=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/examples-v16-7005674-${name}.json.gz`,import.meta.url))).toString());

describe('真正TP3形式16から17のお手本移行',()=>{
 it.each(fixtures)('%s: ONと空の連続制作以外は制作・財布・作品・写真の全内容を保持する',name=>{
  const source=oldSave(name),original=JSON.stringify(source);
  expect(source.schemaVersion).toBe(16);expect(source.persistent.examplesEnabled).toBeUndefined();expect(source.run.workshop.combo).toBeUndefined();
  const migrated=migrateExampleSave(source) as ReturnType<typeof decodeSave>;
  expect(migrated.schemaVersion).toBe(17);expect(migrated.persistent.examplesEnabled).toBe(true);expect(migrated.run.workshop.combo).toEqual({count:0,lastCompletedAt:null});
  const restored=structuredClone(migrated) as unknown as {schemaVersion:number;persistent:{examplesEnabled?:boolean};run:{workshop:{combo?:unknown}}};
  restored.schemaVersion=16;delete restored.persistent.examplesEnabled;delete restored.run.workshop.combo;
  expect(restored).toEqual(source);expect(JSON.stringify(source)).toBe(original);
  const loaded=decodeSave(original);expect(isGameState(loaded)).toBe(true);expect(loaded.schemaVersion).toBe(18);expect(loaded).toEqual(migratePageLayoutSave(migrated));expect(decodeSave(encodeSave(loaded))).toEqual(loaded);
 });
 it('境界違いと骨格の壊れた入力は変換しない',()=>{
  const source=oldSave('workshop-step2');
  for(const invalid of [null,{...source,schemaVersion:15},{...source,schemaVersion:17},{...source,persistent:null},{...source,run:{...source.run,workshop:[]}}])expect(()=>migrateExampleSave(invalid)).toThrow();
 });
});
