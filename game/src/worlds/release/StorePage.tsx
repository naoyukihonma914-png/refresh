import { useMemo, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import { productLabel } from '../../content/products';
import { readCapture } from '../../systems/captureScene';
import { shippingProduct, storeComplete } from '../../systems/release';
import { releasePresentation } from '../../systems/releasePresentation';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { ClassicStoreLayout } from './store/ClassicStoreLayout';
import { PortalStoreLayout } from './store/PortalStoreLayout';
import { ModernStoreLayout } from './store/ModernStoreLayout';
import type { StoreSection, StoreView } from './store/StoreParts';

export function StorePage({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot, product = shippingProduct(state)!;
  const { generation } = releasePresentation(product);
  const [selected, setSelected] = useState(0), [section, setSection] = useState<StoreSection>('about');
  const top = useRef<HTMLElement>(null), about = useRef<HTMLElement>(null), reviews = useRef<HTMLElement>(null);
  const prototype = product.version === 'v0.1';
  const photos = product.screenshots?.length ? product.screenshots : product.capture ? [product.capture] : [];
  const catalog = useMemo(() => [...(product.captureCatalog ?? []), ...(product.screenshots ?? []), ...(product.capture ? [product.capture] : [])], [product]);
  const progress = Math.min(1, (state.run.shipping?.storeElapsedMs ?? 0) / BALANCE.release.storeAnimationMs);
  const reviewRatings = [5, 4, 5] as const;
  const view: StoreView = {
    runtime, snapshot, i18n, product, generation, prototype,
    title: productLabel(i18n, product.name, prototype ? i18n.t('release.prototype') : i18n.t('release.version.v1')),
    publisher: i18n.t('release.publisher'), topic: i18n.t(prototype ? 'store.topic.prototype' : 'store.topic.desktop'),
    description: i18n.t(prototype ? 'store.description.prototype' : 'store.description.desktop', { built: product.builtCount, icons: product.exports.length, apps: product.capture ? 1 + readCapture(product.capture).desktop.apps.length : 0 }),
    published: generation === 1 ? i18n.legacyDate(product.releasedAt) : i18n.date(product.releasedAt),
    purchases: Math.floor(product.revenue / BALANCE.release.storeUnitPrice * progress),
    downloads: Math.floor(product.revenue * BALANCE.release.storeDownloadsPerDollar * progress), complete: storeComplete(state),
    reviewRatings, averageRating: reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length,
    photos, photo: photos[Math.min(selected, Math.max(0, photos.length - 1))], catalog, selected, section,
    selectPhoto: setSelected, jump: target => { setSection(target); (target === 'about' ? about : reviews).current?.scrollIntoView({ block: 'start' }); },
    top: () => top.current?.scrollIntoView({ block: 'start' }), topRef: top, aboutRef: about, reviewsRef: reviews,
  };
  if (generation === 1) return <ClassicStoreLayout view={view}/>;
  if (generation === 2) return <PortalStoreLayout view={view}/>;
  return <ModernStoreLayout view={view}/>;
}
