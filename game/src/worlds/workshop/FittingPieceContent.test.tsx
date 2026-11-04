import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../content/i18n';
import { fittingDefinition, FITTING_PARTS } from '../../content/workshopFitting';
import { getWorkshopPart, type WorkshopPartId } from '../../content/workshopCatalog';
import { createInitialState } from '../../systems/state';
import { createComponentDesign, type PartProduction } from '../../systems/workshopState';
import { WorkshopTargetProvider } from './WorkshopTargetContext';
import { OptionalTargetProvider } from './OptionalParts';
import { FittingPieceContent } from './FittingPieceContent';

function render(id:WorkshopPartId,piece:string,elements:string[]=[piece],loose=false,language='ja'){
 const state=createInitialState(1_800_000_000_000),part=getWorkshopPart(id),i18n=createI18n(language);
 const production:PartProduction={step:1,rect:part.defaultRect,elements,design:createComponentDesign(),tested:false,completedAt:null,exportedAt:null};
 return renderToStaticMarkup(<WorkshopTargetProvider gameState={state} i18n={i18n}><OptionalTargetProvider gameState={state} i18n={i18n}><FittingPieceContent part={part} piece={piece} production={production} state={state} i18n={i18n} loose={loose}/></OptionalTargetProvider></WorkshopTargetProvider>);
}

describe('はめた直後から働くパーツのピース',()=>{
 it.each(['ja','en'])('%s：52パーツの全ピースが、他ピースも仕上げ工程も要求せずに実体を持つ',language=>{
  expect(FITTING_PARTS).toHaveLength(52);
  for(const part of FITTING_PARTS)for(const piece of fittingDefinition(part.id).pieces){
   const html=render(part.id,piece,[piece],false,language);
   expect(html,`${part.id}:${piece}`).toContain(`data-workshop-control-piece="${piece}"`);
   expect(html,`${part.id}:${piece}`).not.toContain('hidden=""');
   expect(html,`${part.id}:${piece}`).not.toContain('data-finish-trial');
   expect(html,`${part.id}:${piece}`).not.toContain('undefined');
   expect(html,`${part.id}:${piece}`).not.toContain('data-piece-front="false"');
  }
 });
 it('溝をまだ作っていなくてもつまみで写真・テーマの値を動かせる',()=>{
  for(const id of ['photo-brightness','photo-tone','theme-radius','theme-icons'] as const){
   const html=render(id,'thumb');expect(html).toContain('type="range"');expect(html).not.toContain('disabled');
  }
 });
 it('検索欄・下書き欄は別のボタンをはめる前から文字を入力できる',()=>{
  expect(render('files-search','query')).toContain('<input');expect(render('files-search','query')).not.toContain('disabled');
  expect(render('mail-reply','draft')).toContain('<textarea');expect(render('mail-reply','draft')).not.toContain('disabled');
 });
 it('状態の座は未読と実行を表に出し、裏の状態は同じ座を覆わない',()=>{
  expect(render('mail-unread','unread',['unread','read'])).not.toContain('hidden=""');
  expect(render('mail-unread','read',['unread','read'])).toContain('hidden=""');
  expect(render('terminal-run','run',['run','stop'])).not.toContain('hidden=""');
  expect(render('terminal-run','stop',['run','stop'])).toContain('hidden=""');
  expect(render('terminal-run','stop',['run','stop'],true)).not.toContain('hidden=""');
 });
 it('トレイの見本の操作は無効で、窓ボタンははめた時点で有効になる',()=>{
  expect(render('common-frame','minimize',[],true)).toContain('disabled');
  expect(render('common-frame','minimize')).toContain('data-workshop-control="minimize"');
  expect(render('common-frame','minimize')).not.toContain('disabled');
 });
});
