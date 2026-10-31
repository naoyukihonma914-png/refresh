// 自作の下絵。既存アプリの図柄・ロゴは使わない。-1 は透明。
export const ICON_IDS = ['folder', 'bin', 'clock', 'mail', 'photo', 'settings'] as const;
export const PRACTICE_IDS = ['document', 'image', 'music', 'video', 'archive', 'text', 'chart', 'terminal', 'link', 'star'] as const;
// 見本02の落ち着いた16色。配列順もパレットの並びに合わせる。
export const BASE_PALETTE = ['#101018', '#3a3450', '#6b6478', '#b8b2a8', '#f4efe4', '#7a2e2a', '#d0523a', '#e8a317', '#f6d27a', '#2f6b3a', '#6fbf5a', '#1f3f7a', '#3f7fd0', '#7cc4f2', '#6a3a7a', '#c98a6a'];
// 第3版以前の色番号を新しいパレットへ移すときだけ使う。
const LEGACY_PALETTE = ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0', '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#ffffff', '#8080c0'];
export const LEGACY_COLOR_MAP = [0, 5, 9, 7, 11, 14, 13, 3, 2, 6, 10, 8, 12, 15, 4, 1];
export const homeButtonColor = (colorLevel: number) => colorLevel === 0 ? '#008080' : '#285b75';

export function paletteFor(level: number): string[] {
  return level === 0 ? BASE_PALETTE : extendPalette(BASE_PALETTE);
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

export function scaleArt(pixels: readonly number[], from: number, to: number): number[] {
  return Array.from({ length: to * to }, (_, i) => pixels[Math.floor(Math.floor(i / to) * from / to) * from + Math.floor(i % to * from / to)] ?? -1);
}

export function iconTemplate(id: string, size: number): number[] {
  const base = Array<number>(256).fill(-1);
  const put = (x: number, y: number, c: number) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) base[y * 16 + x] = c; };
  const box = (x: number, y: number, w: number, h: number, c: number, border = 0) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, i === x || j === y || i === x + w - 1 || j === y + h - 1 ? border : c);
  };
  if (id === 'folder') { box(1, 3, 6, 3, 3); box(1, 5, 14, 9, 3); for (let x = 2; x < 14; x++) put(x, 6, 11); }
  else if (id === 'bin') { box(4, 4, 8, 10, 7); box(3, 2, 10, 3, 8); for (let y = 6; y < 13; y++) { put(6, y, 8); put(9, y, 8); } }
  else if (id === 'clock' || id === 'settings') {
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 6.6) put(x, y, d > 5.4 ? 0 : id === 'clock' ? 14 : d < 2.5 ? 0 : 8);
    }
    if (id === 'clock') { for (let y = 4; y <= 8; y++) put(8, y, 0); for (let x = 8; x < 12; x++) put(x, 8, 1); }
    else for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7]]) box(x!, y!, 2, 2, 8);
  } else if (id === 'mail') { box(1, 3, 14, 10, 14); for (let x = 2; x < 14; x++) put(x, 4 + Math.floor(Math.min(x - 2, 13 - x) / 2), 4); }
  else if (id === 'photo' || id === 'image') { box(1, 2, 14, 12, 6); for (let x = 2; x < 14; x++) for (let y = 13 - Math.min(x, 15 - x); y < 13; y++) put(x, y, 2); put(11, 5, 11); }
  else {
    const variant = Math.max(0, PRACTICE_IDS.indexOf(id as typeof PRACTICE_IDS[number]));
    box(3, 1, 10, 14, 14);
    for (let y = 4; y < 12; y++) for (let x = 5; x < 11; x++) if ((x + y + variant) % (2 + variant % 3) === 0) put(x, y, [4, 6, 3, 1][variant % 4]!);
  }
  const colored = base.map(color => color < 0 ? color : LEGACY_COLOR_MAP[color]!);
  return size === 16 ? colored : scaleArt(colored, 16, size);
}
