import type { I18n } from '../../content/i18n';
import type { ProductRecord } from '../../systems/releaseState';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { LegacyCapturePreview, WorkshopSnapshot } from '../LegacyCapturePreview';

/** Published previews never instantiate a live game or an obsolete drawing editor. */
export function ProductPreview({product,i18n}:{product:ProductRecord;runtime?:GameRuntime;snapshot?:RuntimeSnapshot;i18n:I18n}) {
  if(product.capture)return <div className="product-preview product-desktop-preview"><LegacyCapturePreview shot={product.capture} catalog={[...(product.captureCatalog??[]),...(product.screenshots??[]),product.capture]} i18n={i18n}/></div>;
  return <div className="product-preview product-preview-static" role="img" aria-label={i18n.t('release.preview')}><div className="capture-product-stage" inert aria-hidden="true">
    {product.screen.workshop&&product.screen.editorCustomization?<WorkshopSnapshot workshop={product.screen.workshop} customization={product.screen.editorCustomization} stage={product.screen.editorStage??0} now={product.releasedAt} i18n={i18n}/>:<div className="capture-product-legacy"><h2>{product.name??i18n.t('release.preview')}</h2><p>{i18n.t('release.summary',{built:product.builtCount,icons:product.exports.length})}</p><p>{i18n.t('foundation.pixels',{pixels:i18n.pixels(product.generatedPixels)})}</p><p><b>{i18n.t('release.version')}</b> {product.version}</p></div>}
  </div></div>;
}
