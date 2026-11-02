import { LegacyCapturePreview } from '../../LegacyCapturePreview';
import { ProductPreview } from '../ProductPreview';
import type { StoreView } from './StoreParts';

/** Large adjacent screenshots expose the next picture through native horizontal scrolling. */
export function ModernStoreMedia({view}: {view: StoreView}) {
  const multiple=view.photos.length>1;
  return <section className="store-media store-modern-gallery" aria-label={view.i18n.t('store.screenshots')} data-store-info="screenshots" data-store-info-value={JSON.stringify(view.photos.map(shot=>shot.id))}>
    <div className="store-modern-carousel" data-store-photo-choices={multiple?true:undefined} tabIndex={multiple?0:undefined} role={multiple?'region':undefined} aria-label={multiple?view.i18n.t('store.screenshots'):undefined}>
      {multiple?view.photos.map((shot,index)=><button className="store-modern-media-card" key={shot.id} aria-label={view.i18n.t('store.photoNumber',{count:index+1})} aria-pressed={view.selected===index} onClick={()=>view.selectPhoto(index)}><LegacyCapturePreview shot={shot} catalog={view.catalog} i18n={view.i18n}/></button>):<div className="store-modern-media-card store-hero">{view.photo?<LegacyCapturePreview shot={view.photo} catalog={view.catalog} i18n={view.i18n}/>:<div className="store-home-media"><ProductPreview product={view.product} i18n={view.i18n}/></div>}</div>}
    </div>
  </section>;
}
