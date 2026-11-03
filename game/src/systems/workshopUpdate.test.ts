import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createFixture, completeWorkshopPartFixture } from './fixtures';
import { actWorkshop, advanceWorkshop, canBuyEditorSkill, canExportWorkshop, enterWorkshop } from './workshop';
import { grantTesseraUpdateFunds, tesseraUpdatePending } from './workshopUpdate';
import { decodeSave, encodeSave } from './save';
import { isGameState } from './state';
import { applySeedSkills, createSeedVersion } from './seed';
import { actDesktop } from './desktop';
import { advanceActiveTime } from './time';

const now=1_800_000_000_000,grant=BALANCE.workshop.updateGrantTokens;
const ready=()=>completeWorkshopPartFixture(createFixture('fitting-frame-era0',now)!,'common-button',now,false);
const exported=()=>actWorkshop(ready(),{type:'export',part:'common-button'},now);

describe('Tessera update funds',()=>{
 it('adds one grant to the ordinary first export, records it permanently, and introduces the update',()=>{
  const before=ready(),copy=structuredClone(before),state=actWorkshop(before,{type:'export',part:'common-button'},now);
  expect(before).toEqual(copy);
  expect(state.resources.tokens).toBe(BALANCE.workshop.exportTokens+grant);
  expect(state.persistent.tesseraUpdateGrantReceived).toBe(true);
  expect(state.run.workshop.guide).toMatchObject({current:'updateAvailable',collapsed:false});
  expect(canBuyEditorSkill(state,'update')).toBe(true);
  expect(decodeSave(encodeSave(state))).toEqual(state);
 });
 it('pays once for an export containing several parts',()=>{
  let state=ready();
  for(const id of ['common-frame','common-heading','common-progress'] as const)state=completeWorkshopPartFixture(state,id,now,false);
  state=actWorkshop(state,{type:'export'},now);
  expect(state.resources.tokens).toBe(4*BALANCE.workshop.exportTokens+grant);
 });
 it('does not repay on duplicate export, guide replay, reload, ticks, or another part export',()=>{
  let state=exported();
  state=actWorkshop(state,{type:'guide',id:'close'},now);
  state=decodeSave(encodeSave(state));
  const tokens=state.resources.tokens;
  expect(actWorkshop(state,{type:'export'},now)).toBe(state);
  state=actWorkshop(state,{type:'guide',id:'updateAvailable'},now);
  state=advanceWorkshop(state,100);
  state=completeWorkshopPartFixture(state,'common-heading',now,false);
  state=actWorkshop(state,{type:'export'},now);
  expect(state.resources.tokens).toBe(tokens+BALANCE.workshop.exportTokens);
  expect(state.run.workshop.guide.seen.filter(id=>id==='updateAvailable')).toHaveLength(1);
 });
 it('blocks every editor skill except update, even with a large balance, then immediately unlocks purchases',()=>{
  const state=exported();state.resources.tokens=1000;
  for(const skill of BALANCE.workshop.skills.filter(skill=>skill.id!=='update')){
   expect(canBuyEditorSkill(state,skill.id),skill.id).toBe(false);
   expect(actWorkshop(state,{type:'skill',id:skill.id},now),skill.id).toBe(state);
  }
  const updated=actWorkshop(state,{type:'skill',id:'update'},now);
  expect(tesseraUpdatePending(updated)).toBe(false);
  expect(canBuyEditorSkill(updated,'presets')).toBe(true);
  const bought=actWorkshop(updated,{type:'skill',id:'presets'},now);
  expect(bought.persistent.editorSkills).toContain('presets');expect(bought.resources.tokens).toBe(996);
 });
 it('leaves one token after buying the update from the first-export balance',()=>{
  const state=actWorkshop(exported(),{type:'skill',id:'update'},now);
  expect(state.resources.tokens).toBe(1);
  expect(state.persistent.appearance.editor).toBe(1);
  expect(tesseraUpdatePending(state)).toBe(false);
 });
 it('also protects page and desktop purchases, while free appearance changes remain usable',()=>{
  const state=exported();state.resources.tokens=1000;
  expect(applySeedSkills(state,['keyboard'],'none',false)).toBe(state);
  expect(applySeedSkills(state,[],'none',false).resources.tokens).toBe(1000);
  state.run.world='desktop';state.run.desktop.entered=true;state.run.version='v1';
  for(const skill of BALANCE.w3.skills)expect(actDesktop(state,{type:'skill',id:skill.id},now),skill.id).toBe(state);
  const updated=actWorkshop(state,{type:'skill',id:'update'},now);
  expect(applySeedSkills(updated,['keyboard'],'none',false).persistent.seedSkills).toContain('keyboard');
  expect(actDesktop(updated,{type:'skill',id:'snap'},now).persistent.desktopPrefs.skills).toContain('snap');
 });
 it('rescues a first-run schema18 save even after all exports and dismissal of its old guide',()=>{
  const old=exported();delete old.persistent.tesseraUpdateGrantReceived;old.resources.tokens=1;
  old.run.workshop.guide.current=null;old.run.workshop.guide.collapsed=true;
  const state=decodeSave(encodeSave(old)),before=structuredClone(state);
  expect(canExportWorkshop(state)).toBe(false);expect(tesseraUpdatePending(state)).toBe(true);
  const rescued=advanceWorkshop(state,100);
  expect(rescued.resources.tokens).toBe(4);expect(state).toEqual(before);
  expect(rescued.run.workshop.guide).toMatchObject({current:'updateAvailable',collapsed:false});
  expect(rescued.persistent.setDocuments).toEqual(state.persistent.setDocuments);
  expect(advanceWorkshop(decodeSave(encodeSave(rescued)),100).resources.tokens).toBe(4);
 });
 it('rescues on an export action even when no part can be exported again',()=>{
  const old=exported();delete old.persistent.tesseraUpdateGrantReceived;old.resources.tokens=0;
  const rescued=actWorkshop(old,{type:'export'},now);
  expect(rescued.resources.tokens).toBe(grant);expect(rescued.persistent.tesseraUpdateGrantReceived).toBe(true);
  expect(canBuyEditorSkill(rescued,'update')).toBe(true);
 });
 it('keeps the funding message ahead of idle hints when rescuing a stalled old save',()=>{
  const old=exported();delete old.persistent.tesseraUpdateGrantReceived;old.resources.tokens=0;
  old.elapsedMs=BALANCE.workshop.hintMs;old.run.workshop.lastActionAt=0;
  old.run.workshop.guide.current=null;
  const rescued=advanceWorkshop(old,100);
  expect(rescued.resources.tokens).toBe(grant);
  expect(rescued.run.workshop.guide.current).toBe('updateAvailable');
 });
 it('also rescues first-run saves already on the release screen without rewriting the released work',()=>{
  const old=createFixture('release-counting',now)!;
  delete old.persistent.tesseraUpdateGrantReceived;old.resources.tokens=1;
  old.persistent.editorSkills=[];old.persistent.appearance.editor=0;
  const state=decodeSave(encodeSave(old)),products=structuredClone(state.persistent.products);
  const rescued=advanceActiveTime(state,BALANCE.time.tickMs).state;
  expect(rescued.resources.tokens).toBe(4);expect(rescued.persistent.tesseraUpdateGrantReceived).toBe(true);
  expect(rescued.persistent.products).toEqual(products);
  expect(advanceActiveTime(rescued,BALANCE.time.tickMs).state.resources.tokens).toBe(4);
 });
 it.each(['v1','v2'] as const)('never gives first-run funds in %s, including old saves without the marker',version=>{
  const state=ready();state.run.version=version;delete state.persistent.tesseraUpdateGrantReceived;
  const result=actWorkshop(state,{type:'export'},now);
  expect(result.resources.tokens).toBe(BALANCE.workshop.exportTokens);
  expect(result.run.workshop.guide.seen).not.toContain('updateAvailable');
  expect(grantTesseraUpdateFunds(result)).toBe(result);
 });
 it('retains the received marker and pending restriction across the next-version reset',()=>{
  let state=createSeedVersion(exported(),'v1',now);
  expect(state.persistent.tesseraUpdateGrantReceived).toBe(true);expect(tesseraUpdatePending(state)).toBe(true);
  state=advanceWorkshop(enterWorkshop(state),BALANCE.workshop.enterMs);
  expect(state.resources.tokens).toBe(4);expect(decodeSave(encodeSave(state)).persistent.tesseraUpdateGrantReceived).toBe(true);
 });
 it('leaves pre-export and already-updated first-run saves unchanged',()=>{
  const fresh=ready();expect(grantTesseraUpdateFunds(fresh)).toBe(fresh);expect(tesseraUpdatePending(fresh)).toBe(false);
  const updated=exported();delete updated.persistent.tesseraUpdateGrantReceived;updated.persistent.editorSkills=['update'];
  expect(grantTesseraUpdateFunds(updated)).toBe(updated);expect(tesseraUpdatePending(updated)).toBe(false);
 });
 it('accepts absent legacy markers and rejects malformed values',()=>{
  const state=ready();delete state.persistent.tesseraUpdateGrantReceived;expect(isGameState(state)).toBe(true);
  for(const value of [null,1,'true']){
   const invalid=JSON.parse(encodeSave(state));invalid.persistent.tesseraUpdateGrantReceived=value;
   expect(isGameState(invalid)).toBe(false);expect(()=>decodeSave(JSON.stringify(invalid))).toThrow();
  }
 });
});
