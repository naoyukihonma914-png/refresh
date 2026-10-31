import type { I18n } from '../content/i18n';

export function Intro({ i18n, onStart }: { i18n: I18n; onStart(): void }) {
  return <main className="intro-note">
    <pre>{i18n.t('intro.note')}</pre>
    <p><button type="button" onClick={onStart}>{i18n.t('intro.start')}</button></p>
  </main>;
}
