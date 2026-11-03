const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Add the global preference and an empty run chain, without touching frozen works. */
export function migrateExampleSave(value:unknown):unknown {
 if(!record(value)||value.schemaVersion!==16||!record(value.persistent)||!record(value.run)||!record(value.run.workshop))throw new Error('Invalid schema16 save');
 const next=structuredClone(value);
 next.schemaVersion=17;
 (next.persistent as Record<string,unknown>).examplesEnabled=true;
 ((next.run as Record<string,unknown>).workshop as Record<string,unknown>).combo={count:0,lastCompletedAt:null};
 return next;
}
