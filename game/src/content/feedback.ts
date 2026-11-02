import type { I18n,MessageKey } from './i18n';
import type { Feedback } from '../systems/desktopState';
import type { GameState } from '../systems/state';
import { editorName } from '../systems/appearance';
export const feedbackName=(f:Feedback,i18n:I18n)=>f.kind==='search'?i18n.t('desktop.app.note'):f.kind==='part'?i18n.t(`ws.part.${f.target}` as MessageKey):f.kind==='capture'?i18n.t(`feedback.capture.${f.target}` as MessageKey):'';
export const feedbackSubject=(f:Feedback,i18n:I18n)=>i18n.t(`feedback.subject.${f.kind}`,{name:feedbackName(f,i18n),time:i18n.time(Number(f.target)||0)});
// Live mail, including completed requests, follows the currently selected editor.
// Frozen scenes pass their recorded state, so their name remains the recorded one.
export const feedbackBodyText=(s:GameState,f:Feedback,i18n:I18n,legacy=false)=>i18n.t(`feedback.body.${f.kind}`,{
 name:feedbackName(f,i18n),app:editorName(s,i18n,legacy),time:i18n.time(Number(f.target)||0),
});
