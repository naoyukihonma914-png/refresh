import { describe,expect,it } from 'vitest';
import type { DesktopUpgrade } from '../config/balance';
import { BALANCE } from '../config/balance';
import { createI18n } from '../content/i18n';
import { fittingDefinition } from '../content/workshopFitting';
import { captureStore } from '../platform/captures';
import { actAppBuild,hasAppPart } from './appBuild';
import { evaluateCapture } from './captureEvaluation';
import { desktopToolsPixelsPerSecond,productionCreditMultiplier } from './productionModel';
import { actWorkshop } from './workshop';
import { featureApp,isBuildable } from './appLayout';
import { readCapture } from './captureScene';
import { actDesktop,activeScreenshots,advanceDesktopTime,buyDesktopApp as buyBlueprint,desktopConditions,focusWindow,nextDesktopApp,screenshotReward,visibleApps } from './desktop';
import { desktopFiles } from './desktopFiles';
import { hasDesktopSkill,jobCapacity,jobCursorCost,jobCursorRate,jobRate,jobsRate } from './desktopJobs';
import { JOB_IDS,type Feedback } from './desktopState';
import { homePixelsPerSecond,passivePixelsPerSecond } from './economy';
import { createFixture } from './fixtures';
import { createMemoryStorage,decodeSave,encodeSave,loadGame,SAVE_KEYS,saveGame } from './save';
import type { GameState } from './state';
import { isGameState } from './state';
import { advanceActiveTime,advanceOfflineTime } from './time';
const now=1800000000000;
const fixture=(name='desktop-ready')=>createFixture(name,now)!;
const action=(s:ReturnType<typeof fixture>,a:Parameters<typeof actDesktop>[1],at=now)=>actDesktop(s,a,at,'ja');
function request(s:ReturnType<typeof fixture>,kind:Feedback['kind']){
 const id=++s.run.desktop.feedbackSerial;
 s.run.desktop.feedback.push({id,kind,sender:'hikari',target:kind==='search'?'note':kind==='timer'?String(now+60000):'',at:now,completedAt:null,baseline:[],baselineColor:'#0067c0'});return s;
}
function buyDesktopApp(s:GameState,id:DesktopUpgrade){let next=buyBlueprint(s,id);const app=isBuildable(id)?id:featureApp(id);if(next!==s&&app){next=actAppBuild(next,{type:'app-recommend',app});next=actAppBuild(next,{type:'app-install',app});}return next;}
describe('段階8b：アプリとジョブ',()=>{
 it('制作済みのセットから無料でアプリを組み、ジョブの開設だけを一度支払う',()=>{
  let s=fixture('desktop-early');const start=s.resources.pixels;
  for(const id of BALANCE.w3.offerOrder){
   const offer=nextDesktopApp(s);expect(offer?.id).toBe(id);expect(offer?.kind).toBe(id==='jobs'?'jobs':'assemble');
   const before=s.resources.pixels;s=buyDesktopApp(s,id);
   expect(s.resources.pixels).toBe(before-(id==='jobs'?BALANCE.w3.jobUnlockCost:0));expect(buyDesktopApp(s,id)).toBe(s);
   expect(isGameState(s),id).toBe(true);
   if(id!=='jobs')for(const slot of s.run.desktop.projects[id]!.installedAssembly!.slots)expect(s.run.workshop.parts[slot.source]!.step).toBe(4);
  }
  expect(nextDesktopApp(s)).toBeNull();expect(s.run.desktop.apps).toHaveLength(8);
  expect(s.resources.pixels).toBe(start-BALANCE.w3.jobUnlockCost);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('メモリ数まで窓に割り当て、最小化・閉じた窓でも生成。ジョブ追加スキルで1枠増える',()=>{
  let s=fixture();s.run.desktop.jobs.terminal={assigned:false,cursors:1,updates:0};expect(jobCapacity(s)).toBe(3);
  expect(action(s,{type:'job-assign',app:'terminal'})).toBe(s);
  s=action(s,{type:'skill',id:'posts'});expect(jobCapacity(s)).toBe(4);s=action(s,{type:'job-assign',app:'terminal'});expect(jobRate(s,'terminal')).toBeGreaterThan(0);
  const rate=passivePixelsPerSecond(s),before=s.run.totalPixelsGenerated;
  for(const app of JOB_IDS)s=action(s,{type:'close',app});
  s=advanceActiveTime(s,1000).state;expect(s.run.totalPixelsGenerated-before).toBeCloseTo(rate,3);
  expect(jobsRate(s)).toBeGreaterThan(0);expect(passivePixelsPerSecond(s)).toBeCloseTo(homePixelsPerSecond(s)+desktopToolsPixelsPerSecond(s)+jobsRate(s));
 });
 it('ジョブの値段を切り上げ、更新・採用した機能・色・Hzを毎秒に掛ける',()=>{
  let s=fixture('desktop-jobs');const search=s.run.desktop.projects.files!.installed!.parts.find(part=>part.id==='search')!;
  s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-remove',app:'files',part:'search'});s=actAppBuild(s,{type:'app-install',app:'files'});
  expect(hasAppPart(s,'files','search')).toBe(false);
  const j=s.run.desktop.jobs.files,rate=jobCursorRate(s,'files'),cost=jobCursorCost(s,'files'),pixels=s.resources.pixels;
  s=action(s,{type:'job-buy',app:'files'});expect(Number.isInteger(cost)).toBe(true);expect(s.resources.pixels).toBe(pixels-cost);expect(s.run.desktop.jobs.files.cursors).toBe(j.cursors+1);
  s=action(s,{type:'job-update',app:'files'});expect(jobCursorRate(s,'files')).toBeCloseTo(rate*BALANCE.w3.updateMultiplier);
  const before=jobCursorRate(s,'files');s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-place',app:'files',part:'search',rect:search});
  expect(jobCursorRate(s,'files')).toBe(before);
  s=actAppBuild(s,{type:'app-install',app:'files'});expect(hasAppPart(s,'files','search')).toBe(true);expect(jobCursorRate(s,'files')).toBeCloseTo(before*BALANCE.w3.featureMultiplier);
  const previousRefresh=s.persistent.specs.refresh;s.persistent.specs.refresh=2;
  expect(jobCursorRate(s,'files')).toBeCloseTo(before*BALANCE.w3.featureMultiplier*BALANCE.spec.refresh[2].multiplier/BALANCE.spec.refresh[previousRefresh]!.multiplier);
  const previousColor=s.persistent.specs.color,beforeColor=jobCursorRate(s,'files');s.persistent.specs.color=2;
  expect(jobCursorRate(s,'files')).toBeCloseTo(beforeColor*BALANCE.spec.color[2].multiplier/BALANCE.spec.color[previousColor]!.multiplier);
 });
 it('受動生成と有限のピース払いを分け、完成してもエクスポートまでトークンを増やさない',()=>{
  let s=actWorkshop(fixture('stage8b-economy-before-era2'),{type:'skill',id:'extraParts'},now);s=actWorkshop(s,{type:'selectPart',part:'plugin-tabs'},now);s=action(s,{type:'job-assign',app:'tessera'});s=action(s,{type:'job-buy',app:'tessera'});
  const part=s.run.workshop.parts['plugin-tabs']!,rate=passivePixelsPerSecond(s),pixels=s.resources.pixels,tokens=s.resources.tokens;
  expect(part.step).toBe(1);expect(part.fitting!.sockets).toEqual({});expect(s.run.desktop.jobs.tessera).toMatchObject({assigned:true,cursors:1,updates:0});
  const result=advanceActiveTime(s,BALANCE.workshop.assistStepMs),passive=rate*BALANCE.workshop.assistStepMs/1000;
  expect(result.pixels).toBeCloseTo(passive,4);expect(result.state.run.workshop.parts['plugin-tabs']!.step).toBe(1);
  expect(result.state.resources.pixels-pixels).toBeCloseTo(passive+BALANCE.workshop.categoryStepRewards.small.reduce((sum,value)=>sum+value,0)/fittingDefinition('plugin-tabs').pieces.length*productionCreditMultiplier(s),4);
  expect(result.state.resources.tokens).toBe(tokens);expect(result.state.run.workshop.parts['plugin-tabs']!.completedAt).toBeNull();
  const later=advanceActiveTime(result.state,BALANCE.workshop.assistStepMs*10).state;
  expect(later.run.workshop.parts['plugin-tabs']!.step).toBe(4);expect(later.run.workshop.parts['plugin-tabs']!.tested).toBe(true);expect(later.run.workshop.parts['plugin-tabs']!.exportedAt).toBeNull();expect(later.resources.tokens).toBe(tokens);
 });
 it('写真・テーマ・書類の表示操作を保存し、日付の並べ替えと日本語・英語の検索を完了する',()=>{
  let s=request(fixture(),'sort');s=action(s,{type:'sort',by:'date'});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  s=request(s,'search');const tokens=s.resources.tokens;s=action(s,{type:'search',text:'違う名前'});expect(s.resources.tokens).toBe(tokens);
  s=action(s,{type:'search',text:createI18n('ja').t('desktop.app.note')});expect(s.resources.tokens).toBe(tokens+2);expect(desktopFiles(s,createI18n('ja'),'root').map(f=>f.id)).toEqual(['note']);
  s=action(s,{type:'search',text:''});s=request(s,'bright');s=action(s,{type:'photo',edit:{source:'night',brightness:1.3,tone:12,crop:15}});s=action(s,{type:'wallpaper'});
  expect(s.persistent.desktopPrefs.wallpaper).toEqual(s.run.desktop.photo);expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  s=request(s,'dark');s=action(s,{type:'theme',mode:'dark',accent:'#a76628',radius:3,iconSize:64,slideshow:true});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('実際に採用して写っている機能だけを写真の部品として数える',()=>{
  let s=fixture('desktop-files');const sort=s.run.desktop.projects.files!.installed!.parts.find(part=>part.id==='sort')!;
  s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-remove',app:'files',part:'sort'});s=actAppBuild(s,{type:'app-install',app:'files'});s=focusWindow(s,'files');
  const visibleSort=(state:GameState)=>evaluateCapture(state).parts.filter(part=>part.app==='files'&&part.sourcePartId==='files-sort'&&part.visible);
  expect(visibleSort(s)).toHaveLength(0);
  s=actAppBuild(s,{type:'app-edit',app:'files'});s=actAppBuild(s,{type:'app-place',app:'files',part:'sort',rect:sort});expect(visibleSort(s)).toHaveLength(0);
  s=actAppBuild(s,{type:'app-install',app:'files'});s=focusWindow(s,'files');expect(visibleSort(s)).toHaveLength(1);
  s=action(s,{type:'minimize',app:'files'});expect(evaluateCapture(s).parts.filter(part=>part.app==='files'&&part.visible)).toHaveLength(0);
 });
 it('予約は指定時刻に1度。不在中は半分、時計を戻しても二重に撮らない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s.run.desktop.terminal.running=false;
  s=request(s,'timer');s=action(s,{type:'reserve',at:now+60000});expect(s.run.desktop.feedback.at(-1)!.completedAt).toBe(now);
  const before=s.resources.pixels,rate=passivePixelsPerSecond(s),reward=screenshotReward(s);
  const next=advanceOfflineTime(s,now+120000).state;expect(next.persistent.screenshots).toHaveLength(1);expect(next.resources.pixels-before).toBeCloseTo(rate*120+reward*.5,1);
  expect(advanceOfflineTime(next,now+60000).state.persistent.screenshots).toHaveLength(1);expect(advanceOfflineTime(next,now+180000).state.persistent.screenshots).toHaveLength(1);
 });
 it('ストレージの不在上限を越える予約は実行せず、後の処理でも報酬を付けない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s.run.desktop.terminal.running=false;s=action(s,{type:'reserve',at:now+3*3600000});
  s=advanceOfflineTime(s,now+24*3600000).state;expect(s.persistent.screenshots).toHaveLength(0);expect(s.run.desktop.reservation?.done).toBe(true);expect(advanceActiveTime(s,100).state.persistent.screenshots).toHaveLength(0);
 });
 it('予約の記録はその時刻までの生成だけを含み、残りの不在生成を後で足す',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s.run.desktop.terminal.running=false;s=action(s,{type:'reserve',at:now+60000});
  const before=s.resources.pixels,rate=passivePixelsPerSecond(s);s=advanceOfflineTime(s,now+120000).state;
  const scene=readCapture(s.persistent.screenshots[0]!);expect(scene.version!==1&&scene.display.wallTime).toBe(now+60000);expect(scene.display.resources.pixels-before).toBeCloseTo(rate*60,1);
 });
 it('ターミナルは選んだ間隔で実行し、停止・満杯・最小化でも重複や無限生成をしない',()=>{
  let s=fixture();s.persistent.screenshots=[];s.run.desktop.cooldownMs=0;s=action(s,{type:'terminal',interval:60000,running:true});
  s=advanceActiveTime(s,60000).state;expect(s.run.desktop.terminal.executions).toBe(2);expect(s.persistent.screenshots).toHaveLength(1);
  s=action(s,{type:'terminal',interval:3600000,running:false});s=advanceActiveTime(s,60000).state;expect(s.persistent.screenshots).toHaveLength(1);
  s=action(s,{type:'terminal',interval:60000,running:true});const away=advanceOfflineTime(s,now+3600000).state;expect(away.persistent.screenshots).toHaveLength(BALANCE.w3.baseShotCapacity);
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
  let s=actWorkshop(fixture(),{type:'skill',id:'extraParts'},now);const kinds=new Set<string>();
  // An unlocked, unfinished material makes the production request eligible.
  for(let i=0;i<20;i++){s=advanceDesktopTime(s,240000,now,true);const f=s.run.desktop.feedback.at(-1)!;kinds.add(f.kind);s.run.desktop.feedback=s.run.desktop.feedback.map(x=>({...x,completedAt:now}));}
  expect([...kinds].sort()).toEqual(['part','color','screenshot','sort','search','bright','trash','timer','dark','capture'].sort());
  s=action(s,{type:'skill',id:'autoFeedback'});s=request(s,'sort');const tokens=s.resources.tokens;s=advanceDesktopTime(s,100,now);expect(s.resources.tokens).toBe(tokens+1);expect(s.run.desktop.fileSort).toBe('date');
 });
 it('制作済みのセットと採用した操作でv1.0の5条件を満たせる',()=>{
  let s=fixture();for(const app of ['files','mail','clock','bin'] as const)s=focusWindow(s,app);
  for(let i=0;i<10;i++){s=request(s,'sort');s=action(s,{type:'sort',by:'date'});}
  expect(desktopConditions(s)).toEqual([true,true,true,true,true]);expect(s.run.world).toBe('desktop');
 });
 it.each(['desktop-jobs','desktop-photo','desktop-ready','desktop-stalled'])('%sの固定状態を往復できる',name=>{const s=fixture(name);expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);});
});
