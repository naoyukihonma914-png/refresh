import type {ReactNode} from 'react';

/** Keep the value beside its range, including at the minimum adopted part size. */
export function PhotoAdjustment({label,value,min,max,step,onChange,children,title}:{label:string;value:number;min:number;max:number;step?:number;onChange?:(value:number)=>void;children:ReactNode;title?:string}){
 return <label className="photo-adjustment-control">{label}<input type="range" min={min} max={max} step={step} value={value} readOnly={!onChange} onChange={e=>onChange?.(Number(e.target.value))}/><output title={title}>{children}</output></label>;
}
