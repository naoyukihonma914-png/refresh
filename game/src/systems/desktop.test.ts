import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createFixture } from './fixtures';
import { actDesktop, advanceDesktopTime, buyDesktopApp, desktopConditions, enterDesktop, focusWindow, observeTesseraAction, restoreScreenshot, screenshotCapacity, screenshotParts, screenshotReward, takeScreenshot, visibleApps } from './desktop';
import { decodeCapture, encodeCapture } from './desktopState';
import { actKumiki, drawingFor, exportKumiki, paintDrawing, prepareDrawing, targetFor } from './kumiki';
import { createInitialState, isGameState } from './state';
import { decodeSave, encodeSave } from './save';
import { advanceActiveTime, advanceOfflineTime } from './time';
import { passivePixelsPerSecond } from './economy';
const now = 1_000_000;
const desktop = () => createFixture('desktop-early',now)!;
function finish(state: ReturnType<typeof desktop>, id: string) {
  let next = prepareDrawing(state,id);
  const drawing = drawingFor(next,id)!, target = targetFor(next,id,drawing.size);
  for(const color of new Set(target.filter(c=>c>=0))) next=paintDrawing(next,id,target.flatMap((c,i)=>c===color?[i]:[]),color);
  return next;
}
describe('デスクトップ',()=>{
  it('256色・タスクバー・20万ピクセルがそろったときだけ入口で支払い、二重に組み立てない',()=>{
    const source=createFixture('release-v1-tessera',now)!;
    for(const fail of ['color','parts','pixels']){
      const s=structuredClone(source);
      if(fail==='color')s.persistent.specs.color=0;
      if(fail==='parts')s.run.kumiki.built=[];
      if(fail==='pixels')s.resources.pixels=BALANCE.w2.desktopCost-1;
      expect(enterDesktop(s)).toBe(s);
    }
    const next=actKumiki(source,{type:'exit'},now);
    expect(next.run.world).toBe('desktop');expect(next.resources.pixels).toBe(source.resources.pixels-BALANCE.w2.desktopCost);
    expect(visibleApps(next)).toEqual(['tessera']);expect(next.run.desktop.apps).toEqual([]);expect(enterDesktop(next)).toBe(next);
    expect(enterDesktop(createInitialState(now)).run.world).toBe('seed');
  });
  it('ファイル・並べ替え・メールを順に作り、未購入のアプリを開かない',()=>{
    let s=desktop(); expect(buyDesktopApp(s,'mail')).toBe(s);
    const start=s.resources.pixels;s=buyDesktopApp(s,'files');expect(s.resources.pixels).toBe(start-300_000);expect(s.run.desktop.active).toBe('files');
    expect(buyDesktopApp(s,'files')).toBe(s);expect(buyDesktopApp(s,'mail')).toBe(s);s=buyDesktopApp(s,'sort');s=buyDesktopApp(s,'mail');expect(s.resources.pixels).toBe(start-1_150_000);
    expect(s.run.desktop.apps).toEqual(['files','mail']);expect(desktopConditions(s)[0]).toBe(false);
  });
  it('窓の移動・大きさ・前後・最小化・最大化・復元・閉じる・開き直しとアイコン位置を保存する',()=>{
    let s=focusWindow(desktop(),'note');
    s=actDesktop(s,{type:'rect',app:'note',rect:{...s.run.desktop.windows.note,x:80,y:60,width:500,height:400}},now);
    s=actDesktop(s,{type:'icon',app:'note',x:150,y:400},now);
    s=actDesktop(s,{type:'maximize',app:'note'},now);expect(s.run.desktop.windows.note.width).toBe(800);
    s=decodeSave(encodeSave(s));s=actDesktop(s,{type:'maximize',app:'note'},now);expect(s.run.desktop.windows.note).toMatchObject({x:80,y:60,width:500,height:400});
    s=actDesktop(s,{type:'minimize',app:'note'},now);expect(visibleApps(s)).toEqual(['tessera']);expect(s.run.desktop.active).toBe('tessera');
    s=actDesktop(s,{type:'taskbar',app:'note'},now);expect(s.run.desktop.windows.note.minimized).toBe(false);
    s=actDesktop(s,{type:'close',app:'note'},now);s=decodeSave(encodeSave(s));expect(s.run.desktop.windows.note.open).toBe(false);
    s=focusWindow(s,'note');expect(s.run.desktop.windows.note.x).toBe(80);expect(s.run.desktop.icons.note).toEqual({x:150,y:400});
    for(let i=0;i<100;i++)s=focusWindow(s,i%2?'note':'tessera');expect(Math.max(...Object.values(s.run.desktop.windows).map(w=>w.z))).toBeLessThanOrEqual(11);
    s=actDesktop(s,{type:'rect',app:'note',rect:{x:-999,y:9999,width:1,height:9000}},now);expect(s.run.desktop.windows.note).toMatchObject({x:0,y:0,width:300,height:572});
    expect(isGameState(s)).toBe(true);
  });
  it('撮影は見える窓・デスクトップアイコン・通知を数え、レートと解像度で報酬を出す',()=>{
    let s=desktop();expect(screenshotParts(s)).toBe(15);
    s=focusWindow(s,'note');expect(screenshotParts(s)).toBe(18);
    s=advanceDesktopTime(s,240_000,now);expect(screenshotParts(s)).toBe(19);
    s=actDesktop(s,{type:'minimize',app:'note'},now);expect(screenshotParts(s)).toBe(16);
    expect(screenshotReward(s)).toBe(passivePixelsPerSecond(s)*16*.5);
    s.persistent.specs.resolution=1;expect(screenshotReward(s)).toBe(passivePixelsPerSecond(s)*16*.5*1.25);
    s.run.kumiki.focus=true;expect(screenshotReward(s)).toBe(0);
  });
  it('撮影時の状態は後の編集・窓操作で変わらず、前の画像データを再帰的に含めない',()=>{
    let s=focusWindow(desktop(),'note');s=actDesktop(s,{type:'note',text:'制作途中の記録'},now);
    const before=s.resources.pixels,reward=screenshotReward(s);s=takeScreenshot(s,now,'ja');expect(s.resources.pixels).toBe(before+reward);
    const first=s.persistent.screenshots[0]!,originalX=s.run.desktop.windows.note.x;
    s=actDesktop(s,{type:'note',text:'撮影後の記録'},now+1);s=actDesktop(s,{type:'rect',app:'note',rect:{x:700,y:100,width:500,height:600}},now+1);
    s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now+1,'en');
    const scene=restoreScreenshot(first,s.persistent.screenshots);expect(scene.persistent.productionNote).toBe('制作途中の記録');expect(scene.run.desktop.windows.note.x).toBe(originalX);
    const second=restoreScreenshot(s.persistent.screenshots[1]!,s.persistent.screenshots);expect(second.persistent.screenshots).toEqual([first]);
    expect(decodeCapture(s.persistent.screenshots[1]!.data)).not.toHaveProperty('persistent');
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it('待ち時間は能動時間だけで進み、不在中には撮影しない。上限時には報酬も記録も増えない',()=>{
    let s=takeScreenshot(desktop(),now,'en');expect(takeScreenshot(s,now+1,'en')).toBe(s);
    const off=advanceOfflineTime(s,now+3_600_000).state;expect(off.persistent.screenshots).toHaveLength(1);expect(off.run.desktop.cooldownMs).toBe(30_000);
    s=advanceActiveTime(s,29_900).state;expect(s.run.desktop.cooldownMs).toBe(100);s=advanceActiveTime(s,100).state;expect(s.run.desktop.cooldownMs).toBe(0);
    for(let i=1;i<50;i++){s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now+i,'ja');}
    expect(s.persistent.screenshots).toHaveLength(50);s.run.desktop.cooldownMs=0;expect(takeScreenshot(s,now,'ja')).toBe(s);
    s.persistent.specs.storage=1;expect(screenshotCapacity(s)).toBe(100);expect(takeScreenshot(s,now,'ja').persistent.screenshots).toHaveLength(51);
  });
  it('ピクセルのRLEを戻せ、壊れた数・過大な展開・不正な撮影記録を拒む',()=>{
    const data={pixels:[...Array(1024).fill(-1),...Array(256).fill(4)],rewards:Array(1024).fill(false)};
    const encoded=encodeCapture(data);expect(encoded.length).toBeLessThan(100);expect(decodeCapture(encoded)).toEqual(data);
    for(const raw of ['{"$runs":[1,999999]}','{"$runs":[-9,256]}','{"$runs":[1,-1]}','{"$runs":[1]}'])expect(()=>decodeCapture(raw)).toThrow();
    const s=takeScreenshot(desktop(),now,'ja');s.persistent.screenshots[0]!.data='{}';expect(()=>encodeSave(s)).toThrow();
  });
  it('メール作成前から4分ごとに届き、留守でも最大3件。未解放の依頼は生成しない',()=>{
    let s=desktop();s=advanceDesktopTime(s,239_900,now);expect(s.run.desktop.feedback).toHaveLength(0);
    s=advanceDesktopTime(s,100,now);expect(s.run.desktop.feedback).toHaveLength(1);
    s=advanceOfflineTime(s,now+24*3_600_000).state;expect(s.run.desktop.feedback).toHaveLength(3);
    expect(s.run.desktop.feedback.every(f=>['practice','color','screenshot'].includes(f.kind))).toBe(true);
    expect(s.run.desktop.apps).toEqual([]);
    s=advanceDesktopTime(s,24*3_600_000,now);expect(s.run.desktop.feedback).toHaveLength(3);
    s.persistent.specs.network=1;s.run.desktop.feedback=[];s.run.desktop.feedbackMs=0;
    expect(advanceDesktopTime(s,180_000,now).run.desktop.feedback).toHaveLength(1);
  });
  it('色の依頼は実際の主ボタンの変更で完了し、2トークンを一度だけ渡す',()=>{
    let s=advanceDesktopTime(desktop(),480_000,now);const request=s.run.desktop.feedback.find(f=>f.kind==='color')!;expect(request).toBeDefined();
    const tokens=s.resources.tokens;
    const action={type:'design' as const,id:'primary',design:{color:'#d0523a',radius:0,textSize:'medium' as const,shadow:false}};
    const next=observeTesseraAction(s,actKumiki(s,action,now),'design',now);
    expect(next.run.desktop.feedback.find(f=>f.id===request.id)!.completedAt).toBe(now);expect(next.resources.tokens).toBe(tokens+2);
    s=observeTesseraAction(next,actKumiki(next,action,now+1),'design',now+1);expect(s.resources.tokens).toBe(tokens+2);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it('描き直しは異なる10マスとエクスポートが必要で、塗って戻したマスや再エクスポートでは達成しない',()=>{
    let s=desktop();s=exportKumiki(finish(s,'folder'),now);
    s=advanceDesktopTime(s,240_000,now);expect(s.run.desktop.feedback[0]!.kind).toBe('redraw');
    const baseline=[...drawingFor(s,'folder')!.frames[0]!];
    s=paintDrawing(s,'folder',[0],1);s=paintDrawing(s,'folder',[0],baseline[0]!);
    let next=observeTesseraAction(s,exportKumiki(s,now),'export',now);expect(next.run.desktop.feedback[0]!.completedAt).toBeNull();
    next=paintDrawing(next,'folder',Array.from({length:9},(_,i)=>i),2);
    s=observeTesseraAction(next,exportKumiki(next,now),'export',now);expect(s.run.desktop.feedback[0]!.completedAt).toBeNull();
    s=paintDrawing(s,'folder',[9],2);next=observeTesseraAction(s,exportKumiki(s,now),'export',now);expect(next.run.desktop.feedback[0]!.completedAt).toBe(now);
  });
  it('練習用アイコンは初回の完成・エクスポートで完了し、2窓で撮影した依頼だけを完了する',()=>{
    let s=advanceDesktopTime(desktop(),720_000,now);const practice=s.run.desktop.feedback.find(f=>f.kind==='practice')!;
    s=finish(s,practice.target);let next=observeTesseraAction(s,exportKumiki(s,now),'export',now);
    expect(next.run.desktop.feedback.find(f=>f.id===practice.id)!.completedAt).toBe(now);
    expect(next.run.desktop.feedback.find(f=>f.kind==='screenshot')!.completedAt).toBeNull();
    next=takeScreenshot(next,now,'ja');expect(next.run.desktop.feedback.find(f=>f.kind==='screenshot')!.completedAt).toBeNull();
    next.run.desktop.cooldownMs=0;next=takeScreenshot(focusWindow(next,'note'),now,'ja');expect(next.run.desktop.feedback.find(f=>f.kind==='screenshot')!.completedAt).toBe(now);
  });
  it('第5版の製品・絵・性能・資源を保持してデスクトップの初期状態を補い、新形式を往復できる',()=>{
    const old=JSON.parse(encodeSave(createFixture('release-v1-tessera',now)!));old.schemaVersion=5;delete old.run.desktop;delete old.persistent.screenshots;delete old.persistent.productionNote;delete old.persistent.noteUpdatedAt;
    const next=decodeSave(JSON.stringify(old));expect(next.schemaVersion).toBe(10);expect(next.persistent.products).toEqual(old.persistent.products);expect(next.resources).toEqual(old.resources);expect(next.run.desktop.entered).toBe(false);
    for(const fixture of ['desktop-early','desktop-files','desktop-mail','desktop-modern','desktop-full']){const s=createFixture(fixture,now)!;expect(isGameState(s),fixture).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);}
    expect(BALANCE.spec.storage[1].price).toBe(60);
  });
});
