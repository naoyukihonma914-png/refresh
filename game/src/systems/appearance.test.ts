import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,it,expect } from 'vitest';
import { createI18n } from '../content/i18n';
import { createFixture } from './fixtures';
import { buyKumikiSkill,actKumiki,paintDrawing } from './kumiki';
import { actDesktop,takeScreenshot } from './desktop';
import { unlockedDesktopStage,canSwitchEditor,editorName,appName,setDesktopStage,setEditorStage } from './appearance';
import { decodeSave,encodeSave } from './save';
import { isGameState } from './state';
import { readCapture,restoreScene,isCaptureScene } from './captureScene';
import { advanceShipping,beginPrototypeRelease,startNextVersion } from './release';
import { BALANCE } from '../config/balance';
const now=1800000000000;
const fixture=()=>createFixture('desktop-ready',now)!;
describe('段階6.1：見た目の進化と互換性',()=>{
 it('最初のTesseraをv0.1の間に3トークンで更新し、再購入で払わない',()=>{
  let s=createFixture('kumiki-wall',now)!;s.resources.tokens=3;
  s=buyKumikiSkill(s,'update');expect(s.resources.tokens).toBe(0);expect(s.persistent.appearance.editor).toBe(1);expect(s.run.version).toBe('v0.1');
  expect(buyKumikiSkill(s,'update')).toBe(s);expect(isGameState(s)).toBe(true);
 });
 it('大型アップデートは4・20トークン、順序と周回の帯を守る',()=>{
  let s=fixture();s.resources.tokens=24;
  expect(actDesktop(s,{type:'skill',id:'major2'},now)).toBe(s);
  s=actDesktop(s,{type:'skill',id:'major1'},now);expect(s.resources.tokens).toBe(20);expect(s.persistent.appearance.desktop).toBe(1);
  s=actDesktop(s,{type:'skill',id:'major2'},now);expect(s.resources.tokens).toBe(0);expect(s.persistent.appearance.desktop).toBe(2);
  expect(actDesktop(s,{type:'skill',id:'major2'},now)).toBe(s);
  const early=createFixture('kumiki-wall',now)!;expect(actDesktop(early,{type:'skill',id:'major2'},now)).toBe(early);
 });
 it('GessoはTessera更新と取得済みデスクトップ段2が必要。表示を段0に戻していても乗り換えられる',()=>{
  let s=fixture();s.resources.tokens=100;s=buyKumikiSkill(s,'update');
  expect(canSwitchEditor(s)).toBe(false);expect(buyKumikiSkill(s,'modern')).toBe(s);
  s=actDesktop(s,{type:'skill',id:'major1'},now);expect(buyKumikiSkill(s,'modern')).toBe(s);
  s=actDesktop(s,{type:'skill',id:'major2'},now);s=setDesktopStage(s,0);expect(unlockedDesktopStage(s)).toBe(2);expect(canSwitchEditor(s)).toBe(true);
  const before=s.resources.tokens;s=buyKumikiSkill(s,'modern');expect(s.resources.tokens).toBe(before-25);expect(s.persistent.appearance.editor).toBe(2);
  for(const lang of ['ja','en']){const i18n=createI18n(lang);expect(editorName(s,i18n)).toBe('Gesso');expect(appName(s,'tessera',i18n)).toBe('Gesso');expect(appName(setEditorStage(s,1),'tessera',i18n)).toBe('Tessera');}
 });
 it('未取得の段・範囲外の段を拒み、戻しても絵・道具・設定・ジョブ・窓の配置を変えない',()=>{
  let s=fixture();expect(setEditorStage(s,1)).toBe(s);expect(setDesktopStage(s,1)).toBe(s);
  s=createFixture('desktop-stage2',now)!;s=paintDrawing(s,'free',[0],3);s=actDesktop(s,{type:'theme',radius:3},now);
  const k=s.run.kumiki,art=s.persistent.artwork,prefs=s.persistent.desktopPrefs,d=s.run.desktop,resources=s.resources;
  s=actKumiki(s,{type:'editor-stage',stage:0},now);s=actDesktop(s,{type:'desktop-stage',stage:0},now);
  expect(s.run.kumiki).toBe(k);expect(s.run.desktop.jobs).toBe(d.jobs);expect(s.run.desktop.apps).toBe(d.apps);expect(s.resources).toBe(resources);expect(s.persistent.artwork.skills).toBe(art.skills);expect(s.persistent.artwork.sketchbook).toBe(art.sketchbook);expect(s.persistent.desktopPrefs).toBe(prefs);
  expect(setEditorStage(s,3 as never)).toBe(s);expect(setDesktopStage(s,-1 as never)).toBe(s);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('選んだ段と取得した動作環境を周回後も引き継ぐ',()=>{
  let s=createFixture('release-ready',now)!;s.resources.tokens=200;s=buyKumikiSkill(s,'update');s.persistent.desktopPrefs.skills=['major1','major2'];s=buyKumikiSkill({...s,run:{...s.run,version:'v1'}},'modern');s.run.version='v0.1';s=setEditorStage(s,1);s=setDesktopStage(s,0);
  s=advanceShipping(beginPrototypeRelease(s,now),BALANCE.release.animationMs);s.persistent.specs.color=1;s=startNextVersion(s,now);
  expect(s.run.version).toBe('v1');expect(s.persistent.appearance).toEqual({editor:1,desktop:0});expect(canSwitchEditor(s)).toBe(true);expect(s.persistent.artwork.skills).toContain('modern');expect(isGameState(s)).toBe(true);
 });
 it('実際の第8版とV2撮影は書き換えず、旧modern購入者には新しい動作環境を付ける',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v8-two-shots.json.gz',import.meta.url))).toString(),old=JSON.parse(raw),s=decodeSave(raw);
  expect(s.schemaVersion).toBe(10);expect(s.resources).toEqual(old.resources);expect(s.persistent.screenshots).toEqual(old.persistent.screenshots);expect(readCapture(s.persistent.screenshots[0]!).version).toBe(2);
  expect(s.persistent.appearance).toEqual({editor:0,desktop:0});expect(s.persistent.desktopPrefs.radiusCustom).toBe(false);
  old.persistent.artwork.skills.push('modern');old.persistent.artwork.modern=true;old.persistent.desktopPrefs.radius=3;
  const modern=decodeSave(JSON.stringify(old));expect(modern.persistent.appearance).toEqual({editor:2,desktop:2});expect(modern.persistent.artwork.skills).toContain('update');expect(canSwitchEditor(modern)).toBe(true);expect(modern.persistent.desktopPrefs.radiusCustom).toBe(true);expect(modern.resources).toEqual(s.resources);
 });
 it('V4撮影は撮影時の段・角の設定を持ち、後の変更を受けない。過去のV1・V2も混在できる',()=>{
  let s=createFixture('desktop-stage2',now)!;s=actDesktop(s,{type:'theme',radius:3},now);s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,'ja');const shot=s.persistent.screenshots.at(-1)!;const scene=readCapture(shot);
  expect(scene.version).toBe(4);expect(isCaptureScene(scene)).toBe(true);s=setDesktopStage(setEditorStage(s,0),0);s=actDesktop(s,{type:'theme',autoRadius:true},now);
  const frozen=restoreScene(shot,s.persistent.screenshots);expect(frozen.persistent.appearance).toEqual({editor:2,desktop:2});expect(frozen.persistent.desktopPrefs).toMatchObject({radius:3,radiusCustom:true});
  const invalid=structuredClone(scene);if(invalid.version===4){invalid.appearance.desktop=9 as never;expect(isCaptureScene(invalid)).toBe(false);}
  const mixed=decodeSave(gunzipSync(readFileSync(new URL('./testdata/v7-two-shots.json.gz',import.meta.url))).toString());mixed.persistent.screenshots.push({...shot,id:10});mixed.persistent.desktopPrefs.lastShotId=10;expect(decodeSave(encodeSave(mixed))).toEqual(mixed);
 });
 it.each(['editor-stage0','editor-stage1','editor-stage2','desktop-stage0','desktop-stage1','desktop-stage2'])('%sの状態を往復できる',name=>{const s=createFixture(name,now)!;expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);});
});
