import { StoreBrand, StoreBreadcrumb, StoreDescription, StoreEnvironment, StoreFooter, StoreIcon, StoreJumpLinks, StoreMedia, StorePublisher, StorePurchase, StoreRating, StoreReleaseDetails, StoreReviews, StoreTitle, storeClasses, type StoreView } from './StoreParts';

/** The compact software directory stays a bordered, single-column document. */
export function ClassicStoreLayout({view}: {view: StoreView}) {
  return <main className={storeClasses(view)} data-store-generation={view.generation} data-store-layout="classic" data-product-medium="software"><div className="store-shell">
    <StoreBrand view={view}/><StoreBreadcrumb view={view}/>
    <div className="store-sheet"><header className="store-product-heading"><StoreIcon view={view}/><StoreTitle view={view}/></header><StoreJumpLinks view={view}/>
      <div className="store-content-grid"><div className="store-main-column"><StoreMedia view={view}/><StoreDescription view={view}/><StoreReleaseDetails view={view}/><StorePurchase view={view}/><StoreEnvironment view={view}/><StorePublisher view={view}/><StoreRating view={view}/><StoreReviews view={view}/></div></div>
    </div><StoreFooter view={view}/>
  </div></main>;
}
