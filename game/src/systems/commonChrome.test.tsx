import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {createI18n} from '../content/i18n';
import {CommonWindowControls} from '../worlds/CommonWindowControls';
import {actWorkshop} from './workshop';
import {createFixture} from './fixtures';
import {producedWindowChrome} from './commonChrome';
const now=1800000000000;
describe('制作した窓枠と実際の窓の接続',()=>{
 it.each(['ja','en','en-XA'])('%s：完成した記号の並び・左右・色・形を実際の窓操作へ渡す',language=>{
  let s=createFixture('stage8a-common-custom',now)!;
  s=actWorkshop(s,{type:'addElement',part:'common-frame',element:'close',index:0,side:'start'},now);
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{symbolShape:'square',controlColors:{close:'#f6d27a'}}},now);
  const chrome=producedWindowChrome(s)!,i18n=createI18n(language);
  const left=renderToStaticMarkup(<CommonWindowControls chrome={chrome} side="start" maximized={false} i18n={i18n} onAction={()=>{}}/>);
  const right=renderToStaticMarkup(<CommonWindowControls chrome={chrome} side="end" maximized={true} i18n={i18n} onAction={()=>{}}/>);
  expect(left).toContain(i18n.t('desktop.close'));expect(left).toContain('#f6d27a');expect(left).toContain('produced-square');
  expect(right).not.toContain(i18n.t('desktop.close'));expect(right).toContain(i18n.t('desktop.restore'));
 });
 it('未完成の窓枠はインストール済みの実窓へ適用しない',()=>{
  const s=createFixture('stage8a-part-common-frame-step-3-era0',now)!;expect(producedWindowChrome(s)).toBeNull();
 });
});
