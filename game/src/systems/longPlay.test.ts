import { describe,expect,it } from 'vitest';
import { BALANCE } from '../config/balance';
import { BASE_PALETTE, legacyPalette, paletteFor } from '../content/palette';
import { getWorkshopPart } from '../content/workshopCatalog';
import { actWorkshop, advanceWorkshop, enterWorkshop } from './workshop';
import { observeProgress } from './longPlayEvents';
import { bulkQuote } from './bulk';
import { actDesktopExtra,refreshDesktop } from './desktopExtras';
import { jobCursorRate } from './desktopJobs';
import { creditPixels,manualClickValue,passivePixelsPerSecond } from './economy';
import { createFixture } from './fixtures';
import { ACHIEVEMENTS,actCommon,activeContract,advanceStray,bulkVisible,createProgress,globalMultiplier,isPlay,isProgress,reconcileProgress } from './longPlay';
import { decodeSave,encodeSave } from './save';
import { buildSeed,canBuildSeed,createSeedVersion,freshMomentum,pressSeed,seedCursorQuote,visibleSeedItems } from './seed';
import { createInitialState } from './state';
import { advanceActiveTime,advanceOfflineTime } from './time';
const now=1800000000000;
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
  let s=createInitialState(now);s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s.persistent.specs.color=1;
  s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000)),BALANCE.workshop.enterMs);
  s=actWorkshop(s,{type:'buySet',set:'common'},now);const definition=getWorkshopPart('common-button');
  s=actWorkshop(s,{type:'place',part:definition.id,rect:definition.defaultRect},now);
  for(const element of definition.elements)s=actWorkshop(s,{type:'addElement',part:definition.id,element},now);
  s=actWorkshop(s,{type:'adjust',part:definition.id,patch:{color,textColor:'#000000'}},now);
  s=actWorkshop(s,{type:'confirmAdjustment',part:definition.id},now);
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
  let before=s;s=observeProgress(before,actWorkshop(before,{type:'test',part:'common-button',interaction:'press'},now));
  s=reconcileProgress(s,now);expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
  before=s;const beforeTokens=s.resources.tokens;s=observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+1));
  s=reconcileProgress(s,now+1);expect(s.persistent.progress.secretPart).toBe(true);expect(s.persistent.progress.records['secret-art']).toBe(now+1);expect(s.resources.tokens-beforeTokens).toBe(1);
  before=s;s=reconcileProgress(observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+2)),now+2);
  expect(s).toBe(before);expect(s.resources.tokens-beforeTokens).toBe(1);expect(decodeSave(encodeSave(s)).persistent.progress).toEqual(s.persistent.progress);
  const desktop=createFixture('desktop-ready',now)!;desktop.persistent.progress=s.persistent.progress;
  expect(actCommon(desktop,{type:'letter-open'},now+3).run.play.letterOpen).toBe(true);
 });
 it('保存色が朱色でも標準材質を使っている間は見た目の色として発見しない',()=>{
  let s=readyPart(BALANCE.longPlay.secretPartColor);s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
  s.run.workshop.parts['common-button']!.design.nativeColors=true;
  const before=s;s=reconcileProgress(observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now+1)),now+1);
  expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
 });
 it('普通の赤では発見せず、既に書き出したものを後から朱色へ変えても再度は書き出せない',()=>{
  let s=readyPart('#d0523a');expect(s.run.workshop.parts['common-button']!.design.color).toBe('#d0523a');s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
  let before=s;s=observeProgress(before,actWorkshop(before,{type:'export',part:'common-button'},now));
  s=reconcileProgress(s,now);expect(s.persistent.progress.secretPart).toBe(false);expect(s.persistent.progress.records['secret-art']).toBeUndefined();
  before=s;s=observeProgress(before,actWorkshop(before,{type:'adjust',part:'common-button',patch:{color:BALANCE.longPlay.secretPartColor}},now+1));
  expect(s.persistent.progress.secretPart).toBe(false);expect(actWorkshop(s,{type:'export',part:'common-button'},now+2)).toBe(s);
 });
});
