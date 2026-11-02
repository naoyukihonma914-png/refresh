import type { BuiltApp } from '../systems/desktopState';
import type { WorkshopPartId } from './workshopCatalog';

/** Real native slots supplied by a completed workshop production. This is not an inventory. */
export const APP_RECIPES = {
 files:{navigation:'files-back',places:'files-back',list:'files-list',status:'files-storage',sort:'files-sort',search:'files-search',large:'files-large'},
 mail:{messages:'mail-list',body:'mail-body',draft:'mail-reply',folders:'mail-folders',unread:'mail-unread'},
 photo:{source:'photo-switch',image:'photo-display',brightness:'photo-brightness',tone:'photo-tone',wallpaper:'photo-wallpaper',crop:'photo-crop',compare:'photo-compare'},
 bin:{trash:'bin-list',empty:'bin-empty',undo:'bin-undo'},
 clock:{time:'clock-time',timer:'clock-timer',calendar:'clock-calendar'},
 theme:{appearance:'theme-mode',accent:'theme-accent',radius:'theme-radius',slideshow:'theme-slideshow',iconSize:'theme-icons'},
 terminal:{commands:'terminal-commands',output:'terminal-output',interval:'terminal-interval',run:'terminal-run',history:'terminal-history'},
 manager:{tabs:'manager-processes',processes:'manager-processes','performance':'manager-performance'},
} as const satisfies Record<BuiltApp,Record<string,WorkshopPartId>>;
export type AppSlotRole = { [A in BuiltApp]:keyof typeof APP_RECIPES[A] }[BuiltApp];
export const APP_REQUIRED = {
 files:['navigation','list'],mail:['messages','body'],photo:['image','brightness','tone','wallpaper'],bin:['trash','empty'],clock:['time'],theme:['appearance'],terminal:['commands','output','run'],manager:['processes'],
} as const satisfies Record<BuiltApp,readonly AppSlotRole[]>;
export function sourceForSlot(app:BuiltApp,role:string):WorkshopPartId|null {
 return (APP_RECIPES[app] as Record<string,WorkshopPartId>)[role]??null;
}
export const slotRoles=(app:BuiltApp):AppSlotRole[]=>Object.keys(APP_RECIPES[app]) as AppSlotRole[];
