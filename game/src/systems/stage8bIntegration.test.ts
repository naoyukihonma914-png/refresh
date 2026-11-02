import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { getWorkshopPart } from '../content/workshopCatalog';
import { actDesktop,advanceDesktopTime,buyDesktopApp,observeTesseraAction,takeScreenshot } from './desktop';
import { nextDesktopOffer } from './desktopOffers';
import { registerCaptureGeometry,type CaptureGeometry } from './captureEvaluation';
import { createFixture } from './fixtures';
import { actWorkshop } from './workshop';
import { decodeSave,encodeSave } from './save';
const now=1_800_000_000_000;

describe('第3版の制作と依頼の接続',()=>{
 it('制作途中の材料の依頼を出し、実際の仕上げだけで一度完了する',()=>{
  let s=createFixture('stage8b-economy-before-era0',now)!;
  s=advanceDesktopTime(s,BALANCE.spec.network[s.persistent.specs.network]!.mailIntervalSeconds*1000,now);
  const request=s.run.desktop.feedback.find(item=>item.kind==='part')!;
  expect(request.target).toBe('photo-crop');
  const before=s,definition=getWorkshopPart('photo-crop'),tokens=s.resources.tokens;
  s=observeTesseraAction(before,actWorkshop(before,{type:'test',part:'photo-crop',interaction:definition.testInteraction},now),'test',now);
  expect(s.run.desktop.feedback.find(item=>item.id===request.id)!.completedAt).toBe(now);
  expect(s.resources.tokens-tokens).toBe(BALANCE.w3.feedbackTokens);
  expect(observeTesseraAction(s,actWorkshop(s,{type:'test',part:'photo-crop',interaction:definition.testInteraction},now+1),'test',now+1)).toBe(s);
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('標準の素材から同じ保存色を明示選択しても、実際の見た目の変更として色の依頼に応える',()=>{
  const before=createFixture('desktop-ready',now)!;
  const color=before.run.workshop.parts['common-button']!.design.color;
  before.run.desktop.feedback=[{id:1,kind:'color',sender:'hikari',target:'primary',at:now,baseline:[],baselineColor:color,completedAt:null}];
  before.run.desktop.feedbackSerial=1;
  const adjusted=actWorkshop(before,{type:'adjust',part:'common-button',patch:{color}},now);
  const after=observeTesseraAction(before,adjusted,'adjust',now);
  expect(after.run.desktop.feedback[0]!.completedAt).toBe(now);
 });
 it('メールを読む操作は未読だけを消し、未完了の依頼を勝手に完了しない',()=>{
  const s=createFixture('desktop-ready',now)!;
  s.run.desktop.feedback=[{id:1,kind:'capture',sender:'ren',target:'windows',at:now,baseline:[],baselineColor:'#000000',completedAt:null}];s.run.desktop.feedbackSerial=1;
  const opened=actDesktop(s,{type:'mail',id:1},now+1);
  expect(opened.run.desktop.feedback[0]).toMatchObject({readAt:now+1,completedAt:null});
  expect(actDesktop(opened,{type:'mail',id:1},now+2).run.desktop.feedback[0]!.readAt).toBe(now+1);
  expect(decodeSave(encodeSave(opened))).toEqual(opened);
 });
 it('写真の依頼は完全に隠れた窓を数えず、自動で達成した分は実際に渡したトークン数を記録する',()=>{
  let s=createFixture('stage8b-capture-covered-era0',now)!;
  s.run.desktop.feedback=[{id:1,kind:'capture',sender:'ren',target:'windows',at:now,baseline:[],baselineColor:'#000000',completedAt:null}];s.run.desktop.feedbackSerial=1;
  s=takeScreenshot(s,now,'ja');expect(s.run.desktop.feedback[0]!.completedAt).toBeNull();
  s.run.desktop.cooldownMs=0;
  const geometry:CaptureGeometry={origin:'dom',viewport:{x:0,y:0,width:800,height:600},occluders:[],elements:[{id:'files-visible',app:'files',type:'files-list',sourcePartId:'files-list',layer:10,rects:[{x:10,y:20,width:100,height:40}]},{id:'note-visible',app:'note',type:'note',layer:20,rects:[{x:200,y:20,width:100,height:40}]}]};
  registerCaptureGeometry(s,geometry);const tokens=s.resources.tokens;
  s=takeScreenshot(s,now+1,'ja',BALANCE.w3.screenshotMultiplier,true);
  const expected=BALANCE.w3.feedbackTokens*BALANCE.w3.autoFeedbackMultiplier;
  expect(s.resources.tokens-tokens).toBe(expected);
  expect(s.run.desktop.feedback[0]).toMatchObject({completedAt:now+1,reward:expected});
 });
 it('次に買う権利はUIセットで、買っても完成品や毎秒は増えず工房を開く',()=>{
  const s=createFixture('stage8b-economy-after-era0',now)!;
  const offer=nextDesktopOffer(s)!;
  expect(offer.kind).toBe('set');
  if(offer.id==='jobs')throw new Error('expected UI set');
  const purchased=buyDesktopApp(s,offer.id,now);
  expect(s.resources.pixels-purchased.resources.pixels).toBe(BALANCE.workshop.setCosts[offer.id]);
  expect(purchased.run.workshop.purchasedSets).toContain(offer.id);
  expect(purchased.run.desktop.apps).toEqual(s.run.desktop.apps);
  expect(nextDesktopOffer(purchased)).toMatchObject({id:offer.id,kind:'craft',cost:0});
  expect(purchased.run.desktop.active).toBe('tessera');
 });
});
