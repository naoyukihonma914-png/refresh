import { useRef, useState } from 'react';
import type { MessageKey } from '../../../content/i18n';
import { DailySalesTable, NextVersionAction, PublisherNotes, ReportAvailable, ReportComparison, ReportContracts, ReportDataTools, ReportPeriod, ReportProduct, ReportRevenue, SalesTrend, SpecPurchases, type ReportPartProps } from './ReportParts';

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
      <aside className="shipping-app-rail"><p>{report.title}</p><nav aria-label={i18n.t('shipping.reportSections')}>{targets.map(target=><button key={target.id} data-report-jump={target.id} aria-current={current===target.id?'location':undefined} onClick={()=>jump(target.id)}>{i18n.t(target.label)}</button>)}</nav></aside>
      <div className="shipping-app-workspace">
        <section className="shipping-app-overview" tabIndex={-1} ref={node=>{sections.current.overview=node??undefined;}}>
          <div className="shipping-app-title"><h2>{i18n.t('shipping.partnerReport')}</h2><ReportPeriod report={report} i18n={i18n}/></div>
          <dl className="shipping-kpi-cards"><div><dt>{i18n.t('release.revenue')}</dt><dd><ReportRevenue report={report} i18n={i18n}/></dd></div><div><dt>{i18n.t('release.available')}</dt><dd><ReportAvailable report={report} i18n={i18n} snapshot={snapshot}/></dd></div><div><dt>{i18n.t('shipping.comparison')}</dt><dd><ReportComparison report={report} i18n={i18n}/></dd></div></dl>
        </section>
        <section className="shipping-app-trend" tabIndex={-1} ref={node=>{sections.current.trend=node??undefined;}}><SalesTrend report={report} i18n={i18n} kind="line"/></section>
        <section className="shipping-app-details" tabIndex={-1} ref={node=>{sections.current.daily=node??undefined;}}><h2>{i18n.t('shipping.breakdown')}</h2><DailySalesTable report={report} i18n={i18n}/></section>
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
