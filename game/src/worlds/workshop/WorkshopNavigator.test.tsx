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
  let state=completeSet(createFixture('fitting-entry-era0',now)!,'common');state.run.workshop.activePart=null;
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
