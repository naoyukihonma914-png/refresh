import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, getWorkshopPart, type WorkshopPartId, type WorkshopRect } from '../content/workshopCatalog';
import type { GameState } from './state';
import { partRectValid } from './workshop';
import type { WorkshopCombo } from './workshopState';

export function setExamplesEnabled(state:GameState,enabled:boolean):GameState {
 return typeof enabled!=='boolean'||enabled===state.persistent.examplesEnabled?state:{...state,persistent:{...state.persistent,examplesEnabled:enabled}};
}

export function setDoubleClickFit(state:GameState,enabled:boolean):GameState {
 return typeof enabled!=='boolean'||enabled===state.persistent.doubleClickFit?state:{...state,persistent:{...state.persistent,doubleClickFit:enabled}};
}

/** Only an explicitly requested first placement can use the optional example. */
export function examplePlacement(state:GameState,id:WorkshopPartId,rect:WorkshopRect):{rect:WorkshopRect;snapped:boolean} {
 if(!state.persistent.examplesEnabled||state.run.workshop.parts[id]?.step!==0||!WORKSHOP_PARTS.some(part=>part.id===id)
   ||!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))return {rect,snapped:false};
 const target=getWorkshopPart(id).defaultRect,keys=['x','y','width','height'] as const;
 if(!keys.every(key=>Math.abs(rect[key]-target[key])<=BALANCE.workshop.examples.snapDistance)||!partRectValid(state,id,target))return {rect,snapped:false};
 return {rect:{...target},snapped:true};
}

/** The existing completed count affects the next payment, independently of examples/design. */
export function workshopComboMultiplier(state:GameState,now:number):number {
 const combo=state.run.workshop.combo;
 if(!combo||combo.count===0||combo.lastCompletedAt===null||!Number.isFinite(now)||now<combo.lastCompletedAt||now-combo.lastCompletedAt>BALANCE.workshop.examples.comboWindowMs)return 1;
 return 1+Math.min(BALANCE.workshop.examples.comboMaxBonus,combo.count*BALANCE.workshop.examples.comboStepBonus);
}

/** Called after paying the fourth step, so the completion cannot boost itself. */
export function completionCombo(state:GameState,now:number):WorkshopCombo {
 const combo=state.run.workshop.combo,continues=combo&&combo.count>0&&combo.lastCompletedAt!==null&&now>=combo.lastCompletedAt&&now-combo.lastCompletedAt<=BALANCE.workshop.examples.comboWindowMs;
 return {count:continues?Math.min(Number.MAX_SAFE_INTEGER,combo.count+1):1,lastCompletedAt:now};
}
