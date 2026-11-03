import type { TestInteraction, WorkshopPartId } from './workshopCatalog';

export type FinishTrialKind = 'window'|'scroll-page'|'apply'|'heading'|'progress'|'taskbar'|'selection'|'icon'|'notification'|'wallpaper'|'upgrades'|'file-list'|'back'|'sort'|'search'|'large'|'storage'|'mail-list'|'mail-body'|'reply'|'folders'|'unread';
export interface FinishTrialDefinition { part:WorkshopPartId;kind:FinishTrialKind;interaction:TestInteraction;hintKey:string }
const definitions = {
 'common-frame':['window','press'],
 'common-scrollbar':['scroll-page','scroll'],
 'common-button':['apply','press'],
 'common-heading':['heading','select'],
 'common-progress':['progress','select'],
 'foundation-taskbar':['taskbar','select'],
 'foundation-desktop':['selection','select'],
 'foundation-icons':['icon','select'],
 'foundation-notification':['notification','press'],
 'foundation-wallpaper':['wallpaper','select'],
 'foundation-upgrades':['upgrades','press'],
 'files-list':['file-list','select'],
 'files-back':['back','press'],
 'files-sort':['sort','select'],
 'files-search':['search','input'],
 'files-large':['large','toggle'],
 'files-storage':['storage','select'],
 'mail-list':['mail-list','select'],
 'mail-body':['mail-body','scroll'],
 'mail-reply':['reply','press'],
 'mail-folders':['folders','select'],
 'mail-unread':['unread','toggle'],
} as const satisfies Partial<Record<WorkshopPartId,readonly[FinishTrialKind,TestInteraction]>>;
export const FINISH_TRIALS:readonly FinishTrialDefinition[]=Object.entries(definitions).map(([part,[kind,interaction]])=>({part:part as WorkshopPartId,kind,interaction,hintKey:`tp.finish.${part}.hint`}));
export const finishTrialFor=(part:WorkshopPartId):FinishTrialDefinition|null=>FINISH_TRIALS.find(definition=>definition.part===part)??null;
