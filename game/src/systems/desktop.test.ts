import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { actAppBuild,hasAppPart } from './appBuild';
import { actDesktop,advanceDesktopTime,buyDesktopApp,desktopConditions,focusWindow,screenshotCapacity,takeScreenshot,visibleApps } from './desktop';
import { decodeCapture,encodeCapture } from './desktopState';
import { createFixture } from './fixtures';
import { decodeSave,encodeSave } from './save';
import { isGameState } from './state';
import { advanceActiveTime,advanceOfflineTime } from './time';
const now = 1_000_000;
const desktop = () => createFixture('desktop-early',now)!;
describe('デスクトップ',()=>{
  it('制作済みの材料でファイルとメールを組み、組み立てと取り付けでは二重に支払わない',()=>{
    let s=desktop();const start=s.resources.pixels;
    expect(buyDesktopApp(s,'mail')).toBe(s);
    s=actDesktop(s,{type:'open',app:'files'},now);expect(visibleApps(s)).not.toContain('files');
    s=buyDesktopApp(s,'files');expect(s.resources.pixels).toBe(start);expect(s.run.desktop.active).toBe('tessera');expect(s.run.desktop.apps).not.toContain('files');
    s=actAppBuild(s,{type:'app-recommend',app:'files'});s=actAppBuild(s,{type:'app-install',app:'files'});
    expect(hasAppPart(s,'files','sort')).toBe(true);expect(buyDesktopApp(s,'files')).toBe(s);expect(buyDesktopApp(s,'sort')).toBe(s);
    s=buyDesktopApp(s,'mail');s=actAppBuild(s,{type:'app-recommend',app:'mail'});s=actAppBuild(s,{type:'app-install',app:'mail'});
    expect(s.resources.pixels).toBe(start);expect(s.run.desktop.apps).toEqual(['files','mail']);expect(desktopConditions(s)[0]).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
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
    s=advanceOfflineTime(s,now+24*3_600_000).state;expect(s.run.desktop.feedback).toHaveLength(BALANCE.w3.maxPending);
    expect(s.run.desktop.feedback.every(f=>['color','screenshot','capture'].includes(f.kind))).toBe(true);
    expect(s.run.desktop.apps).toEqual([]);
    s=advanceDesktopTime(s,24*3_600_000,now);expect(s.run.desktop.feedback).toHaveLength(BALANCE.w3.maxPending);
    s.persistent.specs.network=1;s.run.desktop.feedback=[];s.run.desktop.feedbackMs=0;
    expect(advanceDesktopTime(s,180_000,now).run.desktop.feedback).toHaveLength(1);
  });
  it('新しい工房から各デスクトップの確認状態を保存できる',()=>{
    for(const fixture of ['desktop-early','desktop-files','desktop-mail','desktop-modern','desktop-full']){const s=createFixture(fixture,now)!;expect(isGameState(s),fixture).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);}
    expect(BALANCE.spec.storage[1].price).toBe(60);
  });
});
