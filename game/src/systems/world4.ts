import { BALANCE } from '../config/balance';
import { partsForSet, type UiSetId } from '../content/workshopCatalog';
import type { GameState } from './state';
import { isCompleteSetDocument } from './workshopState';

/** Preparation only: the streaming world's runtime and transition belong to a later stage. */
export interface World4Preparation {
  versionAllowed:boolean;
  desktopAvailable:boolean;
  requiredSets:readonly UiSetId[];
  completedSets:UiSetId[];
  storedSets:UiSetId[];
  requiredHz:number;
  currentHz:number;
  ready:boolean;
}
const requiredSets:readonly UiSetId[]=['stream'];
export function world4Preparation(state:GameState):World4Preparation {
  const versionAllowed=state.run.version===BALANCE.world4.minimumVersion;
  const desktopAvailable=state.run.world==='desktop'&&state.run.desktop.entered;
  const completedSets=requiredSets.filter(set=>partsForSet(set).every(part=>state.run.workshop.parts[part.id]?.step===4));
  const storedSets=requiredSets.filter(set=>state.persistent.setDocuments.some(document=>document.version===state.run.version&&document.set===set&&isCompleteSetDocument(document)));
  const requiredHz=BALANCE.world4.refreshHz[BALANCE.world4.requiredRefreshLevel]!;
  const currentHz=BALANCE.world4.refreshHz[state.persistent.specs.refresh]!;
  return {versionAllowed,desktopAvailable,requiredSets,completedSets,storedSets,requiredHz,currentHz,
    ready:versionAllowed&&desktopAvailable&&completedSets.length===requiredSets.length&&storedSets.length===requiredSets.length&&currentHz>=requiredHz};
}
