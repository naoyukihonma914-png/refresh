import { advanceAdvice, createAdviceState } from './advice';
import { reconcileProgress } from './longPlay';
import { actAppBuild } from './appBuild';
import { featureApp, isBuildable } from './appLayout';
import { BALANCE, type DesktopUpgrade } from '../config/balance';
import { desktopScreen, resizeDesktop, fitWindow, workHeight } from './desktopGeometry';
import { enterDesktop, buyDesktopApp as buyBlueprint, focusWindow, takeScreenshot } from './desktop';
import { createInitialState, type GameState } from './state';
import { buildSeed, createSeedVersion, updateSeedGuide } from './seed';
import { actPageDesign } from './pageDesign';
import { setExamplesEnabled } from './workshopExamples';
import { advanceActiveTime } from './time';
import { UI_SETS, WORKSHOP_PARTS, getWorkshopPart, partsForSet, type UiSetId, type WorkshopPartId } from '../content/workshopCatalog';
import { BASE_PALETTE } from '../content/palette';
import { createComponentDesign, type PartProduction } from './workshopState';
import { actWorkshop, enterWorkshop, advanceWorkshop } from './workshop';
import { advanceShipping, beginPrototypeRelease, beginProductRelease, showShipping, buySpec, startNextVersion, releaseEstimate } from './release';
import { softwarePresentation, type SoftwareStage } from './releasePresentation';

// Freeze historical stage8a URLs to the first 49 parts; future sets get their own fixtures.
const STAGE8A_PARTS=WORKSHOP_PARTS.filter(part=>part.set!=='stream');
const STAGE8A_SETS=UI_SETS.filter(set=>set.id!=='stream');

// Public regression URLs now construct workshop state, never removed drawings.
const LEGACY_FIXTURES = [
  'stage7-store-gen1','stage7-store-gen2','stage7-store-gen3','stage7-sales-gen1','stage7-sales-gen2','stage7-sales-gen3','stage7-freeware','stage7-freeware-sales',
  'stage7-ready0','stage7-ready1','stage7-ready2','stage7-ready3','stage7-no-photos','stage7-store','stage7-shipping','stage7-complete','stage7-v2','stage7-v2-inherit','stage7-advice','stage7-advice0','stage7-advice1','stage7-advice2','stage7-advice3','stage7-offline','stage7-offline0','stage7-offline1','stage7-offline2','stage7-offline3','desktop-stage3',
  'longplay-seed','stray-seed','secret-art','contract-no-cursors','contract-no-color','contracts-offer','longplay-editor0','longplay-editor1','longplay-editor2','longplay-desktop0','longplay-desktop1','longplay-desktop2',
  'app-build-missing','app-build-empty','app-build-files','intro', 'editor-stage0','editor-stage1','editor-stage2','desktop-stage0','desktop-stage1','desktop-stage2',
  'desktop-jobs','desktop-photo','desktop-ready','desktop-stalled',
  'desktop-early', 'desktop-wait', 'desktop-files', 'desktop-mail', 'desktop-modern', 'desktop-full',
  'foundation-start', 'foundation-saved', 'foundation-offline-capped',
  'seed-start', 'seed-border', 'seed-saved', 'seed-color', 'seed-font',
  'seed-layout', 'seed-motion', 'seed-complete', 'seed-return', 'seed-inheriting',
  'kumiki-early', 'kumiki-mature', 'kumiki-wall', 'kumiki-modern', 'kumiki-drift',
  'release-ready', 'release-counting', 'release-complete', 'release-rich', 'release-restarting', 'release-rebuilt', 'release-v1-tessera',
] as const;
const STAGE8B_DESKTOP_VIEWS=['economy-before','economy-after','rates','capture-uncovered','capture-overlap','capture-covered','files-archive','note','editor','stream-draft','stream-ready','stream-spec-blocked','stream-gate'] as const;
const STAGE8A_VIEWS = ['entry','set-shop','main','catalog','files-complete','required-complete-16color','common-custom','editor-custom'] as const;
const TP_MAIN_PARTS=WORKSHOP_PARTS.filter(part=>UI_SETS.find(set=>set.id===part.set)?.mainline);
const TP_SEED_VIEWS=['start','before-layout','first-layout','stable'] as const;
const TP_WORKSHOP_VIEWS=['route','help-catalog'] as const;
const EXAMPLES_VIEWS=['seed-on','seed-off','seed-layout-on','seed-layout-off','seed-custom-on','seed-custom-off','route-on','route-off','place-on','place-off','adjust-on','adjust-off','adjust-custom','finish-on','finish-off','replay-off'] as const;
export const FIXTURE_NAMES: readonly string[] = [...LEGACY_FIXTURES,
  ...EXAMPLES_VIEWS.flatMap(mode=>[0,1,2].map(era=>`examples-${mode}-era${era}`)),
  ...['desktop','desktop-pending'].flatMap(mode=>[0,1,2,3].map(era=>`examples-${mode}-era${era}`)),
  ...TP_SEED_VIEWS.flatMap(view=>[0,1,2].map(era=>`tp1-${view}-era${era}`)),
  ...[0,1,2].map(era=>`tp1-workshop-shell-era${era}`),
  ...TP_WORKSHOP_VIEWS.flatMap(view=>[0,1,2].map(era=>`tp2-${view}-era${era}`)),
  ...[0,5,11,17,22].flatMap(count=>[0,1,2].map(era=>`tp3-progress-${count}-era${era}`)),
  ...TP_MAIN_PARTS.flatMap(part=>[0,1,2].map(era=>`tp3-finish-${part.id}-era${era}`)),
  ...[0,1,2].map(era=>`tp3-second-run-era${era}`),
  ...STAGE8B_DESKTOP_VIEWS.flatMap(view=>[0,1,2,3].map(era=>`stage8b-${view}-era${era}`)),
  ...[0,1,2].map(era=>`stage8b-second-workshop-era${era}`),
  ...['stage8a-seed-ready','stage8a-seed-layout-before','stage8a-seed-workspace-before','stage8a-seed-export-before'].flatMap(name=>[name,`${name}-era1`,`${name}-era2`]),
  ...STAGE8A_VIEWS.flatMap(view=>[`stage8a-${view}`,...[0,1,2].map(era=>`stage8a-${view}-era${era}`)]),
  ...[0,1,2,3].map(era=>`stage8a-desktop-common-custom-era${era}`),
  ...STAGE8A_PARTS.flatMap(part=>[0,1,2,3,4].flatMap(step=>[0,1,2].map(era=>`stage8a-part-${part.id}-step-${step}-era${era}`))),
];
const MAIN_SETS:readonly UiSetId[]=['common','foundation','files','mail'];
const BASE_SETS=STAGE8A_SETS.filter(set=>set.id!=='extras').map(set=>set.id);

function seedState(now:number,count:number):GameState {
 const s=createInitialState(now);s.run.seed.built=BALANCE.w1.items.slice(0,count).map(item=>item.id);
 s.run.seed.history=s.run.seed.built.map((item,i)=>({item,at:Math.max(0,now-(count-i)*60_000)}));
 s.run.seed.autoCursors=count>1?8:0;s.resources.pixels=100_000;s.run.totalPixelsGenerated=250_000;
 if(count>1)s.lastSavedAt=now;return updateSeedGuide(s);
}
function workshopState(now:number,era=0):GameState {
 let s=enterWorkshop(seedState(now,BALANCE.w1.items.length));s.run.workshop.enterMs=0;
 s.resources.pixels=s.run.totalPixelsGenerated=1e12;s.resources.tokens=200;
 s.persistent.editorSkills=era===0?[]:era===1?['update']:['update','modern'];
 s.persistent.appearance.editor=Math.min(era,2) as 0|1|2;
 if(era===2){s.persistent.desktopPrefs.skills=['major1','major2'];s.persistent.appearance.desktop=2;s.run.desktop=resizeDesktop(s.run.desktop,desktopScreen(2),s.persistent.desktopPrefs.iconSize);}
 s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;return s;
}
function production(id:WorkshopPartId,step:PartProduction['step'],now:number):PartProduction {
 const p=getWorkshopPart(id);return {step,rect:{...p.defaultRect},elements:step>=2?[...p.elements]:[],design:createComponentDesign(),completedAt:step===4?now:null,exportedAt:null,tested:step===4};
}
function addSets(s:GameState,sets:readonly UiSetId[],step:PartProduction['step'],now:number,exported=false):GameState {
 s.run.workshop.purchasedSets=[...new Set([...s.run.workshop.purchasedSets,...sets])];
 for(const set of sets)for(const p of partsForSet(set))s.run.workshop.parts[p.id]=production(p.id,step,now);
 s.run.workshop.activePart??=sets[0]?partsForSet(sets[0])[0]!.id:null;
 return exported?actWorkshop(s,{type:'export'},now):s;
}
// Tests may complete a part through the same new domain actions as the UI.
export function completeWorkshopPartFixture(s:GameState,id:WorkshopPartId,now:number,exported=true):GameState {
 const p=getWorkshopPart(id);s.resources.pixels=Math.max(s.resources.pixels,1e12);
 s.run.totalPixelsGenerated=Math.max(s.run.totalPixelsGenerated,s.resources.pixels);
 if(!s.run.workshop.purchasedSets.includes(p.set))s=addSets(s,[p.set],0,now);
 s=actWorkshop(s,{type:'selectPart',part:id},now);s=actWorkshop(s,{type:'place',part:id,rect:{...p.defaultRect}},now);
 for(const element of p.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
 s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);s=actWorkshop(s,{type:'test',part:id,interaction:p.testInteraction},now);
 return exported?actWorkshop(s,{type:'export',part:id},now):s;
}
function customizeCommon(s:GameState):GameState {
 const p=s.run.workshop.parts['common-frame'];if(p){p.elements=['title','close','minimize','maximize'];s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{color:BASE_PALETTE[11]!,textColor:BASE_PALETTE[4]!,titleAlign:'center',controlSide:'start',controlSides:{close:'start',minimize:'end',maximize:'end'},controlColors:{close:BASE_PALETTE[4]!,minimize:BASE_PALETTE[4]!,maximize:BASE_PALETTE[4]!},symbolShape:'square'}},s.lastTickAt);}
 s.run.workshop.activePart='common-frame';return s;
}
function customEditor(s:GameState,era:number):GameState {
 s=actWorkshop(s,{type:'customize',patch:era>0?{accent:BASE_PALETTE[13]!,bandPosition:'top',panelWidth:208,background:BASE_PALETTE[0]!,gridSpacing:16,fontSize:14}:{accent:BASE_PALETTE[13]!,bandPosition:'top'}},s.lastTickAt);
 s.run.workshop.view='settings';return s;
}
function buyDesktopApp(s:GameState,id:DesktopUpgrade):GameState {
 let n=buyBlueprint(s,id);const app=isBuildable(id)?id:featureApp(id);
 if(app){n=actAppBuild(n,{type:'app-recommend',app});n=actAppBuild(n,{type:'app-install',app});n=focusWindow(n,app);}return n;
}
function desktopState(now:number,era=0,stop:DesktopUpgrade|'all'|'none'='all',customCommon=false):GameState {
 let s=workshopState(now,Math.min(era,2));s.run.version='v1';s.persistent.specs.color=1;s=addSets(s,BASE_SETS,4,now,true);
 if(customCommon)s=customizeCommon(s);
 s.persistent.desktopPrefs.skills=era===0?[]:era===1?['major1']:era===2?['major1','major2']:['major1','major2','major3'];
 const stage=Math.min(era,3) as 0|1|2|3;s.persistent.appearance.desktop=stage;s=enterDesktop(s);s.elapsedMs+=BALANCE.w3.enterMs;
 if(stop!=='none')for(const item of BALANCE.w3.apps){s=buyDesktopApp(s,item.id);if(item.id===stop)break;}
 s.run.desktop=resizeDesktop(s.run.desktop,desktopScreen(stage),s.persistent.desktopPrefs.iconSize);s.run.desktop.editingApp=null;s.run.desktop.idleMs=0;s.run.desktop.stalled=null;
 s.run.desktop.notice=s.run.desktop.success=null;s.run.desktop.feedback=[];s.run.desktop.feedbackSerial=0;
 s.resources.pixels=s.run.totalPixelsGenerated=1e12;s.resources.tokens=200;return s;
}
function prototypeReady(now:number):GameState {
 let s=addSets(workshopState(now),MAIN_SETS,4,now,true);s.run.workshop.exitInspected=true;
 s.run.workshop.guide.seen=[...new Set([...s.run.workshop.guide.seen,'wall' as const])];s.run.workshop.guide.current='wall';s.run.workshop.guide.collapsed=false;s.persistent.playerName='Aoi';s.resources.pixels=BALANCE.w2.desktopCost;s.run.seed.autoCursors=41;
 let low=0,high=1e12;for(let i=0;i<64;i++){const mid=(low+high)/2;s.run.totalPixelsGenerated=mid;if(releaseEstimate(s)<304)low=mid;else high=mid;}
 s.run.totalPixelsGenerated=low;return s;
}

// Runtime fixed states use memory storage and never overwrite a real save.
export function createFixture(name:string|null,now:number):GameState|null {
 if(!name||!FIXTURE_NAMES.includes(name))return null;
 if(name==='intro')return createInitialState(now);
 const examples=/^examples-(.+)-era([0-3])$/.exec(name);
 if(examples)return reconcileProgress(examplesFixture(examples[1]!,Number(examples[2]),now),now);
 const testplay=/^tp([123])-(.+)-era([0-2])$/.exec(name);
 if(testplay)return reconcileProgress(testplayFixture(Number(testplay[1]),testplay[2]!,Number(testplay[3]),now),now);
 const stage8b=/^stage8b-(.+)-era([0-3])$/.exec(name);
 if(stage8b)return stage8bFixture(stage8b[1]!,Number(stage8b[2]),now);
 const native=/^stage8a-desktop-common-custom-era([0-3])$/.exec(name);
 if(native){let s=desktopState(now,Number(native[1]),'all',true);for(const nativeWindow of Object.values(s.run.desktop.windows)){nativeWindow.open=false;nativeWindow.minimized=false;}s=focusWindow(s,'files');return s;}
 if(name.startsWith('stage8a-seed-')){
  const era=Number(/-era([12])$/.exec(name)?.[1]??0),base=name.replace(/-era[12]$/,'');
  const id=base==='stage8a-seed-layout-before'?'layout':base==='stage8a-seed-workspace-before'?'workspace':'export';
  const s=seedState(now,base==='stage8a-seed-ready'?0:BALANCE.w1.items.findIndex(item=>item.id===id));
  if(era){s.persistent.editorSkills=era===1?['update']:['update','modern'];s.persistent.appearance.editor=era as 1|2;s.run.version=era===1?'v1':'v2';s.persistent.specs.color=1;if(era===2)s.persistent.desktopPrefs.skills=['major1','major2'];}
  return s;
 }
 const part=/^stage8a-part-(.+)-step-([0-4])-era([0-2])$/.exec(name);
 if(part){let s=addSets(workshopState(now,Number(part[3])),STAGE8A_SETS.map(set=>set.id),0,now);s.persistent.editorSkills=BALANCE.workshop.skills.map(skill=>skill.id);const id=part[1] as WorkshopPartId;s.run.workshop.parts[id]=production(id,Number(part[2]) as PartProduction['step'],now);if(id==='bin-undo'||id==='bin-empty')s.run.workshop.parts['bin-list']=production('bin-list',4,now);s.run.workshop.activePart=id;return s;}
 const view=/^stage8a-(entry|set-shop|main|catalog|files-complete|required-complete-16color|common-custom|editor-custom)(?:-era([0-2]))?$/.exec(name);
 if(view){const mode=view[1]!,era=Number(view[2]??0);let s=workshopState(now,era);
  if(mode==='entry'||mode==='set-shop')return s;
  if(mode==='main')return addSets(s,[...MAIN_SETS,'photo'],0,now);
  if(mode==='catalog'){s=addSets(s,STAGE8A_SETS.map(set=>set.id),0,now);s.persistent.editorSkills=BALANCE.workshop.skills.map(skill=>skill.id);return s;}
  if(mode==='files-complete'){
   s=addSets(addSets(s,['common','foundation'],4,now,true),['files'],0,now);
   for(const descriptor of partsForSet('files'))s=completeWorkshopPartFixture(s,descriptor.id,now,false);
   s.run.workshop.view='workbench';s.run.workshop.activePart='files-list';s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;return s;
  }
  s=addSets(s,MAIN_SETS,4,now,true);
  if(mode==='required-complete-16color'){s.run.workshop.exitInspected=true;s.run.workshop.guide.seen=[...new Set([...s.run.workshop.guide.seen,'wall' as const])];s.run.workshop.guide.current='wall';s.run.workshop.guide.collapsed=false;return s;}
  return mode==='common-custom'?customizeCommon(s):customEditor(s,era);
 }
 if(name.startsWith('stage7-freeware')){let s=advanceShipping(beginProductRelease(prototypeReady(now),now,{language:'ja'}),BALANCE.release.storeAnimationMs);return name.endsWith('-sales')?advanceShipping(showShipping(s),BALANCE.release.animationMs):s;}
 if(/^stage7-(store|sales)-gen[1-3]$/.test(name)){const generation=Number(name.at(-1));let s=createFixture(`stage7-ready${generation===1?0:generation===2?2:3}`,now)!;s=advanceShipping(beginProductRelease(s,now,{language:'ja'}),BALANCE.release.storeAnimationMs);s.persistent.products.at(-1)!.presentation=softwarePresentation(((generation-1)*2) as SoftwareStage);return name.startsWith('stage7-sales')?advanceShipping(showShipping(s),BALANCE.release.animationMs):s;}
 if(name.startsWith('stage7-')){
  const era=/[0-3]$/.test(name)?Number(name.at(-1)):3;let s=createFixture(`desktop-stage${era}`,now)!;
  for(const app of ['tessera','files','mail','photo','bin','clock'] as const)s=focusWindow(s,app);
  s.run.desktop.feedback=Array.from({length:10},(_,i)=>({id:i+1,sender:'hikari' as const,kind:'screenshot' as const,target:'',baseline:[],baselineColor:'#000000',at:now-60_000,completedAt:now-30_000}));
  s.run.desktop.feedbackSerial=10;s.run.desktop.terminal.running=true;s.run.desktop.terminal.executions=1;s.persistent.desktopPrefs.wallpaper={source:'coast',brightness:1.1,tone:0,crop:0};
  s.persistent.productName='あおぞら';s.persistent.playerName='ゆう';s.persistent.seedSkills=['inherit'];s.run.desktop.windows.tessera.minimized=true;s=reconcileProgress(s,now);s.run.play.achievement=null;
  if(name!=='stage7-no-photos'){s=takeScreenshot(s,now,'ja');s.run.desktop.cooldownMs=0;}
  if(name.startsWith('stage7-advice')){s.run.advice=advanceAdvice(advanceAdvice(createAdviceState(),s,0),s,BALANCE.w2.hintMs);return s;}
  if(name.startsWith('stage7-offline')){s.lastTickAt=now-3_600_000;return s;}
  if(name.startsWith('stage7-ready')||name==='stage7-no-photos')return s;
  s=beginProductRelease(s,now,{language:'ja'});if(name==='stage7-store')return advanceShipping(s,BALANCE.release.storeAnimationMs);
  s=showShipping(advanceShipping(s,BALANCE.release.storeAnimationMs));if(name==='stage7-shipping')return advanceShipping(s,2_400);
  s=advanceShipping(s,BALANCE.release.animationMs);if(name==='stage7-complete')return s;
  s=startNextVersion(buySpec(s,'refresh'),now);if(name==='stage7-v2-inherit')return s;s.run.seed.installer=null;s.run.seed.built=[];s.run.restartMs=0;return s;
 }
 if(name.startsWith('release-')){
  let s=prototypeReady(now);if(name==='release-ready')return s;s=advanceShipping(beginPrototypeRelease(s,now),name==='release-counting'?2_400:BALANCE.release.animationMs);
  if(name==='release-rich'){s.resources.dollars=1_000_000;return s;}
  if(['release-restarting','release-rebuilt','release-v1-tessera'].includes(name)){s=startNextVersion(buySpec(s,'color'),now);
   if(name==='release-rebuilt'){s.run.restartMs=0;s.run.seed.built=['border','save','color'];s.run.seed.autoCursors=1;s.resources.pixels=2_236;s.run.totalPixelsGenerated=5_000;s.lastSavedAt=now;}
   if(name==='release-v1-tessera'){s.run.restartMs=0;s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s.run.seed.autoCursors=41;s.resources.pixels=1_000_000;s.run.totalPixelsGenerated=2_000_000;s=addSets(enterWorkshop(s),MAIN_SETS,4,now,true);s.run.workshop.enterMs=0;}}
  return s;
 }
 if(name.startsWith('editor-stage')||name.startsWith('longplay-editor')){const era=Number(name.at(-1));const s=addSets(workshopState(now,era),BASE_SETS,4,now,true);s.persistent.editorSkills=BALANCE.workshop.skills.map(skill=>skill.id);return s;}
 if(name.startsWith('desktop-')||name.startsWith('longplay-desktop')||name.startsWith('app-build-')){
  const era=/stage[0-3]$/.test(name)?Number(name.at(-1)):name.startsWith('longplay-desktop')?Number(name.at(-1)):name==='desktop-modern'?2:0;
  const stop=['desktop-early','desktop-wait','app-build-empty','app-build-files'].includes(name)?'none':name==='desktop-files'?'files':name==='desktop-mail'||name==='desktop-modern'?'mail':name==='desktop-jobs'?'jobs':name==='desktop-photo'?'compare':'all';
  let s=desktopState(now,era,stop);
  if(name.startsWith('desktop-stage')){s.persistent.desktopPrefs.skills=era===3?['major1','major2','major3']:['major1','major2'];s.run.desktop.feedback=[{id:1,kind:'color',sender:'hikari',target:'primary',baseline:[],baselineColor:'#000000',at:now,completedAt:null}];s.run.desktop.feedbackSerial=1;s.run.desktop.notice=1;}
  if(name==='desktop-wait')s.resources.pixels=20_000;
  if(name==='desktop-files'){for(const app of s.run.desktop.apps)s.run.desktop.windows[app].open=app==='files';s=focusWindow(s,'files');}
  if(['desktop-jobs','desktop-photo','desktop-ready'].includes(name)||name.startsWith('desktop-stage')||name.startsWith('longplay-desktop')){
   for(const app of ['tessera','files','photo'] as const)s.run.desktop.jobs[app]={assigned:true,cursors:8,updates:1};s=focusWindow(focusWindow(s,'tessera'),'note');if(name!=='desktop-jobs')s=focusWindow(s,'photo');
   for(const app of ['manager','mail','bin','clock','theme','terminal','settings'] as const)s.run.desktop.windows[app].open=false;
   if(name==='desktop-ready'||name.startsWith('desktop-stage')){s.persistent.desktopPrefs.wallpaper={source:'coast',brightness:1.1,tone:0,crop:0};s.run.desktop.terminal.running=true;s.run.desktop.terminal.executions=1;for(let i=0;i<4;i++){s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now+i,'ja');}s.run.desktop.cooldownMs=0;}}
  if(name==='desktop-stalled')s.run.desktop.stalled='photo';
  if(name==='desktop-full'){for(let i=0;i<BALANCE.w3.baseShotCapacity;i++){s.run.desktop.cooldownMs=0;s=takeScreenshot(s,now,'ja');}s.run.desktop.cooldownMs=0;}
  if(name==='app-build-empty'||name==='app-build-files'){s=buyBlueprint(s,'files');if(name==='app-build-files')s=actAppBuild(s,{type:'app-recommend',app:'files'});s.persistent.editorSkills=['update'];s.persistent.appearance.editor=1;}
  if(name==='app-build-missing'){const p=s.run.desktop.projects.files!;p.draft.parts=p.draft.parts.filter(part=>part.id!=='sort');p.installed=structuredClone(p.draft);s.run.desktop.feedback=[{id:1,kind:'sort',sender:'hikari',target:'',baseline:[],baselineColor:'#000000',at:now,completedAt:null}];s.run.desktop.feedbackSerial=1;s.run.desktop.notice=1;}
  return s;
 }
 if(name.startsWith('kumiki-')||name==='secret-art'){
  let s=workshopState(now,name==='kumiki-modern'?2:0);if(name==='kumiki-early'){s.resources.pixels=0;return s;}
  s=addSets(s,name==='kumiki-wall'?MAIN_SETS:['common'],name==='kumiki-mature'||name==='secret-art'?3:4,now,name==='kumiki-wall');
  if(name==='kumiki-wall'){s.resources.pixels=BALANCE.w2.desktopCost;s.run.workshop.exitInspected=true;s.run.workshop.guide.seen=[...new Set([...s.run.workshop.guide.seen,'wall' as const])];s.run.workshop.guide.current='wall';s.run.workshop.guide.collapsed=false;}
  if(name==='kumiki-drift'){s=customizeCommon(s);s.run.workshop.activePart='common-button';}return s;
 }
 if(name==='contracts-offer'){const s=createFixture('stage7-complete',now)!;s.persistent.seedSkills=['inherit'];s.persistent.progress.records['v1-released']=now;return buySpec(s,'refresh');}
 if(name.startsWith('contract-')){const s=createInitialState(now);s.run.version='v2';s.run.play.contract={id:name==='contract-no-color'?'no-color':'no-cursors',status:'active'};s.resources.pixels=s.run.totalPixelsGenerated=100_000;return s;}
 if(name.startsWith('seed-')||name==='longplay-seed'||name==='stray-seed'){
  if(name==='seed-start'){const s=createInitialState(now);s.resources.pixels=s.run.totalPixelsGenerated=7;return s;}
  const end=name==='seed-border'?'border':name==='seed-saved'?'save':name==='seed-color'?'color':name==='seed-font'?'font':name==='seed-layout'?'layout':name==='seed-complete'?'export':'motion';
  let s=seedState(now,BALANCE.w1.items.findIndex(item=>item.id===end)+1);s.resources.pixels=12_000;s.run.totalPixelsGenerated=40_000;if(name==='seed-motion'||name==='longplay-seed'||name==='stray-seed')s.run.seed.autoCursors=24;
  if(name==='stray-seed')s.run.play.stray={waitMs:120_000,lifeMs:30_000,x:.2,y:.7,serial:1};
  if(name==='seed-return'||name==='seed-inheriting'){s.run.version='v1';s.persistent.specs.color=1;s.resources.tokens=40;if(name==='seed-inheriting'){s.persistent.seedSkills=['inherit'];s=createSeedVersion(s,'v2',now);}}return s;
 }
 if(name==='foundation-start')return createInitialState(now);const s=seedState(now,2);s.run.seed.autoCursors=1;
 if(name==='foundation-offline-capped'){s.lastTickAt-=BALANCE.debug.offlineFixtureHours*BALANCE.time.millisecondsPerHour;s.createdAt=s.lastSavedAt=s.lastTickAt;}return s;
}

const fixtureBudget=(s:GameState):GameState=>({...s,resources:{...s.resources,pixels:1e12,tokens:200},run:{...s.run,totalPixelsGenerated:Math.max(s.run.totalPixelsGenerated,1e12)}});
function stage8bWorkshop(now:number,version:GameState['run']['version'],era=0,previous?:GameState):GameState {
 let s=previous?createSeedVersion(previous,version==='v2'?'v2':'v1',now):createInitialState(now);
 s.run.version=version;
 s.persistent.specs.color=version==='v0.1'?0:1;
 s.persistent.editorSkills=era===0?[]:era===1?['update']:['update','modern'];
 s.persistent.appearance.editor=Math.min(era,2) as 0|1|2;
 s.persistent.desktopPrefs.skills=era===0?[]:era===1?['major1']:era===2?['major1','major2']:['major1','major2','major3'];
 s.persistent.appearance.desktop=Math.min(era,3) as 0|1|2|3;
 s.run.desktop=resizeDesktop(s.run.desktop,desktopScreen(Math.min(era,3) as 0|1|2|3),s.persistent.desktopPrefs.iconSize);
 s=fixtureBudget(s);
 for(const item of BALANCE.w1.items)if(!s.run.seed.built.includes(item.id))s=buildSeed(s,item.id,now);
 s.run.workshop.enterMs=0;s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;
 return s;
}
function stage8bSet(s:GameState,set:UiSetId,now:number,unfinished?:WorkshopPartId):GameState {
 if(!s.run.workshop.purchasedSets.includes(set))s=actWorkshop(s,{type:'buySet',set},now);
 if(!s.run.workshop.purchasedSets.includes(set))throw new Error(`Stage8b fixture cannot purchase ${set}`);
 for(const definition of partsForSet(set)){
  if(definition.id!==unfinished){s=completeWorkshopPartFixture(s,definition.id,now);continue;}
  s=actWorkshop(s,{type:'selectPart',part:definition.id},now);
  s=actWorkshop(s,{type:'place',part:definition.id,rect:{...definition.defaultRect}},now);
  for(const element of definition.elements)s=actWorkshop(s,{type:'addElement',part:definition.id,element},now);
  s=actWorkshop(s,{type:'confirmAdjustment',part:definition.id},now);
 }
 return s;
}
function stage8bMain(s:GameState,now:number):GameState {
 for(const set of MAIN_SETS)s=stage8bSet(s,set,now);
 return s;
}
function stage8bPrevious(now:number,era=0):GameState {
 let previous=stage8bMain(stage8bWorkshop(now,'v0.1',era),now);
 previous.persistent.seedSkills=['inherit'];
 previous=actWorkshop(previous,{type:'customize',patch:{accent:BASE_PALETTE[13]!,background:BASE_PALETTE[0]!,panelWidth:BALANCE.workshop.customization.panelMax}},now);
 return reconcileProgress(previous,now);
}
function stage8bDesktop(now:number,era=0,version:'v1'|'v2'='v1',unfinishedCrop=false,archive=false):GameState {
 const previous=archive?stage8bPrevious(now-86_400_000,Math.min(era,2)):undefined;
 let s=stage8bMain(stage8bWorkshop(now,version,era,previous),now);
 s=stage8bSet(s,'manager',now);
 s=stage8bSet(s,'photo',now,unfinishedCrop?'photo-crop':undefined);
 if(version==='v2')s.persistent.specs.refresh=BALANCE.world4.requiredRefreshLevel;
 s=enterDesktop(s);s.elapsedMs+=BALANCE.w3.enterMs;
 if(s.run.world!=='desktop')throw new Error('Stage8b fixture could not assemble desktop');
 for(const app of BALANCE.w3.offerOrder){
  s=buyDesktopApp(s,app);
  if(app==='photo')break;
 }
 s.run.desktop.editingApp=null;s.run.desktop.notice=null;s.run.desktop.success=null;s.run.desktop.feedback=[];s.run.desktop.feedbackSerial=0;
 for(const nativeWindow of Object.values(s.run.desktop.windows)){nativeWindow.open=false;nativeWindow.minimized=false;}
 s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;
 s=reconcileProgress(s,now);s.run.play.achievement=null;
 return fixtureBudget(s);
}
function stage8bFixture(mode:string,era:number,now:number):GameState {
 if(mode==='second-workshop'){
  const previous=stage8bMain(stage8bWorkshop(now-86_400_000,'v1',era,stage8bPrevious(now-172_800_000,era)),now-86_400_000);
  previous.persistent.seedSkills=['inherit'];
  let s=stage8bWorkshop(now,'v2',era,previous);
  s.persistent.specs.refresh=BALANCE.world4.requiredRefreshLevel;
  s=actWorkshop(s,{type:'buySet',set:'common'},now);
  s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;
  return reconcileProgress(s,now);
 }
 if(mode==='stream-draft'||mode==='stream-ready'||mode==='stream-spec-blocked'||mode==='stream-gate'){
  let s=stage8bDesktop(now,era,'v2',false,true);
  s=actWorkshop(s,{type:'buySet',set:'stream'},now);
  if(mode==='stream-ready'||mode==='stream-spec-blocked')s=stage8bSet(s,'stream',now);
  else{
   const descriptor=getWorkshopPart('stream-preview');
   s=actWorkshop(s,{type:'selectPart',part:descriptor.id},now);
   s=actWorkshop(s,{type:'place',part:descriptor.id,rect:{...descriptor.defaultRect}},now);
   for(const element of descriptor.elements)s=actWorkshop(s,{type:'addElement',part:descriptor.id,element},now);
   s=actWorkshop(s,{type:'confirmAdjustment',part:descriptor.id},now);
  }
  if(mode==='stream-spec-blocked')s.persistent.specs.refresh=0;
  s.run.workshop.activePart='stream-preview';s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;
  return focusWindow(s,'tessera');
 }
 let s=stage8bDesktop(now,era,'v1',mode==='economy-before',mode==='files-archive'||mode==='note'||mode==='editor');
 if(mode==='economy-before')s.run.workshop.activePart='photo-crop';
 if(mode==='economy-after'){
  s=actAppBuild(s,{type:'app-edit',app:'photo'});s=actAppBuild(s,{type:'app-recommend',app:'photo'});s=actAppBuild(s,{type:'app-install',app:'photo'});
 }
 if(mode.startsWith('capture-')){
  s=focusWindow(s,'files');
  if(mode!=='capture-uncovered'){
   s=focusWindow(s,'note');
   const file=s.run.desktop.windows.files,screen=s.run.desktop.screen;
   const rect=mode==='capture-covered'?{x:0,y:0,width:screen.width,height:workHeight(screen)}:{x:Math.min(file.x+file.width*.25,screen.width-300),y:file.y+40,width:Math.max(300,file.width*.6),height:Math.max(240,file.height-40)};
   s.run.desktop.windows.note={...s.run.desktop.windows.note,...fitWindow('note',rect,screen),maximized:mode==='capture-covered',restore:mode==='capture-covered'?{x:file.x,y:file.y,width:300,height:240}:null};
  }
  return s;
 }
 if(mode==='rates')return focusWindow(s,'manager');
 if(mode==='note')return focusWindow(s,'note');
 if(mode==='editor')return focusWindow(s,'tessera');
 return focusWindow(s,mode==='files-archive'?'files':'photo');
}


/** TP visual fixtures use real construction/purchase/production actions; only their budget and prior visual era are supplied. */
function testplaySeed(now:number,era:number,count:number,firstLayout=false,version?:'v1'|'v2'):GameState {
 let s=fixtureBudget(createInitialState(now));
 if(era>0||version){
  for(const item of BALANCE.w1.items){s=buildSeed(s,item.id,now);if(item.id==='layout')s=actPageDesign(s,{type:'layout-guide-seen'});}
  s=advanceWorkshop(s,BALANCE.workshop.enterMs);
  if(era>0)s=actWorkshop(s,{type:'skill',id:'update'},now);
  if(era===2){
   // Prior desktop environment is visual setup, never a new app or a material grant.
   s.persistent.desktopPrefs.skills=['major1','major2'];
   s=actWorkshop(s,{type:'skill',id:'modern'},now);
  }
  s=createSeedVersion(s,version??(era===1?'v1':'v2'),now);
  s=fixtureBudget(s);s.persistent.specs.color=1;
 }
 for(const item of BALANCE.w1.items.slice(0,count))s=buildSeed(s,item.id,now);
 if(!firstLayout&&s.run.seed.built.includes('layout'))s=actPageDesign(s,{type:'layout-guide-seen'});
 return s;
}
function testplayWorkshop(now:number,era:number,version?:'v1'|'v2'):GameState {
 let s=testplaySeed(now,era,BALANCE.w1.items.length,false,version);
 s=advanceWorkshop(s,BALANCE.workshop.enterMs);
 s=actWorkshop(s,{type:'guide',id:'close'},now);
 return s;
}
function testplayMainPrefix(state:GameState,count:number,now:number):GameState {
 let s=state;
 for(const definition of TP_MAIN_PARTS.slice(0,count)){
  if(!s.run.workshop.purchasedSets.includes(definition.set))s=actWorkshop(s,{type:'buySet',set:definition.set},now);
  s=completeWorkshopPartFixture(s,definition.id,now,false);
 }
 return actWorkshop(s,{type:'help',target:null},now);
}
function testplayFixture(step:number,mode:string,era:number,now:number):GameState {
 if(step===1&&mode==='workshop-shell'){
  const s=testplayFixture(3,'finish-common-button',era,now);
  return {...s,resources:{...s.resources,tokens:0}};
 }
 if(step===1){
  const count=mode==='start'?0:mode==='before-layout'?4:mode==='first-layout'?5:8;
  const s=testplaySeed(now,era,count,mode==='first-layout');
  return fixtureBudget(s);
 }
 if(step===2&&mode==='route')return testplayWorkshop(now,era);
 if(step===2&&mode==='help-catalog'){
  let s=testplayMainPrefix(testplayWorkshop(now,era,'v2'),TP_MAIN_PARTS.length,now);
  s.persistent.specs.color=1;s=enterDesktop(s);
  for(const set of UI_SETS.filter(set=>!set.mainline&&set.id!=='extras'))s=actWorkshop(s,{type:'buySet',set:set.id},now);
  s=actWorkshop(s,{type:'skill',id:'extraParts'},now);
  s=actWorkshop(s,{type:'help',target:null},now);
  s=actWorkshop(s,{type:'guide',id:'close'},now);
  s=actWorkshop(s,{type:'view',view:'workbench'},now);
  return focusWindow(s,'tessera');
 }
 if(step===3&&mode.startsWith('progress-'))return testplayMainPrefix(testplayWorkshop(now,era),Number(mode.slice('progress-'.length)),now);
 if(step===3&&mode.startsWith('finish-')){
  const id=mode.slice('finish-'.length) as WorkshopPartId,index=TP_MAIN_PARTS.findIndex(part=>part.id===id),definition=getWorkshopPart(id);
  let s=testplayMainPrefix(testplayWorkshop(now,era),index,now);
  if(!s.run.workshop.purchasedSets.includes(definition.set))s=actWorkshop(s,{type:'buySet',set:definition.set},now);
  s=actWorkshop(s,{type:'selectPart',part:id},now);
  s=actWorkshop(s,{type:'place',part:id,rect:{...definition.defaultRect}},now);
  for(const element of definition.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
  s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);
  s=actWorkshop(s,{type:'help',target:null},now);
  return actWorkshop(s,{type:'guide',id:'close'},now);
 }
 if(step===3&&mode==='second-run'){
  let s=createFixture(`stage7-ready${era}`,now)!;
  s=actPageDesign(s,{type:'layout-guide-seen'});
  s=showShipping(beginProductRelease(s,now,{language:'ja',reducedMotion:true}),true);
  s=buySpec(s,'refresh');s=startNextVersion(s,now);
  s=advanceActiveTime(s,BALANCE.release.restartMs).state;
  return fixtureBudget(s);
 }
 throw new Error('Unknown testplay fixture: '+step+' '+mode);
}

/** Examples setup uses the real material/production reducers; no completed step is rewound. */
function examplesFixture(mode:string,era:number,now:number):GameState {
 if(mode.startsWith('desktop')){
  let s=stage8bFixture(mode==='desktop-pending'?'economy-before':'editor',era,now);
  s=focusWindow(s,'tessera');
  return setExamplesEnabled(s,true);
 }
 if(mode==='replay-off'){
  let s=setExamplesEnabled(createFixture(`stage7-ready${era}`,now)!,false);
  s=actPageDesign(s,{type:'layout-guide-seen'});
  s=showShipping(beginProductRelease(s,now,{language:'ja',reducedMotion:true}),true);
  s=buySpec(s,'refresh');s=startNextVersion(s,now);
  return fixtureBudget(advanceActiveTime(s,BALANCE.release.restartMs).state);
 }
 if(mode.startsWith('seed')){
  const count=mode.startsWith('seed-layout')?4:mode.startsWith('seed-custom')?8:0;
  let s=testplaySeed(now,era,count);
  if(mode.startsWith('seed-custom')){
   s=actPageDesign(s,{type:'part-size',part:'generator',size:'extraLarge'});
   s=actPageDesign(s,{type:'part-font',part:'heading',size:'large'});
   s=actPageDesign(s,{type:'font',slot:'headingFont',font:'mono'});
  }
  return setExamplesEnabled(s,!mode.endsWith('-off'));
 }
 if(mode.startsWith('route'))return setExamplesEnabled(testplayWorkshop(now,era),mode.endsWith('-on'));
 let s=testplayMainPrefix(testplayWorkshop(now,era),2,now);
 const part=getWorkshopPart('common-button');
 s=actWorkshop(s,{type:'selectPart',part:part.id},now);
 if(!mode.startsWith('place')){
  s=actWorkshop(s,{type:'place',part:part.id,rect:{...part.defaultRect}},now);
  for(const element of part.elements)s=actWorkshop(s,{type:'addElement',part:part.id,element},now);
  if(mode==='adjust-custom'){
   s=actWorkshop(s,{type:'place',part:part.id,rect:{...part.defaultRect,x:part.defaultRect.x+32,y:part.defaultRect.y+32}},now);
   s=actWorkshop(s,{type:'adjust',part:part.id,patch:{radius:8,shadow:true}},now);
  }
  if(mode.startsWith('finish'))s=actWorkshop(s,{type:'confirmAdjustment',part:part.id},now);
 }
 s=actWorkshop(s,{type:'help',target:null},now);
 s=actWorkshop(s,{type:'guide',id:'close'},now);
 return setExamplesEnabled(s,!mode.endsWith('-off'));
}
