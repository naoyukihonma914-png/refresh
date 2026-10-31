import { BALANCE } from '../config/balance';
import type { I18n } from '../content/i18n';
import type { GameState } from '../systems/state';
import type { GameRuntime } from '../systems/runtime';
export function ProductNameInput({state,runtime,i18n}: {state:GameState;runtime:GameRuntime;i18n:I18n}) {
  return <label className="product-name-field">{i18n.t('product.name')}<input value={state.persistent.productName??''} placeholder={i18n.t('product.untitled')} maxLength={BALANCE.release.maxProductName*2} onChange={e=>runtime.setProductName(e.target.value)} onBlur={runtime.persist}/></label>;
}
export function ProductSettings(props: {state:GameState;runtime:GameRuntime;i18n:I18n}) {
  const {state,runtime,i18n}=props;
  return <div className="product-settings">{state.persistent.products.length>0&&<ProductNameInput {...props}/>}<label>{i18n.t('number.label')}<select value={state.persistent.numberNotation} onChange={e=>runtime.setNumberNotation(e.target.value as 'compact'|'scientific')}>
    <option value="compact">{i18n.t('number.compact')}</option><option value="scientific">{i18n.t('number.scientific')}</option>
  </select></label></div>;
}
