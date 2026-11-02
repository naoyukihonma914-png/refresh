import { BALANCE } from '../config/balance';
import { readCapture } from './captureScene';
import { frozenContentVisibility, type CaptureEvaluation } from './captureEvaluation';
import type { Screenshot } from './desktopState';

export interface CapturedContentSummary {count:number;kinds:number;fullyHidden:number}
export function capturedContentSummary(shot:Screenshot):CapturedContentSummary {
  const scene=readCapture(shot),evaluation=(scene as typeof scene&{evaluation?:CaptureEvaluation}).evaluation;
  const contents=evaluation??frozenContentVisibility(scene);
  return {count:contents.visibleCount,kinds:contents.kinds,fullyHidden:contents.fullyHidden};
}
export function photoContentQuality(shot:Screenshot):number {
  const summary=capturedContentSummary(shot),settings=BALANCE.capture;
  return Math.min(1,Math.max(0,Math.min(1,summary.count/settings.photoQualityParts)*settings.photoQualityWeights.parts+Math.min(1,summary.kinds/settings.photoQualityKinds)*settings.photoQualityWeights.kinds));
}
