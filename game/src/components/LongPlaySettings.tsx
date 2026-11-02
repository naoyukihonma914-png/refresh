import {ACHIEVEMENTS,CONTRACTS,activeContract,bulkVisible,globalMultiplier,previousWorldMultiplier,type ContractId} from '../systems/longPlay';
import type {GameState} from '../systems/state';
import type {GameRuntime} from '../systems/runtime';
import type {I18n} from '../content/i18n';
export function Records({state:s,i18n}:{state:GameState;i18n:I18n}){
 if(s.legacyGeneration)return null;
 const p=s.persistent.progress;
 return <section className="records-settings"><p>{i18n.t('record.bonus',{count:Object.keys(p.records).length,factor:i18n.number(globalMultiplier(s))})}</p><div className="records-table-scroll"><table className="native-table records-table"><thead><tr><th>{i18n.t('settings.records')}</th><th>{i18n.t('record.date')}</th></tr></thead><tbody>{ACHIEVEMENTS.map(id=><tr key={id} data-achievement={id}><td>{p.records[id]===undefined&&id.startsWith('secret-')?i18n.t('record.hidden'):i18n.t(`achievement.${id}`)}</td><td>{p.records[id]===undefined?i18n.t('record.unearned'):i18n.date(p.records[id]!)+' '+i18n.time(p.records[id]!)}</td></tr>)}</tbody></table></div></section>;
}
export function SoundSettings({state:s,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}){
 if(s.legacyGeneration)return null;
 const sound=s.persistent.progress.sound;
 return <fieldset className="sound-settings"><legend>{i18n.t('settings.sound')}</legend><label><input type="checkbox" aria-label={i18n.t('sound.enabled')} checked={sound.enabled} onChange={e=>runtime.common({type:'sound',enabled:e.target.checked})}/>{i18n.t('sound.enabled')}</label><label>{i18n.t('sound.volume')}<input aria-label={i18n.t('sound.volume')} type="range" min="0" max="1" step=".05" value={sound.volume} onChange={e=>runtime.common({type:'sound',volume:Number(e.target.value)})}/><output>{i18n.t('number.percent',{value:i18n.integer(sound.volume*100)})}</output></label></fieldset>;
}
export function BulkControl({state:s,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}){
 if(s.legacyGeneration||!bulkVisible(s))return null;
 return <label className="bulk-control">{i18n.t('bulk.quantity')}<select aria-label={i18n.t('bulk.quantity')} value={s.persistent.progress.bulk} onChange={e=>runtime.common({type:'bulk',mode:e.target.value as 'one'})}>{(['one','ten','max'] as const).map(mode=><option value={mode} key={mode}>{i18n.t(`bulk.${mode}`)}</option>)}</select></label>;
}
export function ContractStatus({state:s,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}){
 if(s.legacyGeneration)return null;
 const id=activeContract(s);if(!id)return s.run.play.contract?.status==='complete'?<p className="contract-status is-complete">{i18n.t('contract.completed',{name:i18n.t(`contract.${s.run.play.contract.id}`)})}</p>:null;
 return <p className="contract-status">{i18n.t('contract.active',{name:i18n.t(`contract.${id}`)})} <button onClick={()=>runtime.common({type:'contract-cancel'})}>{i18n.t('contract.cancel')}</button></p>;
}
export function ContractSelection({state:s,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}){
 if(s.legacyGeneration)return null;
 if(s.persistent.progress.records['v1-released']===undefined)return null;
 return <section className="contract-selection"><h2>{i18n.t('contract.title')}</h2><p>{i18n.t('contract.offer')}</p><label><select aria-label={i18n.t('contract.title')} value={s.persistent.progress.selected??''} onChange={e=>runtime.common({type:'contract-select',id:(e.target.value||null) as ContractId|null})}><option value="">{i18n.t('contract.none')}</option>{CONTRACTS.map(c=><option key={c.id} value={c.id} disabled={s.persistent.progress.completed[c.id]!==undefined}>{i18n.t(`contract.${c.id}`)}</option>)}</select></label><p>{i18n.t('contract.reward')}</p></section>;
}
export function CosmeticSelection({state:s,runtime,i18n}:{state:GameState;runtime:GameRuntime;i18n:I18n}){
 if(s.legacyGeneration||!Object.keys(s.persistent.progress.completed).length)return null;
 return <label className="cosmetic-setting">{i18n.t('contract.cosmetic')}<select aria-label={i18n.t('contract.cosmetic')} value={s.persistent.progress.cosmetic??''} onChange={e=>runtime.common({type:'cosmetic',id:(e.target.value||null) as ContractId|null})}><option value="">{i18n.t('page.standard')}</option>{CONTRACTS.filter(c=>s.persistent.progress.completed[c.id]!==undefined).map(c=><option key={c.id} value={c.id}>{i18n.t(`contract.cosmetic.${c.id}`)}</option>)}</select></label>;
}
export function ProductionFactors({state:s,i18n,previous=true}:{state:GameState;i18n:I18n;previous?:boolean}){
 if(s.legacyGeneration)return null;
 return <div className="production-factors"><p>{i18n.t('record.multiplier',{factor:i18n.number(globalMultiplier(s))})}</p>{previous&&<p>{i18n.t('record.previous',{factor:i18n.number(previousWorldMultiplier(s))})}</p>}</div>;
}
