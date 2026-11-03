import type {I18n} from '../content/i18n';
import type {GameRuntime} from '../systems/runtime';
import type {GameState} from '../systems/state';
import './ExampleSettings.css';

/** Optional shortcut: fit a tray part into its recess with a double-click instead of dragging. Off by default. */
export function DoubleClickFitSettings({state,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}) {
 return <fieldset className="example-settings" data-double-click-fit-setting><legend>{i18n.t('examples.seed.tray')}</legend><label><input data-double-click-fit-input type="checkbox" checked={state.persistent.doubleClickFit} onChange={event=>runtime.setDoubleClickFit(event.target.checked)}/>{i18n.t('examples.seed.doubleClickFit')}</label><p>{i18n.t('examples.seed.doubleClickFitDescription')}</p></fieldset>;
}
