import { describe,expect,it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { workshopFitZoom } from './workshopZoom';
describe('workbench Fit zoom',()=>{
 it('uses the inner scroll viewport and leaves its padding outside the scaled canvas',()=>{
  const viewport={width:360,height:404,paddingLeft:40,paddingRight:40,paddingTop:64,paddingBottom:40};
  const zoom=workshopFitZoom(viewport);
  expect((BALANCE.workshop.canvas.width+8)*zoom+80).toBeLessThanOrEqual(viewport.width);
  expect((BALANCE.workshop.canvas.height+32)*zoom+104).toBeLessThanOrEqual(viewport.height);
  expect(zoom).toBeCloseTo(280/648);
 });
 it('also fits a taller target frame without using the outer desktop transform',()=>{
  const viewport={width:900,height:404,paddingLeft:40,paddingRight:40,paddingTop:64,paddingBottom:40};
  const zoom=workshopFitZoom(viewport,{width:648,height:480});
  expect(zoom).toBe(300/480);
  expect(workshopFitZoom({...viewport,width:900,height:900})).toBeGreaterThan(zoom);
 });
});
