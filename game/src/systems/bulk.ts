import {BALANCE} from '../config/balance';
import {bulkVisible,type BulkMode} from './longPlay';
import type {GameState} from './state';
export function bulkQuote(s:GameState,base:number,growth:number,owned:number,limit:number=BALANCE.longPlay.cursorLimit,mode:BulkMode=bulkVisible(s)?s.persistent.progress.bulk:'one'){
 const target=Math.min(limit-owned,mode==='ten'?10:mode==='max'?limit:1);let count=0,cost=0;
 for(let n=0;n<target;n++){const price=Math.ceil(base*growth**(owned+n));if(!Number.isFinite(price)||!Number.isFinite(cost+price))break;if(mode==='max'&&cost+price>s.resources.pixels)break;cost+=price;count++;}
 return {count,cost};
}
