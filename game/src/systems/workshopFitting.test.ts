import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { getWorkshopPart, type WorkshopPartId } from '../content/workshopCatalog';
import { fittingDefinition } from '../content/workshopFitting';
import { createInitialState, isGameState } from './state';
import { createComponentDesign, type PartProduction } from './workshopState';
import { defaultPieceSocket, fittingComplete, isPartFitting, pieceReward } from './workshopFitting';
import { actWorkshop } from './workshop';
import { decodeSave, encodeSave } from './save';

const now=1800000000000;
function oldProduction(id:WorkshopPartId,step:PartProduction['step'],elements?:string[]):PartProduction {
 const part=getWorkshopPart(id);
 return {step,rect:{...part.defaultRect},elements:elements??(step>=2?[...part.elements]:[]),design:createComponentDesign(),tested:step===4,completedAt:step===4?now-2:null,exportedAt:step===4?now-1:null};
}
function legacyState(id:WorkshopPartId,production:PartProduction){
 const state=createInitialState(now);delete state.run.workshop.groupPuzzle;state.run.seed.built=['border','save'];state.run.world='kumiki';state.run.workshop.entered=true;
 state.run.workshop.purchasedSets=[getWorkshopPart(id).set];state.run.workshop.activePart=id;state.run.workshop.parts[id]=production;
 state.resources.pixels=10000;state.run.totalPixelsGenerated=20000;
 return state;
}

describe('historical material representation in schema19',()=>{
 it.each([0,1,2,3,4] as const)('converts old step%s without crediting resources or repeating migration',step=>{
  const old=legacyState('common-button',oldProduction('common-button',step)),raw=JSON.stringify(old),next=decodeSave(raw),p=next.run.workshop.parts['common-button']!;
  expect(next.schemaVersion).toBe(19);expect(next.resources).toEqual(old.resources);expect(next.run.totalPixelsGenerated).toBe(old.run.totalPixelsGenerated);
  expect(p.fitting).toBeDefined();expect(p.step).toBe(step>=2?4:1);expect(p.elements).toEqual(old.run.workshop.parts['common-button']!.elements);
  expect(p.design).toEqual(old.run.workshop.parts['common-button']!.design);expect(decodeSave(encodeSave(next))).toEqual(next);expect(JSON.stringify(old)).toBe(raw);
 });
 it('maps partial old frame pieces to seats in their original order',()=>{
  const next=decodeSave(JSON.stringify(legacyState('common-frame',oldProduction('common-frame',1,['close','title','minimize']))));
  const p=next.run.workshop.parts['common-frame']!;
  expect(p.fitting!.sockets).toEqual({close:'control-0',title:'title',minimize:'control-1'});expect(p.step).toBe(1);expect(fittingComplete(p,'common-frame')).toBe(false);
 });
 it('keeps frozen set documents byte-for-byte while integrating the live completed frame',()=>{
  const production=oldProduction('common-frame',4),old=legacyState('common-frame',production);
  old.persistent.setDocuments=[{id:'v0.1:common',set:'common',version:'v0.1',at:now,parts:{'common-frame':structuredClone(production)}}];
  const next=decodeSave(JSON.stringify(old));expect(next.persistent.setDocuments).toEqual(old.persistent.setDocuments);
  expect(next.run.workshop.parts['common-frame']!.fitting!.sockets.scrollbar).toBe('scrollbar');expect(next.run.workshop.parts['common-frame']!.completedAt).toBe(now-2);
 });
 it('consumes previously paid placement credit before paying a first fitted piece',()=>{
  let next=decodeSave(JSON.stringify(legacyState('common-button',oldProduction('common-button',1))));const wallet=next.resources.pixels;
  expect(next.run.workshop.parts['common-button']!.fitting!.prepaid).toBe(BALANCE.workshop.categoryStepRewards.small[0]);
  next=actWorkshop(next,{type:'spawnPiece',part:'common-button',piece:'label'},now);
  next=actWorkshop(next,{type:'fitPiece',part:'common-button',piece:'label',socket:'label'},now);
  expect(next.resources.pixels-wallet).toBeCloseTo(pieceReward('common-button')-BALANCE.workshop.categoryStepRewards.small[0]+BALANCE.workshop.finishRewards.small);
  expect(isGameState(next)).toBe(true);
 });
 it('rejects invalid old stage claims before converting their pieces',()=>{
  const old=legacyState('common-progress',oldProduction('common-progress',2,['track']));
  expect(()=>decodeSave(JSON.stringify(old))).toThrow();
 });
 it('rejects seat collisions and fabricated completion history while allowing detached acquired pieces',()=>{
  const old=legacyState('common-frame',oldProduction('common-frame',4)),next=decodeSave(JSON.stringify(old)),p=next.run.workshop.parts['common-frame']!,definition=fittingDefinition('common-frame');
  expect(isPartFitting(p.fitting,'common-frame')).toBe(true);
  const collision=structuredClone(p.fitting!);collision.sockets.close=collision.sockets.minimize!;expect(isPartFitting(collision,'common-frame')).toBe(false);
  const missing=structuredClone(p.fitting!);missing.paid=[];expect(isPartFitting(missing,'common-frame')).toBe(false);
  const detached=structuredClone(p.fitting!);delete detached.sockets.close;expect(isPartFitting(detached,'common-frame')).toBe(true);expect(defaultPieceSocket(definition,detached,'close')).toBe('control-2');
 });
});
