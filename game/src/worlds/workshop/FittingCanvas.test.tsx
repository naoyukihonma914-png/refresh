import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../../content/i18n';
import { FITTING_PARTS, fittingDefinition } from '../../content/workshopFitting';
import { fittingSocketRects } from '../../content/workshopFittingGeometry';
import { getWorkshopPart } from '../../content/workshopCatalog';
import { createFixture } from '../../systems/fixtures';
import { actWorkshop } from '../../systems/workshop';
import type { Platform } from '../../platform/types';
import { FittingCanvas } from './FittingCanvas';

const platform={every:()=>()=>{}} as unknown as Platform;
function render(examples=true){
 const state=actWorkshop(createFixture('fitting-frame-era0',1_800_000_000_000)!,{type:'spawnPiece',part:'common-frame',piece:'close'},1_800_000_000_000);
 state.persistent.examplesEnabled=examples;
 const workshop=state.run.workshop,part=getWorkshopPart('common-frame');
 return renderToStaticMarkup(<FittingCanvas platform={platform} state={state} workshop={workshop} part={part} production={workshop.parts[part.id]} zoom={.85} dispatch={()=>{}} i18n={createI18n('ja')} picking={false} onPick={()=>{}}/>);
}

describe('殻とピースの実寸キャンバス',()=>{
 it('全52パーツの専用座が殻の内側に収まる',()=>{
  for(const part of FITTING_PARTS){
   const rect=part.defaultRect,sockets=fittingSocketRects(part,rect);
   for(const socket of fittingDefinition(part.id).sockets){
    const r=sockets[socket.id];expect(r,`${part.id}:${socket.id}`).toBeDefined();
    expect(r!.width).toBeGreaterThan(0);expect(r!.height).toBeGreaterThan(0);
    expect(r!.x).toBeGreaterThanOrEqual(0);expect(r!.y).toBeGreaterThanOrEqual(0);
    expect(r!.x+r!.width).toBeLessThanOrEqual(rect.width+1);expect(r!.y+r!.height).toBeLessThanOrEqual(rect.height+1);
   }
  }
 });
 it('逆付けできる窓と写真の座は同じ寸法で、状態ピースは一つの座を共有する',()=>{
  const frame=getWorkshopPart('common-frame'),r=fittingSocketRects(frame,frame.defaultRect);
  expect([r['control-0'],r['control-1'],r['control-2']].map(rect=>[rect!.width,rect!.height])).toEqual([[26,26],[26,26],[26,26]]);
  const photo=getWorkshopPart('photo-switch'),p=fittingSocketRects(photo,photo.defaultRect);
  expect(p['navigation-0']!.width).toBe(p['navigation-1']!.width);
  for(const id of ['mail-unread','terminal-run'] as const)expect(Object.keys(fittingSocketRects(getWorkshopPart(id),getWorkshopPart(id).defaultRect))).toEqual(['state']);
 });
 it('スクロールバーの調整で窪みが右端を保ちながら太くなる',()=>{
  const frame=getWorkshopPart('common-frame'),thin=fittingSocketRects(frame,frame.defaultRect,8).scrollbar!,thick=fittingSocketRects(frame,frame.defaultRect,32).scrollbar!;
  expect(thick.width).toBe(32);expect(thick.x).toBe(thin.x-24);expect(thick.x+thick.width).toBe(thin.x+thin.width);
 });
 it('お手本OFFでも構造の窪みと出現済みピースは残り、旧配置・仕上げの操作は現れない',()=>{
  const on=render(),off=render(false);
  for(const html of [on,off]){
   expect(html.match(/data-fitting-socket=/g)).toHaveLength(5);
   expect(html).toContain('data-fitting-tray');expect(html).toContain('data-piece-status="spawned"');
   expect(html).not.toContain('data-workshop-drag="resize"');expect(html).not.toContain('data-finish-trial');
   expect(html).not.toContain('data-workshop-action="place"');
  }
  expect(off).not.toContain('is-next');
 });
});
