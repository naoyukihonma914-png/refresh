import type { I18n } from '../content/i18n';
import type { GameState } from '../systems/state';
import { seedEra, unlockedSeedEra, type SeedEra } from '../systems/seedAppearance';

export function SeedAppearanceSelect({ state, i18n, onChange }: { state: GameState; i18n: I18n; onChange(era: SeedEra): void }) {
  if (unlockedSeedEra(state) === 0) return null;
  return <fieldset className="seed-era-setting"><legend>{i18n.t('seed.era.appearance')}</legend>
    <select aria-label={i18n.t('seed.era.appearance')} value={seedEra(state)} onChange={event => onChange(Number(event.target.value) as SeedEra)}>
      {([0, 1] as const).map(era => <option key={era} value={era}>{i18n.t(`seed.era.${era}`)}</option>)}
    </select>
  </fieldset>;
}
