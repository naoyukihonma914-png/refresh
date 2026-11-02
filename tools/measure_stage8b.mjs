// Actual domain autoplay for revision3. No economy formulas are duplicated here.
import {createServer} from '../game/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const arg=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
const server=await createServer({root:resolve(root,'game'),server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},logLevel:'error'});
try {
 const [config,state,time,seed,workshop,catalog,desktop,jobs,offers,assembly,appBuild,release,longPlay,events,palette,i18nModule,world4,desktopTypes]=await Promise.all([
  'config/balance','systems/state','systems/time','systems/seed','systems/workshop','content/workshopCatalog','systems/desktop','systems/desktopJobs','systems/desktopOffers','systems/appAssembly','systems/appBuild','systems/release','systems/longPlay','systems/longPlayEvents','content/palette','content/i18n','systems/world4','systems/desktopState',
 ].map(path=>server.ssrLoadModule('/src/'+path+'.ts')));
 const economy=await server.ssrLoadModule('/src/systems/economy.ts');
 const {BALANCE}=config,m=BALANCE.measurementStage8b,msPerSecond=BALANCE.time.millisecondsPerSecond;
 if(!m)throw new Error('BALANCE.measurementStage8b is required');
 if(!Number.isFinite(m.startAt))throw new Error('BALANCE.measurementStage8b.startAt must fix the wall clock for repeatable timer requests');
 const requested=arg('--part-seconds',null),scenarios=requested===null?[...m.partSeconds]:[Number(requested)];
 if(scenarios.some(value=>!m.partSeconds.includes(value)))throw new Error('--part-seconds must be one of BALANCE.measurementStage8b.partSeconds');
 const language='ja',i18n=i18nModule.createI18n(language);
 class PhaseLimit extends Error {}
 function measure(partSeconds){
  const start=m.startAt;let s=state.createInitialState(start),wallMs=0,phaseStart=0,phase='prototype',momentum=seed.freshMomentum(),pressFraction=0,timeFraction=0,servicing=false;
  const guides=new Set(),log=[],stats={manualClicks:0,manualClickPixels:0,manualStages:0,assistedStages:0,manualStagePixels:0,assistedStagePixels:0,passivePixels:0,capturePixels:0,activeDesktopMs:0,idleDesktopMs:0,feedbackOperations:0,investments:0,restarts:0,restartPixels:0};
  const stamp=()=>start+wallMs,seconds=()=>wallMs/msPerSecond;
  const point=(action,extra={})=>log.push({seconds:seconds(),phase,action,pixels:s.resources.pixels,total:s.run.totalPixelsGenerated,rate:economy.passivePixelsPerSecond(s),...extra});
  function publish(next,before=s){
   s=longPlay.reconcileProgress(events.observeProgress(before,next),stamp());
   const previous=new Set(before.run.desktop.shotHistory);
   stats.capturePixels+=s.run.desktop.shotHistory.filter(entry=>!previous.has(entry)).reduce((sum,entry)=>sum+entry.pixels,0);
  }
  function tick(milliseconds,manual=false,desktopMode='idle'){
   let remaining=milliseconds;
   while(remaining>0){
    const step=Math.min(remaining,BALANCE.time.tickMs),before=s,activePart=s.run.workshop.activePart,oldStage=activePart?s.run.workshop.parts[activePart]?.step:undefined;
    wallMs+=step;remaining-=step;
    if((wallMs-phaseStart)/msPerSecond>m.maxPhaseSeconds)throw new PhaseLimit(`${phase} exceeded ${m.maxPhaseSeconds} seconds`);
    if(before.run.world==='desktop'){if(desktopMode==='active')stats.activeDesktopMs+=step;else stats.idleDesktopMs+=step;}
    const result=time.advanceActiveTime(s,step+timeFraction,language,true);timeFraction=result.remainderMs;
    const previousCapture=stats.capturePixels;publish({...result.state,lastTickAt:stamp()},before);stats.passivePixels+=result.pixels;
    stats.assistedStagePixels+=Math.max(0,s.resources.pixels-before.resources.pixels-result.pixels-(stats.capturePixels-previousCapture));
    if(activePart&&oldStage!==undefined){const next=s.run.workshop.parts[activePart]?.step??oldStage;if(next>oldStage)stats.assistedStages+=next-oldStage;}
    if(manual&&s.run.world!=='release'){
     pressFraction+=m.clicksPerSecond*step/msPerSecond;
     while(pressFraction>=1){const pressed=seed.pressSeed(s,momentum,wallMs);momentum=pressed.momentum;publish(pressed.state);stats.manualClicks++;stats.manualClickPixels+=pressed.pixels;pressFraction--;}
    }
   }
  }
  function work(secondsToWork,manual=false){
   const inDesktop=s.run.world==='desktop';
   if(inDesktop)publish(desktop.actDesktop(s,{type:'activity'},stamp(),language));
   tick(secondsToWork*msPerSecond,manual,'active');
   if(inDesktop)tick(secondsToWork*(1-m.desktopActiveFraction)/m.desktopActiveFraction*msPerSecond,false,'idle');
  }
  const decision=()=>work(m.decisionSeconds);
  function readGuides(){
   for(const [kind,seen] of [['seed',s.run.seed.guide.seen],['workshop',s.run.workshop.guide.seen]])for(const id of seen){
    const key=`${s.run.version}:${kind}:${id}`;if(guides.has(key))continue;guides.add(key);work(m.guideSeconds);
    if(kind==='seed')publish(seed.readGuide(s,'close'));else workshopAction({type:'guide',id:'close'});
   }
  }
  function workshopAction(action){
   const before=s,next=workshop.actWorkshop(s,action,stamp());
   publish(desktop.observeTesseraAction(before,next,action.type,stamp()),before);
   if(['place','addElement','confirmAdjustment','test'].includes(action.type))stats.manualStagePixels+=Math.max(0,s.resources.pixels-before.resources.pixels);
  }
  function desktopAction(action){publish(desktop.actDesktop(s,action,stamp(),language));}
  function eligibleJobs(){return desktopTypes.JOB_IDS.filter(app=>app==='tessera'||s.run.desktop.apps.includes(app));}
  function assignJobs(){
   if(s.run.world!=='desktop'||!s.run.desktop.upgrades.includes('jobs'))return;
   for(const app of eligibleJobs()){
    if(s.run.desktop.jobs[app].assigned)continue;
    const next=desktop.actDesktop(s,{type:'job-assign',app},stamp(),language);
    if(next.run.desktop.jobs[app].assigned){publish(next);point('job:assign',{app});decision();}
   }
  }
  function investment(reserve=0){
   const currentRate=economy.passivePixelsPerSecond(s),candidates=[];
   if(seed.canBuildSeed(s,'cursor')){
    const next=seed.buildSeed(s,'cursor',stamp()),cost=s.resources.pixels-next.resources.pixels,gain=economy.passivePixelsPerSecond(next)-currentRate;
    if(cost>0&&gain>0&&cost/gain<=m.cursorPaybackSeconds&&s.resources.pixels-cost>=reserve)candidates.push({next,cost,gain,payback:cost/gain,action:'cursor:buy'});
   }
   if(s.run.world==='desktop'&&s.run.desktop.upgrades.includes('jobs'))for(const app of eligibleJobs()){
    if(!s.run.desktop.jobs[app].assigned)continue;
    for(const type of ['job-buy','job-update']){
     const next=desktop.actDesktop(s,{type,app},stamp(),language),cost=s.resources.pixels-next.resources.pixels,gain=economy.passivePixelsPerSecond(next)-currentRate;
     if(cost>0&&gain>0&&cost/gain<=m.jobPaybackSeconds&&s.resources.pixels-cost>=reserve)candidates.push({next,cost,gain,payback:cost/gain,action:type,app});
    }
   }
   candidates.sort((a,b)=>a.payback-b.payback);
   const best=candidates[0];if(!best)return false;
   publish(best.next);stats.investments++;point(best.action,{app:best.app,cost:best.cost,rateGain:best.gain,paybackSeconds:best.payback});decision();return true;
  }
  function waitForCost(cost){
   while(s.resources.pixels<cost){
    if(!investment())work(BALANCE.time.tickMs/msPerSecond,true);
    if(s.run.world==='desktop')repairStall();
   }
  }
  function repairStall(){
   if(s.run.world!=='desktop'||!s.run.desktop.stalled)return;
   const app=s.run.desktop.stalled,before=s.run.totalPixelsGenerated;desktopAction({type:'restart',app});stats.restarts++;stats.restartPixels+=s.run.totalPixelsGenerated-before;point('restart',{app});decision();
  }
  function checkpoint(){
   readGuides();if(s.run.world!=='desktop')return;
   repairStall();assignJobs();
   const nextMoney=offers.desktopOffers(s).find(offer=>offer.cost>0),reserve=nextMoney?Math.min(nextMoney.cost,s.resources.pixels):0;
   while(!(release.canReleaseV1(s)&&release.canFundNextVersion(s))&&investment(reserve))repairStall();
   if(!servicing){servicing=true;serviceFeedback();servicing=false;}
  }
  function craftPart(id){
   if(s.run.workshop.parts[id]?.step===4)return;
   workshopAction({type:'selectPart',part:id});decision();readGuides();
   const definition=catalog.getWorkshopPart(id);
   while(s.run.workshop.parts[id]?.step<3){
    const step=s.run.workshop.parts[id].step;work(partSeconds/4);
    const current=s.run.workshop.parts[id].step;
    if(current===step){
     if(step===0)workshopAction({type:'place',part:id,rect:{...definition.defaultRect}});
     else if(step===1)for(const element of definition.elements)workshopAction({type:'addElement',part:id,element});
     else workshopAction({type:'confirmAdjustment',part:id});
     stats.manualStages++;
    }
    if(s.run.workshop.parts[id].step<=step)throw new Error(`Production did not advance ${id}:${step}`);
    readGuides();
   }
   work(partSeconds/4);
   workshopAction({type:'test',part:id,interaction:definition.testInteraction});stats.manualStages++;
   if(s.run.workshop.parts[id].step!==4)throw new Error(`Human inspection did not finish ${id}`);
   point('part:complete',{id});checkpoint();
  }
  function craftSet(set){
   if(!s.run.workshop.purchasedSets.includes(set)){waitForCost(BALANCE.workshop.setCosts[set]);workshopAction({type:'buySet',set});point('set:buy',{set});decision();readGuides();}
   for(const part of catalog.partsForSet(set))craftPart(part.id);
   if(!workshop.setComplete(s,set))throw new Error(`Set did not complete ${set}`);
   if(set!=='terminal'){workshopAction({type:'export'});decision();readGuides();}
   if(!state.isGameState(s))throw new Error(`Invalid state after completing ${set}`);
   point('set:complete',{set,document:s.persistent.setDocuments.some(doc=>doc.set===set&&doc.version===s.run.version)});
  }
  function seedAndMain(){
   while(s.run.world==='seed'){
    const item=seed.visibleSeedItems(s)[0];if(!item)throw new Error('Seed has no next construction');
    if(seed.canBuildSeed(s,item)){publish(seed.buildSeed(s,item,stamp()));point('seed:build',{item});decision();readGuides();}
    else if(!investment())tick(BALANCE.time.tickMs,true);
   }
   if(!s.run.workshop.entered)throw new Error('Editor did not start');
   tick(s.run.workshop.enterMs);readGuides();point('editor:entered');
   for(const set of ['common','foundation','files','mail'])craftSet(set);
   waitForCost(BALANCE.w2.desktopCost);workshopAction({type:'exit'});readGuides();
   point('main:exit',{completeSets:workshop.completedSets(s),prototypeConditions:workshop.prototypeConditions(s)});
  }
  function openForShot(kind,target){
   if(kind==='capture'&&target==='photo'){desktopAction({type:'open',app:'photo'});return;}
   if(kind==='capture'&&target!=='windows'){
    const app='files';desktopAction({type:'open',app});if(!s.run.desktop.windows[app].maximized)desktopAction({type:'maximize',app});return;
   }
   for(const app of ['tessera','files'].slice(0,m.feedbackOpenWindows)){
    desktopAction({type:'open',app});if(s.run.desktop.windows[app].maximized)desktopAction({type:'maximize',app});
   }
  }
  function serviceFeedback(){
   for(const request of [...s.run.desktop.feedback.filter(f=>f.completedAt===null)]){
    if(request.kind==='part'){const production=s.run.workshop.parts[request.target];if(production&&production.step!==4)craftPart(request.target);continue;}
    if(request.kind==='color'){
     const current=s.run.workshop.parts['common-button'];if(!current)continue;
     for(const color of palette.paletteFor(s.persistent.specs.color)){
      if(color===current.design.color)continue;const before=s;
      workshopAction({type:'adjust',part:'common-button',patch:{color}});if(s!==before)break;
     }
    }else if(request.kind==='sort')desktopAction({type:'sort',by:'date'});
    else if(request.kind==='search')desktopAction({type:'search',text:request.target==='note'?i18n.t('desktop.app.note'):request.target});
    else if(request.kind==='bright'){desktopAction({type:'photo',edit:{brightness:BALANCE.w3.daylight.morningBrightness}});desktopAction({type:'wallpaper'});}
    else if(request.kind==='dark')desktopAction({type:'theme',mode:'dark'});
    else if(request.kind==='timer'){desktopAction({type:'reserve',at:Number(request.target)});}
    else if(request.kind==='trash'){
     for(const shot of desktop.activeScreenshots(s).slice(0,m.feedbackTrashBatch))desktopAction({type:'trash',id:`shot:${shot.id}`});
    }else if(request.kind==='screenshot'||request.kind==='capture'){
     openForShot(request.kind,request.target);
     if(s.run.desktop.cooldownMs>0)continue;
     publish(desktop.takeScreenshot(s,stamp(),language));
    }else continue;
    stats.feedbackOperations++;decision();
    if(s.run.desktop.feedback.find(f=>f.id===request.id)?.completedAt!==null)point('feedback:complete',{id:request.id,kind:request.kind});
   }
  }
  function ship(){
   while(!release.canFundNextVersion(s)){
    checkpoint();work(BALANCE.time.tickMs/msPerSecond,true);
   }
   work(m.guideSeconds);publish(release.beginProductRelease(s,stamp(),{language}));
   if(s.run.world!=='release')throw new Error(`Release rejected ${s.run.version}`);
   point('product:release',{revenue:release.shippingProduct(s)?.revenue,conditions:s.run.version==='v0.1'?workshop.prototypeConditions(s):release.v1Conditions(s)});
   tick(Math.max(0,BALANCE.release.storeAnimationMs-(s.run.shipping.storeElapsedMs??0)));
   decision();publish(release.showShipping(s));work(m.guideSeconds);
   tick(Math.max(0,BALANCE.release.animationMs-s.run.shipping.elapsedMs));
   if(!release.shippingComplete(s))throw new Error('Shipping did not finish');
  }
  const report={partSeconds,completed:false,status:'running',prototype:null,v1:null,secondVersion:null,stats,log};
  try {
   seedAndMain();const prototypeWallSeconds=seconds();ship();
   const prototypeProduct=release.shippingProduct(s);publish(release.buySpec(s,'color'));decision();
   if(s.persistent.specs.color<BALANCE.release.prototypeColorLevel)throw new Error('Prototype cannot buy 256 colors');
   publish(release.startNextVersion(s,stamp()));
   if(s.run.version!=='v1')throw new Error('Prototype did not start v1');
   report.prototype={wallSeconds:prototypeWallSeconds,completeSeconds:seconds(),revenue:prototypeProduct.revenue,generatedPixels:prototypeProduct.generatedPixels,colorLevel:s.persistent.specs.color,stats:{...stats}};
   phase='v1';phaseStart=wallMs;const v1Start=seconds(),v1StartStats={...stats};point('version:start',{version:s.run.version,parts:workshop.completedParts(s).length,sets:workshop.completedSets(s),purchasedSets:[...s.run.workshop.purchasedSets]});
   tick(s.run.restartMs);readGuides();seedAndMain();
   if(!workshop.canAssembleDesktop(s))throw new Error('v1 required sets did not unlock desktop');
   publish(desktop.enterDesktop(s));decision();checkpoint();point('desktop:entered');
   while(offers.nextDesktopOffer(s)){
    const offer=offers.nextDesktopOffer(s);waitForCost(offer.cost);
    desktopAction({type:'buy',app:offer.id});decision();readGuides();
    if(offer.kind==='jobs'){checkpoint();continue;}
    if(!s.run.workshop.purchasedSets.includes(offer.id))throw new Error(`Offer failed to grant materials ${offer.id}`);
    craftSet(offer.id);
    publish(appBuild.actAppBuild(appBuild.ownAppBlueprint(s,offer.id),{type:'app-edit',app:offer.id}));
    publish(appBuild.actAppBuild(s,{type:'app-recommend',app:offer.id}));publish(appBuild.actAppBuild(s,{type:'app-install',app:offer.id}));
    if(!assembly.appIsOperational(s,offer.id))throw new Error(`Install did not produce a working app ${offer.id}`);
    if(!state.isGameState(s))throw new Error(`Invalid state after installing ${offer.id}`);
    desktopAction({type:'open',app:offer.id});decision();point('app:install',{app:offer.id,sources:assembly.adoptedPartIds(s,offer.id)});checkpoint();
   }
   desktopAction({type:'photo',edit:{brightness:BALANCE.w3.daylight.morningBrightness}});desktopAction({type:'wallpaper'});decision();
   publish(longPlay.actCommon(s,{type:'terminal-command',command:'export'},stamp()));
   desktopAction({type:'terminal',running:true,interval:BALANCE.w3.terminalIntervals[0]});decision();
   while(!release.canReleaseV1(s)){
    checkpoint();
    if(s.run.desktop.terminal.executions>0&&s.run.desktop.terminal.running){desktopAction({type:'terminal',running:false});decision();}
    // There may be no human task until the next real request/automation deadline.
    work(BALANCE.time.tickMs/msPerSecond,true);
   }
   const beforeShipping=seconds(),content=release.madeContentCounts(s),readyConditions=release.v1Conditions(s),rateBeforeRelease=economy.passivePixelsPerSecond(s);ship();
   const product=release.shippingProduct(s),canBuy60Hz=release.canBuySpec(s,'refresh');
   report.v1={readySeconds:beforeShipping-v1Start,completeSeconds:seconds()-v1Start,revenue:product.revenue,generatedPixels:product.generatedPixels,content,conditions:readyConditions,canBuy60Hz,rateBeforeRelease,stats:Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,value-v1StartStats[key]]))};
   publish(release.buySpec(s,'refresh'));publish(release.startNextVersion(s,stamp()));
   report.secondVersion={version:s.run.version,refreshLevel:s.persistent.specs.refresh,parts:workshop.completedParts(s).length,sets:workshop.completedSets(s),purchasedSets:[...s.run.workshop.purchasedSets],oldDocuments:s.persistent.setDocuments.length,canSkipRequiredGate:workshop.canAssembleDesktop(s),world4:world4.world4Preparation(s)};
   report.completed=s.run.version==='v2'&&s.persistent.specs.refresh>=BALANCE.release.v1RefreshLevel&&!report.secondVersion.canSkipRequiredGate;
   report.status=report.completed?'complete':'requirements-not-met';
  }catch(error){report.status=error instanceof PhaseLimit?'phase-limit':'error';report.error=String(error);report.at={phase,seconds:seconds(),world:s.run.world,version:s.run.version,offer:s.run.world==='desktop'?offers.nextDesktopOffer(s):null,conditions:s.run.world==='desktop'?release.v1Conditions(s):workshop.prototypeConditions(s),pendingFeedback:s.run.desktop.feedback.filter(f=>f.completedAt===null).map(f=>({id:f.id,kind:f.kind,target:f.target})),parts:workshop.completedParts(s).length,sets:workshop.completedSets(s),pixels:s.resources.pixels,rate:economy.passivePixelsPerSecond(s)};}
  report.totalSeconds=seconds();report.guidesRead=guides.size;
  return report;
 }
 const report={assumptions:{...m,manualModel:'Real pressSeed momentum while waiting; no manual clicks during crafting/reading/assembly.',desktopTime:'Every active desktop action/part/read segment is paired with idle time to keep the configured active fraction. Timers/jobs/editor assistance continue during both.',investment:'Current construction purchases are prioritized. Between parts reserve the next monetary offer. Other affordable cursor/job purchases use actual action PPS deltas and the configured payback caps; jobs assigned in editor/files/photo/terminal order until memory is full. Once the release is ready and affordable, no further investments are bought.',scope:'Both mainline22 and optional25 are produced in v1. No paid editor plugins, optional spec upgrades, hidden elements, stray pixels or offline income. Normal unresponsive-app repairs are performed through the real restart action.',automation:'Only the real main time pipeline prepares editor stages. It cannot finish a part; every finish dispatch is manual. Terminal exports its still-unexported set once.'},scenarios:scenarios.map(measure)};
 const output=resolve(root,arg('--out','game/artifacts/stage8b/economy.json'));mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,scenarios:report.scenarios.map(({partSeconds,status,prototype,v1,secondVersion,error,at})=>({partSeconds,status,prototype,v1,secondVersion,error,at}))},null,2));
 if(report.scenarios.some(scenario=>scenario.status==='error'))process.exitCode=1;
}finally {await server.close();}
