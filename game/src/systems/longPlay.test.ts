import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { BASE_PALETTE, legacyPalette, paletteFor } from '../content/palette';
import { getWorkshopPart,partsForSet,WORKSHOP_PARTS } from '../content/workshopCatalog';
import { actWorkshop, advanceWorkshop, enterWorkshop } from './workshop';
import { observeProgress } from './longPlayEvents';
import { bulkQuote } from './bulk';
import { actDesktopExtra,refreshDesktop } from './desktopExtras';
import { jobCursorRate } from './desktopJobs';
import { creditPixels,manualClickValue,passivePixelsPerSecond } from './economy';
import { completeWorkshopPartFixture,createFixture } from './fixtures';
import { advanceDesktopTime,takeScreenshot } from './desktop';
import { ACHIEVEMENTS,actCommon,activeContract,advanceStray,bulkVisible,createProgress,globalMultiplier,isPlay,isProgress,previousWorldMultiplier,reconcileProgress } from './longPlay';
import { decodeSave,encodeSave } from './save';
import { buildSeed,canBuildSeed,createSeedVersion,freshMomentum,pressSeed,seedCursorQuote,visibleSeedItems } from './seed';
import { createInitialState,type GameState } from './state';
import { advanceActiveTime,advanceOfflineTime } from './time';
const now=1800000000000;
function fitBasicButton(s:GameState,time=now):GameState {
 s=actWorkshop(s,{type:'spawnPiece',part:'common-button',piece:'label'},time);
 return actWorkshop(s,{type:'fitPiece',part:'common-button',piece:'label',socket:'label'},time);
}

describe('段階6.5：永続の記録と生成量',()=>{
 it('28件を同じ表で扱い、初期状態の隠し要素や未達の実績は獲得しない',()=>{const s=reconcileProgress(createInitialState(now),now);expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);expect(s.persistent.progress.records).toEqual({});expect(globalMultiplier(s)).toBe(1);expect(isProgress(createProgress())).toBe(true);});
 it('達成の日時と+1%を一度だけ記録し、リリース後も保持する',()=>{let s=createInitialState(now);s=pressSeed(s,freshMomentum(),0).state;s=reconcileProgress(s,now);expect(s.persistent.progress.records).toEqual({'first-pixel':now});expect(manualClickValue(s)).toBe(1.01);expect(reconcileProgress(s,now+1000)).toBe(s);const next=createSeedVersion(s,'v1',now+1000);expect(next.persistent.progress.records).toEqual(s.persistent.progress.records);expect(decodeSave(encodeSave(next)).persistent.progress.records).toEqual(s.persistent.progress.records);});
 it('実績は足し算、案件2件は各5%。クリック・自動生成・ジョブへ二重に掛けない',()=>{const s=createFixture('desktop-ready',now)!;s.persistent.progress.records={'first-pixel':now,'save-created':now};s.persistent.progress.completed={'no-color':now,'no-cursors':now};const factor=globalMultiplier(s);expect(factor).toBeCloseTo(1.12);const base=structuredClone(s);base.persistent.progress=createProgress();expect(manualClickValue(s)/manualClickValue(base)).toBeCloseTo(factor);expect(passivePixelsPerSecond(s)/passivePixelsPerSecond(base)).toBeCloseTo(factor);expect(jobCursorRate(s,'files')/jobCursorRate(base,'files')).toBeCloseTo(factor);});
 it('壊れた記録・音量・案件・出来事の値を受け付けない',()=>{const s=createInitialState(now);for(const patch of [{sound:{enabled:true,volume:NaN}},{records:{fake:now}},{bulk:'all'},{completed:{fake:now}}])expect(isProgress({...s.persistent.progress,...patch})).toBe(false);expect(isPlay({...s.run.play,stray:{...s.run.play.stray,lifeMs:Infinity}})).toBe(false);expect(actCommon(s,{type:'sound',volume:NaN},now)).toBe(s);});
});
describe('まとめ買い',()=>{
 it('11台から表示し、10台以下では保存した購入数にかかわらず1台だけ買う',()=>{const s=createFixture('seed-motion',now)!;s.run.seed.autoCursors=10;s.persistent.progress.bulk='ten';expect(bulkVisible(s)).toBe(false);expect(seedCursorQuote(s).count).toBe(1);s.run.seed.autoCursors=11;expect(bulkVisible(s)).toBe(true);expect(seedCursorQuote(s).count).toBe(10);});
 it('×10の値段は1台ずつ切り上げた10台分と同じ。全額がなければ部分購入しない',()=>{let s=createFixture('seed-motion',now)!;s.run.seed.autoCursors=11;s.persistent.progress.bulk='ten';const q=seedCursorQuote(s),expected=Array.from({length:10},(_,i)=>Math.ceil(BALANCE.w1.cursor_cost*BALANCE.w1.cursor_growth**(s.run.seed.autoCursors+i))).reduce((a,b)=>a+b,0);expect(q).toEqual({count:10,cost:expected});s.resources.pixels=expected-1;expect(canBuildSeed(s,'cursor')).toBe(false);const n=s.run.seed.autoCursors;s.resources.pixels=expected;const next=buildSeed(s,'cursor',now);expect(next.run.seed.autoCursors).toBe(n+10);expect(next.resources.pixels).toBe(0);});
 it('買えるだけは財布を超えず、次の1台を買えない最大数。ジョブでも同じ計算',()=>{const s=createFixture('seed-motion',now)!;s.run.seed.autoCursors=11;s.persistent.progress.bulk='max';s.resources.pixels=100000;const q=bulkQuote(s,15,1.15,11);expect(q.count).toBeGreaterThan(1);expect(q.cost).toBeLessThanOrEqual(s.resources.pixels);expect(q.cost+Math.ceil(15*1.15**(11+q.count))).toBeGreaterThan(s.resources.pixels);s.resources.pixels=0;expect(bulkQuote(s,30000,1.15,0)).toEqual({count:0,cost:0});expect(bulkQuote(s,15,1.15,10000).count).toBe(0);});
 it('ジョブを10台買うと同じ料金で10台分だけ増え、未解放のジョブへは買えない',()=>{let s=createFixture('desktop-ready',now)!;s.run.seed.autoCursors=11;s.persistent.progress.bulk='ten';s.resources.pixels=1e9;s.run.desktop.jobs.files.cursors=0;const before=s.resources.pixels,q=bulkQuote(s,150000,1.15,0);s=actDesktopExtra(s,{type:'job-buy',app:'files'},now);expect(s.run.desktop.jobs.files.cursors).toBe(10);expect(before-s.resources.pixels).toBe(q.cost);const seed=createInitialState(now);expect(actDesktopExtra(seed,{type:'job-buy',app:'files'},now)).toBe(seed);});
});
describe('2件の受託案件',()=>{
 it('v1.0より前には選べず、選択だけでは報酬を付けない',()=>{const s=createFixture('release-complete',now)!;expect(actCommon(s,{type:'contract-select',id:'no-color'},now)).toBe(s);s.persistent.progress.records['v1-released']=now;const selected=actCommon(s,{type:'contract-select',id:'no-color'},now);expect(selected.persistent.progress.completed).toEqual({});expect(selected.persistent.progress.selected).toBe('no-color');});
 it('カラーを飛ばしてフォントから進め、配色や出来事を解放せずTesseraまで作れる',()=>{let s=createFixture('contract-no-color',now)!;s=buildSeed(s,'border',now);s=buildSeed(s,'save',now);s=buildSeed(s,'cursor',now);expect(visibleSeedItems(s)[0]).toBe('font');expect(canBuildSeed(s,'color')).toBe(false);for(const id of ['font','layout','motion','bars','workspace','export'] as const)s=buildSeed(s,id,now);expect(s.run.world).toBe('kumiki');expect(s.run.seed.built).not.toContain('color');s=reconcileProgress(s,now);expect(activeContract(s)).toBeNull();expect(s.persistent.progress.completed['no-color']).toBe(now);expect(visibleSeedItems(s)[0]).toBe('color');expect(buildSeed(s,'color',now).run.seed.built).toContain('color');expect(reconcileProgress(s,now+1000).persistent.progress.completed['no-color']).toBe(now);});
 it('普通の16色の画面ではカラーを飛ばさない。やめると元の解放順へ戻る',()=>{let s=createFixture('contract-no-color',now)!;s=buildSeed(buildSeed(buildSeed(s,'border',now),'save',now),'cursor',now);s=actCommon(s,{type:'contract-cancel'},now);expect(visibleSeedItems(s)[0]).toBe('color');expect(s.persistent.progress.completed).toEqual({});const plain=createFixture('seed-saved',now)!;expect(visibleSeedItems(buildSeed(plain,'cursor',now))[0]).toBe('color');});
 it('カーソルなしの案件では必須の最初のカーソルを要求せず、そのまま達成できる',()=>{let s=createFixture('contract-no-cursors',now)!;for(const id of ['border','save','color','font','layout','motion','bars','workspace','export'] as const)s=buildSeed(s,id,now);expect(s.run.world).toBe('kumiki');expect(s.run.seed.autoCursors).toBe(0);s=reconcileProgress(s,now);expect(s.persistent.progress.completed['no-cursors']).toBe(now);});
 it('構成の引き継ぎでも禁じたカラーを作らず、報酬の再受注を防ぎ、専用の見た目を選べる',()=>{const s=createFixture('contracts-offer',now)!;let selected=actCommon(s,{type:'contract-select',id:'no-color'},now);const next=createSeedVersion(selected,'v2',now);expect(activeContract(next)).toBe('no-color');expect(next.run.seed.installer).toBeNull();expect(decodeSave(encodeSave(next)).run.play.contract).toEqual(next.run.play.contract);selected.persistent.progress.completed['no-color']=now;expect(actCommon(selected,{type:'contract-select',id:'no-color'},now)).toBe(selected);expect(actCommon(selected,{type:'cosmetic',id:'no-color'},now).persistent.progress.cosmetic).toBe('no-color');});
});
describe('出来事と隠し要素',()=>{
 it('カラーを作る前と案件中には取り残されたピクセルが出ず、出現と30秒の消滅は財布に影響しない',()=>{const initial=createInitialState(now);expect(advanceStray(initial,240000)).toBe(initial);let s=createFixture('seed-color',now)!;const wallet=s.resources.pixels;s=advanceStray(s,120000);expect(s.run.play.stray.lifeMs).toBe(30000);s=advanceStray(s,30000);expect(s.run.play.stray.lifeMs).toBe(0);expect(s.resources.pixels).toBe(wallet);const no=createFixture('contract-no-color',now)!;expect(advanceStray(no,240000)).toBe(no);});
 it('不在では取り残されたピクセルを新しく出さず、期限の切れたピクセルは消える',()=>{let s=createFixture('stray-seed',now)!;s=advanceOfflineTime(s,now+60000).state;expect(s.run.play.stray.lifeMs).toBe(0);expect(advanceOfflineTime(createFixture('seed-color',now)!,now+600000).state.run.play.stray.lifeMs).toBe(0);});
 it('ボーダー前の手動100回だけを記録し、自動生成や後のクリックは数えない',()=>{let s=createInitialState(now);for(let i=0;i<99;i++)s=pressSeed(s,freshMomentum(),i).state;expect(reconcileProgress(s,now).persistent.progress.records['secret-button']).toBeUndefined();s=pressSeed(s,freshMomentum(),100).state;s=reconcileProgress(s,now);expect(s.persistent.progress.records['secret-button']).toBe(now);const after=buildSeed(s,'border',now);expect(pressSeed(after,freshMomentum(),101).state.persistent.progress.counts.preBorder).toBe(100);expect(advanceActiveTime(after,1000).state.persistent.progress.counts.preBorder).toBe(100);});
 it('時計を10回続けて押すと命令を解放し、再配置の報酬は30秒に1回だけ',()=>{let s=createFixture('desktop-ready',now)!;for(let i=0;i<9;i++)s=actCommon(s,{type:'clock-click'},now+i*100);expect(s.persistent.progress.records['secret-clock']).toBeUndefined();s=actCommon(s,{type:'clock-click'},now+900);expect(s.persistent.progress.records['secret-clock']).toBe(now+900);const before=s.resources.pixels,rate=passivePixelsPerSecond(s),refreshed=refreshDesktop(s,now+1000);expect(refreshed.resources.pixels-before).toBeCloseTo(rate*30,3);expect(refreshDesktop(refreshed,now+1001)).toBe(refreshed);});
});


describe('第3版：朱色の部品の隠し要素',()=>{
 const readyPart=(color:string)=>{
  let s=createInitialState(now);delete s.run.workshop.groupPuzzle;s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s.persistent.specs.color=1;
  s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000)),BALANCE.workshop.enterMs);
  s=actWorkshop(s,{type:'buySet',set:'common'},now);const definition=getWorkshopPart('common-button');

  s=actWorkshop(s,{type:'adjust',part:definition.id,patch:{color,textColor:'#000000'}},now);
  return s;
 };
 it('朱色は256色から選べ、16色と過去の撮影パレットを書き換えない',()=>{
  const color=BALANCE.longPlay.secretPartColor;
  expect(BASE_PALETTE).toHaveLength(16);expect(paletteFor(0)).toEqual(BASE_PALETTE);expect(paletteFor(0)).not.toContain(color);
  const colors=paletteFor(1);expect(colors).toHaveLength(256);expect(new Set(colors).size).toBe(256);expect(colors).toContain(color);expect(colors.slice(0,BASE_PALETTE.length)).toEqual(BASE_PALETTE);
  expect(legacyPalette()).toHaveLength(256);expect(legacyPalette()).not.toContain(color);expect(legacyPalette().slice(0,3)).toEqual(['#000000','#800000','#008000']);
 });
 it('朱色の部品を完成させても未書出なら手紙は来ず、書き出しで一度だけ記録する',()=>{
  let s=readyPart(BALANCE.longPlay.secretPartColor);expect(s.run.workshop.parts['common-button']!.design.color).toBe(BALANCE.longPlay.secretPartColor);
  let before=s;s=observeProgress(before,fitBasicButton(before));
  s=reconcileProgress(s,now);expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
  before=s;const beforeTokens=s.resources.tokens;s=observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+1));
  s=reconcileProgress(s,now+1);expect(s.persistent.progress.secretPart).toBe(true);expect(s.persistent.progress.records['secret-art']).toBe(now+1);expect(s.resources.tokens-beforeTokens).toBe(BALANCE.workshop.exportTokens+BALANCE.workshop.updateGrantTokens);
  before=s;s=reconcileProgress(observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+2)),now+2);
  expect(s).toBe(before);expect(s.resources.tokens-beforeTokens).toBe(BALANCE.workshop.exportTokens+BALANCE.workshop.updateGrantTokens);expect(decodeSave(encodeSave(s)).persistent.progress).toEqual(s.persistent.progress);
  const desktop=createFixture('desktop-ready',now)!;desktop.persistent.progress=s.persistent.progress;
  expect(actCommon(desktop,{type:'letter-open'},now+3).run.play.letterOpen).toBe(true);
 });
 it('保存色が朱色でも標準材質を使っている間は見た目の色として発見しない',()=>{
  let s=readyPart(BALANCE.longPlay.secretPartColor);s=fitBasicButton(s);
  s.run.workshop.parts['common-button']!.design.nativeColors=true;
  const before=s;s=reconcileProgress(observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+1)),now+1);
  expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
 });
 it('普通の赤では発見せず、既に書き出したものを後から朱色へ変えても再度は書き出せない',()=>{
  let s=readyPart('#d0523a');expect(s.run.workshop.parts['common-button']!.design.color).toBe('#d0523a');s=fitBasicButton(s);
  let before=s;s=observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now));
  s=reconcileProgress(s,now);expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
  before=s;s=observeProgress(before,actWorkshop(before,{type:'adjust',part:'common-button',patch:{color:BALANCE.longPlay.secretPartColor}},now+1));
  expect(s.persistent.progress.secretPart).toBe(false);expect(actWorkshop(s,{type:'export',part:'common-button'},now+2)).toBe(s);
 });
});


describe('段階8b：現在の制作と写真の永続記録',()=>{
 it('積み上げは未書出でも全ピースをはめた現周回のパーツだけを数え、旧アイコン数を数えない',()=>{
  let s=createFixture('stage8a-part-common-button-step-3-era0',now)!;
  s.run.seed.autoCursors=7;s.persistent.progress=createProgress();s.persistent.progress.counts.icons=10000;
  const cursorFactor=1+7*BALANCE.longPlay.cursorBonus;
  expect(previousWorldMultiplier(s)).toBeCloseTo(cursorFactor);
  s=fitBasicButton(s,now+1);
  expect(s.run.workshop.parts['common-button']!.exportedAt).toBeNull();
  expect(previousWorldMultiplier(s)).toBeCloseTo((1+BALANCE.longPlay.partBonus)*cursorFactor);
  const before=previousWorldMultiplier(s);s=actWorkshop(s,{type:'export',part:'common-button'},now+2);
  expect(previousWorldMultiplier(s)).toBe(before);s.persistent.progress.counts.icons=0;expect(previousWorldMultiplier(s)).toBe(before);
 });
 it('完成部品の上限で積み上げを止め、次の周回では旧版の書類を残して制作分を数え直す',()=>{
  let s=createFixture('stage8a-catalog',now)!;s.run.version='v2';s.persistent.progress=createProgress();
  for(const definition of WORKSHOP_PARTS)s=completeWorkshopPartFixture(s,definition.id,now,false);
  expect(WORKSHOP_PARTS.length).toBeGreaterThan(BALANCE.longPlay.partCap);
  s.run.seed.autoCursors=0;expect(previousWorldMultiplier(s)).toBeCloseTo(1+BALANCE.longPlay.partCap*BALANCE.longPlay.partBonus);
  // A previous run's full documents remain a collection, rather than fresh production.
  const previous=createFixture('stage8a-files-complete',now)!;previous.persistent.progress=createProgress();previous.persistent.progress.counts.icons=500;
  let next=createSeedVersion(previous,'v1',now+1);expect(next.persistent.setDocuments.some(doc=>doc.version==='v0.1'&&doc.set==='files')).toBe(true);
  expect(previousWorldMultiplier(next)).toBe(1);
  next=reconcileProgress(next,now+1);expect(next.persistent.progress.records.icons6).toBeUndefined();expect(next.persistent.progress.records.practice10).toBeUndefined();expect(next.persistent.progress.records['parts-all']).toBeUndefined();
 });
 it('互換IDの実績は、初めての完成部品・完成セット・ファイルとメールの完成で順に得る',()=>{
  let s=createFixture('stage8a-catalog',now)!;s.persistent.progress=createProgress();s.persistent.progress.counts.icons=10000;
  s=reconcileProgress(s,now);expect(s.persistent.progress.records.icons6).toBeUndefined();expect(s.persistent.progress.records.practice10).toBeUndefined();expect(s.persistent.progress.records['parts-all']).toBeUndefined();
  s=completeWorkshopPartFixture(s,'common-button',now+1,false);s=reconcileProgress(s,now+1);
  expect(s.persistent.progress.records.icons6).toBe(now+1);expect(s.persistent.progress.records.practice10).toBeUndefined();expect(s.persistent.progress.records['first-export']).toBeUndefined();
  for(const definition of partsForSet('common'))if(definition.id!=='common-button')s=completeWorkshopPartFixture(s,definition.id,now+2,false);
  s=reconcileProgress(s,now+2);expect(s.persistent.progress.records.practice10).toBe(now+2);expect(s.persistent.progress.records['parts-all']).toBeUndefined();
  for(const definition of partsForSet('files'))s=completeWorkshopPartFixture(s,definition.id,now+3,false);
  s=reconcileProgress(s,now+3);expect(s.persistent.progress.records['parts-all']).toBeUndefined();
  for(const definition of partsForSet('mail'))s=completeWorkshopPartFixture(s,definition.id,now+4,false);
  s=reconcileProgress(s,now+4);expect(s.persistent.progress.records['parts-all']).toBe(now+4);
  expect(s.persistent.progress.records.icons6).toBe(now+1);expect(s.persistent.progress.records.practice10).toBe(now+2);
 });
 it('写真は設定された50枚の直前では実績を出さず、実際の50枚目で記録し、削除後も累計を保つ',()=>{
  let s=createFixture('desktop-early',now)!;s.persistent.progress=createProgress();
  expect(BALANCE.longPlay.shotMilestone).toBe(50);
  for(let n=1;n<=BALANCE.longPlay.shotMilestone;n++){
   const at=now+n*60000,before=s;
   s=observeProgress(before,takeScreenshot(before,at,'ja'));s=reconcileProgress(s,at);
   expect(s.persistent.progress.counts.shots).toBe(n);
   if(n<BALANCE.longPlay.shotMilestone)expect(s.persistent.progress.records.shots100).toBeUndefined();
   else expect(s.persistent.progress.records.shots100).toBe(at);
   s=advanceDesktopTime(s,s.run.desktop.cooldownMs,at);
  }
  expect(s.persistent.screenshots).toHaveLength(BALANCE.longPlay.shotMilestone);
  s={...s,persistent:{...s.persistent,screenshots:[],progress:{...s.persistent.progress,records:{}}}};
  const restored=decodeSave(encodeSave(s)),next=reconcileProgress(restored,now+4_000_000);
  expect(next.persistent.progress.counts.shots).toBe(BALANCE.longPlay.shotMilestone);expect(next.persistent.progress.records.shots100).toBe(now+4_000_000);
 });
 it('旧条件で保存済みの実績は、新条件をまだ満たさなくても日時と倍率を失わない',()=>{
  let s=createInitialState(now);const records={icons6:now-4,practice10:now-3,'parts-all':now-2,shots100:now-1};
  s.persistent.progress.records=records;
  s=reconcileProgress(decodeSave(encodeSave(s)),now+1);expect(s.persistent.progress.records).toEqual(records);expect(globalMultiplier(s)).toBeCloseTo(1+4*BALANCE.longPlay.achievementBonus);
  const next=createSeedVersion(s,'v1',now+2);expect(next.persistent.progress.records).toEqual(records);expect(decodeSave(encodeSave(next)).persistent.progress.records).toEqual(records);
 });
});
