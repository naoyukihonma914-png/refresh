import { BALANCE } from '../config/balance';
export function estimateSeconds(cost: number, pixels: number, rate: number): number | null {
  const seconds=(cost-pixels)/rate;
  if (!(rate>0) || !(seconds>0) || !Number.isFinite(seconds) || seconds>BALANCE.estimate.maxHours*3600) return null;
  const step=seconds>BALANCE.estimate.hourRoundingAfterSeconds?BALANCE.estimate.hourStep:seconds>BALANCE.estimate.minuteRoundingAfterSeconds?BALANCE.estimate.minuteStep:1;
  return Math.ceil(seconds/step)*step;
}
