import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';




import {decodeSave,encodeSave} from './save';
import {createInitialState,isGameState} from './state';




const fixtures=['seed-before-layout','seed-custom-layout','seed-inherited-layout','workshop-mid','desktop-records','shipping'] as const;
const oldSave=(name:typeof fixtures[number])=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/tp-v15-main-${name}.json.gz`,import.meta.url))).toString());

describe('形式15の試遊保存はグループパズルの新規開始へ読み替える',()=>{
 it.each(fixtures)('%s: 旧ページ・財布・作品を移行しない',name=>{
  const source=oldSave(name),raw=JSON.stringify(source),loaded=decodeSave(raw);
  expect(source.schemaVersion).toBe(15);expect(loaded).toEqual(createInitialState(source.lastTickAt));expect(isGameState(loaded)).toBe(true);
  expect(decodeSave(encodeSave(loaded))).toEqual(loaded);expect(JSON.stringify(source)).toBe(raw);
 });
});
