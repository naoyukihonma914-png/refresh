import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../content/i18n';
import { BASE_PALETTE } from '../../content/palette';
import { getWorkshopPart } from '../../content/workshopCatalog';
import { createComponentDesign, createEditorCustomization, type PartProduction } from '../../systems/workshopState';
import { PartInspector } from './WorkshopCustomization';

describe('制作した設定の表示',()=>{
 for(const language of ['ja','en','en-XA'])it(`${language}: 標準を尊重し、実際の変更した項目だけを数える`,()=>{
  const part=getWorkshopPart('common-frame'),i18n=createI18n(language);
  const production:PartProduction={step:2,rect:part.defaultRect,elements:[...part.elements],design:createComponentDesign(),completedAt:null,exportedAt:null,tested:false};
  const render=(p:PartProduction)=>renderToStaticMarkup(createElement(PartInspector,{part,production:p,stage:0,colors:BASE_PALETTE,skills:[],customization:createEditorCustomization(),dispatch:()=>{},i18n}));
  const standard=render(production);
  expect(standard).toContain('data-workshop-adjustments="0"');expect(standard).toContain(i18n.t('ws.adjustmentStandard'));
  const changed={...production,elements:['title','close','minimize','maximize'],design:{...production.design,radius:8,shadow:true}};
  const custom=render(changed);
  expect(custom).toContain('data-workshop-adjustments="3"');expect(custom).toContain(i18n.t('ws.adjustmentChanges',{count:3}));
  // Merely visiting the adjustment page does not change the saved production.
  expect(production.design).toEqual(createComponentDesign());expect(production.elements).toEqual(part.elements);
 });
});
