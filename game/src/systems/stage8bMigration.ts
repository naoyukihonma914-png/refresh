import type { GameState } from './state';
import { migrateAppAssemblies } from './appAssembly';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Schema14 is the frozen workshop format from stage8a; no refunds run on this boundary. */
export function migrateStage8bSave(value:unknown):unknown {
  if(!record(value)||value.schemaVersion!==14||!record(value.run)||!record(value.persistent)
    ||!record(value.run.workshop)||!record(value.run.desktop)||!record(value.persistent.appearance))throw new Error('Invalid schema14 save');
  const next=structuredClone(value) as unknown as GameState;
  (next as unknown as {schemaVersion:number}).schemaVersion=15;
  if(next.run.workshop.editorStageAtEntry===undefined)next.run.workshop.editorStageAtEntry=next.persistent.appearance.editor;
  return migrateAppAssemblies(next);
}
