import type {I18n} from '../content/i18n';
import type {GameRuntime,RuntimeSnapshot} from '../systems/runtime';
import {EditorShell} from '../components/EditorShell';
import {editorStage} from '../systems/appearance';
import {passivePixelsPerSecond} from '../systems/economy';
import {BALANCE} from '../config/balance';
export function Workshop({runtime,snapshot,i18n,embedded=false}:{runtime:GameRuntime;snapshot:RuntimeSnapshot;i18n:I18n;embedded?:boolean}){
 const s=snapshot.state,w=s.run.workshop;
 return <EditorShell stage={editorStage(s)} className={embedded?'editor-bootstrap-embedded':'editor-bootstrap'} top={<><strong>{i18n.t('k.app')}</strong><span>{i18n.t('foundation.pixels',{pixels:i18n.pixels(s.resources.pixels)})}</span><button onClick={()=>runtime.pressSeed()}>{i18n.t('ws.generate')}</button></>} parts={<section><h2>{i18n.t('ws.parts')}</h2><p>{i18n.t('ws.guide.entered')}</p></section>} bottom={<span>{i18n.t('ws.rate',{count:i18n.rate(passivePixelsPerSecond(s))})}</span>}>
  {w.enterMs>0&&<progress aria-label={i18n.t('k.app')} max={BALANCE.workshop.enterMs} value={BALANCE.workshop.enterMs-w.enterMs}/>}
 </EditorShell>;
}
