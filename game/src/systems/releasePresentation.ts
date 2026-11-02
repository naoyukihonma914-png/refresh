import { unlockedDesktopStage } from './appearance';
import { readCapture } from './captureScene';
import type { ProductRecord } from './releaseState';
import type { GameState } from './state';

// These stages describe a published page, not additional playable desktop stages.
export type SoftwareStage = 0 | 1 | 2 | 3 | 4 | 5;
export interface ReleasePresentation { medium: 'software'; desktopStage: SoftwareStage; generation: 1 | 2 | 3 }
export function softwarePresentation(desktopStage: SoftwareStage): ReleasePresentation {
  return { medium: 'software', desktopStage, generation: desktopStage < 2 ? 1 : desktopStage < 4 ? 2 : 3 };
}
export function presentationAtRelease(state: GameState): ReleasePresentation {
  // Buying an evolution reaches that stage even if the player restores an older look.
  return softwarePresentation(unlockedDesktopStage(state));
}
export function isReleasePresentation(value: unknown): value is ReleasePresentation {
  if (!value || typeof value !== 'object') return false;
  const p = value as ReleasePresentation;
  return p.medium === 'software' && [0, 1, 2, 3, 4, 5].includes(p.desktopStage)
    && p.generation === softwarePresentation(p.desktopStage).generation;
}
export function releasePresentation(product: ProductRecord): ReleasePresentation {
  if (product.presentation) return product.presentation;
  // Pre-revision records keep their own frozen capture as the source of the era.
  // Never infer their presentation from the current run or a selected, older photo.
  if (product.capture) {
    const scene = readCapture(product.capture);
    if (scene.version !== 1) {
      const skills = scene.view.preferences.skills;
      const reached = skills.includes('major3') ? 3 : skills.includes('major2') ? 2 : skills.includes('major1') ? 1 : 0;
      return softwarePresentation(reached);
    }
  }
  return softwarePresentation(0);
}
