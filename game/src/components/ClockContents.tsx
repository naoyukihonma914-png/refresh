import type {ReactNode} from 'react';
import type {I18n} from '../content/i18n';

// Use the same content for the app and its minimum-size ruler.
export function ClockFace({i18n,now}:{i18n:I18n;now:number}){
 return <div className="clock-face"><h2>{i18n.t('clock.now')}</h2><div className="clock-time">{i18n.time(now)}</div><p>{i18n.date(now)}</p></div>;
}
export function ClockTimerContents({i18n,at='',onAt,onReserve,disabled=true,children}:{i18n:I18n;at?:string;onAt?:(value:string)=>void;onReserve?:()=>void;disabled?:boolean;children?:ReactNode}){
 const Field=onAt?'label':'div';
 return <div className="clock-timer"><h2>{i18n.t('clock.timer')}</h2><Field className="clock-time-field">{i18n.t('clock.reserveAt')}<input type="text" inputMode="numeric" size={Math.max(20,i18n.t('clock.timeExample').length+4)} placeholder={i18n.t('clock.timeExample')} aria-label={onAt?i18n.t('clock.reserveAt'):undefined} value={at} readOnly={!onAt} onChange={e=>onAt?.(e.target.value)}/></Field><button className="win-button accent" disabled={disabled} onClick={onReserve}>{i18n.t('clock.reserve')}</button>{children}<p className="muted">{i18n.t('clock.offline')}</p></div>;
}
