import { useId, type ReactNode } from 'react';

export interface PhotographSpecs { color:number; resolution:number }
// All photographic displays share this policy, including photos inside recorded scenes.
// Resolution is an input so later renderers can add it without changing each application.
export const photographPolicy=(specs:PhotographSpecs)=>({colorSteps:specs.color===1?6:null,resolution:specs.resolution});
export function PhotoSurface({specs,children,className=''}:{specs:PhotographSpecs;children:ReactNode;className?:string}) {
 const id=`photo-colors-${useId().replace(/:/g,'')}`,policy=photographPolicy(specs);
 return <div className={`photo-surface ${className}`} data-color-steps={policy.colorSteps??'full'} data-photo-resolution={policy.resolution}>
  {policy.colorSteps&&<svg width="0" height="0" aria-hidden="true"><defs><filter id={id} colorInterpolationFilters="sRGB"><feComponentTransfer>{(['R','G','B'] as const).map(channel=>{
   const values='0 .2 .4 .6 .8 1';return channel==='R'?<feFuncR key={channel} type="discrete" tableValues={values}/>:channel==='G'?<feFuncG key={channel} type="discrete" tableValues={values}/>:<feFuncB key={channel} type="discrete" tableValues={values}/>;
  })}</feComponentTransfer></filter></defs></svg>}
  <div className="photo-surface-content" style={{filter:policy.colorSteps?`url(#${id})`:undefined}}>{children}</div>
 </div>;
}
