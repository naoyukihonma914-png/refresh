import {expect} from 'vitest';
import {getWorkshopPart,type WorkshopPartId} from '../content/workshopCatalog';
import type {PartProduction} from './workshopState';

/** Assert the live representation conversion while retaining every unrelated field. */
export function expectFittingMigration(actual:Partial<Record<WorkshopPartId,PartProduction>>,original:Partial<Record<WorkshopPartId,PartProduction>>,at:number){
 expect(Object.keys(actual).sort()).toEqual(Object.keys(original).sort());
 for(const [rawId,previous] of Object.entries(original)){
  const id=rawId as WorkshopPartId,current=actual[id]!;
  if(id==='common-scrollbar'||previous!.fitting){expect(current).toEqual(previous);continue;}
  const pieces=[...previous!.elements];
  if(id==='common-frame'&&previous!.step===4)pieces.push('scrollbar');
  expect([...current.elements].sort()).toEqual([...pieces].sort());
  expect(current.fitting).toBeDefined();
  expect([...current.fitting!.spawned].sort()).toEqual([...pieces].sort());
  expect([...current.fitting!.paid].sort()).toEqual([...pieces].sort());
  expect(Object.keys(current.fitting!.sockets).sort()).toEqual([...pieces].sort());
  let shared=0;
  for(const piece of pieces){
   const socket=id==='common-frame'&&['minimize','maximize','close'].includes(piece)?`control-${shared++}`
    :id==='photo-switch'?`navigation-${shared++}`:id==='mail-unread'||id==='terminal-run'?'state':piece;
   expect(current.fitting!.sockets[piece]).toBe(socket);
  }
  const required=id==='common-frame'?[...getWorkshopPart(id).elements,'scrollbar']:getWorkshopPart(id).elements;
  const complete=previous!.step===4||required.every(piece=>pieces.includes(piece));
  expect(current.fitting!.completionPaid).toBe(complete);
  const {fitting:_fitting,elements:_elements,step:_step,tested:_tested,completedAt:_completedAt,...unchanged}=current;
  const {elements:_oldElements,step:_oldStep,tested:_oldTested,completedAt:_oldCompletedAt,...oldUnchanged}=previous!;
  expect(unchanged).toEqual(oldUnchanged);
  expect(current.step).toBe(complete?4:1);expect(current.tested).toBe(complete);
  expect(current.completedAt).toBe(previous!.completedAt??(complete?at:null));
 }
}
