import type { I18n } from '../content/i18n';
import { canSave } from '../systems/state';
import type { RuntimeSnapshot } from '../systems/runtime';
import { LanguageSelect } from '../components/LanguageSelect';

export function Foundation({ snapshot, i18n, onLanguageChange }: {
  snapshot: RuntimeSnapshot; i18n: I18n; onLanguageChange: (language: string) => void;
}) {
  const { state, offline } = snapshot;
  return (
    <main className="foundation">
      <p><b>{i18n.t('foundation.goalLabel')}</b>{i18n.t('foundation.goal')}</p>
      <p>{i18n.t('foundation.pixels', { pixels: i18n.pixels(state.resources.pixels) })}</p>
      <p className="save-status">
        {canSave(state) && state.lastSavedAt !== null
          ? i18n.t('save.saved', { time: i18n.time(state.lastSavedAt) })
          : i18n.t('save.unavailableUntilBuilt')}
      </p>
      {offline && <p role="status">{i18n.t('offline.notice', {
        duration: i18n.duration(offline.creditedMs), pixels: i18n.pixels(offline.pixels), count: Math.floor(offline.pixels),
      })}</p>}
      <p className="language-settings"><LanguageSelect i18n={i18n} onChange={onLanguageChange} /></p>
    </main>
  );
}
