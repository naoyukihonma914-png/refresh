import { editorName } from './appearance';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../content/i18n';
import { createWorkshopTargetState, targetFileEntries, targetMailMessages, targetPhotoFilter, workshopTargetReducer } from '../worlds/workshop/WorkshopTargetContext';
import { BALANCE } from '../config/balance';
import { WORKSHOP_PARTS, getWorkshopPart, type UiSetId, type WorkshopPartId } from '../content/workshopCatalog';
import { FITTING_PARTS, fittingDefinition, fittingPartsForSet } from '../content/workshopFitting';
import { createInitialState, isGameState, type GameState } from './state';
import { actWorkshop, advanceWorkshop, canAssembleDesktop, canBuyWorkshopSet, completedParts, completedSets, enterWorkshop, prototypeConditions } from './workshop';
import { defaultPieceSocket, fittingComplete, pieceReward } from './workshopFitting';
import { adjustComponentDesign, colorContrast, createComponentDesign, createEditorCustomization, effectiveEditorBackground, isComponentDesign, isEditorCustomization, usesNativeComponentColors, usesNativeEditorBackground } from './workshopState';
import { decodeSave, encodeSave } from './save';
import { createSeedVersion } from './seed';
import { beginPrototypeRelease } from './release';
import { paletteFor } from '../content/palette';
import { creditPixels, workshopPartsPixelsPerSecond } from './economy';

const now=1_800_000_000_000;
function workshop():GameState {
 let s=createInitialState(now);delete s.run.workshop.groupPuzzle;s.run.seed.built=BALANCE.w1.items.map(x=>x.id);
 return advanceWorkshop(enterWorkshop(creditPixels(s,10_000_000)),BALANCE.workshop.enterMs);
}
function fit(s:GameState,id:WorkshopPartId,piece:string,socket?:string):GameState {
 s=actWorkshop(s,{type:'spawnPiece',part:id,piece},now);
 const seat=socket??defaultPieceSocket(fittingDefinition(id),s.run.workshop.parts[id]!.fitting!,piece)!;
 return actWorkshop(s,{type:'fitPiece',part:id,piece,socket:seat},now);
}
function complete(s:GameState,id:WorkshopPartId):GameState {
 for(const piece of fittingDefinition(id).pieces)s=fit(s,id,piece);
 return s;
}
function completeSet(s:GameState,set:UiSetId):GameState {
 s=actWorkshop(s,{type:'buySet',set},now);
 for(const part of fittingPartsForSet(set))s=complete(s,part.id);
 return s;
}

describe('殻とピースの工房',()=>{
 it('52 live parts preserve the retired scrollbar only for historical readers',()=>{
  expect(FITTING_PARTS).toHaveLength(52);expect(WORKSHOP_PARTS).toHaveLength(53);
  expect(fittingPartsForSet('common')).toHaveLength(4);
  expect(fittingDefinition('common-frame').pieces).toEqual(['title','minimize','maximize','close','scrollbar']);
  for(const part of FITTING_PARTS)expect(fittingDefinition(part.id).pieces.every(piece=>fittingDefinition(part.id).sockets.some(socket=>socket.accepts.includes(piece)))).toBe(true);
 });
 it('purchase exposes default shells without paying or requiring placement',()=>{
  let s=workshop();const before=s.resources.pixels;s=actWorkshop(s,{type:'buySet',set:'common'},now);
  expect(before-s.resources.pixels).toBe(BALANCE.workshop.setCosts.common);
  expect(s.run.workshop.parts['common-scrollbar']).toBeUndefined();
  for(const part of fittingPartsForSet('common'))expect(s.run.workshop.parts[part.id]).toMatchObject({step:1,rect:part.defaultRect,elements:[],fitting:{sockets:{},spawned:part.id==='common-frame'?[...fittingDefinition(part.id).pieces]:[],paid:[],completionPaid:false}});
  expect(isGameState(s)).toBe(true);
 });
 it('spawning does not fit or pay; a valid drag fits and the last piece completes immediately',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);const wallet=s.resources.pixels;
  expect(actWorkshop(s,{type:'fitPiece',part:'common-button',piece:'label',socket:'label'},now)).toBe(s);
  s=actWorkshop(s,{type:'spawnPiece',part:'common-button',piece:'label'},now);expect(s.resources.pixels).toBe(wallet);expect(s.run.workshop.parts['common-button']!.elements).toEqual([]);
  s=actWorkshop(s,{type:'fitPiece',part:'common-button',piece:'label',socket:'label'},now);
  expect(s.run.workshop.parts['common-button']).toMatchObject({step:4,tested:true,elements:['label'],completedAt:now});
  expect(s.resources.pixels-wallet).toBe(BALANCE.workshop.fitting.pieceRewardTotals.small+BALANCE.workshop.finishRewards.small);
  expect(isGameState(s)).toBe(true);
 });
 it('splits stage total uniformly across pieces and preserves reward multipliers',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);const start=s.resources.pixels;
  s=fit(s,'common-frame','close','control-0');expect(s.resources.pixels-start).toBeCloseTo(pieceReward('common-frame'));
  s=fit(s,'common-frame','title');expect(s.resources.pixels-start).toBeCloseTo(pieceReward('common-frame')*2);
  let efficient=actWorkshop(workshop(),{type:'buySet',set:'common'},now);efficient.persistent.editorSkills=['efficiency'];const before=efficient.resources.pixels;
  efficient=complete(efficient,'common-button');expect(efficient.resources.pixels-before).toBeCloseTo(BALANCE.workshop.fitting.pieceRewardTotals.small*BALANCE.workshop.efficiencyMultiplier+BALANCE.workshop.finishRewards.small);
 });
 it('reversed controls occupy shared seats while function follows piece identity',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
  s=fit(s,'common-frame','close','control-0');s=fit(s,'common-frame','maximize','control-1');s=fit(s,'common-frame','minimize','control-2');
  expect(s.run.workshop.parts['common-frame']!.elements).toEqual(['close','maximize','minimize']);
  const invalid=actWorkshop(s,{type:'spawnPiece',part:'common-frame',piece:'title'},now);
  expect(actWorkshop(invalid,{type:'fitPiece',part:'common-frame',piece:'title',socket:'control-0'},now)).toBe(invalid);
  expect(s.run.workshop.parts['common-frame']!.fitting!.sockets.minimize).toBe('control-2');
 });
 it('supports shared navigation seats and layered unread/read and run/stop states',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'photo'},now);
  s=fit(s,'photo-switch','next','navigation-0');s=fit(s,'photo-switch','previous','navigation-1');expect(s.run.workshop.parts['photo-switch']!.elements).toEqual(['next','previous']);
  for(const [set,id] of [['mail','mail-unread'],['terminal','terminal-run']] as const){
   s.run.workshop.purchasedSets.push(set);const d=getWorkshopPart(id);s.run.workshop.parts[id]={step:0,rect:d.defaultRect,elements:[],design:createComponentDesign(),tested:false,completedAt:null,exportedAt:null};
   for(const piece of fittingDefinition(id).pieces)s=fit(s,id,piece,'state');
   expect(new Set(Object.values(s.run.workshop.parts[id]!.fitting!.sockets))).toEqual(new Set(['state']));expect(fittingComplete(s.run.workshop.parts[id]!,id)).toBe(true);
  }
  expect(isGameState(s)).toBe(true);
 });
 it('removal and reattachment preserve acquired production, timestamps, payments and combo',()=>{
  let s=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');s=actWorkshop(s,{type:'export'},now);
  const before=structuredClone(s),rate=workshopPartsPixelsPerSecond(s);
  s=actWorkshop(s,{type:'removePiece',part:'common-button',piece:'label'},now+1);
  expect(s.run.workshop.parts['common-button']).toMatchObject({step:4,elements:[],completedAt:now,exportedAt:now});expect(workshopPartsPixelsPerSecond(s)).toBe(rate);
  s=fit(s,'common-button','label');expect(s.resources).toEqual(before.resources);expect(s.run.workshop.combo).toEqual(before.run.workshop.combo);expect(s.run.workshop.parts['common-button']!.completedAt).toBe(now);
  expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('appearance is optional before completion, on completion and with hints disabled',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);s.persistent.examplesEnabled=false;const before=s.resources.pixels;
  s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:8}},now);expect(s.run.workshop.parts['common-button']!.design.radius).toBe(8);
  s=actWorkshop(s,{type:'useExample',part:'common-button'},now);expect(s.run.workshop.parts['common-button']!.design).toEqual(createComponentDesign());expect(s.resources.pixels).toBe(before);
  const d=getWorkshopPart('common-button');expect(actWorkshop(s,{type:'place',part:d.id,rect:{...d.defaultRect,x:d.defaultRect.x+8}},now)).toBe(s);
 });
 it('all52 parts complete and serialize using only fitting gestures',()=>{
  let s=workshop();s.run.world='desktop';s.run.desktop.entered=true;s.run.version='v2';s.persistent.editorSkills=['extraParts'];
  for(const set of ['common','foundation','files','mail','photo','bin','clock','theme','terminal','manager','extras','stream'] as const)s=completeSet(s,set);
  expect(completedParts(s)).toHaveLength(52);expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('mainline gates and the color requirement remain tied to acquired sets',()=>{
  let s=workshop();expect(canBuyWorkshopSet(s,'files')).toBe(false);expect(canBuyWorkshopSet(s,'clock')).toBe(true);
  for(const set of ['common','foundation','files','mail'] as const)s=completeSet(s,set);
  expect(completedSets(s)).toEqual(['common','foundation','files','mail']);expect(canAssembleDesktop(s)).toBe(false);s.persistent.specs.color=1;expect(canAssembleDesktop(s)).toBe(true);
 });
 it('exports once and snapshots completed live sets with four common parts',()=>{
  let s=completeSet(workshop(),'common');expect(prototypeConditions(s)).toEqual([true,true,false]);expect(s.persistent.setDocuments[0]!.parts['common-scrollbar']).toBeUndefined();
  s=actWorkshop(s,{type:'export'},now);expect(s.resources.tokens).toBe(4*BALANCE.workshop.exportTokens+BALANCE.workshop.updateGrantTokens);expect(actWorkshop(s,{type:'export'},now)).toBe(s);
  const copy=structuredClone(s.persistent.setDocuments[0]!);s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:8}},now+1);
  expect(copy.parts['common-button']!.design.radius).not.toBe(8);expect(s.persistent.setDocuments[0]!.parts['common-button']!.design.radius).toBe(8);expect(isGameState(s)).toBe(true);
 });
 it('changes current documents without rewriting released works or old version documents',()=>{
  let previous=workshop();for(const set of ['common','foundation','files','mail'] as const)previous=completeSet(previous,set);
  previous=actWorkshop(previous,{type:'export'},now+10);previous=actWorkshop(previous,{type:'exit'},now+20);
  const released=beginPrototypeRelease(previous,now+30);expect(released.persistent.products).toHaveLength(1);
  let s=createSeedVersion(released,'v1',now+40);delete s.run.workshop.groupPuzzle;s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000_000)),BALANCE.workshop.enterMs);s=completeSet(s,'common');
  const old=s.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')!,copy=structuredClone(old),product=structuredClone(s.persistent.products[0]);
  s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:8}},now+50);expect(old).toEqual(copy);expect(s.persistent.products[0]).toEqual(product);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('rejects unreadable text, unavailable palette colors and locked motion without payment',()=>{
  let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
  for(const patch of [{textColor:s.run.workshop.parts['common-button']!.design.color},{color:'#112233'},{motion:'smooth' as const}])expect(actWorkshop(s,{type:'adjust',part:'common-button',patch},now)).toBe(s);
  s.persistent.specs.color=2;expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{color:'#112233'}},now)).not.toBe(s);
 });
 it('keeps editor preference validation independent of fitting progress',()=>{
  let s=workshop();s=actWorkshop(s,{type:'customize',patch:{grid:false,panelWidth:320,gridSpacing:16}},now);
  expect(s.persistent.editorCustomization).toMatchObject({grid:false,panelWidth:320,gridSpacing:16});expect(actWorkshop(s,{type:'customize',patch:{panelWidth:10000}},now)).toBe(s);expect(isEditorCustomization(s.persistent.editorCustomization)).toBe(true);
 });
  it('写真の明るさ・色味・切替・壁紙は同じ画像を更新し、適用した壁紙は編集時点を保つ',()=>{
    let target=createWorkshopTargetState();
    target=workshopTargetReducer(target,{type:'photo-value',key:'brightness',value:75});
    target=workshopTargetReducer(target,{type:'photo-value',key:'tone',value:25});
    expect(targetPhotoFilter(target.photo)).toContain('brightness(1.5)');
    target=workshopTargetReducer(target,{type:'photo-next',delta:1});expect(target.photo.index).toBe(1);
    target=workshopTargetReducer(target,{type:'photo-wallpaper'});const applied=target.photo.wallpaper;
    expect(applied).toMatchObject({index:1,brightness:75,tone:25});
    target=workshopTargetReducer(target,{type:'photo-value',key:'brightness',value:100});
    expect(target.photo.wallpaper).toBe(applied);expect(applied!.brightness).toBe(75);
    target=workshopTargetReducer(target,{type:'photo-compare'});expect(target.photo.compare).toBe(true);expect(target.photo.brightness).toBe(100);
  });
  it('ファイルは完成セット書類と最初からある制作ノートを使い、検索・並替・戻るの状態を共有する',()=>{
    const i18n=createI18n('ja');let s=workshop();expect(targetFileEntries(s,i18n)).toMatchObject([{id:'note',type:'note',name:i18n.t('desktop.app.note')}]);
    s=completeSet(s,'common');const entries=targetFileEntries(s,i18n);
    expect(entries.filter(entry=>entry.type==='set')).toHaveLength(1);expect(entries.filter(entry=>entry.type==='part')).toHaveLength(0);
    expect(entries.find(entry=>entry.id==='set:v0.1:common')!.set).toBe('common');expect(entries.find(entry=>entry.id==='note')).toBeDefined();
    let target=createWorkshopTargetState();target=workshopTargetReducer(target,{type:'file-query',query:entries[0]!.name});
    target=workshopTargetReducer(target,{type:'file-sort',key:'date'});expect(target.files).toMatchObject({query:entries[0]!.name,sort:'date',ascending:true});
    target=workshopTargetReducer(target,{type:'file-folder',folder:'sets'});target=workshopTargetReducer(target,{type:'file-back'});
    expect(target.files.folder).toBe('all');expect(target.files.history).toEqual([]);
  });
  it('メールは実ガイドの同じ一覧・本文・既読・フォルダ・返信下書きを使う',()=>{
    const s=workshop(),messages=targetMailMessages(s,createI18n('ja'));expect(messages[0]!.id).toBe('guide:entered');
    expect(messages[0]!.body).toBe(createI18n('ja').t('ws.guide.entered',{app:editorName(s,createI18n('ja'))}));
    let target=createWorkshopTargetState();target=workshopTargetReducer(target,{type:'mail-select',id:messages[0]!.id});
    target=workshopTargetReducer(target,{type:'mail-reply',open:true});target=workshopTargetReducer(target,{type:'mail-draft',draft:'返信文'});
    expect(target.mail).toMatchObject({selectedId:messages[0]!.id,readIds:[messages[0]!.id],replyOpen:true,draft:'返信文'});
    target=workshopTargetReducer(target,{type:'mail-archive',id:messages[0]!.id,archive:true});expect(target.mail.archivedIds).toContain(messages[0]!.id);expect(target.mail.draft).toBe('返信文');
  });
});

it('工房のごみ箱は同じファイル行を移し、復元・空にする・取り消しも同じデータへ戻す',()=>{
 const s=completeSet(workshop(),'common'),entry=targetFileEntries(s,createI18n('ja'))[0]!;let target=createWorkshopTargetState();
 target=workshopTargetReducer(target,{type:'file-select',id:entry.id});target=workshopTargetReducer(target,{type:'trash-file',id:entry.id});
 expect(target.trash.ids).toEqual([entry.id]);expect(target.files.selectedId).toBeNull();
 target=workshopTargetReducer(target,{type:'trash-empty'});expect(target.trash.deletedIds).toEqual([entry.id]);expect(target.trash.ids).toEqual([]);
 target=workshopTargetReducer(target,{type:'trash-undo-empty'});expect(target.trash.ids).toEqual([entry.id]);expect(target.trash.deletedIds).toEqual([]);
 target=workshopTargetReducer(target,{type:'trash-restore',id:entry.id});expect(target.trash.ids).toEqual([]);expect(target.files.selectedId).toBe(entry.id);
});


describe('工房：標準材質と明示的な配色',()=>{
 it('標準色フラグは明示値を優先し、旧schema14の省略時は以前の色差推定を保つ',()=>{
  const design=createComponentDesign();expect(design.nativeColors).toBe(true);expect(usesNativeComponentColors(design)).toBe(true);
  const legacy={...design};delete legacy.nativeColors;expect(usesNativeComponentColors(legacy)).toBe(true);
  expect(usesNativeComponentColors({...legacy,color:'#101018'})).toBe(false);
  expect(usesNativeComponentColors({...design,nativeColors:false})).toBe(false);
  const custom=createEditorCustomization();expect(custom.nativeBackground).toBe(true);expect(usesNativeEditorBackground(custom)).toBe(true);
  const old={...custom};delete old.nativeBackground;expect(usesNativeEditorBackground(old)).toBe(true);expect(usesNativeEditorBackground({...old,background:'#101018'})).toBe(false);
  for(const stage of [0,1,2] as const)expect(effectiveEditorBackground(custom,stage)).toBe(BALANCE.workshop.customization.nativeBackgrounds[stage]);
  expect(effectiveEditorBackground({...custom,nativeBackground:false},0)).toBe(custom.background);
 });
 it('背景色変更は文字と記号を一度に読みやすくし、白地黒文字へ移れる',()=>{
  let s=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-frame');s.persistent.specs.color=1;
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{controlColors:{close:'#f6d27a'}}},now);
  const resources=s.resources,total=s.run.totalPixelsGenerated;
  s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{color:'#ffffff'}},now);
  const design=s.run.workshop.parts['common-frame']!.design;
  expect(design).toMatchObject({nativeColors:false,color:'#ffffff',textColor:'#000000',controlColors:{}});
  expect(colorContrast(design.color,design.textColor)).toBeGreaterThanOrEqual(BALANCE.workshop.design.minContrast);
  expect(s.resources).toBe(resources);expect(s.run.totalPixelsGenerated).toBe(total);expect(isGameState(s)).toBe(true);
  const reset=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{nativeColors:true}},now);
  expect(reset.run.workshop.parts['common-frame']!.design).toMatchObject({nativeColors:true,color:BALANCE.workshop.design.color,textColor:BALANCE.workshop.design.textColor,controlColors:{}});
  expect(reset.resources).toBe(resources);
 });
 it('標準のタイトル帯と記号ごとの色は独立し、帯の背景を明示した時だけ標準色を離れる',()=>{
  const defaults=createComponentDesign(),symbols=adjustComponentDesign(defaults,{controlColors:{close:'#f6d27a'}},paletteFor(1))!;
  expect(symbols).toMatchObject({nativeColors:true,color:defaults.color,textColor:defaults.textColor,controlColors:{close:'#f6d27a'}});
  expect(usesNativeComponentColors(symbols)).toBe(true);
  const customBand=adjustComponentDesign(symbols,{color:'#ffffff'},paletteFor(1))!;
  expect(customBand).toMatchObject({nativeColors:false,color:'#ffffff',textColor:'#000000',controlColors:{}});
  const legacy={...defaults};delete legacy.nativeColors;
  const oldSymbols=adjustComponentDesign(legacy,{controlColors:{close:'#f6d27a'}},paletteFor(1))!;
  expect(oldSymbols.nativeColors).toBeUndefined();expect(usesNativeComponentColors(oldSymbols)).toBe(false);
  const reset=adjustComponentDesign(symbols,{nativeColors:true},paletteFor(1))!;
  expect(reset.controlColors).toEqual({});expect(usesNativeComponentColors(reset)).toBe(true);
 });
 it('配色の純粋helperは入力を変更せず、標準と同じ色の明示選択も保存できる',()=>{
  const original=createComponentDesign(),copy=structuredClone(original);
  const explicit=adjustComponentDesign(original,{color:BALANCE.workshop.design.color},paletteFor(0));
  expect(original).toEqual(copy);expect(explicit!.nativeColors).toBe(false);expect(usesNativeComponentColors(explicit!)).toBe(false);expect(isComponentDesign(explicit)).toBe(true);
  expect(adjustComponentDesign(original,{textColor:original.color},paletteFor(0))).toBeNull();
 });
 it('背景の明示選択と標準復帰は同じ保存色でも区別し、旧flags省略を読み込める',()=>{
  let s=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
  s=actWorkshop(s,{type:'customize',patch:{background:BALANCE.workshop.customization.background}},now);
  expect(s.persistent.editorCustomization.nativeBackground).toBe(false);
  expect(effectiveEditorBackground(s.persistent.editorCustomization,1)).toBe(BALANCE.workshop.customization.background);
  s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{color:BALANCE.workshop.design.color}},now);
  expect(decodeSave(encodeSave(s))).toEqual(s);
  s=actWorkshop(s,{type:'customize',patch:{nativeBackground:true}},now);
  expect(effectiveEditorBackground(s.persistent.editorCustomization,1)).toBe(BALANCE.workshop.customization.nativeBackgrounds[1]);
  const old=structuredClone(s);delete old.persistent.editorCustomization.nativeBackground;for(const part of Object.values(old.run.workshop.parts))if(part)delete part.design.nativeColors;
  expect(decodeSave(JSON.stringify(old))).toEqual(old);
  const invalid=JSON.parse(encodeSave(s));invalid.run.workshop.parts['common-button'].design.nativeColors='yes';expect(()=>decodeSave(JSON.stringify(invalid))).toThrow();
  const badBackground=JSON.parse(encodeSave(s));badBackground.persistent.editorCustomization.nativeBackground=1;expect(()=>decodeSave(JSON.stringify(badBackground))).toThrow();
 });
});
