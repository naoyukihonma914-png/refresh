import { actAppBuild } from './appBuild';
import { isBuildable, featureApp } from './appLayout';
import type { DesktopUpgrade } from '../config/balance';
import type { GameState } from './state';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createI18n } from '../content/i18n';
import { createFixture } from './fixtures';
import { actDesktop,advanceDesktopTime,activeScreenshots,buyDesktopApp as buyBlueprint,desktopConditions,focusWindow,nextDesktopApp,screenshotParts,screenshotReward,takeScreenshot,visibleApps } from './desktop';
import { hasDesktopSkill,jobCapacity,jobCursorCost,jobCursorRate,jobRate,jobsRate } from './desktopJobs';
import { JOB_IDS, type Feedback } from './desktopState';
import { desktopFiles } from './desktopFiles';
import { advanceActiveTime,advanceOfflineTime } from './time';
import { homePixelsPerSecond,passivePixelsPerSecond } from './economy';
import { decodeSave,encodeSave,saveGame,loadGame,createMemoryStorage,SAVE_KEYS } from './save';
import { isGameState } from './state';
import { readCapture,restoreScene } from './captureScene';
import { captureStore } from '../platform/captures';
const now=1800000000000;
const fixture=(name='desktop-ready')=>createFixture(name,now)!;
const action=(s:ReturnType<typeof fixture>,a:Parameters<typeof actDesktop>[1],at=now)=>actDesktop(s,a,at,'ja');
function request(s:ReturnType<typeof fixture>,kind:Feedback['kind']){
 const id=++s.run.desktop.feedbackSerial;
 s.run.desktop.feedback.push({id,kind,sender:'hikari',target:kind==='search'?'home':kind==='timer'?String(now+60000):'',at:now,completedAt:null,baseline:[],baselineColor:'#0067c0'});return s;
}
function buyDesktopApp(s:GameState,id:DesktopUpgrade){let next=buyBlueprint(s,id);const app=isBuildable(id)?id:featureApp(id);if(next!==s&&app){next=actAppBuild(next,{type:'app-recommend',app});next=actAppBuild(next,{type:'app-install',app});}return next;}
describe('段階6：アプリとジョブ',()=>{
 it('21個のアプリ・機能を決めた順に支払い、作った操作だけを保存する',()=>{
  let s=fixture('desktop-early');s.resources.pixels=s.run.totalPixelsGenerated=1e12;const start=s.resources.pixels;
  for(const item of BALANCE.w3.apps){expect(nextDesktopApp(s)?.id).toBe(item.id);const before=s.resources.pixels;s=buyDesktopApp(s,item.id);expect(s.resources.pixels).toBe(before-item.cost);expect(buyDesktopApp(s,item.id)).toBe(s);expect(isGameState(s),item.id).toBe(true);}
  expect(nextDesktopApp(s)).toBeNull();expect(s.run.desktop.apps).toHaveLength(8);expect(s.run.desktop.upgrades).toHaveLength(21);
  expect(s.resources.pixels).toBe(start-BALANCE.w3.apps.reduce((n,a)=>n+a.cost,0));expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('メモリ数まで窓に割り当て、最小化・閉じた窓でも生成。ジョブ追加スキルで1枠増える',()=>{
  let s=fixture();s.run.desktop.jobs.terminal={assigned:false,cursors:1,updates:0};expect(jobCapacity(s)).toBe(3);
  expect(action(s,{type:'job-assign',app:'terminal'})).toBe(s);
  s=action(s,{type:'skill',id:'posts'});expect(jobCapacity(s)).toBe(4);s=action(s,{type:'job-assign',app:'terminal'});expect(jobRate(s,'terminal')).toBeGreaterThan(0);
  const rate=passivePixelsPerSecond(s),before=s.run.totalPixelsGenerated;
  for(const app of JOB_IDS)s=action(s,{type:'close',app});
  s=advanceActiveTime(s,1000).state;expect(s.run.totalPixelsGenerated-before).toBeCloseTo(rate,3);
  expect(jobsRate(s)).toBeGreaterThan(0);expect(passivePixelsPerSecond(s)).toBeCloseTo(homePixelsPerSecond(s)+jobsRate(s));
 });
 it('ジョブの値段は切り上げ。更新×2と小さな機能×1.25、色・Hzを毎秒に掛ける',()=>{
  let s=fixture('desktop-jobs'),j=s.run.desktop.jobs.files,rate=jobCursorRate(s,'files');
  const cost=jobCursorCost(s,'files'),pixels=s.resources.pixels;s=action(s,{type:'job-buy',app:'files'});
  expect(Number.isInteger(cost)).toBe(true);expect(s.resources.pixels).toBe(pixels-cost);expect(s.run.desktop.jobs.files.cursors).toBe(j.cursors+1);
  s=action(s,{type:'job-update',app:'files'});expect(jobCursorRate(s,'files')).toBeCloseTo(rate*2);
  const before=jobCursorRate(s,'files');s=buyDesktopApp(s,'manager');s=buyDesktopApp(s,'search');expect(jobCursorRate(s,'files')).toBeCloseTo(before*1.25);
  s.persistent.specs.refresh=2;expect(jobCursorRate(s,'files')).toBeCloseTo(before*1.25*4);
 });
 it('不在のジョブはストレージ上限まで入り、集中モードでもジョブは動く',()=>{
  const s=fixture();s.run.kumiki.focus=true;const rate=passivePixelsPerSecond(s),before=s.run.totalPixelsGenerated;
  const off=advanceOfflineTime(s,now+24*3600000);expect(off.capped).toBe(true);expect(off.creditedMs).toBe(2*3600000);expect(off.state.run.totalPixelsGenerated-before).toBeCloseTo(rate*7200,1);
  expect(s.run.totalPixelsGenerated).toBe(before);
 });
 it('写真・テーマ・書類の表示操作を保存し、日付の並べ替えと日本語・英語の検索を完了する',()=>{
  let s=request(fixture(),'sort');s=action(s,{type:'sort',by:'date'});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  s=request(s,'search');const tokens=s.resources.tokens;s=action(s,{type:'search',text:'違う名前'});expect(s.resources.tokens).toBe(tokens);
  s=action(s,{type:'search',text:createI18n('ja').t('files.home')});expect(s.resources.tokens).toBe(tokens+2);expect(desktopFiles(s,createI18n('ja'),'root').map(f=>f.id)).toEqual(['home']);
  s=action(s,{type:'search',text:''});s=request(s,'bright');s=action(s,{type:'photo',edit:{source:'night',brightness:1.3,tone:12,crop:15}});s=action(s,{type:'wallpaper'});
  expect(s.persistent.desktopPrefs.wallpaper).toEqual(s.run.desktop.photo);expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  s=request(s,'dark');s=action(s,{type:'theme',mode:'dark',accent:'#a76628',radius:3,iconSize:64,slideshow:true});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('小さな機能はその窓が写るときだけパーツ数に加える',()=>{
  let s=fixture('desktop-files');const before=screenshotParts(s);s=buyDesktopApp(s,'sort');s=focusWindow(s,'files');expect(screenshotParts(s)).toBe(before+2);
  s=action(s,{type:'minimize',app:'files'});expect(screenshotParts(s)).toBe(before-3);
 });
 it('予約は指定時刻に1度。不在中は半分、時計を戻しても二重に撮らない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;
  s=request(s,'timer');s=action(s,{type:'reserve',at:now+60000});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  const before=s.resources.pixels,rate=passivePixelsPerSecond(s),reward=screenshotReward(s);
  const next=advanceOfflineTime(s,now+120000).state;expect(next.persistent.screenshots).toHaveLength(1);expect(next.resources.pixels-before).toBeCloseTo(rate*120+reward*.5,1);
  expect(advanceOfflineTime(next,now+60000).state.persistent.screenshots).toHaveLength(1);expect(advanceOfflineTime(next,now+180000).state.persistent.screenshots).toHaveLength(1);
 });
 it('ストレージの不在上限を越える予約は実行せず、後の処理でも報酬を付けない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s=action(s,{type:'reserve',at:now+3*3600000});
  s=advanceOfflineTime(s,now+24*3600000).state;expect(s.persistent.screenshots).toHaveLength(0);expect(s.run.desktop.reservation?.done).toBe(true);expect(advanceActiveTime(s,100).state.persistent.screenshots).toHaveLength(0);
 });
 it('予約の記録はその時刻までの生成だけを含み、残りの不在生成を後で足す',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s=action(s,{type:'reserve',at:now+60000});
  const before=s.resources.pixels,rate=passivePixelsPerSecond(s);s=advanceOfflineTime(s,now+120000).state;
  const scene=readCapture(s.persistent.screenshots[0]!);expect(scene.version!==1&&scene.display.wallTime).toBe(now+60000);expect(scene.display.resources.pixels-before).toBeCloseTo(rate*60,1);
 });
 it('ターミナルは選んだ間隔で実行し、停止・満杯・最小化でも重複や無限生成をしない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s=action(s,{type:'terminal',interval:60000,running:true});
  s=advanceActiveTime(s,60000).state;expect(s.run.desktop.terminal.executions).toBe(2);expect(s.persistent.screenshots).toHaveLength(1);
  s=action(s,{type:'terminal',interval:3600000,running:false});s=advanceActiveTime(s,60000).state;expect(s.persistent.screenshots).toHaveLength(1);
  s=action(s,{type:'terminal',interval:60000,running:true});const away=advanceOfflineTime(s,now+3600000).state;expect(away.persistent.screenshots).toHaveLength(1);
 });
 it('ごみ箱で容量を空け、元に戻すと元の報酬を返し、繰り返しても累計が増えない',()=>{
  let s=fixture();const shot=s.persistent.screenshots[0]!,before=s.resources.pixels,total=s.run.totalPixelsGenerated,count=activeScreenshots(s).length;
  const id=`shot:${shot.id}`;s=action(s,{type:'trash',id});expect(activeScreenshots(s)).toHaveLength(count-1);expect(s.resources.pixels).toBeGreaterThan(before);
  expect(action(s,{type:'trash',id})).toBe(s);s=action(s,{type:'undo-trash',id});expect(s.resources.pixels).toBe(before);expect(s.run.totalPixelsGenerated).toBe(total);
  s=action(s,{type:'trash',id});s=action(s,{type:'empty-trash'});expect(s.run.desktop.trash).toHaveLength(0);expect(activeScreenshots(s)).toHaveLength(count-1);expect(isGameState(s)).toBe(true);
 });
 it('片付けの依頼は異なる3枚。1枚を戻して捨て直しても達成しない',()=>{
  let s=request(fixture(),'trash');const ids=s.persistent.screenshots.slice(0,3).map(shot=>`shot:${shot.id}`),tokens=s.resources.tokens;
  for(let i=0;i<3;i++){s=action(s,{type:'trash',id:ids[0]!});s=action(s,{type:'undo-trash',id:ids[0]!});}
  expect(s.run.desktop.feedback.at(-1)!.completedAt).toBeNull();expect(s.resources.tokens).toBe(tokens);
  for(const id of ids)s=action(s,{type:'trash',id});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);expect(s.resources.tokens).toBe(tokens+2);expect(isGameState(s)).toBe(true);
 });
 it('不要な画像の共有保存を回収しても、予備とほかの撮影が使う画像は残る',()=>{
  let s=fixture();const disk=createMemoryStorage();saveGame(disk,s,now);const old=JSON.parse(disk.getItem(SAVE_KEYS.primary)!);const refs=old.persistent.screenshots.map((shot:{sceneRef:string})=>shot.sceneRef);
  for(const shot of [...s.persistent.screenshots])s=action(s,{type:'trash',id:`shot:${shot.id}`});s=action(s,{type:'empty-trash'});
  expect(s.persistent.screenshots).toHaveLength(0);saveGame(disk,s,now+1);for(const ref of refs)expect(()=>captureStore(disk).get(ref)).not.toThrow();
  saveGame(disk,s,now+2);for(const ref of refs)expect(()=>captureStore(disk).get(ref)).toThrow();expect(loadGame(disk).kind).toBe('loaded');
 });
 it('応答なしの間もジョブは動き、再起動または閉じて開くと60秒分を一度だけ受け取る',()=>{
  let s=fixture('desktop-stalled'),rate=passivePixelsPerSecond(s),before=s.resources.pixels;
  const app=s.run.desktop.stalled!;s=advanceActiveTime(s,1000).state;expect(s.resources.pixels-before).toBeCloseTo(rate,2);
  before=s.resources.pixels;s=action(s,{type:'restart',app});expect(s.resources.pixels-before).toBeCloseTo(rate*60,2);expect(action(s,{type:'restart',app})).toBe(s);
  s.run.desktop.stalled=app;s=action(s,{type:'close',app});before=s.resources.pixels;s=action(s,{type:'open',app});expect(s.resources.pixels-before).toBeCloseTo(rate*60,2);
 });
 it('3〜6分の応答なしは同時に1窓。留守中には出来事を増やさない',()=>{
  let s=fixture('desktop-early');s=advanceDesktopTime(s,BALANCE.w3.stallMinMs,now);expect(s.run.desktop.stalled).toBe('tessera');const serial=s.run.desktop.stallSerial;
  s=advanceDesktopTime(s,360000,now);expect(s.run.desktop.stallSerial).toBe(serial);
  s=action(s,{type:'restart',app:'tessera'});expect(s.run.desktop.stallMs).toBeGreaterThanOrEqual(BALANCE.w3.stallMinMs);s=advanceDesktopTime(s,100,now);expect(s.run.desktop.stalled).toBeNull();s=advanceDesktopTime(s,360000,now,true);expect(s.run.desktop.stalled).toBeNull();
 });
 it('9つのスキルを購入し、遊び系だけ切り替え、仮想画面でもジョブを止めない',()=>{
  let s=fixture();s.run.desktop.cooldownMs=30000;for(const skill of BALANCE.w3.skills){s=action(s,{type:'skill',id:skill.id});expect(hasDesktopSkill(s,skill.id)).toBe(true);}
  expect(s.run.desktop.cooldownMs).toBe(20000);const rate=jobsRate(s);s=action(s,{type:'move-workspace',app:'tessera'});expect(visibleApps(s)).not.toContain('tessera');expect(jobsRate(s)).toBe(rate);
  s=action(s,{type:'workspace',workspace:1});expect(visibleApps(s)).toContain('tessera');
  s=action(s,{type:'toggle-skill',id:'virtual'});expect(hasDesktopSkill(s,'virtual')).toBe(false);expect(visibleApps(s)).toContain('tessera');
  expect(action(s,{type:'toggle-skill',id:'posts'})).toBe(s);expect(isGameState(s)).toBe(true);
 });
 it('解放済みの10種類だけを順に依頼し、自動応答は半分のトークン',()=>{
  let s=fixture();const kinds=new Set<string>();
  // A single completed redraw gives other templates a turn in the rotation.
  for(let i=0;i<20;i++){s=advanceDesktopTime(s,240000,now,true);const f=s.run.desktop.feedback.at(-1)!;kinds.add(f.kind);s.run.desktop.feedback=s.run.desktop.feedback.map(x=>({...x,completedAt:now}));}
  expect([...kinds].sort()).toEqual(['redraw','practice','color','screenshot','sort','search','bright','trash','timer','dark'].sort());
  s=action(s,{type:'skill',id:'autoFeedback'});s=request(s,'sort');const tokens=s.resources.tokens;s=advanceDesktopTime(s,100,now);expect(s.resources.tokens).toBe(tokens+1);expect(s.run.desktop.fileSort).toBe('date');
 });
 it('v1.0の5条件まで到達でき、今回の段階では出荷に進まない',()=>{
  let s=fixture();for(const app of ['files','mail','clock','bin'] as const)s=focusWindow(s,app);
  for(let i=0;i<10;i++){s=request(s,'sort');s=action(s,{type:'sort',by:'date'});}
  expect(desktopConditions(s)).toEqual([true,true,true,true,true]);expect(s.run.world).toBe('desktop');
 });
 it('第7版の実データと旧V1撮影を変更せず読み、第9版・V4撮影と混在して保存できる',()=>{
  const raw=gunzipSync(readFileSync(new URL('./testdata/v7-two-shots.json.gz',import.meta.url))).toString();const old=JSON.parse(raw);let s=decodeSave(raw);
  expect(s.schemaVersion).toBe(13);expect(s.resources.tokens).toBe(old.resources.tokens);expect(s.resources.dollars).toBe(old.resources.dollars);expect(s.resources.pixels).toBeGreaterThanOrEqual(old.resources.pixels);expect(s.persistent.screenshots).toEqual(old.persistent.screenshots);
  expect(readCapture(s.persistent.screenshots[0]!).version).toBe(1);expect(nextDesktopApp(s)?.id).toBe('sort');
  s=buyDesktopApp(s,'sort');s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now+1000,'en');expect(readCapture(s.persistent.screenshots.at(-1)!).version).toBe(8);
  expect(decodeSave(encodeSave(s))).toEqual(s);expect(restoreScene(s.persistent.screenshots[0]!,s.persistent.screenshots).persistent.productionNote).toBe(readCapture(old.persistent.screenshots[0]).note);
 });
 it('V4の写真・テーマ・ジョブ・12機能も撮影時の状態を独立して保つ',()=>{
  let s=fixture();s=action(s,{type:'theme',mode:'dark'});s=action(s,{type:'manager-tab',tab:'performance'});s=action(s,{type:'calendar-month',at:1830297600000});s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,'ja');const shot=s.persistent.screenshots.at(-1)!,scene=readCapture(shot);
  expect(scene.version).toBe(8);expect(scene).not.toHaveProperty('products');expect(scene).not.toHaveProperty('persistent');
  s=action(s,{type:'theme',mode:'light'});s=action(s,{type:'job-update',app:'files'});const restored=restoreScene(shot,s.persistent.screenshots);
  expect(restored.persistent.desktopPrefs.mode).toBe('dark');expect(restored.run.desktop.jobs.files.updates).toBe(1);expect(restored.run.desktop.upgrades).toHaveLength(21);expect(restored.run.desktop.managerTab).toBe('performance');expect(restored.run.desktop.calendarMonth).toBe(1830297600000);expect(scene.version!==1&&scene.display.managerShotRate).toBeGreaterThan(0);
 });
 it.each(['desktop-jobs','desktop-photo','desktop-ready','desktop-stalled'])('%sの固定状態を往復できる',name=>{const s=fixture(name);expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);});
});
