import {createComponentDesign,usesNativeComponentColors,type ComponentDesign} from './workshopState';
import type {GameState} from './state';
export type WindowSymbol='minimize'|'maximize'|'close';
export interface ProducedChrome {design:ComponentDesign;symbols:WindowSymbol[];custom:boolean;customColors:boolean}
export function producedWindowChrome(s:GameState):ProducedChrome|null {
 const p=s.run.workshop.parts['common-frame'];if(p?.step!==4)return null;
 const defaults=createComponentDesign();
 const customColors=!usesNativeComponentColors(p.design);
 return {design:p.design,symbols:p.elements.filter((e):e is WindowSymbol=>['minimize','maximize','close'].includes(e)),custom:JSON.stringify({...defaults,...p.design,nativeColors:!customColors})!==JSON.stringify(defaults),customColors};
}
export function producedControlSide(chrome:ProducedChrome,symbol:WindowSymbol):'start'|'end'{return chrome.design.controlSides[symbol]??chrome.design.controlSide;}
