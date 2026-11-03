import { Children, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from '../content/i18n';
import { actAppBuild } from '../systems/appBuild';
import { createFixture } from '../systems/fixtures';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { fittedPieces, migrateFittingProduction } from '../systems/workshopFitting';
import { PhotoApp } from './DesktopApps';

function navigationHandler(node:ReactNode,piece:string):(()=>void)|null {
 for(const child of Children.toArray(node)){
  if(!isValidElement(child))continue;
  const props=child.props as {children?:ReactNode;onClick?:()=>void;'data-photo-navigation'?:string};
  if(props['data-photo-navigation']===piece)return props.onClick??null;
  const nested=navigationHandler(props.children,piece);if(nested)return nested;
 }
 return null;
}
describe('写真アプリもはめた順と記号の機能を引き継ぐ',()=>{
 it('右向き・左向きを逆の窪みにはめても操作の方向は各ピースに従う',()=>{
  const now=1_800_000_000_000;
  let state=createFixture('desktop-ready',now)!;
  const part=migrateFittingProduction(state.run.workshop.parts['photo-switch']!,'photo-switch',now);
  part.fitting!.sockets.next='navigation-0';part.fitting!.sockets.previous='navigation-1';
  part.elements=fittedPieces(part,'photo-switch');state.run.workshop.parts['photo-switch']=part;
  state=actAppBuild(state,{type:'app-edit',app:'photo'});state=actAppBuild(state,{type:'app-refresh',app:'photo'});state=actAppBuild(state,{type:'app-install',app:'photo'});
  // Starting from the second photo makes the two directions observably different even with saved screenshots.
  state.run.desktop.photo.source='night';
  const actDesktop=vi.fn(),runtime={actDesktop} as unknown as GameRuntime;
  const view=PhotoApp({snapshot:{state} as RuntimeSnapshot,runtime,i18n:createI18n('ja')});
  const html=renderToStaticMarkup(view);
  expect(html.indexOf('data-photo-navigation="next"')).toBeLessThan(html.indexOf('data-photo-navigation="previous"'));
  navigationHandler(view,'previous')!();expect(actDesktop).toHaveBeenLastCalledWith({type:'photo',edit:{source:'coast'}});
  navigationHandler(view,'next')!();
  const nextSource=state.persistent.screenshots[0]?`shot:${state.persistent.screenshots[0].id}`:'coast';
  expect(actDesktop).toHaveBeenLastCalledWith({type:'photo',edit:{source:nextSource}});
 });
});
