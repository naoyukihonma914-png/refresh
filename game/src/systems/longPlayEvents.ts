import type {GameState} from './state';
/** Observe irreversible facts, never replay production or grant its rewards. */
export function observeProgress(before:GameState,after:GameState):GameState {
 if(before.run.version!==after.run.version||before.createdAt!==after.createdAt)return after;
 const p=after.persistent.progress,counts={...p.counts};
 if(before.run.desktop.stalled&&!after.run.desktop.stalled)counts.restarts++;
 const previousShot=Math.max(0,...before.persistent.screenshots.map(s=>s.id));
 counts.shots+=after.persistent.screenshots.filter(s=>s.id>previousShot).length;
 counts.feedback+=after.run.desktop.feedback.filter(f=>f.completedAt!==null&&before.run.desktop.feedback.some(old=>old.id===f.id&&old.completedAt===null)).length;
 if(Object.keys(counts).every(k=>counts[k as keyof typeof counts]===p.counts[k as keyof typeof counts]))return after;
 return {...after,persistent:{...after.persistent,progress:{...p,counts}}};
}
