import {BALANCE} from '../config/balance';
import {targetFor} from './kumiki';
import type {GameState} from './state';
export function observeProgress(before:GameState,after:GameState):GameState {
 if(before.run.version!==after.run.version||before.createdAt!==after.createdAt)return after;
 const p=after.persistent.progress,counts={...p.counts},k=after.run.kumiki;
 if(before.run.kumiki.drift&&!k.drift)counts.repairs++;
 if(before.run.desktop.stalled&&!after.run.desktop.stalled)counts.restarts++;
 const previousShot=Math.max(0,...before.persistent.screenshots.map(s=>s.id));counts.shots+=after.persistent.screenshots.filter(s=>s.id>previousShot).length;
 counts.feedback+=after.run.desktop.feedback.filter(f=>f.completedAt!==null&&before.run.desktop.feedback.some(old=>old.id===f.id&&old.completedAt===null)).length;
 let unknownArt=p.unknownArt;
 for(const [id,drawing] of Object.entries(k.drawings)){
  const old=before.run.kumiki.drawings[id];
  if(!drawing.exported||old?.exported&&(!old.dirty||drawing.dirty))continue;
  if(!old?.exported)counts.icons++;
  if(!unknownArt){const target=targetFor(after,id,drawing.size);if(drawing.frames[0]!.filter((c,i)=>c>=0&&target[i]===-1).length>=BALANCE.longPlay.secretArtCells)unknownArt={size:drawing.size,frames:structuredClone(drawing.frames)};}
 }
 if(unknownArt===p.unknownArt&&Object.keys(counts).every(k=>counts[k as keyof typeof counts]===p.counts[k as keyof typeof counts]))return after;
 return {...after,persistent:{...after.persistent,progress:{...p,counts,unknownArt}}};
}
