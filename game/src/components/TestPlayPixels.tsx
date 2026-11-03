import {BALANCE} from '../config/balance';
import type {I18n} from '../content/i18n';
import type {GameRuntime} from '../systems/runtime';
import type {GameState} from '../systems/state';
import './ExampleSettings.css';

/** Test-play only: grants a huge pile of pixels so the playtester can push ahead freely. Remove with its call sites before release. */
export function TestPlayPixels({state,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}) {
 return <fieldset className="example-settings" data-testplay-pixels><legend>{i18n.t('testplay.title')}</legend><p>{i18n.t('testplay.description')}</p><button type="button" onClick={runtime.addTestPlayPixels}>{i18n.t('testplay.addPixels',{count:i18n.integer(BALANCE.debug.testPlayPixels)})}</button><p>{i18n.t('testplay.balance',{count:i18n.integer(Math.floor(state.resources.pixels))})}</p></fieldset>;
}
