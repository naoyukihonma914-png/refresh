import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createI18n} from '../../content/i18n';
import {getWorkshopPart} from '../../content/workshopCatalog';
import {createFixture} from '../../systems/fixtures';
import {WorkshopTargetProvider} from './WorkshopTargetContext';
import {FinishTrial} from './FinishTrial';

for(const language of ['ja','en','en-XA'])describe(`TP3の固有操作表示 ${language}`,()=>{
 it('受信記録が空の旧セーブにも、局所的な見本の手紙で仕上げる経路を残す',()=>{
  const s=createFixture('stage8a-part-mail-list-step-3-era0',1_800_000_000_000)!;
  s.run.workshop.guide={seen:[],current:null,collapsed:false};s.run.desktop.feedback=[];
  const before=structuredClone(s),part=getWorkshopPart('mail-list'),i18n=createI18n(language);let completed=0;
  const html=renderToStaticMarkup(<WorkshopTargetProvider gameState={s} i18n={i18n}><FinishTrial part={part} production={s.run.workshop.parts[part.id]!} state={s} i18n={i18n} onInteract={()=>completed++}/></WorkshopTargetProvider>);
  expect(html).toContain('data-trial-message="trial:letter"');expect(html).toContain(i18n.t('tp.finish.sample.letter'));
  expect(completed).toBe(0);expect(s).toEqual(before);expect(s.persistent.setDocuments.every(doc=>doc.id!=='trial:letter')).toBe(true);
 });
 it('進み具合の仕上げでも、選んだ高さ・角丸・パーセント非表示をそのまま使う',()=>{
  const s=createFixture('stage8a-part-common-progress-step-3-era0',1_800_000_000_000)!,part=getWorkshopPart('common-progress'),i18n=createI18n(language);
  const production={...s.run.workshop.parts[part.id]!,design:{...s.run.workshop.parts[part.id]!.design,progressHeight:24,radius:4,showPercent:false}};
  const html=renderToStaticMarkup(<WorkshopTargetProvider gameState={s} i18n={i18n}><FinishTrial part={part} production={production} state={s} i18n={i18n} onInteract={()=>{}} reducedMotion/></WorkshopTargetProvider>);
  expect(html).toContain('height:24px');expect(html).toContain('border-radius:4px');expect(html).not.toContain('<output');expect(html).toContain('data-trial-action="fill"');
 });
});
