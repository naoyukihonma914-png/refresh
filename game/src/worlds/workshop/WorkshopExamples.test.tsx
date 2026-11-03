import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {BALANCE} from '../../config/balance';
import {createI18n,type MessageKey} from '../../content/i18n';
import {getWorkshopPart,partsForSet,type WorkshopPartId} from '../../content/workshopCatalog';
import type {Platform} from '../../platform/types';
import {createFixture} from '../../systems/fixtures';
import {actWorkshop,completedParts} from '../../systems/workshop';
import type {GameRuntime,RuntimeSnapshot} from '../../systems/runtime';
import type {GameState} from '../../systems/state';
import {finishTrialFor} from '../../content/workshopTrials';
import {WorkshopCanvas} from './WorkshopCanvas';
import {workshopExampleHand,WorkshopExamples} from './WorkshopExamples';
import {WorkshopNavigator} from './WorkshopNavigator';
const now=1_800_000_000_000;
const platform={clock:{wallNow:()=>now,monotonicNow:()=>0},animation:{reducedMotion:()=>false}} as Platform;
const runtime={platform,actWorkshop:()=>{},requestPrototypeRelease:()=>{}} as unknown as GameRuntime;
function navigator(state:GameState,language='ja') {return renderToStaticMarkup(<WorkshopNavigator runtime={runtime} snapshot={{state} as RuntimeSnapshot} i18n={createI18n(language)} finishHint={id=>finishTrialFor(id)?.hintKey}/>);}
function canvas(state:GameState,language='ja') {const id=state.run.workshop.activePart,part=id?getWorkshopPart(id):null;return renderToStaticMarkup(<WorkshopCanvas state={state} workshop={state.run.workshop} part={part} production={id?state.run.workshop.parts[id]:undefined} zoom={1} platform={platform} dispatch={()=>{}} i18n={createI18n(language)} picking={false} onPick={()=>{}}/>);}
function adjustReady() {let s=createFixture('tp2-route-era0',now)!;s=actWorkshop(s,{type:'buySet',set:'common'},now);s=actWorkshop(s,{type:'place',part:'common-frame',rect:getWorkshopPart('common-frame').defaultRect,example:true},now);for(const element of getWorkshopPart('common-frame').elements)s=actWorkshop(s,{type:'addElement',part:'common-frame',element},now);return s;}

describe('お手本の組み立てと自由制作の二層',()=>{
 it('具体的な次の1手だけで、標準のまま本線22パーツと書き出しから出口まで進める',()=>{
  let s=createFixture('tp2-route-era0',now)!,operations=0;const initialTokens=s.resources.tokens,finished:WorkshopPartId[]=[];
  while(operations++<250){
   const hand=workshopExampleHand(s);
   if(hand.kind==='exit')break;
   switch(hand.kind){
    case 'buySet':s=actWorkshop(s,{type:'buySet',set:hand.set},now);break;
    case 'selectPart':s=actWorkshop(s,{type:'selectPart',part:hand.part},now);break;
    case 'place':s=actWorkshop(s,{type:'place',part:hand.part,rect:getWorkshopPart(hand.part).defaultRect,example:true},now);break;
    case 'addElement':s=actWorkshop(s,{type:'addElement',part:hand.part,element:hand.element},now);break;
    case 'addAll':for(const element of hand.elements)s=actWorkshop(s,{type:'addElement',part:hand.part,element},now);break;
    case 'useExample':s=actWorkshop(s,{type:'useExample',part:hand.part},now);break;
    case 'finish':s=actWorkshop(s,{type:'test',part:hand.part,interaction:getWorkshopPart(hand.part).testInteraction},now);finished.push(hand.part);break;
    case 'export':s=actWorkshop(s,{type:'export',part:hand.part},now);break;
    default:throw new Error(`Unexpected ${hand.kind}`);
   }
  }
  expect(operations).toBeLessThan(250);expect(finished).toEqual(['common','foundation','files','mail'].flatMap(set=>partsForSet(set as 'common').map(p=>p.id)));
  expect(completedParts(s)).toHaveLength(22);expect(s.resources.tokens-initialTokens).toBe(22*BALANCE.workshop.exportTokens);
  expect(workshopExampleHand(s)).toEqual({kind:'exit'});
 });
 it.each(['ja','en','en-XA'])('%s：ONでは具体的指示は1つ、こだわりは工程中も完成後も開け、描画は状態を変えない',language=>{
  let s=adjustReady();s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{radius:4}},now);const before=structuredClone(s),html=navigator(s,language);
  expect((html.match(/data-workshop-next-hand=/g)??[])).toHaveLength(1);expect(html).toContain('data-workshop-next-hand="useExample"');expect(html).toContain('data-workshop-example-action="useExample"');
  expect(html).toContain('<details class="ws-custom-work" data-workshop-customization="true">');expect(html).toContain('data-workshop-action="confirmAdjustment"');expect(html).toContain('data-workshop-inspector="true"');expect(s).toEqual(before);
  s=actWorkshop(s,{type:'confirmAdjustment',part:'common-frame'},now);s=actWorkshop(s,{type:'test',part:'common-frame',interaction:'press'},now);
  expect(navigator(s,language)).toContain('data-workshop-customization="true"');expect(s.run.workshop.parts['common-frame']!.design.radius).toBe(4);
 });
 it('OFFでも本線の唯一の印とヘルプを保ち、調整を直接表示し、ON/OFF表示だけでデザインは戻らない',()=>{
  let s=adjustReady();s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{radius:4}},now);s.persistent.examplesEnabled=false;const before=structuredClone(s),html=navigator(s);
  expect(html).not.toContain('data-workshop-next-hand');expect(html).not.toContain('data-workshop-customization');expect(html).toContain('data-workshop-inspector="true"');expect(html).toContain('data-workshop-action="confirmAdjustment"');
  expect((html.match(/class="ws-next-indicator"/g)??[])).toHaveLength(1);expect(html).toContain('data-workshop-help-part="common-button"');expect(s).toEqual(before);
 });
 it.each([0,1,2])('段%s：最初の配置だけに薄い輪郭を出し、自由操作や完成品には残さない',era=>{
  let s=createFixture(`tp2-route-era${era}`,now)!;s=actWorkshop(s,{type:'buySet',set:'common'},now);const before=structuredClone(s);
  const html=canvas(s);expect(html).toContain('data-workshop-example-outline="common-frame"');expect(s).toEqual(before);
  s.persistent.examplesEnabled=false;expect(canvas(s)).not.toContain('data-workshop-example-outline');
  s.persistent.examplesEnabled=true;s=actWorkshop(s,{type:'place',part:'common-frame',rect:getWorkshopPart('common-frame').defaultRect,example:true},now);
  expect(canvas(s)).not.toContain('data-workshop-example-outline');expect(canvas(s)).toContain('data-workshop-custom-placement="true"');
 });
 it('工程4は本物の仕上げ操作を案内し、代わりに完成させるボタンは置かない',()=>{
  const s=createFixture('tp3-finish-common-scrollbar-era0',now)!,html=renderToStaticMarkup(<WorkshopExamples state={s} dispatch={()=>{}} onRelease={()=>{}} i18n={createI18n('ja')} finishHint={id=>finishTrialFor(id)?.hintKey}/>);
  expect(html).toContain('data-workshop-next-hand="finish"');expect(html).not.toContain('<button');expect(html).toContain(createI18n('ja').t(finishTrialFor('common-scrollbar')!.hintKey as MessageKey));
 });
});
