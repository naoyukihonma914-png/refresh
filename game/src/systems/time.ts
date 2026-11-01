import {advanceStray} from './longPlay';
import { advanceDesktopTime } from './desktop';
import { BALANCE } from '../config/balance';
import { advanceHomeGeneration } from './economy';
import type { GameState } from './state';
import { advanceSeedInstaller, updateSeedGuide } from './seed';
import { advanceKumikiTimers } from './kumiki';
import { advanceShipping } from './release';

export interface TimeResult {
  state: GameState;
  elapsedMs: number;
  creditedMs: number;
  pixels: number;
  capped: boolean;
  remainderMs: number;
}

export function isInactiveGap(monotonicElapsedMs: number, wallElapsedMs: number): boolean {
  const { inactivityGapMs, clockDriftToleranceMs } = BALANCE.time;
  return monotonicElapsedMs >= inactivityGapMs
    || (wallElapsedMs >= inactivityGapMs && wallElapsedMs - monotonicElapsedMs >= clockDriftToleranceMs);
}

function applyTime(state: GameState, elapsedMs: number, creditedMs: number, capped: boolean): TimeResult {
  const generated = advanceHomeGeneration(state, creditedMs);
  const pixels = generated.resources.pixels - state.resources.pixels;
  return {
    state: { ...generated, elapsedMs: state.elapsedMs + creditedMs },
    elapsedMs, creditedMs, pixels, capped, remainderMs: 0,
  };
}

// 能動時間は端末時計も保存された時刻も参照しない。
// runtime が performance.now() の差と、前回の端数を渡す。
export function advanceActiveTime(state: GameState, elapsedMs: number, language='ja', captures=true): TimeResult {
  if (!Number.isFinite(elapsedMs)) throw new Error('Invalid active duration');
  const elapsed = Math.max(0, elapsedMs);
  const creditedMs = Math.floor(elapsed / BALANCE.time.tickMs) * BALANCE.time.tickMs;
  if (state.run.world === 'release') return { state: advanceShipping(state, creditedMs), elapsedMs: elapsed, creditedMs, pixels: 0, capped: false, remainderMs: elapsed - creditedMs };
  const result = applyTime(state, elapsed, creditedMs, false);
  const next = advanceStray(advanceSeedInstaller(result.state, creditedMs),creditedMs);
  const progressed = ['kumiki','desktop'].includes(next.run.world) ? advanceKumikiTimers(next, creditedMs) : updateSeedGuide(next);
  const desktop = advanceDesktopTime(progressed, creditedMs, state.lastTickAt + creditedMs,false,language,captures);
  return { ...result, state: { ...desktop, run: { ...desktop.run, restartMs: Math.max(0, desktop.run.restartMs - creditedMs) } }, remainderMs: elapsed - creditedMs };
}

// 閉じていた・裏のタブだった時間だけ、端末時計の差で計算する。
export function advanceOfflineTime(state: GameState, wallNow: number, language='ja', captures=true): TimeResult {
  if (!Number.isFinite(wallNow) || wallNow < 0) throw new Error('Invalid wall time');
  const elapsedMs = Math.max(0, wallNow - state.lastTickAt);
  if (state.run.world === 'release') return { state: { ...state, lastTickAt: wallNow }, elapsedMs, creditedMs: 0, pixels: 0, capped: false, remainderMs: 0 };
  const limit = BALANCE.spec.storage[state.persistent.specs.storage]!.offlineHours
    * BALANCE.time.millisecondsPerHour;
  const creditedMs=Math.min(elapsedMs,limit),end=state.lastTickAt+creditedMs,reservation=state.run.desktop.reservation;
  let source=state;
  if(reservation&&!reservation.done&&reservation.at>end&&reservation.at<=wallNow){
    source={...state,run:{...state.run,desktop:{...state.run.desktop,reservation:{...reservation,done:true,result:'expired'}}}};
  }
  // Split once at the reservation so its recorded screen contains only pixels earned by that time.
  const first=reservation&&!reservation.done&&reservation.at>state.lastTickAt&&reservation.at<=end?reservation.at-state.lastTickAt:creditedMs;
  const result=applyTime(source,elapsedMs,first,elapsedMs>limit);
  result.state=advanceDesktopTime(result.state,first,Math.min(wallNow,state.lastTickAt+first),true,language,captures);
  if(first<creditedMs){result.state=applyTime(result.state,creditedMs-first,creditedMs-first,false).state;result.state=advanceDesktopTime(result.state,creditedMs-first,end,true,language,captures);}
  result.creditedMs=creditedMs;
  // 時計が戻った差は0にし、次回の不在は現在の時計を基準にする。
  return { ...result, pixels:result.state.resources.pixels-state.resources.pixels, state: { ...result.state, lastTickAt: wallNow,
    run: { ...result.state.run,play:{...result.state.run.play,stray:{...result.state.run.play.stray,lifeMs:Math.max(0,result.state.run.play.stray.lifeMs-elapsedMs)},clock:{...result.state.run.play.clock,count:elapsedMs>0?0:result.state.run.play.clock.count}}, seed: { ...result.state.run.seed, lastActionAt: result.state.elapsedMs }, kumiki: { ...result.state.run.kumiki, lastActionAt: result.state.elapsedMs } },
  } };
}
