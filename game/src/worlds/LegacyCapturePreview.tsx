import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createI18n, type I18n, type MessageKey } from '../content/i18n';
import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, getWorkshopPart, type WorkshopPartId } from '../content/workshopCatalog';
import type { CaptureScene, FrozenPhoto } from '../systems/captureScene';
import { readCapture } from '../systems/captureScene';
import type { Screenshot } from '../systems/desktopState';
import type { WorkshopState, EditorCustomization, ComponentDesign } from '../systems/workshopState';
import coast from '../assets/wallpaper/coast.webp';
import night from '../assets/wallpaper/night.webp';
import { LineIcon, ProductGlyph } from './desktop-icons';
import './legacy-capture-preview.css';

/** A frozen preview is a document: no runtime, live state reconstruction, or editable old UI. */
export function WorkshopSnapshot({workshop,customization,stage,i18n,now}:{workshop:WorkshopState;customization:EditorCustomization;stage:number;i18n:I18n;now:number}) {
  const active=workshop.activePart?getWorkshopPart(workshop.activePart):null;
  const set=active?.set??workshop.purchasedSets[0];
  return <div className={`capture-workshop capture-editor-${stage}`} style={{background:customization.background,fontSize:customization.fontSize}}>
    <div className="capture-workshop-band" style={{background:customization.accent,order:customization.bandPosition==='bottom'?1:undefined}}><strong>{i18n.t(stage===2?'ws.appGesso':'ws.app')}</strong><span>{set?i18n.t(`ws.set.${set}` as MessageKey):i18n.t('ws.canvas')}</span></div>
    <div className="capture-workshop-body"><aside>{workshop.purchasedSets.map(id=><p key={id}>{i18n.t(`ws.set.${id}` as MessageKey)}</p>)}</aside><div className="capture-workshop-canvas" style={{background:customization.background,backgroundImage:customization.grid?'linear-gradient(#80808022 1px,transparent 1px),linear-gradient(90deg,#80808022 1px,transparent 1px)':undefined,backgroundSize:`${customization.gridSpacing}px ${customization.gridSpacing}px`}}>
      {WORKSHOP_PARTS.filter(p=>p.set===set).map(p=>{const production=workshop.parts[p.id];if(!production||production.step===0)return null;const r=production.rect;return <div className="capture-workshop-part" key={p.id} style={{left:`${r.x/640*100}%`,top:`${r.y/416*100}%`,width:`${r.width/640*100}%`,height:`${r.height/416*100}%`}}><StaticPart id={p.id} design={production.design} elements={production.elements} i18n={i18n} now={now}/></div>;})}
    </div></div>
  </div>;
}
function StaticPart({id,design:d,elements,i18n,now}:{id:WorkshopPartId;design:ComponentDesign;elements:readonly string[];i18n:I18n;now:number}) {
  const part=getWorkshopPart(id),style:CSSProperties={background:d.color,color:d.textColor,borderRadius:d.radius,fontSize:d.fontSize,boxShadow:d.shadow?'1px 1px 0 #666':undefined};
  const label=i18n.t(`ws.part.${id}` as MessageKey);
  const controls=(side:'start'|'end')=>elements.filter(e=>['minimize','maximize','close'].includes(e)&&(d.controlSides[e]??d.controlSide)===side).map(symbol=><span key={symbol} style={{color:d.controlColors[symbol]??d.textColor,borderWidth:d.symbolShape==='square'?2:1}}><LineIcon kind={symbol as 'minimize'|'maximize'|'close'}/></span>);
  return <div className={`capture-static-part capture-part-${part.kind}`} style={style}>
    {part.kind==='frame'?<><div className="capture-part-title" style={{background:d.color,color:d.textColor}}><div>{controls('start')}</div><b style={{textAlign:d.titleAlign}}>{i18n.t('ws.preview.window')}</b><div>{controls('end')}</div></div><p>{i18n.t('ws.preview.windowContent')}</p></>
      :part.kind==='button'?<span className="capture-part-button">{label}</span>
      :part.kind==='progress'?<div className={`capture-part-progress ${d.progressStyle}`} style={{height:d.progressHeight}}><i/>{d.showPercent&&<span>{i18n.t('number.percent',{value:i18n.number(50)})}</span>}</div>
      :part.kind==='scrollbar'?<div className="capture-part-scrollbar" style={{width:d.scrollbarWidth}}>{d.arrows&&<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 10 4-4 4 4z" fill="currentColor"/></svg>}<i/>{d.arrows&&<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4z" fill="currentColor"/></svg>}</div>
      :part.kind==='slider'?<div className="capture-part-slider"><i/></div>
      :part.kind==='input'?<span className="capture-part-input">{i18n.t('ws.preview.search')}</span>
      :part.kind==='toggle'?<label><svg className="capture-part-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor"/></svg>{label}</label>
      :part.kind==='list'||part.kind==='table'?<table><tbody>{[0,1,2].map(n=><tr key={n}><td>{i18n.t('ws.preview.line',{count:n+1})}</td><td>{i18n.integer(n+1)}</td></tr>)}</tbody></table>
      :id==='clock-time'?<time>{i18n.time(now)}</time>
      :id.startsWith('photo-')||id==='foundation-wallpaper'?<img src={coast} alt=""/>
      :<span style={{borderBottom:d.separator?'1px solid currentColor':undefined}}>{label}</span>}
  </div>;
}
function FrozenPhoto({edit,scene,catalog,i18n,ancestors}:{edit:FrozenPhoto|null;scene:CaptureScene;catalog:Screenshot[];i18n:I18n;ancestors:readonly number[]}) {
  if(!edit)return null;
  const shot=edit.source.startsWith('shot:')?catalog.find(s=>s.id===Number(edit.source.slice(5))):undefined;
  const style:CSSProperties={filter:`brightness(${edit.brightness}) sepia(${Math.abs(edit.tone)/100})`,transform:`scale(${1+edit.crop/100})`};
  return <div className="capture-photo" style={style}>{shot&&!ancestors.includes(shot.id)?ancestors.length<BALANCE.w3.capturePreviewDepth?<LegacyCapturePreview shot={shot} catalog={catalog} i18n={i18n} ancestors={ancestors}/>:<CaptureReference shot={shot} i18n={i18n}/>:<img src={edit.source==='night'?night:coast} alt="" data-capture-source={edit.source} data-capture-version={scene.version}/>}</div>;
}
/** The asset remains intact; only expansion into nested DOM has a presentation budget. */
function CaptureReference({shot,i18n}:{shot:Screenshot;i18n:I18n}) {
  const documentScene=readCapture(shot);
  return <div className="capture-reference" data-capture-reference={shot.id}><strong>{documentScene.display.productName??i18n.t('product.untitled')}</strong><p>{i18n.t('files.recorded',{date:i18n.dateTime(shot.at)})}</p><p>{i18n.t('foundation.pixels',{pixels:i18n.pixels(documentScene.display.resources.pixels)})}</p></div>;
}
function FrozenWindowContent({app,scene,catalog,i18n,ancestors}:{app:string;scene:CaptureScene;catalog:Screenshot[];i18n:I18n;ancestors:readonly number[]}) {
  if(app==='note')return <pre className="capture-note">{scene.note}</pre>;
  if(app==='tessera'&&scene.workshop&&scene.editorCustomization)return <WorkshopSnapshot workshop={scene.workshop} customization={scene.editorCustomization} stage={scene.appearance.editor} i18n={i18n} now={scene.display.wallTime}/>;
  if(app==='photo')return <FrozenPhoto edit={scene.view.photo} scene={scene} catalog={catalog} i18n={i18n} ancestors={ancestors}/>;
  if(app==='files'||app==='tessera')return <table className="capture-files"><thead><tr><th>{i18n.t('files.name')}</th><th>{i18n.t('files.modified')}</th><th>{i18n.t('files.type')}</th></tr></thead><tbody>{scene.files.map(f=><tr key={f.id}><td>{f.name}</td><td>{f.at===null?'':i18n.dateTime(f.at)}</td><td>{i18n.t(`files.type.${f.kind}` as MessageKey)}</td></tr>)}</tbody></table>;
  if(app==='mail')return <div className="capture-mail">{scene.desktop.feedback.map(f=><div key={f.id}><b>{i18n.t(`feedback.sender.${f.sender}`)}</b><time>{i18n.dateTime(f.at)}</time><span>{f.completedAt===null?i18n.t('mail.pending'):i18n.t('mail.completed',{date:i18n.dateTime(f.completedAt)})}</span></div>)}</div>;
  if(app==='clock')return <time className="capture-clock">{i18n.time(scene.display.wallTime)}</time>;
  return <table className="capture-files"><tbody>{(Object.keys(scene.display.specs) as (keyof typeof scene.display.specs)[]).map(key=><tr key={key}><th>{i18n.t(`spec.${key}`)}</th><td>{i18n.spec(key,scene.display.specs[key])}</td></tr>)}</tbody></table>;
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
    <div style={{height:scene.screen.height*scale}}><div className={`screenshot-stage capture-desktop desktop-era-${scene.appearance.desktop} capture-era-${scene.appearance.desktop} ${prefs.mode==='dark'?'capture-dark':''}`} inert aria-hidden="true" style={{width:scene.screen.width,height:scene.screen.height,transform:`scale(${scale})`,background:prefs.wallpaper?'#1f363e':scene.appearance.desktop===0?'#008080':'#42627e'}}>
      {prefs.wallpaper&&<div className="capture-wallpaper"><FrozenPhoto edit={prefs.wallpaper} scene={scene} catalog={catalog} i18n={recorded} ancestors={chain}/></div>}
      {visible.map(app=>{const icon=scene.desktop.icons[app];return icon?<div className="capture-desktop-icon" key={app} style={{left:icon.x,top:icon.y}}><span><ProductGlyph/></span><small>{appName(app,scene,recorded)}</small></div>:null;})}
      {Object.entries(scene.desktop.windows).filter(([,w])=>w.open&&!w.minimized).sort(([,a],[,b])=>a.z-b.z).map(([app,w])=><section className={`capture-window ${app===scene.desktop.active?'capture-active':''}`} key={app} style={{left:w.x,top:w.y,width:w.width,height:w.height,borderRadius:scene.appearance.desktop>1?prefs.radius:0}}><header><b>{appName(app,scene,recorded)}</b><span><LineIcon kind="minimize"/><LineIcon kind="maximize"/><LineIcon kind="close"/></span></header><div className="capture-window-client"><FrozenWindowContent app={app} scene={scene} catalog={catalog} i18n={recorded} ancestors={chain}/></div></section>)}
      <footer className="capture-taskbar"><strong>{scene.display.productName??recorded.t('product.untitled')}</strong><span>{recorded.t('foundation.pixels',{pixels:recorded.pixels(scene.display.resources.pixels)})}</span><time>{recorded.time(scene.display.wallTime)}</time></footer>
    </div></div>
  </div>;
}
