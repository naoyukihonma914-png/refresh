import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {createI18n} from '../../content/i18n';
import {fittingPartsForSet} from '../../content/workshopFitting';
import type {UiSetId} from '../../content/workshopCatalog';
import {createFixture,completeWorkshopPartFixture} from '../../systems/fixtures';
import type {GameRuntime,RuntimeSnapshot} from '../../systems/runtime';
import type {GameState} from '../../systems/state';
import {actWorkshop} from '../../systems/workshop';
import {WorkshopNavigator} from './WorkshopNavigator';
import {initialWorkshopPanelSet,workshopCategoryForSet,WORKSHOP_CATEGORY_SETS} from './workshopPanel';
const now=1_800_000_000_000;
const runtime={actWorkshop:()=>{},requestPrototypeRelease:()=>{}} as unknown as GameRuntime;
const render=(state:GameState,language='ja')=>renderToStaticMarkup(<WorkshopNavigator runtime={runtime} snapshot={{state} as RuntimeSnapshot} i18n={createI18n(language)}/>);
const zone=(html:string,id:string)=>html.split(`data-workshop-zone="${id}"`)[1]!.split('</section>')[0]!;
const categories=(html:string)=>html.split('class="ws-panel-category-tabs"')[1]!.split('</div>')[0]!;
function completeSet(state:GameState,set:UiSetId){
 state=actWorkshop(state,{type:'buySet',set},now);
 for(const part of fittingPartsForSet(set))state=completeWorkshopPartFixture(state,part.id,now,false);
 return state;
}
function zonesPresent(html:string){
 expect((html.match(/data-workshop-zone="/g)??[])).toHaveLength(3);
 for(const id of ['sets','parts','pieces']){
  expect(html).toContain(`data-workshop-zone="${id}"`);expect(html).toContain(`data-workshop-zone-heading="${id}"`);
 }
 expect(html).toContain('data-workshop-panel-scroll="true"');expect(html).not.toContain('backToSets');expect(html).not.toContain('backToParts');expect(html).not.toContain('ws-fitting-part-chips');
}

describe('World 2 keeps its navigation zones in place',()=>{
 it.each([0,1])('era%s: groups multiple selections and distinguishes fitted, hidden and selected rows',era=>{
  let state=createFixture(`fitting-frame-era${era}`,now)!;
  state=actWorkshop(state,{type:'togglePart',part:'common-heading'},now);
  let html=render(state);
  expect(zone(html,'pieces').match(/data-piece-part=/g)).toHaveLength(2);
  expect(zone(html,'parts').match(/data-workshop-customize=/g)).toHaveLength(2);
  state=completeWorkshopPartFixture(state,'common-button',now,false);
  state=actWorkshop(state,{type:'selectPart',part:'common-frame'},now);
  state=actWorkshop(state,{type:'fitPiece',part:'common-frame',piece:'minimize',socket:'control-0'},now);
  state=actWorkshop(state,{type:'togglePiece',part:'common-frame',piece:'maximize'},now);
  html=render(state);
  for(const level of ['complete','default','selected']){
   expect(zone(html,'parts')).toContain(`data-brightness="${level}"`);
   expect(zone(html,'pieces')).toContain(`data-brightness="${level}"`);
  }
  state=actWorkshop(state,{type:'stagePiece',part:'common-button',piece:'label',at:{x:100,y:300}},now);
  expect(state.run.workshop.parts['common-button']!.step).toBe(4);
  expect(zone(render(state),'parts')).toMatch(/data-navigation-part="common-button"[^>]*data-brightness="selected"/);
 });
 it.each([0,1])('era%s: customization belongs only to the selected row, both during production and after completion',era=>{
  let state=createFixture(`fitting-frame-era${era}`,now)!;
  for(const finished of [false,true]){
   if(finished){state=completeWorkshopPartFixture(state,'common-frame',now,false);state=actWorkshop(state,{type:'selectPart',part:'common-frame'},now);}
   const html=render(state),parts=zone(html,'parts'),pieces=zone(html,'pieces');
   expect(parts.match(/data-workshop-customize=/g)).toHaveLength(1);
   expect(parts).toContain('data-workshop-customize="common-frame"');
   expect(pieces).not.toContain('data-workshop-customize');expect(html).not.toContain('openAdjustments');
   state=actWorkshop(state,{type:'selectPart',part:'common-button'},now);
   expect(zone(render(state),'parts')).toContain('data-workshop-customize="common-button"');
   state=actWorkshop(state,{type:'selectPart',part:'common-frame'},now);
  }
 });

 it('piece rows show the persisted visibility selection independently from completion',()=>{
  let state=createFixture('fitting-frame-era0',now)!;
  state=actWorkshop(state,{type:'togglePiece',part:'common-frame',piece:'close'},now);
  const html=render(state);
  expect(zone(html,'pieces')).toMatch(/data-workshop-piece="close"[^>]*aria-pressed="false"/);
  expect(zone(html,'pieces')).toMatch(/data-workshop-piece="minimize"[^>]*aria-pressed="true"/);
  expect(zone(html,'pieces')).toContain('data-brightness="default"');expect(zone(html,'pieces')).toContain('data-brightness="selected"');
 });
 it.each(['ja','en','en-XA'])('%s: entry shows categories, the common set and locked parts without acquiring anything',language=>{
  const state=createFixture('fitting-entry-era0',now)!,before=structuredClone(state),html=render(state,language);
  zonesPresent(html);expect(html).toContain('data-workshop-category="shared" aria-selected="true"');
  expect(zone(html,'sets')).toContain('data-workshop-set="common"');
  for(const part of fittingPartsForSet('common'))expect(zone(html,'parts')).toMatch(new RegExp(`data-workshop-part="${part.id}"[^>]*disabled`));
  expect(zone(html,'pieces')).not.toContain('data-workshop-piece=');expect(state).toEqual(before);expect(state.run.workshop.purchasedSets).toEqual([]);
  expect((html.match(/class="ws-next-indicator"/g)??[])).toHaveLength(1);
 });
 it('selecting another owned part keeps category and set markup unchanged while the lower pieces change',()=>{
  let state=createFixture('fitting-entry-era0',now)!;state=actWorkshop(state,{type:'buySet',set:'common'},now);
  const frame=render(state);zonesPresent(frame);expect(zone(frame,'pieces')).toContain('data-workshop-piece="scrollbar"');
  state=actWorkshop(state,{type:'selectPart',part:'common-button'},now);const button=render(state);zonesPresent(button);
  expect(categories(button)).toBe(categories(frame));expect(zone(button,'sets')).toBe(zone(frame,'sets'));
  expect(zone(button,'parts')).toContain('data-workshop-part="common-frame"');expect(zone(button,'parts')).toContain('data-workshop-part="common-button"');
  expect(zone(button,'pieces')).toContain('data-workshop-piece="label"');expect(zone(button,'pieces')).not.toContain('data-workshop-piece="scrollbar"');
 });
 it('the opening category follows the concrete next set and retains all three required sets, including locked materials',()=>{
  let state=completeSet(createFixture('fitting-entry-era0',now)!,'common');state=actWorkshop(state,{type:'clearPartSelection',set:'foundation'},now);
  expect(initialWorkshopPanelSet(state)).toBe('foundation');const html=render(state);zonesPresent(html);
  expect(html).toContain('data-workshop-category="required" aria-selected="true"');
  for(const id of ['foundation','files','mail'])expect(zone(html,'sets')).toContain(`data-workshop-select-set="${id}"`);
  for(const part of fittingPartsForSet('foundation'))expect(zone(html,'parts')).toMatch(new RegExp(`data-workshop-part="${part.id}"[^>]*disabled`));
 });
 it('the optional category keeps its own toggle and the plugin/stream purchase gates',()=>{
  let state=createFixture('fitting-entry-era0',now)!;state=actWorkshop(state,{type:'buySet',set:'clock'},now);
  const before=structuredClone(state),html=render(state);zonesPresent(html);
  expect(html).toContain('data-workshop-category="optional" aria-selected="true"');expect(zone(html,'sets')).toContain('data-workshop-optional-toggle="true"');
  for(const id of WORKSHOP_CATEGORY_SETS.optional)expect(zone(html,'sets')).toContain(`data-workshop-select-set="${id}"`);
  for(const id of ['extras','stream'])expect(zone(html,'sets')).toMatch(new RegExp(`data-workshop-set="${id}"[^>]*disabled`));
  expect(zone(html,'parts')).toContain('data-workshop-part="clock-time"');expect(state).toEqual(before);
 });
 it('turning examples off removes the sole cue, while every zone and all selection controls remain',()=>{
  const state=createFixture('fitting-frame-era1',now)!;state.persistent.examplesEnabled=false;const html=render(state);zonesPresent(html);
  expect(html).not.toContain('ws-next-indicator');expect(html).not.toContain('data-workshop-next=');expect(html).not.toContain('data-example-next=');
  expect(html).toContain('data-workshop-category="shared"');expect(zone(html,'pieces')).toContain('data-workshop-piece="scrollbar"');
 });
 it('classifies every set exactly once',()=>{
  const all=Object.values(WORKSHOP_CATEGORY_SETS).flat();expect(new Set(all).size).toBe(all.length);
  expect(workshopCategoryForSet('common')).toBe('shared');for(const id of ['foundation','files','mail'] as const)expect(workshopCategoryForSet(id)).toBe('required');
  for(const id of WORKSHOP_CATEGORY_SETS.optional)expect(workshopCategoryForSet(id)).toBe('optional');
 });
});
