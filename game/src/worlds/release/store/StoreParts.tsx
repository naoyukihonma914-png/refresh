import type { CSSProperties, RefObject } from 'react';
import type { I18n } from '../../../content/i18n';
import type { ProductRecord } from '../../../systems/releaseState';
import type { Screenshot } from '../../../systems/desktopState';
import type { GameRuntime, RuntimeSnapshot } from '../../../systems/runtime';
import { PixelArt, ProductGlyph } from '../../desktop-icons';
import { paletteFor } from '../../../content/kumikiArt';
import { ScreenshotPreview } from '../../Desktop';
import { ProductPreview } from '../ProductPreview';

export type StoreSection = 'about' | 'reviews';
export interface StoreView {
  runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n; product: ProductRecord;
  generation: 1 | 2 | 3; prototype: boolean; title: string; publisher: string; topic: string;
  description: string; published: string; downloads: number; purchases: number; complete: boolean;
  reviewRatings: readonly number[]; averageRating: number;
  photos: Screenshot[]; photo: Screenshot | undefined; catalog: Screenshot[]; selected: number;
  section: StoreSection; selectPhoto: (index: number) => void; jump: (section: StoreSection) => void;
  top: () => void; topRef: RefObject<HTMLElement | null>; aboutRef: RefObject<HTMLElement | null>; reviewsRef: RefObject<HTMLElement | null>;
}
export const storeClasses = (view: StoreView) => `store-page store-generation-${view.generation} ${view.prototype ? 'store-freeware' : 'store-archive'}`;
export function StoreBrand({view}: {view: StoreView}) {
  const {i18n,prototype}=view;
  return <header ref={view.topRef} className="store-header"><strong>{i18n.t(prototype?'store.freeware':'store.archive')}</strong><span>{i18n.t('store.category')}</span><b>{i18n.t('store.details')}</b></header>;
}
export function StoreBreadcrumb({view}: {view: StoreView}) {
  const {i18n}=view;
  return <nav className="store-breadcrumb" aria-label={i18n.t('store.navigation')}><button onClick={view.top}>{i18n.t(view.prototype?'store.freeware':'store.archive')}</button><span aria-hidden="true" className="store-path-separator"/><span>{i18n.t('store.category')}</span><span aria-hidden="true" className="store-path-separator"/><span>{view.topic}</span></nav>;
}
export function StoreIcon({view}: {view: StoreView}) {
  const icon=view.product.exports.find(work=>work.kind==='icon');
  return <div className="store-product-icon" aria-hidden="true">{icon?<PixelArt frames={icon.frames} size={icon.size} palette={paletteFor(view.product.screen.specs.color)}/>:<ProductGlyph/>}</div>;
}
export function StoreTitle({view}: {view: StoreView}) {
  return <div className="store-title-copy"><h1 data-store-info="title">{view.title}</h1>{view.product.author!==null&&<p className="store-author" data-store-info="author">{view.i18n.t('store.by',{author:view.product.author})}</p>}<p className="store-heading-topic">{view.topic}</p></div>;
}
export function StoreJumpLinks({view}: {view: StoreView}) {
  const {i18n}=view;
  return <nav className="store-navigation" aria-label={i18n.t('store.navigation')}><button aria-current={view.section==='about'?'location':undefined} onClick={()=>view.jump('about')}>{i18n.t('store.about')}</button><button aria-current={view.section==='reviews'?'location':undefined} onClick={()=>view.jump('reviews')}>{i18n.t('store.reviews',{count:view.reviewRatings.length})}</button></nav>;
}
export function StoreMedia({view}: {view: StoreView}) {
  return <section className="store-media" aria-label={view.i18n.t('store.screenshots')} data-store-info="screenshots" data-store-info-value={JSON.stringify(view.photos.map(shot=>shot.id))}><div className="store-hero">{view.photo?<ScreenshotPreview shot={view.photo} catalog={view.catalog} runtime={view.runtime} snapshot={view.snapshot} i18n={view.i18n}/>:<div className="store-home-media"><ProductPreview product={view.product} runtime={view.runtime} snapshot={view.snapshot} i18n={view.i18n}/></div>}</div>{view.photos.length>1&&<div className="store-photo-list store-photos" data-store-photo-choices="true">{view.photos.map((shot,index)=><button key={shot.id} aria-label={view.i18n.t('store.photoNumber',{count:index+1})} aria-pressed={view.selected===index} onClick={()=>view.selectPhoto(index)}><ScreenshotPreview shot={shot} catalog={view.catalog} runtime={view.runtime} snapshot={view.snapshot} i18n={view.i18n}/></button>)}</div>}</section>;
}
export function StoreDescription({view}: {view: StoreView}) {
  return <section ref={view.aboutRef} className="store-about"><h2>{view.i18n.t('store.about')}</h2><p className="store-description" data-store-info="description">{view.description}</p></section>;
}
export function StoreReleaseDetails({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section className="store-release-information"><h2>{i18n.t('store.details')}</h2><table className="store-information-table" data-store-info="release-details" data-store-info-value={JSON.stringify({published:view.product.releasedAt,topic:view.topic,languages:i18n.t('store.languageList')})}><tbody><tr><th scope="row">{i18n.t('store.published')}</th><td>{view.published}</td></tr><tr><th scope="row">{i18n.t('store.topic')}</th><td>{view.topic}</td></tr><tr><th scope="row">{i18n.t('store.languages')}</th><td>{i18n.t('store.languageList')}</td></tr></tbody></table></section>;
}
export function StorePurchase({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section className="store-purchase-summary"><h2>{i18n.t('store.purchaseSummary')}</h2><table data-store-info="revenue-counts" data-store-info-value={JSON.stringify({version:view.product.version,published:view.product.releasedAt,downloads:view.downloads,purchases:view.prototype?null:view.purchases,reviews:view.reviewRatings.length})}><tbody><tr><th scope="row">{i18n.t('release.version')}</th><td>{view.prototype?i18n.t('release.prototype'):i18n.t('release.version.v1')}</td></tr><tr><th scope="row">{i18n.t('store.published')}</th><td>{view.published}</td></tr><tr><th scope="row">{i18n.t('store.record.downloads')}</th><td data-store-downloads={view.downloads}>{i18n.t('store.downloads',{count:view.downloads})}</td></tr>{!view.prototype&&<tr><th scope="row">{i18n.t('store.record.purchases')}</th><td data-store-purchases={view.purchases}>{i18n.t('store.purchases',{count:view.purchases})}</td></tr>}<tr><th scope="row">{i18n.t('store.record.reviews')}</th><td>{i18n.t('store.reviews',{count:view.reviewRatings.length})}</td></tr></tbody></table>{!view.complete&&<p role="status" className="store-orders-pending">{i18n.t('store.ordersPending')}</p>}<div className="store-sales-action"><button className="store-view-sales" data-store-action="sales" disabled={!view.complete} onClick={view.runtime.showShipping}>{i18n.t('store.viewSales')}</button></div></section>;
}
export function StoreEnvironment({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section className="store-environment"><h2>{i18n.t('store.environment')}</h2><table className="store-information-table" data-store-info="environment" data-store-info-value={JSON.stringify({color:view.product.screen.specs.color,resolution:view.product.screen.specs.resolution,refresh:view.product.screen.specs.refresh,languages:i18n.t('store.languageList')})}><tbody>{(['color','resolution','refresh'] as const).map(key=><tr key={key}><th scope="row">{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,view.product.screen.specs[key])}</td></tr>)}<tr><th scope="row">{i18n.t('store.languages')}</th><td>{i18n.t('store.languageList')}</td></tr></tbody></table></section>;
}
export function StorePublisher({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section className="store-publisher"><h2>{i18n.t('store.publisherInformation')}</h2><table className="store-information-table" data-store-info="publisher"><tbody>{view.product.author!==null&&<tr><th scope="row">{i18n.t('release.author')}</th><td>{view.product.author}</td></tr>}<tr><th scope="row">{i18n.t('store.publisher')}</th><td>{view.publisher}</td></tr></tbody></table></section>;
}
export function StoreRating({view}: {view: StoreView}) {
  return <p className="store-rating-summary" data-store-info="rating-summary"><span className="store-rating-stars" aria-hidden="true" style={{'--store-rating-fill':`${view.averageRating/5*100}%`} as CSSProperties}/><span>{view.i18n.t('store.ratingSummary',{rating:view.i18n.number(view.averageRating),count:view.reviewRatings.length})}</span></p>;
}
export function StoreTags({view}: {view: StoreView}) {
  return <div className="store-tags"><span>{view.topic}</span><span>{view.i18n.t('store.languageList')}</span></div>;
}
export function StoreReviews({view}: {view: StoreView}) {
  const {i18n}=view;
  return <section ref={view.reviewsRef} className="store-reviews" data-store-info="reviews" data-store-info-value={JSON.stringify(view.reviewRatings)}><h2>{i18n.t('store.reviews',{count:view.reviewRatings.length})}</h2>{(['hikari','ren','maki'] as const).map((sender,index)=><article key={sender}><p><b>{i18n.t('store.review.author',{author:i18n.t(`feedback.sender.${sender}`)})}</b><span className="store-stars" role="img" aria-label={i18n.t('store.review.rating',{count:view.reviewRatings[index]!})} data-stars={view.reviewRatings[index]}/><time>{view.published}</time></p><h3>{i18n.t('store.review.subject',{subject:i18n.t(view.prototype&&index===1?'store.review.prototype.title':`store.review.${sender}.title`)})}</h3><p>{i18n.t(view.prototype&&index===1?'store.review.prototype.body':`store.review.${sender}.body`)}</p></article>)}</section>;
}
export function StoreFooter({view}: {view: StoreView}) {
  return <footer className="store-footer"><span>{view.publisher}</span><button onClick={view.top}>{view.i18n.t('store.backToTop')}</button></footer>;
}
export function StoreCapsule({view}: {view: StoreView}) {
  return <div className="store-capsule" aria-label={view.i18n.t('store.currentScreen')}><ProductPreview product={view.product} runtime={view.runtime} snapshot={view.snapshot} i18n={view.i18n}/></div>;
}
