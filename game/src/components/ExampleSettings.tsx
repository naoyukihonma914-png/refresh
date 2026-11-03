import type {I18n} from '../content/i18n';
import type {GameRuntime} from '../systems/runtime';
import type {GameState} from '../systems/state';
import './ExampleSettings.css';

/** Examples are an optional building aid, separate from the publisher's comments. */
export function ExampleSettings({state,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}) {
 return <fieldset className="example-settings" data-examples-setting><legend>{i18n.t('examples.settingsTitle')}</legend><label><input data-examples-input type="checkbox" checked={state.persistent.examplesEnabled} onChange={event=>runtime.setExamplesEnabled(event.target.checked)}/>{i18n.t('examples.enabled')}</label><p>{i18n.t('examples.description')}</p></fieldset>;
}
