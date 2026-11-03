import { useLayoutEffect, type RefObject } from 'react';
import { BALANCE } from '../config/balance';
import { evaluateCapture, modelCaptureGeometry, registerCaptureGeometry, type CaptureEvaluation, type CaptureGeometry, type CapturePlacement } from '../systems/captureEvaluation';
import { intersectRect, subtractRect, type CaptureElement, type CaptureOccluder } from '../systems/captureVisibility';
import type { Rect } from '../systems/desktopState';
import type { GameState } from '../systems/state';
import { installedAssembly } from '../systems/appAssembly';
import { isBuildable } from '../systems/appLayout';

/** DOM access remains in the renderer. The game receives immutable logical rectangles only. */
export function collectCaptureGeometry(root:HTMLElement,state:GameState):CaptureGeometry {
  const screen=state.run.desktop.screen,bounds=root.getBoundingClientRect(),sx=bounds.width/screen.width,sy=bounds.height/screen.height;
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||sy<=0)return modelCaptureGeometry(state);
  const viewport={x:0,y:0,width:screen.width,height:screen.height},elements=new Map<string,CaptureElement>(),occluders:CaptureOccluder[]=[],windowClients:Record<string,Rect>={},windowTitles:Record<string,string>={},placements:CapturePlacement[]=[];
  const precise=(value:number)=>Math.round(value/BALANCE.capture.geometry.coordinateUnit)*BALANCE.capture.geometry.coordinateUnit;
  const transform=(rect:Pick<DOMRect,'left'|'top'|'width'|'height'>):Rect=>{
    const x=precise((rect.left-bounds.left)/sx),y=precise((rect.top-bounds.top)/sy),right=precise((rect.left+rect.width-bounds.left)/sx),bottom=precise((rect.top+rect.height-bounds.top)/sy);
    return {x,y,width:right-x,height:bottom-y};
  };
  const belongs=(node:Element)=>node.closest('.desktop')===root;
  const shown=(node:Element)=>{
    if(!belongs(node))return false;
    for(let parent:Element|null=node;parent&&parent!==root;parent=parent.parentElement){
      const style=getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
    }
    return true;
  };
  const clip=(rects:Rect[],node:Element)=>{
    for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement){
      const style=getComputedStyle(parent),clipsX=['hidden','auto','scroll','clip'].includes(style.overflowX),clipsY=['hidden','auto','scroll','clip'].includes(style.overflowY);
      if(!clipsX&&!clipsY)continue;
      const raw=parent.getBoundingClientRect(),boundary=transform({left:raw.left+parent.clientLeft*sx,top:raw.top+parent.clientTop*sy,width:parent.clientWidth*sx,height:parent.clientHeight*sy});
      const limit={x:clipsX?boundary.x:viewport.x,y:clipsY?boundary.y:viewport.y,width:clipsX?boundary.width:viewport.width,height:clipsY?boundary.height:viewport.height};
      rects=rects.flatMap(rect=>intersectRect(rect,limit)??[]);
    }
    return rects.flatMap(rect=>intersectRect(rect,viewport)??[]);
  };
  const box=(node:Element)=>clip([transform(node.getBoundingClientRect())],node).filter(rect=>rect.width>0&&rect.height>0);
  const append=(id:string,type:string,rects:Rect[],layer:number,app?:string,sourcePartId?:string)=>{
    const existing=elements.get(id);if(existing)existing.rects.push(...rects);else elements.set(id,{id,type,rects,layer,...(app?{app}:{}),...(sourcePartId?{sourcePartId}:{})});
  };
  const element=(id:string,type:string,node:Element|null,layer:number,app?:string,sourcePartId?:string)=>{
    if(node&&shown(node))append(id,type,box(node),layer,app,sourcePartId);
  };
  const directText=(id:string,type:string,node:Element|null,layer:number)=>{
    if(!node||!shown(node))return;
    const rects:Rect[]=[];
    for(const child of node.childNodes){if(child.nodeType!==Node.TEXT_NODE||!child.textContent?.trim())continue;
      const range=node.ownerDocument.createRange();range.selectNodeContents(child);for(const rect of range.getClientRects())rects.push(transform(rect));range.detach();}
    append(id,type,clip(rects,node),layer);
  };
  const taskbarLayer=BALANCE.capture.geometry.taskbarLayer;
  const ground=root.dataset.shellPart??'foundation-desktop';
  append('desktop:background',ground,[viewport],0,undefined,ground);
  for(const surface of root.querySelectorAll(':scope>.desktop-wallpaper-surface,:scope>.desktop-wallpaper')){
    if(!shown(surface))continue;
    const source=(surface as HTMLElement).dataset.shellPart??'foundation-wallpaper',rects=box(surface);
    append('desktop:wallpaper',source,rects,1,undefined,source);
    for(const rect of rects)occluders.push({id:'desktop:wallpaper',rect,layer:1});
  }
  const taskbar=root.querySelector(':scope>.desktop-taskbar');
  element('taskbar:surface','foundation-taskbar',taskbar,taskbarLayer,undefined,'foundation-taskbar');
  if(taskbar&&shown(taskbar))occluders.push({id:'taskbar',rect:transform(taskbar.getBoundingClientRect()),layer:taskbarLayer});
  element('taskbar:product-icon','product-icon',root.querySelector('.taskbar-product>.app-icon'),taskbarLayer);
  element('taskbar:product-name','product-name',root.querySelector('.taskbar-product>span'),taskbarLayer);
  element('resource:progress','release-progress',root.querySelector('.taskbar-progress'),taskbarLayer);
  for(const resource of root.querySelectorAll('.desktop-resources,.taskbar-balance')){
    if(!shown(resource))continue;
    const floating=resource.parentElement===root,layer=floating?BALANCE.capture.geometry.windowLayer-1:taskbarLayer;
    if(floating)occluders.push({id:'resource:panel',rect:transform(resource.getBoundingClientRect()),layer});
    element('resource:pixel-icon','pixel-resource',resource.querySelector('.pixel-resource'),layer);
    element('resource:pixel-value','pixel-value',resource.querySelector('[data-desktop-pixels],[data-taskbar-pixels]'),layer);
    element('resource:pixel-rate','pixel-rate',resource.querySelector('.taskbar-pixels small'),layer);
    element('resource:token-icon','token-resource',resource.querySelector('.token-resource'),layer);
    directText('resource:token-value','token-value',resource.querySelector('.taskbar-tokens'),layer);
  }
  for(const node of root.querySelectorAll(':scope>.desktop-shortcut'))element(`icon:${(node as HTMLElement).dataset.shortcut??'secret'}`,'desktop-icon',node,2,undefined,'foundation-icons');
  for(const node of root.querySelectorAll('.desktop-taskbar .taskbar-apps>button'))element(`taskbar:app:${node.getAttribute('aria-label')??elements.size}`,'taskbar-app',node,taskbarLayer,undefined,'foundation-taskbar');
  for(const selector of ['.taskbar-clock','.notification-button','.taskbar-job-source','.taskbar-workspaces'])element(`taskbar:${selector}`,selector,root.querySelector(selector),taskbarLayer);
  for(const node of root.querySelectorAll(':scope>.desktop-window')){
    if(!shown(node))continue;
    const app=(node as HTMLElement).dataset.app;if(!app)continue;
    const layer=Number(getComputedStyle(node).zIndex)||BALANCE.capture.geometry.windowLayer,window=transform(node.getBoundingClientRect());
    if(window.width<=0||window.height<=0)continue;
    occluders.push({id:app,rect:window,layer});
    const title=node.querySelector(':scope>.window-title'),content=node.querySelector(':scope>.window-content');
    const titleText=title?.querySelector(':scope>span')?.textContent;if(titleText!==null&&titleText!==undefined)windowTitles[app]=titleText;
    const titleLabel=title?.querySelector(':scope>span');
    if(titleLabel&&shown(titleLabel)){const rect=transform(titleLabel.getBoundingClientRect());if(rect.width>0&&rect.height>0)placements.push({app,role:'chrome:title',rect});}
    const titleIcon=title?.querySelector(':scope>.app-icon');
    if(titleIcon&&shown(titleIcon)){const rect=transform(titleIcon.getBoundingClientRect());if(rect.width>0&&rect.height>0)placements.push({app,role:'chrome:icon',rect});}
    if(content){
      const layout=content.querySelector(':scope>.app-layout'),clientNode=layout??content,raw=clientNode.getBoundingClientRect();
      windowClients[app]=layout?transform(raw):transform({left:raw.left+content.clientLeft*sx,top:raw.top+content.clientTop*sy,width:content.clientWidth*sx,height:content.clientHeight*sy});
    }
    let perimeter=[window];
    for(const region of [title,content])if(region)perimeter=perimeter.flatMap(rect=>subtractRect(rect,transform(region.getBoundingClientRect())));
    append(`${app}:frame`,'common-frame',perimeter,layer,app,'common-frame');
    element(`${app}:title`,'common-frame:title',title,layer,app,'common-frame');
    for(const button of title?.querySelectorAll('.window-controls>button')??[]){
      element(`${app}:controls`,'common-frame:controls',button,layer,app,'common-frame');
      const symbol=(button as HTMLElement).dataset.windowSymbol;
      const rect=transform(button.getBoundingClientRect());
      if(symbol&&rect.width>0&&rect.height>0){const paint=getComputedStyle(button);placements.push({app,role:`chrome:${symbol}`,sourcePartId:'common-frame',rect,paint:{color:paint.color,backgroundColor:paint.backgroundColor}});}
    }
    for(const part of node.querySelectorAll('[data-app-part]')){
      if(part.closest('.desktop-window')!==node||!shown(part))continue;
      const source=(part as HTMLElement).dataset.sourcePart,role=(part as HTMLElement).dataset.appPart;
      element(`${app}:part:${source??role}`,source??`${app}:${role}`,part,layer,app,source);
      const rect=transform(part.getBoundingClientRect());
      if(role&&rect.width>0&&rect.height>0)placements.push({app,role,sourcePartId:source,rect});
    }
    // Common materials are counted only where their native control is really drawn.
    // Recipe adoption alone never implies that a heading, progress bar, or scrollbar is visible.
    const common=isBuildable(app)?installedAssembly(state,app)?.common:undefined;
    const adopted=(source:string)=>common?.some(material=>material.source===source);
    for(const [source,selector] of [['common-button','.app-layout .app-layout-part :is(button.win-button,button.nav-button)'],['common-heading','.app-layout .app-layout-part :is(h1,h2,h3)'],['common-progress','.app-layout .app-layout-part progress']] as const){
      if(adopted(source))for(const control of node.querySelectorAll(selector))element(`${app}:part:${source}`,source,control,layer,app,source);
    }
    if(adopted('common-frame'))for(const candidate of node.querySelectorAll<HTMLElement>('.app-layout,.app-layout *')){
      if(!shown(candidate))continue;
      const style=getComputedStyle(candidate),raw=candidate.getBoundingClientRect();
      const vertical=candidate.offsetWidth-candidate.clientWidth-parseFloat(style.borderLeftWidth||'0')-parseFloat(style.borderRightWidth||'0');
      const horizontal=candidate.offsetHeight-candidate.clientHeight-parseFloat(style.borderTopWidth||'0')-parseFloat(style.borderBottomWidth||'0');
      const rects:Rect[]=[];
      if(vertical>0&&(style.overflowY==='scroll'||style.overflowY==='auto'&&candidate.scrollHeight>candidate.clientHeight))rects.push(transform({left:raw.right-(parseFloat(style.borderRightWidth||'0')+vertical)*sx,top:raw.top+candidate.clientTop*sy,width:vertical*sx,height:candidate.clientHeight*sy}));
      if(horizontal>0&&(style.overflowX==='scroll'||style.overflowX==='auto'&&candidate.scrollWidth>candidate.clientWidth))rects.push(transform({left:raw.left+candidate.clientLeft*sx,top:raw.bottom-(parseFloat(style.borderBottomWidth||'0')+horizontal)*sy,width:candidate.clientWidth*sx,height:horizontal*sy}));
      if(rects.length)append(`${app}:part:common-scrollbar`,'common-scrollbar',clip(rects,candidate),layer,app,'common-scrollbar');
    }
    if(app==='tessera'){
      for(const selector of ['.editor-shell-fixed-top','.editor-shell-top','.editor-shell-palette','.editor-shell-tools','.editor-shell-parts','.editor-shell-bottom','.editor-shell-layers']){
        const part=node.querySelector(selector);element(`${app}:${selector}`,`editor:${selector}`,part,layer,app);
      }
      for(const part of node.querySelectorAll('[data-workshop-canvas-part]')){
        const source=(part as HTMLElement).dataset.workshopCanvasPart;if(source)element(`${app}:part:${source}`,source,part,layer,app,source);
      }
      const target=node.querySelector('.ws-target-window'),targetTitle=target?.querySelector(':scope>.ws-target-title'),targetClient=target?.querySelector(':scope>.ws-destination');
      if(target&&shown(target)&&state.run.workshop.parts['common-frame']?.step){
        let regions=box(target);if(targetClient)regions=regions.flatMap(rect=>subtractRect(rect,transform(targetClient.getBoundingClientRect())));
        if(targetTitle)regions.push(...box(targetTitle));append(`${app}:part:common-frame`,'common-frame',regions,layer,app,'common-frame');
      }
    }else if(app==='note')element(`${app}:document`,'production-note',node.querySelector('.note-app textarea'),layer,app);
    else if(app==='settings')element(`${app}:document`,'settings-page',content,layer,app);
  }
  for(const node of root.querySelectorAll(':scope>.feedback-toast')){
    if(!shown(node))continue;
    const id=node.classList.contains('achievement-toast')?'notification:achievement':'notification:feedback',rect=transform(node.getBoundingClientRect()),layer=Number(getComputedStyle(node).zIndex)||BALANCE.capture.geometry.notificationLayer;
    append(id,'notification',[rect],layer);occluders.push({id,rect,layer});
  }
  return {origin:'dom',viewport,elements:[...elements.values()],occluders,windowClients,windowTitles,placements};
}
export function refreshCaptureGeometry(root:HTMLElement,state:GameState):CaptureEvaluation {
  const geometry=collectCaptureGeometry(root,state);registerCaptureGeometry(state,geometry);return evaluateCapture(state,geometry);
}
export function useCaptureGeometry(root:RefObject<HTMLElement|null>,state:GameState):void {
  useLayoutEffect(()=>{if(root.current)refreshCaptureGeometry(root.current,state);},[root,state]);
}
