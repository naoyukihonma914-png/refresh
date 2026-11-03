import {describe,expect,it} from 'vitest';
import {createInitialState} from './state';
import {getWorkshopPart} from '../content/workshopCatalog';
import {createComponentDesign} from './workshopState';
import {newlyCompletedPreviewParts,workshopPreviewObservation,type WorkshopPreviewObservation} from './workshopPreview';

describe('TP3：未来のデスクトップの投影',()=>{
 it('工程4だけを投影し、材料の購入・配置・型や既存アプリを完成品へ数えない',()=>{
  const state=createInitialState(1_800_000_000_000),definition=getWorkshopPart('common-button');
  state.run.workshop.parts['common-button']={step:3,rect:{...definition.defaultRect},elements:[...definition.elements],design:createComponentDesign(),completedAt:null,exportedAt:null,tested:false};
  const before=workshopPreviewObservation(state);expect(before.completed).toEqual({});
  state.run.workshop.parts['common-button']={...state.run.workshop.parts['common-button']!,step:4,tested:true,completedAt:state.createdAt+1};
  const after=workshopPreviewObservation(state);expect(after.completed).toEqual({'common-button':state.createdAt+1});
  expect(newlyCompletedPreviewParts(before,after)).toEqual(['common-button']);expect(before.completed).toEqual({});
  expect(state.run.desktop.apps).toEqual([]);expect(state.resources.pixels).toBe(0);
 });
 it('読込時の作品はそのまま描き、色変更やエクスポートで試運転を再発行しない',()=>{
  const before:WorkshopPreviewObservation={run:'same-run',completed:{'common-frame':1,'common-button':2}};
  expect(newlyCompletedPreviewParts(null,before)).toEqual([]);
  expect(newlyCompletedPreviewParts(before,{run:'same-run',completed:{...before.completed}})).toEqual([]);
  expect(newlyCompletedPreviewParts(before,{run:'same-run',completed:{...before.completed,'common-button':3}})).toEqual([]);
 });
 it('同時に完成したものも時刻とカタログ順で一度ずつ並べ、次の版では再生しない',()=>{
  const before:WorkshopPreviewObservation={run:'version-one',completed:{'common-frame':1}};
  const after:WorkshopPreviewObservation={run:'version-one',completed:{...before.completed,'common-progress':4,'common-button':3,'common-heading':3}};
  expect(newlyCompletedPreviewParts(before,after)).toEqual(['common-button','common-heading','common-progress']);
  expect(newlyCompletedPreviewParts(after,after)).toEqual([]);
  expect(newlyCompletedPreviewParts(before,{...after,run:'version-two'})).toEqual([]);
 });
});
