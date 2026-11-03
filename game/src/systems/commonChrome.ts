import {createComponentDesign,usesNativeComponentColors,type ComponentDesign} from './workshopState';
import type {GameState} from './state';
import { installedAssembly } from './appAssembly';
import { isBuildable } from './appLayout';
import type { AppId } from './desktopState';
import type { AppAssembly, AssemblyMaterial } from './appAssemblySchema';
import { BALANCE } from '../config/balance';
export type WindowSymbol='minimize'|'maximize'|'close';
export interface ProducedChrome {design:ComponentDesign;symbols:WindowSymbol[];custom:boolean;customColors:boolean;fitted?:boolean}
export function producedWindowChrome(s:GameState,app?:AppId):ProducedChrome|null {
 const current=s.run.workshop.parts['common-frame'];
 const p=app&&isBuildable(app)?installedAssembly(s,app)?.common.find(material=>material.source==='common-frame'):current?.step===4?current:null;
 if(!p)return null;
 const defaults=createComponentDesign();
 const customColors=!usesNativeComponentColors(p.design);
 return {design:p.design,symbols:p.elements.filter((e):e is WindowSymbol=>['minimize','maximize','close'].includes(e)),custom:JSON.stringify({...defaults,...p.design,nativeColors:!customColors})!==JSON.stringify(defaults),customColors,...(p.fitting?{fitted:true}:{})};
}
export function producedControlSide(chrome:ProducedChrome,symbol:WindowSymbol):'start'|'end'{return chrome.fitted?'end':chrome.design.controlSides[symbol]??chrome.design.controlSide;}
/** New frames own their scrollbars. Historical installed apps retain the separate material. */
export function producedScrollbarMaterial(assembly:AppAssembly|null|undefined):AssemblyMaterial|null {
 const frame=assembly?.common.find(material=>material.source==='common-frame'&&material.elements.includes('scrollbar'));
 return frame??assembly?.common.find(material=>material.source==='common-scrollbar')??null;
}
export function customizedScrollbar(assembly:AppAssembly|null|undefined):boolean {
 const design=producedScrollbarMaterial(assembly)?.design;
 return !!design&&(!usesNativeComponentColors(design)||design.scrollbarWidth!==BALANCE.workshop.design.scrollbarWidth||design.radius!==BALANCE.workshop.design.radius||!design.arrows);
}
/** A custom glyph uses the surface its contrast was validated against. Native controls retain their era styling. */
export function producedControlPalette(design:ComponentDesign,symbol:WindowSymbol):{color?:string;backgroundColor?:string}{
 if(usesNativeComponentColors(design)&&design.controlColors[symbol]===undefined)return {};
 return {color:design.controlColors[symbol]??design.textColor,backgroundColor:design.color};
}
