import { desktopScreen, resizeDesktop } from './desktopGeometry';
import { BALANCE } from '../config/balance';
import type { I18n } from '../content/i18n';
import type { GameState } from './state';
import type { AppId } from './desktopState';
export type VisualStage=0|1|2;
export interface Appearance {editor:VisualStage;desktop:VisualStage}
export const createAppearance=():Appearance=>({editor:0,desktop:0});
export const unlockedEditorStage=(s:GameState):VisualStage=>s.persistent.artwork.skills.includes('modern')?2:s.persistent.artwork.skills.includes('update')?1:0;
export const unlockedDesktopStage=(s:GameState):VisualStage=>s.persistent.desktopPrefs.skills.includes('major2')?2:s.persistent.desktopPrefs.skills.includes('major1')?1:0;
export const editorStage=(s:GameState):VisualStage=>s.persistent.appearance?.editor??0;
export const desktopStage=(s:GameState):VisualStage=>s.persistent.appearance?.desktop??0;
export const canSwitchEditor=(s:GameState)=>unlockedDesktopStage(s)>=BALANCE.appearance.gessoRequirement&&s.persistent.artwork.skills.includes('update');
export const editorName=(s:GameState,i18n:I18n,legacy=false)=>i18n.t(!legacy&&editorStage(s)===2?'appearance.gesso':'k.app');
export const appName=(s:GameState,app:AppId,i18n:I18n,legacy=false)=>app==='tessera'?editorName(s,i18n,legacy):i18n.t(`desktop.app.${app}`);
export function setEditorStage(s:GameState,stage:VisualStage):GameState {
 if(![0,1,2].includes(stage)||stage>unlockedEditorStage(s))return s;
 return {...s,persistent:{...s.persistent,appearance:{...s.persistent.appearance,editor:stage},artwork:{...s.persistent.artwork,modern:stage===2}}};
}
export function setDesktopStage(s:GameState,stage:VisualStage):GameState {
 if(![0,1,2].includes(stage)||stage>unlockedDesktopStage(s))return s;
 return {...s,persistent:{...s.persistent,appearance:{...s.persistent.appearance,desktop:stage}},run:{...s.run,desktop:resizeDesktop(s.run.desktop,desktopScreen(stage),s.persistent.desktopPrefs.iconSize)}};
}
