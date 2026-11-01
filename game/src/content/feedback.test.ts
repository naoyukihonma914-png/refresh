import { describe,it,expect } from 'vitest';
import { createI18n } from './i18n';
import { feedbackBodyText } from './feedback';
import { createFixture } from '../systems/fixtures';
import { setEditorStage } from '../systems/appearance';
import { takeScreenshot } from '../systems/desktop';
import { restoreScene } from '../systems/captureScene';
const now=1800000000000;
describe('フィードバックのペイントソフト名',()=>{
 it.each(['ja','en'])('%s：本文と完了済みの履歴も現在の名前へ揃え、前の姿へ戻すとTesseraになる',lang=>{
  const i18n=createI18n(lang,{strictInterpolation:true});const s=createFixture('desktop-stage2',now)!;const request=s.run.desktop.feedback.find(f=>f.kind==='color')!;
  expect(feedbackBodyText(s,request,i18n)).toContain('Gesso');expect(feedbackBodyText(s,request,i18n)).not.toContain('Tessera');
  expect(feedbackBodyText(s,{...request,completedAt:now},i18n)).toContain('Gesso');
  expect(feedbackBodyText(setEditorStage(s,0),request,i18n)).toContain('Tessera');
 });
 it.each(['ja','en'])('%s：撮影のメールは撮影時の姿を使い、後の切り戻しに影響されない',lang=>{
  let s=createFixture('desktop-stage2',now)!;s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,lang);const shot=s.persistent.screenshots.at(-1)!;
  s=setEditorStage(s,0);const frozen=restoreScene(shot,s.persistent.screenshots),request=frozen.run.desktop.feedback.find(f=>f.kind==='color')!,i18n=createI18n(lang,{strictInterpolation:true});
  expect(feedbackBodyText(s,request,i18n)).toContain('Tessera');expect(feedbackBodyText(frozen,request,i18n)).toContain('Gesso');
  expect(feedbackBodyText(frozen,request,i18n,true)).toContain('Tessera');
 });
});
