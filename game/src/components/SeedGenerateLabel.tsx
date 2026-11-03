import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';

export type SeedGenerateLabelMode='full'|'compact'|'icon';
interface LabelSize {width:number;height:number}
export function seedGenerateLabelMode(available:LabelSize,full:LabelSize,compact:LabelSize):SeedGenerateLabelMode {
 const fits=(size:LabelSize)=>available.width>0&&available.height>0&&size.width<=available.width&&size.height<=available.height;
 return fits(full)?'full':fits(compact)?'compact':'icon';
}

function PixelPlus(){
 return <svg className="seed-generate-pixel-plus" viewBox="0 0 30 20" width={30} height={20} aria-hidden="true" focusable="false"><path d="M2 3h6v6H2zM10 3h6v6h-6zM2 11h6v6H2z" fill="currentColor"/><path d="M23 5v10m-5-5h10" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;
}
interface Props {fullCaption:string;formattedGain:string;style?:CSSProperties}
/** Keep the chosen font and press animation while adapting only the label's content. */
export function SeedGenerateLabel({fullCaption,formattedGain,style}:Props){
 const host=useRef<HTMLSpanElement>(null),full=useRef<HTMLSpanElement>(null),compact=useRef<HTMLSpanElement>(null),[mode,setMode]=useState<SeedGenerateLabelMode>('full');
 useLayoutEffect(()=>{
  const root=host.current,fullProbe=full.current,compactProbe=compact.current;if(!root||!fullProbe||!compactProbe)return;
  const measure=()=>{const next=seedGenerateLabelMode({width:root.clientWidth,height:root.clientHeight},{width:fullProbe.scrollWidth,height:fullProbe.scrollHeight},{width:compactProbe.scrollWidth,height:compactProbe.scrollHeight});setMode(current=>current===next?current:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(root);observer.observe(fullProbe);observer.observe(compactProbe);return()=>observer.disconnect();
 },[fullCaption,formattedGain]);
 return <span ref={host} className="seed-generate-label" data-seed-generate-label={mode} style={style}>
  <span className={`seed-generate-label-content seed-generate-label-${mode}`}>{mode==='full'?fullCaption:mode==='compact'?<><PixelPlus/><span className="seed-generate-label-value">{formattedGain}</span></>:<PixelPlus/>}</span>
  <span className="seed-generate-label-measure" aria-hidden="true">
   <span ref={full} className="seed-generate-label-full-probe" data-seed-generate-probe="full">{fullCaption}</span>
   <span ref={compact} className="seed-generate-label-compact-probe" data-seed-generate-probe="compact"><PixelPlus/><span>{formattedGain}</span></span>
  </span>
 </span>;
}
