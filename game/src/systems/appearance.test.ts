import { describe,it,expect } from 'vitest';
import { createI18n } from '../content/i18n';
import { BALANCE } from '../config/balance';
import { createInitialState, isGameState } from './state';
import { actWorkshop, advanceWorkshop, enterWorkshop } from './workshop';
import { canSwitchEditor,editorName,appName,setDesktopStage,setEditorStage,unlockedDesktopStage,unlockedEditorStage } from './appearance';
const now=1_800_000_000_000;
function editor(){const s=createInitialState(now);s.resources.tokens=100;return advanceWorkshop(enterWorkshop(s),BALANCE.workshop.enterMs);}

describe('第3版：工房とデスクトップの見た目の段',()=>{
 it('Tesseraは初周中に3トークンで更新し、再購入で払わない',()=>{
  let s=editor();s.resources.tokens=3;s=actWorkshop(s,{type:'skill',id:'update'},now);
  expect(s.resources.tokens).toBe(0);expect(s.persistent.appearance.editor).toBe(1);expect(s.run.version).toBe('v0.1');
  expect(s.persistent.editorSkills).toEqual(['update']);expect(actWorkshop(s,{type:'skill',id:'update'},now)).toBe(s);expect(isGameState(s)).toBe(true);
 });
 it('Gessoは更新済みTesseraと取得済みデスクトップ段2が必要',()=>{
  let s=editor();s.run.version='v1';
  s.persistent.desktopPrefs.skills=['major1','major2'];expect(canSwitchEditor(s)).toBe(false);expect(actWorkshop(s,{type:'skill',id:'modern'},now)).toBe(s);
  s=actWorkshop(s,{type:'skill',id:'update'},now);s.persistent.desktopPrefs.skills=['major1'];expect(canSwitchEditor(s)).toBe(false);expect(actWorkshop(s,{type:'skill',id:'modern'},now)).toBe(s);
  s.persistent.desktopPrefs.skills=['major1','major2'];s=setDesktopStage(s,0);expect(unlockedDesktopStage(s)).toBe(2);expect(canSwitchEditor(s)).toBe(true);
  const before=s.resources.tokens;s=actWorkshop(s,{type:'skill',id:'modern'},now);
  expect(s.resources.tokens).toBe(before-25);expect(s.persistent.appearance).toEqual({editor:2,desktop:0});expect(unlockedEditorStage(s)).toBe(2);
  expect(s.persistent.editorCustomization.panelPositions).toEqual({palette:'right',tools:'left',parts:'left',info:'bottom'});
  for(const lang of ['ja','en']){const i18n=createI18n(lang);expect(editorName(s,i18n)).toBe('Gesso');expect(appName(s,'tessera',i18n)).toBe('Gesso');expect(appName(setEditorStage(s,1),'tessera',i18n)).toBe('Tessera');}
 });
 it('未取得の段と範囲外の値を拒む',()=>{
  const s=editor();expect(setEditorStage(s,1)).toBe(s);expect(setDesktopStage(s,1)).toBe(s);
  expect(setEditorStage(s,3 as never)).toBe(s);expect(setDesktopStage(s,-1 as never)).toBe(s);expect(setDesktopStage(s,4 as never)).toBe(s);
 });
 it('表示の段を戻しても購入済み道具・制作状態・資源・個人設定を変えない',()=>{
  let s=editor();s=actWorkshop(s,{type:'skill',id:'update'},now);s.persistent.desktopPrefs.skills=['major1','major2'];s=actWorkshop(s,{type:'skill',id:'modern'},now);
  s=setDesktopStage(s,2);s=actWorkshop(s,{type:'buySet',set:'clock'},now);
  const workshop=s.run.workshop,custom=s.persistent.editorCustomization,skills=s.persistent.editorSkills,resources=s.resources,jobs=s.run.desktop.jobs;
  s=setEditorStage(s,0);s=setDesktopStage(s,0);
  expect(s.run.workshop).toBe(workshop);expect(s.resources).toBe(resources);expect(s.persistent.editorSkills).toBe(skills);expect(s.persistent.editorCustomization).toBe(custom);expect(s.run.desktop.jobs).toBe(jobs);
  expect(canSwitchEditor(s)).toBe(true);expect(isGameState(s)).toBe(true);
 });
 it('デスクトップ段3を取得して表示を戻してもGessoの動作環境を満たす',()=>{
  let s=editor();s.persistent.desktopPrefs.skills=['major1','major2','major3'];s=actWorkshop(s,{type:'skill',id:'update'},now);s=setDesktopStage(s,3);s=setDesktopStage(s,0);
  expect(unlockedDesktopStage(s)).toBe(3);expect(canSwitchEditor(s)).toBe(true);s=actWorkshop(s,{type:'skill',id:'modern'},now);
  expect(s.persistent.appearance).toEqual({editor:2,desktop:0});expect(isGameState(s)).toBe(true);
 });
 it('帯2の制作プラグインは2周目v1から購入でき、再購入しない',()=>{
  let s=editor();for(const id of ['snap','motion','extraParts','efficiency'] as const)expect(actWorkshop(s,{type:'skill',id},now)).toBe(s);
  s.run.version='v1';s=actWorkshop(s,{type:'skill',id:'extraParts'},now);expect(s.resources.tokens).toBe(100-15);
  expect(actWorkshop(s,{type:'skill',id:'extraParts'},now)).toBe(s);s=actWorkshop(s,{type:'buySet',set:'extras'},now);
  expect(Object.keys(s.run.workshop.parts)).toEqual(['plugin-tabs','plugin-table']);
  for(const id of ['motion','efficiency'] as const){const before=s.resources.tokens;s=actWorkshop(s,{type:'skill',id},now);expect(s.persistent.editorSkills).toContain(id);expect(s.resources.tokens).toBeLessThan(before);expect(actWorkshop(s,{type:'skill',id},now)).toBe(s);}
  expect(isGameState(s)).toBe(true);
 });
 it('撤去した工程用プラグインは新しく課金せず、旧取得履歴は保つ',()=>{
  let s=editor();s.run.version='v1';
  for(const id of ['batch','dimensions','layers','snap'] as const)expect(actWorkshop(s,{type:'skill',id},now)).toBe(s);
  s.persistent.editorSkills=['batch','dimensions','layers','snap'];const owned=s.persistent.editorSkills,wallet=s.resources;
  s=actWorkshop(s,{type:'guide',id:'close'},now);
  expect(s.persistent.editorSkills).toBe(owned);expect(s.resources).toBe(wallet);expect(isGameState(s)).toBe(true);
 });
});
