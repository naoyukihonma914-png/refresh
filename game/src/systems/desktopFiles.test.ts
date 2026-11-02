import { describe, expect, it } from 'vitest';
import { createI18n } from '../content/i18n';
import { partsForSet, type UiSetId } from '../content/workshopCatalog';
import { emptyProject } from './appLayout';
import { createInitialState } from './state';
import { createComponentDesign, type SetDocument, type PartProduction } from './workshopState';
import { documentFiles, rawDesktopFiles, desktopFiles, byteSize, defaultNote } from './desktopFiles';
const now=1_800_000_000_000;
const i18n=createI18n('ja');
function document(version:SetDocument['version'],set:UiSetId='common'):SetDocument {
 return {id:`${version}:${set}`,version,set,at:now,parts:Object.fromEntries(partsForSet(set).map(part=>[part.id,{step:4,rect:{...part.defaultRect},elements:[...part.elements],design:createComponentDesign(),completedAt:now,exportedAt:null,tested:true} satisfies PartProduction]))};
}
describe('第3版：保存した制作物から作るファイルの内容',()=>{
 it('アプリもセットも未購入の時点から制作ノート.txtが常在し、制作対象にならない',()=>{
  const s=createInitialState(now),files=rawDesktopFiles(s,i18n);
  expect(files.filter(file=>file.kind==='note')).toMatchObject([{id:'note',name:i18n.t('desktop.app.note'),at:null,bytes:byteSize(defaultNote(i18n))}]);
  expect(files.map(file=>file.kind)).toEqual(['note','folder','folder']);
  expect(s.run.workshop.purchasedSets).toEqual([]);expect(s.run.desktop.projects).toEqual({});
 });
 it('現在版と旧版の完成書類を同時に並べ、部分エクスポートを完成扱いしない',()=>{
  const s=createInitialState(now);s.run.version='v1';
  const older=document('v0.1'),current=document('v1'),partial=document('v1','files');
  const first=Object.keys(partial.parts)[0] as keyof typeof partial.parts;partial.parts={[first]:partial.parts[first]};
  s.persistent.setDocuments=[older,current,partial];
  const saved=structuredClone(s),files=documentFiles(s,i18n);
  expect(files.map(file=>[file.id,file.edition])).toEqual([['set:v0.1:common','archive'],['set:v1:common','current']]);
  expect(files[0]?.setDocument).toBe(older);expect(files[1]?.setDocument).toBe(current);
  expect(files.every(file=>file.name.includes(file.setDocument!.version))).toBe(true);
  expect(s).toEqual(saved);expect(s.persistent.setDocuments).toHaveLength(3);
 });
 it('ひな型やアプリの旧構成情報はライブの書類一覧へ複製しない',()=>{
  const s=createInitialState(now);s.run.desktop.projects={files:emptyProject()};
  s.persistent.setDocuments=[document('v0.1','files')];
  const files=rawDesktopFiles(s,i18n);
  expect(files.filter(file=>file.kind==='set')).toHaveLength(1);
  expect(files.some(file=>['icon','part'].includes(file.kind))).toBe(false);
  expect(files.filter(file=>file.kind==='app')).toMatchObject([{id:'blueprint:v0.1:files',appId:'files',version:'v0.1'}]);
  expect(rawDesktopFiles(s,i18n,'exports').map(file=>file.id)).toEqual(['set:v0.1:files']);
 });
 it('セットの材料購入で新しいひな型書類を得るが、完成パーツやアプリは増やさない',()=>{
  const s=createInitialState(now);s.run.workshop.purchasedSets=['photo'];
  const blueprints=rawDesktopFiles(s,i18n).filter(file=>file.kind==='app');
  expect(blueprints).toMatchObject([{id:'blueprint:v0.1:photo',appId:'photo',edition:'current'}]);
  expect(blueprints[0]!.name).toBe(i18n.t('builder.document',{app:i18n.t('desktop.app.photo')}));
  expect(s.run.workshop.parts).toEqual({});expect(s.run.desktop.apps).toEqual([]);expect(s.run.desktop.projects).toEqual({});
 });
 it('写真のアルバムとごみ箱の除外を維持し、セット書類やノートは消さない',()=>{
  const s=createInitialState(now);s.persistent.screenshots=[{id:1,at:now,language:'ja',data:'{}'},{id:2,at:now,language:'ja',data:'{}',deleted:true}];
  expect(rawDesktopFiles(s,i18n,'screenshots').map(file=>file.id)).toEqual(['shot:1']);
  s.run.desktop.trash=[{id:'shot:1',at:now,reward:0,first:true}];
  expect(desktopFiles(s,i18n,'screenshots')).toEqual([]);
  expect(desktopFiles(s,i18n,'root').some(file=>file.id==='note')).toBe(true);
  s.run.desktop.trash=[];
  expect(desktopFiles(s,i18n,'screenshots').map(file=>file.id)).toEqual(['shot:1']);
 });
 it('ノート本文の編集と更新日時を実際のテキスト書類へ反映する',()=>{
  const s=createInitialState(now);s.persistent.productionNote='player note';s.persistent.noteUpdatedAt=now;
  expect(rawDesktopFiles(s,i18n).find(file=>file.id==='note')).toMatchObject({kind:'note',at:now,bytes:byteSize('player note')});
 });
});
