import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { createI18n, type I18n, type MessageKey } from '../content/i18n';
import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, getWorkshopPart, type WorkshopPartId } from '../content/workshopCatalog';
import type { CaptureScene, FrozenPhoto } from '../systems/captureScene';
import { readCapture } from '../systems/captureScene';
import type { Screenshot, AppId } from '../systems/desktopState';
import { createComponentDesign, effectiveEditorBackground, usesNativeComponentColors, type WorkshopState, type EditorCustomization } from '../systems/workshopState';
import { isBuildable } from '../systems/appLayout';
import { setDocumentPresentation } from '../systems/setDocumentPresentation';
import { producedControlPalette } from '../systems/commonChrome';
import coast from '../assets/wallpaper/coast.webp';
import night from '../assets/wallpaper/night.webp';
import { AppGlyph, LineIcon, ProductGlyph } from './desktop-icons';
import { RecordedAppParts } from './capture/RecordedAppParts';
import { PhotoSurface } from './PhotoSurface';
import { partVisual } from './workshop/partVisual';
import { WorkshopGlyph } from './workshop/WorkshopGlyph';
import './workshop/workshop.css';
import './legacy-capture-preview.css';

/** A frozen preview is a document: no runtime, live state reconstruction, or editable old UI. */
export function WorkshopSnapshot({workshop,customization,stage,i18n,now,desktopStage=0,files=[],pixels}:{workshop:WorkshopState;customization:EditorCustomization;stage:number;i18n:I18n;now:number;desktopStage?:number;files?:CaptureScene['files'];pixels?:number}) {
  const active=workshop.activePart?getWorkshopPart(workshop.activePart):null,set=active?.set??workshop.purchasedSets[0];
  const frame=workshop.parts['common-frame'],framePlaced=Boolean(frame&&frame.step>0),design=framePlaced?frame!.design:null;
  // Match the destination's containing frame, rather than treating it as a sibling part.
  const rect=set==='common'&&framePlaced?frame!.rect:{x:0,y:0,width:BALANCE.workshop.canvas.width,height:BALANCE.workshop.canvas.height};
  const frameElements=framePlaced?frame!.elements:['title'],frameVisual=design?partVisual('common-frame',design):null;
  const titleStyle:CSSProperties|undefined=design&&frame!.step>=2?{backgroundColor:frameVisual?.customColors?design.color:undefined,color:frameVisual?.customColors?design.textColor:undefined,textAlign:design.titleAlign,fontSize:design.fontSize,borderRadius:`${design.radius}px ${design.radius}px 0 0`}:undefined;
  const controls=(side:'start'|'end')=><div className="capture-static-window-controls">{frameElements.filter((symbol):symbol is 'minimize'|'maximize'|'close'=>['minimize','maximize','close'].includes(symbol)).filter(symbol=>(design?.controlSides[symbol]??design?.controlSide??'end')===side).map(symbol=><span key={symbol} data-static-control={symbol} style={design?producedControlPalette(design,symbol):undefined}><WorkshopGlyph name={symbol}/></span>)}</div>;
  const knownRows:StaticRow[]=[...files.filter(file=>file.kind==='set'||file.kind==='shot').map(file=>({id:file.id,name:file.name,at:file.at})),...WORKSHOP_PARTS.filter(part=>workshop.parts[part.id]).map(part=>({id:part.id,name:i18n.t(part.labelKey as MessageKey),at:workshop.parts[part.id]!.exportedAt??workshop.parts[part.id]!.completedAt??workshop.enteredAt}))];
  const partProps={workshop,i18n,now,rows:knownRows,pixels};
  const panelSide=stage===0?'right':customization.panelPositions.parts,background=effectiveEditorBackground(customization,stage===2?2:stage===1?1:0);
  return <div className={`capture-workshop workshop-root capture-editor-${stage}`} data-static-workshop-view={workshop.view} style={{background,fontSize:customization.fontSize}} inert aria-hidden="true">
    <div className="capture-workshop-band" style={{background:customization.accent,order:customization.bandPosition==='bottom'?1:undefined}}><strong>{i18n.t(stage===2?'ws.appGesso':'ws.app')}</strong><span>{set?i18n.t(`ws.set.${set}` as MessageKey):i18n.t('ws.canvas')}</span></div>
    <div className="capture-workshop-body"><aside style={{order:panelSide==='left'?-1:1,width:customization.panelWidth}}>{workshop.purchasedSets.map(id=><p key={id}>{i18n.t(`ws.set.${id}` as MessageKey)}</p>)}</aside><div className="capture-workshop-canvas" style={{background}}>
      {workshop.view==='exports'?<div className="capture-static-export-list">{WORKSHOP_PARTS.filter(part=>workshop.parts[part.id]?.exportedAt!==null&&workshop.parts[part.id]?.exportedAt!==undefined).map(part=><p key={part.id}>{i18n.t(part.labelKey as MessageKey)}<time>{i18n.dateTime(workshop.parts[part.id]!.exportedAt!)}</time></p>)}</div>
      :workshop.view==='settings'?<table className="capture-static-settings"><tbody><tr><th>{i18n.t('ws.accent')}</th><td>{customization.accent}</td></tr>{stage>0&&<><tr><th>{i18n.t('ws.fontSize')}</th><td>{i18n.number(customization.fontSize)}</td></tr><tr><th>{i18n.t('ws.panelWidth')}</th><td>{i18n.number(customization.panelWidth)}</td></tr><tr><th>{i18n.t('ws.gridSpacing')}</th><td>{i18n.number(customization.gridSpacing)}</td></tr></>}</tbody></table>
      :<div className="capture-static-canvas-sizer" style={{width:(BALANCE.workshop.canvas.width+8)*workshop.zoom,height:(BALANCE.workshop.canvas.height+32)*workshop.zoom}}><div className="capture-logical-workbench" style={{width:BALANCE.workshop.canvas.width,height:BALANCE.workshop.canvas.height,transform:`scale(${workshop.zoom})`}}>
        <div className="ws-target-window capture-static-target-window" data-static-workshop-target={set??'common'} data-static-common-frame={framePlaced||undefined} data-destination-era={desktopStage} data-symbol-shape={design?.symbolShape} style={{left:rect.x,top:rect.y,width:rect.width+8,borderRadius:design?.radius,filter:design?.shadow?'drop-shadow(2px 2px 1px #0006)':undefined}}>
          {frameElements.length>0&&<div className="ws-target-title" style={titleStyle}>{controls('start')}<span style={{textAlign:design?.titleAlign}}>{frameElements.includes('title')&&i18n.t(`ws.set.${set??'common'}` as MessageKey)}</span>{controls('end')}</div>}
          <div data-static-client="true" className={`ws-destination capture-static-destination ${customization.grid&&workshop.parts[workshop.activePart!]?.step!==3?'has-grid':''}`} style={{width:rect.width,height:rect.height,borderRadius:design?`0 0 ${design.radius}px ${design.radius}px`:undefined,'--ws-grid':`${customization.gridSpacing}px`} as CSSProperties}>
            {WORKSHOP_PARTS.filter(part=>part.set===set&&part.id!=='common-frame').map(part=>{const production=workshop.parts[part.id];if(!production||production.step===0)return null;const r=production.rect;return <div className="capture-workshop-part" data-static-part={part.id} key={part.id} style={{left:r.x-rect.x,top:r.y-rect.y,width:r.width,height:r.height}}><StaticPart id={part.id} production={production} {...partProps}/></div>;})}
          </div>
        </div>
      </div></div>}
    </div></div>
  </div>;
}
interface StaticRow {id:string;name:string;at:number|null}
function StaticPart({id,production:p,workshop,i18n,now,rows,pixels}:{id:WorkshopPartId;production:import('../systems/workshopState').PartProduction;workshop:WorkshopState;i18n:I18n;now:number;rows:StaticRow[];pixels?:number}) {
  const part=getWorkshopPart(id),d=p.design,visual=partVisual(id,d),has=(element:string)=>p.elements.includes(element),label=i18n.t(`ws.part.${id}` as MessageKey);
  const style:CSSProperties={background:visual.background,color:visual.foreground,borderRadius:d.radius,fontSize:d.fontSize,boxShadow:d.shadow?'1px 1px 0 #666':undefined,'--capture-part-bg':visual.background,'--capture-part-fg':visual.foreground,'--capture-part-accent':visual.customColors?d.color:'#000080','--capture-scroll-width':`${d.scrollbarWidth}px`} as CSSProperties;
  const button=(element:string,text:string)=>has(element)&&<span className="capture-part-button" data-static-element={element}>{text}</span>;
  const complete=Object.values(workshop.parts).filter(part=>part?.step===4).length,total=Object.keys(workshop.parts).length,progress=total?complete/total*BALANCE.workshop.preview.percentDivisor:0;
  const fileRows=(showDates:boolean)=>rows.map(row=><tr key={row.id}><td>{row.name}</td>{showDates&&<td>{row.at===null?'':i18n.legacyDate(row.at)}</td>}</tr>);
  let content:ReactNode;
  switch(id){
    case 'common-scrollbar':content=has('track')&&<div className="capture-part-scrollbar" data-static-thumb={has('thumb')} data-static-arrows={has('arrows')&&d.arrows} style={{scrollbarWidth:d.scrollbarWidth<BALANCE.workshop.design.scrollbarWidth?'thin':'auto'}}><ul>{rows.map(row=><li key={row.id}>{row.name}</li>)}</ul></div>;break;
    case 'common-button':content=button('label',i18n.t('ws.preview.press'));break;
    case 'common-heading':content=has('label')&&<strong style={{borderBottom:has('separator')&&d.separator?'1px solid currentColor':undefined}}>{i18n.t('ws.preview.folderHeading')}</strong>;break;
    case 'common-progress':content=has('track')&&<div className="capture-progress-group"><div className={`capture-part-progress ${d.progressStyle}`} style={{height:d.progressHeight}}>{has('fill')&&<i style={{width:`${progress}%`}}/>}</div>{has('percent')&&d.showPercent&&<output>{i18n.t('ws.productionProgress',{count:i18n.integer(complete),total:i18n.integer(total)})}</output>}</div>;break;
    case 'foundation-taskbar':content=<>{has('app-slots')&&<><span className="capture-part-button">{i18n.t('ws.set.files')}</span><span className="capture-part-button">{i18n.t('ws.set.mail')}</span></>}{has('resource-area')&&pixels!==undefined&&<span>{i18n.t('ws.pixels',{count:i18n.pixels(pixels)})}</span>}</>;break;
    case 'foundation-icons':content=has('icon')&&<div className="capture-static-icons">{rows.filter(row=>row.id.startsWith('set:')).map(row=><span key={row.id}><WorkshopGlyph name="file"/>{has('caption')&&row.name}</span>)}</div>;break;
    case 'foundation-desktop':content=null;break;
    case 'foundation-notification':content=<>{has('message')&&<span>{label}</span>}{button('action',i18n.t('ws.preview.open'))}</>;break;
    case 'foundation-upgrades':content=has('item')&&<span>{i18n.t('ws.set.clock')}</span>;break;
    case 'files-list':content=<table>{has('columns')&&<thead><tr><th>{i18n.t('ws.fileName')}</th><th>{i18n.t('ws.fileDate')}</th></tr></thead>}{has('rows')&&<tbody>{fileRows(true)}</tbody>}</table>;break;
    case 'files-back':content=button('back',i18n.t('ws.preview.back'));break;
    case 'files-sort':content=has('sort-key')&&<span className="capture-part-input">{i18n.t('files.name')}</span>;break;
    case 'files-search':content=has('query')&&<span className="capture-part-input"/>;break;
    case 'files-large':content=has('icon')&&<WorkshopGlyph name="file"/>;break;
    case 'files-storage':content=has('capacity')&&<span>{label}</span>;break;
    case 'mail-list':content=has('subject')&&<ul>{workshop.guide.seen.map(guide=><li key={guide}>{i18n.t('guide.title')}</li>)}</ul>;break;
    case 'mail-reply':content=button('reply',i18n.t('ws.preview.reply'));break;
    case 'mail-folders':content=<>{button('inbox',i18n.t('ws.preview.inbox'))}{button('archive',i18n.t('ws.preview.archive'))}</>;break;
    case 'mail-unread':content=has('unread')&&<span>{label}</span>;break;
    case 'photo-brightness':case 'photo-tone':case 'theme-radius':case 'theme-icons':content=(has('track')||has('thumb'))&&<div className="capture-part-slider">{has('thumb')&&<i/>}</div>;break;
    case 'photo-wallpaper':content=button('apply',i18n.t('ws.preview.setWallpaper'));break;
    case 'photo-compare':content=has('before')&&<span>{i18n.t('ws.preview.original')}</span>;break;
    case 'photo-switch':content=<>{button('previous',i18n.t('ws.preview.previousPhoto'))}{button('next',i18n.t('ws.preview.nextPhoto'))}</>;break;
    case 'bin-undo':content=button('restore',i18n.t('bin.restore'));break;
    case 'bin-empty':content=button('empty',i18n.t('bin.empty'));break;
    case 'clock-time':content=p.elements.length>0&&<time>{i18n.time(now)}</time>;break;
    case 'clock-calendar':content=has('month')&&<span>{i18n.month(now)}</span>;break;
    case 'clock-timer':content=button('start',i18n.t('ws.preview.startTimer'));break;
    case 'theme-mode':content=<>{button('light',i18n.t('theme.light'))}{button('dark',i18n.t('theme.dark'))}</>;break;
    case 'theme-accent':content=has('palette')&&<span>{i18n.t('theme.accent')}</span>;break;
    case 'theme-slideshow':content=has('images')&&<span>{i18n.t('theme.slideshow')}</span>;break;
    case 'terminal-commands':content=has('command')&&<ul>{(['list','photo','export'] as const).map(command=><li key={command}>{i18n.t(`ws.optional.command.${command}`)}</li>)}</ul>;break;
    case 'terminal-run':content=<>{button('run',i18n.t('ws.preview.runCommand'))}{button('stop',i18n.t('ws.preview.stopCommand'))}</>;break;
    case 'manager-processes':content=<table><thead><tr>{has('process')&&<th>{i18n.t('manager.name')}</th>}{has('rate')&&<th>{i18n.t('manager.rate')}</th>}{has('share')&&<th>{i18n.t('manager.share')}</th>}</tr></thead>{has('process')&&<tbody>{WORKSHOP_PARTS.filter(part=>workshop.parts[part.id]?.step===4).map(part=><tr key={part.id}><td>{i18n.t(part.labelKey as MessageKey)}</td>{has('rate')&&<td/>}{has('share')&&<td/>}</tr>)}</tbody>}</table>;break;
    case 'stream-preview':content=has('source')&&<span>{i18n.t('ws.stream.source')}</span>;break;
    case 'stream-sources':content=has('source')&&<span className="capture-part-input">{i18n.t('ws.stream.source')}</span>;break;
    case 'stream-scenes':content=<>{button('scene',i18n.t('ws.stream.sourceScene'))}{button('preview',i18n.t('ws.stream.messages'))}</>;break;
    case 'stream-comments':content=has('message')&&<div className="capture-part-scrollbar"><span>{i18n.t('ws.stream.messages')}</span></div>;break;
    case 'plugin-table':content=<table><thead><tr>{has('time')&&<th>{i18n.t('ws.element.time')}</th>}{has('pixels')&&<th>{i18n.t('ws.preview.pixels')}</th>}</tr></thead></table>;break;
    case 'plugin-tabs':content=has('tab')&&<><span className="capture-part-button">{i18n.t('ws.set.files')}</span><span className="capture-part-button">{i18n.t('ws.optional.productionHistory')}</span></>;break;
    // Local selections, photo adjustments, timer state and command logs are not part of a saved WorkshopState.
    // Keep their produced surface and geometry without inventing values for an unrecorded interaction.
    default:content=null;
  }
  return <div className={`capture-static-part capture-part-${part.kind}`} data-static-part-content={id} style={style}>{content}</div>;
}
function FrozenPhoto({edit,scene,catalog,i18n,ancestors}:{edit:FrozenPhoto|null;scene:CaptureScene;catalog:Screenshot[];i18n:I18n;ancestors:readonly number[]}) {
  if(!edit)return null;
  const shot=edit.source.startsWith('shot:')?catalog.find(s=>s.id===Number(edit.source.slice(5))):undefined;
  const style:CSSProperties={filter:`brightness(${edit.brightness}) sepia(${Math.abs(edit.tone)/100})`,transform:`scale(${1+edit.crop/100})`};
  const photograph=<div className="capture-photo" style={style}>{shot&&!ancestors.includes(shot.id)?ancestors.length<BALANCE.w3.capturePreviewDepth?<LegacyCapturePreview shot={shot} catalog={catalog} i18n={i18n} ancestors={ancestors}/>:<CaptureReference shot={shot} i18n={i18n}/>:<img src={edit.source==='night'?night:coast} alt="" data-capture-source={edit.source} data-capture-version={scene.version}/>}</div>;
  return scene.version===11?<PhotoSurface specs={scene.display.specs}>{photograph}</PhotoSurface>:photograph;
}
/** The asset remains intact; only expansion into nested DOM has a presentation budget. */
function CaptureReference({shot,i18n}:{shot:Screenshot;i18n:I18n}) {
  const documentScene=readCapture(shot);
  return <div className="capture-reference" data-capture-reference={shot.id}><strong>{documentScene.display.productName??i18n.t('product.untitled')}</strong><p>{i18n.t('files.recorded',{date:i18n.dateTime(shot.at)})}</p><p>{i18n.t('foundation.pixels',{pixels:i18n.pixels(documentScene.display.resources.pixels)})}</p></div>;
}
function FrozenWindowContent({app,scene,catalog,i18n,ancestors}:{app:string;scene:CaptureScene;catalog:Screenshot[];i18n:I18n;ancestors:readonly number[]}) {
  if(app==='note')return <pre className="capture-note">{scene.note}</pre>;
  if(app==='tessera'&&scene.workshop&&scene.editorCustomization)return <WorkshopSnapshot workshop={scene.workshop} customization={scene.editorCustomization} stage={scene.appearance.editor} i18n={i18n} now={scene.display.wallTime} desktopStage={scene.appearance.desktop} files={scene.files} pixels={scene.display.resources.pixels}/>;
  if(scene.version===11&&scene.evaluation&&isBuildable(app)){
    const source=scene.selectedSetDocument,presentation=source?setDocumentPresentation(source):null;
    const document=source&&presentation?<div className="recorded-set-document"><h3>{i18n.t(`ws.set.${source.set}`)} {source.version}</h3><WorkshopSnapshot workshop={presentation.workshop} customization={presentation.customization} stage={scene.appearance.editor} i18n={i18n} now={source.at} desktopStage={scene.appearance.desktop}/></div>:null;
    const selected=scene.files.find(file=>file.id===scene.desktop.fileSelection),selectedShot=selected?.shotId===undefined?null:catalog.find(shot=>shot.id===selected.shotId);
    const recordedShot=selectedShot&&!ancestors.includes(selectedShot.id)?ancestors.length<BALANCE.w3.capturePreviewDepth?<LegacyCapturePreview shot={selectedShot} catalog={catalog} i18n={i18n} ancestors={ancestors}/>:<CaptureReference shot={selectedShot} i18n={i18n}/>:null;
    return <RecordedAppParts app={app} scene={scene} i18n={i18n} photograph={<FrozenPhoto edit={scene.view.photo} scene={scene} catalog={catalog} i18n={i18n} ancestors={ancestors}/>} document={document} selectedShot={recordedShot}/>;
  }
  if(app==='photo')return <FrozenPhoto edit={scene.view.photo} scene={scene} catalog={catalog} i18n={i18n} ancestors={ancestors}/>;
  if(app==='files'||app==='tessera')return <table className="capture-files"><thead><tr><th>{i18n.t('files.name')}</th><th>{i18n.t('files.modified')}</th><th>{i18n.t('files.type')}</th></tr></thead><tbody>{scene.files.map(f=><tr key={f.id}><td>{f.name}</td><td>{f.at===null?'':i18n.dateTime(f.at)}</td><td>{i18n.t(`files.type.${f.kind}` as MessageKey)}</td></tr>)}</tbody></table>;
  if(app==='mail')return <div className="capture-mail">{scene.desktop.feedback.map(f=><div key={f.id}><b>{i18n.t(`feedback.sender.${f.sender}`)}</b><time>{i18n.dateTime(f.at)}</time><span>{f.completedAt===null?i18n.t('mail.pending'):i18n.t('mail.completed',{date:i18n.dateTime(f.completedAt)})}</span></div>)}</div>;
  if(app==='clock')return <time className="capture-clock">{i18n.time(scene.display.wallTime)}</time>;
  return <table className="capture-files"><tbody>{(Object.keys(scene.display.specs) as (keyof typeof scene.display.specs)[]).map(key=><tr key={key}><th>{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,scene.display.specs[key])}</td></tr>)}</tbody></table>;
}
function FrozenNativeWindow({app,scene,catalog,i18n,ancestors}:{app:string;scene:CaptureScene;catalog:Screenshot[];i18n:I18n;ancestors:readonly number[]}) {
  const nativeWindow=scene.desktop.windows[app]!,evaluation=scene.evaluation!,client=evaluation.windowClients[app]??{x:nativeWindow.x,y:nativeWindow.y,width:nativeWindow.width,height:nativeWindow.height};
  const recordedTitle=evaluation.parts.find(part=>part.id===`${app}:title`)?.rects[0]??{x:nativeWindow.x,y:nativeWindow.y,width:nativeWindow.width,height:client.y-nativeWindow.y};
  const material=isBuildable(app)?scene.appProjects?.[app]?.installedAssembly?.common.find(part=>part.source==='common-frame'):scene.workshop?.parts['common-frame'];
  const design=material?.design,customColors=design?!usesNativeComponentColors(design):false;
  const defaults=createComponentDesign(),custom=design?JSON.stringify({...defaults,...design,nativeColors:!customColors})!==JSON.stringify(defaults):false;
  const chrome=evaluation.placements.filter(item=>item.app===app&&item.role.startsWith('chrome:'));
  const titleText=chrome.find(item=>item.role==='chrome:title'),titleIcon=chrome.find(item=>item.role==='chrome:icon');
  const position=(rectangle:{x:number;y:number;width:number;height:number},origin=recordedTitle):CSSProperties=>({position:'absolute',left:rectangle.x-origin.x,top:rectangle.y-origin.y,width:rectangle.width,height:rectangle.height});
  const controls=chrome.filter(item=>['chrome:minimize','chrome:maximize','chrome:close'].includes(item.role));
  return <section className={`desktop-window recorded-native-window app-${app} ${app===scene.desktop.active?'is-active':''} ${nativeWindow.maximized?'is-maximized':''}`} data-recorded-window={app} data-produced-shadow={design?.shadow||undefined} style={{left:nativeWindow.x,top:nativeWindow.y,width:nativeWindow.width,height:nativeWindow.height,zIndex:nativeWindow.z+BALANCE.capture.geometry.windowLayer}}>
    <header className={`window-title ${custom?'has-produced-chrome':''}`} style={{...position(recordedTitle,nativeWindow),minHeight:0,margin:0,padding:0,background:customColors?design?.color:undefined,color:customColors?design?.textColor:undefined,fontSize:custom?design?.fontSize:undefined,'--recorded-title-height':`${recordedTitle.height}px`,'--produced-title-font':`${design?.fontSize??BALANCE.workshop.design.fontSize}px`} as CSSProperties}>
      {titleIcon&&<span style={position(titleIcon.rect)}><AppGlyph app={app as AppId} editor={scene.appearance.editor}/></span>}
      <span style={{...(titleText?position(titleText.rect):{paddingInline:BALANCE.appBuild.grid}),fontSize:'inherit',textAlign:design?.titleAlign,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{evaluation.windowTitles[app]??appName(app,scene,i18n)}</span>
      {controls.length>0?<div className="window-controls recorded-native-controls">{controls.map((control,index)=>{const symbol=control.role.slice('chrome:'.length) as 'minimize'|'maximize'|'close';return <button type="button" tabIndex={-1} key={index} className={`${symbol==='close'?'window-close':''} ${design?.symbolShape==='square'?'produced-square':''}`} data-recorded-symbol={symbol} style={{...(design?producedControlPalette(design,symbol):{}),...position(control.rect),minHeight:0,...control.paint,borderRadius:custom?design?.radius:undefined}}><LineIcon kind={symbol==='maximize'&&nativeWindow.maximized?'restore':symbol}/></button>;})}</div>:<span className="recorded-fallback-controls"><LineIcon kind="minimize"/><LineIcon kind="maximize"/><LineIcon kind="close"/></span>}
    </header>
    <div className="window-content recorded-native-client" style={{...position(client,nativeWindow),margin:0,border:0}}><FrozenWindowContent app={app} scene={scene} catalog={catalog} i18n={i18n} ancestors={ancestors}/></div>
  </section>;
}
function appName(app:string,scene:CaptureScene,i18n:I18n):string {
  return app==='tessera'?i18n.t(scene.appearance.editor===2?'ws.appGesso':'ws.app'):i18n.t(`desktop.app.${app}` as MessageKey);
}
export function LegacyCapturePreview({shot,catalog,i18n,ancestors=[]}:{shot:Screenshot;catalog:Screenshot[];i18n:I18n;ancestors?:readonly number[]}) {
  const scene=useMemo(()=>readCapture(shot),[shot,shot.data]);
  const recorded=useMemo(()=>createI18n(shot.language,{numberNotation:scene.display.notation}),[shot.language,scene.display.notation]);
  const mount=useRef<HTMLDivElement>(null),[width,setWidth]=useState(scene.screen.width);
  useLayoutEffect(()=>{const node=mount.current;if(!node)return;const measure=()=>setWidth(node.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
  const scale=width/scene.screen.width,visible=['tessera','note',...scene.desktop.apps,'settings'];
  const chain=[...ancestors,shot.id],prefs=scene.view.preferences;
  return <div ref={mount} className="screenshot-preview legacy-capture-preview" role="img" aria-label={i18n.t('files.recorded',{date:i18n.dateTime(shot.at)})} data-capture-format={scene.version} data-preview-shot={shot.id}>
    <div style={{height:scene.screen.height*scale}}><div className={`screenshot-stage capture-desktop desktop-era-${scene.appearance.desktop} capture-era-${scene.appearance.desktop} ${scene.version===11?'desktop desktop-frozen capture-native':''} ${prefs.mode==='dark'?'capture-dark desktop-dark':''}`} inert aria-hidden="true" style={{width:scene.screen.width,height:scene.screen.height,transform:`scale(${scale})`,background:scene.version===11?undefined:prefs.wallpaper?'#1f363e':scene.appearance.desktop===0?'#008080':'#42627e','--desktop-accent':prefs.accent} as CSSProperties}>
      {prefs.wallpaper&&<div className="capture-wallpaper"><FrozenPhoto edit={prefs.wallpaper} scene={scene} catalog={catalog} i18n={recorded} ancestors={chain}/></div>}
      {visible.filter(app=>scene.version!==11||app!=='settings').map(app=>{const icon=scene.desktop.icons[app];return icon?<div className={scene.version===11?'desktop-shortcut recorded-desktop-shortcut':'capture-desktop-icon'} key={app} style={{left:icon.x,top:icon.y}}>{scene.version===11?<><AppGlyph app={app as AppId} editor={scene.appearance.editor}/><span>{appName(app,scene,recorded)}</span></>:<><span><ProductGlyph/></span><small>{appName(app,scene,recorded)}</small></>}</div>:null;})}
      {Object.entries(scene.desktop.windows).filter(([app,w])=>w.open&&!w.minimized&&(!scene.view.desktop.workspaces||typeof scene.view.desktop.workspaces!=='object'||(scene.view.desktop.workspaces as Record<string,unknown>)[app]===scene.view.desktop.workspace)).sort(([,a],[,b])=>a.z-b.z).map(([app,w])=>scene.version===11&&scene.evaluation?<FrozenNativeWindow key={app} app={app} scene={scene} catalog={catalog} i18n={recorded} ancestors={chain}/>:<section className={`capture-window ${app===scene.desktop.active?'capture-active':''}`} key={app} style={{left:w.x,top:w.y,width:w.width,height:w.height,borderRadius:scene.appearance.desktop>1?prefs.radius:0}}><header><b>{appName(app,scene,recorded)}</b><span><LineIcon kind="minimize"/><LineIcon kind="maximize"/><LineIcon kind="close"/></span></header><div className="capture-window-client"><FrozenWindowContent app={app} scene={scene} catalog={catalog} i18n={recorded} ancestors={chain}/></div></section>)}
      {scene.version===11&&scene.notices?.map(notice=>{const rectangle=scene.evaluation?.parts.find(part=>part.id===notice.id)?.rects[0];return rectangle?<aside className="feedback-toast recorded-notice" key={notice.id} style={{left:rectangle.x,top:rectangle.y,right:'auto',bottom:'auto',width:rectangle.width,height:rectangle.height,zIndex:BALANCE.capture.geometry.notificationLayer}}><header><b>{notice.title}</b></header>{notice.sender&&<b>{notice.sender}</b>}<p>{notice.text}</p></aside>:null;})}
      <footer className="capture-taskbar"><strong>{scene.display.productName??recorded.t('product.untitled')}</strong><span>{recorded.t('foundation.pixels',{pixels:recorded.pixels(scene.display.resources.pixels)})}</span><time>{recorded.time(scene.display.wallTime)}</time></footer>
    </div></div>
  </div>;
}
