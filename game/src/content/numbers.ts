/** Shared number policy; messages supply the unit names rather than ICU's limited huge-number suffixes. */
export function formatGameNumber(value: number, options: { intl: string; language: string; threshold: number; digits: number; notation: 'compact' | 'scientific'; unit(exponent: number): string }): string {
  const { intl, language, threshold, digits, notation, unit } = options;
  const plain = new Intl.NumberFormat(intl,{maximumFractionDigits:digits});
  if (notation === 'scientific' && Math.abs(value) >= threshold) return new Intl.NumberFormat(intl,{notation:'scientific',maximumFractionDigits:digits}).format(value).replace('E','e');
  if (Math.abs(value)<threshold) return plain.format(value);
  const base=language==='ja'?4:3;
  let exponent=Math.min(24,Math.floor(Math.log10(Math.abs(value))/base)*base);
  if (Math.round(Math.abs(value)/10**exponent*10**digits)/10**digits>=10**base && exponent<24) exponent+=base;
  return `${plain.format(value/10**exponent)}${unit(exponent)}`;
}
