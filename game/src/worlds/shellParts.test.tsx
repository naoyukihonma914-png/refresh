import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { createInitialState } from '../systems/state';
import { createComponentDesign,type PartProduction } from '../systems/workshopState';
import { getWorkshopPart } from '../content/workshopCatalog';
import { colorContrast } from '../systems/workshopState';
import { shellPartProps } from './shellParts';
const now=1_800_000_000_000;
function state(){const s=createInitialState(now),part=getWorkshopPart('foundation-taskbar');s.run.workshop.parts[part.id]={step:4,rect:{...part.defaultRect},elements:[...part.elements],design:createComponentDesign(),completedAt:now,exportedAt:null,tested:true};return s;}
describe('制作した土台パーツと実デスクトップの表面',()=>{
 it('標準の材質を変えず、基盤の幅・高さ・既存CSS値を維持する',()=>{
  const s=state(),extra={height:28,background:'native-material'},props=shellPartProps(s,'foundation-taskbar',extra);
  expect(props['data-shell-part']).toBe('foundation-taskbar');expect(props.style).toEqual(extra);expect(props['data-shell-colors']).toBeUndefined();expect(props['data-shell-font']).toBeUndefined();
  expect(props.style).not.toHaveProperty('fontSize');expect(props.style).not.toHaveProperty('width');
  const html=renderToStaticMarkup(<main className="desktop"><footer className="desktop-taskbar" {...props}/><section className="desktop-window"/></main>);
  expect(html).not.toContain('--shell-part-font');expect(html).not.toContain('--shell-part-bg');
 });
 it('完成して選んだ属性だけを自分の表面へ渡し、制作矩形や全子孫の塗りは持ち出さない',()=>{
  const s=state(),p=s.run.workshop.parts['foundation-taskbar']!;p.design={...p.design,nativeColors:false,color:'#101018',textColor:'#f4efe4',fontSize:28,radius:8,shadow:true};
  const props=shellPartProps(s,'foundation-taskbar',{height:28});
  expect(props).toMatchObject({'data-shell-colors':true,'data-shell-font':true,'data-shell-radius':true,'data-shell-shadow':true});
  expect(props.style).toMatchObject({'--shell-part-bg':'#101018','--shell-part-text':'#f4efe4','--shell-part-font':'28px','--shell-part-radius':'8px',height:28});
  expect(props.style).not.toHaveProperty('color');expect(props.style).not.toHaveProperty('fontSize');expect(props.style).not.toHaveProperty('width');expect(props.style).not.toHaveProperty('left');
 });
 it('未完成の土台は適用せず、破損した組でも読みやすい文字色にする',()=>{
  const s=state(),p=s.run.workshop.parts['foundation-taskbar']!;p.step=3;expect(shellPartProps(s,'foundation-taskbar')).toEqual({});
  p.step=4;p.design.nativeColors=false;p.design.color='#ffffff';p.design.textColor='#ffffff';const props=shellPartProps(s,'foundation-taskbar');
  const text=(props.style as Record<string,string>)['--shell-part-text']!;expect(colorContrast('#ffffff',text)).toBeGreaterThanOrEqual(4.5);
 });
 it('デスクトップ根には文字色・書体・寸法を直接設定しない',()=>{
  const s=state(),p=s.run.workshop.parts['foundation-taskbar']!;s.run.workshop.parts['foundation-desktop']={...p,design:{...p.design,nativeColors:false,color:'#101018',textColor:'#f4efe4',fontSize:28}} as PartProduction;
  const props=shellPartProps(s,'foundation-desktop');expect(props.style).not.toHaveProperty('color');expect(props.style).not.toHaveProperty('font');expect(props.style).not.toHaveProperty('fontSize');expect(props.style).not.toHaveProperty('filter');
 });
 it.each([['#ffffff','#000000'],['#000000','#ffffff']])('明暗どちらの配色でも資源と通知の表面に対になる文字色を渡す (%s)',(background,foreground)=>{
  const s=state(),p=s.run.workshop.parts['foundation-taskbar']!;p.design={...p.design,nativeColors:false,color:background,textColor:foreground};
  s.run.workshop.parts['foundation-notification']={...p,design:{...p.design}};
  const resources=shellPartProps(s,'foundation-taskbar'),notice=shellPartProps(s,'foundation-notification');
  for(const props of [resources,notice]){expect(props['data-shell-colors']).toBe(true);expect(props.style).toMatchObject({'--shell-part-bg':background,'--shell-part-text':foreground});}
  const html=renderToStaticMarkup(<main className="desktop"><div className="desktop-resources" {...resources}><button className="taskbar-pixels"><small/></button></div><aside className="feedback-toast" {...notice}><header><b/><button className="nav-button"/></header></aside></main>);
  expect(html).toContain(`--shell-part-bg:${background};--shell-part-text:${foreground}`);expect(html.match(/data-shell-colors="true"/g)).toHaveLength(2);
 });
});
