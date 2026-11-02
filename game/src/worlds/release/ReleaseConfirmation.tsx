import { useEffect, useRef, useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { I18n } from '../../content/i18n';
import { activeScreenshots } from '../../systems/desktop';
import { canFundNextVersion, releaseEstimate } from '../../systems/release';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { ProductNameInput } from '../../components/ProductSettings';
import { ScreenshotPreview } from '../Desktop';

export function ReleaseConfirmation({ runtime, snapshot, i18n }: { runtime: GameRuntime; snapshot: RuntimeSnapshot; i18n: I18n }) {
  const { state } = snapshot;
  const shots = [...activeScreenshots(state)].reverse();
  const maximum = state.run.version === 'v0.1' ? 2 : BALANCE.release.storeMaxScreenshots;
  const dialog = useRef<HTMLElement>(null);
  const [chooser, setChooser] = useState(false), [page, setPage] = useState(0);
  useEffect(() => {
    const previous = dialog.current?.ownerDocument.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('input:not([disabled]),button:not([disabled])')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const [selected, setSelected] = useState<number[]>(() => shots.slice(0, maximum).map(shot => shot.id));
  const toggle = (id: number) => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < maximum ? [...previous, id] : previous);
  return <div className="release-confirm-layer"><div className="release-confirm-backdrop" aria-hidden="true"/><section ref={dialog} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();runtime.cancelPrototypeRelease();}
    if(event.key==='Tab'){
      const buttons=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),summary')??[])].filter(node=>node.getClientRects().length);
      const first=buttons[0],last=buttons.at(-1),active=dialog.current?.ownerDocument.activeElement;
      if(event.shiftKey&&active===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&active===last){event.preventDefault();first?.focus();}
    }
  }} className="release-confirmation" role="dialog" aria-modal="true" aria-labelledby="release-confirm-title">
    <header><h2 id="release-confirm-title">{i18n.t(state.run.version==='v0.1'?'release.confirm.title':'release.confirm.title.v1')}</h2></header>
    <div className="release-confirm-body">
      <p>{i18n.t(state.run.version === 'v0.1' ? 'release.confirm' : 'release.confirm.v1')}</p>
      {state.run.version === 'v0.1' && <ProductNameInput state={state} runtime={runtime} i18n={i18n} />}
      <p className="release-signature">{i18n.t('guide.signature')}</p>
      <details className="release-photo-picker" onToggle={event=>setChooser(event.currentTarget.open)}><summary>{i18n.t('store.choosePhotos', { count: selected.length, maximum })}</summary>
        {chooser && (shots.length ? <><div className="release-photo-grid">{shots.slice(page*6,(page+1)*6).map(shot => <label key={shot.id} className={selected.includes(shot.id) ? 'selected' : ''}>
          <input type="checkbox" checked={selected.includes(shot.id)} disabled={!selected.includes(shot.id) && selected.length >= maximum} onChange={() => toggle(shot.id)} />
          <span>{i18n.dateTime(shot.at)}</span>
          <ScreenshotPreview shot={shot} catalog={state.persistent.screenshots} runtime={runtime} snapshot={snapshot} i18n={i18n} />
        </label>)}</div>{shots.length>6&&<nav className="release-photo-pager"><button disabled={page===0} onClick={()=>setPage(page-1)}>{i18n.t('store.previous')}</button><span>{i18n.t('release.conditionsDone',{done:page+1,total:Math.ceil(shots.length/6)})}</span><button disabled={(page+1)*6>=shots.length} onClick={()=>setPage(page+1)}>{i18n.t('store.next')}</button></nav>}</> : <p>{i18n.t('store.noPhotos')}</p>)}
      </details>
      <p>{i18n.t('release.estimate', { dollars: i18n.integer(releaseEstimate(state,selected)) })}</p>
      {!canFundNextVersion(state,selected) && <p>{i18n.t(state.run.version === 'v0.1' ? 'release.needRevenue' : 'release.needRevenue.v1', { dollars: state.run.version === 'v0.1' ? BALANCE.spec.color[BALANCE.release.prototypeColorLevel]!.price : BALANCE.spec.refresh[BALANCE.release.v1RefreshLevel]!.price })}</p>}
    </div>
    <footer><button disabled={!canFundNextVersion(state,selected)} onClick={() => runtime.confirmProductRelease(selected)}>{i18n.t('release.action')}</button><button onClick={runtime.cancelPrototypeRelease}>{i18n.t('release.keepWorking')}</button></footer>
  </section></div>;
}
