import type {I18n} from '../content/i18n';
import type {ProducedChrome,WindowSymbol} from '../systems/commonChrome';
import {producedControlSide} from '../systems/commonChrome';
import {LineIcon} from './desktop-icons';
export function CommonWindowControls({chrome,side,maximized,i18n,onAction}:{chrome:ProducedChrome|null;side:'start'|'end';maximized:boolean;i18n:I18n;onAction:(symbol:WindowSymbol)=>void}){
 const symbols=chrome?.symbols??['minimize','maximize','close'];
 const shown=symbols.filter(symbol=>chrome?producedControlSide(chrome,symbol)===side:side==='end');
 if(!shown.length)return null;
 return <div className={`window-controls produced-controls-${side}`} data-produced-controls={side}>{shown.map(symbol=><button key={symbol} className={`${symbol==='close'?'window-close':''} ${chrome?.design.symbolShape==='square'?'produced-square':''}`} style={chrome?{color:chrome.design.controlColors[symbol]??(chrome.customColors?chrome.design.textColor:undefined)}:undefined} aria-label={i18n.t(`desktop.${symbol==='maximize'&&maximized?'restore':symbol}`)} onClick={()=>onAction(symbol)}><LineIcon kind={symbol==='maximize'&&maximized?'restore':symbol}/></button>)}</div>;
}
