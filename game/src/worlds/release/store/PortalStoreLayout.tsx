import { StoreBrand, StoreBreadcrumb, StoreDescription, StoreEnvironment, StoreFooter, StoreIcon, StoreJumpLinks, StoreMedia, StorePublisher, StorePurchase, StoreRating, StoreReleaseDetails, StoreReviews, StoreTags, StoreTitle, storeClasses, type StoreView } from './StoreParts';

/** A dense download storefront keeps the product visual left and its information right. */
export function PortalStoreLayout({view}: {view: StoreView}) {
  return <main className={storeClasses(view)} data-store-generation={view.generation} data-store-layout="portal" data-product-medium="software">
    <div className="store-portal-band"><div className="store-portal-brand"><StoreBrand view={view}/></div></div>
    <div className="store-portal-page"><StoreBreadcrumb view={view}/><header className="store-portal-heading"><StoreIcon view={view}/><StoreTitle view={view}/><StoreRating view={view}/></header><StoreJumpLinks view={view}/>
      <div className="store-portal-columns"><article className="store-portal-product"><div className="store-portal-visual"><StoreMedia view={view}/></div><StoreDescription view={view}/><StoreReviews view={view}/></article>
        <aside className="store-portal-rail"><StoreTags view={view}/><div className="store-portal-order"><StorePurchase view={view}/></div><StoreReleaseDetails view={view}/><StoreEnvironment view={view}/><StorePublisher view={view}/></aside>
      </div><StoreFooter view={view}/>
    </div>
  </main>;
}
