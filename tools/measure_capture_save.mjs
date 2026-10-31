// node tools/measure_capture_save.mjs [--root /path/to/game] [--out /path/report.json] [--legacy-fixture /path/file.gz]
import { createServer } from '../game/node_modules/vite/dist/node/index.js';
import { performance } from 'node:perf_hooks';
import { writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const root=resolve(arg('--root','game'));
const out=resolve(arg('--out','game/artifacts/review5/save-measurement.json'));
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false},logLevel:'error'});
try {
 const {createFixture}=await server.ssrLoadModule('/src/systems/fixtures.ts');
 const {takeScreenshot,focusWindow,actDesktop}=await server.ssrLoadModule('/src/systems/desktop.ts');
 const {saveGame,loadGame,SAVE_KEYS,encodeSave}=await server.ssrLoadModule('/src/systems/save.ts');
 const now=1800000000000;
 const storage=(limit=Infinity)=>{const entries=new Map();return {entries,getItem:k=>entries.get(k)??null,removeItem:k=>entries.delete(k),setItem:(k,v)=>{let chars=k.length+v.length;for(const [a,b]of entries)if(a!==k)chars+=a.length+b.length;if(chars*2>limit)throw new Error('Quota exceeded');entries.set(k,v);}};};
 const fixture=(count)=>{
  let s=focusWindow(createFixture('desktop-files',now),'note');s.persistent.specs.storage=3;
  for(let i=0;i<count;i++){
   s=actDesktop(s,{type:'note',text:`保存の計測 ${i}`},now+i*30000);
   s=actDesktop(s,{type:'rect',app:'note',rect:{x:1100+i%10,y:140+i%10,width:630,height:650}},now+i*30000);
   s.run.desktop.cooldownMs=0;s.lastTickAt=now+i*30000;s.elapsedMs+=30000;
   s=takeScreenshot(s,now+i*30000,'ja');
  }
  return s;
 };
 const reports=[];const exportDir=arg('--exports',null);
 for(const count of [0,50,200,400]){
  const s=fixture(count),disk=storage();
  if(exportDir&&count>=200){mkdirSync(exportDir,{recursive:true});writeFileSync(resolve(exportDir,`shots-${count}.json`),encodeSave(s));}let start=performance.now();const first=saveGame(disk,s,now);const initial=performance.now()-start;
  if(first.kind!=='saved')throw new Error('Initial save failed');
  const samples=[];for(let i=0;i<7;i++){start=performance.now();saveGame(disk,s,now+i);samples.push(performance.now()-start);}
  start=performance.now();const loaded=loadGame(disk);const loadMs=performance.now()-start;
  if(!['loaded','recovered'].includes(loaded.kind)||loaded.state.persistent.screenshots.length!==count)throw new Error('Reload failed');
  const limited=storage(5*1024*1024),quotaSave=saveGame(limited,s,now);if(quotaSave.kind==='saved')saveGame(limited,s,now+1);
  const chars=[...disk.entries].reduce((n,[k,v])=>n+k.length+v.length,0),primary=disk.getItem(SAVE_KEYS.primary),backup=disk.getItem(SAVE_KEYS.backup);
  reports.push({count,schema:s.schemaVersion,primaryChars:primary.length,backupChars:backup?.length??0,assetChars:[...disk.entries].filter(([k])=>k.startsWith('refresh.capture.')).reduce((n,[k,v])=>n+k.length+v.length,0),totalUtf16Bytes:chars*2,keys:disk.entries.size,initialSaveMs:initial,warmMedianMs:samples.sort((a,b)=>a-b)[3],warmMaxMs:Math.max(...samples),loadMs,quota5MiB:quotaSave.kind});
  console.log(JSON.stringify(reports.at(-1)));
 }
 const legacy=arg('--legacy-fixture',null);if(legacy){mkdirSync(dirname(resolve(legacy)),{recursive:true});writeFileSync(resolve(legacy),gzipSync(encodeSave(fixture(2)),{mtime:0}));}
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({method:'Vite SSR / Node; 7 warm saves, median; UTF-16 storage cost includes keys, primary, backup and shared assets; quota 5 MiB',reports},null,2)+'\n');
}finally {await server.close();}
