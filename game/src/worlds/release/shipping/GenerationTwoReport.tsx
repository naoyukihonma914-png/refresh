import { DailySalesTable, NextVersionAction, PublisherNotes, ReportAvailable, ReportComparison, ReportContracts, ReportDataTools, ReportPeriod, ReportProduct, ReportRevenue, SalesTrend, SpecPurchases, type ReportPartProps } from './ReportParts';

export function GenerationTwoReport(props:ReportPartProps) {
  const {i18n,report,snapshot}=props;
  return <main className="shipping-page shipping-generation-2" data-generation="2" data-report-layout="publisher-portal">
    <header className="shipping-portal-header"><b>{i18n.t('release.publisher')}</b><h1>{i18n.t('shipping.onlineReport')}</h1><span>{report.title}</span></header>
    <div className="shipping-portal-page">
      <div className="shipping-portal-context"><h2>{i18n.t('shipping.reportProduct',{product:report.title})}</h2><ReportPeriod report={report} i18n={i18n}/></div>
      <section className="shipping-portal-chart"><SalesTrend report={report} i18n={i18n} kind="line"/></section>
      <table className="shipping-portal-summary"><thead><tr><th>{i18n.t('release.revenue')}</th><th>{i18n.t('release.available')}</th><th>{i18n.t('shipping.comparison')}</th></tr></thead><tbody><tr><td><ReportRevenue report={report} i18n={i18n}/></td><td><ReportAvailable report={report} i18n={i18n} snapshot={snapshot}/></td><td><ReportComparison report={report} i18n={i18n}/></td></tr></tbody></table>
      <div className="shipping-portal-layout">
        <article className="shipping-portal-report">
          <section className="shipping-portal-details"><h2>{i18n.t('shipping.dailySales')}</h2><DailySalesTable report={report} i18n={i18n}/></section>
          <section className="shipping-portal-order shipping-right"><h2>{i18n.t('shipping.performanceOrder')}</h2><SpecPurchases {...props} balanceMarker={false}/></section>
        </article>
        <aside className="shipping-portal-sidebar">
          <section className="shipping-portal-breakdown"><SalesTrend report={report} i18n={i18n} kind="bars"/></section>
          <section className="shipping-portal-product"><h2>{i18n.t('shipping.targetProduct')}</h2><ReportProduct {...props}/></section>
          <section className="shipping-portal-notices"><h2>{i18n.t('shipping.notes')}</h2><PublisherNotes {...props}/></section>
        </aside>
      </div>
      {!report.prototype&&report.complete&&<section className="shipping-portal-project"><h2>{i18n.t('shipping.optionalWork')}</h2><ReportContracts {...props}/></section>}
      <section className="shipping-portal-execute"><h2>{i18n.t('shipping.nextVersion')}</h2><NextVersionAction {...props}/></section>
      <footer><ReportDataTools {...props}/></footer>
    </div>
  </main>;
}
