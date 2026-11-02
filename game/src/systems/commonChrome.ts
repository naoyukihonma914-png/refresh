import {createComponentDesign,type ComponentDesign} from './workshopState';
import type {GameState} from './state';
export type WindowSymbol='minimize'|'maximize'|'close';
export interface ProducedChrome {design:ComponentDesign;symbols:WindowSymbol[];custom:boolean}
export function producedWindowChrome(s:GameState):ProducedChrome|null {
 const p=s.run.workshop.parts['common-frame'];if(p?.step!==4)return null;
 return {design:p.design,symbols:p.elements.filter((e):e is WindowSymbol=>['minimize','maximize','close'].includes(e)),custom:JSON.stringify(p.design)!==JSON.stringify(createComponentDesign())};
}
export function producedControlSide(chrome:ProducedChrome,symbol:WindowSymbol):'start'|'end'{return chrome.design.controlSides[symbol]??chrome.design.controlSide;}
