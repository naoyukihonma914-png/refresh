import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { createI18n } from '../../content/i18n';
import { workshopHelpFor,workshopHelpRegion } from '../../content/workshopHelp';
import { UI_SETS,WORKSHOP_PARTS,partsForSet } from '../../content/workshopCatalog';
import { createFixture,completeWorkshopPartFixture } from '../../systems/fixtures';
import { actWorkshop } from '../../systems/workshop';
import type { GameRuntime,RuntimeSnapshot } from '../../systems/runtime';
import { WorkshopHelp } from './WorkshopHelp';
import { WorkshopSchematic } from './WorkshopSchematic';
import { WorkshopNavigator } from './WorkshopNavigator';
const now=1_800_000_000_000;

describe('TP2：同じ行き先を示すカタログと説明図',()=>{
 it('全セットと全パーツに有効な位置と固有の説明を持ち、図の外へはみ出さない',()=>{
  for(const definition of WORKSHOP_PARTS){
   const help=workshopHelpFor(definition.set,definition.id),rect=workshopHelpRegion(definition.id);
   expect(help.regions).toEqual([definition.id]);expect(help.descriptionKey).toBe(`tp.workshop.help.part.${definition.id}`);
   expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);
   expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThan(0);
   expect(rect.x+rect.width).toBeLessThanOrEqual(BALANCE.workshopHelp.width);expect(rect.y+rect.height).toBeLessThanOrEqual(BALANCE.workshopHelp.height);
  }
  for(const set of UI_SETS)expect(workshopHelpFor(set.id).regions).toEqual(set.parts);
  expect(()=>workshopHelpFor('files','mail-body')).toThrow();
 });
 it.each(['ja','en','en-XA'])('%s：全ヘルプの名前・説明が解決し、パーツ1つだけを正しい場所で朱色にする',language=>{
  const i18n=createI18n(language);
  for(const set of UI_SETS){
   const markup=renderToStaticMarkup(<WorkshopHelp target={{set:set.id}} stage={0} i18n={i18n} onClose={()=>{}}/>);
   expect(markup).toContain('role="dialog"');expect(markup).toContain('data-workshop-help-close="true"');
   expect((markup.match(/data-highlighted="true"/g)??[]).length).toBe(set.parts.length);
   expect(markup).toContain(i18n.t(`ws.set.${set.id}`));expect(markup).toContain('#c8553d');
  }
  for(const part of WORKSHOP_PARTS){
   const markup=renderToStaticMarkup(<WorkshopHelp target={{set:part.set,part:part.id}} stage={2} i18n={i18n} onClose={()=>{}}/>);
   expect(markup).toContain(`data-help-part="${part.id}"`);expect(markup).toContain(`data-help-region="${part.id}" data-highlighted="true"`);
   expect((markup.match(/data-highlighted="true"/g)??[]).length).toBe(1);
   expect(markup).not.toMatch(/<button[^>]*disabled/);
  }
 });
 it('必須ルートの印は1つだけで、権利を買ってもパーツ行を完成表示にしない',()=>{
  let s=createFixture('stage8a-entry-era0',now)!;
  const render=()=>renderToStaticMarkup(<WorkshopNavigator runtime={{platform:{clock:{wallNow:()=>now}}} as GameRuntime} snapshot={{state:s} as RuntimeSnapshot} i18n={createI18n('ja')}/>);
  let markup=render();expect((markup.match(/class="ws-next-indicator"/g)??[]).length).toBe(1);expect(markup).toContain('data-workshop-next="common"');
  s=actWorkshop(s,{type:'buySet',set:'common'},now);markup=render();
  expect(markup).toContain('data-workshop-next-hand="spawnPiece"');expect(markup).toContain('data-example-next="title"');expect((markup.match(/data-workshop-part="common-frame"/g)??[]).length).toBe(1);
  expect(markup).toContain('data-piece-status="notSpawned"');expect(markup).not.toContain('data-piece-status="fitted"');
  for(const part of partsForSet('common'))s=completeWorkshopPartFixture(s,part.id,now,false);
  s.run.workshop.activePart=null;markup=render();expect(markup).toContain('data-workshop-next="foundation"');expect((markup.match(/class="ws-next-indicator"/g)??[]).length).toBe(1);
 });
 it('完成予想図は渡した完成パーツだけを実線にし、試運転の対象を分ける',()=>{
  const html=renderToStaticMarkup(<WorkshopSchematic set="common" completedParts={['common-frame']} trialPart="common-frame" trialOpen i18n={createI18n('ja')} highlight={false}/>);
  expect(html).toContain('data-help-region="common-frame" data-highlighted="true" data-part-complete="true"');
  expect(html).toContain('data-help-region="common-button" data-part-complete="false"');expect(html).toContain('data-trial-open="true"');
 });
});
