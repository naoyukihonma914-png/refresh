import type { I18n } from '../content/i18n';
import type { GameRuntime } from '../systems/runtime';
import type { GameState } from '../systems/state';
import { editorStage,desktopStage,unlockedEditorStage,unlockedDesktopStage,type VisualStage } from '../systems/appearance';
interface Props {state:GameState;runtime:GameRuntime;i18n:I18n}
export function EditorAppearance({state,runtime,i18n}:Props){
 const max=unlockedEditorStage(state);if(max===0)return null;
 return <label className="appearance-setting">{i18n.t('appearance.editor')}<select aria-label={i18n.t('appearance.editor')} value={editorStage(state)} onChange={e=>runtime.actKumiki({type:'editor-stage',stage:Number(e.target.value) as VisualStage})}>
 {([0,1,2] as const).filter(stage=>stage<=max).map(stage=><option key={stage} value={stage}>{i18n.t(`appearance.editor.${stage}`)}</option>)}
 </select></label>;
}
export function DesktopAppearance({state,runtime,i18n}:Props){
 const max=unlockedDesktopStage(state);if(max===0)return null;
 return <label className="appearance-setting">{i18n.t('appearance.desktop')}<select aria-label={i18n.t('appearance.desktop')} value={desktopStage(state)} onChange={e=>runtime.actDesktop({type:'desktop-stage',stage:Number(e.target.value) as VisualStage})}>
 {([0,1,2] as const).filter(stage=>stage<=max).map(stage=><option key={stage} value={stage}>{i18n.t(`appearance.desktop.${stage}`)}</option>)}
 </select></label>;
}
