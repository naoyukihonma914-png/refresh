import { ContractSelection } from '../../../components/LongPlaySettings';
import { LanguageSelect } from '../../../components/LanguageSelect';
import { productLabel } from '../../../content/products';
import { BALANCE, type SpecKey } from '../../../config/balance';
import type { I18n } from '../../../content/i18n';
import { canBuySpec, canStartNextVersion, dailySales, displayedSales, shippingComplete, SPEC_ORDER } from '../../../systems/release';
import type { ProductRecord } from '../../../systems/releaseState';
import type { GameRuntime, RuntimeSnapshot } from '../../../systems/runtime';
import { ProductPreview } from '../ProductPreview';

export interface ReportProps { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n; product: ProductRecord }
export interface ReportModel {
  product: ProductRecord; days: number[]; allocations: number[]; cumulative: number[];
  total: number; available: number; complete: boolean; prototype: boolean;
  version: string; title: string; period: string; readyForNext: boolean;
}
export function reportModel({snapshot,i18n,product}: ReportProps): ReportModel {
  const {state}=snapshot;
  const days=displayedSales(product,state.run.shipping!.elapsedMs),allocations=dailySales(product.revenue);
  const total=days.reduce((sum,amount)=>sum+amount,0),available=state.resources.dollars-product.revenue+total;
  const prototype=product.version==='v0.1',version=i18n.t(prototype?'release.prototype':'release.version.v1');
  return {product,days,allocations,total,available,prototype,version,title:productLabel(i18n,product.name,version),
    complete:shippingComplete(state),readyForNext:canStartNextVersion(state),
    period:i18n.t('shipping.period',{from:i18n.legacyDate(product.releasedAt),to:i18n.legacyDate(product.releasedAt+(days.length-1)*24*BALANCE.time.millisecondsPerHour)}),
    cumulative:days.map((_amount,index)=>days.slice(0,index+1).reduce((sum,amount)=>sum+amount,0)),
  };
}
export interface ReportPartProps extends ReportProps { report: ReportModel }

export function ReportProduct({report,runtime,snapshot,i18n}:ReportPartProps) {
  const {product,title,version}=report;
  return <div className="shipping-product-information" data-report-info="product">
    <div className="shipping-report-preview"><ProductPreview product={product} runtime={runtime} snapshot={snapshot} i18n={i18n}/></div>
    <table className="shipping-product-table"><tbody>
      <tr><th scope="row">{i18n.t('release.name')}</th><td>{title}</td></tr>
      <tr><th scope="row">{i18n.t('release.version')}</th><td>{version}</td></tr>
      {product.author!==null&&<tr><th scope="row">{i18n.t('release.author')}</th><td>{product.author}</td></tr>}
      <tr><th scope="row">{i18n.t('release.contents')}</th><td>{i18n.t('release.summary',{built:product.builtCount,icons:product.exports.filter(work=>work.kind==='icon').length})}</td></tr>
    </tbody></table>
  </div>;
}
export function ReportPeriod({report,i18n}:{report:ReportModel;i18n:I18n}) {
  return <p className="shipping-period-field"><b>{i18n.t('shipping.reportingPeriod')}</b><span data-report-info="period">{report.period}</span></p>;
}
export function ReportRevenue({report,i18n}:{report:ReportModel;i18n:I18n}) {
  return <strong className="revenue-total" data-report-info="revenue" data-total={report.product.revenue}>{i18n.t('release.dollars',{count:report.total})}</strong>;
}
export function ReportAvailable({report,i18n,snapshot}:{report:ReportModel;i18n:I18n;snapshot:RuntimeSnapshot}) {
  return <strong className="available-dollars" data-report-info="available" data-value={snapshot.state.resources.dollars}>{i18n.t('release.dollars',{count:report.available})}</strong>;
}
export function ReportComparison({report,i18n}:{report:ReportModel;i18n:I18n}) {
  return <div className="shipping-period-comparison" data-first-day={report.days[0]!} data-last-day={report.days.at(-1)!}>
    <span>{i18n.t('release.dayNumber',{count:1})}<b>{i18n.t('release.dollars',{count:report.days[0]!})}</b></span>
    <span>{i18n.t('release.dayNumber',{count:report.days.length})}<b>{i18n.t('release.dollars',{count:report.days.at(-1)!})}</b></span>
  </div>;
}
export function DailySalesTable({report,i18n,totalMarker=false}: {report:ReportModel;i18n:I18n;totalMarker?:boolean}) {
  return <table className="sales-table shipping-daily-table" data-report-info="daily-sales" data-first-day={report.days[0]!} data-last-day={report.days.at(-1)!}>
    <thead><tr><th scope="col">{i18n.t('release.day')}</th><th scope="col">{i18n.t('release.revenue')}</th><th scope="col">{i18n.t('shipping.cumulative')}</th></tr></thead>
    <tbody>{report.days.map((amount,day)=><tr key={day}><th scope="row">{i18n.t('release.dayNumber',{count:day+1})}</th><td className="day-sales" data-value={amount}>{i18n.t('release.dollars',{count:amount})}</td><td data-cumulative={report.cumulative[day]!}>{i18n.t('release.dollars',{count:report.cumulative[day]!})}</td></tr>)}</tbody>
    <tfoot><tr><th scope="row">{i18n.t('shipping.total')}</th><td>{totalMarker?<ReportRevenue report={report} i18n={i18n}/>:i18n.t('release.dollars',{count:report.total})}</td><td>{i18n.t('release.dollars',{count:report.total})}</td></tr></tfoot>
  </table>;
}
export function SalesTrend({report,i18n,kind}:{report:ReportModel;i18n:I18n;kind:'bars'|'line'}) {
  const max=Math.max(1,report.allocations[0]!),points=report.days.map((amount,index)=>`${45+index*142},${250-amount/max*220}`).join(' ');
  return <figure className={`shipping-trend shipping-trend-${kind}`} data-report-chart={kind}>
    <figcaption>{i18n.t('shipping.trend')}</figcaption>
    <svg viewBox="0 0 960 280" preserveAspectRatio="none" role="img" aria-label={i18n.t('shipping.trend')}>
      <path d="M24 30H934M24 140H934M24 250H934" className="shipping-chart-grid"/>
      {kind==='line'?<><polygon points={`45,250 ${points} 897,250`} className="shipping-chart-area"/><polyline points={points} className="shipping-chart-line"/>{report.days.map((amount,index)=><circle key={index} cx={45+index*142} cy={250-amount/max*220} r="4"/>)}</>:report.days.map((amount,index)=><rect key={index} x={25+index*142} y={250-amount/max*220} width="64" height={amount/max*220} className="shipping-chart-bar"/>)}
    </svg>
    <ol className="shipping-trend-days">{report.days.map((_amount,index)=><li key={index}>{i18n.t('release.dayNumber',{count:index+1})}</li>)}</ol>
  </figure>;
}
function specEffect(key:SpecKey,level:number,i18n:I18n):string {
  switch(key) {
    case 'color':return i18n.t(level===0?'release.spec.colorDesktop':'release.spec.color',{multiplier:BALANCE.spec.color[level+1]!.multiplier/BALANCE.spec.color[level]!.multiplier});
    case 'resolution':return i18n.t('release.spec.resolution',{from:BALANCE.spec.resolution[level]!.grid,to:BALANCE.spec.resolution[level+1]!.grid});
    case 'refresh':return i18n.t('release.spec.refresh',{multiplier:BALANCE.spec.refresh[level+1]!.multiplier/BALANCE.spec.refresh[level]!.multiplier});
    case 'memory':return i18n.t('release.spec.memory',{from:BALANCE.spec.memory[level]!.posts,to:BALANCE.spec.memory[level+1]!.posts});
    case 'storage':return i18n.t('release.spec.storage',{from:i18n.duration(BALANCE.spec.storage[level]!.offlineHours*BALANCE.time.millisecondsPerHour),to:i18n.duration(BALANCE.spec.storage[level+1]!.offlineHours*BALANCE.time.millisecondsPerHour)});
    case 'network':return i18n.t('release.spec.network',{from:i18n.duration(BALANCE.spec.network[level]!.mailIntervalSeconds*BALANCE.time.millisecondsPerSecond),to:i18n.duration(BALANCE.spec.network[level+1]!.mailIntervalSeconds*BALANCE.time.millisecondsPerSecond)});
    case 'graphics':return i18n.t('release.spec.graphics',{from:BALANCE.spec.graphics[level]!.shotCooldownSeconds,to:BALANCE.spec.graphics[level+1]!.shotCooldownSeconds});
  }
}
export function SpecPurchases({snapshot,i18n,runtime,report,balanceMarker=true}:ReportPartProps&{balanceMarker?:boolean}) {
  const {state}=snapshot;
  return <div className="shipping-purchase-form" data-report-info="specifications">
    <p className="shipping-order-balance"><span>{i18n.t('release.available')}</span>{balanceMarker?<ReportAvailable report={report} i18n={i18n} snapshot={snapshot}/>:<b>{i18n.t('release.dollars',{count:report.available})}</b>}</p>
    <table className="spec-table"><thead><tr>{(['item','current','next','effect','price']as const).map(key=><th scope="col" key={key}>{i18n.t(`release.${key}`)}</th>)}<th scope="col" aria-label={i18n.t('release.buy')}/></tr></thead>
      <tbody>{SPEC_ORDER.map(key=>{
        const level=state.persistent.specs[key],next=BALANCE.spec[key][level+1],enabled=canBuySpec(state,key);
        const recommended=report.prototype?key==='color'&&level===0:key==='refresh'&&level<BALANCE.release.v1RefreshLevel;
        return <tr key={key} data-spec={key} className={recommended?'recommended-spec':''}>
          <th scope="row">{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,level)}</td><td>{next?i18n.spec(key,level+1):i18n.t('release.maximum')}</td><td>{next?specEffect(key,level,i18n):i18n.t('settings.owned')}</td><td className={!enabled?'unaffordable':''}>{next?i18n.price(next.price):''}</td>
          <td>{next&&<button className={recommended?'shipping-primary':''} disabled={!enabled} aria-label={i18n.t('release.buySpec',{name:i18n.t(`spec.${key}`),dollars:i18n.price(next.price)})}
            title={!report.complete?i18n.t('release.salesPending'):!enabled&&next.price<=state.resources.dollars?i18n.t(report.prototype?'release.reserve':'release.reserveRefresh'):undefined} onClick={()=>runtime.purchaseSpec(key)}>{i18n.t('release.buy')}</button>}</td>
        </tr>;
      })}</tbody>
    </table>
    <p className="carry-dollars">{i18n.t('release.carryDollars')}</p>
    {!report.complete?<p role="status" className="shipping-pending">{i18n.t('release.salesPending')}</p>:state.persistent.specs.color===0&&<p>{i18n.t('release.buyColorFirst')}</p>}
  </div>;
}
export function PublisherNotes({report,i18n}:ReportPartProps) {
  return <div data-report-info="publisher-notes">{report.complete&&<div className="shipping-guide"><p><b>{i18n.t('release.contact')}</b><span>{i18n.t('release.publisher')}</span></p><p>{i18n.t(report.prototype?'release.sales':'release.sales.v1')}</p></div>}</div>;
}
export function ReportContracts({snapshot,report,runtime,i18n}:ReportPartProps) {
  return !report.prototype&&report.complete?<div data-report-info="contracts"><ContractSelection state={snapshot.state} runtime={runtime} i18n={i18n}/></div>:null;
}
export function NextVersionAction({snapshot,report,runtime,i18n}:ReportPartProps) {
  return <div className="next-version" data-report-info="next-version"><div><p className="next-version-voice">{i18n.t(report.prototype?'release.nextVoice.prototype':'release.nextVoice.v1')}</p><p className="next-version-theme">{i18n.t(report.prototype?'release.nextTheme':'release.nextTheme.v1')}</p>{!report.prototype&&report.complete&&snapshot.state.persistent.specs.refresh<BALANCE.release.v1RefreshLevel&&<p className="shipping-next-requirement">{i18n.t('release.buyRefreshFirst')}</p>}</div><button disabled={!report.readyForNext} onClick={runtime.startNextVersion}>{i18n.t('release.startNext')}</button></div>;
}
export function ReportDataTools({runtime,i18n}:ReportProps) {
  return <div className="shipping-footer" data-report-info="data-tools"><LanguageSelect i18n={i18n} onChange={runtime.changeLanguage}/><details><summary>{i18n.t('data.title')}</summary><button onClick={runtime.downloadData}>{i18n.t('data.export')}</button><button onClick={()=>{void runtime.requestImport();}}>{i18n.t('data.import')}</button><button onClick={()=>runtime.requestReset()}>{i18n.t('data.reset')}</button></details></div>;
}
