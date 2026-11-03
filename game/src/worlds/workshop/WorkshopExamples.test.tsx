import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {BALANCE} from '../../config/balance';
import {createI18n} from '../../content/i18n';
import {fittingDefinition,fittingPartsForSet} from '../../content/workshopFitting';
import type {Platform} from '../../platform/types';
import {createFixture} from '../../systems/fixtures';
import {actWorkshop,completedParts} from '../../systems/workshop';
import type {GameRuntime,RuntimeSnapshot} from '../../systems/runtime';
import type {GameState} from '../../systems/state';
import {workshopExampleHand,WorkshopExamples} from './WorkshopExamples';
import {WorkshopNavigator} from './WorkshopNavigator';
import {WorkshopPlugins} from '../Workshop';
const now=1_800_000_000_000;
const platform={clock:{wallNow:()=>now,monotonicNow:()=>0},animation:{reducedMotion:()=>false}} as Platform;
const runtime={platform,actWorkshop:()=>{},requestPrototypeRelease:()=>{}} as unknown as GameRuntime;
function navigator(state:GameState,language='ja') {return renderToStaticMarkup(<WorkshopNavigator runtime={runtime} snapshot={{state} as RuntimeSnapshot} i18n={createI18n(language)}/>);}
function started(){let s=createFixture('tp2-route-era0',now)!;s=actWorkshop(s,{type:'buySet',set:'common'},now);return s;}

describe('殻とピースの案内と制作パネル',()=>{
 it('お手本の次の手は出現と実際のはめ込みを分け、本線全21パーツから出口まで進める',()=>{
  let s=createFixture('tp2-route-era0',now)!,operations=0;const initialTokens=s.resources.tokens;
  while(operations++<250){
   const hand=workshopExampleHand(s);
   if(hand.kind==='exit')break;
   switch(hand.kind){
    case 'buySet':s=actWorkshop(s,{type:'buySet',set:hand.set},now);break;
    case 'selectPart':s=actWorkshop(s,{type:'selectPart',part:hand.part},now);break;
    case 'spawnPiece':s=actWorkshop(s,{type:'spawnPiece',part:hand.part,piece:hand.piece},now);break;
    case 'fitPiece':{const p=s.run.workshop.parts[hand.part]!,socket=fittingDefinition(hand.part).sockets.find(socket=>socket.accepts.includes(hand.piece)&&(socket.stacked||!Object.values(p.fitting!.sockets).includes(socket.id)))!;s=actWorkshop(s,{type:'fitPiece',part:hand.part,piece:hand.piece,socket:socket.id},now);break;}
    case 'export':s=actWorkshop(s,{type:'export',part:hand.part},now);break;
    case 'update':s=actWorkshop(s,{type:'skill',id:'update'},now);break;
    default:throw new Error(`Unexpected ${hand.kind}`);
   }
  }
  expect(operations).toBeLessThan(250);
  expect(completedParts(s)).toHaveLength(['common','foundation','files','mail'].flatMap(set=>fittingPartsForSet(set as 'common')).length);
  expect(s.resources.tokens-initialTokens).toBe(21*BALANCE.workshop.exportTokens);
  expect(workshopExampleHand(s)).toEqual({kind:'exit'});
 });
 it.each(['ja','en','en-XA'])('%s：制作中もセット・パーツを残し、ピースと任意調整を続けて出す',language=>{
  const s=started(),before=structuredClone(s),html=navigator(s,language);
  expect((html.match(/data-workshop-next-hand=/g)??[])).toHaveLength(1);
  expect(html).toContain('data-workshop-next-hand="spawnPiece"');
  expect(html).toContain('data-workshop-piece="scrollbar"');expect(html).toContain('data-workshop-customize="common-frame"');
  for(const zone of ['sets','parts','pieces'])expect(html).toContain(`data-workshop-zone="${zone}"`);
  expect(html).not.toContain('backToParts');expect(html).not.toContain('ws-fitting-part-chips');
  for(const legacy of ['ws-steps','data-workshop-inspector','data-workshop-dimension','confirmAdjustment','data-workshop-action="place"','data-workshop-action="element"','ws-test-hint'])expect(html).not.toContain(legacy);
  expect(s).toEqual(before);
 });
 it('ピースを出す案内もドラッグの案内も、代わりにはめるボタンを持たない',()=>{
  let s=started();const render=()=>renderToStaticMarkup(<WorkshopExamples state={s} dispatch={()=>{}} onRelease={()=>{}} i18n={createI18n('ja')}/>);
  expect(render()).toContain('data-workshop-next-hand="spawnPiece"');expect(render()).not.toContain('<button');
  s=actWorkshop(s,{type:'spawnPiece',part:'common-frame',piece:'title'},now);
  expect(render()).toContain('data-workshop-next-hand="fitPiece"');expect(render()).not.toContain('<button');
 });
 it('OFFで誘導だけを隠し、同じピース一覧と調整への入口を残す',()=>{
  const s=started();s.persistent.examplesEnabled=false;const before=structuredClone(s),html=navigator(s);
  expect(html).not.toContain('data-workshop-next-hand');expect(html).not.toContain('data-example-next');expect(html).not.toContain('ws-next-indicator');
  expect(html).toContain('data-workshop-piece="title"');expect(html).toContain('data-workshop-customize="common-frame"');expect(html).not.toContain('data-workshop-inspector');expect(s).toEqual(before);
 });
 it('はめ済みと出現中を区別し、出現中の名前をもう一度出すボタンにしない',()=>{
  let s=started();s=actWorkshop(s,{type:'spawnPiece',part:'common-frame',piece:'title'},now);
  expect(navigator(s)).toMatch(/data-workshop-piece="title" data-piece-status="spawned"[^>]*disabled/);
  s=actWorkshop(s,{type:'fitPiece',part:'common-frame',piece:'title',socket:'title'},now);
  expect(navigator(s)).toMatch(/data-workshop-piece="title" data-piece-status="fitted"[^>]*disabled/);
 });
});


describe('Tesseraのアップデートへの案内',()=>{
 it.each(['ja','en','en-XA'])('%s: other token purchases explain that the update comes first, then unlock immediately',language=>{
  const state=started(),i18n=createI18n(language);state.persistent.tesseraUpdateGrantReceived=true;state.resources.tokens=4;
  const render=()=>renderToStaticMarkup(<WorkshopPlugins state={state} i18n={i18n} dispatch={()=>{}} onClose={()=>{}}/>);
  const locked=render();expect(locked).toContain(i18n.t('ws.updateFirst'));
  for(const id of ['presets','eyedropper'])expect(locked).toMatch(new RegExp(`data-workshop-skill="${id}"[^>]*disabled`));
  expect(locked).not.toMatch(/data-workshop-skill="update"[^>]*disabled/);
  state.persistent.editorSkills.push('update');state.resources.tokens=1;
  expect(render()).not.toContain(i18n.t('ws.updateFirst'));
  for(const id of ['presets','eyedropper'])expect(render()).not.toMatch(new RegExp(`data-workshop-skill="${id}"[^>]*disabled`));
 });

 it.each(['ja','en','en-XA'])('%s：初回の知らせだけが購入画面を案内し、制作を代わりに進めない',language=>{
  const s=started();s.run.workshop.guide.current='updateAvailable';s.run.workshop.guide.seen.push('updateAvailable');
  const before=structuredClone(s),i18n=createI18n(language);
  const html=renderToStaticMarkup(<WorkshopExamples state={s} dispatch={()=>{}} onRelease={()=>{}} onOpenPlugins={()=>{}} i18n={i18n}/>);
  expect(workshopExampleHand(s)).toEqual({kind:'update'});expect(html).toContain('data-workshop-next-hand="update"');expect(html).toContain('data-workshop-example-action="update"');expect(html).toContain(i18n.t('ws.skill.update'));expect(s).toEqual(before);
  const closed=actWorkshop(s,{type:'guide',id:'close'},now);expect(workshopExampleHand(closed).kind).toBe('update');
  s.persistent.examplesEnabled=false;expect(renderToStaticMarkup(<WorkshopExamples state={s} dispatch={()=>{}} onRelease={()=>{}} onOpenPlugins={()=>{}} i18n={i18n}/>)).toBe('');
 });
 it('取得済みなら過去の知らせを開き直しても購入の案内を戻さない',()=>{
  const s=started();s.run.workshop.guide.current='updateAvailable';s.persistent.editorSkills.push('update');
  expect(workshopExampleHand(s).kind).toBe('spawnPiece');
 });
 it.each(['ja','en'])('%s：価格3の取得条件は状態に従い、後の3項目は高い残高でも取得できない',language=>{
  const s=started(),i18n=createI18n(language);s.resources.tokens=2;
  const render=()=>renderToStaticMarkup(<WorkshopPlugins state={s} i18n={i18n} dispatch={()=>{}} onClose={()=>{}}/>);
  expect(render()).toMatch(/data-workshop-skill="update"[^>]*disabled/);
  s.resources.tokens=3;expect(render()).not.toMatch(/data-workshop-skill="update"[^>]*disabled/);
  s.resources.tokens=1000;
  for(const id of ['batch','dimensions','layers','snap'])expect(render()).not.toContain(`data-workshop-skill="${id}"`);
  for(const id of ['gessoUpdate','brio','brioUpdate']){
   expect(render()).toMatch(new RegExp(`data-workshop-skill="${id}"[^>]*disabled`));expect(render()).toContain(`data-workshop-skill-reason="${id}"`);
  }
 });
});
