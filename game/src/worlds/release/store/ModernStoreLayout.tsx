import { ModernStoreMedia } from './ModernStoreMedia';
import { ModernStoreRevenue, ModernStoreSalesAction } from './ModernStorePurchase';
import { StoreBrand, StoreBreadcrumb, StoreDescription, StoreEnvironment, StoreFooter, StoreIcon, StoreJumpLinks, StorePublisher, StoreRating, StoreReleaseDetails, StoreReviews, StoreTags, StoreTitle, storeClasses, type StoreView } from './StoreParts';

/** Product facts and its action stay together at the left of an open gradient hero. */
export function ModernStoreLayout({view}: {view: StoreView}) {
  return <main className={storeClasses(view)} data-store-generation={view.generation} data-store-layout="modern" data-product-medium="software">
    <div className="store-modern-masthead"><div className="store-modern-chrome"><StoreBrand view={view}/><StoreJumpLinks view={view}/></div></div>
    <section className="store-modern-product-hero"><div className="store-modern-hero-inner"><StoreBreadcrumb view={view}/><div className="store-modern-introduction"><div className="store-modern-identity"><StoreIcon view={view}/><div className="store-modern-title-rating"><StoreTitle view={view}/><StoreRating view={view}/></div></div><StoreTags view={view}/><StoreDescription view={view}/><ModernStoreSalesAction view={view}/></div></div></section>
    <div className="store-modern-content-rail"><article className="store-modern-editorial"><div className="store-modern-media-strip"><h2>{view.i18n.t('store.screenshots')}</h2><ModernStoreMedia view={view}/></div><StoreReviews view={view}/></article><aside className="store-modern-facts"><StoreEnvironment view={view}/><StorePublisher view={view}/><StoreReleaseDetails view={view}/><ModernStoreRevenue view={view}/></aside></div>
    <div className="store-modern-footer"><StoreFooter view={view}/></div>
  </main>;
}
