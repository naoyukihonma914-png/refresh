import { BALANCE } from '../config/balance';
import type { GameState } from './state';

/** Older saves may record their first export in any of these permanent/live records. */
export function hasWorkshopExport(state:GameState):boolean {
 const w=state.run.workshop,p=state.persistent;
 if(w.groupPuzzle)return w.groupPuzzle.shelf.length>0;
 return w.tokenDiscovered||w.guide.seen.includes('export')||w.guide.seen.includes('updateAvailable')
  ||p.progress.records['first-export']!==undefined
  ||Object.values(w.parts).some(part=>part&&part.exportedAt!==null)
  ||p.setDocuments.some(document=>Object.values(document.parts).some(part=>part&&part.exportedAt!==null))
  ||p.products.some(product=>product.exports.length>0)
  ||p.guideArchive.some(record=>record.kind==='kumiki'&&['export','updateAvailable'].includes(record.id));
}

/** Reserve token spending from the introduction until the upgrade is owned. */
export function tesseraUpdatePending(state:GameState):boolean {
 return !state.persistent.editorSkills.includes('update')
  &&(state.persistent.tesseraUpdateGrantReceived===true||state.run.version==='v0.1'&&hasWorkshopExport(state));
}

/** Also runs on normal workshop activity, rescuing first-run saves with nothing left to export. */
export function grantTesseraUpdateFunds(state:GameState):GameState {
 if(state.run.version!=='v0.1'||state.persistent.tesseraUpdateGrantReceived
  ||state.persistent.editorSkills.includes('update')||!hasWorkshopExport(state))return state;
 const w=state.run.workshop,seen=w.guide.seen.includes('updateAvailable')?w.guide.seen:[...w.guide.seen,'updateAvailable' as const];
 return {...state,resources:{...state.resources,tokens:state.resources.tokens+BALANCE.workshop.updateGrantTokens},
  persistent:{...state.persistent,tesseraUpdateGrantReceived:true},
  run:{...state.run,workshop:{...w,guide:{seen,current:'updateAvailable',collapsed:false}}}};
}
