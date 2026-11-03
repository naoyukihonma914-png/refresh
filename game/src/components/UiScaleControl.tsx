import { BALANCE } from '../config/balance';
import type { I18n } from '../content/i18n';
import type { GameRuntime } from '../systems/runtime';

export function UiScaleControl({runtime,i18n}:{runtime:GameRuntime;i18n:I18n}) {
 const value=runtime.getSnapshot().uiScale??BALANCE.accessibility.defaultUiScale;
 return <label className="ui-scale-control">{i18n.t('settings.uiScale')}<select data-ui-scale aria-label={i18n.t('settings.uiScale')} value={value} onChange={event=>runtime.changeUiScale(Number(event.target.value))}>{BALANCE.accessibility.uiScales.map(scale=><option key={scale} value={scale}>{i18n.t('settings.uiScaleValue',{value:i18n.integer(scale*BALANCE.workshop.preview.percentDivisor)})}</option>)}</select></label>;
}
