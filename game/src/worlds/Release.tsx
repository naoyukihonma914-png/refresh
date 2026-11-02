import { ContractSelection } from '../components/LongPlaySettings';
import { productLabel } from '../content/products';
import { BALANCE, type SpecKey } from '../config/balance';
import type { I18n } from '../content/i18n';
import { canBuySpec, canStartNextVersion, dailySales, displayedSales, shippingComplete, shippingProduct, SPEC_ORDER } from '../systems/release';
import { releasePresentation } from '../systems/releasePresentation';
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
  const complete = shippingComplete(state), prototype = product.version === 'v0.1';
  const version = i18n.t(prototype ? 'release.prototype' : 'release.version.v1');
  const presentation = releasePresentation(product), generation = presentation.generation;
  const title = productLabel(i18n, product.name, version);
  const period = i18n.t('shipping.period', { from: i18n.legacyDate(product.releasedAt), to: i18n.legacyDate(product.releasedAt + (days.length - 1) * 24 * BALANCE.time.millisecondsPerHour) });
  const cumulative = days.map((_amount, index) => days.slice(0, index + 1).reduce((sum, amount) => sum + amount, 0));
  const graphPoints = days.map((amount, index) => `${12 + index * 46},${118 - amount / Math.max(1, allocations[0]!) * 104}`).join(' ');
  const readyForNext = canStartNextVersion(state);
  return <main className={`shipping-page shipping-generation-${generation}`} data-generation={generation}>
    <header className="shipping-header">
      <b>{i18n.t('release.publisher')}</b><h1>{i18n.t(generation === 1 ? 'shipping.report' : generation === 2 ? 'shipping.onlineReport' : 'shipping.partnerReport')}</h1>
      <span>{i18n.t('release.path', { product: product.name?.trim() || i18n.t('product.untitled'), version })}</span>
    </header>
    <div className="shipping-report-shell">
      <div className="shipping-report-heading"><h2>{i18n.t('shipping.reportProduct', { product: title })}</h2><p>{period}</p></div>
      {generation === 3 && <dl className="shipping-report-summary">
        <div><dt>{i18n.t('release.revenue')}</dt><dd className="revenue-total" data-total={product.revenue}>{i18n.t('release.dollars', { count: total })}</dd></div>
        <div><dt>{i18n.t('release.available')}</dt><dd>{i18n.t('release.dollars', { count: available })}</dd></div>
        <div><dt>{i18n.t('shipping.comparison')}</dt><dd className="shipping-period-comparison" data-first-day={days[0]!} data-last-day={days.at(-1)!}><span>{i18n.t('release.dayNumber', { count: 1 })}<b>{i18n.t('release.dollars', { count: days[0]! })}</b></span><span>{i18n.t('release.dayNumber', { count: days.length })}<b>{i18n.t('release.dollars', { count: days.at(-1)! })}</b></span></dd></div>
      </dl>}
      <div className="shipping-report-main">
        <section className="shipping-product-section">
          <h2>{i18n.t('shipping.targetProduct')}</h2>
          <div className="shipping-report-preview"><ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n} /></div>
          <table className="shipping-product-table"><tbody>
            <tr><th scope="row">{i18n.t('release.name')}</th><td>{title}</td></tr>
            <tr><th scope="row">{i18n.t('release.version')}</th><td>{version}</td></tr>
            {product.author !== null && <tr><th scope="row">{i18n.t('release.author')}</th><td>{product.author}</td></tr>}
            <tr><th scope="row">{i18n.t('release.contents')}</th><td>{i18n.t('release.summary', { built: product.builtCount, icons: product.exports.filter(work => work.kind === 'icon').length })}</td></tr>
          </tbody></table>
        </section>
        <section className="shipping-sales-section">
          <h2>{i18n.t(generation === 3 ? 'shipping.breakdown' : 'shipping.dailySales')}</h2>
          {generation === 2 && <p className="shipping-period-field"><b>{i18n.t('shipping.reportingPeriod')}</b><span>{period}</span></p>}
          {generation === 3 && <figure className="shipping-trend"><figcaption>{i18n.t('shipping.trend')}</figcaption><svg viewBox="0 0 300 132" role="img" aria-label={i18n.t('shipping.trend')}><path d="M12 14H288M12 66H288M12 118H288" className="shipping-chart-grid"/><polyline points={graphPoints} className="shipping-chart-line"/>{days.map((amount, index)=><circle key={index} cx={12 + index * 46} cy={118 - amount / Math.max(1, allocations[0]!) * 104} r="2.5"/>)}</svg><div className="shipping-trend-range"><span>{i18n.t('release.dayNumber', { count: 1 })}</span><span>{i18n.t('release.dayNumber', { count: days.length })}</span></div></figure>}
          <table className="sales-table shipping-daily-table"><thead><tr><th scope="col">{i18n.t('release.day')}</th>{generation === 2 && <th scope="col" aria-label={i18n.t('shipping.trend')} />}<th scope="col">{i18n.t('release.revenue')}</th><th scope="col">{i18n.t('shipping.cumulative')}</th></tr></thead><tbody>
            {days.map((amount, day) => <tr key={day}><th scope="row">{i18n.t('release.dayNumber', { count: day + 1 })}</th>{generation === 2 && <td className="shipping-bar-cell"><div className="sales-bar" aria-hidden="true" style={{ width: `${amount / Math.max(1, allocations[0]!) * 100}%` }} /></td>}<td className="day-sales" data-value={amount}>{i18n.t('release.dollars', { count: amount })}</td><td data-cumulative={cumulative[day]!}>{i18n.t('release.dollars', { count: cumulative[day]! })}</td></tr>)}
          </tbody><tfoot><tr><th scope="row" colSpan={generation === 2 ? 2 : 1}>{i18n.t('shipping.total')}</th><td className={generation === 3 ? undefined : 'revenue-total'} data-total={generation === 3 ? undefined : product.revenue}>{i18n.t('release.dollars', { count: total })}</td><td>{i18n.t('release.dollars', { count: total })}</td></tr></tfoot></table>
        </section>
        <section className="shipping-spec-section shipping-right">
          <h2>{i18n.t('shipping.performanceOrder')}</h2>
          <p className="shipping-order-balance"><span>{i18n.t('release.available')}</span><strong className="available-dollars" data-value={state.resources.dollars}>{i18n.t('release.dollars', { count: available })}</strong></p>
          <table className="spec-table"><thead><tr>{(['item','current','next','effect','price'] as const).map(key => <th scope="col" key={key}>{i18n.t(`release.${key}`)}</th>)}<th scope="col" aria-label={i18n.t('release.buy')} /></tr></thead><tbody>
            {SPEC_ORDER.map(key => {
              const level = state.persistent.specs[key], next = BALANCE.spec[key][level + 1], enabled = canBuySpec(state, key);
              const recommended = prototype ? key === 'color' && level === 0 : key === 'refresh' && level < BALANCE.release.v1RefreshLevel;
              return <tr key={key} data-spec={key} className={recommended ? 'recommended-spec' : ''}>
                <th scope="row">{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key, level)}</td><td>{next ? i18n.spec(key, level + 1) : i18n.t('release.maximum')}</td>
                <td>{next ? specEffect(key, level, i18n) : i18n.t('settings.owned')}</td><td className={!enabled ? 'unaffordable' : ''}>{next ? i18n.price(next.price) : ''}</td>
                <td>{next && <button className={recommended ? 'shipping-primary' : ''} disabled={!enabled} aria-label={i18n.t('release.buySpec', { name: i18n.t(`spec.${key}`), dollars: i18n.price(next.price) })}
                  title={!complete ? i18n.t('release.salesPending') : !enabled && next.price <= state.resources.dollars ? i18n.t(prototype ? 'release.reserve' : 'release.reserveRefresh') : undefined} onClick={() => runtime.purchaseSpec(key)}>{i18n.t('release.buy')}</button>}</td>
              </tr>;
            })}
          </tbody></table>
          <p className="carry-dollars">{i18n.t('release.carryDollars')}</p>
          {!complete ? <p role="status" className="shipping-pending">{i18n.t('release.salesPending')}</p> : state.persistent.specs.color === 0 && <p>{i18n.t('release.buyColorFirst')}</p>}
        </section>
      </div>
      <section className="shipping-report-notes"><h2>{i18n.t('shipping.notes')}</h2>{complete && <div className="shipping-guide"><p><b>{i18n.t('release.contact')}</b><span>{i18n.t('release.publisher')}</span></p><p>{i18n.t(prototype ? 'release.sales' : 'release.sales.v1')}</p></div>}</section>
      {!prototype && complete && <section className="shipping-report-contract"><h2>{i18n.t('shipping.optionalWork')}</h2><ContractSelection state={state} runtime={runtime} i18n={i18n}/></section>}
      <section className="shipping-report-execute"><h2>{i18n.t('shipping.nextVersion')}</h2><div className="next-version"><div><p className="next-version-voice">{i18n.t(prototype ? 'release.nextVoice.prototype' : 'release.nextVoice.v1')}</p><p className="next-version-theme">{i18n.t(prototype ? 'release.nextTheme' : 'release.nextTheme.v1')}</p>{!prototype && complete && state.persistent.specs.refresh < BALANCE.release.v1RefreshLevel && <p className="shipping-next-requirement">{i18n.t('release.buyRefreshFirst')}</p>}</div><button disabled={!readyForNext} onClick={runtime.startNextVersion}>{i18n.t('release.startNext')}</button></div></section>
      <footer className="shipping-footer"><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage}/><details><summary>{i18n.t('data.title')}</summary><button onClick={runtime.downloadData}>{i18n.t('data.export')}</button><button onClick={() => { void runtime.requestImport(); }}>{i18n.t('data.import')}</button><button onClick={() => runtime.requestReset()}>{i18n.t('data.reset')}</button></details></footer>
    </div>
  </main>;
}
