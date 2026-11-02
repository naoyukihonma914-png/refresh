import type { CSSProperties } from 'react';
import { BALANCE } from '../config/balance';
import type { WorkshopPartId } from '../content/workshopCatalog';
import { readableText } from '../systems/appLayout';
import type { GameState } from '../systems/state';
import { colorContrast, createComponentDesign, usesNativeComponentColors } from '../systems/workshopState';
import './shell-parts.css';

export type ShellPartId=Extract<WorkshopPartId,`foundation-${string}`>;
export interface ShellPartProps {
 'data-shell-part'?:ShellPartId;
 'data-shell-colors'?:boolean;
 'data-shell-radius'?:boolean;
 'data-shell-font'?:boolean;
 'data-shell-shadow'?:boolean;
 style?:CSSProperties;
}
/** Applies selected surface attributes only. Production rectangles are never desktop geometry. */
export function shellPartProps(state:GameState,id:ShellPartId,extraStyle?:CSSProperties):ShellPartProps {
 const production=state.run.workshop.parts[id];
 if(production?.step!==4)return extraStyle?{style:extraStyle}:{};
 const design=production.design,defaults=createComponentDesign();
 const colors=!usesNativeComponentColors(design),radius=design.radius!==defaults.radius,font=design.fontSize!==defaults.fontSize,shadow=design.shadow!==defaults.shadow;
 const foreground=colorContrast(design.color,design.textColor)>=BALANCE.workshop.design.minContrast?design.textColor:readableText(design.color);
 const chosen={...(colors?{'--shell-part-bg':design.color,'--shell-part-text':foreground}:{}),...(radius?{'--shell-part-radius':`${design.radius}px`}:{}),...(font?{'--shell-part-font':`${design.fontSize}px`}:{}),...(shadow?{'--shell-part-shadow':'1px 1px 2px #0006'}:{})};
 return {'data-shell-part':id,'data-shell-colors':colors||undefined,'data-shell-radius':radius||undefined,'data-shell-font':font||undefined,'data-shell-shadow':shadow||undefined,...(extraStyle||Object.keys(chosen).length?{style:{...extraStyle,...chosen} as CSSProperties}:{})};
}
