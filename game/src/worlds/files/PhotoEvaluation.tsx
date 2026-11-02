import { useMemo } from 'react';
import type { I18n } from '../../content/i18n';
import type { Screenshot } from '../../systems/desktopState';
import { readCapture } from '../../systems/captureScene';
import { capturedContentSummary } from '../../systems/capturePhoto';

export function PhotoEvaluation({shot,i18n}:{shot:Screenshot;i18n:I18n}) {
 const {summary,origin}=useMemo(()=>{const scene=readCapture(shot);return {summary:capturedContentSummary(shot),origin:scene.evaluation?.origin??'legacy'};},[shot]);
 const t=i18n.t;
 return <section className="capture-evaluation" data-capture-evaluation="true" data-capture-visible={summary.count} data-capture-kinds={summary.kinds} data-capture-fully-hidden={summary.fullyHidden} data-capture-origin={origin}>
  <h2>{t('files.captureEvaluation')}</h2>
  <dl><div><dt>{t('files.captureVisibleParts')}</dt><dd>{i18n.integer(summary.count)}</dd></div><div><dt>{t('files.captureKinds')}</dt><dd>{i18n.integer(summary.kinds)}</dd></div><div><dt>{t('files.captureFullyHidden')}</dt><dd>{i18n.integer(summary.fullyHidden)}</dd></div></dl>
  <small>{t(origin==='legacy'?'files.captureLegacyEvaluation':'files.captureRecordedEvaluation')}</small>
 </section>;
}
