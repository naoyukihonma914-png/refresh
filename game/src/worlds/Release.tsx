import type { I18n } from '../content/i18n';
import { shippingProduct } from '../systems/release';
import { releasePresentation } from '../systems/releasePresentation';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { GenerationOneReport } from './release/shipping/GenerationOneReport';
import { GenerationTwoReport } from './release/shipping/GenerationTwoReport';
import { GenerationThreeReport } from './release/shipping/GenerationThreeReport';
import { reportModel } from './release/shipping/ReportParts';

export function Release(props:{runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n}) {
  const product=shippingProduct(props.snapshot.state);
  if(!product||!props.snapshot.state.run.shipping)return null;
  const context={...props,product},report=reportModel(context),generation=releasePresentation(product).generation;
  if(generation===1)return <GenerationOneReport {...context} report={report}/>;
  if(generation===2)return <GenerationTwoReport {...context} report={report}/>;
  return <GenerationThreeReport {...context} report={report}/>;
}
