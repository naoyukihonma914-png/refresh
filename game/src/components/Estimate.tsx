import { useEffect, useRef, useState } from 'react';
import { BALANCE } from '../config/balance';
import type { I18n } from '../content/i18n';
import type { GameRuntime } from '../systems/runtime';
import { estimateSeconds } from '../systems/estimate';
export function Estimate({cost,pixels,rate,i18n,runtime,preview=false}: {cost:number;pixels:number;rate:number;i18n:I18n;runtime:GameRuntime;preview?:boolean}) {
  const seconds=estimateSeconds(cost,pixels,rate);
  const previous=useRef({seconds,rate,cost});
  const [change,setChange]=useState<{from:number;to:number}|null>(null);
  useEffect(()=>{
    const old=previous.current;
    if(!preview&&old.cost===cost&&old.seconds!==null&&seconds!==null&&rate>old.rate&&seconds<=old.seconds*(1-BALANCE.estimate.improvement))setChange({from:old.seconds,to:seconds});
    previous.current={seconds,rate,cost};
  },[cost,pixels,rate,seconds,preview]);
  useEffect(()=>{if(!change)return;const stop=runtime.platform.every(BALANCE.estimate.transitionMs,()=>{setChange(null);stop();});return stop;},[change,runtime]);
  if(seconds===null)return null;
  return <small className={`purchase-estimate ${change?'estimate-improved':''}`} aria-live={change?'polite':'off'}>{change?<><del>{i18n.t('estimate.time',{time:i18n.duration(change.from*1000)})}</del><span aria-hidden="true">{' → '}</span>{i18n.duration(change.to*1000)}</>:i18n.t('estimate.time',{time:i18n.duration(seconds*1000)})}</small>;
}
