import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createFixture,FIXTURE_NAMES,completeWorkshopPartFixture} from './fixtures';
import {isGameState,SCHEMA_VERSION} from './state';
import {encodeSave,decodeSave} from './save';
import {mergeLegacyScrollbarIntoFrame} from './workshopState';
import {adoptedPartIds} from './appAssembly';
import {producerLedger} from './economy';
import {rawDesktopFiles} from './desktopFiles';
import {createI18n} from '../content/i18n';
import {world4Preparation} from './world4';
import {canAssembleDesktop,canBuyWorkshopSet,completedParts,actWorkshop} from './workshop';
import {WORKSHOP_PARTS,UI_SETS} from '../content/workshopCatalog';
import {PAGE_PARTS} from './pageDesign';
import {knownSeedItems,seedReplayQuote} from './seed';
import {BALANCE} from '../config/balance';
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
 it('セットの材料購入と完成を区別し、必須21部品の書類を格納する',()=>{
  const empty=createFixture('stage8a-main',now)!;expect(Object.values(empty.run.workshop.parts).every(p=>p?.step===0)).toBe(true);
  expect(empty.persistent.setDocuments).toHaveLength(0);
  const ready=createFixture('stage8a-required-complete-16color',now)!;
  expect(Object.values(ready.run.workshop.parts).filter(p=>p?.step===4)).toHaveLength(21);
  expect(ready.persistent.setDocuments.map(d=>d.set)).toEqual(['common','foundation','files','mail']);
  expect(ready.persistent.specs.color).toBe(0);
  expect(WORKSHOP_PARTS.filter(p=>p.set!=='extras'&&p.set!=='stream')).toHaveLength(46);
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
 it('8bの生産前後は未採用素材とインストール済みsourceを区別する',()=>{
  for(const era of [0,1,2,3]){
   const before=createFixture(`stage8b-economy-before-era${era}`,now)!;
   const after=createFixture(`stage8b-economy-after-era${era}`,now)!;
   expect(before.run.workshop.parts['photo-crop']?.step).toBe(3);
   expect(adoptedPartIds(before,'photo')).not.toContain('photo-crop');
   expect(adoptedPartIds(after,'photo')).toContain('photo-crop');
   const row=(state:typeof before)=>producerLedger(state).find(item=>item.id==='app:photo')!;
   expect(row(after).baseRate).toBeGreaterThan(row(before).baseRate);
  }
 });
 it('8bの旧版書類・次版関門・世界4条件の固定状態を区別する',()=>{
  const files=createFixture('stage8b-files-archive-era0',now)!;
  const entries=rawDesktopFiles(files,createI18n('ja'));
  expect(entries.find(entry=>entry.id==='note')?.kind).toBe('note');
  expect(entries.some(entry=>entry.kind==='set'&&entry.edition==='current')).toBe(true);
  expect(entries.some(entry=>entry.kind==='set'&&entry.edition==='archive')).toBe(true);
  const again=createFixture('stage8b-second-workshop-era0',now)!;
  expect(again.run.workshop.purchasedSets).toEqual(['common']);
  expect(Object.values(again.run.workshop.parts).every(part=>part?.step===0)).toBe(true);
  expect(canAssembleDesktop(again)).toBe(false);
  expect(world4Preparation(createFixture('stage8b-stream-ready-era0',now)!).ready).toBe(true);
  expect(world4Preparation(createFixture('stage8b-stream-draft-era0',now)!).ready).toBe(false);
  expect(world4Preparation(createFixture('stage8b-stream-spec-blocked-era0',now)!).ready).toBe(false);
 });
});


describe('TP：実操作の固定状態と真正v15入力',()=>{
 it('新規の配置導線と既に見た配置を区別し、生成／資源／カーソルを別々に持つ',()=>{
  const before=createFixture('tp1-before-layout-era0',now)!,first=createFixture('tp1-first-layout-era0',now)!,stable=createFixture('tp1-stable-era0',now)!;
  expect(before.run.seed.built).toEqual(['border','save','color','font']);
  expect(before.persistent.testplay.layoutGuideSeen).toBe(false);
  expect(first.run.seed.built).toContain('layout');expect(first.persistent.testplay.layoutGuideSeen).toBe(false);
  expect(stable.persistent.testplay.layoutGuideSeen).toBe(true);
  expect(PAGE_PARTS).toEqual(['heading','notice','pixels','generator','cursors','upgrades']);
  expect(Object.keys(first.run.seed.page.layout!.parts)).toHaveLength(6);
  expect(first.run.seed.page.layout!.parts.generator.width).toBeGreaterThanOrEqual(BALANCE.pageDesign.buttonMinWidth);
  expect(first.run.seed.page.layout!.parts.generator.height).toBeGreaterThanOrEqual(BALANCE.pageDesign.buttonMinHeight);
  for(const era of [1,2])expect(createFixture(`tp1-first-layout-era${era}`,now)!.persistent.testplay.layoutGuideSeen).toBe(true);
 });
 it('本線の入口は未購入・未制作で、セット購入だけでは完成品を増やさない',()=>{
  const s=createFixture('tp2-route-era0',now)!;
  expect(s.run.world).toBe('kumiki');expect(s.run.workshop.purchasedSets).toEqual([]);expect(completedParts(s)).toEqual([]);
  expect(canBuyWorkshopSet(s,'common')).toBe(true);expect(canBuyWorkshopSet(s,'foundation')).toBe(false);
  const purchased=actWorkshop(s,{type:'buySet',set:'common'},now);
  expect(completedParts(purchased)).toEqual([]);expect(Object.keys(purchased.run.workshop.parts)).toHaveLength(4);
  expect(purchased.run.workshop.helpTarget).toEqual({set:'common'});
  expect(purchased.persistent.testplay.helpSeen).toContain('common');
  const closed=actWorkshop(purchased,{type:'help',target:null},now);
  expect(closed.run.workshop.helpTarget).toBeNull();expect(actWorkshop(closed,{type:'buySet',set:'common'},now)).toBe(closed);
 });
 it('工房の固定帯URLは未発見のトークンを、実際の初エクスポートで表示できる',()=>{
  for(const era of [0,1,2]){
   let s=createFixture(`tp1-workshop-shell-era${era}`,now)!;
   expect(s.resources.tokens).toBe(0);expect(s.run.workshop.tokenDiscovered).toBe(false);
   expect(s.run.workshop.parts['common-button']).toMatchObject({step:3,tested:false,exportedAt:null});
   expect(completedParts(s)).toHaveLength(1);expect(s.persistent.progress.records['first-export']).toBeUndefined();
   s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
   s=actWorkshop(s,{type:'export',part:'common-button'},now);
   expect(s.resources.tokens).toBe(BALANCE.workshop.exportTokens);expect(s.run.workshop.tokenDiscovered).toBe(true);
  }
 });
 it('完成プレビューの5節目は本線の実4工程で正確に0/5/11/17/21を作る',()=>{
  for(const era of [0,1,2])for(const count of [0,5,11,17,21]){
   const s=createFixture(`tp3-progress-${count}-era${era}`,now)!;
   expect(completedParts(s)).toHaveLength(count);
   expect(completedParts(s).every(id=>UI_SETS.find(set=>set.id===WORKSHOP_PARTS.find(part=>part.id===id)!.set)?.mainline)).toBe(true);
   expect(s.run.workshop.helpTarget).toBeNull();
  }
 });
 it('21個の固有仕上げURLは、前の作品を残し、対象だけ工程4の直前で止まる',()=>{
  const parts=WORKSHOP_PARTS.filter(part=>UI_SETS.find(set=>set.id===part.set)?.mainline);
  for(const era of [0,1,2])for(const [index,part] of parts.entries()){
   const s=createFixture(`tp3-finish-${part.id}-era${era}`,now)!;
   expect(s.run.workshop.activePart).toBe(part.id);expect(s.run.workshop.parts[part.id]).toMatchObject({step:3,tested:false,completedAt:null,exportedAt:null});
   expect(completedParts(s)).toHaveLength(index);expect(isGameState(s)).toBe(true);
  }
 });
 it('ヘルプ全量URLは本線21完成と任意材料の未完成を分離する',()=>{
  for(const era of [0,1,2]){
   const s=createFixture(`tp2-help-catalog-era${era}`,now)!;
   expect(s.run.world).toBe('desktop');expect(s.run.version).toBe('v2');
   expect(new Set(s.run.workshop.purchasedSets)).toEqual(new Set(UI_SETS.map(set=>set.id)));
   expect(completedParts(s)).toHaveLength(21);
   for(const part of WORKSHOP_PARTS.filter(part=>!UI_SETS.find(set=>set.id===part.set)?.mainline))expect(s.run.workshop.parts[part.id]?.step).toBe(0);
   expect(s.run.workshop.helpTarget).toBeNull();
  }
 });
 it('2周目URLは実出荷の既知UIから一括候補を作り、完成品はリセットする',()=>{
  for(const era of [0,1,2]){
   const s=createFixture(`tp3-second-run-era${era}`,now)!;
   expect(s.run.world).toBe('seed');expect(s.run.version).toBe('v2');expect(s.run.seed.built).toEqual([]);
   expect(s.run.workshop.purchasedSets).toEqual([]);expect(completedParts(s)).toEqual([]);
   expect(s.persistent.products.some(product=>product.version==='v1.0')).toBe(true);
   expect(knownSeedItems(s)).toEqual(BALANCE.w1.items.map(item=>item.id));
   const q=seedReplayQuote(s);expect(q.items).toEqual(BALANCE.w1.items.map(item=>item.id));expect(q.cost).toBe(BALANCE.w1.items.reduce((sum,item)=>sum+item.cost,0));
   expect(s.persistent.testplay.layoutGuideSeen).toBe(true);
  }
 });
 it('真正main v15の6保存を、財布・作品・写真を失わず現形式へ移す',()=>{
  for(const name of ['seed-before-layout','seed-custom-layout','seed-inherited-layout','workshop-mid','desktop-records','shipping']){
   const text=gunzipSync(readFileSync(new URL(`./testdata/tp-v15-main-${name}.json.gz`,import.meta.url))).toString('utf8'),old=JSON.parse(text);
   expect(old.schemaVersion).toBe(15);
   const migrated=decodeSave(text);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(isGameState(migrated)).toBe(true);
   expect(migrated.resources).toEqual(old.resources);
   for(const key of ['specs','seedSkills','editorSkills','products','screenshots'] as const)expect(migrated.persistent[key],name+':'+key).toEqual(old.persistent[key]);
   const foldParts=(parts:Record<string,unknown>)=>{const copy=structuredClone(parts);mergeLegacyScrollbarIntoFrame(copy);return copy;};
   expect(migrated.persistent.setDocuments).toEqual(old.persistent.setDocuments.map((doc:{parts:Record<string,unknown>})=>({...doc,parts:foldParts(doc.parts)})));
   expect(migrated.run.workshop.parts).toEqual(foldParts(old.run.workshop.parts));
   expect(decodeSave(encodeSave(migrated))).toEqual(migrated);
   if(old.run.seed.page.layout)expect(Object.keys(migrated.run.seed.page.layout!.parts)).toHaveLength(6);
   if(name==='seed-inherited-layout')expect(migrated.persistent.testplay.layoutGuideSeen).toBe(true);
  }
 },30_000);
});
