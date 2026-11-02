import { useEffect, useRef, useState } from 'react';
import { WorkshopGlyph } from './WorkshopGlyph';
import { BALANCE, type EditorSkill } from '../../config/balance';
import type { I18n, MessageKey } from '../../content/i18n';
import type { WorkshopPartDefinition } from '../../content/workshopCatalog';
import { colorContrast, createComponentDesign, createEditorCustomization, usesNativeComponentColors, usesNativeEditorBackground, type ComponentDesign, type EditorCustomization, type PartProduction } from '../../systems/workshopState';
import type { WorkshopAction } from '../../systems/workshop';

export type WorkshopDispatch=(action:WorkshopAction)=>void;
export function ColorChoices({label,value,colors,onChange,against,native=false,nativeLabel,onNative,pairable=false,unavailableLabel}:{label:string;value:string;colors:readonly string[];onChange:(color:string)=>void;against?:string;native?:boolean;nativeLabel?:string;onNative?:()=>void;pairable?:boolean;unavailableLabel?:string}){
 return <fieldset className="ws-colors"><legend>{label}</legend>{onNative&&<button type="button" className="ws-native-colors" data-workshop-action="nativeColor" aria-pressed={native} onClick={onNative}>{nativeLabel}</button>}<div>{colors.map(color=><button type="button" key={color} aria-label={`${label} ${color}`} aria-pressed={!native&&value.toLowerCase()===color.toLowerCase()} disabled={against!==undefined&&colorContrast(color,against)<BALANCE.workshop.design.minContrast||pairable&&!colors.some(text=>colorContrast(color,text)>=BALANCE.workshop.design.minContrast)} title={pairable&&!colors.some(text=>colorContrast(color,text)>=BALANCE.workshop.design.minContrast)?unavailableLabel:undefined} style={{background:color}} onClick={()=>onChange(color)}><span aria-hidden="true" style={{color:colorContrast(color,'#000000')>=4.5?'#000000':'#ffffff'}}>{!native&&value.toLowerCase()===color.toLowerCase()?'✓':''}</span></button>)}</div></fieldset>;
}
export function PartInspector({part,production,stage,colors,skills,customization,dispatch,i18n}:{part:WorkshopPartDefinition;production:PartProduction;stage:number;colors:readonly string[];skills:readonly EditorSkill[];customization:EditorCustomization;dispatch:WorkshopDispatch;i18n:I18n}){
 const t=i18n.t,d=production.design,limits=BALANCE.workshop.design;
 const defaults=createComponentDesign();
 const adjustmentCount=(Object.keys(defaults) as Array<keyof ComponentDesign>).filter(key=>key!=='nativeColors'&&JSON.stringify(d[key])!==JSON.stringify(defaults[key])).length+(!usesNativeComponentColors(d)&&d.color===defaults.color&&d.textColor===defaults.textColor&&Object.keys(d.controlColors).length===0?1:0)+(production.step>=2&&JSON.stringify(production.elements)!==JSON.stringify(part.elements)?1:0);
 const patch=(patch:Partial<ComponentDesign>)=>dispatch({type:'adjust',part:part.id,patch});
 const range=(key:'radius'|'fontSize'|'scrollbarWidth'|'progressHeight',min:number,max:number)=><label>{t(`ws.${key}`)}<input data-workshop-adjust={key} title={key==='fontSize'?t('ws.fontFitHint'):undefined} type="range" min={min} max={max} value={d[key]} onChange={e=>patch({[key]:Number(e.target.value)})}/><output>{i18n.number(d[key])}</output></label>;
 const checkbox=(key:'shadow'|'arrows'|'separator'|'showPercent')=><label className="ws-check"><input data-workshop-adjust={key} type="checkbox" checked={d[key]} onChange={e=>patch({[key]:e.target.checked})}/>{t(`ws.${key}`)}</label>;
 return <div className="ws-inspector" data-workshop-inspector>
  <small className="ws-adjustment-summary" data-workshop-adjustments={adjustmentCount}>{adjustmentCount===0?t('ws.adjustmentStandard'):t('ws.adjustmentChanges',{count:adjustmentCount})}</small>
  <ColorChoices label={t('ws.color')} value={d.color} colors={colors} native={usesNativeComponentColors(d)} nativeLabel={t('ws.nativeColors')} pairable unavailableLabel={t('ws.colorUnavailable')} onNative={()=>patch({nativeColors:true})} onChange={color=>patch({color})}/>
  <ColorChoices label={t('ws.textColor')} value={d.textColor} colors={colors} native={usesNativeComponentColors(d)} against={d.color} onChange={textColor=>patch({textColor})}/>
  {range('radius',0,limits.radiusMax)}{range('fontSize',limits.fontSizeMin,Math.min(limits.fontSizeMax,Math.floor(limits.fontSize*Math.min(production.rect.width/part.minSize.width,production.rect.height/part.minSize.height))))}{checkbox('shadow')}
  {part.id==='common-heading'&&checkbox('separator')}
  {part.id==='common-frame'&&<>
   <label>{t('ws.titleAlign')}<select value={d.titleAlign} onChange={e=>patch({titleAlign:e.target.value as ComponentDesign['titleAlign']})}>{(['start','center','end'] as const).map(v=><option key={v} value={v}>{t(`ws.${v}`)}</option>)}</select></label>
   <label>{t('ws.symbolShape')}<select value={d.symbolShape} onChange={e=>patch({symbolShape:e.target.value as ComponentDesign['symbolShape']})}><option value="line">{t('ws.line')}</option><option value="square">{t('ws.square')}</option></select></label>
   <div className="ws-window-controls-editor">{production.elements.filter(e=>['minimize','maximize','close'].includes(e)).map((element,index,controls)=><fieldset key={element}><legend>{t(`ws.element.${element}` as MessageKey)}</legend>
    <div className="ws-order-controls"><button type="button" disabled={index===0} aria-label={t('ws.moveUp')} onClick={()=>dispatch({type:'addElement',part:part.id,element,index:Math.max(0,production.elements.indexOf(element)-1)})}><WorkshopGlyph name="up"/></button><button type="button" disabled={index===controls.length-1} aria-label={t('ws.moveDown')} onClick={()=>dispatch({type:'addElement',part:part.id,element,index:production.elements.indexOf(element)+1})}><WorkshopGlyph name="down"/></button>
    <select aria-label={t('ws.controlSide')} value={d.controlSides[element]??d.controlSide} onChange={e=>patch({controlSides:{...d.controlSides,[element]:e.target.value as 'start'|'end'}})}><option value="start">{t('ws.start')}</option><option value="end">{t('ws.end')}</option></select></div>
    <ColorChoices label={t('ws.controlColor',{name:t(`ws.element.${element}` as MessageKey)})} value={d.controlColors[element]??d.textColor} colors={colors} native={usesNativeComponentColors(d)} against={d.color} onChange={color=>patch({controlColors:{...d.controlColors,[element]:color}})}/>
   </fieldset>)}</div>
  </>}
  {part.id==='common-scrollbar'&&<>{range('scrollbarWidth',limits.scrollbarMin,limits.scrollbarMax)}{checkbox('arrows')}</>}
  {part.id==='common-progress'&&<>{range('progressHeight',limits.progressHeightMin,limits.progressHeightMax)}<label>{t('ws.progressStyle')}<select value={d.progressStyle} onChange={e=>patch({progressStyle:e.target.value as ComponentDesign['progressStyle']})}><option value="solid">{t('ws.solid')}</option><option value="striped">{t('ws.striped')}</option></select></label>{checkbox('showPercent')}</>}
  {stage>=2&&<label>{t('ws.motion')}<select value={d.motion} onChange={e=>patch({motion:e.target.value as ComponentDesign['motion']})}>{(['plain','press','smooth'] as const).map(v=><option key={v} value={v}>{t(`ws.motion.${v}`)}</option>)}</select></label>}
  {skills.includes('presets')&&<fieldset><legend>{t('ws.presets')}</legend><button type="button" disabled={customization.presets.length>=BALANCE.workshop.customization.maxPresets} onClick={()=>dispatch({type:'customize',patch:{presets:[...customization.presets,d]}})}>{t('ws.savePreset')}</button>{customization.presets.map((preset,index)=><button type="button" key={index} onClick={()=>patch(preset)}>{t('ws.applyPreset',{count:index+1})}</button>)}</fieldset>}
 </div>;
}
export function EditorCustomizationPanel({customization,colors,dispatch,i18n}:{customization:EditorCustomization;stage:number;colors:readonly string[];dispatch:WorkshopDispatch;i18n:I18n}){
 const t=i18n.t,c=customization,limits=BALANCE.workshop.customization;
 const patch=(patch:Partial<EditorCustomization>)=>dispatch({type:'customize',patch});
 return <section className="ws-editor-settings"><h2>{t('ws.settings')}</h2>
  <ColorChoices label={t('ws.accent')} value={c.accent} colors={colors} onChange={accent=>patch({accent})}/>
  <label>{t('ws.info')}<select value={c.bandPosition} onChange={e=>patch({bandPosition:e.target.value as 'top'|'bottom'})}><option value="top">{t('ws.top')}</option><option value="bottom">{t('ws.bottom')}</option></select></label>
  <>
   <ColorChoices label={t('ws.background')} value={c.background} colors={colors} native={usesNativeEditorBackground(c)} nativeLabel={t('ws.nativeColors')} onNative={()=>patch({nativeBackground:true})} onChange={background=>patch({background})}/>
   <label className="ws-check"><input type="checkbox" checked={c.grid} onChange={e=>patch({grid:e.target.checked})}/>{t('ws.grid')}</label>
   <label>{t('ws.gridSpacing')}<input type="range" min={limits.gridMin} max={limits.gridMax} value={c.gridSpacing} onChange={e=>patch({gridSpacing:Number(e.target.value)})}/><output>{i18n.number(c.gridSpacing)}</output></label>
   <label>{t('ws.fontSize')}<input type="range" min={limits.fontMin} max={limits.fontMax} value={c.fontSize} onChange={e=>patch({fontSize:Number(e.target.value)})}/><output>{i18n.number(c.fontSize)}</output></label>
   <label>{t('ws.panelWidth')}<input data-workshop-customize="panelWidth" type="range" min={limits.panelMin} max={limits.panelMax} value={c.panelWidth} onChange={e=>patch({panelWidth:Number(e.target.value)})}/><output>{i18n.number(c.panelWidth)}</output></label>
  </>
  <button type="button" data-workshop-action="resetCustomization" onClick={()=>patch({...createEditorCustomization(),presets:c.presets,panelPositions:c.panelPositions,panelWidths:c.panelWidths})}>{t('ws.reset')}</button>
 </section>;
}

export function DimensionInput({field,value,min,step,onCommit}:{field:string;value:number;min:number;step:number;onCommit:(value:number)=>void}){
 const [draft,setDraft]=useState(String(value)),cancelled=useRef(false);
 useEffect(()=>setDraft(String(value)),[value]);
 return <input data-workshop-dimension={field} type="number" min={min} step={step} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(cancelled.current){cancelled.current=false;setDraft(String(value));return;}const number=Number(draft);if(draft.trim()&&Number.isFinite(number))onCommit(number);setDraft(String(value));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();else if(e.key==='Escape'){cancelled.current=true;setDraft(String(value));e.currentTarget.blur();}}}/>;
}
