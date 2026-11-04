import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';


import { decodeSave,encodeSave } from './save';
import { createInitialState,isGameState } from './state';


const fixtures=['seed-customized','workshop-step2','workshop-step3-free','desktop-records','next-run','shipping'] as const;
const oldSave=(name:typeof fixtures[number])=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/examples-v16-7005674-${name}.json.gz`,import.meta.url))).toString());

describe('形式16の試遊保存はグループパズルの新規開始へ読み替える',()=>{
 it.each(fixtures)('%s: 記録・財布・作品を引き継がず、原本も変更しない',name=>{
  const source=oldSave(name),raw=JSON.stringify(source),loaded=decodeSave(raw);
  expect(source.schemaVersion).toBe(16);expect(loaded).toEqual(createInitialState(source.lastTickAt));
  expect(isGameState(loaded)).toBe(true);expect(decodeSave(encodeSave(loaded))).toEqual(loaded);expect(JSON.stringify(source)).toBe(raw);
 });
});
