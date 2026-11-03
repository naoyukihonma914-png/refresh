import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {createLegacyPageDesign} from './legacyPageDesign';
import {createFixture} from './fixtures';
import {evaluateCapture,isCaptureEvaluation,modelCaptureGeometry,registerCaptureGeometry,registeredCaptureGeometry,type CaptureGeometry} from './captureEvaluation';
import {capturedContentSummary,photoContentQuality} from './capturePhoto';
import {encodeScene,isCaptureScene,projectCapture,readCapture} from './captureScene';
import type {Screenshot} from './desktopState';
const now=1_800_000_000_000;
const state=()=>createFixture('desktop-files',now)!;
const geometry=(distinct=true,offset=0):CaptureGeometry=>({origin:'dom',viewport:{x:0,y:0,width:800,height:600},occluders:[],elements:[
 {id:'a',type:'files-list',sourcePartId:'files-list',app:'files',layer:10,rects:[{x:20+offset,y:20,width:100,height:40}]},
 {id:'b',type:distinct?'files-sort':'files-list',sourcePartId:distinct?'files-sort':'files-list',app:'files',layer:10,rects:[{x:150+offset,y:20,width:100,height:40}]},
]});
function shot(layout=geometry()):Screenshot {const s=state();registerCaptureGeometry(s,layout);return {id:1,at:now,language:'ja',data:encodeScene(projectCapture(s,'ja'))};}
describe('撮影は内容の記録であり毎秒や整頓の採点ではない',()=>{
 it('毎秒生成・ジョブ台数・更新回数・財布と無関係な小単価を使い、仕様の倍率は一度だけ掛ける',()=>{
  const s=state(),g=geometry(),first=evaluateCapture(s,g);
  s.run.seed.autoCursors=10000;s.run.desktop.jobs.tessera.cursors=10000;s.run.desktop.jobs.tessera.updates=10;s.resources.pixels=1e20;
  const second=evaluateCapture(s,g);expect(second.reward).toBe(first.reward);
  expect(first.reward).toBe(2*BALANCE.capture.pixelsPerPart*BALANCE.w3.shotResolutionMultiplier**s.persistent.specs.resolution*BALANCE.spec.color[s.persistent.specs.color]!.multiplier*first.globalMultiplier);
  expect(first.unit).toBe(BALANCE.capture.pixelsPerPart);
 });
 it('geometry cacheはsource graphや財布が新しくなれば無効にし、未描画状態へ古いpartsを流用しない',()=>{
  const s=state(),g=geometry();registerCaptureGeometry(s,g);expect(registeredCaptureGeometry(s)).toBe(g);
  expect(registeredCaptureGeometry({...s,resources:{...s.resources}})).toBeUndefined();
  expect(registeredCaptureGeometry({...s,run:{...s.run,desktop:{...s.run.desktop,projects:{...s.run.desktop.projects}}}})).toBeUndefined();
  expect(registeredCaptureGeometry({...s,run:{...s.run,workshop:{...s.run.workshop,parts:{...s.run.workshop.parts}}}})).toBeUndefined();
  expect(registeredCaptureGeometry({...s,lastTickAt:now+1})).toBe(g);
 });
 it('DOM由来の根拠と可視内容を形式12へ凍結し、元stateの編集で変化しない',()=>{
  const s=state(),g=geometry();registerCaptureGeometry(s,g);const scene=projectCapture(s,'ja'),saved=encodeScene(scene);
  expect(scene.version).toBe(12);expect(scene.evaluation).toMatchObject({origin:'dom',visibleCount:2,kinds:2,fullyHidden:0});
  expect(scene.display.parts).toBe(2);expect(isCaptureScene(scene)).toBe(true);
  g.elements[0]!.rects[0]!.x=500;
  expect(encodeScene(scene)).toBe(saved);
  expect(readCapture({id:1,at:now,language:'ja',data:saved}).evaluation).toEqual(scene.evaluation);
  expect(isCaptureEvaluation({...scene.evaluation,visibleCount:999})).toBe(false);
 });
 it('窓の記号の実表示色も凍結し、任意のCSS式や外部参照を保存色として受け入れない',()=>{
  const s=state(),g=geometry();g.placements=[{app:'note',role:'chrome:close',rect:{x:20,y:20,width:16,height:14},paint:{color:'rgb(0, 0, 0)',backgroundColor:'rgb(192, 192, 192)'}}];
  registerCaptureGeometry(s,g);const scene=projectCapture(s,'ja');expect(isCaptureEvaluation(scene.evaluation)).toBe(true);
  const restored=readCapture({id:1,at:now,language:'ja',data:encodeScene(scene)});
  expect(restored.evaluation?.placements[0]?.paint).toEqual(g.placements[0]!.paint);
  const bad=structuredClone(scene.evaluation);bad.placements[0]!.paint!.backgroundColor='url(https://invalid.test/image)';
  expect(isCaptureEvaluation(bad)).toBe(false);
 });
 it('写真の品質は写った部品の個数と種類だけ。位置を動かしても変わらず種類が増えると増える',()=>{
  const standard=shot(),shifted=shot(geometry(true,200)),sameType=shot(geometry(false));
  expect(capturedContentSummary(standard)).toEqual({count:2,kinds:2,fullyHidden:0});
  expect(photoContentQuality(standard)).toBe(photoContentQuality(shifted));
  expect(photoContentQuality(standard)).toBeGreaterThan(photoContentQuality(sameType));
 });
 it('後ろに完全に隠れた窓を写真のお題の見える窓へ含めない',()=>{
  const s=state(),g=geometry();g.occluders=[{id:'front',layer:20,rect:{x:0,y:0,width:800,height:600}}];
  const result=evaluateCapture(s,g);expect(result.visibleCount).toBe(0);expect(result.fullyHidden).toBe(2);expect(result.visibleWindows).toEqual([]);
 });
 it('旧形式10の実額・旧parts数・PPS・整頓風の値を新品質へ混ぜず、保存された窓と中身だけを数え直す',()=>{
  const s=state(),native=projectCapture(s,'ja');
  const legacy={...native,version:10 as const,page:createLegacyPageDesign()};delete (legacy as {evaluation?:unknown}).evaluation;
  const original:Screenshot={id:1,at:now,language:'ja',data:encodeScene(legacy)};
  const changed=structuredClone(legacy);changed.display.parts=1e10;changed.display.rate=1e20;changed.display.reward=1e25;changed.view.desktop.layoutBonus=9999;
  const altered:Screenshot={...original,data:encodeScene(changed)};
  expect(photoContentQuality(altered)).toBe(photoContentQuality(original));
  expect(readCapture(altered).display.reward).toBe(1e25);
  expect(readCapture(altered).evaluation).toBeUndefined();
 });
 it('modelの可視基盤も全面最大化で隠れる背景とアイコンを除く',()=>{
  const s=state();for(const w of Object.values(s.run.desktop.windows)){w.open=false;w.minimized=false;}
  const w=s.run.desktop.windows.files;w.open=true;w.z=10;w.x=0;w.y=0;w.width=s.run.desktop.screen.width;w.height=s.run.desktop.screen.height-(s.run.desktop.screen.width===800?28:s.run.desktop.screen.width===1024?30:40);
  const result=evaluateCapture(s,modelCaptureGeometry(s));
  expect(result.parts.filter(part=>part.type==='desktop-icon').every(part=>!part.visible)).toBe(true);
  expect(result.parts.find(part=>part.id==='desktop:background')?.visible).toBe(false);
  expect(result.parts.find(part=>part.id==='taskbar:surface')?.visible).toBe(true);
 });
 it('同じ採用sourceの複数slotは1部品とし、上の窓で全面遮蔽された本線partsは0になる',()=>{
  const open=createFixture('stage8b-capture-uncovered-era0',now)!,covered=createFixture('stage8b-capture-covered-era0',now)!;
  const before=evaluateCapture(open),after=evaluateCapture(covered);
  expect(before.parts.filter(part=>part.app==='files'&&part.sourcePartId==='files-back')).toHaveLength(1);
  expect(before.parts.find(part=>part.app==='files'&&part.sourcePartId==='files-back')?.rects.length).toBeGreaterThan(1);
  expect(after.parts.filter(part=>part.app==='files').every(part=>!part.visible&&part.visibleRects.length===0)).toBe(true);
  expect(after.visibleWindows).not.toContain('files');expect(after.visibleWindows).toContain('note');
 });
 it('壁紙の面があると背後のデスクトップの地を数えず、写真の上のアイコンは数える',()=>{
  const s=state();for(const nativeWindow of Object.values(s.run.desktop.windows))nativeWindow.open=false;
  s.persistent.desktopPrefs.wallpaper={source:'coast',brightness:1,tone:0,crop:0};
  const result=evaluateCapture(s);
  expect(result.parts.find(part=>part.id==='desktop:background')?.visible).toBe(false);
  expect(result.parts.find(part=>part.id==='desktop:wallpaper')?.visible).toBe(true);
  expect(result.parts.some(part=>part.type==='desktop-icon'&&part.visible)).toBe(true);
 });
});
