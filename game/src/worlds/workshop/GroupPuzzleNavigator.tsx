import { useState, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GROUP_IDS, GROUP_TOOLS, commonPartIds, groupCategory, groupCost, groupLabel, groupTool, toolLabel, toolParts, toolsInGroup, type GroupCategory, type WorkshopToolId } from '../../content/workshopGroups';
import { getWorkshopPart, type WorkshopPartId } from '../../content/workshopCatalog';
import { fittingDefinition, fittingPartsForSet } from '../../content/workshopFitting';
import { paletteFor } from '../../content/palette';
import { BALANCE } from '../../config/balance';
import { blueprintAppForSet } from '../../systems/appAssembly';
import type { BuiltApp } from '../../systems/desktopState';
import { canBuyGroup, currentGroupTools, looseGroupPiece } from '../../systems/groupPuzzle';
import { createComponentDesign } from '../../systems/workshopState';
import { editorStage } from '../../systems/appearance';
import { canAssembleDesktop, canInspectDesktopExit } from '../../systems/workshop';
import { canRelease } from '../../systems/release';
import { tesseraUpdatePending } from '../../systems/workshopUpdate';
import { puzzleParts, puzzlePieceVisible } from '../../systems/workshopPuzzle';
import type { I18n, MessageKey } from '../../content/i18n';
import type { GameState } from '../../systems/state';
import type { GameRuntime } from '../../systems/runtime';
import { GroupArtworkProviders, GroupPieceArtwork, GroupToolSurface } from './GroupToolArtwork';
import { PartInspector, type WorkshopDispatch } from './WorkshopCustomization';
import { WorkshopGlyph } from './WorkshopGlyph';
import { WorkshopDestinationGlyph } from './WorkshopSchematic';
import './fitting-panel.css';

export function groupGoal(state:GameState):{kind:'buy'|'place'|'fit'|'exit'|'update'|'choose';tool?:WorkshopToolId;piece?:string;group?:'required'|'foundation'}{
 const g=state.run.workshop.groupPuzzle!;
 if(tesseraUpdatePending(state))return {kind:'update'};
 if(!g.purchased.includes('required'))return {kind:'buy',group:'required'};
 const incomplete=(g.focus&&g.tools[g.focus]&&!g.tools[g.focus]!.completionPaid?groupTool(g.focus):null)??GROUP_TOOLS.find(tool=>['required','foundation'].includes(tool.group)&&g.tools[tool.id]&&!g.tools[tool.id]!.completionPaid);
 if(incomplete){const p=g.tools[incomplete.id]!;return !p.placed?{kind:'place',tool:incomplete.id,piece:incomplete.base}:{kind:'fit',tool:incomplete.id,piece:incomplete.pieces.find(piece=>piece.id!==incomplete.base&&!p.fitted[piece.id])!.id};}
 if(!g.purchased.includes('foundation'))return {kind:'buy',group:'foundation'};
 if(state.run.world==='kumiki')return {kind:'exit'};
 return {kind:'choose'};
}
export function groupGoalText(state:GameState,i18n:I18n){
 const goal=groupGoal(state),t=i18n.t;
 return t(`group.goal.${goal.kind}` as MessageKey,{group:goal.group?t(groupLabel(goal.group) as MessageKey):'',tool:goal.tool?t(toolLabel(goal.tool) as MessageKey):'',piece:goal.tool&&goal.piece?t(groupTool(goal.tool).pieces.find(piece=>piece.id===goal.piece)!.label as MessageKey):''});
}
interface Hover {tool:WorkshopToolId;piece?:string;left:number;top:number;limit:number}
export function GroupPuzzleNavigator({state,runtime,i18n,previewZoom,onPickColor,onOpenPlugins,onAssembleApp}:{state:GameState;runtime:GameRuntime;i18n:I18n;previewZoom:number;onPickColor:()=>void;onOpenPlugins:()=>void;onAssembleApp?:(app:BuiltApp)=>void}){
 const g=state.run.workshop.groupPuzzle!,w=state.run.workshop,t=i18n.t,dispatch:WorkshopDispatch=runtime.actWorkshop;
 const root=useRef<HTMLDivElement>(null),[hover,setHover]=useState<Hover|null>(null),[adjusting,setAdjusting]=useState<{tool:WorkshopToolId;part:WorkshopPartId}|null>(null),[streamPart,setStreamPart]=useState<WorkshopPartId|null>(null),[streamAdjusting,setStreamAdjusting]=useState(false);
 const selected=g.selected??GROUP_IDS.find(group=>groupCategory(group)===g.category)!,owned=g.purchased.includes(selected),goal=groupGoal(state);
 const host=root.current?.closest<HTMLElement>('.workshop-root')??null;
 const showHover=(node:HTMLElement,tool:WorkshopToolId,piece?:string)=>{const host=root.current?.closest<HTMLElement>('.workshop-root');if(!host)return;const bounds=host.getBoundingClientRect(),r=node.getBoundingClientRect(),scale=bounds.width/host.offsetWidth;setHover({tool,piece,left:(r.left-bounds.left)/scale,top:(r.top-bounds.top)/scale,limit:host.clientHeight});};
 const chooseTarget=(tool:WorkshopToolId,part:WorkshopPartId)=>{setAdjusting({tool,part});dispatch({type:'groupFocus',tool,part});};
 const mark=(done:boolean)=>done?<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="m2 7 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>:<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor"/></svg>;
 const customs=adjusting&&g.tools[adjusting.tool],customPart=adjusting?getWorkshopPart(adjusting.part):null,production=adjusting?w.parts[adjusting.part]:undefined;
 const dialog=customs&&customPart&&production&&adjusting?<section className="ws-fitting-adjustments" data-group-customization role="dialog" aria-label={t('fitting.adjustments' as MessageKey)}>
  <header><strong>{t(toolLabel(adjusting.tool) as MessageKey)}</strong><button type="button" aria-label={t('ws.close')} onClick={()=>setAdjusting(null)}><WorkshopGlyph name="close"/></button></header>
  <button type="button" onClick={()=>dispatch({type:'groupAdjust',tool:adjusting.tool,part:adjusting.part,patch:createComponentDesign()})}>{t('fitting.auto' as MessageKey)}</button>
  <label>{t('group.customizeTarget' as MessageKey)}<select value={adjusting.part} onChange={event=>chooseTarget(adjusting.tool,event.target.value as WorkshopPartId)}>{[...commonPartIds,...toolParts(groupTool(adjusting.tool))].map(id=><option key={id} value={id}>{t(getWorkshopPart(id).labelKey as MessageKey)}</option>)}</select></label>
  <PartInspector part={customPart} production={{...production,design:customs.designs[adjusting.part]??createComponentDesign()}} stage={editorStage(state)} colors={paletteFor(state.persistent.specs.color)} skills={state.persistent.editorSkills} customization={state.persistent.editorCustomization} dispatch={action=>{if(action.type==='adjust')dispatch({type:'groupAdjust',tool:adjusting.tool,part:adjusting.part,patch:action.patch});else dispatch(action);}} i18n={i18n}/>
  {state.persistent.editorSkills.includes('eyedropper')&&<button type="button" data-workshop-action="pickColor" onClick={()=>{setAdjusting(null);onPickColor();}}>{t('ws.eyedropper')}</button>}
 </section>:null;
 return <div ref={root} className="ws-parts-content ws-fitting-panel gp-panel" data-group-panel data-workshop-panel-scroll>
  <div className="gp-panel-goal" data-group-goal><strong>{t('examples.workshop.nextHand' as MessageKey)}</strong><p>{groupGoalText(state,i18n)}</p>{goal.kind==='buy'&&<button type="button" disabled={!canBuyGroup(state,goal.group!)} onClick={()=>dispatch({type:'groupBuy',group:goal.group!})}>{t('group.buy' as MessageKey)}</button>}{goal.kind==='update'&&<button type="button" onClick={onOpenPlugins}>{t('ws.skill.update')}</button>}</div>
  <div className="ws-panel-category-tabs" role="tablist" aria-label={t('ws.parts')}>{(['required','desktop','optional'] as GroupCategory[]).map(category=><button type="button" key={category} data-group-category={category} role="tab" aria-selected={g.category===category} onClick={()=>{setAdjusting(null);setHover(null);dispatch({type:'groupCategory',category});}}>{t(`group.category.${category}` as MessageKey)}</button>)}</div>
  <section className="ws-panel-zone" data-group-zone="groups"><h3>{t('group.groups' as MessageKey)}</h3><div className="ws-panel-set-rows">{GROUP_IDS.filter(group=>groupCategory(group)===g.category).map(group=>{
   const purchased=g.purchased.includes(group),definitions=toolsInGroup(group),done=definitions.filter(tool=>g.tools[tool.id]?.completionPaid).length;
   return <div className="ws-panel-set-row" data-selected={selected===group} key={group} data-group-row={group}><button type="button" className="ws-panel-set-select" data-group-select={group} aria-pressed={selected===group} onClick={()=>{setAdjusting(null);setHover(null);dispatch({type:'groupSelect',group});}}><WorkshopDestinationGlyph set={group==='required'?'files':group}/><span className="ws-panel-row-copy"><strong>{t(groupLabel(group) as MessageKey)}</strong><small>{purchased?t('group.toolCount' as MessageKey,{done,total:definitions.length}):t('group.unowned' as MessageKey)}</small></span></button><button type="button" className="ws-panel-set-buy" data-group-buy={group} disabled={!canBuyGroup(state,group)} onClick={()=>dispatch({type:'groupBuy',group})}>{purchased?mark(definitions.length>0&&done===definitions.length):t('ws.price',{count:i18n.price(groupCost(group))})}</button></div>;
  })}</div></section>
  <section className="ws-panel-zone" data-group-zone="tools"><h3>{t('group.tools' as MessageKey)}</h3><div className="ws-panel-part-rows">{toolsInGroup(selected).map(tool=>{
   const p=g.tools[tool.id],focused=g.focus===tool.id,complete=!!p?.completionPaid;
   return <div key={tool.id} className="ws-panel-part-row" data-group-tool-row={tool.id} data-selected={focused} data-brightness={complete?'complete':focused?'selected':'default'} onPointerEnter={event=>showHover(event.currentTarget,tool.id)} onPointerLeave={()=>setHover(null)}><button type="button" className="ws-panel-part-select" data-group-tool={tool.id} aria-pressed={focused} disabled={!owned} onClick={()=>{setAdjusting(null);dispatch({type:'groupFocus',tool:tool.id});}}>{mark(complete)}<span>{t(toolLabel(tool.id) as MessageKey)}</span></button>{focused&&p&&<button type="button" className="ws-panel-part-customize" data-group-customize={tool.id} onClick={()=>chooseTarget(tool.id,g.customPart??(toolParts(tool)[0]??'common-frame'))}>{t('page.customize')}</button>}</div>;
  })}{selected==='stream'&&fittingPartsForSet('stream').map(part=><div key={part.id} className="ws-panel-part-row" data-brightness={w.parts[part.id]?.step===4?'complete':puzzleParts(w).includes(part.id)?'selected':'default'}><button type="button" className="ws-panel-part-select" disabled={!owned} aria-pressed={puzzleParts(w).includes(part.id)} onClick={()=>{setStreamAdjusting(false);setStreamPart(part.id);dispatch({type:'togglePart',part:part.id});}}>{mark(w.parts[part.id]?.step===4)}{t(part.labelKey as MessageKey)}</button>{puzzleParts(w).includes(part.id)&&<button type="button" onClick={()=>{setStreamPart(part.id);setStreamAdjusting(true);}}>{t('page.customize')}</button>}</div>)}</div></section>
  <section className="ws-panel-zone" data-group-zone="pieces"><h3>{t('fitting.zone.pieces' as MessageKey)}</h3>{owned?currentGroupTools(g).filter(tool=>!g.tools[tool.id]!.completionPaid).map(tool=>{
   const p=g.tools[tool.id]!;return <div className="ws-piece-group" data-group-piece-group={tool.id} key={tool.id}><h4>{t(toolLabel(tool.id) as MessageKey)}</h4><div className="ws-fitting-piece-list">{tool.pieces.map(piece=>{
    const fitted=piece.id===tool.base?p.placed:!!p.fitted[piece.id],visible=looseGroupPiece(p,tool.base,piece.id);
    return <div className="ws-panel-piece-row" data-brightness={fitted?'complete':visible?'selected':'default'} key={piece.id} onPointerEnter={event=>showHover(event.currentTarget,tool.id,piece.id)} onPointerLeave={()=>setHover(null)}><button type="button" data-workshop-piece={piece.id} data-group-piece-row={piece.id} data-group-piece-owner={tool.id} disabled={fitted} aria-pressed={visible} onClick={()=>dispatch({type:'groupToggle',tool:tool.id,piece:piece.id})}>{mark(fitted)}<span>{t(piece.label as MessageKey)}</span><small>{t((fitted?'fitting.fitted':visible?'fitting.selected':'fitting.hidden') as MessageKey)}</small></button></div>;
   })}</div></div>;
  }):<p className="ws-panel-unowned-note">{t('group.purchaseHint' as MessageKey)}</p>}
  {selected==='stream'&&puzzleParts(w).filter(id=>getWorkshopPart(id).set==='stream').map(id=><div className="ws-piece-group" key={id}><h4>{t(getWorkshopPart(id).labelKey as MessageKey)}</h4><div className="ws-fitting-piece-list">{fittingDefinition(id).pieces.map(piece=><div className="ws-panel-piece-row" key={piece} data-brightness={w.parts[id]?.elements.includes(piece)?'complete':puzzlePieceVisible(w,id,piece)?'selected':'default'}><button type="button" data-workshop-piece={piece} disabled={w.parts[id]?.elements.includes(piece)} onClick={()=>dispatch({type:'togglePiece',part:id,piece})}>{t(`ws.element.${piece}` as MessageKey)}</button></div>)}</div></div>)}
  </section>
  {selected==='stream'&&streamPart&&<button type="button" disabled={!streamPart||w.parts[streamPart]?.step!==4||w.parts[streamPart]?.exportedAt!==null} onClick={()=>dispatch({type:'export',part:streamPart})}>{t('ws.export')}</button>}
  {state.run.world==='kumiki'&&<div className="ws-exit"><button type="button" data-group-exit disabled={!canInspectDesktopExit(state)} onClick={()=>{dispatch({type:'exit'});if(!canAssembleDesktop(state)&&canRelease(runtime.getSnapshot().state))runtime.requestPrototypeRelease();}}>{t(canAssembleDesktop(state)?'ws.assemble':'ws.releaseReady')}</button><small>{t('ws.price',{count:i18n.price(BALANCE.w2.desktopCost)})}</small></div>}
  {state.run.world==='desktop'&&onAssembleApp&&currentGroupTools(g).filter(tool=>g.tools[tool.id]!.completionPaid&&blueprintAppForSet(tool.set)).map(tool=><button type="button" key={tool.id} className="ws-assemble-app" data-workshop-assemble-app={blueprintAppForSet(tool.set)!} onClick={()=>onAssembleApp(blueprintAppForSet(tool.set)!)}>{t('group.openBuilder' as MessageKey,{tool:t(toolLabel(tool.id) as MessageKey)})}</button>)}
  {selected==='stream'&&streamAdjusting&&streamPart&&w.parts[streamPart]&&<section className="ws-fitting-adjustments" role="dialog" aria-label={t('fitting.adjustments' as MessageKey)}><button type="button" onClick={()=>setStreamAdjusting(false)}>{t('ws.close')}</button><PartInspector part={getWorkshopPart(streamPart)} production={w.parts[streamPart]!} stage={editorStage(state)} colors={paletteFor(state.persistent.specs.color)} skills={state.persistent.editorSkills} customization={state.persistent.editorCustomization} dispatch={dispatch} i18n={i18n}/></section>}
  {dialog&&(host?createPortal(dialog,host):dialog)}
  {hover&&host&&createPortal(<GroupHoverPreview state={state} i18n={i18n} hover={hover} zoom={previewZoom}/>,host)}
 </div>;
}
function GroupHoverPreview({state,i18n,hover,zoom}:{state:GameState;i18n:I18n;hover:Hover;zoom:number}){
 const d=groupTool(hover.tool),p=state.run.workshop.groupPuzzle!.tools[hover.tool],piece=hover.piece?d.pieces.find(piece=>piece.id===hover.piece)!:null;
 const source={...p,placed:true,locked:true,fitted:Object.fromEntries(d.pieces.filter(piece=>piece.id!==d.base).map(piece=>[piece.id,{x:piece.rect.x,y:piece.rect.y}])),designs:p?.designs??{}};
 const projected={...state,run:{...state.run,workshop:{...state.run.workshop,groupPuzzle:{...state.run.workshop.groupPuzzle!,tools:{...state.run.workshop.groupPuzzle!.tools,[hover.tool]:source}}}}} as GameState;
 const scale=piece?zoom:Math.min(.42,280/d.width,180/d.height),width=(piece?.rect.width??d.width)*scale,height=(piece?.rect.height??d.height)*scale;
 return <div className="ws-hover-preview gp-hover-preview" data-group-hover={piece?'piece':'tool'} style={{left:Math.max(4,hover.left-width-12),top:Math.max(4,Math.min(hover.top,hover.limit-height-14)),width:width+10,height:height+10} as CSSProperties}>
  <GroupArtworkProviders state={projected} i18n={i18n}><div inert style={{width:piece?.rect.width??d.width,height:piece?.rect.height??d.height,transform:`scale(${scale})`,transformOrigin:'top left'}}>{piece?<GroupPieceArtwork state={projected} i18n={i18n} tool={hover.tool} piece={piece} loose/>:<GroupToolSurface state={projected} i18n={i18n} tool={hover.tool} complete/>}</div></GroupArtworkProviders>
 </div>;
}
