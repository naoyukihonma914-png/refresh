import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,it,expect } from 'vitest';
import { createFixture } from './fixtures';
import { desktopScreen,fitWindow,workHeight,MIN_WINDOW_WIDTH } from './desktopGeometry';
import { setDesktopStage, type VisualStage } from './appearance';
import { actDesktop,takeScreenshot,focusWindow } from './desktop';
import { decodeSave,encodeSave } from './save';
import { readCapture,restoreScene,isCaptureScene } from './captureScene';
import { fitViewport } from './viewport';
import { isGameState } from './state';
const now=1800000000000;
function expectBounds(s:ReturnType<typeof createFixture>){
 if(!s)throw new Error('Fixture missing');const screen=s.run.desktop.screen;
 for(const [id,w] of Object.entries(s.run.desktop.windows)){
  for(const box of [w,...w.restore?[w.restore]:[]]){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(screen.width);expect(box.y+box.height).toBeLessThanOrEqual(workHeight(screen));}
  expect(w.width).toBeGreaterThanOrEqual(MIN_WINDOW_WIDTH[id as keyof typeof MIN_WINDOW_WIDTH]);
 }
 for(const p of Object.values(s.run.desktop.icons)){expect(p.x).toBeGreaterThanOrEqual(0);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.x+80).toBeLessThanOrEqual(screen.width);expect(p.y+76).toBeLessThanOrEqual(workHeight(screen));}
 expect(isGameState(s)).toBe(true);
}
describe('PR #7：段ごとの論理画面',()=>{
 it.each([0,1,2] as const)('段%iは画面全体を同じ倍率で収め、4:3では左右に黒い余白を取れる',stage=>{
  const screen=desktopScreen(stage);expect(screen).toEqual([{width:800,height:600},{width:1024,height:768},{width:1366,height:768}][stage]);
  for(const [width,height] of [[1920,1080],[1366,768]]){const fit=fitViewport(width!,height!,screen);expect(Math.abs(fit.height-height!)).toBeLessThan(1);expect(fit.width/fit.height).toBeCloseTo(screen.width/screen.height);if(stage<2)expect(width!-fit.width).toBeGreaterThan(300);else expect(width!-fit.width).toBeLessThan(1);}
 });
 it('0→1→2→0で通常・最大化・最小化・閉じた窓と復元位置を収め、保存した位置を再読込する',()=>{
  let s=createFixture('desktop-stage0',now)!;s=focusWindow(s,'mail');s=actDesktop(s,{type:'maximize',app:'mail'},now);s=actDesktop(s,{type:'minimize',app:'note'},now);
  const jobs=s.run.desktop.jobs,art=s.persistent.artwork,resources=s.resources;
  for(const stage of [1,2,0] as VisualStage[]){s=setDesktopStage(s,stage);expectBounds(s);expect(s.run.desktop.jobs).toEqual(jobs);expect(s.persistent.artwork).toEqual(art);expect(s.resources).toEqual(resources);expect(s.run.desktop.windows.mail).toMatchObject({x:0,y:0,width:desktopScreen(stage).width,height:workHeight(desktopScreen(stage)),maximized:true});expect(s.run.desktop.windows.note.minimized).toBe(true);const restored=decodeSave(encodeSave(s));expect(restored.run.desktop.windows).toEqual(s.run.desktop.windows);expect(restored.run.desktop.icons).toEqual(s.run.desktop.icons);s=restored;}
  s=actDesktop(s,{type:'maximize',app:'mail'},now);expectBounds(s);expect(s.run.desktop.windows.mail.maximized).toBe(false);
 });
 it('最小の窓、はみ出す移動・リサイズ・アイコンのドラッグを画面の端で止める',()=>{
  for(const stage of [0,1,2] as const){let s=createFixture(`desktop-stage${stage}`,now)!;const screen=s.run.desktop.screen;
   for(const id of ['tessera','note','files','mail'] as const){const box=fitWindow(id,{x:-999,y:9999,width:1,height:9999},screen);expect(box).toMatchObject({x:0,y:0,width:MIN_WINDOW_WIDTH[id],height:workHeight(screen)});s=actDesktop(s,{type:'rect',app:id,rect:box},now);s=actDesktop(s,{type:'icon',app:id,x:9999,y:9999},now);expectBounds(s);}
  }
 });
 it('第9版の実データを移し、旧V3記録は1920×1080のまま、新しいV4記録は撮影時の縦横比を保つ',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v9-two-shots.json.gz',import.meta.url))).toString(),old=JSON.parse(raw);let s=decodeSave(raw);expectBounds(s);expect(s.schemaVersion).toBe(11);expect(s.resources).toEqual(old.resources);expect(s.persistent.screenshots).toEqual(old.persistent.screenshots);
  const oldShot=s.persistent.screenshots[0]!;expect(readCapture(oldShot).version).toBe(3);expect(restoreScene(oldShot,s.persistent.screenshots).run.desktop.screen).toEqual({width:1920,height:1080});
  s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,'ja');const shot=s.persistent.screenshots.at(-1)!,scene=readCapture(shot);expect(scene.version).toBe(6);expect(isCaptureScene(scene)).toBe(true);expect(restoreScene(shot,s.persistent.screenshots).run.desktop.screen).toEqual({width:800,height:600});
  const invalid=structuredClone(scene);if(invalid.version===4){invalid.screen.width=0;expect(isCaptureScene(invalid)).toBe(false);}
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
});
