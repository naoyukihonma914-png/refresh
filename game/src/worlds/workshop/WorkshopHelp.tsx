import { useEffect,useId,useRef } from 'react';
import type { I18n,MessageKey } from '../../content/i18n';
import { workshopHelpFor } from '../../content/workshopHelp';
import type { WorkshopHelpTarget } from '../../systems/workshopState';
import { WorkshopSchematic,WorkshopDestinationGlyph } from './WorkshopSchematic';

export function WorkshopHelp({target,i18n,stage,onClose}:{target:WorkshopHelpTarget;i18n:I18n;stage:number;onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null),titleId=useId(),descriptionId=useId();
 const help=workshopHelpFor(target.set,target.part),name=i18n.t(help.labelKey as MessageKey);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const previous=node.ownerDocument.activeElement as HTMLElement|null,workshop=node.closest('.workshop-root');
  node.querySelector<HTMLButtonElement>('[data-workshop-help-close]')?.focus();
  return()=>{if(previous?.isConnected)previous.focus();else workshop?.querySelector<HTMLElement>('[data-workshop-next]')?.focus();};
 },[]);
 return <div className="ws-help-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section ref={dialog} className="ws-help-dialog" data-workshop-help-dialog data-help-set={target.set} data-help-part={target.part} data-editor-stage={stage} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={event=>{
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')];
    const first=controls[0],last=controls.at(-1),focused=event.currentTarget.ownerDocument.activeElement;
    if(first&&last&&(!controls.includes(focused as HTMLElement)||event.shiftKey&&focused===first||!event.shiftKey&&focused===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
   }
  }}>
   <header><WorkshopDestinationGlyph set={target.set}/><h2 id={titleId}>{i18n.t('tp.workshop.helpTitle' as MessageKey,{name})}</h2><button type="button" data-workshop-help-close aria-label={i18n.t('tp.workshop.helpClose' as MessageKey)} onClick={onClose}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3 13 13M13 3 3 13" stroke="currentColor" fill="none"/></svg></button></header>
   <WorkshopSchematic set={target.set} part={target.part} i18n={i18n}/>
   <p id={descriptionId}>{i18n.t(help.descriptionKey as MessageKey)}</p>
  </section>
 </div>;
}
