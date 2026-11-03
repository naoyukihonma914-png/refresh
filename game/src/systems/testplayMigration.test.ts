import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {SET_IDS} from '../content/workshopCatalog';
import {isLegacyPageDesign,type LegacyPageDesign} from './legacyPageDesign';
import {isPageDesign,PAGE_PARTS,validPagePlacement} from './pageDesign';
import {decodeSave,encodeSave} from './save';
import {isGameState} from './state';
import {migrateLegacyPageDesign,migrateTestplaySave} from './testplayMigration';
import {isWorkshopHelpTarget} from './workshopState';
import {enterWorkshop} from './workshop';
const fixtures=['seed-before-layout','seed-custom-layout','seed-inherited-layout','workshop-mid','desktop-records','shipping'] as const;
const oldSave=(name:typeof fixtures[number])=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/tp-v15-main-${name}.json.gz`,import.meta.url))).toString());

describe('TP1: 真正main形式15から16への移行',()=>{
 it.each(fixtures)('%s: 財布・制作・作品・写真を保持しlive pageだけを6部品へ移す',name=>{
  const source=oldSave(name),untouched=JSON.stringify(source);
  expect(source.schemaVersion).toBe(15);expect(isLegacyPageDesign(source.run.seed.page)).toBe(true);
  const state=decodeSave(JSON.stringify(source));
  expect(state.schemaVersion).toBe(17);expect(isGameState(state)).toBe(true);expect(isPageDesign(state.run.seed.page)).toBe(true);
  expect(state.resources).toEqual(source.resources);expect(state.run.totalPixelsGenerated).toBe(source.run.totalPixelsGenerated);
  expect(state.run.seed.built).toEqual(source.run.seed.built);expect(state.run.seed.history).toEqual(source.run.seed.history);expect(state.run.seed.autoCursors).toBe(source.run.seed.autoCursors);
  for(const field of ['background','text','button','headingFont','bodyFont','motion','heading'] as const)expect(state.run.seed.page[field]).toEqual(source.run.seed.page[field]);
  if(source.run.seed.page.layout){const layout=state.run.seed.page.layout!;expect(Object.keys(layout.parts).sort()).toEqual([...PAGE_PARTS].sort());expect(PAGE_PARTS.every(part=>validPagePlacement(layout,part,layout.parts[part]))).toBe(true);}
  for(const field of ['specs','seedSkills','editorSkills','editorCustomization','progress','productionNote','setDocuments','products','screenshots'] as const)expect(state.persistent[field]).toEqual(source.persistent[field]);
  expect(state.run.workshop.parts).toEqual(source.run.workshop.parts);expect(state.run.workshop.purchasedSets).toEqual(source.run.workshop.purchasedSets);expect(state.run.workshop.helpTarget).toBeNull();
  expect(decodeSave(encodeSave(state))).toEqual(state);expect(JSON.stringify(source)).toBe(untouched);
 });
 it('未配置の旧プレイヤーだけを未紹介にし、引継ぎ直後のbuilt=[]を再紹介しない',()=>{
  expect(decodeSave(JSON.stringify(oldSave('seed-before-layout'))).persistent.testplay.layoutGuideSeen).toBe(false);
  for(const name of ['seed-custom-layout','seed-inherited-layout','workshop-mid','desktop-records','shipping'] as const)expect(decodeSave(JSON.stringify(oldSave(name))).persistent.testplay.layoutGuideSeen).toBe(true);
  const inherited=oldSave('seed-inherited-layout');expect(inherited.run.seed.built).toEqual([]);expect(inherited.run.seed.page.layout).not.toBeNull();
 });
 it('旧購入済み/旧書類のセットは既知扱いにし、移行だけでヘルプを開かない',()=>{
  const source=oldSave('desktop-records'),next=decodeSave(JSON.stringify(source));
  const known=new Set([...source.run.workshop.purchasedSets,...source.persistent.setDocuments.map((doc:{set:string})=>doc.set),...source.persistent.products.flatMap((product:{screen:{workshop?:{purchasedSets:string[]}}})=>product.screen.workshop?.purchasedSets??[])]);
  expect(next.persistent.testplay.helpSeen).toEqual(SET_IDS.filter(set=>known.has(set)));expect(next.run.workshop.helpTarget).toBeNull();
 });
 it('追加パーツの永久購入権だけが残る旧W1でも、工房で説明を再び押し付けない',()=>{
  const source=oldSave('seed-inherited-layout');
  if(!source.persistent.editorSkills.includes('extraParts'))source.persistent.editorSkills.push('extraParts');
  expect(source.run.world).toBe('seed');expect(source.run.workshop.purchasedSets).toEqual([]);
  const state=decodeSave(JSON.stringify(source));
  expect(state.persistent.testplay.helpSeen).toContain('extras');expect(state.run.workshop.helpTarget).toBeNull();
  expect(state.persistent.editorSkills).toEqual(source.persistent.editorSkills);
  const entered=enterWorkshop(state);expect(entered.run.workshop.purchasedSets).toContain('extras');expect(entered.run.workshop.helpTarget).toBeNull();
  expect(decodeSave(encodeSave(entered)).persistent.testplay.helpSeen).toContain('extras');
 });
 it('旧ボタンの独立した保存寸法を新generator矩形へ移し、資源/駐車場と分離する',()=>{
  const old=oldSave('seed-custom-layout').run.seed.page as LegacyPageDesign;
  expect(old.layout?.button).toBeDefined();
  const page=migrateLegacyPageDesign(old),layout=page.layout!,button=old.layout!.button!;
  expect(layout.parts.generator.width).toBe(Math.ceil(Math.max(BALANCE.pageDesign.buttonMinWidth,button.width)/BALANCE.pageDesign.grid)*BALANCE.pageDesign.grid);
  expect(layout.parts.generator.height).toBe(Math.ceil(Math.max(BALANCE.pageDesign.buttonMinHeight,button.height)/BALANCE.pageDesign.grid)*BALANCE.pageDesign.grid);
  expect(layout.parts.pixels).not.toEqual(layout.parts.generator);expect(layout.parts.cursors).not.toEqual(layout.parts.generator);expect('button'in layout).toBe(false);
 });
 it('壊れた旧rectだけを失効させ、保存された色や書体までは捨てない',()=>{
  const old=oldSave('seed-custom-layout').run.seed.page;old.layout.parts.generator.width=-8;
  const page=migrateLegacyPageDesign(old);expect(page.layout).toBeNull();expect(page.background).toBe(old.background);expect(page.bodyFont).toBe(old.bodyFont);
 });
 it('help対象のpartは同じsetだけ許し、未購入setのヘルプは読むことができる',()=>{
  expect(isWorkshopHelpTarget({set:'files'})).toBe(true);expect(isWorkshopHelpTarget({set:'files',part:'files-list'})).toBe(true);
  for(const target of [{set:'files',part:'mail-list'},{set:'fake'},{set:'files',part:'missing'}])expect(isWorkshopHelpTarget(target)).toBe(false);
 });
 it('別形式をこの境界へ通さず、原本のschema番号を書き換えない',()=>{
  const source=oldSave('seed-custom-layout');expect(()=>migrateTestplaySave({...source,schemaVersion:16})).toThrow();
  const copy=structuredClone(source);migrateTestplaySave(copy);expect(copy).toEqual(source);
 });
});
