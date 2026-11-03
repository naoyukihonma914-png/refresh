import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {createI18n} from '../content/i18n';
import {CommonWindowControls} from '../worlds/CommonWindowControls';
import {actWorkshop} from './workshop';
import {createFixture} from './fixtures';
import {producedWindowChrome} from './commonChrome';
const now=1800000000000;
describe('制作した窓枠と実際の窓の接続',()=>{
 it.each(['ja','en','en-XA'])('%s：共有窪みにはめた記号の並び・色・形を実際の窓操作へ渡す',language=>{
  let s=createFixture('stage8a-common-custom',now)!;
  for(const piece of ['minimize','maximize','close'])s=actWorkshop(s,{type:'removePiece',part:'common-frame',piece},now);
  for(const [index,piece] of ['close','minimize','maximize'].entries())s=actWorkshop(s,{type:'fitPiece',part:'common-frame',piece,socket:`control-${index}`},now);
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{symbolShape:'square',controlColors:{close:'#f6d27a'}}},now);
  const chrome=producedWindowChrome(s)!,i18n=createI18n(language);
  const left=renderToStaticMarkup(<CommonWindowControls chrome={chrome} side="start" maximized={false} i18n={i18n} onAction={()=>{}}/>);
  const right=renderToStaticMarkup(<CommonWindowControls chrome={chrome} side="end" maximized={true} i18n={i18n} onAction={()=>{}}/>);
  expect(left).toBe('');expect(right).toContain(i18n.t('desktop.close'));expect(right).toContain('#f6d27a');expect(right).toContain('produced-square');
  expect(right).toContain(i18n.t('desktop.restore'));expect(right.indexOf('data-window-symbol="close"')).toBeLessThan(right.indexOf('data-window-symbol="minimize"'));
 });
 it('未完成の窓枠はインストール済みの実窓へ適用しない',()=>{
  const s=createFixture('stage8a-part-common-frame-step-3-era0',now)!;expect(producedWindowChrome(s)).toBeNull();
 });
 it('文字サイズや形だけの変更はネイティブの窓色を変えず、明示した標準値と同じ紫は反映する',()=>{
  let s=createFixture('stage8a-part-common-frame-step-4-era0',now)!;
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{radius:8}},now);
  expect(producedWindowChrome(s)).toMatchObject({custom:true,customColors:false});
  const design=s.run.workshop.parts['common-frame']!.design;
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{color:design.color}},now);
  expect(producedWindowChrome(s)).toMatchObject({customColors:true});
 });
 it('記号だけの色を選んでも標準のタイトル帯を保つ',()=>{
  let s=createFixture('stage8a-part-common-frame-step-4-era0',now)!;
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{controlColors:{close:'#f6d27a'}}},now);
  const chrome=producedWindowChrome(s)!;
  expect(chrome.customColors).toBe(false);
  const markup=renderToStaticMarkup(<CommonWindowControls chrome={chrome} side="end" maximized={false} i18n={createI18n('ja')} onAction={()=>{}}/>);
  expect(markup).toContain('color:#f6d27a');expect(markup).not.toContain('color:#f4efe4');
 });
});
