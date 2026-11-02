import { usesNativeComponentColors, type ComponentDesign } from '../../systems/workshopState';
/** Unchanged styles keep the destination OS material; explicit palette choices use their validated pair. */
export function partVisual(id:string,design:ComponentDesign){
 const customColors=!usesNativeComponentColors(design);
 const whiteSurface=['files-list','mail-list','mail-body','bin-list','manager-processes','manager-performance','plugin-table'].includes(id);
 const darkSurface=id==='terminal-output'||id==='terminal-history';
 const background=id==='common-frame'?'#000080':id==='foundation-desktop'?'#008080':whiteSurface?'#ffffff':darkSurface?'#000000':'#c0c0c0';
 const foreground=id==='common-frame'||darkSurface?'#ffffff':'#000000';
 return {background:customColors?design.color:background,foreground:customColors?design.textColor:foreground,customColors};
}
