import { StoreBrand, StoreBreadcrumb, StoreDescription, StoreEnvironment, StoreFooter, StoreIcon, StoreJumpLinks, StoreMedia, StorePublisher, StorePurchase, StoreRating, StoreReleaseDetails, StoreReviews, StoreTitle, storeClasses, type StoreView } from './StoreParts';

/** A download portal puts its catalogue and technical facts in a left rail. */
export function PortalStoreLayout({view}: {view: StoreView}) {
  return <main className={storeClasses(view)} data-store-generation={view.generation} data-store-layout="portal" data-product-medium="software">
    <div className="store-portal-band"><div className="store-portal-brand"><StoreBrand view={view}/></div></div>
    <div className="store-portal-page"><StoreBreadcrumb view={view}/>
      <div className="store-portal-columns">
        <aside className="store-portal-rail"><div className="store-category-panel"><h2>{view.i18n.t('store.category')}</h2><p>{view.topic}</p></div><StoreReleaseDetails view={view}/><StoreEnvironment view={view}/><StorePublisher view={view}/></aside>
        <article className="store-portal-product"><header className="store-portal-heading"><StoreIcon view={view}/><StoreTitle view={view}/><StoreRating view={view}/></header><StoreJumpLinks view={view}/>
          <div className="store-portal-showcase"><div className="store-portal-visual"><StoreMedia view={view}/></div><aside className="store-portal-order"><StorePurchase view={view}/></aside></div>
          <StoreDescription view={view}/><StoreReviews view={view}/>
        </article>
      </div><StoreFooter view={view}/>
    </div>
  </main>;
}
