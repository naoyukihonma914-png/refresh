import { BALANCE, type SpecKey } from '../config/balance';
import type { I18n } from '../content/i18n';
import { canBuySpec, canStartNextVersion, dailySales, displayedSales, shippingComplete, shippingProduct, SPEC_ORDER } from '../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { LanguageSelect } from '../components/LanguageSelect';
import { ProductPreview } from './release/ProductPreview';

function specEffect(key: SpecKey, level: number, i18n: I18n): string {
  switch (key) {
    case 'color': return i18n.t(level === 0 ? 'release.spec.colorDesktop' : 'release.spec.color', { multiplier: BALANCE.spec.color[level + 1]!.multiplier / BALANCE.spec.color[level]!.multiplier });
    case 'resolution': return i18n.t('release.spec.resolution', { from: BALANCE.spec.resolution[level]!.grid, to: BALANCE.spec.resolution[level + 1]!.grid });
    case 'refresh': return i18n.t('release.spec.refresh', { multiplier: BALANCE.spec.refresh[level + 1]!.multiplier / BALANCE.spec.refresh[level]!.multiplier });
    case 'memory': return i18n.t('release.spec.memory', { from: BALANCE.spec.memory[level]!.posts, to: BALANCE.spec.memory[level + 1]!.posts });
    case 'storage': return i18n.t('release.spec.storage', { from: i18n.duration(BALANCE.spec.storage[level]!.offlineHours * BALANCE.time.millisecondsPerHour), to: i18n.duration(BALANCE.spec.storage[level + 1]!.offlineHours * BALANCE.time.millisecondsPerHour) });
    case 'network': return i18n.t('release.spec.network', { from: i18n.duration(BALANCE.spec.network[level]!.mailIntervalSeconds * BALANCE.time.millisecondsPerSecond), to: i18n.duration(BALANCE.spec.network[level + 1]!.mailIntervalSeconds * BALANCE.time.millisecondsPerSecond) });
    case 'graphics': return i18n.t('release.spec.graphics', { from: BALANCE.spec.graphics[level]!.shotCooldownSeconds, to: BALANCE.spec.graphics[level + 1]!.shotCooldownSeconds });
  }
}

export function Release({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot, product = shippingProduct(state);
  if (!product || !state.run.shipping) return null;
  const days = displayedSales(product, state.run.shipping.elapsedMs), allocations = dailySales(product.revenue);
  const total = days.reduce((a, b) => a + b, 0), available = state.resources.dollars - product.revenue + total;
  const complete = shippingComplete(state);
  return <main className="shipping-page">
    <header className="shipping-header"><span className="publisher-mark" aria-hidden="true" /><b>{i18n.t('release.publisher')}</b><span>{i18n.t('release.path', { product: i18n.t('release.product'), version: i18n.t('release.prototype') })}</span></header>
    <div className="shipping-columns">
      <div className="shipping-left">
        <section><h1>{i18n.t('release.products')}</h1><div className="shipping-box product-details">
          <ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n} />
          <table><tbody>
            <tr><th scope="row">{i18n.t('release.name')}</th><td>{i18n.t('release.product')}</td></tr>
            <tr><th scope="row">{i18n.t('release.version')}</th><td>{i18n.t('release.prototype')}</td></tr>
            {product.author !== null && <tr><th scope="row">{i18n.t('release.author')}</th><td>{product.author}</td></tr>}
            <tr><th scope="row">{i18n.t('release.contents')}</th><td>{i18n.t('release.summary', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length })}</td></tr>
          </tbody></table>
        </div></section>
        <section><div className="shipping-section-heading"><h2>{i18n.t('release.revenue')}</h2><span>{i18n.t('release.week')}</span><strong className="revenue-total" data-total={product.revenue}>{i18n.t('release.dollars', { count: total })}</strong></div>
          <div className="shipping-box"><table className="sales-table"><thead><tr><th scope="col">{i18n.t('release.day')}</th><th scope="col" aria-label={i18n.t('release.revenue')} /><th scope="col">{i18n.t('release.revenue')}</th></tr></thead><tbody>
            {days.map((amount, day) => <tr key={day}><td>{i18n.t('release.dayNumber', { count: day + 1 })}</td><td><div className={`sales-bar ${day === 0 ? 'first-day' : ''}`} aria-hidden="true" style={{ width: `${amount / Math.max(1, allocations[0]!) * 100}%` }} /></td><td className="day-sales" data-value={amount}>{i18n.t('release.dollars', { count: amount })}</td></tr>)}
          </tbody></table></div>
        </section>
        {complete && <section className="shipping-box shipping-guide"><p><b>{i18n.t('release.contact')}</b><span>{i18n.t('release.publisher')}</span></p><p>{i18n.t('release.sales')}</p></section>}
        <footer className="shipping-footer"><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage} /><details><summary>{i18n.t('data.title')}</summary><button onClick={runtime.downloadData}>{i18n.t('data.export')}</button><button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button><button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button></details></footer>
      </div>
      <section className="shipping-right"><div className="shipping-section-heading"><h2>{i18n.t('release.specs')}</h2><span className="available-label">{i18n.t('release.available')}</span><strong className="available-dollars" data-value={state.resources.dollars}>{i18n.integer(available)}</strong></div>
        <div className="shipping-box"><table className="spec-table"><thead><tr>{(['item','current','next','effect','price'] as const).map(key => <th scope="col" key={key}>{i18n.t(`release.${key}`)}</th>)}<th scope="col" aria-label={i18n.t('release.buy')} /></tr></thead><tbody>
          {SPEC_ORDER.map(key => {
            const level = state.persistent.specs[key], next = BALANCE.spec[key][level + 1];
            const enabled = canBuySpec(state, key);
            return <tr key={key} data-spec={key} className={key === 'color' && level === 0 ? 'recommended-spec' : ''}>
              <th scope="row">{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key, level)}</td><td>{next ? i18n.spec(key, level + 1) : i18n.t('release.maximum')}</td>
              <td>{next ? specEffect(key, level, i18n) : i18n.t('settings.owned')}</td><td className={!enabled ? 'unaffordable' : ''}>{next ? i18n.integer(next.price) : ''}</td>
              <td>{next && <button className={key === 'color' && level === 0 ? 'shipping-primary' : ''} disabled={!enabled} aria-label={i18n.t('release.buySpec', { name: i18n.t(`spec.${key}`), dollars: i18n.integer(next.price) })}
                title={!complete ? i18n.t('release.salesPending') : !enabled && next.price <= state.resources.dollars ? i18n.t('release.reserve') : undefined} onClick={() => runtime.purchaseSpec(key)}>{i18n.t('release.buy')}</button>}</td>
            </tr>;
          })}
        </tbody></table></div>
        <p className="carry-dollars">{i18n.t('release.carryDollars')}</p>
        {!complete ? <p role="status">{i18n.t('release.salesPending')}</p> : state.persistent.specs.color === 0 && <p>{i18n.t('release.buyColorFirst')}</p>}
        <div className="next-version"><button disabled={!canStartNextVersion(state)} onClick={runtime.startNextVersion}>{i18n.t('release.startNext')}</button></div>
      </section>
    </div>
  </main>;
}
