import { useLayoutEffect, type RefObject } from 'react';

/** Fit text inside its existing seat; never resize the piece or its interactive controls. */
export function usePieceTextFit(root:RefObject<HTMLDivElement|null>,fontSize:number){
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;
  const dom=node.ownerDocument,canvas=dom.createElement('canvas'),context=canvas.getContext('2d');
  const fit=()=>{
   node.style.fontSize=`${fontSize}px`;
   for(let pass=0;pass<5;pass++){
    let ratio=1;
    const walker=dom.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    for(let text=walker.nextNode();text;text=walker.nextNode()){
     if(!text.textContent?.trim())continue;
     let box=text.parentElement;if(!box||box.closest('svg,option'))continue;
     while(box!==node&&(!box.clientWidth||!box.clientHeight))box=box.parentElement!;
     const bounds=box.getBoundingClientRect(),scale=bounds.width/Math.max(1,box.offsetWidth),css=getComputedStyle(box);
     const width=bounds.width-(parseFloat(css.paddingLeft)+parseFloat(css.paddingRight)+parseFloat(css.borderLeftWidth)+parseFloat(css.borderRightWidth))*scale;
     // Inline line boxes follow the font's metrics; treating them as fixed seats shrinks forever.
     const control=text.parentElement?.closest('.wf-slideshow-caption,button,input,select,textarea'),vertical=control&&node.contains(control)?control:node;
     const verticalCss=getComputedStyle(vertical),verticalBounds=vertical.getBoundingClientRect();
     const height=verticalBounds.height-(parseFloat(verticalCss.paddingTop)+parseFloat(verticalCss.paddingBottom)+parseFloat(verticalCss.borderTopWidth)+parseFloat(verticalCss.borderBottomWidth))*scale;
     const range=dom.createRange();range.selectNode(text);const r=range.getBoundingClientRect();
     if(width>0&&height>0)ratio=Math.max(ratio,r.width/width,r.height/height);
    }
    if(context)for(const input of node.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input:not([type=range]):not([type=checkbox]),select')){
     const css=getComputedStyle(input),value=input instanceof HTMLSelectElement?input.selectedOptions[0]?.text??'':input.value;
     context.font=`${css.fontSize} ${css.fontFamily}`;
     const width=input.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-(input instanceof HTMLSelectElement?18:0);
     if(width>0)ratio=Math.max(ratio,context.measureText(value).width/width);
    }
    if(ratio<=1.01)break;
    node.style.fontSize=`${Math.max(1,parseFloat(node.style.fontSize)/ratio*.97)}px`;
   }
   const face=node.firstElementChild;
   const bordered=face&&['BUTTON','INPUT','TEXTAREA','SELECT','PROGRESS','METER'].includes(face.tagName)||face&&['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].every(side=>parseFloat(getComputedStyle(face)[side as 'borderTopWidth'])>0);
   node.dataset.looseFrame=String(!bordered);
  };
  fit();const resize=new ResizeObserver(fit),mutation=new MutationObserver(fit);
  resize.observe(node);mutation.observe(node,{childList:true,characterData:true,subtree:true});
  dom.fonts.addEventListener('loadingdone',fit);
  node.addEventListener('input',fit);node.addEventListener('change',fit);
  return()=>{resize.disconnect();mutation.disconnect();dom.fonts.removeEventListener('loadingdone',fit);node.removeEventListener('input',fit);node.removeEventListener('change',fit);};
 },[root,fontSize]);
}
