import type { CSSProperties } from 'react';
import type { Design } from '../../systems/kumikiState';

export function designStyle(design?: Design): CSSProperties {
  if (!design) return {};
  const rgb = [1, 3, 5].map(start => parseInt(design.color.slice(start, start + 2), 16));
  const bright = (rgb[0]! * 299 + rgb[1]! * 587 + rgb[2]! * 114) / 1000 > 150;
  return { backgroundColor: design.color, color: bright ? '#000' : '#fff', borderRadius: design.radius,
    fontSize: { small: 12, medium: 14, large: 18 }[design.textSize], boxShadow: design.shadow ? '2px 2px 0 #808080' : 'none' };
}
