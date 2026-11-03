// Diagnostic only: actual fitting reducers and Appendix A/C player assumptions.
// No price/rate changes are made by this script.
import {createServer} from '../game/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const server=await createServer({root:resolve(root,'game'),server:{middlewareMode:true,hmr:false,ws:false},logLevel:'error'});
try {
 const [{BALANCE},{createInitialState},{advanceHomeGeneration,cursorPixelsPerSecond,passivePixelsPerSecond},{buildSeed,canBuildSeed,visibleSeedItems,cursorPrice,pressSeed,freshMomentum},{actWorkshop,advanceWorkshop,canBuyWorkshopSet,canAssembleDesktop,completedParts,completedSets,enterWorkshop},{fittingPartsForSet:partsForSet,fittingDefinition},{defaultPieceSocket},{reconcileProgress},{releaseEstimate}]=await Promise.all([
  '/src/config/balance.ts','/src/systems/state.ts','/src/systems/economy.ts','/src/systems/seed.ts','/src/systems/workshop.ts','/src/content/workshopFitting.ts','/src/systems/workshopFitting.ts','/src/systems/longPlay.ts','/src/systems/release.ts',
 ].map(path=>server.ssrLoadModule(path)));
 const assumptions=BALANCE.workshop.measurement,targetAt=process.argv.indexOf('--target-minutes');
 const targetMinutes=targetAt<0?[...assumptions.targetMinutes]:process.argv.slice(targetAt+1,targetAt+3).map(Number);
 if(targetMinutes.length!==2||targetMinutes.some(n=>!Number.isFinite(n)||n<=0)||targetMinutes[0]>targetMinutes[1])throw new Error('--target-minutes needs a positive minimum and maximum');
 function measure(partSeconds){
  const start=1_800_000_000_000;
  let s=createInitialState(start),momentum=freshMomentum(),pressRemainder=0;
  const log=[],seenGuides=new Set();
  const seconds=()=>s.elapsedMs/BALANCE.time.millisecondsPerSecond;
  const stamp=()=>start+s.elapsedMs;
  const reconcile=()=>{s=reconcileProgress(s,stamp());};
  function tick(ms,hand=false){
   let remaining=ms;
   while(remaining>0){
    const dt=Math.min(BALANCE.time.tickMs,remaining);
    s=advanceHomeGeneration(s,dt);s={...s,elapsedMs:s.elapsedMs+dt,lastTickAt:stamp()+dt};s=advanceWorkshop(s,dt);
    if(hand){pressRemainder+=dt/BALANCE.time.millisecondsPerSecond*assumptions.clicksPerSecond;while(pressRemainder>=1){const result=pressSeed(s,momentum,s.elapsedMs);s=result.state;momentum=result.momentum;pressRemainder-=1;}}
    reconcile();remaining-=dt;
    if(seconds()>assumptions.maxSeconds)throw new Error('Diagnostic exceeded maximum duration');
   }
  }
  const decide=()=>tick(assumptions.decisionSeconds*BALANCE.time.millisecondsPerSecond);
  function readGuides(){
   const ids=[...s.run.seed.guide.seen.map(id=>`seed:${id}`),...s.run.workshop.guide.seen.map(id=>`workshop:${id}`)];
   for(const id of ids)if(!seenGuides.has(id)){seenGuides.add(id);tick(assumptions.guideSeconds*BALANCE.time.millisecondsPerSecond);}
  }
  function maybeCursor(){
   if(!canBuildSeed(s,'cursor'))return false;
   const rate=cursorPixelsPerSecond(s),price=cursorPrice(s);
   if(!(rate>0)||price/rate>assumptions.cursorPaybackSeconds)return false;
   s=buildSeed(s,'cursor',stamp());reconcile();decide();return true;
  }
  while(s.run.world==='seed'){
   const id=visibleSeedItems(s)[0];
   if(id&&canBuildSeed(s,id)){s=buildSeed(s,id,stamp());reconcile();log.push({seconds:seconds(),action:`seed:${id}`,pixels:s.resources.pixels});decide();readGuides();}
   else if(!maybeCursor())tick(BALANCE.time.tickMs,true);
  }
  if(!s.run.workshop.entered)s=enterWorkshop(s);
  tick(s.run.workshop.enterMs);readGuides();
  const seedSeconds=seconds();
  for(const set of ['common','foundation','files','mail']){
   while(!canBuyWorkshopSet(s,set)){if(!maybeCursor())tick(BALANCE.time.tickMs,true);}
   s=actWorkshop(s,{type:'buySet',set},stamp());reconcile();log.push({seconds:seconds(),action:`set:${set}`,pixels:s.resources.pixels});decide();readGuides();
   for(const d of partsForSet(set)){
    s=actWorkshop(s,{type:'selectPart',part:d.id},stamp());
    const recipe=fittingDefinition(d.id);
    for(const piece of recipe.pieces){
     tick(partSeconds/recipe.pieces.length*BALANCE.time.millisecondsPerSecond);
     s=actWorkshop(s,{type:'spawnPiece',part:d.id,piece},stamp());
     const fitting=s.run.workshop.parts[d.id].fitting,socket=defaultPieceSocket(recipe,fitting,piece);
     if(!socket)throw new Error(`No socket for ${d.id}/${piece}`);
     s=actWorkshop(s,{type:'fitPiece',part:d.id,piece,socket},stamp());reconcile();readGuides();
    }
    s=actWorkshop(s,{type:'export',part:d.id},stamp());reconcile();readGuides();decide();
    log.push({seconds:seconds(),action:`complete:${d.id}`,pixels:s.resources.pixels});
    const upgrade=BALANCE.workshop.skills.find(skill=>skill.id==='update');
    if(!s.persistent.editorSkills.includes('update')&&s.resources.tokens>=upgrade.cost){
     s=actWorkshop(s,{type:'skill',id:'update'},stamp());reconcile();decide();readGuides();
     log.push({seconds:seconds(),action:'upgrade:Tessera',pixels:s.resources.pixels});
    }
   }
  }
  // Wait to the real exit's pixel wall, without buying a display spec in advance.
  while(s.resources.pixels<BALANCE.w2.desktopCost){if(!maybeCursor())tick(BALANCE.time.tickMs,true);}
  s=actWorkshop(s,{type:'exit'},stamp());readGuides();
  return {partSeconds,seedSeconds,prototypeWallSeconds:seconds(),prototypeWallMinutes:seconds()/60,
   withinTarget:seconds()/60>=targetMinutes[0]&&seconds()/60<=targetMinutes[1],
   completedParts:completedParts(s).length,completedSets:completedSets(s),cursors:s.run.seed.autoCursors,
   totalPixelsGenerated:s.run.totalPixelsGenerated,pixels:s.resources.pixels,rate:passivePixelsPerSecond(s),
   tokens:s.resources.tokens,revenue:releaseEstimate(s),
   displayWallBlocked:!canAssembleDesktop(s),guidesRead:seenGuides.size,purchases:log};
 }
 const report={assumptions:{...assumptions,targetMinutes,cursorPolicy:'Buy while affordable if cursor cost / its current pixels per second is at most the configured payback; prioritize the next construction purchase.',craftPolicy:'Mainline 21 parts to the 256-color exit; equal time per piece within the unchanged per-part Appendix C assumptions. Buy the 3-token update as soon as affordable. No generation-button clicking while crafting or reading. Generation clicks while waiting for a purchase use the real momentum reducer.',guides:'Read each actual new seed/workshop guide once; do not assume optional secrets, events or offline time.'},scenarios:assumptions.partSeconds.map(measure),limits:['Diagnostic to the v0.1 display wall; no final balancing and no world3/v1-duration estimate.', 'Completion and export are actual domain actions. Craft durations are the provisional Appendix C human assumptions, not measured browser timings.', 'Optional UI sets, other editor plugins and purchase-order optimization are excluded. Changing these player choices changes the result.']};
 const out=resolve(root,arg('--out','docs/reviews/world2-fitting/economy.json'));mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({targetMinutes,scenarios:report.scenarios.map(({partSeconds,seedSeconds,prototypeWallMinutes,withinTarget,cursors,rate,revenue})=>({partSeconds,seedMinutes:seedSeconds/60,prototypeWallMinutes,withinTarget,cursors,rate,revenue})),report:out},null,2));
}finally{await server.close();}
