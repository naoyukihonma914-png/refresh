import {describe,expect,it} from 'vitest';
import {BALANCE,type SeedItem} from '../config/balance';
import {creditPixels} from './economy';
import {createFixture} from './fixtures';
import {decodeSave,encodeSave} from './save';
import {buildKnownSeed,buildSeed,knownSeedItems,seedReplayQuote} from './seed';
import {createInitialState,isGameState,type GameState} from './state';

const now=1_800_000_000_000;
const price=(id:SeedItem)=>BALANCE.w1.items.find(item=>item.id===id)!.cost;
const allIds=BALANCE.w1.items.map(item=>item.id);
function repeat(pixels=0):GameState {
 const state=createFixture('stage7-v2',now)!;
 expect(state.run.version).toBe('v2');expect(state.persistent.products.length).toBeGreaterThan(0);
 return creditPixels(state,pixels);
}
function knownOnly(state:GameState,ids:string[]):GameState {
 const next=structuredClone(state);next.persistent.products=next.persistent.products.map(product=>({...product,screen:{...product.screen,built:[...ids]}}));
 return next;
}

describe('TP-3：すでに作ったUIだけを次の版でまとめて作る',()=>{
 it('初めての版では、履歴と十分な資金があっても一括制作を解放しない',()=>{
  const state=creditPixels(createInitialState(now),1e9);state.run.seed.history=allIds.map(item=>({item,at:now}));
  expect(knownSeedItems(state)).toEqual([]);expect(seedReplayQuote(state)).toEqual({items:[],cost:0,remaining:[],totalCost:0});expect(buildKnownSeed(state,now)).toBe(state);
 });
 it('保存した製品と制作履歴の既知IDを使い、旧世代の名前やカーソルを制作対象へ混ぜない',()=>{
  let state=knownOnly(repeat(),['save','border','old-editor','cursor']);
  state.run.seed.history=[{item:'border',at:now},{item:'color',at:now},{item:'cursor',at:now}];
  expect(knownSeedItems(state)).toEqual(['border','save','color']);
  state.run.seed.history=[];expect(seedReplayQuote(state).remaining).toEqual(['border','save']);
 });
 it('資金で払える先頭の分だけ作り、足りないパーツの次へ飛び越えない',()=>{
  const total=price('border')+price('save');let state=repeat(total-1);
  expect(seedReplayQuote(state)).toMatchObject({items:['border'],cost:price('border'),remaining:allIds});
  const generated=state.run.totalPixelsGenerated;
  state=buildKnownSeed(state,now+1);
  expect(state.run.seed.built).toEqual(['border']);expect(state.resources.pixels).toBe(price('save')-1);expect(state.run.totalPixelsGenerated).toBe(generated);
  expect(seedReplayQuote(state).items).toEqual([]);expect(buildKnownSeed(state,now+2)).toBe(state);
  state=buildKnownSeed(creditPixels(state,1),now+3);expect(state.run.seed.built).toEqual(['border','save']);expect(state.resources.pixels).toBe(0);
  expect(state.run.seed.history.map(entry=>entry.item)).toEqual(['border','save']);
 });
 it('初めてのUIは普通に作るまで止まり、その後は続きの既知の部分をまとめられる',()=>{
  let state=knownOnly(repeat(1e9),['border','save','font']);
  state=buildKnownSeed(state,now);expect(state.run.seed.built).toEqual(['border','save']);expect(seedReplayQuote(state).items).toEqual([]);
  state=buildSeed(state,'color',now+1);expect(seedReplayQuote(state).items).toEqual(['font']);
  state=buildKnownSeed(state,now+2);expect(state.run.seed.built).toEqual(['border','save','color','font']);
  expect(seedReplayQuote(state).remaining).toEqual([]);
 });
 it('9つ分の代金を払って普通のエディタ起動へ入り、完成品やカーソルやトークンを付けない',()=>{
  const total=BALANCE.w1.items.reduce((sum,item)=>sum+item.cost,0),initial=repeat(total+7),before=structuredClone(initial);
  const quote=seedReplayQuote(initial);expect(quote).toEqual({items:allIds,cost:total,remaining:allIds,totalCost:total});expect(initial).toEqual(before);
  let manual=initial;for(const id of allIds)manual=buildSeed(manual,id,now+1);
  const next=buildKnownSeed(initial,now+1);expect(next).toEqual(manual);
  expect(next.run.world).toBe('kumiki');expect(next.run.workshop.enterMs).toBe(BALANCE.workshop.enterMs);expect(next.run.seed.built).toEqual(allIds);
  expect(next.resources.pixels).toBe(7);expect(next.run.seed.autoCursors).toBe(0);expect(next.resources.tokens).toBe(initial.resources.tokens);
  expect(next.run.workshop.parts).toEqual({});expect(next.run.workshop.purchasedSets).toEqual([]);
  expect(next.run.seed.history.map(entry=>entry.item)).toEqual(allIds);expect(isGameState(next)).toBe(true);expect(decodeSave(encodeSave(next))).toEqual(next);
  expect(buildKnownSeed(next,now+2)).toBe(next);
 });
 it('受託案件で飛ばすカラーは無料完成せず、通常の解放順と同じ8つを作る',()=>{
  const state=repeat(1e9);state.run.play.contract={id:'no-color',status:'active'};
  const expected=allIds.filter(id=>id!=='color');expect(seedReplayQuote(state).items).toEqual(expected);
  const next=buildKnownSeed(state,now+1);expect(next.run.seed.built).toEqual(expected);expect(next.run.seed.built).not.toContain('color');expect(next.run.world).toBe('kumiki');
 });
 it('出口前・再起動中・進行できない画面では資金も履歴も変えない',()=>{
  const state=repeat(1e9);
  for(const blocked of [{...state,run:{...state.run,restartMs:1}}, {...state,run:{...state.run,seed:{...state.run.seed,installer:{items:['border' as const],elapsedMs:0}}}}, {...state,run:{...state.run,world:'desktop' as const}}]){
   expect(seedReplayQuote(blocked).items).toEqual([]);expect(buildKnownSeed(blocked,now)).toBe(blocked);
  }
 });
});
