import { describe,expect,it } from 'vitest';
import { fittingPartsForSet } from '../content/workshopFitting';
import { createFixture,completeWorkshopPartFixture } from './fixtures';
import { actWorkshop,canExportWorkshop } from './workshop';
import { decodeSave,encodeSave } from './save';
import { buySpec,startNextVersion } from './release';
import { workshopShelf } from './workshopShelf';
const now=1_800_000_000_000;
describe('export waiting and the run desktop shelf',()=>{
 it('only lights while at least one completed part has not been exported',()=>{
  let s=createFixture('fitting-frame-era0',now)!;
  expect(canExportWorkshop(s)).toBe(false);
  s=completeWorkshopPartFixture(s,'common-button',now,false);
  s=completeWorkshopPartFixture(s,'common-heading',now,false);
  expect(canExportWorkshop(s)).toBe(true);
  s=actWorkshop(s,{type:'export',part:'common-button'},now);
  expect(canExportWorkshop(s)).toBe(true);
  s=actWorkshop(s,{type:'export'},now);
  expect(canExportWorkshop(s)).toBe(false);
  expect(workshopShelf(s.run.workshop).map(entry=>entry.id)).toEqual(['part:common-button','part:common-heading']);
 });
 it.each(['foundation','files','mail'] as const)('%s merges only once every part is exported, preserving common parts and rewards',set=>{
  let s=createFixture('stage8a-catalog-era0',now)!;
  s=completeWorkshopPartFixture(s,'common-button',now,true);
  const parts=fittingPartsForSet(set);
  for(const part of parts)s=completeWorkshopPartFixture(s,part.id,now,false);
  for(const part of parts.slice(0,-1))s=actWorkshop(s,{type:'export',part:part.id},now);
  expect(workshopShelf(s.run.workshop).filter(entry=>entry.set===set)).toHaveLength(parts.length-1);
  expect(workshopShelf(s.run.workshop).some(entry=>entry.id===`app:${set}`)).toBe(false);
  const before=s.resources.tokens;
  s=actWorkshop(s,{type:'export',part:parts.at(-1)!.id},now);
  expect(s.resources.tokens).toBe(before+1);
  const shelf=workshopShelf(s.run.workshop);
  expect(shelf.filter(entry=>entry.set===set)).toEqual([{id:`app:${set}`,set,parts:parts.map(part=>part.id)}]);
  expect(shelf.some(entry=>entry.id==='part:common-button')).toBe(true);
  const loaded=decodeSave(encodeSave(s));expect(workshopShelf(loaded.run.workshop)).toEqual(shelf);
  const repeated=actWorkshop(loaded,{type:'export'},now);expect(repeated.resources).toEqual(loaded.resources);
  expect(workshopShelf(repeated.run.workshop)).toEqual(shelf);
 });
 it('starts with an empty shelf on the next real run',()=>{
  const previous=createFixture('release-complete',now)!;expect(workshopShelf(previous.run.workshop).length).toBeGreaterThan(0);
  const next=startNextVersion(buySpec(previous,'color'),now);
  expect(next.run.version).toBe('v1');expect(workshopShelf(next.run.workshop)).toEqual([]);
 });
});
