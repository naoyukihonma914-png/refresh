import {APP_PARTS} from './appLayout';
import type {WorkshopPartId} from '../content/workshopCatalog';
import type {BuiltApp} from './desktopState';
import type {AppPartId} from './appLayout';
import type {GameState} from './state';
/** One production can fill several display roles without becoming several rewards. */
const ROLES:Partial<Record<BuiltApp,Record<string,WorkshopPartId>>>={
 files:{navigation:'files-back',places:'files-list',list:'files-list',status:'files-storage',sort:'files-sort',search:'files-search',large:'files-large'},
 mail:{messages:'mail-list',body:'mail-body',draft:'mail-reply',folders:'mail-folders'},
 photo:{image:'photo-display',source:'photo-switch',brightness:'photo-brightness',tone:'photo-tone',wallpaper:'photo-wallpaper',crop:'photo-crop',compare:'photo-compare'},
 bin:{trash:'bin-list',undo:'bin-undo',empty:'bin-empty'},
 clock:{time:'clock-time',timer:'clock-timer',calendar:'clock-calendar'},
 theme:{appearance:'theme-mode',slideshow:'theme-slideshow',iconSize:'theme-icons'},
 terminal:{output:'terminal-output',commands:'terminal-commands'},
 manager:{tabs:'manager-processes',processes:'manager-processes'},
};
export const workshopPartForRole=(app:BuiltApp,role:string):WorkshopPartId|null=>ROLES[app]?.[role]??null;
export function completedAppRoles(s:GameState,app:BuiltApp):AppPartId[]{
 return Object.entries(ROLES[app]??{}).flatMap(([role,id])=>{
  const unlocked=(APP_PARTS[app].base as readonly string[]).includes(role)||(s.run.desktop.upgrades as readonly string[]).includes(role)||(app==='mail'&&role==='folders'&&s.persistent.desktopPrefs.skills.includes('sortMail'));
  return unlocked&&s.run.workshop.parts[id]?.step===4?[role as AppPartId]:[];
 });
}
