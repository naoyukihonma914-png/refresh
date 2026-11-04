import type { GameState } from '../../systems/state';
import { canExportWorkshop } from '../../systems/workshop';
import type { I18n } from '../../content/i18n';
import { BALANCE } from '../../config/balance';
import { WorkshopGlyph } from './WorkshopGlyph';
import type { CSSProperties } from 'react';

export function WorkshopExportButton({state,i18n,reducedMotion,onExport}:{state:GameState;i18n:I18n;reducedMotion:boolean;onExport:()=>void}){
 const pending=canExportWorkshop(state);
 return <button type="button" className="fe-export ws-export-button" data-workshop-action="export" data-export-pending={pending} data-reduced-motion={reducedMotion||undefined} disabled={!pending} style={{'--export-pulse':`${BALANCE.workshop.fitting.exportPulseMs}ms`} as CSSProperties} onClick={onExport}><WorkshopGlyph name="up"/>{i18n.t('ws.export')}</button>;
}
