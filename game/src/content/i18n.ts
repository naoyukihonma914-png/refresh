import ja from './locales/ja.json';
import type { SpecKey } from '../config/balance';

export type MessageKey = keyof typeof ja.messages;
type Message = string | Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export interface Locale {
  _meta: { id: string; name: string; intl: string; direction: 'ltr' | 'rtl'; compactThreshold: number };
  messages: Record<MessageKey, Message>;
}

// ファイルを追加すれば、言語の登録と一覧への追加まで自動で行う。
const files = import.meta.glob<Locale>('./locales/*.json', { eager: true, import: 'default' });
export const LOCALES: Readonly<Record<string, Locale>> = Object.fromEntries(
  Object.values(files).map(locale => [locale._meta.id, locale]),
);
export const TEST_LANGUAGE = 'en-XA';

export function chooseLanguage(saved: string | undefined, preferred: readonly string[]): string {
  if (saved && LOCALES[saved]) return saved;
  for (const language of preferred) {
    const exact = LOCALES[language];
    if (exact) return exact._meta.id;
    const base = language.toLowerCase().split('-')[0]!;
    if (LOCALES[base]) return base;
  }
  return 'en';
}

function expandText(text: string): string {
  // 差し込みを壊さずに、文章部分を約1.4倍に伸ばす。
  const expanded = text.replace(/\{\w+\}|[^{}]+/g, part => part.startsWith('{') ? part
    : part + '~'.repeat(Math.ceil(part.length * 0.4)));
  return `[${expanded}]`;
}

export function createI18n(language: string, { strictInterpolation = import.meta.env.DEV } = {}) {
  const pseudo = language === TEST_LANGUAGE;
  const locale = LOCALES[pseudo ? 'en' : language] ?? LOCALES.en!;
  const intl = locale._meta.intl;
  const number = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat(intl, { maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 2 });
  const plural = new Intl.PluralRules(intl);
  const time = new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'short', day: 'numeric' });

  function t(key: MessageKey, params: Record<string, string | number> = {}): string {
    const message = locale.messages[key];
    const text = typeof message === 'string' ? message
      : message[plural.select(typeof params.count === 'number' ? params.count : 0)] ?? message.other;
    const template = pseudo ? expandText(text) : text;
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = params[name];
      if (value === undefined) {
        if (strictInterpolation) throw new Error(`Missing translation argument: ${key}.${name}`);
        return placeholder;
      }
      return typeof value === 'number' ? number.format(value) : value;
    });
  }

  function duration(milliseconds: number): string {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1_000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return minutes % 60 === 0 ? t('duration.hours', { count: hours })
      : t('duration.hoursMinutes', { count: hours, hours, minutes: minutes % 60 });
    return minutes > 0 ? t('duration.minutes', { count: minutes }) : t('duration.seconds', { count: seconds });
  }

  return {
    language: pseudo ? TEST_LANGUAGE : locale._meta.id,
    direction: locale._meta.direction,
    t,
    duration,
    number: (value: number) => number.format(value),
    pixels: (value: number) => value >= locale._meta.compactThreshold ? compact.format(value) : integer.format(Math.floor(value)),
    price: (value: number) => compact.format(value),
    time: (timestamp: number) => time.format(timestamp),
    date: (timestamp: number) => date.format(timestamp),
    spec: (key: SpecKey, level: number) => t(`spec.${key}.${level}` as MessageKey),
    languageName: (id: string) => id === TEST_LANGUAGE ? t('language.test')
      : id === 'ja' || id === 'en' ? t(`language.${id}`) : LOCALES[id]!._meta.name,
  };
}

export type I18n = ReturnType<typeof createI18n>;
