import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { I18n } from '../../content/i18n';
import type { ProductRecord } from '../../systems/releaseState';
import { productPreviewState } from '../../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { HomeDocument } from '../kumiki/HomeDocument';

export function ProductPreview({ product, runtime, snapshot, i18n }: { product: ProductRecord; runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const mount = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: .3, left: 0, top: 0 });
  const state = useMemo(() => productPreviewState(product), [product]);
  useLayoutEffect(() => {
    const node = mount.current?.querySelector<HTMLElement>('.home-document');
    if (!node) return;
    const measure = () => {
      const scale = Math.min(280 / node.offsetWidth, 176 / node.offsetHeight);
      setFit({ scale, left: (280 - node.offsetWidth * scale) / 2, top: (176 - node.offsetHeight * scale) / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [product, i18n.language]);
  return <div className={`product-preview kumiki ${product.screen.modern ? 'is-modern' : ''}`} role="img" aria-label={i18n.t('release.preview')}>
    <div ref={mount} className="product-preview-mount" inert aria-hidden="true" style={{ transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})` }}>
      <HomeDocument runtime={runtime} snapshot={{ ...snapshot, state, press: null, offline: null }} i18n={i18n} selected={null} onSelect={() => {}} selecting={false} dragPart={null} onDrop={() => {}} preview legacyHome={!product.screen.page} />
    </div>
  </div>;
}
