import { BALANCE } from '../config/balance';
// Shared indexed colour palette. No drawing document or template lives here.
// 見本02の落ち着いた16色。配列順もパレットの並びに合わせる。
export const BASE_PALETTE = ['#101018', '#3a3450', '#6b6478', '#b8b2a8', '#f4efe4', '#7a2e2a', '#d0523a', '#e8a317', '#f6d27a', '#2f6b3a', '#6fbf5a', '#1f3f7a', '#3f7fd0', '#7cc4f2', '#6a3a7a', '#c98a6a'];
// 第3版以前の色番号を新しいパレットへ移すときだけ使う。
const LEGACY_PALETTE = ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0', '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#ffffff', '#8080c0'];
export const LEGACY_COLOR_MAP = [0, 5, 9, 7, 11, 14, 13, 3, 2, 6, 10, 8, 12, 15, 4, 1];
export const homeButtonColor = (colorLevel: number) => colorLevel === 0 ? '#008080' : '#285b75';

export function paletteFor(level: number): string[] {
  if(level===0)return BASE_PALETTE;
  const colors=extendPalette(BASE_PALETTE),secret=BALANCE.longPlay.secretPartColor;
  // Reserve one extended swatch; original16/cube indices and historical captures stay fixed.
  if(!colors.includes(secret))colors[colors.length-1]=secret;
  return colors;
}
export const legacyPalette = () => extendPalette(LEGACY_PALETTE);
function extendPalette(base: string[]): string[] {
  const colors = [...base];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    const value = '#' + [r, g, b].map(v => (v * 51).toString(16).padStart(2, '0')).join('');
    if (!colors.includes(value)) colors.push(value);
  }
  for (let gray = 0; colors.length < 256 && gray < 256; gray++) {
    const value = '#' + gray.toString(16).padStart(2, '0').repeat(3);
    if (!colors.includes(value)) colors.push(value);
  }
  return colors;
}
