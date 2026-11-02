import { ModernStoreMedia } from './ModernStoreMedia';
import { StoreBrand, StoreBreadcrumb, StoreCapsule, StoreDescription, StoreEnvironment, StoreFooter, StoreJumpLinks, StorePublisher, StorePurchase, StoreRating, StoreReleaseDetails, StoreReviews, StoreTags, StoreTitle, storeClasses, type StoreView } from './StoreParts';

/** Modern distribution uses an open-width product hero and a separate media strip. */
export function ModernStoreLayout({view}: {view: StoreView}) {
  return <main className={storeClasses(view)} data-store-generation={view.generation} data-store-layout="modern" data-product-medium="software">
    <div className="store-modern-masthead"><StoreBrand view={view}/></div><div className="store-modern-breadcrumb"><StoreBreadcrumb view={view}/></div>
    <section className="store-modern-product-hero"><div className="store-modern-capsule"><StoreCapsule view={view}/></div><div className="store-modern-introduction"><StoreTitle view={view}/><StoreRating view={view}/><StoreTags view={view}/></div><aside className="store-modern-order"><StorePurchase view={view}/></aside></section>
    <div className="store-modern-media-strip"><ModernStoreMedia view={view}/></div>
    <div className="store-modern-sections"><StoreJumpLinks view={view}/><div className="store-modern-body"><article className="store-modern-editorial"><StoreDescription view={view}/><StoreReviews view={view}/></article><aside className="store-modern-facts"><StoreReleaseDetails view={view}/><StoreEnvironment view={view}/><StorePublisher view={view}/></aside></div><StoreFooter view={view}/></div>
  </main>;
}
