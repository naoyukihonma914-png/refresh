import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe,expect,it } from 'vitest';
import { migrateExampleSave } from './exampleMigration';
import { migratePageLayoutSave } from './pageLayoutMigration';
import { decodeSave,encodeSave } from './save';
import { isGameState } from './state';
import { mergeLegacyScrollbarIntoFrame } from './workshopState';
import { BALANCE } from '../config/balance';
import { foldLegacyAssemblyMaterials, type AppAssembly } from './appAssemblySchema';

/** decodeSave also folds the retired scrollbar part into the frame; apply the same fold to expectations. */
const folded=<T,>(state:T):T=>{
 const s=structuredClone(state) as {run:{workshop:{parts:Record<string,unknown>;activePart?:unknown;helpTarget?:{part?:unknown}|null};desktop:{projects:Record<string,{draftAssembly?:AppAssembly;installedAssembly?:AppAssembly|null;assemblyUndo?:AppAssembly[];assemblyRedo?:AppAssembly[]}>}};persistent:{setDocuments:{parts:Record<string,unknown>}[];editorCustomization:{panelWidth:number};appearance?:{editor?:number}}};
 if(s.persistent.editorCustomization.panelWidth===BALANCE.workshop.customization.panelWidth)s.persistent.editorCustomization.panelWidth=BALANCE.workshop.customization.panelWidthByStage[s.persistent.appearance?.editor??0]??s.persistent.editorCustomization.panelWidth;
 mergeLegacyScrollbarIntoFrame(s.run.workshop.parts);
 if(s.run.workshop.activePart==='common-scrollbar')s.run.workshop.activePart=s.run.workshop.parts['common-frame']?'common-frame':null;
 if(s.run.workshop.helpTarget&&s.run.workshop.helpTarget.part==='common-scrollbar')s.run.workshop.helpTarget.part='common-frame';
 for(const doc of s.persistent.setDocuments)mergeLegacyScrollbarIntoFrame(doc.parts);
 const foldAssembly=(a:AppAssembly|undefined|null)=>a?{...a,common:foldLegacyAssemblyMaterials(a.common)}:a;
 for(const project of Object.values(s.run.desktop.projects)){
  if(project.draftAssembly)project.draftAssembly=foldAssembly(project.draftAssembly)!;
  if(project.installedAssembly)project.installedAssembly=foldAssembly(project.installedAssembly)!;
  if(project.assemblyUndo)project.assemblyUndo=project.assemblyUndo.map(a=>foldAssembly(a)!);
  if(project.assemblyRedo)project.assemblyRedo=project.assemblyRedo.map(a=>foldAssembly(a)!);
 }
 return s as T;
};

const fixtures=['seed-customized','workshop-step2','workshop-step3-free','desktop-records','next-run','shipping'] as const;
const oldSave=(name:typeof fixtures[number])=>JSON.parse(gunzipSync(readFileSync(new URL(`./testdata/examples-v16-7005674-${name}.json.gz`,import.meta.url))).toString());

describe('真正TP3形式16から17のお手本移行',()=>{
 it.each(fixtures)('%s: ONと空の連続制作以外は制作・財布・作品・写真の全内容を保持する',name=>{
  const source=oldSave(name),original=JSON.stringify(source);
  expect(source.schemaVersion).toBe(16);expect(source.persistent.examplesEnabled).toBeUndefined();expect(source.run.workshop.combo).toBeUndefined();
  const migrated=migrateExampleSave(source) as ReturnType<typeof decodeSave>;
  expect(migrated.schemaVersion).toBe(17);expect(migrated.persistent.examplesEnabled).toBe(true);expect(migrated.run.workshop.combo).toEqual({count:0,lastCompletedAt:null});
  const restored=structuredClone(migrated) as unknown as {schemaVersion:number;persistent:{examplesEnabled?:boolean};run:{workshop:{combo?:unknown}}};
  restored.schemaVersion=16;delete restored.persistent.examplesEnabled;delete restored.run.workshop.combo;
  expect(restored).toEqual(source);expect(JSON.stringify(source)).toBe(original);
  const loaded=decodeSave(original);expect(isGameState(loaded)).toBe(true);expect(loaded.schemaVersion).toBe(18);expect(loaded).toEqual(folded(migratePageLayoutSave(migrated)));expect(decodeSave(encodeSave(loaded))).toEqual(loaded);
 });
 it('境界違いと骨格の壊れた入力は変換しない',()=>{
  const source=oldSave('workshop-step2');
  for(const invalid of [null,{...source,schemaVersion:15},{...source,schemaVersion:17},{...source,persistent:null},{...source,run:{...source.run,workshop:[]}}])expect(()=>migrateExampleSave(invalid)).toThrow();
 });
});
