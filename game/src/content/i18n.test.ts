import { describe, expect, it } from 'vitest';
import { BALANCE, type SpecKey } from '../config/balance';
import { chooseLanguage, createI18n, LOCALES, TEST_LANGUAGE, type MessageKey } from './i18n';

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort() as string[];
}

describe('言語ファイルと表示', () => {
  it('すべての言語が同じ文言キーと差し込みを備えている', () => {
    const source = LOCALES.ja!;
    for (const locale of Object.values(LOCALES)) {
      expect(Object.keys(locale.messages).sort()).toEqual(Object.keys(source.messages).sort());
      for (const key of Object.keys(source.messages) as MessageKey[]) {
        const original = source.messages[key];
        const expected = placeholders(typeof original === 'string' ? original : original.other);
        const message = locale.messages[key];
        for (const text of typeof message === 'string' ? [message] : Object.values(message)) {
          expect(placeholders(text), `${locale._meta.id}.${key}`).toEqual(expected);
        }
      }
    }
  });

  it('保存済みの言語・ブラウザの希望順・英語の順で選ぶ', () => {
    expect(chooseLanguage('en', ['ja-JP'])).toBe('en');
    expect(chooseLanguage(undefined, ['ja-JP'])).toBe('ja');
    expect(chooseLanguage(undefined, ['de-DE', 'ja-JP'])).toBe('ja');
    expect(chooseLanguage(undefined, ['en-GB'])).toBe('en');
    expect(chooseLanguage('unknown', ['de-DE'])).toBe('en');
  });

  it.each([
    [1_000, '1秒'], [60_000, '1分'], [3_600_000, '1時間'],
    [7_200_000, '2時間'], [11_520_000, '3時間12分'],
  ])('%i ms を %s と表示する', (milliseconds, text) => {
    expect(createI18n('ja').duration(milliseconds)).toBe(text);
  });

  it('英語の単数・複数形を文全体で選ぶ', () => {
    const en = createI18n('en');
    expect(en.duration(1_000)).toBe('1 second');
    expect(en.duration(2_000)).toBe('2 seconds');
    expect(en.duration(3_600_000)).toBe('1 hour');
    expect(en.duration(11_520_000)).toBe('3 hours 12 min');
    expect(en.t('debug.cursorCount', { count: 1 })).toBe('1 automatic cursor');
    expect(en.t('debug.cursorCount', { count: 2 })).toBe('2 automatic cursors');
  });

  it('数・時刻・日付を言語に合わせ、資源の単位も切り替える', () => {
    const ja = createI18n('ja');
    const en = createI18n('en');
    expect(ja.pixels(836_240)).toBe('836,240');
    expect(en.pixels(836_240)).toBe('836,240');
    expect(ja.pixels(123_000_000)).toBe('1.23億');
    expect(en.pixels(1_230_000_000)).toBe('1.23B');
    expect(ja.price(800_000)).toBe('80万');
    expect(en.price(800_000)).toBe('800K');
    expect(en.time(0)).toMatch(/AM|PM/);
    expect(ja.time(0)).not.toMatch(/AM|PM/);
    expect(ja.date(0)).not.toBe(en.date(0));
  });

  it('試験用の言語で文章を約1.4倍に伸ばしても差し込みは残る', () => {
    const en = createI18n('en');
    const test = createI18n(TEST_LANGUAGE);
    expect(test.t('foundation.goal').length).toBeGreaterThanOrEqual(en.t('foundation.goal').length * 1.4);
    expect(test.t('foundation.pixels', { pixels: '123,456' })).toContain('123,456');
    expect(test.t('foundation.pixels', { pixels: '123,456' })).not.toContain('{pixels}');
  });

  it('性能の表示は数値設定から独立した翻訳を備える', () => {
    for (const key of Object.keys(BALANCE.spec) as SpecKey[]) {
      BALANCE.spec[key].forEach((_, level) => {
        expect(createI18n('ja').spec(key, level).length).toBeGreaterThan(0);
        expect(createI18n('en').spec(key, level).length).toBeGreaterThan(0);
      });
    }
  });
});
