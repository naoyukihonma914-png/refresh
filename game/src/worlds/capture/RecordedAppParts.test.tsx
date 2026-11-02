import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n, TEST_LANGUAGE } from '../../content/i18n';
import { createFixture } from '../../systems/fixtures';
import { projectCapture } from '../../systems/captureScene';
import { RecordedAppParts } from './RecordedAppParts';

describe('保存写真の写真調整も撮影時の値を表示する',()=>{
 it.each(['ja','en',TEST_LANGUAGE])('%sの明るさ・色味・切り取りが同じreadonly調整部品で読める',language=>{
  const s=createFixture('stage8b-economy-after-era0',1_800_000_000_000)!;
  s.run.desktop.photo={...s.run.desktop.photo,brightness:1.15,tone:-12,crop:24};
  const scene=projectCapture(s,'ja'),i18n=createI18n(language);
  s.run.desktop.photo={...s.run.desktop.photo,brightness:0.5,tone:50,crop:0};
  const markup=renderToStaticMarkup(<div inert><RecordedAppParts app="photo" scene={scene} i18n={i18n} photograph={null} document={null} selectedShot={null}/></div>);
  const controls=markup.match(/<label class="photo-adjustment-control">.*?<\/label>/g)??[];
  expect(controls).toHaveLength(3);
  for(const [index,label,minimum,maximum,value,output] of [
   [0,i18n.t('photo.brightness'),'0.5','1.5','1.15',i18n.number(1.15)],
   [1,i18n.t('photo.tone'),'-50','50','-12',i18n.integer(-12)],
   [2,i18n.t('photo.crop'),'0','40','24',i18n.t('number.percent',{value:i18n.integer(24)})],
  ] as const){
   const control=controls[index]!;
   expect(control).toContain(label);expect(control).toContain('type="range"');expect(control).toContain('readOnly=""');
   expect(control).toContain(`min="${minimum}"`);expect(control).toContain(`max="${maximum}"`);expect(control).toContain(`value="${value}"`);
   expect(control.match(/<output[^>]*>(.*?)<\/output>/)![1]).toBe(output);
  }
  expect(controls[0]).toContain('step="0.05"');
  expect(controls[2]).toContain(`title="${i18n.t('photo.cropValue',{count:24})}"`);
 });
});
