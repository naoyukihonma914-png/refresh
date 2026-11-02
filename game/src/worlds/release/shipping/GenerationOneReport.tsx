import { DailySalesTable, NextVersionAction, PublisherNotes, ReportContracts, ReportDataTools, ReportProduct, SpecPurchases, type ReportPartProps } from './ReportParts';

export function GenerationOneReport(props:ReportPartProps) {
  const {i18n,report}=props;
  return <main className="shipping-page shipping-generation-1" data-generation="1" data-report-layout="register-inquiry">
    <header className="shipping-header"><b>{i18n.t('release.publisher')}</b><h1>{i18n.t('shipping.report')}</h1><span>{i18n.t('release.path',{product:report.product.name?.trim()||i18n.t('product.untitled'),version:report.version})}</span></header>
    <div className="shipping-report-shell">
      <div className="shipping-report-heading"><h2>{i18n.t('shipping.reportProduct',{product:report.title})}</h2><p data-report-info="period">{report.period}</p></div>
      <div className="shipping-report-main">
        <section className="shipping-product-section"><h2>{i18n.t('shipping.targetProduct')}</h2><ReportProduct {...props}/></section>
        <section className="shipping-sales-section"><h2>{i18n.t('shipping.dailySales')}</h2><DailySalesTable report={report} i18n={i18n} totalMarker/></section>
        <section className="shipping-spec-section shipping-right"><h2>{i18n.t('shipping.performanceOrder')}</h2><SpecPurchases {...props}/></section>
      </div>
      <section className="shipping-report-notes"><h2>{i18n.t('shipping.notes')}</h2><PublisherNotes {...props}/></section>
      {!report.prototype&&report.complete&&<section className="shipping-report-contract"><h2>{i18n.t('shipping.optionalWork')}</h2><ReportContracts {...props}/></section>}
      <section className="shipping-report-execute"><h2>{i18n.t('shipping.nextVersion')}</h2><NextVersionAction {...props}/></section>
      <footer><ReportDataTools {...props}/></footer>
    </div>
  </main>;
}
