import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../content/i18n';
import { partsForSet, type UiSetId } from '../../content/workshopCatalog';
import { createInitialState } from '../../systems/state';
import { createComponentDesign, type PartProduction, type SetDocument } from '../../systems/workshopState';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { FilesApp } from './FilesApp';
import { SetDocumentView } from './SetDocumentView';
import { World4Preparation } from '../workshop/World4Preparation';
import { createWorkshopTargetState, workshopTargetReducer, targetFileEntries } from '../workshop/WorkshopTargetContext';
const now=1_800_000_000_000;
function document(version:SetDocument['version'],set:UiSetId):SetDocument {
 return {id:`${version}:${set}`,version,set,at:now,parts:Object.fromEntries(partsForSet(set).map(part=>[part.id,{step:4,rect:{...part.defaultRect},elements:[...part.elements],design:createComponentDesign(),completedAt:now,exportedAt:null,tested:true} satisfies PartProduction]))};
}
describe('現在版と旧版の書類を開く新しいファイルUI',()=>{
 it.each(['ja','en','en-XA'])('%s：版と読み取り専用の状態を、実際のファイル行と本文に示す',language=>{
  const i18n=createI18n(language),s=createInitialState(now);s.run.version='v1';s.persistent.setDocuments=[document('v0.1','common'),document('v1','files')];
  const before=JSON.stringify(s),runtime={} as GameRuntime;
  const rows=renderToStaticMarkup(<FilesApp runtime={runtime} snapshot={{state:s} as RuntimeSnapshot} i18n={i18n}/>);
  expect(rows).toContain('data-file="note"');expect(rows).toContain('data-file-edition="archive"');expect(rows).toContain('data-file-edition="current"');expect(rows).toContain('data-file-version="v0.1"');expect(rows).toContain(i18n.t('desktop.app.note'));
  const archive=renderToStaticMarkup(<SetDocumentView document={s.persistent.setDocuments[0]!} state={s} i18n={i18n} onEdit={()=>{}}/>);
  expect(archive).toContain('data-document-readonly="true"');expect(archive).toContain(i18n.t('files.oldVersion'));expect(archive).toContain('data-static-common-frame="true"');expect(archive).not.toContain('data-document-open-editor');expect(archive).not.toContain('data-workshop-adjust');
  const current=renderToStaticMarkup(<SetDocumentView document={s.persistent.setDocuments[1]!} state={s} i18n={i18n} onEdit={()=>{}}/>);
  expect(current).toContain('data-document-open-editor');expect(current).toContain(i18n.t('files.currentVersion'));
  expect(JSON.stringify(s)).toBe(before);
 });
 it('工房内のファイルも完成書類・ひな型・ノートを使い、未完成パーツの仮ファイルは作らない',()=>{
  const s=createInitialState(now);s.run.workshop.purchasedSets=['files'];s.persistent.setDocuments=[document('v0.1','common')];
  const entries=targetFileEntries(s,createI18n('ja'));
  expect(entries.map(entry=>entry.type)).toEqual(['set','note','app']);
  expect(entries.some(entry=>entry.type==='part')).toBe(false);
 });
});
describe('世界4の制作の入口と準備表示',()=>{
 it.each(['ja','en','en-XA'])('%s：部品・ファイルへの格納・60Hzをそれぞれ実値で表示する',language=>{
  const s=createInitialState(now),i18n=createI18n(language),doc=document('v2','stream');s.run.version='v2';s.run.world='desktop';s.run.desktop.entered=true;s.run.workshop.purchasedSets=['stream'];s.run.workshop.parts=doc.parts;s.persistent.setDocuments=[doc];s.persistent.specs.refresh=1;
  const render=()=>renderToStaticMarkup(<World4Preparation state={s} i18n={i18n} dispatch={()=>{}}/>);
  const ready=render();expect(ready).toContain('data-world4-ready="true"');expect(ready).toContain('data-world4-stored-sets="stream"');expect(ready).toContain('data-world4-required-hz="60"');expect(ready).toContain(i18n.t('world4.ready'));
  s.persistent.setDocuments=[document('v1','stream')];expect(render()).toContain('data-world4-ready="false"');expect(render()).toContain('data-world4-document-stored="false"');
  s.persistent.setDocuments=[doc];s.persistent.specs.refresh=0;expect(render()).toContain('data-world4-spec-ready="false"');
 });
 it('配信素材の場面・メッセージ選択・プレビュー選択は同じ試用状態へ反映する',()=>{
  const initial=createWorkshopTargetState();let state=workshopTargetReducer(initial,{type:'stream-scene',scene:'messages'});
  state=workshopTargetReducer(state,{type:'stream-message',id:'feedback:1'});state=workshopTargetReducer(state,{type:'stream-preview'});
  expect(state.stream).toEqual({scene:'messages',selectedMessage:'feedback:1',previewSelected:true});expect(initial.stream).toEqual({scene:'source',selectedMessage:null,previewSelected:false});
  state=workshopTargetReducer(state,{type:'stream-scene',scene:'source'});expect(state.stream.previewSelected).toBe(false);
 });
});
