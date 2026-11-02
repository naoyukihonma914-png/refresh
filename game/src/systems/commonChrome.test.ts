import {describe,expect,it} from 'vitest';
import {actAppBuild} from './appBuild';
import {installedAssembly} from './appAssembly';
import {producedControlPalette,producedControlSide,producedWindowChrome} from './commonChrome';
import {createFixture} from './fixtures';
import {decodeSave,encodeSave} from './save';
import {actWorkshop} from './workshop';
import {createComponentDesign,colorContrast} from './workshopState';

const now=1_800_000_000_000;

describe('段階8b：入れたアプリの窓枠は採用時点の作品を保つ',()=>{
 it('完成した共通枠があっても、未インストールのアプリに編集元を代用しない',()=>{
  let s=createFixture('desktop-early',now)!;
  expect(producedWindowChrome(s)).not.toBeNull();expect(producedWindowChrome(s,'files')).toBeNull();
  s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-recommend',app:'files'});
  expect(s.run.desktop.projects.files!.draftAssembly!.common.some(material=>material.source==='common-frame')).toBe(true);
  expect(producedWindowChrome(s,'files')).toBeNull();
  s=actAppBuild(s,{type:'app-install',app:'files'});expect(producedWindowChrome(s,'files')).not.toBeNull();
 });
 it('元素材の色・記号順・左右を変えても、読込とinstallが済むまで既存の窓へ波及しない',()=>{
  let s=createFixture('desktop-ready',now)!;const files=structuredClone(producedWindowChrome(s,'files')),mail=structuredClone(producedWindowChrome(s,'mail'));
  expect(files).not.toBeNull();expect(mail).not.toBeNull();
  s=actWorkshop(s,{type:'addElement',part:'common-frame',element:'close',index:0,side:'start'},now+1);
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{color:'#1f3f7a',textColor:'#ffffff',radius:8,symbolShape:'square',controlColors:{close:'#f6d27a'}}},now+1);
  const current=producedWindowChrome(s)!;expect(current.symbols[0]).toBe('close');expect(current.design.color).toBe('#1f3f7a');expect(current.customColors).toBe(true);
  expect(producedControlSide(current,'close')).toBe('start');expect(producedControlSide(current,'minimize')).toBe('end');
  expect(producedWindowChrome(s,'files')).toEqual(files);expect(producedWindowChrome(s,'mail')).toEqual(mail);
  // The editor and native windows use the current work; installed apps retain their own material.
  expect(producedWindowChrome(s,'tessera')).toEqual(current);expect(producedWindowChrome(s,'note')).toEqual(current);
  s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-refresh',app:'files'});
  expect(s.run.desktop.projects.files!.draftAssembly!.common.find(material=>material.source==='common-frame')!.design).toEqual(current.design);
  expect(producedWindowChrome(s,'files')).toEqual(files);
  s=decodeSave(encodeSave(s));expect(producedWindowChrome(s,'files')).toEqual(files);
  s=actAppBuild(s,{type:'app-install',app:'files'});expect(producedWindowChrome(s,'files')).toEqual(current);expect(producedWindowChrome(s,'mail')).toEqual(mail);
  const frozen=structuredClone(installedAssembly(s,'files')!.common.find(material=>material.source==='common-frame'));
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{controlColors:{close:'#ffffff'},controlSides:{close:'end'}}},now+2);
  expect(installedAssembly(s,'files')!.common.find(material=>material.source==='common-frame')).toEqual(frozen);
  expect(producedControlSide(producedWindowChrome(s,'files')!,'close')).toBe('start');
 });
});


describe('制作した記号の配色は検証した下地との組み合わせを保つ',()=>{
 it('標準の記号は時代ごとの標準色を使う',()=>{
  expect(producedControlPalette(createComponentDesign(),'close')).toEqual({});
 });
 it('独自の文字色は、それを読めるようにした部品の下地と一緒に渡す',()=>{
  const design={...createComponentDesign(),nativeColors:false,color:'#000000',textColor:'#ffffff'};
  expect(producedControlPalette(design,'close')).toEqual({color:'#ffffff',backgroundColor:'#000000'});
 });
 it('記号だけ独自の色なら、その記号にだけ読める下地を付け、他の記号や標準色の指定を変えない',()=>{
  const design={...createComponentDesign(),controlColors:{close:'#f6d27a'}},pair=producedControlPalette(design,'close');
  expect(pair).toEqual({color:'#f6d27a',backgroundColor:design.color});expect(colorContrast(pair.color!,pair.backgroundColor!)).toBeGreaterThanOrEqual(4.5);
  expect(producedControlPalette(design,'minimize')).toEqual({});expect(design.nativeColors).toBe(true);
 });
});
