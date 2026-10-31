import { LOCALES, TEST_LANGUAGE, type I18n } from '../content/i18n';

export function LanguageSelect({ i18n, onChange, includeTest = false }: {
  i18n: I18n;
  onChange: (language: string) => void;
  includeTest?: boolean;
}) {
  const choices = [...Object.keys(LOCALES)];
  if (includeTest || i18n.language === TEST_LANGUAGE) choices.push(TEST_LANGUAGE);
  return (
    <label className="language-select">
      {i18n.t('language.label')}
      <select title={i18n.languageName(i18n.language)} value={i18n.language} onChange={event => onChange(event.target.value)}>
        {choices.map(id => <option value={id} key={id}>{i18n.languageName(id)}</option>)}
      </select>
    </label>
  );
}
