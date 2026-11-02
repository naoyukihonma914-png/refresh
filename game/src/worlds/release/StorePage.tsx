import { useMemo, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import { productLabel } from '../../content/products';
import { readCapture } from '../../systems/captureScene';
import { shippingProduct, storeComplete } from '../../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { ScreenshotPreview } from '../Desktop';
import { ProductPreview } from './ProductPreview';

export function StorePage({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot, product = shippingProduct(state)!;
  const [selected, setSelected] = useState(0);
  const about = useRef<HTMLElement>(null), reviews = useRef<HTMLElement>(null);
  const prototype = product.version === 'v0.1';
  const photos = product.screenshots?.length ? product.screenshots : product.capture ? [product.capture] : [];
  const catalog = useMemo(() => [...(product.captureCatalog ?? []), ...(product.screenshots ?? []), ...(product.capture ? [product.capture] : [])], [product]);
  const photo = photos[Math.min(selected, Math.max(0, photos.length - 1))];
  const progress = Math.min(1, (state.run.shipping?.storeElapsedMs ?? 0) / BALANCE.release.storeAnimationMs);
  const purchases = Math.floor(product.revenue / BALANCE.release.storeUnitPrice * progress);
  const downloads = Math.floor(product.revenue * BALANCE.release.storeDownloadsPerDollar * progress);
  const title = productLabel(i18n, product.name, prototype ? i18n.t('release.prototype') : i18n.t('release.version.v1'));
  return <main className={`store-page ${prototype ? 'store-freeware' : 'store-archive'}`}>
    <header className="store-header"><strong>{i18n.t(prototype ? 'store.freeware' : 'store.archive')}</strong><span>{i18n.t('store.category')}</span><b>{title}</b></header>
    <nav className="store-navigation"><button onClick={() => about.current?.scrollIntoView({ block: 'start' })}>{i18n.t('store.about')}</button><button onClick={() => reviews.current?.scrollIntoView({ block: 'start' })}>{i18n.t('store.reviews', { count: 3 })}</button></nav>
    <div className="store-hero">
      {photo ? <ScreenshotPreview shot={photo} catalog={catalog} runtime={runtime} snapshot={snapshot} i18n={i18n} /> : <div className="store-home-media"><ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n} /></div>}
    </div>
    <div className="store-body">
      <div className="store-main-column">
        <section ref={about} className="store-about"><h1>{title}</h1>{product.author !== null && <p className="store-author">{i18n.t('store.by', { author: product.author })}</p>}
          <table><tbody><tr><th>{i18n.t('store.published')}</th><td>{i18n.date(product.releasedAt)}</td></tr><tr><th>{i18n.t('store.topic')}</th><td>{i18n.t(prototype ? 'store.topic.prototype' : 'store.topic.desktop')}</td></tr><tr><th>{i18n.t('store.languages')}</th><td>{i18n.t('store.languageList')}</td></tr></tbody></table>
          <p className="store-description">{i18n.t(prototype ? 'store.description.prototype' : 'store.description.desktop', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length, apps: product.capture ? 1 + readCapture(product.capture).desktop.apps.length : 0 })}</p>
        </section>
        {photos.length > 1 && <section className="store-photos"><h2>{i18n.t('store.screenshots')}</h2><div>{photos.map((shot, index) => <button key={shot.id} aria-label={i18n.t('store.photoNumber', { count: index + 1 })} aria-pressed={selected === index} onClick={() => setSelected(index)}><ScreenshotPreview shot={shot} catalog={catalog} runtime={runtime} snapshot={snapshot} i18n={i18n} /></button>)}</div></section>}
        <section ref={reviews} className="store-reviews"><h2>{i18n.t('store.reviews', { count: 3 })}</h2>{(['hikari', 'ren', 'maki'] as const).map((sender, index) => <article key={sender}>
          <p><b>{i18n.t('store.review.author', { author: i18n.t(`feedback.sender.${sender}`) })}</b><span className="store-stars" role="img" aria-label={i18n.t('store.review.rating', { count: index === 1 ? 4 : 5 })} data-stars={index === 1 ? 4 : 5} /><time>{i18n.date(product.releasedAt)}</time></p>
          <h3>{i18n.t('store.review.subject', { subject: i18n.t(prototype && index === 1 ? 'store.review.prototype.title' : `store.review.${sender}.title`) })}</h3><p>{i18n.t(prototype && index === 1 ? 'store.review.prototype.body' : `store.review.${sender}.body`)}</p>
        </article>)}</section>
      </div>
      <aside className="store-sidebar"><section className="store-purchase-summary"><h2>{i18n.t('store.purchaseSummary')}</h2><p data-store-downloads={downloads}>{i18n.t('store.downloads', { count: downloads })}</p>{!prototype && <p data-store-purchases={purchases}>{i18n.t('store.purchases', { count: purchases })}</p>}<p>{i18n.t('store.reviews', { count: 3 })}</p>
        {!storeComplete(state) && <p role="status" className="store-orders-pending">{i18n.t('store.ordersPending')}</p>}<button className="store-view-sales" disabled={!storeComplete(state)} onClick={runtime.showShipping}>{i18n.t('store.viewSales')}</button></section>
      </aside>
    </div>
  </main>;
}
