import {createInitialState} from './state';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {createI18n} from '../content/i18n';
import {LegacyCapturePreview} from '../worlds/LegacyCapturePreview';
import {isCaptureScene,encodeScene,projectCapture,readCapture,type CaptureScene} from './captureScene';
import {capturedContentSummary,photoContentQuality} from './capturePhoto';
import {isCapturePageDesignV12} from './capturePageDesign';
import {decodeCapture,type Screenshot} from './desktopState';
import {createFixture} from './fixtures';
import {isLegacyPageDesign} from './legacyPageDesign';
import {createPageDesign,isPageDesign,PAGE_PARTS,recommendedPage} from './pageDesign';

import {decodeSave,encodeSave} from './save';



const now=1_800_000_000_000;
function published(){
 const load=(name:string)=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/${name}.json.gz`,import.meta.url))).toString());
 const save=load('tp-v15-main-desktop-records'),productSave=load('tp-v15-main-shipping'),older=load('v14-stage8a-release');
 const scene11=save.persistent.screenshots.map((shot:Screenshot)=>decodeCapture(shot.data)).find((scene:CaptureScene)=>scene.version===11);
 const scene10=older.persistent.screenshots.map((shot:Screenshot)=>decodeCapture(shot.data)).find((scene:CaptureScene)=>scene.version===10);
 if(!scene10||!scene11)throw new Error('Authentic published recording fixture missing');
 return {save,productSave,scene10,scene11};
}
const wrapped=(scene:CaptureScene,id=100):Screenshot=>({id,at:now,language:'ja',data:encodeScene(scene)});

describe('TP-1：旧ページ配置を含む写真と製品は過去の契約で読む',()=>{
 it('実際の保存写真10/11を新しい6部品へ書き換えず、古い4部品のまま読む',()=>{
  const old=published();
  for(const scene of [old.scene10,old.scene11]){
   expect(isCaptureScene(scene)).toBe(true);expect(isLegacyPageDesign(scene.page)).toBe(true);
   expect(isPageDesign(scene.page)).toBe(false);
   if(scene.page.layout)expect(Object.keys(scene.page.layout.parts)).toEqual(['heading','notice','generator','upgrades']);
   else expect(scene.page.layout).toBeNull();
   const shot=wrapped(scene),data=shot.data,read=readCapture(shot);
   expect(read.page).toEqual(scene.page);expect(read.version).toBe(scene.version);
   const before=renderToStaticMarkup(<LegacyCapturePreview shot={shot} catalog={[shot]} i18n={createI18n('ja')}/>);
   expect(before).toContain(`data-capture-format="${scene.version}"`);
   expect(shot.data).toBe(data);expect(readCapture(shot)).toEqual(read);
  }
 });
 it('旧ページの検査は現在のUI下限やおすすめの寸法から独立している',()=>{
  const {scene11}=published(),original=BALANCE.pageDesign.minWidth;
  try{
   (BALANCE.pageDesign as unknown as {minWidth:number}).minWidth=1920;
   expect(isCaptureScene(scene11)).toBe(true);expect(isLegacyPageDesign(scene11.page)).toBe(true);
  }finally{(BALANCE.pageDesign as unknown as {minWidth:number}).minWidth=original;}
 });
 it('新しい写真12は6つの配置と文字サイズ段階を凍結し、10/11へ偽装できない',()=>{
  const s=createFixture('stage8b-capture-uncovered-era0',now)!;
  s.run.seed.page={...createPageDesign(),layout:recommendedPage()};
  s.run.seed.page.partFonts.generator='large';s.run.seed.page.partFonts.pixels='small';
  const scene=projectCapture(s,'ja'),before=structuredClone(scene.page),old=published();
  expect(scene.version).toBe(12);expect(isCaptureScene(scene)).toBe(true);
  expect(Object.keys(scene.page.layout!.parts).sort()).toEqual([...PAGE_PARTS].sort());
  expect(scene.page.partFonts.generator).toBe('large');expect(scene.page.partFonts.pixels).toBe('small');
  expect(isCaptureScene({...scene,version:11})).toBe(false);
  expect(isCaptureScene({...scene,version:10})).toBe(false);
  expect(isCaptureScene({...scene,page:old.scene11.page})).toBe(false);
  const shot=wrapped(scene),render=()=>renderToStaticMarkup(<LegacyCapturePreview shot={shot} catalog={[shot]} i18n={createI18n('en')}/>),markup=render();
  expect(markup).toContain('capture-native');expect(markup).toContain('data-capture-format="12"');
  s.run.seed.page.partFonts.generator='small';s.run.seed.page.layout!.parts.generator.x+=BALANCE.pageDesign.grid;
  expect(readCapture(shot).page).toEqual(before);expect(render()).toBe(markup);
 });
 it('写真12の読取検査も現在のUI最小寸法を再適用せず、構造の破損だけを拒む',()=>{
  const s=createFixture('stage8b-capture-uncovered-era0',now)!,scene=projectCapture(s,'ja');
  scene.page.layout=recommendedPage();
  const original=BALANCE.pageDesign.buttonMinWidth;
  try{
   (BALANCE.pageDesign as unknown as {buttonMinWidth:number}).buttonMinWidth=1920;
   expect(isCaptureScene(scene)).toBe(true);expect(isCapturePageDesignV12(scene.page)).toBe(true);
  }finally{(BALANCE.pageDesign as unknown as {buttonMinWidth:number}).buttonMinWidth=original;}
  const invalid=structuredClone(scene);invalid.page.layout!.parts.generator.x=-8;
  expect(isCaptureScene(invalid)).toBe(false);
  const overlap=structuredClone(scene);overlap.page.layout!.parts.cursors={...overlap.page.layout!.parts.generator};
  expect(isCaptureScene(overlap)).toBe(false);
  expect(isCaptureScene({...scene,page:{...scene.page,partFonts:{...scene.page.partFonts,generator:'huge'}}})).toBe(false);
 });
 it('ページの表現契約だけが違っても、凍結した可視内容・報酬・写真品質は変わらない',()=>{
  const {scene11}=published(),s=createFixture('stage8b-capture-uncovered-era0',now)!;
  const current={...scene11,version:12 as const,page:s.run.seed.page},legacyShot=wrapped(scene11),currentShot=wrapped(current);
  expect(isCaptureScene(current)).toBe(true);
  expect(readCapture(currentShot).evaluation).toEqual(readCapture(legacyShot).evaluation);
  expect(readCapture(currentShot).display.reward).toBe(readCapture(legacyShot).display.reward);
  expect(capturedContentSummary(currentShot)).toEqual(capturedContentSummary(legacyShot));
  expect(photoContentQuality(currentShot)).toBe(photoContentQuality(legacyShot));
 });
 it("形式15の試遊保存は書類や写真を移行せず新規開始にする",()=>{const old=published().save,raw=JSON.stringify(old),state=decodeSave(raw);expect(state).toEqual(createInitialState(old.lastTickAt));expect(JSON.stringify(old)).toBe(raw);expect(decodeSave(encodeSave(state))).toEqual(state);});
 it("形式15の出荷済み試遊保存も製品を引き継がず新規開始にする",()=>{const old=published().productSave,raw=JSON.stringify(old),state=decodeSave(raw);expect(state).toEqual(createInitialState(old.lastTickAt));expect(state.persistent.products).toEqual([]);expect(JSON.stringify(old)).toBe(raw);});
});
