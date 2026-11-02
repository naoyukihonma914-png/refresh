import { describe,expect,it } from 'vitest';
import { setEditorStage } from '../systems/appearance';
import { readCapture } from '../systems/captureScene';
import { takeScreenshot } from '../systems/desktop';
import { createFixture } from '../systems/fixtures';
import { feedbackBodyText } from './feedback';
import { createI18n } from './i18n';
const now=1800000000000;
describe('フィードバックのペイントソフト名',()=>{
 it.each(['ja','en'])('%s：本文と完了済みの履歴も現在の名前へ揃え、前の姿へ戻すとTesseraになる',lang=>{
  const i18n=createI18n(lang,{strictInterpolation:true});const s=createFixture('desktop-stage2',now)!;const request=s.run.desktop.feedback.find(f=>f.kind==='color')!;
  expect(feedbackBodyText(s,request,i18n)).toContain('Gesso');expect(feedbackBodyText(s,request,i18n)).not.toContain('Tessera');
  expect(feedbackBodyText(s,{...request,completedAt:now},i18n)).toContain('Gesso');
  expect(feedbackBodyText(setEditorStage(s,0),request,i18n)).toContain('Tessera');
 });
 it.each(['ja','en'])('%s：撮影は制作時の段とメール文面を静的に保持する',lang=>{
  let s=createFixture('desktop-stage2',now)!;s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,lang);const shot=s.persistent.screenshots.at(-1)!;
  const frozen=readCapture(shot),request=s.run.desktop.feedback.find(f=>f.kind==='color')!,i18n=createI18n(lang,{strictInterpolation:true});
  s=setEditorStage(s,0);expect(feedbackBodyText(s,request,i18n)).toContain('Tessera');
  expect(frozen.appearance.editor).toBe(2);expect(frozen).not.toHaveProperty('home');
 });
});
