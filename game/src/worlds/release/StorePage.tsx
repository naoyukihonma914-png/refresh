import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import { productLabel } from '../../content/products';
import { readCapture } from '../../systems/captureScene';
import { shippingProduct, storeComplete } from '../../systems/release';
import { releasePresentation } from '../../systems/releasePresentation';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { PixelArt, ProductGlyph } from '../desktop-icons';
import { paletteFor } from '../../content/kumikiArt';
import { ScreenshotPreview } from '../Desktop';
import { ProductPreview } from './ProductPreview';

export function StorePage({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot, product = shippingProduct(state)!;
  const presentation = releasePresentation(product);
  const [selected, setSelected] = useState(0), [section, setSection] = useState<'about' | 'reviews'>('about');
  const top = useRef<HTMLElement>(null), about = useRef<HTMLElement>(null), reviews = useRef<HTMLElement>(null);
  const prototype = product.version === 'v0.1';
  const photos = product.screenshots?.length ? product.screenshots : product.capture ? [product.capture] : [];
  const catalog = useMemo(() => [...(product.captureCatalog ?? []), ...(product.screenshots ?? []), ...(product.capture ? [product.capture] : [])], [product]);
  const photo = photos[Math.min(selected, Math.max(0, photos.length - 1))];
  const progress = Math.min(1, (state.run.shipping?.storeElapsedMs ?? 0) / BALANCE.release.storeAnimationMs);
  const purchases = Math.floor(product.revenue / BALANCE.release.storeUnitPrice * progress);
  const downloads = Math.floor(product.revenue * BALANCE.release.storeDownloadsPerDollar * progress);
  const title = productLabel(i18n, product.name, prototype ? i18n.t('release.prototype') : i18n.t('release.version.v1'));
  const icon = product.exports.find(work => work.kind === 'icon');
  const publisher = i18n.t('release.publisher');
  const reviewRatings = [5, 4, 5] as const;
  const averageRating = reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length;
  const topic = i18n.t(prototype ? 'store.topic.prototype' : 'store.topic.desktop');
  const jump = (target: 'about' | 'reviews') => {
    setSection(target);
    (target === 'about' ? about : reviews).current?.scrollIntoView({ block: 'start' });
  };
  const media = photo ? <ScreenshotPreview shot={photo} catalog={catalog} runtime={runtime} snapshot={snapshot} i18n={i18n} /> : <div className="store-home-media"><ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n} /></div>;
  const thumbnails = photos.length > 1 && <div className="store-photo-list store-photos">{photos.map((shot, index) => <button key={shot.id} aria-label={i18n.t('store.photoNumber', { count: index + 1 })} aria-pressed={selected === index} onClick={() => setSelected(index)}><ScreenshotPreview shot={shot} catalog={catalog} runtime={runtime} snapshot={snapshot} i18n={i18n} /></button>)}</div>;
  const purchaseSummary = <section className="store-purchase-summary"><h2>{i18n.t('store.purchaseSummary')}</h2><table><tbody><tr><th scope="row">{i18n.t('release.version')}</th><td>{prototype ? i18n.t('release.prototype') : i18n.t('release.version.v1')}</td></tr><tr><th scope="row">{i18n.t('store.published')}</th><td>{presentation.generation === 1 ? i18n.legacyDate(product.releasedAt) : i18n.date(product.releasedAt)}</td></tr><tr><th scope="row">{i18n.t('store.record.downloads')}</th><td data-store-downloads={downloads}>{i18n.t('store.downloads', { count: downloads })}</td></tr>{!prototype && <tr><th scope="row">{i18n.t('store.record.purchases')}</th><td data-store-purchases={purchases}>{i18n.t('store.purchases', { count: purchases })}</td></tr>}<tr><th scope="row">{i18n.t('store.record.reviews')}</th><td>{i18n.t('store.reviews', { count: 3 })}</td></tr></tbody></table>
              {!storeComplete(state) && <p role="status" className="store-orders-pending">{i18n.t('store.ordersPending')}</p>}<div className="store-sales-action"><button className="store-view-sales" disabled={!storeComplete(state)} onClick={runtime.showShipping}>{i18n.t('store.viewSales')}</button></div>
            </section>;
  return <main className={`store-page store-generation-${presentation.generation} ${prototype ? 'store-freeware' : 'store-archive'}`} data-store-generation={presentation.generation} data-product-medium={presentation.medium}>
    <div className="store-shell">
      <header ref={top} className="store-header"><strong>{i18n.t(prototype ? 'store.freeware' : 'store.archive')}</strong><span>{i18n.t('store.category')}</span><b>{i18n.t('store.details')}</b></header>
      <nav className="store-breadcrumb" aria-label={i18n.t('store.navigation')}><button onClick={() => top.current?.scrollIntoView({ block: 'start' })}>{i18n.t(prototype ? 'store.freeware' : 'store.archive')}</button><span aria-hidden="true" className="store-path-separator"/><span>{i18n.t('store.category')}</span><span aria-hidden="true" className="store-path-separator"/><span>{topic}</span></nav>
      <div className="store-sheet">
        <header className="store-product-heading">
          <div className="store-product-icon" aria-hidden="true">{icon ? <PixelArt frames={icon.frames} size={icon.size} palette={paletteFor(product.screen.specs.color)} /> : <ProductGlyph />}</div>
          <div><h1>{title}</h1>{product.author !== null && <p className="store-author">{i18n.t('store.by', { author: product.author })}</p>}<p className="store-heading-topic">{topic}</p></div>
        </header>
        <nav className="store-navigation" aria-label={i18n.t('store.navigation')}><button aria-current={section === 'about' ? 'location' : undefined} onClick={() => jump('about')}>{i18n.t('store.about')}</button><button aria-current={section === 'reviews' ? 'location' : undefined} onClick={() => jump('reviews')}>{i18n.t('store.reviews', { count: 3 })}</button></nav>
        <div className="store-content-grid">
          <div className="store-main-column">
            <section className="store-media" aria-label={i18n.t('store.screenshots')}><div className="store-hero">{media}</div>{thumbnails}</section>
            <section ref={about} className="store-about"><h2>{i18n.t('store.about')}</h2><p className="store-description">{i18n.t(prototype ? 'store.description.prototype' : 'store.description.desktop', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length, apps: product.capture ? 1 + readCapture(product.capture).desktop.apps.length : 0 })}</p></section>
            <section className="store-release-information"><h2>{i18n.t('store.details')}</h2><table className="store-information-table"><tbody><tr><th scope="row">{i18n.t('store.published')}</th><td>{presentation.generation === 1 ? i18n.legacyDate(product.releasedAt) : i18n.date(product.releasedAt)}</td></tr><tr><th scope="row">{i18n.t('store.topic')}</th><td>{topic}</td></tr><tr><th scope="row">{i18n.t('store.languages')}</th><td>{i18n.t('store.languageList')}</td></tr></tbody></table></section>
            {presentation.generation === 1 && purchaseSummary}
            <section className="store-environment"><h2>{i18n.t('store.environment')}</h2><table className="store-information-table"><tbody>{(['color', 'resolution', 'refresh'] as const).map(key => <tr key={key}><th scope="row">{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key, product.screen.specs[key])}</td></tr>)}<tr><th scope="row">{i18n.t('store.languages')}</th><td>{i18n.t('store.languageList')}</td></tr></tbody></table></section>
            <section className="store-publisher"><h2>{i18n.t('store.publisherInformation')}</h2><table className="store-information-table"><tbody>{product.author !== null && <tr><th scope="row">{i18n.t('release.author')}</th><td>{product.author}</td></tr>}<tr><th scope="row">{i18n.t('store.publisher')}</th><td>{publisher}</td></tr></tbody></table></section>
            <section ref={reviews} className="store-reviews"><h2>{i18n.t('store.reviews', { count: 3 })}</h2>{(['hikari', 'ren', 'maki'] as const).map((sender, index) => <article key={sender}>
              <p><b>{i18n.t('store.review.author', { author: i18n.t(`feedback.sender.${sender}`) })}</b><span className="store-stars" role="img" aria-label={i18n.t('store.review.rating', { count: reviewRatings[index]! })} data-stars={reviewRatings[index]} /><time>{presentation.generation === 1 ? i18n.legacyDate(product.releasedAt) : i18n.date(product.releasedAt)}</time></p>
              <h3>{i18n.t('store.review.subject', { subject: i18n.t(prototype && index === 1 ? 'store.review.prototype.title' : `store.review.${sender}.title`) })}</h3><p>{i18n.t(prototype && index === 1 ? 'store.review.prototype.body' : `store.review.${sender}.body`)}</p>
            </article>)}</section>
          </div>
          {presentation.generation !== 1 && <aside className="store-sidebar"><div className="store-capsule" aria-label={i18n.t('store.currentScreen')}><ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n}/></div><p className="store-side-title">{title}</p><div className="store-tags"><span>{topic}</span><span>{i18n.t('store.languageList')}</span></div><p className="store-rating-summary"><span className="store-rating-stars" aria-hidden="true" style={{'--store-rating-fill':`${averageRating / 5 * 100}%`} as CSSProperties}/><span>{i18n.t('store.ratingSummary', { rating: i18n.number(averageRating), count: reviewRatings.length })}</span></p>{purchaseSummary}<button className="store-side-review-link" onClick={() => jump('reviews')}>{i18n.t('store.reviews', { count: 3 })}</button></aside>}
        </div>
      </div>
      <footer className="store-footer"><span>{publisher}</span><button onClick={() => top.current?.scrollIntoView({ block: 'start' })}>{i18n.t('store.backToTop')}</button></footer>
    </div>
  </main>;
}
