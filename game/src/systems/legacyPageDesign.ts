/** Frozen four-part page contract for existing saves and scene formats 10/11. */
export const LEGACY_PAGE_PARTS=['heading','notice','generator','upgrades'] as const;
export type LegacyPagePart=typeof LEGACY_PAGE_PARTS[number];
const LEGACY_PAGE_FONTS=['sans','serif','pixel','mono'] as const;
const LEGACY_PAGE_MOTIONS=['push','lift','fade'] as const;
export interface LegacyPageRect{x:number;y:number;width:number;height:number}
export interface LegacyPageLayout{width:number;height:number;parts:Record<LegacyPagePart,LegacyPageRect>;button?:{width:number;height:number}}
export interface LegacyPageDesign{background:string|null;text:string|null;button:string|null;headingFont:typeof LEGACY_PAGE_FONTS[number];bodyFont:typeof LEGACY_PAGE_FONTS[number];motion:typeof LEGACY_PAGE_MOTIONS[number];heading:string;layout:LegacyPageLayout|null}
export const createLegacyPageDesign=():LegacyPageDesign=>({background:null,text:null,button:null,headingFont:'sans',bodyFont:'sans',motion:'push',heading:'',layout:null});
const overlaps=(a:LegacyPageRect,b:LegacyPageRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function contrast(a:string,b:string){const l=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i]!,0);const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function isLegacyPageDesign(v:unknown):v is LegacyPageDesign{
 if(!obj(v)||!['background','text','button'].every(k=>v[k]===null||typeof v[k]==='string'&&/^#[0-9a-f]{6}$/i.test(v[k] as string))||!LEGACY_PAGE_FONTS.includes(v.headingFont as typeof LEGACY_PAGE_FONTS[number])||!LEGACY_PAGE_FONTS.includes(v.bodyFont as typeof LEGACY_PAGE_FONTS[number])||!LEGACY_PAGE_MOTIONS.includes(v.motion as LegacyPageDesign['motion'])||typeof v.heading!=='string'||[...v.heading].length>80)return false;
 if(v.background&&v.text&&contrast(v.background as string,v.text as string)<4.5)return false;
 if(v.layout===null)return true;const l=v.layout;if(!obj(l)||!Number.isFinite(l.width)||!Number.isFinite(l.height)||Number(l.width)<320||Number(l.width)>1920||Number(l.height)<100||Number(l.height)>1080||!obj(l.parts)||Object.keys(l.parts).length!==4)return false;
 if(l.button!==undefined&&(!obj(l.button)||!['width','height'].every(k=>typeof (l.button as Record<string,unknown>)[k]==='number'&&Number.isFinite((l.button as Record<string,unknown>)[k])&&Number((l.button as Record<string,unknown>)[k])>0&&Number((l.button as Record<string,unknown>)[k])<=1920)))return false;
 return LEGACY_PAGE_PARTS.every(id=>{const r=(l.parts as Record<string,unknown>)[id];return obj(r)&&['x','y','width','height'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&(r[k] as number)>=0&&(r[k] as number)%8===0)&&Number(r.width)>0&&Number(r.height)>0&&Number(r.x)+Number(r.width)<=Number(l.width)&&Number(r.y)+Number(r.height)<=Number(l.height)&&!LEGACY_PAGE_PARTS.some(other=>other!==id&&obj((l.parts as Record<string,unknown>)[other])&&overlaps(r as unknown as LegacyPageRect,(l.parts as Record<string,unknown>)[other] as LegacyPageRect));});
}
