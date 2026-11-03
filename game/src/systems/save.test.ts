import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { clearGame, createMemoryStorage, decodeSave, encodeSave, loadGame, SAVE_KEYS, saveGame } from './save';
import { createInitialState, isGameState, SCHEMA_VERSION } from './state';
import { LEGACY_PART_PRICES, LEGACY_REMOVED_SKILL_PRICES } from './legacySave';
import { BALANCE } from '../config/balance';
import { buildSeed } from './seed';
import { pageColors } from './pageDesign';
import { advanceShipping, buySpec, showShipping, startNextVersion } from './release';
import { getWorkshopPart } from '../content/workshopCatalog';
import { createComponentDesign, effectiveEditorBackground, type PartProduction } from './workshopState';
import { migrateFittingProduction } from './workshopFitting';

const savedState = () => {
  const state = createInitialState(1_000);
  state.run.seed.built = ['border', 'save'];
  state.run.totalPixelsGenerated = 50;
  return state;
};
const oldDrawing = () => ({size:16,frames:[Array<number>(256).fill(11)],rewarded:Array<boolean>(256).fill(true),exported:true,dirty:false,name:'旧作品',earnedPixels:10});
function historicalProduct() {
  return {id:1,name:'旧製品',version:'v0.1' as 'v0.1'|'v1.0',releasedAt:500,author:'作者',generatedPixels:1_000_000,builtCount:19,revenue:500,
    screen:{pixels:1_234,built:['border','save','color','font','layout','motion','kumiki'],cursors:12,
      kumikiBuilt:['select','button','input'],placed:['button','input'],design:{primary:{color:'#000080',radius:4,textSize:'medium',shadow:false}},
      focus:false,interval:1,exportName:'旧作品',specs:{color:0,resolution:0,refresh:0,memory:0,storage:0,network:0,graphics:0},
      seedSkills:[],pattern:'none',marquee:false,kumikiSkills:['fill'],modern:false,log:[],history:[],
    },
    exports:[{kind:'icon',id:'folder',name:'旧作品',at:400,size:16,frames:oldDrawing().frames}],
  };
}
function legacyState(version = 13) {
  const current = createInitialState(1_000);
  const {workshop:_workshop,...run} = current.run;
  const {editorSkills:_skills,editorCustomization:_customization,setDocuments:_documents,...persistent} = current.persistent;
  const {secretPart:_secret,...progress} = persistent.progress;
  return {...current,schemaVersion:version,resources:{pixels:1_234,tokens:21,dollars:123},run:{...run,
    world:'kumiki' as typeof run.world,totalPixelsGenerated:1_000_000,
    advice:{seen:['editor-draw','desktop-icons'],current:'editor-draw' as string|null,fingerprint:'old drawing state',idleMs:100},
    seed:{...run.seed,built:['border','save','color','font','layout','motion','kumiki'],history:[{item:'kumiki',at:500}]},
    kumiki:{entered:true,enteredAt:100,built:['select','button','input'],placed:['button','input'],drawings:{folder:oldDrawing()},underlays:{folder:oldDrawing()},
      exports:[{kind:'icon',id:'folder',name:'旧作品',at:400,size:16,frames:oldDrawing().frames}],activeDrawing:'folder',workspace:'draw',activeDocument:'drawing',
      design:{primary:{color:'#000080',radius:4,textSize:'medium',shadow:false}},focus:false,interval:1,exportName:'旧作品',bank:60,batchMs:500,
      driftTimerMs:0,generationLog:[],drift:null,guide:{seen:['entered','draw','complete','export'],read:['entered'],current:'draw',collapsed:false},
      lastActionAt:100,exitInspected:true,tokenDiscovered:true,homeWindow:'normal'},
    desktop:{...run.desktop,feedback:[] as {id:number;sender:'hikari';kind:string;target:string;baseline:number[];baselineColor:string;at:number;completedAt:number|null;reward?:number}[]},
  },persistent:{...persistent,progress:{...progress,unknownArt:null as ReturnType<typeof oldDrawing>|null},
    artwork:{icons:{folder:oldDrawing()},sketchbook:oldDrawing(),wallpaper:oldDrawing(),skills:['fill','layers','update'] as string[],modern:false},
    products:[] as ReturnType<typeof historicalProduct>[],homeTheme:{primary:{color:'#000080',radius:4,textSize:'medium',shadow:false}},homeUpdatedAt:100,sketchUpdatedAt:200,
    guideArchive:[{kind:'kumiki',id:'draw',version:'v0.1'},{kind:'kumiki',id:'entered',version:'v0.1'}],
    appearance:{editor:1 as 0|1|2,desktop:0 as 0|1|2|3},
  }};
}
const erase = (value: object, ...keys: string[]) => {for(const key of keys)delete (value as Record<string,unknown>)[key];};
function historicalVersion(version:number) {
  const old = legacyState(version);
  // Remove fields that did not exist in that published schema rather than merely
  // changing a modern envelope's version number.
  if(version<2){erase(old.run.seed,'history','guide','lastActionAt','installer','page');erase(old.persistent,'seedSkills','seedAppearance');}
  if(version<3){erase(old.run,'kumiki');erase(old.persistent,'artwork');}
  if(version<5){erase(old.run,'shipping','restartMs');erase(old.persistent,'products','guideArchive','homeTheme');}
  if(version<6){erase(old.run,'desktop');erase(old.persistent,'productName','numberNotation','screenshots','productionNote','noteUpdatedAt');}
  if(version<7){erase(old.persistent,'homeUpdatedAt','sketchUpdatedAt');}
  if(version<8){erase(old.persistent,'desktopPrefs');erase(old.run.desktop??{},'upgrades');}
  if(version<9){erase(old.persistent,'appearance');}
  if(version<11){erase(old.run.desktop??{},'projects','editingApp');}
  if(version<13){erase(old.run,'play');erase(old.persistent,'progress');}
  return old;
}
const forbiddenFields = new Set(['kumiki','artwork','drawings','underlays','sketchbook','homeTheme','homeUpdatedAt','sketchUpdatedAt','unknownArt','frames','rewarded','activeDrawing','homeWindow']);
function assertRetiredStateRemoved(value:unknown):void {
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)) {expect(forbiddenFields.has(key),key).toBe(false);assertRetiredStateRemoved(child);}
}
// A frozen, published schema-13 desktop with a format-9 screenshot, generated by
// the unmodified main fixture. Gzip keeps historical bitmap test input compact;
// no retired drawing code is imported by either the test or the migration.
const HISTORICAL_DESKTOP_V13 = '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';
const historicalDesktop = () => JSON.parse(gunzipSync(Buffer.from(HISTORICAL_DESKTOP_V13,'base64')).toString()) as ReturnType<typeof legacyState>;

describe('第14版への保存データ移行', () => {
  it.each(Array.from({length:13},(_,index)=>index+1))('公開済み第%i版を現在のvalidatorに依存せず読み込める', version => {
    const old=historicalVersion(version),next=decodeSave(JSON.stringify(old));
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
    expect(next.run.world).toBe('kumiki');expect(next.run.workshop.entered).toBe(true);
    expect(next.run.seed.built).toEqual(['border','save','color','font','layout','motion','bars','workspace','export']);
    expect(next.resources.dollars).toBe(old.resources.dollars);
    expect(isGameState(next)).toBe(true);assertRetiredStateRemoved(next);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('旧制作物・下絵・自由帳を捨て、資源・未受取分・廃止購入を一度だけ精算する', () => {
    const old=legacyState();old.run.kumiki.built=Object.keys(LEGACY_PART_PRICES);old.persistent.artwork.skills=['layers','snap','modern','update',...Object.keys(LEGACY_REMOVED_SKILL_PRICES)];
    old.persistent.appearance.editor=2;old.persistent.appearance.desktop=2;old.persistent.desktopPrefs.skills=['major1','major2'];
    // Keep native desktop geometry valid for its saved era.
    const reference=historicalDesktop();old.run.desktop=reference.run.desktop;
    old.persistent.progress.unknownArt=oldDrawing();
    const raw=JSON.stringify(old),next=decodeSave(raw);
    expect(next.resources.pixels).toBe(1_234+60+Object.values(LEGACY_PART_PRICES).reduce((sum,n)=>sum+n,0));
    expect(next.resources.tokens).toBe(21+Object.values(LEGACY_REMOVED_SKILL_PRICES).reduce((sum,n)=>sum+n,0));
    expect(next.resources.dollars).toBe(123);expect(next.run.totalPixelsGenerated).toBe(1_000_060);
    expect(next.persistent.editorSkills).toEqual(['layers','snap','modern','update']);
    expect(next.persistent.editorCustomization.accent).toBe('#000080');
    expect(next.persistent.progress.secretPart).toBe(true);expect(next.persistent.setDocuments).toEqual([]);
    expect(next.run.workshop.parts).toEqual({});expect(next.run.workshop.purchasedSets).toEqual([]);
    assertRetiredStateRemoved(next);expect(JSON.stringify(old)).toBe(raw);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it.each(['#7cc4f2','#3a3450','#F4EFE4'])('旧W1で選んだ背景%sを工房の色へ移し、次の読込でも失わない', background => {
    const old=legacyState();old.run.world='seed';old.run.kumiki.entered=false;old.run.seed.built.pop();old.run.seed.history=[];
    old.resources.pixels=100_000;old.run.seed.page.background=background;
    const raw=JSON.stringify(old),baseline=decodeSave(JSON.stringify({...old,run:{...old.run,seed:{...old.run.seed,page:{...old.run.seed.page,background:null}}}}));
    let next=decodeSave(raw);
    expect(next.persistent.editorCustomization).toMatchObject({background,nativeBackground:false});
    expect(next.resources).toEqual(baseline.resources);expect(next.run.seed.page.background).toBe(background);
    expect(pageColors(next.run.seed.page,next.persistent.specs.color,next.persistent.editorCustomization,next.persistent.appearance.editor).background).toBe(background);
    for(const id of ['bars','workspace','export'] as const)next=buildSeed(next,id,2_000);
    expect(next.run.world).toBe('kumiki');expect(effectiveEditorBackground(next.persistent.editorCustomization,next.persistent.appearance.editor)).toBe(background);
    const reloaded=decodeSave(encodeSave(next));expect(reloaded.persistent.editorCustomization).toEqual(next.persistent.editorCustomization);expect(reloaded.resources).toEqual(next.resources);
    assertRetiredStateRemoved(next);expect(JSON.stringify(old)).toBe(raw);
  });
  it.each(['null','omitted'] as const)('旧W1の背景が%sなら標準材質を維持する', choice => {
    const old=legacyState();old.run.seed.page.background=null;if(choice==='omitted')erase(old.run.seed.page,'background');
    const next=decodeSave(JSON.stringify(old));
    expect(next.persistent.editorCustomization.nativeBackground).toBe(true);
    expect(next.persistent.editorCustomization.background).toBe(BALANCE.workshop.customization.background);
    for(const stage of [0,1,2] as const)expect(effectiveEditorBackground(next.persistent.editorCustomization,stage)).toBe(BALANCE.workshop.customization.nativeBackgrounds[stage]);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('途中の素の画面は購入した6項目を保ち、新しい3項目を通常操作で作れる', () => {
    const old=legacyState();old.run.world='seed';old.run.seed.built.pop();old.run.seed.history=[];old.run.kumiki.entered=false;
    old.resources.pixels=100_000;old.run.kumiki.built=[];old.run.kumiki.bank=0;
    let next=decodeSave(JSON.stringify(old));
    expect(next.run.seed.built).toEqual(['border','save','color','font','layout','motion']);expect(next.run.workshop.entered).toBe(false);
    for(const id of ['bars','workspace','export'] as const)next=buildSeed(next,id,2_000);
    expect(next.run.world).toBe('kumiki');expect(next.run.workshop.entered).toBe(true);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('旧最後の購入済みで起動直前だったセーブも、追加支払いなしに工房へ入る', () => {
    const old=legacyState();old.run.world='seed';old.run.kumiki.entered=false;old.run.kumiki.built=[];old.run.kumiki.bank=0;
    const next=decodeSave(JSON.stringify(old));expect(next.run.world).toBe('kumiki');expect(next.run.workshop.entered).toBe(true);expect(next.resources.pixels).toBe(1_234);
  });
  it('第11版以前のスイッチとスライダーも、旧返金済み第12版と同じ資源へ一度だけ移る', () => {
    const before=legacyState(11),after=legacyState(12);
    before.run.kumiki.built=['switch','slider'];before.run.kumiki.bank=0;
    after.run.kumiki.built=[];after.run.kumiki.bank=0;after.resources.pixels+=20_000+32_000;
    const migrated=decodeSave(JSON.stringify(before));
    expect(migrated.resources).toEqual(decodeSave(JSON.stringify(after)).resources);
    expect(decodeSave(encodeSave(migrated)).resources).toEqual(migrated.resources);
  });
  it('第12版以前に達成した実績と過去の撮影回数も、描画機能なしで復元できる', () => {
    const old=historicalVersion(12),product=historicalProduct();
    product.screen.placed=['button','input','frame','taskbar'];
    product.exports=['folder','bin','clock','mail','photo','settings','document','image','music','video','archive','text','chart','terminal','link','star'].map(id=>({...product.exports[0]!,id}));
    old.persistent.products=[product];old.persistent.desktopPrefs.lastShotId=100;
    const next=decodeSave(JSON.stringify(old));
    expect(next.persistent.progress.counts.shots).toBe(100);expect(next.persistent.progress.counts.icons).toBe(16);
    for(const id of ['icons6','practice10','parts-all','first-shot','shots100'] as const)expect(next.persistent.progress.records[id]).toBe(1_000);
    assertRetiredStateRemoved(next);
  });
  it('古い主データを繰り返し開き、保存や予備復旧をしても補償は積み増されない', () => {
    const storage=createMemoryStorage();storage.setItem(SAVE_KEYS.primary,JSON.stringify(legacyState()));
    const loaded=loadGame(storage);expect(loaded.kind).toBe('loaded');if(loaded.kind!=='loaded')throw new Error('legacy load failed');
    expect(loadGame(storage)).toEqual(loaded);expect(saveGame(storage,loaded.state,2_000).kind).toBe('saved');
    const current=loadGame(storage);expect(current.kind).toBe('loaded');if(current.kind!=='loaded')throw new Error('current load failed');
    expect(current.state.resources).toEqual(loaded.state.resources);
    storage.setItem(SAVE_KEYS.primary,'broken');const recovered=loadGame(storage);
    expect(recovered.kind).toBe('recovered');if(recovered.kind!=='recovered')throw new Error('legacy backup failed');
    expect(recovered.state.resources).toEqual(loaded.state.resources);
  });
  it('実際の旧デスクトップ・窓・ジョブ・製品・スクリーンショットを保持する', () => {
    const old=historicalDesktop();old.persistent.productionNote='追記を残す';old.persistent.playerName='保存した作者';
    const next=decodeSave(JSON.stringify(old));
    expect(next.run.world).toBe('desktop');expect(next.run.desktop.apps).toEqual(old.run.desktop.apps);expect(next.run.desktop.windows).toEqual(old.run.desktop.windows);expect(next.run.desktop.jobs).toEqual(old.run.desktop.jobs);
    expect(next.persistent.specs).toEqual(old.persistent.specs);expect(next.persistent.progress.records).toEqual(old.persistent.progress.records);expect(next.persistent.progress.counts).toEqual(old.persistent.progress.counts);
    expect(next.persistent.productionNote).toBe('追記を残す');expect(next.persistent.playerName).toBe('保存した作者');
    expect(next.persistent.screenshots).toEqual(old.persistent.screenshots);
    expect(next.persistent.products[0]!.revenue).toBe(old.persistent.products[0]!.revenue);
    expect(next.persistent.products[0]!.exports.map(e=>e.id)).toEqual(old.persistent.products[0]!.exports.map(e=>e.id));
    expect(isGameState(next)).toBe(true);assertRetiredStateRemoved(next);expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('現カタログに無いIDを持つ公開済み製品も、売上と履歴のまま残す', () => {
    const old=legacyState(),product=historicalProduct();product.screen.built.push('retired-upgrade');product.screen.kumikiBuilt.push('retired-tool');product.exports[0]!.id='retired-custom-icon';old.persistent.products=[product];
    const next=decodeSave(JSON.stringify(old)),archived=next.persistent.products[0]!;
    expect(archived.screen.built).toContain('retired-upgrade');expect(archived.exports[0]!.id).toBe('retired-custom-icon');expect(archived.revenue).toBe(product.revenue);
    assertRetiredStateRemoved(archived);expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('描画の要望と古いファイル参照を使える機能へ移し、完了済みのお礼は再配布しない', () => {
    const old=legacyState();old.run.desktop.feedback=[{id:1,sender:'hikari',kind:'redraw',target:'folder',baseline:[1,2,3],baselineColor:'#000000',at:1,completedAt:null},
      {id:2,sender:'hikari',kind:'practice',target:'document',baseline:[4],baselineColor:'#000000',at:2,completedAt:3,reward:1},
      {id:3,sender:'hikari',kind:'trash',target:'',baseline:[7],baselineColor:'#000000',at:3,completedAt:null},
      {id:4,sender:'hikari',kind:'search',target:'home',baseline:[],baselineColor:'#000000',at:4,completedAt:null}];
    old.run.desktop.feedbackSerial=4;old.run.desktop.fileSelection='sketch';old.run.desktop.photo.source='sketch';old.persistent.desktopPrefs.wallpaper={source:'sketch',brightness:1,tone:0,crop:0};
    const next=decodeSave(JSON.stringify(old));
    expect(next.run.desktop.feedback.map(f=>[f.kind,f.target,f.baseline,f.completedAt,f.reward])).toEqual([['color','primary',[],null,undefined],['color','primary',[],3,1],['trash','',[7],null,undefined],['search','note',[],null,undefined]]);
    expect(next.run.desktop.photo.source).toBe('coast');expect(next.persistent.desktopPrefs.wallpaper).toBeNull();expect(next.run.desktop.fileSelection).toBeNull();
    expect(next.run.advice.seen).toEqual(['editor-produce','desktop-sets']);expect(next.run.advice.current).toBe('editor-produce');expect(next.run.advice.fingerprint).toBe('');
    expect(next.persistent.guideArchive).toEqual([{kind:'kumiki',id:'entered',version:'v0.1'}]);
  });
  it.each(['v0.1','v1'] as const)('旧出荷中の%sを再開し、二重入金なく性能購入と次版の保存に進める', version => {
    const old=legacyState(),product=historicalProduct();old.run.version=version;old.run.world='release';old.run.shipping={productId:1,elapsedMs:0,phase:'store',storeElapsedMs:1_000};
    product.version=version==='v0.1'?'v0.1':'v1.0';old.persistent.products=[product];old.resources.dollars=10_000;
    if(version==='v1')old.persistent.specs.color=1;
    let next=decodeSave(JSON.stringify(old));expect(next.run.shipping).toEqual(old.run.shipping);expect(next.resources.dollars).toBe(10_000);
    next=showShipping(advanceShipping(next,BALANCE.release.storeAnimationMs));next=advanceShipping(next,BALANCE.release.animationMs);next=advanceShipping(next,BALANCE.release.animationMs);
    expect(next.resources.dollars).toBe(10_000);next=decodeSave(encodeSave(next));
    const spec=version==='v0.1'?'color':'refresh';next=buySpec(next,spec);expect(next.persistent.specs[spec]).toBe(1);
    next=startNextVersion(next,3_000);expect(next.run.version).toBe(version==='v0.1'?'v1':'v2');expect(next.run.world).toBe('seed');expect(next.persistent.products).toHaveLength(1);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it.each([0,1,2,3,4] as const)('制作の工程%iと個別設定を新形式で正確に往復できる', step => {
    const state=savedState(),definition=getWorkshopPart('common-button');state.run.workshop.entered=true;state.run.workshop.purchasedSets=['common'];
    const part:PartProduction={step,rect:{...definition.defaultRect},elements:step>=2?[...definition.elements]:[],design:{...createComponentDesign(),radius:3},completedAt:step===4?1_500:null,exportedAt:step===4?1_600:null,tested:step===4};
    state.run.workshop.parts['common-button']=part;state.run.workshop.activePart='common-button';
    const next=decodeSave(encodeSave(state));
    expect(next.resources).toEqual(state.resources);expect(next.run.totalPixelsGenerated).toBe(state.run.totalPixelsGenerated);
    expect(next.run.workshop.parts['common-button']).toEqual(migrateFittingProduction(part,'common-button',state.lastTickAt));
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
});

describe('制作中の配置だけを局所修復する', () => {
  function geometryState(ids: readonly Parameters<typeof getWorkshopPart>[0][]) {
    const state=savedState();state.run.workshop.entered=true;
    state.run.workshop.purchasedSets=[...new Set(ids.map(id=>getWorkshopPart(id).set))];
    for(const id of ids){const d=getWorkshopPart(id);state.run.workshop.parts[id]=migrateFittingProduction({step:4,rect:{...d.defaultRect},elements:[...d.elements],design:createComponentDesign(),tested:true,completedAt:100,exportedAt:200},id,state.lastTickAt);}
    return state;
  }
  it('壊れた一つの座標を直し、財布・他の部品・完成と書き出し記録を変えない', () => {
    const state=geometryState(['common-button','common-heading']);
    const before=structuredClone(state.run.workshop.parts['common-heading']);
    const bad=JSON.parse(encodeSave(state));bad.run.workshop.parts['common-button'].rect.x=-100;
    const next=decodeSave(JSON.stringify(bad));
    expect(isGameState(next)).toBe(true);expect(next.resources).toEqual(state.resources);expect(next.run.totalPixelsGenerated).toBe(state.run.totalPixelsGenerated);
    expect(next.run.workshop.parts['common-heading']).toEqual(before);
    expect(next.run.workshop.parts['common-button']).toMatchObject({step:4,completedAt:100,exportedAt:200,tested:true,design:state.run.workshop.parts['common-button']!.design});
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('重なる一つを空いている位置へ直し、既存の正常な配置は保つ', () => {
    const state=geometryState(['common-button','common-heading']),bad=JSON.parse(encodeSave(state));
    bad.run.workshop.parts['common-heading'].rect=bad.run.workshop.parts['common-button'].rect;
    const next=decodeSave(JSON.stringify(bad));
    expect(isGameState(next)).toBe(true);expect(next.run.workshop.parts['common-button']).toEqual(state.run.workshop.parts['common-button']);
    expect(next.run.workshop.parts['common-heading']!.rect).not.toEqual(next.run.workshop.parts['common-button']!.rect);
    expect(next.resources).toEqual(state.resources);
  });
  it('非数や解像度の格子からずれた座標も、報酬を変えず配置だけを戻す', () => {
    const state=geometryState(['common-button']);
    for(const rect of [{x:null,y:112,width:296,height:80},{x:17,y:113,width:145,height:49}]){
      const bad=JSON.parse(encodeSave(state));bad.run.workshop.parts['common-button'].rect=rect;
      const next=decodeSave(JSON.stringify(bad));expect(isGameState(next)).toBe(true);expect(next.resources).toEqual(state.resources);
      expect(next.run.workshop.parts['common-button']).toMatchObject({step:4,completedAt:100,exportedAt:200,tested:true});
    }
  });
  it('大きい文字の正常な部品をそのまま読み、文字に対して小さすぎる配置だけ広げる', () => {
    const state=geometryState(['common-button']);
    state.run.workshop.parts['common-button']!.design.fontSize=28;
    state.run.workshop.parts['common-button']!.rect={x:16,y:112,width:304,height:104};
    expect(decodeSave(encodeSave(state))).toEqual(state);
    const bad=JSON.parse(JSON.stringify(state));bad.run.workshop.parts['common-button'].rect={x:16,y:112,width:144,height:48};
    const next=decodeSave(JSON.stringify(bad));expect(next.run.workshop.parts['common-button']!.rect.width).toBeGreaterThanOrEqual(288);expect(next.run.workshop.parts['common-button']!.rect.height).toBeGreaterThanOrEqual(96);
    expect(next.run.workshop.parts['common-button']!.design.fontSize).toBe(28);expect(next.resources).toEqual(state.resources);expect(isGameState(next)).toBe(true);
  });
  it('外枠が縮んで子を含まなくなった場合は、外枠だけを戻す', () => {
    const state=geometryState(['common-frame','common-button']),bad=JSON.parse(encodeSave(state));
    bad.run.workshop.parts['common-frame'].rect={x:8,y:8,width:240,height:72};
    const next=decodeSave(JSON.stringify(bad));
    expect(next.run.workshop.parts['common-button']).toEqual(state.run.workshop.parts['common-button']);
    expect(next.run.workshop.parts['common-frame']!.rect).toEqual(getWorkshopPart('common-frame').defaultRect);expect(isGameState(next)).toBe(true);
  });
  it('空きが無ければ当該セットの配置だけを戻し、別セットと制作状態を保つ', () => {
    const state=geometryState(['files-list','files-search','common-button']);
    state.run.workshop.parts['files-list']!.rect={x:8,y:8,width:624,height:400};
    const bad=JSON.parse(JSON.stringify(state));bad.run.workshop.parts['files-search'].rect.x=-1;
    const next=decodeSave(JSON.stringify(bad));
    expect(next.run.workshop.parts['common-button']).toEqual(state.run.workshop.parts['common-button']);
    for(const id of ['files-list','files-search'] as const)expect(next.run.workshop.parts[id]).toMatchObject({step:4,completedAt:100,exportedAt:200,tested:true});
    expect(next.resources).toEqual(state.resources);expect(isGameState(next)).toBe(true);
  });
  it.each(['step','elements','design'] as const)('配置以外の%sの破損を、完成や報酬の救済でごまかさない', field => {
    const state=geometryState(['common-button']),bad=JSON.parse(encodeSave(state));
    bad.run.workshop.parts['common-button'].rect.x=-1;
    if(field==='step')bad.run.workshop.parts['common-button'].step=3;
    if(field==='elements')bad.run.workshop.parts['common-button'].elements=[];
    if(field==='design')bad.run.workshop.parts['common-button'].design.color=bad.run.workshop.parts['common-button'].design.textColor;
    expect(()=>decodeSave(JSON.stringify(bad))).toThrow();
  });
});

describe('保存と読み込み', () => {
  it('保存を作るまでは、保存領域に何も書かない', () => {
    const storage = createMemoryStorage();
    expect(saveGame(storage, createInitialState(1_000), 2_000).kind).toBe('locked');
    expect(loadGame(storage).kind).toBe('empty');
  });

  it('版番号つきの単一データとして往復できる', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    state.persistent.playerName = '作者';
    state.resources.tokens = 3;
    state.persistent.specs.storage = 2;
    const result = saveGame(storage, state, 2_000);
    expect(result.kind).toBe('saved');
    expect(loadGame(storage)).toEqual({ kind: 'loaded', state: { ...state, lastSavedAt: 2_000 } });
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it('正常な前世代を1つ残し、主データが壊れたら復元する', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    saveGame(storage, state, 2_000);
    saveGame(storage, state, 3_000);
    storage.setItem(SAVE_KEYS.primary, '{途中で切れた');
    expect(loadGame(storage)).toEqual({ kind: 'recovered', state: { ...state, lastSavedAt: 2_000 } });
    saveGame(storage, state, 4_000);
    expect(decodeSave(storage.getItem(SAVE_KEYS.backup)! ).lastSavedAt).toBe(2_000);
    expect(loadGame(storage).kind).toBe('loaded');
  });

  it('主データが消えていても予備を見つける', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEYS.backup, encodeSave(savedState()));
    expect(loadGame(storage).kind).toBe('recovered');
  });

  it('両方壊れていたら確認待ちにし、元の文字列を残す', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEYS.primary, '壊れた主データ');
    storage.setItem(SAVE_KEYS.backup, '壊れた予備');
    expect(loadGame(storage).kind).toBe('corrupt');
    expect(storage.getItem(SAVE_KEYS.primary)).toBe('壊れた主データ');
    expect(storage.getItem(SAVE_KEYS.backup)).toBe('壊れた予備');
  });

  it('保存領域へのアクセス拒否を、新規データとは区別する', () => {
    const storage = { ...createMemoryStorage(), getItem() { throw new Error('拒否'); } };
    expect(loadGame(storage).kind).toBe('unavailable');
  });

  it('容量不足でも元のデータと保存時刻を変更しない', () => {
    const storage = createMemoryStorage();
    const state = savedState();
    saveGame(storage, state, 2_000);
    const failed = { ...storage, setItem() { throw new Error('容量不足'); } };
    expect(saveGame(failed, state, 3_000)).toEqual({ kind: 'failed', state });
    expect(decodeSave(storage.getItem(SAVE_KEYS.primary)!).lastSavedAt).toBe(2_000);
  });

  it('今後の版・未対応の旧版を推測で読み込まない', () => {
    expect(() => decodeSave(JSON.stringify({ ...savedState(), schemaVersion: SCHEMA_VERSION + 1 }))).toThrow('新しい版');
    expect(() => decodeSave(JSON.stringify({ ...savedState(), schemaVersion: 0 }))).toThrow('対応していません');
    expect(() => decodeSave('{}')).toThrow();
  });

  it.each([
    (state: ReturnType<typeof savedState>) => { state.resources.pixels = -1; },
    (state: ReturnType<typeof savedState>) => { state.resources.tokens = Infinity; },
    (state: ReturnType<typeof savedState>) => { state.persistent.specs.storage = 99; },
    (state: ReturnType<typeof savedState>) => { state.run.seed.autoCursors = 0.5; },
    (state: ReturnType<typeof savedState>) => { state.run.seed.built.push('save'); },
    (state: ReturnType<typeof savedState>) => { state.resources.pixels = 100; },
  ])('版番号が合っていても不正な内容を受け付けない (%#)', mutate => {
    const state = savedState();
    mutate(state);
    expect(isGameState(state)).toBe(false);
    expect(() => encodeSave(state)).toThrow();
    expect(() => decodeSave(JSON.stringify(state))).toThrow();
  });

  it('明示的な初期化で主データと予備を両方消す', () => {
    const storage = createMemoryStorage();
    saveGame(storage, savedState(), 2_000);
    saveGame(storage, savedState(), 3_000);
    expect(clearGame(storage)).toBe(true);
    expect(loadGame(storage).kind).toBe('empty');
  });
});
