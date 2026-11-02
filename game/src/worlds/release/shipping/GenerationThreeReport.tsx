import { useRef, useState } from 'react';
import type { MessageKey } from '../../../content/i18n';
import { DailySalesTable, NextVersionAction, PublisherNotes, ReportAvailable, ReportContracts, ReportDataTools, ReportPeriod, ReportProduct, ReportRevenue, SalesTrend, SpecPurchases, type ReportPartProps } from './ReportParts';

type ReportSection='overview'|'trend'|'daily'|'product'|'specs'|'notes'|'contracts'|'next-version';
export function GenerationThreeReport(props:ReportPartProps) {
  const {i18n,report,snapshot}=props;
  const [current,setCurrent]=useState<ReportSection>('overview');
  const sections=useRef<Partial<Record<ReportSection,HTMLElement>>>({});
  const targets:{id:ReportSection;label:MessageKey}[]=[{id:'overview',label:'shipping.overview'},{id:'trend',label:'shipping.trend'},{id:'daily',label:'shipping.dailySales'},{id:'product',label:'shipping.targetProduct'},{id:'specs',label:'shipping.performanceOrder'},{id:'notes',label:'shipping.notes'},...(!report.prototype&&report.complete?[{id:'contracts' as const,label:'shipping.optionalWork' as const}]:[]),{id:'next-version',label:'shipping.nextVersion'}];
  const jump=(id:ReportSection)=>{
    const target=sections.current[id];
    if(!target)return;
    setCurrent(id);target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});
  };
  return <main className="shipping-page shipping-generation-3" data-generation="3" data-report-layout="partner-console">
    <header className="shipping-app-header"><b>{i18n.t('release.publisher')}</b><h1>{i18n.t('shipping.partnerReport')}</h1><span>{report.title}</span></header>
    <div className="shipping-app-layout">
      <div className="shipping-app-workspace">
        <section className="shipping-app-overview" tabIndex={-1} ref={node=>{sections.current.overview=node??undefined;}}>
          <h2>{i18n.t('shipping.reportProduct',{product:report.title})}</h2>
          <div className="shipping-finance-overview">
            <table className="shipping-finance-summary"><tbody>
              <tr><th scope="row">{i18n.t('release.revenue')}</th><td><ReportRevenue report={report} i18n={i18n}/></td></tr>
              <tr><th scope="row">{i18n.t('release.available')}</th><td><ReportAvailable report={report} i18n={i18n} snapshot={snapshot}/></td></tr>
            </tbody><tbody className="shipping-period-comparison" data-first-day={report.days[0]!} data-last-day={report.days.at(-1)!}><tr className="shipping-summary-group"><th colSpan={2}>{i18n.t('shipping.comparison')}</th></tr><tr><th scope="row">{i18n.t('release.dayNumber',{count:1})}</th><td>{i18n.t('release.dollars',{count:report.days[0]!})}</td></tr><tr><th scope="row">{i18n.t('release.dayNumber',{count:report.days.length})}</th><td>{i18n.t('release.dollars',{count:report.days.at(-1)!})}</td></tr></tbody></table>
            <nav className="shipping-finance-links" aria-label={i18n.t('shipping.reportSections')}><b>{i18n.t('shipping.reportSections')}</b><div>{targets.map(target=><button key={target.id} data-report-jump={target.id} aria-current={current===target.id?'location':undefined} onClick={()=>jump(target.id)}>{i18n.t(target.label)}</button>)}</div></nav>
          </div>
        </section>
        <div className="shipping-app-period-strip"><ReportPeriod report={report} i18n={i18n}/></div>
        <section className="shipping-app-details" tabIndex={-1} ref={node=>{sections.current.daily=node??undefined;}}><h2>{i18n.t('shipping.breakdown')}</h2><DailySalesTable report={report} i18n={i18n}/></section>
        <section className="shipping-app-trend" tabIndex={-1} ref={node=>{sections.current.trend=node??undefined;}}><SalesTrend report={report} i18n={i18n} kind="line"/></section>
        <div className="shipping-app-management">
          <section className="shipping-app-product" tabIndex={-1} ref={node=>{sections.current.product=node??undefined;}}><h2>{i18n.t('shipping.targetProduct')}</h2><ReportProduct {...props}/></section>
          <section className="shipping-app-specs shipping-right" tabIndex={-1} ref={node=>{sections.current.specs=node??undefined;}}><h2>{i18n.t('shipping.performanceOrder')}</h2><SpecPurchases {...props} balanceMarker={false}/></section>
        </div>
        <section className="shipping-app-notes" tabIndex={-1} ref={node=>{sections.current.notes=node??undefined;}}><h2>{i18n.t('shipping.notes')}</h2><PublisherNotes {...props}/></section>
        {!report.prototype&&report.complete&&<section className="shipping-app-contracts" tabIndex={-1} ref={node=>{sections.current.contracts=node??undefined;}}><h2>{i18n.t('shipping.optionalWork')}</h2><ReportContracts {...props}/></section>}
        <section className="shipping-app-execute" tabIndex={-1} ref={node=>{sections.current['next-version']=node??undefined;}}><h2>{i18n.t('shipping.nextVersion')}</h2><NextVersionAction {...props}/></section>
        <footer><ReportDataTools {...props}/></footer>
      </div>
    </div>
  </main>;
}
