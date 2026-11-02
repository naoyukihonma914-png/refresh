import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../content/i18n';
import { createFixture } from '../../systems/fixtures';
import { encodeScene, projectCapture, type CaptureScene } from '../../systems/captureScene';
import { capturedContentSummary } from '../../systems/capturePhoto';
import { PhotoEvaluation } from './PhotoEvaluation';
const now=1_800_000_000_000;
function recorded(legacy=false){
 const scene=projectCapture(createFixture('desktop-files',now)!,'ja');
 if(!legacy)return {id:1,at:now,language:'ja',data:encodeScene(scene)};
 const {evaluation:_evaluation,selectedSetDocument:_selected,...metadata}=scene;
 const old={...metadata,version:10,display:{...metadata.display,parts:123456789,reward:1e20,rate:1e30}} as CaptureScene;
 return {id:1,at:now,language:'ja',data:encodeScene(old)};
}
describe('写真に保存された内容評価の表示',()=>{
 it.each(['ja','en','en-XA'])('%s：可視数・種類・全隠れの実値だけを表示する',language=>{
  const shot=recorded(),before=shot.data,summary=capturedContentSummary(shot),i18n=createI18n(language);
  const html=renderToStaticMarkup(<PhotoEvaluation shot={shot} i18n={i18n}/>);
  expect(html).toContain(`data-capture-visible="${summary.count}"`);expect(html).toContain(`data-capture-kinds="${summary.kinds}"`);expect(html).toContain(`data-capture-fully-hidden="${summary.fullyHidden}"`);expect(html).toContain(i18n.t('files.captureRecordedEvaluation'));
  expect(shot.data).toBe(before);
 });
 it('旧写真は昔の毎秒・報酬・部品数を評価へ再利用せず、記録から数え直したことを示す',()=>{
  const shot=recorded(true),i18n=createI18n('ja'),summary=capturedContentSummary(shot);
  const html=renderToStaticMarkup(<PhotoEvaluation shot={shot} i18n={i18n}/>);
  expect(html).toContain('data-capture-origin="legacy"');expect(html).toContain(`data-capture-visible="${summary.count}"`);expect(html).not.toContain('123,456,789');expect(html).toContain(i18n.t('files.captureLegacyEvaluation'));
 });
});
