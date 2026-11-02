import { BALANCE } from '../config/balance';
import { getInstalledAppParts } from './appAssembly';
import { isBuildable } from './appLayout';
import { desktopStage } from './appearance';
import { producedControlSide, producedWindowChrome } from './commonChrome';
import { taskbarHeight, workHeight } from './desktopGeometry';
import type { AppId, Rect } from './desktopState';
import { hasDesktopSkill } from './desktopJobs';
import { globalMultiplier } from './longPlay';
import type { GameState } from './state';
import { evaluateVisibility, intersectRect, subtractRect, type CaptureElement, type CaptureOccluder, type CaptureVisibility } from './captureVisibility';
import type { CaptureScene } from './captureScene';

export interface CapturePlacement {app:string;role:string;sourcePartId?:string;rect:Rect;paint?:{color:string;backgroundColor:string}}
export interface CaptureGeometry {origin:'dom'|'model';viewport:Rect;elements:CaptureElement[];occluders:CaptureOccluder[];windowClients?:Record<string,Rect>;windowTitles?:Record<string,string>;placements?:CapturePlacement[]}
export interface CaptureEvaluation extends CaptureVisibility {version:1;origin:CaptureGeometry['origin'];reward:number;unit:number;resolutionMultiplier:number;colorMultiplier:number;globalMultiplier:number;windowClients:Record<string,Rect>;windowTitles:Record<string,string>;placements:CapturePlacement[]}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const amount=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const count=(value:unknown):value is number=>amount(value)&&Number.isSafeInteger(value);
const rectValid=(value:unknown):value is Rect=>record(value)&&['x','y','width','height'].every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]))&&Number(value.width)>0&&Number(value.height)>0;
const frozenColor=(value:unknown)=>typeof value==='string'&&(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)||/^rgba?\([\d., %/+-]+\)$/.test(value));
export function isCaptureEvaluation(value:unknown):value is CaptureEvaluation {
  if(!record(value)||value.version!==1||!['dom','model'].includes(String(value.origin))||!Array.isArray(value.parts)||value.parts.length>BALANCE.capture.maxElements)return false;
  if(!value.parts.every(part=>record(part)&&typeof part.id==='string'&&typeof part.type==='string'&&(part.app===undefined||typeof part.app==='string')&&(part.sourcePartId===undefined||typeof part.sourcePartId==='string')
    &&Array.isArray(part.rects)&&part.rects.length<=BALANCE.capture.maxVisibleRects&&part.rects.every(rectValid)&&Array.isArray(part.visibleRects)&&part.visibleRects.length<=BALANCE.capture.maxVisibleRects&&part.visibleRects.every(rectValid)
    &&amount(part.area)&&amount(part.visibleArea)&&amount(part.hiddenArea)&&typeof part.layer==='number'&&Number.isFinite(part.layer)&&typeof part.visible==='boolean'&&part.visible===(part.visibleArea>0)))return false;
  const parts=value.parts as CaptureVisibility['parts'],visible=parts.filter(part=>part.visible);
  return new Set(parts.map(part=>part.id)).size===parts.length&&count(value.visibleCount)&&value.visibleCount===visible.length&&count(value.kinds)&&value.kinds===new Set(visible.map(part=>part.type)).size
    &&count(value.fullyHidden)&&value.fullyHidden===parts.filter(part=>part.area>0&&!part.visible).length&&Array.isArray(value.visibleWindows)&&value.visibleWindows.every(id=>typeof id==='string')
    &&['reward','unit','resolutionMultiplier','colorMultiplier','globalMultiplier'].every(key=>amount(value[key]))
    &&record(value.windowClients)&&Object.values(value.windowClients).every(rectValid)&&record(value.windowTitles)&&Object.values(value.windowTitles).every(title=>typeof title==='string')&&Array.isArray(value.placements)&&value.placements.length<=BALANCE.capture.maxElements
    &&value.placements.every(item=>record(item)&&typeof item.app==='string'&&typeof item.role==='string'&&(item.sourcePartId===undefined||typeof item.sourcePartId==='string')&&rectValid(item.rect)&&(item.paint===undefined||record(item.paint)&&frozenColor(item.paint.color)&&frozenColor(item.paint.backgroundColor)));
}

/** Runtime-only measurement cache. It never enters a save and is invalidated when its source graph changes. */
const exactGeometry=new WeakMap<GameState,CaptureGeometry>();
interface RegisteredGeometry {state:GameState;geometry:CaptureGeometry;signature:string}
const windowGeometry=new WeakMap<GameState['run']['desktop']['windows'],RegisteredGeometry>();
const signature=(s:GameState)=>JSON.stringify([s.run.world,s.run.desktop.workspace,s.run.desktop.notice,s.run.desktop.success,s.run.workshop.view,s.run.workshop.activePart,s.run.workshop.zoom,s.run.workshop.guide.current,s.run.workshop.guide.collapsed,s.run.play.achievement?.id??null]);
export function registerCaptureGeometry(state:GameState,geometry:CaptureGeometry):void {
  exactGeometry.set(state,geometry);windowGeometry.set(state.run.desktop.windows,{state,geometry,signature:signature(state)});
}
export function registeredCaptureGeometry(state:GameState):CaptureGeometry|undefined {
  const exact=exactGeometry.get(state);if(exact)return exact;
  const cached=windowGeometry.get(state.run.desktop.windows),previous=cached?.state;
  return cached&&previous&&cached.signature===signature(state)&&previous.resources===state.resources
    &&previous.run.desktop.projects===state.run.desktop.projects&&previous.run.desktop.apps===state.run.desktop.apps&&previous.run.desktop.upgrades===state.run.desktop.upgrades
    &&previous.run.workshop.parts===state.run.workshop.parts&&previous.persistent.editorCustomization===state.persistent.editorCustomization
    &&previous.persistent.editorSkills===state.persistent.editorSkills&&previous.persistent.desktopPrefs===state.persistent.desktopPrefs?cached.geometry:undefined;
}
export function windowClientRect(state:GameState,app:AppId):Rect {
  const nativeWindow=state.run.desktop.windows[app],stage=Math.min(desktopStage(state),BALANCE.capture.titleHeights.length-1),metrics=BALANCE.capture;
  const border=metrics.frameBorders[stage]!,padding=metrics.framePaddings[stage]!,topBorder=metrics.frameTopBorders[stage]!,margin=metrics.contentMargins[stage]!,contentBorder=metrics.contentBorders[stage]!;
  const chrome=producedWindowChrome(state,app),title=chrome?.custom?Math.max(chrome.design.fontSize+metrics.nativeFontPadding,metrics.controlHeights[stage]!):metrics.titleHeights[stage]!;
  const side=border+padding+margin+contentBorder,top=topBorder+title+margin+contentBorder;
  return {x:nativeWindow.x+side,y:nativeWindow.y+top,width:Math.max(0,nativeWindow.width-side*2),height:Math.max(0,nativeWindow.height-top-border-padding-margin-contentBorder)};
}
const translate=(rect:Rect,dx:number,dy:number):Rect=>({...rect,x:rect.x+dx,y:rect.y+dy});
const viewportOf=(state:GameState):Rect=>({x:0,y:0,width:state.run.desktop.screen.width,height:state.run.desktop.screen.height});
const sourceElement=(id:string,type:string,rects:Rect[],layer:number,app?:string,sourcePartId?:string):CaptureElement=>({id,type,rects,layer,...(app?{app}:{}),...(sourcePartId?{sourcePartId}:{})});
function windowElements(id:string,nativeWindow:Rect,client:Rect,titleHeight:number,controlsWidth:number,layer:number,controls?:Rect[]):CaptureElement[] {
  const title={x:nativeWindow.x,y:nativeWindow.y,width:nativeWindow.width,height:Math.min(nativeWindow.height,titleHeight)};
  const perimeter=subtractRect(nativeWindow,client).flatMap(rect=>subtractRect(rect,title));
  return [sourceElement(`${id}:frame`,'common-frame',perimeter,layer,id,'common-frame'),sourceElement(`${id}:title`,'common-frame:title',[title],layer,id,'common-frame'),
    sourceElement(`${id}:controls`,'common-frame:controls',controls??[{x:nativeWindow.x+Math.max(0,nativeWindow.width-controlsWidth),y:title.y,width:Math.min(nativeWindow.width,controlsWidth),height:title.height}],layer,id,'common-frame')];
}
/** State-only fallback for simulations and an automatic shot before a newly changed graph has rendered. */
export function modelCaptureGeometry(state:GameState):CaptureGeometry {
  const d=state.run.desktop,stage=Math.min(desktopStage(state),BALANCE.capture.titleHeights.length-1),g=BALANCE.capture.geometry,viewport=viewportOf(state),height=taskbarHeight(d.screen),barY=d.screen.height-height;
  const elements:CaptureElement[]=[],occluders:CaptureOccluder[]=[],windowClients:Record<string,Rect>={},placements:CapturePlacement[]=[];
  const installed:AppId[]=['tessera','note',...d.apps,'settings'];
  const visible=installed.filter(id=>d.windows[id].open&&!d.windows[id].minimized&&(!hasDesktopSkill(state,'virtual')||d.workspaces[id]===d.workspace));
  const add=(id:string,type:string,rect:Rect,layer=0,app?:string,source?:string)=>elements.push(sourceElement(id,type,[rect],layer,app,source));
  add('desktop:background','foundation-desktop',{x:0,y:0,width:d.screen.width,height:workHeight(d.screen)},0,undefined,'foundation-desktop');
  if(state.persistent.desktopPrefs.wallpaper){
    const rect={x:0,y:0,width:d.screen.width,height:workHeight(d.screen)};
    add('desktop:wallpaper','foundation-wallpaper',rect,1,undefined,'foundation-wallpaper');occluders.push({id:'desktop:wallpaper',rect,layer:1});
  }
  add('taskbar:surface','foundation-taskbar',{x:0,y:barY,width:d.screen.width,height},g.taskbarLayer,undefined,'foundation-taskbar');
  const item=g.taskbar;
  add('taskbar:product-icon','product-icon',{x:0,y:barY,width:item.iconWidth,height},g.taskbarLayer);
  add('taskbar:product-name','product-name',{x:item.iconWidth,y:barY,width:item.productWidth-item.iconWidth,height},g.taskbarLayer);
  const resource=stage===2?{x:d.screen.width-g.resourcePanel.right-g.resourcePanel.width,y:g.resourcePanel.top,width:g.resourcePanel.width,height:g.resourcePanel.height}:{x:Math.max(item.productWidth,d.screen.width-item.controlWidth*3),y:barY,width:Math.min(d.screen.width,item.controlWidth*3),height};
  const resourceLayer=stage===2?g.windowLayer-1:g.taskbarLayer,firstHeight=stage===2?g.resourcePanel.pixelHeight:height;
  add('resource:pixel-icon','pixel-resource',{x:resource.x,y:resource.y,width:item.iconWidth,height:firstHeight},resourceLayer);
  add('resource:pixel-value','pixel-value',{x:resource.x+item.iconWidth,y:resource.y,width:resource.width-item.iconWidth,height:firstHeight},resourceLayer);
  if(stage>=2)add('resource:pixel-rate','pixel-rate',{x:resource.x+item.iconWidth,y:resource.y+firstHeight/2,width:resource.width-item.iconWidth,height:firstHeight/2},resourceLayer);
  const tokenY=stage===2?resource.y+firstHeight:resource.y,tokenX=stage===2?resource.x:resource.x+item.controlWidth;
  add('resource:token-icon','token-resource',{x:tokenX,y:tokenY,width:item.iconWidth,height:stage===2?g.resourcePanel.tokenHeight:height},resourceLayer);
  add('resource:token-value','token-value',{x:tokenX+item.iconWidth,y:tokenY,width:item.controlWidth-item.iconWidth,height:stage===2?g.resourcePanel.tokenHeight:height},resourceLayer);
  add('resource:progress','release-progress',{x:Math.max(item.productWidth,d.screen.width-item.controlWidth),y:barY,width:item.controlWidth,height},g.taskbarLayer);
  for(const id of installed.filter(id=>id!=='settings')){
    const point=d.icons[id];add(`icon:${id}`,'desktop-icon',{...point,width:g.shortcutWidth,height:Math.max(g.shortcutMinHeight,state.persistent.desktopPrefs.iconSize+g.shortcutCaption)},2,undefined,'foundation-icons');
  }
  for(const id of visible){
    const nativeWindow=d.windows[id],layer=g.windowLayer+nativeWindow.z,client=windowClientRect(state,id),titleHeight=client.y-nativeWindow.y;
    windowClients[id]=client;
    occluders.push({id,rect:{x:nativeWindow.x,y:nativeWindow.y,width:nativeWindow.width,height:nativeWindow.height},layer});
    const chrome=producedWindowChrome(state,id),symbols=chrome?.symbols??(['minimize','maximize','close'] as const),controls:Rect[]=[];
    for(const side of ['start','end'] as const){
      const shown=symbols.filter(symbol=>chrome?producedControlSide(chrome,symbol)===side:side==='end'),width=(symbol:string)=>symbol==='close'?BALANCE.capture.closeControlWidths[stage]!:BALANCE.capture.controlWidths[stage]!,gap=BALANCE.capture.controlGaps[stage]!;
      let x=side==='start'?nativeWindow.x+BALANCE.capture.frameBorders[stage]!:nativeWindow.x+nativeWindow.width-BALANCE.capture.frameBorders[stage]!-shown.reduce((sum,symbol)=>sum+width(symbol),0)-Math.max(0,shown.length-1)*gap;
      for(const symbol of shown){const rect={x,y:nativeWindow.y+BALANCE.capture.frameTopBorders[stage]!,width:width(symbol),height:Math.min(titleHeight,BALANCE.capture.controlHeights[stage]!)};controls.push(rect);placements.push({app:id,role:`chrome:${symbol}`,sourcePartId:'common-frame',rect});x+=rect.width+gap;}
    }
    elements.push(...windowElements(id,nativeWindow,client,titleHeight,BALANCE.capture.chromeControlsWidths[stage]!,layer,controls));
    if(isBuildable(id)){
      const grouped=new Map<string,CaptureElement>();
      for(const part of getInstalledAppParts(state,id,client.width,client.height)){
        placements.push({app:id,role:part.role,sourcePartId:part.sourcePartId,rect:translate(part.rect,client.x,client.y)});
        const rectangle=intersectRect(translate(part.rect,client.x,client.y),client);if(!rectangle)continue;
        const key=`${id}:part:${part.sourcePartId}`,entry=grouped.get(key);
        if(entry)entry.rects.push(rectangle);else grouped.set(key,sourceElement(key,part.sourcePartId,[rectangle],layer,id,part.sourcePartId));
      }
      elements.push(...grouped.values());
    }else if(id==='tessera'){
      const editor=g.editor,c=state.persistent.editorCustomization;
      add('tessera:toolbar','editor-toolbar',{...client,height:Math.min(client.height,editor.toolbarHeight)},layer,id);
      add('tessera:palette','editor-palette',{x:client.x,y:client.y+editor.toolbarHeight,width:Math.min(client.width,editor.paletteWidth),height:Math.max(0,client.height-editor.toolbarHeight)},layer,id);
      add('tessera:parts','editor-parts',{x:Math.max(client.x,client.x+client.width-c.panelWidth),y:client.y+editor.toolbarHeight,width:Math.min(client.width,c.panelWidth),height:Math.max(0,client.height-editor.toolbarHeight)},layer,id);
      const active=state.run.workshop.activePart,production=active?state.run.workshop.parts[active]:null;
      if(active&&production&&production.step>0)add(`tessera:part:${active}`,active,{x:client.x+editor.paletteWidth,y:client.y+editor.toolbarHeight,width:Math.max(0,client.width-editor.paletteWidth-c.panelWidth),height:Math.max(0,client.height-editor.toolbarHeight)},layer,id,active);
    }else add(`${id}:document`,id==='note'?'production-note':'settings-page',[...Object.values(client)].every(Number.isFinite)?client:{x:0,y:0,width:0,height:0},layer,id);
  }
  if(d.notice!==null||d.success!==null||state.run.play.achievement){
    const n=g.notification,rect={x:Math.max(0,d.screen.width-n.right-n.width),y:stage===3?n.flatTop:Math.max(0,barY-n.gap-n.height),width:Math.min(n.width,d.screen.width),height:n.height};
    const ids=[...(d.notice!==null||d.success!==null?['notification:feedback']:[]),...(state.run.play.achievement?['notification:achievement']:[])];
    ids.forEach((id,index)=>{const shifted={...rect,x:Math.max(0,rect.x-index*(rect.width+n.gap))};add(id,'notification',shifted,g.notificationLayer+index);occluders.push({id,rect:shifted,layer:g.notificationLayer+index});});
  }
  return {origin:'model',viewport,elements,occluders,windowClients,placements};
}
export function evaluateCapture(state:GameState,geometry:CaptureGeometry=registeredCaptureGeometry(state)??modelCaptureGeometry(state)):CaptureEvaluation {
  const visible=evaluateVisibility(geometry.elements,geometry.occluders,geometry.viewport),resolutionMultiplier=BALANCE.w3.shotResolutionMultiplier**state.persistent.specs.resolution,colorMultiplier=BALANCE.spec.color[state.persistent.specs.color]!.multiplier,multiplier=globalMultiplier(state);
  return {...visible,version:1,origin:geometry.origin,windowClients:geometry.windowClients??{},windowTitles:geometry.windowTitles??{},placements:geometry.placements??[],unit:BALANCE.capture.pixelsPerPart,resolutionMultiplier,colorMultiplier,globalMultiplier:multiplier,reward:visible.visibleCount*BALANCE.capture.pixelsPerPart*resolutionMultiplier*colorMultiplier*multiplier};
}
export const screenshotContentCount=(state:GameState)=>evaluateCapture(state).visibleCount;
export const screenshotContentReward=(state:GameState)=>evaluateCapture(state).reward;
/** Historical recordings are judged from recorded content geometry, never their old payout/placement fields. */
export function frozenContentVisibility(scene:CaptureScene):CaptureVisibility {
  const screen=scene.screen,viewport={x:0,y:0,width:screen.width,height:screen.height},metrics=BALANCE.capture,stage=Math.min(scene.appearance.desktop,metrics.titleHeights.length-1),elements:CaptureElement[]=[],occluders:CaptureOccluder[]=[];
  const workspace=scene.view.desktop.workspace,spaces=scene.view.desktop.workspaces as Record<string,unknown>|undefined;
  for(const [id,w] of Object.entries(scene.desktop.windows)){
    if(!w.open||w.minimized||spaces&&workspace!==undefined&&spaces[id]!==workspace)continue;
    const layer=metrics.geometry.windowLayer+w.z,side=metrics.frameBorders[stage]!+metrics.framePaddings[stage]!+metrics.contentBorders[stage]!+metrics.contentMargins[stage]!,top=metrics.frameTopBorders[stage]!+metrics.titleHeights[stage]!+metrics.contentBorders[stage]!+metrics.contentMargins[stage]!;
    const client={x:w.x+side,y:w.y+top,width:Math.max(0,w.width-side*2),height:Math.max(0,w.height-top-side)};
    occluders.push({id,rect:w,layer});elements.push(...windowElements(id,w,client,top,metrics.chromeControlsWidths[stage]!,layer));
    const project=scene.appProjects?.[id as keyof typeof scene.appProjects],layout=project?.installed;
    if(layout&&Number.isFinite(layout.width)&&layout.width>0&&Number.isFinite(layout.height)&&layout.height>0&&Array.isArray(layout.parts))for(const part of layout.parts){
      if(!part||![part.x,part.y,part.width,part.height].every(Number.isFinite)||part.width<=0||part.height<=0)continue;
      const rect=intersectRect({x:client.x+part.x*client.width/layout.width,y:client.y+part.y*client.height/layout.height,width:part.width*client.width/layout.width,height:part.height*client.height/layout.height},client);
      if(rect)elements.push(sourceElement(`${id}:part:${part.id}`,`recorded:${id}:${part.id}`,[rect],layer,id));
    }
  }
  for(const id of [...new Set(['tessera','note',...scene.desktop.apps])].filter(id=>id!=='settings')){
    const position=scene.desktop.icons[id];if(position)elements.push(sourceElement(`icon:${id}`,'desktop-icon',[{...position,width:metrics.geometry.shortcutWidth,height:Math.max(metrics.geometry.shortcutMinHeight,scene.view.preferences.iconSize+metrics.geometry.shortcutCaption)}],0));
  }
  elements.push(sourceElement('recorded:background','foundation-wallpaper',[{x:0,y:0,width:screen.width,height:screen.height-taskbarHeight(screen)}],0));
  elements.push(sourceElement('recorded:taskbar','foundation-taskbar',[{x:0,y:screen.height-taskbarHeight(screen),width:screen.width,height:taskbarHeight(screen)}],metrics.geometry.taskbarLayer));
  return evaluateVisibility(elements,occluders,viewport);
}
