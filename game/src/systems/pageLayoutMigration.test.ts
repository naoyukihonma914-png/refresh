import {describe,expect,it} from 'vitest';
import {initialPageLayout,recommendedPage,type PageLayout} from './pageDesign';
import {decodeSave,encodeSave} from './save';
import {createInitialState,SCHEMA_VERSION} from './state';
import {migratePageLayoutSave,schema17InitialPageLayout,schema17RecommendedPage} from './pageLayoutMigration';
const now=1_800_000_000_000;
function save17(layout:PageLayout|null){
 const state=createInitialState(now) as unknown as Record<string,unknown>;
 state.schemaVersion=17;
 const run=state.run as {seed:{page:{layout:PageLayout|null}}};
 run.seed.page.layout=layout;
 return JSON.stringify(state);
}
const cramped:PageLayout={width:1920,height:1080,parts:{
 pixels:{x:16,y:16,width:480,height:64},heading:{x:16,y:96,width:480,height:80},notice:{x:16,y:192,width:480,height:128},
 generator:{x:16,y:336,width:320,height:80},cursors:{x:16,y:432,width:480,height:96},upgrades:{x:16,y:544,width:480,height:224}}};
describe('schema17→18: 世界1の配置を大きく中央寄せへ直す',()=>{
 it('旧おすすめ配置は新しいおすすめ配置（中央・特大）へ置き換わる',()=>{
  const state=decodeSave(save17(schema17RecommendedPage()));
  expect(state.schemaVersion).toBe(SCHEMA_VERSION);
  expect(state.run.seed.page.layout).toEqual(recommendedPage());
  const generator=state.run.seed.page.layout!.parts.generator;
  expect(generator.width).toBe(480);expect(generator.height).toBe(160);expect(generator.x).toBeGreaterThan(16);
  expect(decodeSave(encodeSave(state))).toEqual(state);
 });
 it('旧初期配置は新しい初期配置へ置き換わる',()=>{
  const state=decodeSave(save17(schema17InitialPageLayout()));
  expect(state.run.seed.page.layout).toEqual(initialPageLayout());
 });
 it('隅に固まった変換由来の配置はおすすめ配置へ落とす',()=>{
  const state=decodeSave(save17(structuredClone(cramped)));
  expect(state.run.seed.page.layout).toEqual(recommendedPage(cramped.width,cramped.height));
 });
 it('余裕のある自作配置はそのまま保持する',()=>{
  const custom=recommendedPage();custom.parts.generator={...custom.parts.generator,x:custom.parts.generator.x+8,width:custom.parts.generator.width-8};
  const state=decodeSave(save17(structuredClone(custom)));
  expect(state.run.seed.page.layout).toEqual(custom);
 });
 it('配置が無いセーブと別形式には触らない',()=>{
  const state=decodeSave(save17(null));
  expect(state.run.seed.page.layout).toBeNull();
  expect(()=>migratePageLayoutSave({schemaVersion:18})).toThrow();
  expect(()=>migratePageLayoutSave(null)).toThrow();
 });
});
