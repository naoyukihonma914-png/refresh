import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { FITTING_PARTS, fittingDefinition } from '../content/workshopFitting';
import type { WorkshopPartId } from '../content/workshopCatalog';
import { actWorkshop } from './workshop';
import { createFixture, completeWorkshopPartFixture } from './fixtures';
import { decodeSave, encodeSave } from './save';
import { isGameState } from './state';
import { ensurePuzzlePositions, puzzleBounds, puzzlePointInside, puzzleParts, puzzlePieceRect, puzzlePieceVisible, selectPuzzlePart } from './workshopPuzzle';
const now=1_800_000_000_000;
const start=()=>createFixture('fitting-frame-era0',now)!;
const act=(s:ReturnType<typeof start>,action:Parameters<typeof actWorkshop>[1])=>actWorkshop(s,action,now);

describe('persistent jigsaw workbench',()=>{
 it('repairs only out-of-range live coordinates at load, preserving valid positions and frozen documents',()=>{
  const state=completeWorkshopPartFixture(start(),'common-button',now,true),before=structuredClone(state.run.workshop.parts['common-frame']!.fitting!.positions);
  const raw=JSON.parse(encodeSave(state));
  raw.run.workshop.parts['common-frame'].fitting.positions.close={origin:{x:9000,y:9000},at:{x:9000,y:9000}};
  raw.persistent.setDocuments[0].parts['common-button'].fitting.positions.label.at={x:9000,y:9000};
  const frozen=structuredClone(raw.persistent.setDocuments),loaded=decodeSave(JSON.stringify(raw));
  const positions=loaded.run.workshop.parts['common-frame']!.fitting!.positions!;
  expect(positions.minimize).toEqual(before!.minimize);
  expect(puzzlePointInside(positions.close!.origin,puzzlePieceRect(loaded.run.workshop,'common-frame','close'))).toBe(true);
  expect(positions.close!.at).toEqual(positions.close!.origin);
  expect(loaded.persistent.setDocuments).toEqual(frozen);
  expect(decodeSave(encodeSave(loaded))).toEqual(loaded);
 });
 it('bounds a staged piece on every edge without changing the socket dimensions',()=>{
  let state=start();state=act(state,{type:'stagePiece',part:'common-frame',piece:'close',at:{x:99999,y:99999}});
  const r=puzzlePieceRect(state.run.workshop,'common-frame','close'),pos=state.run.workshop.parts['common-frame']!.fitting!.positions!.close!.at;
  expect(pos).toEqual({x:puzzleBounds().width-r.width,y:puzzleBounds().height-r.height});
  const rail=puzzlePieceRect(state.run.workshop,'common-frame','scrollbar'),edge={x:puzzleBounds().width-rail.width,y:200};
  state=act(state,{type:'stagePiece',part:'common-frame',piece:'scrollbar',at:edge});
  expect(decodeSave(encodeSave(state)).run.workshop.parts['common-frame']!.fitting!.positions!.scrollbar!.at).toEqual(edge);
 });
 it('selects and reveals every piece together, at socket size and without payment',()=>{
  const state=start(),before=state.resources;
  expect(puzzleParts(state.run.workshop)).toEqual(['common-frame']);
  for(const piece of fittingDefinition('common-frame').pieces)expect(puzzlePieceVisible(state.run.workshop,'common-frame',piece)).toBe(true);
  expect(state.run.workshop.parts['common-frame']!.fitting!.paid).toEqual([]);
  expect(act(state,{type:'togglePart',part:'common-heading'}).resources).toEqual(before);
 });
 it('toggles multiple parts in the same set and clears selection across sets',()=>{
  let state=act(start(),{type:'togglePart',part:'common-heading'});
  expect(puzzleParts(state.run.workshop)).toEqual(['common-frame','common-heading']);
  state=act(state,{type:'togglePart',part:'common-frame'});
  expect(puzzleParts(state.run.workshop)).toEqual(['common-heading']);
  expect(puzzlePieceVisible(state.run.workshop,'common-frame','title')).toBe(false);
  state=act(state,{type:'buySet',set:'clock'});
  expect(puzzleParts(state.run.workshop)).toEqual(['clock-time']);
  state=act(state,{type:'clearPartSelection',set:'common'});
  expect(puzzleParts(state.run.workshop)).toEqual([]);expect(state.run.workshop.activePart).toBeNull();
  expect(state.run.workshop.puzzleSet).toBe('common');
 });
 it('toggles loose pieces individually, retaining their origins and all other positions',()=>{
  const state=start(),before=structuredClone(state.run.workshop.parts['common-frame']!.fitting!.positions);
  const hidden=act(state,{type:'togglePiece',part:'common-frame',piece:'minimize'});
  expect(puzzlePieceVisible(hidden.run.workshop,'common-frame','minimize')).toBe(false);
  expect(puzzlePieceVisible(hidden.run.workshop,'common-frame','title')).toBe(true);
  const shown=act(hidden,{type:'togglePiece',part:'common-frame',piece:'minimize'});
  expect(puzzlePieceVisible(shown.run.workshop,'common-frame','minimize')).toBe(true);
  expect(shown.run.workshop.parts['common-frame']!.fitting!.positions).toEqual(before);
 });
 it('does not reflow origins after fitting, hiding, or adding another part',()=>{
  let state=start();const original=structuredClone(state.run.workshop.parts['common-frame']!.fitting!.positions);
  state=act(state,{type:'fitPiece',part:'common-frame',piece:'minimize',socket:'control-0'});
  state=act(state,{type:'togglePiece',part:'common-frame',piece:'maximize'});
  state=act(state,{type:'togglePart',part:'common-heading'});
  expect(state.run.workshop.parts['common-frame']!.fitting!.positions).toEqual(original);
 });
 it('keeps a staged piece where dropped, through hide/show, deselection/reselection and save/reload',()=>{
  let state=start();const resources=structuredClone(state.resources),at={x:220.5,y:390.25};
  state=act(state,{type:'stagePiece',part:'common-frame',piece:'close',at});
  state=act(state,{type:'togglePiece',part:'common-frame',piece:'close'});
  state=act(state,{type:'togglePart',part:'common-frame'});
  state=act(state,{type:'togglePart',part:'common-frame'});
  const restored=decodeSave(encodeSave(state));
  expect(restored.run.workshop.parts['common-frame']!.fitting!.positions!.close!.at).toEqual(at);
  expect(restored.resources).toEqual(resources);expect(restored.run.workshop.parts['common-frame']!.elements).toEqual([]);
 });
 it('returns an outside drop to the original spawn position, not the previous staged position',()=>{
  let state=start();const origin=state.run.workshop.parts['common-frame']!.fitting!.positions!.close!.origin;
  state=act(state,{type:'stagePiece',part:'common-frame',piece:'close',at:{x:120,y:250}});
  state=act(state,{type:'stagePiece',part:'common-frame',piece:'close'});
  expect(state.run.workshop.parts['common-frame']!.fitting!.positions!.close!.at).toEqual(origin);
 });
 it('unselects each fitted piece and the completed part, keeping other selected parts',()=>{
  let state=act(start(),{type:'togglePart',part:'common-heading'});
  state=act(state,{type:'togglePart',part:'common-button'});
  state=act(state,{type:'fitPiece',part:'common-heading',piece:'label',socket:'label'});
  expect(puzzlePieceVisible(state.run.workshop,'common-heading','label')).toBe(false);
  expect(puzzleParts(state.run.workshop)).toContain('common-heading');
  state=act(state,{type:'fitPiece',part:'common-heading',piece:'separator',socket:'separator'});
  expect(puzzleParts(state.run.workshop)).toEqual(['common-frame','common-button']);
  expect(state.run.workshop.parts['common-heading']!.step).toBe(4);
 });
 it('leaves fitted pieces in place when their part is deselected',()=>{
  let state=act(start(),{type:'fitPiece',part:'common-frame',piece:'minimize',socket:'control-1'});
  state=act(state,{type:'togglePart',part:'common-frame'});
  expect(state.run.workshop.parts['common-frame']!.fitting!.sockets.minimize).toBe('control-1');
  expect(state.run.workshop.parts['common-frame']!.elements).toContain('minimize');
 });
 it('stages a removed fitted piece without a second payment and can refit it',()=>{
  let state=act(start(),{type:'fitPiece',part:'common-frame',piece:'minimize',socket:'control-2'});
  const resources=structuredClone(state.resources);
  state=act(state,{type:'stagePiece',part:'common-frame',piece:'minimize',at:{x:100,y:300}});
  expect(state.run.workshop.parts['common-frame']!.elements).not.toContain('minimize');
  expect(puzzlePieceVisible(state.run.workshop,'common-frame','minimize')).toBe(true);
  expect(state.resources).toEqual(resources);
  state=act(state,{type:'fitPiece',part:'common-frame',piece:'minimize',socket:'control-0'});
  expect(state.resources).toEqual(resources);expect(isGameState(state)).toBe(true);
 });
 it('allocates every piece in all 52 parts without overlap or shrinking, reserving previous positions',()=>{
  const state=createFixture('stage8a-catalog-era0',now)!;
  // Stream materials belong to the desktop fixture, while all other materials share this catalog.
  for(const stream of [false,true]){
   let w=(stream?createFixture('stage8b-stream-draft-era0',now)!:state).run.workshop;
   for(const part of FITTING_PARTS.filter(part=>part.id.startsWith('stream-')===stream)){
    w=selectPuzzlePart(w,part.id);
    const p=w.parts[part.id]!,positions=p.fitting!.positions!;
    for(const piece of fittingDefinition(part.id).pieces.filter(piece=>p.fitting!.sockets[piece]===undefined)){
     const r=puzzlePieceRect(w,part.id,piece),pos=positions[piece]!;
     expect(puzzlePointInside(pos.origin,r)).toBe(true);expect(puzzlePointInside(pos.at,r)).toBe(true);
     expect(pos.origin.y).toBeGreaterThan(BALANCE.workshop.canvas.height);
     for(const [otherId,other] of Object.entries(w.parts)){
      if(!other||!FITTING_PARTS.some(item=>item.id===otherId&&item.set===part.set))continue;
      for(const [otherPiece,otherPos] of Object.entries(other.fitting?.positions??{})){
       if(otherId===part.id&&otherPiece===piece)continue;
       const b=puzzlePieceRect(w,otherId as WorkshopPartId,otherPiece);
       expect(pos.origin.x+r.width<=otherPos.origin.x||otherPos.origin.x+b.width<=pos.origin.x||pos.origin.y+r.height<=otherPos.origin.y||otherPos.origin.y+b.height<=pos.origin.y).toBe(true);
      }
     }
    }
   }
   expect(ensurePuzzlePositions(w,puzzleParts(w))).toBe(w);
  }
 });
 it('rejects invalid saved positions, hidden identities and cross-set selections',()=>{
  const state=start();
  for(const invalid of [-1,null,'10']){
   const data=JSON.parse(encodeSave(state));data.run.workshop.parts['common-frame'].fitting.positions.close.at.x=invalid;
   expect(isGameState(data)).toBe(false);
  }
  const bad=JSON.parse(encodeSave(state));bad.run.workshop.parts['common-frame'].fitting.hidden=['unknown'];expect(isGameState(bad)).toBe(false);
  const mixed=act(state,{type:'buySet',set:'clock'});mixed.run.workshop.selectedParts=['common-frame','clock-time'];expect(isGameState(mixed)).toBe(false);
 });
});
