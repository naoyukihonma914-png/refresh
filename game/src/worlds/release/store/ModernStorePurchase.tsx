import type { StoreView } from './StoreParts';

/** The modern hero owns the action; its existing distribution totals live in the facts rail. */
export function ModernStoreSalesAction({view}: {view: StoreView}) {
  return <div className="store-modern-sales-action"><button className="store-view-sales" data-store-action="sales" disabled={!view.complete} onClick={view.runtime.showShipping}>{view.i18n.t('store.viewSales')}</button>{!view.complete&&<p role="status" className="store-orders-pending">{view.i18n.t('store.ordersPending')}</p>}</div>;
}
export function ModernStoreRevenue({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section className="store-purchase-summary store-modern-release-totals"><h2>{i18n.t('store.purchaseSummary')}</h2><table data-store-info="revenue-counts" data-store-info-value={JSON.stringify({version:view.product.version,published:view.product.releasedAt,downloads:view.downloads,purchases:view.prototype?null:view.purchases,reviews:view.reviewRatings.length})}><tbody><tr><th scope="row">{i18n.t('release.version')}</th><td>{view.prototype?i18n.t('release.prototype'):i18n.t('release.version.v1')}</td></tr><tr><th scope="row">{i18n.t('store.published')}</th><td>{view.published}</td></tr><tr><th scope="row">{i18n.t('store.record.downloads')}</th><td data-store-downloads={view.downloads}>{i18n.t('store.downloads',{count:view.downloads})}</td></tr>{!view.prototype&&<tr><th scope="row">{i18n.t('store.record.purchases')}</th><td data-store-purchases={view.purchases}>{i18n.t('store.purchases',{count:view.purchases})}</td></tr>}<tr><th scope="row">{i18n.t('store.record.reviews')}</th><td>{i18n.t('store.reviews',{count:view.reviewRatings.length})}</td></tr></tbody></table></section>;
}
