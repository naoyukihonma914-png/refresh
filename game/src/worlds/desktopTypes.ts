import type { I18n } from '../content/i18n';
import type { CaptureScene } from '../systems/captureScene';
import type { Screenshot } from '../systems/desktopState';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
export interface DesktopProps {runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;preview?:boolean;catalog?:Screenshot[];capture?:CaptureScene}
