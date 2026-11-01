import { useLayoutEffect,useRef,useState,type ReactNode } from 'react';
import './StatusBar.css';
export interface StatusField {id:string;text:string;priority:number}
// Keep complete fields. A higher priority survives longer when the window narrows.
export function StatusBar({fields,className='',children}:{fields:StatusField[];className?:string;children?:ReactNode}) {
 const content=useRef<HTMLDivElement>(null),probe=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState<string[]>(()=>fields.map(f=>f.id));
 const signature=JSON.stringify(fields);
 useLayoutEffect(()=>{
  const host=content.current,row=probe.current;if(!host||!row)return;
  const measure=()=>{
   const gap=parseFloat(getComputedStyle(host).columnGap)||0;
   const widths=Array.from(row.children).map(n=>(n as HTMLElement).offsetWidth);
   const keep=fields.map((field,index)=>({...field,width:widths[index]??0}));
   const drop=[...keep].sort((a,b)=>a.priority-b.priority);
   const required=()=>keep.reduce((sum,f)=>sum+f.width,0)+gap*Math.max(0,keep.length-1)+keep.length*2;
   while(keep.length&&required()>host.clientWidth){const id=drop.shift()!.id;keep.splice(keep.findIndex(f=>f.id===id),1);}
   const ids=keep.map(f=>f.id);setVisible(old=>old.length===ids.length&&old.every((id,i)=>id===ids[i])?old:ids);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(host);for(const node of row.children)observer.observe(node);
  return()=>observer.disconnect();
 },[signature]);
 return <footer className={`${className} status-bar`} title={fields.map(f=>f.text).join(' · ')}>
  <div ref={content} className="status-content">
   <div className="status-measure" aria-hidden="true" inert><div ref={probe} className="status-probe">{fields.map(f=><span key={f.id} className="status-field">{f.text}</span>)}</div></div>
   {fields.filter(f=>visible.includes(f.id)).map(f=><span key={f.id} className="status-field" data-status={f.id}>{f.text}</span>)}
  </div>
  {children&&<div className="status-controls">{children}</div>}
 </footer>;
}
