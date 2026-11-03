import { editorName } from './appearance';
import { describe, expect, it } from 'vitest';
import { createI18n } from '../content/i18n';
import { createWorkshopTargetState, targetFileEntries, targetMailMessages, targetPhotoFilter, workshopTargetReducer } from '../worlds/workshop/WorkshopTargetContext';
import { BALANCE } from '../config/balance';
import { UI_SETS, WORKSHOP_PARTS, getWorkshopPart, partsForSet, type UiSetId, type WorkshopPartId } from '../content/workshopCatalog';
import { createInitialState, isGameState, type GameState } from './state';
import { actWorkshop, advanceWorkshop, canAssembleDesktop, canBuyWorkshopSet, completedParts, completedSets, defaultComponentDesign, enterWorkshop, normalizeWorkshopRect, partRectValid, partMinimumSize, prototypeConditions, workshopPlacementGrid } from './workshop';
import { adjustComponentDesign, colorContrast, createComponentDesign, createEditorCustomization, effectiveEditorBackground, isComponentDesign, isEditorCustomization, isWorkshopState, usesNativeComponentColors, usesNativeEditorBackground } from './workshopState';
import { decodeSave, encodeSave } from './save';
import { createSeedVersion } from './seed';
import { beginPrototypeRelease } from './release';
import { paletteFor } from '../content/palette';
import { workshopComboMultiplier } from './workshopExamples';
import { creditPixels, cursorPixelsPerSecond, manualClickValue, passivePixelsPerSecond, seedPartsPixelsPerSecond, workshopPartsPixelsPerSecond } from './economy';

const now=1_800_000_000_000;
function workshop():GameState {
  let s=createInitialState(now);s.run.seed.built=BALANCE.w1.items.map(x=>x.id);s.run.seed.page.fitted=['pixels','generator','heading','notice','upgrades','cursors'];
  s=creditPixels(s,10_000_000);return advanceWorkshop(enterWorkshop(s),BALANCE.workshop.enterMs);
}
function complete(s:GameState,id:WorkshopPartId):GameState {
  const part=getWorkshopPart(id);
  s=actWorkshop(s,{type:'selectPart',part:id},now);
  s=actWorkshop(s,{type:'place',part:id,rect:part.defaultRect},now);
  for(const element of part.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
  s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);
  return actWorkshop(s,{type:'test',part:id,interaction:part.testInteraction},now);
}
function completeSet(s:GameState,set:UiSetId):GameState {
  s=actWorkshop(s,{type:'buySet',set},now);
  for(const part of partsForSet(set))s=complete(s,part.id);
  return s;
}

describe('第3版：工房の制作と経済',()=>{
  it('46部品は本線21と任意25、2つのプラグインは別枠で個別の毎秒を持つ',()=>{
    expect(WORKSHOP_PARTS.filter(p=>p.set!=='extras'&&p.set!=='stream')).toHaveLength(46);
    expect(WORKSHOP_PARTS.filter(p=>['common','foundation','files','mail'].includes(p.set))).toHaveLength(21);
    expect(WORKSHOP_PARTS.filter(p=>p.set==='extras')).toHaveLength(2);
    expect(new Set(WORKSHOP_PARTS.map(p=>p.id)).size).toBe(52);expect(WORKSHOP_PARTS.filter(p=>p.set==='stream')).toHaveLength(4);
    expect(new Set(Object.values(BALANCE.workshop.partRates)).size).toBeGreaterThan(10);
  });
  it('未来用4つを含む52部品すべての標準配置は同時に置いても最小寸法・刻み・包含・非重複を満たす',()=>{
    const s=workshop();s.run.version='v2';s.run.world='desktop';s.run.desktop.entered=true;s.persistent.specs.color=1;s.persistent.editorSkills=['extraParts'];s.run.workshop.purchasedSets=UI_SETS.map(set=>set.id);
    for(const definition of WORKSHOP_PARTS)s.run.workshop.parts[definition.id]={step:1,rect:{...definition.defaultRect},elements:[],design:defaultComponentDesign(s),completedAt:null,exportedAt:null,tested:false};
    for(const definition of WORKSHOP_PARTS){const min=partMinimumSize(s,definition.id);expect(definition.defaultRect.width).toBeGreaterThanOrEqual(min.width);expect(definition.defaultRect.height).toBeGreaterThanOrEqual(min.height);expect(partRectValid(s,definition.id,definition.defaultRect)).toBe(true);}
    expect(isGameState(s)).toBe(true);
  });
  it('最後のエディタ部品から同じ画面が起動し、待ち時間に購入しても完成品は付かない',()=>{
    let s=createInitialState(now);s=creditPixels(s,10_000);
    const entered=enterWorkshop(s);expect(entered.run.world).toBe('kumiki');expect(entered.run.workshop.enterMs).toBe(BALANCE.workshop.enterMs);
    expect(entered.run.workshop.parts).toEqual({});expect(actWorkshop(entered,{type:'buySet',set:'common'},now)).toBe(entered);
    s=advanceWorkshop(entered,BALANCE.workshop.enterMs);const before=s.resources.pixels;
    s=actWorkshop(s,{type:'buySet',set:'common'},now);expect(before-s.resources.pixels).toBe(BALANCE.workshop.setCosts.common);
    expect(completedParts(s)).toEqual([]);expect(Object.values(s.run.workshop.parts).every(p=>p?.step===0)).toBe(true);expect(isGameState(s)).toBe(true);
  });
  it('本線は前のセット完成が必要、時計などの任意セットは最初から買える',()=>{
    let s=workshop();expect(canBuyWorkshopSet(s,'files')).toBe(false);expect(canBuyWorkshopSet(s,'clock')).toBe(true);
    expect(actWorkshop(s,{type:'buySet',set:'foundation'},now)).toBe(s);
    s=completeSet(s,'common');expect(canBuyWorkshopSet(s,'foundation')).toBe(true);
    expect(actWorkshop(s,{type:'buySet',set:'common'},now)).toBe(s);
  });
  it('4工程だけで各定額と完成一括が入り、同じ操作を繰り返しても二重に支払わない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);const id='common-button',d=getWorkshopPart(id),r=BALANCE.workshop.categoryStepRewards.small;
    const start=s.resources.pixels;
    s=actWorkshop(s,{type:'place',part:id,rect:d.defaultRect},now);expect(s.resources.pixels-start).toBe(r[0]);
    expect(actWorkshop(s,{type:'confirmAdjustment',part:id},now)).toBe(s);
    const afterPlace=s.resources.pixels;s=actWorkshop(s,{type:'place',part:id,rect:{...d.defaultRect,width:288}},now);expect(s.resources.pixels).toBe(afterPlace);
    for(const element of d.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
    expect(s.resources.pixels-start).toBe(r[0]+r[1]);
    s=actWorkshop(s,{type:'addElement',part:id,element:d.elements[0]!},now);expect(s.resources.pixels-start).toBe(r[0]+r[1]);
    s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);expect(s.resources.pixels-start).toBe(r[0]+r[1]+r[2]);
    expect(actWorkshop(s,{type:'test',part:id,interaction:'scroll'},now)).toBe(s);
    s=actWorkshop(s,{type:'test',part:id,interaction:d.testInteraction},now);expect(s.resources.pixels-start).toBe(r.reduce((a,b)=>a+b,0)+BALANCE.workshop.finishRewards.small);
    expect(actWorkshop(s,{type:'test',part:id,interaction:d.testInteraction},now)).toBe(s);
    expect(actWorkshop(s,{type:'confirmAdjustment',part:id},now)).toBe(s);expect(isGameState(s)).toBe(true);
  });
  it('大きさや装飾で工程・完成の報酬が変わらない',()=>{
    let a=actWorkshop(workshop(),{type:'buySet',set:'common'},now),b=structuredClone(a);
    a=complete(a,'common-button');const d=getWorkshopPart('common-button');
    b=actWorkshop(b,{type:'place',part:d.id,rect:{...d.defaultRect,width:144,height:48}},now);
    for(const element of d.elements)b=actWorkshop(b,{type:'addElement',part:d.id,element},now);
    b=actWorkshop(b,{type:'adjust',part:d.id,patch:{radius:12,shadow:true}},now);
    b=actWorkshop(b,{type:'confirmAdjustment',part:d.id},now);b=actWorkshop(b,{type:'test',part:d.id,interaction:d.testInteraction},now);
    expect(a.resources).toEqual(b.resources);expect(workshopPartsPixelsPerSecond(a)).toBe(workshopPartsPixelsPerSecond(b));
  });
  it('個別部品は完成するまで毎秒を生まず、完成後に自分の値だけが増える',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);expect(workshopPartsPixelsPerSecond(s)).toBe(0);
    s=complete(s,'common-frame');expect(workshopPartsPixelsPerSecond(s)).toBe(BALANCE.workshop.partRates['common-frame']);
    s=complete(s,'common-button');expect(workshopPartsPixelsPerSecond(s)).toBe(BALANCE.workshop.partRates['common-frame']+BALANCE.workshop.partRates['common-button']);
  });
  it('色深度と実績の全生成倍率は工程にも完成にも一回ずつ効く',()=>{
    let base=actWorkshop(workshop(),{type:'buySet',set:'common'},now),boost=structuredClone(base);
    boost.persistent.specs.color=1;boost.persistent.progress.records['first-pixel']=now;
    const initial=base.resources.pixels,bi=boost.resources.pixels;base=complete(base,'common-button');boost=complete(boost,'common-button');
    expect(boost.resources.pixels-bi).toBeCloseTo((base.resources.pixels-initial)*BALANCE.spec.color[1].multiplier*(1+BALANCE.longPlay.achievementBonus));
    expect(workshopPartsPixelsPerSecond(boost)).toBeCloseTo(workshopPartsPixelsPerSecond(base)*BALANCE.spec.color[1].multiplier*(1+BALANCE.longPlay.achievementBonus));
  });
  it('枠記号を並べ替え、記号ごと左右・色を選んでも払いは重ならない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);s=complete(s,'common-frame');const pixels=s.resources.pixels;
    s=actWorkshop(s,{type:'addElement',part:'common-frame',element:'close',index:0,side:'start'},now);
    s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{controlColors:{close:'#f6d27a'},symbolShape:'square',titleAlign:'center'}},now);
    expect(s.run.workshop.parts['common-frame']!.elements[0]).toBe('close');expect(s.run.workshop.parts['common-frame']!.design.controlSides.close).toBe('start');
    expect(s.run.workshop.parts['common-frame']!.design.controlColors.close).toBe('#f6d27a');expect(s.resources.pixels).toBe(pixels);
  });
  it('窓枠は内容を内包し、兄弟の重なり・画面外・小さすぎる土台を拒む',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);s=complete(s,'common-frame');s=complete(s,'common-button');const rect=getWorkshopPart('common-button').defaultRect;
    expect(partRectValid(s,'common-heading',rect)).toBe(false);
    expect(actWorkshop(s,{type:'place',part:'common-heading',rect},now)).toBe(s);
    expect(partRectValid(s,'common-heading',{...getWorkshopPart('common-heading').defaultRect,x:-1})).toBe(false);
    expect(partRectValid(s,'common-heading',{...getWorkshopPart('common-heading').defaultRect,width:1})).toBe(false);
    expect(partRectValid(s,'common-frame',{...rect,width:144})).toBe(false);
    s=actWorkshop(s,{type:'buySet',set:'clock'},now);expect(partRectValid(s,'clock-time',{...rect,height:80})).toBe(true);
    const invalid=structuredClone(s);invalid.run.workshop.parts['common-heading']!.step=1;invalid.run.workshop.parts['common-heading']!.rect=rect;expect(isWorkshopState(invalid.run.workshop)).toBe(false);
  });
  it('文字だけを読めない色へ変えること・パレット外の色・未解放の動きを拒む',()=>{
    let s=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
    expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{textColor:s.run.workshop.parts['common-button']!.design.color}},now)).toBe(s);
    expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{color:'#112233'}},now)).toBe(s);
    expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{motion:'smooth'}},now)).toBe(s);
    s.persistent.specs.color=2;expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{color:'#112233'}},now)).not.toBe(s);
  });
  it('一回だけエクスポートしてトークンと凍結書類を作り、再エクスポートで損得を変えない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);expect(prototypeConditions(s)).toEqual([true,false,false]);
    for(const id of ['common-frame','common-button','common-heading'] as const)s=complete(s,id);
    expect(prototypeConditions(s)).toEqual([true,true,false]);const before=s.resources.tokens;
    s=actWorkshop(s,{type:'export'},now);expect(s.resources.tokens-before).toBe(3);expect(prototypeConditions(s)).toEqual([true,true,true]);
    expect(s.run.workshop.tokenDiscovered).toBe(true);expect(s.persistent.setDocuments).toHaveLength(1);
    const document=structuredClone(s.persistent.setDocuments[0]);s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:12}},now);
    expect(s.persistent.setDocuments[0]).toEqual(document);expect(actWorkshop(s,{type:'export'},now)).toBe(s);expect(isGameState(s)).toBe(true);
  });
  it('セットは完成した時点で書類になり、あとから書き出しても同じ書類を更新する',()=>{
    let s=completeSet(workshop(),'common');expect(s.persistent.setDocuments).toHaveLength(1);expect(completedSets(s)).toEqual(['common']);
    expect(Object.values(s.persistent.setDocuments[0]!.parts)).toHaveLength(4);
    s=actWorkshop(s,{type:'export'},now);expect(s.persistent.setDocuments).toHaveLength(1);
    expect(Object.values(s.persistent.setDocuments[0]!.parts).every(p=>p!.exportedAt===now)).toBe(true);
  });
  it('現在版の完成セット書類は仕上げ後の調整・配置・並びに追随し、報酬と制作時刻は変わらない',()=>{
    let s=completeSet(workshop(),'common');s.persistent.specs.color=1;s=actWorkshop(s,{type:'export'},now+10);
    const before=s,frozen=structuredClone(s),original=s.persistent.setDocuments[0]!,wallet=s.resources,total=s.run.totalPixelsGenerated;
    const productionTimes=Object.fromEntries(Object.entries(s.run.workshop.parts).map(([id,p])=>[id,{completedAt:p!.completedAt,exportedAt:p!.exportedAt}]));
    s=actWorkshop(s,{type:'adjust',part:'common-frame',patch:{color:'#ffffff'}},now+20);
    let current=s.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')!;
    expect(current.parts['common-frame']!.design).toEqual(s.run.workshop.parts['common-frame']!.design);
    expect(current.parts['common-frame']!.design).not.toBe(s.run.workshop.parts['common-frame']!.design);
    const rect={...s.run.workshop.parts['common-button']!.rect,x:s.run.workshop.parts['common-button']!.rect.x+8};
    s=actWorkshop(s,{type:'place',part:'common-button',rect},now+30);
    current=s.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')!;expect(current.parts['common-button']!.rect).toEqual(rect);
    s=actWorkshop(s,{type:'addElement',part:'common-frame',element:'close',index:0,side:'start'},now+40);
    current=s.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')!;
    expect(current.parts['common-frame']!.elements[0]).toBe('close');expect(current.parts['common-frame']!.design.controlSides.close).toBe('start');
    expect(current.at).toBe(original.at);expect(current).not.toBe(original);expect(before).toEqual(frozen);
    expect(s.resources).toBe(wallet);expect(s.run.totalPixelsGenerated).toBe(total);
    for(const [id,p] of Object.entries(s.run.workshop.parts))expect({completedAt:p!.completedAt,exportedAt:p!.exportedAt}).toEqual(productionTimes[id]);
    expect(actWorkshop(s,{type:'export'},now+50)).toBe(s);expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it('現在版の書類を直しても過去版の書類と出荷済み製品の記録は凍結したまま',()=>{
    let previous=workshop();for(const set of ['common','foundation','files','mail'] as const)previous=completeSet(previous,set);
    previous=actWorkshop(previous,{type:'export'},now+10);previous=actWorkshop(previous,{type:'exit'},now+20);
    const released=beginPrototypeRelease(previous,now+30);expect(released.persistent.products).toHaveLength(1);
    let s=createSeedVersion(released,'v1',now+40);s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s=advanceWorkshop(enterWorkshop(creditPixels(s,10_000_000)),BALANCE.workshop.enterMs);
    s=completeSet(s,'common');s=actWorkshop(s,{type:'export'},now+50);
    const oldSet=s.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')!,oldCopy=structuredClone(oldSet),product=s.persistent.products[0]!,productCopy=structuredClone(product),products=s.persistent.products;
    const current=s.persistent.setDocuments.find(entry=>entry.id==='v1:common')!,currentCopy=structuredClone(current);
    const next=actWorkshop(s,{type:'adjust',part:'common-button',patch:{radius:12}},now+60);
    expect(next.persistent.setDocuments.find(entry=>entry.id==='v1:common')!.parts['common-button']!.design.radius).toBe(12);
    expect(s.persistent.setDocuments.find(entry=>entry.id==='v1:common')).toEqual(currentCopy);
    expect(next.persistent.setDocuments.find(entry=>entry.id==='v0.1:common')).toBe(oldSet);expect(oldSet).toEqual(oldCopy);
    expect(next.persistent.products).toBe(products);expect(product).toEqual(productCopy);expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it('全46部品を固有の実操作で仕上げ、写真7つも完成・保存できる',()=>{
    let s=workshop();for(const set of ['common','foundation','files','mail','photo','bin','clock','theme','terminal','manager'] as const){s=actWorkshop(s,{type:'buySet',set},now);expect(isGameState(s)).toBe(true);for(const part of partsForSet(set))s=complete(s,part.id);}
    expect(completedParts(s)).toHaveLength(46);expect(completedSets(s)).toHaveLength(10);expect(s.persistent.setDocuments).toHaveLength(10);
    expect(partsForSet('photo').every(p=>s.run.workshop.parts[p.id]!.tested)).toBe(true);expect(isGameState(s)).toBe(true);
  });
  it('出口は必須セット・200000ピクセル・256色を満たすまで開かず、確認は状態だけを残す',()=>{
    let s=workshop();for(const set of ['common','foundation','files','mail'] as const)s=completeSet(s,set);
    expect(canAssembleDesktop(s)).toBe(false);s=actWorkshop(s,{type:'exit'},now);expect(s.run.workshop.exitInspected).toBe(true);expect(s.run.world).toBe('kumiki');
    s.persistent.specs.color=1;expect(canAssembleDesktop(s)).toBe(true);s.resources.pixels=BALANCE.w2.desktopCost-1;expect(canAssembleDesktop(s)).toBe(false);
  });
  it('初期段で7つのエディタ設定を変えられ、範囲外の幅や間隔では作業台を隠せない',()=>{
    let s=workshop();s=actWorkshop(s,{type:'customize',patch:{accent:'#e8a317',bandPosition:'bottom',panelWidth:320,background:'#101018',grid:false,gridSpacing:16,fontSize:16}},now);
    expect(s.persistent.editorCustomization).toMatchObject({accent:'#e8a317',bandPosition:'bottom',panelWidth:320,background:'#101018',grid:false,gridSpacing:16,fontSize:16});
    expect(actWorkshop(s,{type:'customize',patch:{panelWidth:10_000}},now)).toBe(s);expect(actWorkshop(s,{type:'customize',patch:{gridSpacing:0}},now)).toBe(s);
    expect(actWorkshop(s,{type:'customize',patch:{docking:'left'}},now)).toBe(s);
    s=actWorkshop(s,{type:'customize',patch:createEditorCustomization()},now);expect(s.persistent.editorCustomization).toEqual(createEditorCustomization());expect(isEditorCustomization(s.persistent.editorCustomization)).toBe(true);
  });
  it('制作の手際は工程だけを増やし、仕上げの一括払いと毎秒を増やさない',()=>{
    let a=actWorkshop(workshop(),{type:'buySet',set:'common'},now),b=structuredClone(a);b.persistent.editorSkills=['efficiency'];
    const before=a.resources.pixels;a=complete(a,'common-button');b=complete(b,'common-button');
    const steps=BALANCE.workshop.categoryStepRewards.small.reduce((x,y)=>x+y,0);
    expect(b.resources.pixels-before).toBeCloseTo(steps*BALANCE.workshop.efficiencyMultiplier+BALANCE.workshop.finishRewards.small);
    expect(workshopPartsPixelsPerSecond(a)).toBe(workshopPartsPixelsPerSecond(b));
  });
  it('種の部品と自動カーソルの数式を分け、倍率を重ねて二重に掛けない',()=>{
    let s=workshop();s.run.seed.autoCursors=2;s.persistent.specs.color=1;s.persistent.specs.refresh=1;
    const seedBase=BALANCE.w1.items.reduce((n,p)=>n+p.perSecond,0);
    expect(seedPartsPixelsPerSecond(s)).toBeCloseTo(seedBase*BALANCE.spec.color[1].multiplier);
    expect(cursorPixelsPerSecond(s)).toBeCloseTo(manualClickValue(s)*BALANCE.w1.cursor_press_per_sec*BALANCE.w1.color_cursor_mult*BALANCE.spec.refresh[1].multiplier);
    expect(passivePixelsPerSecond(s)).toBeCloseTo(seedPartsPixelsPerSecond(s)+2*cursorPixelsPerSecond(s));
  });
  it('完成後の部品が大きすぎても配置を直せ、工程・毎秒・書き出し報酬は重ならない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
    s=actWorkshop(s,{type:'place',part:'common-button',rect:{x:8,y:8,width:624,height:400}},now);
    for(const element of getWorkshopPart('common-button').elements)s=actWorkshop(s,{type:'addElement',part:'common-button',element},now);
    s=actWorkshop(s,{type:'confirmAdjustment',part:'common-button'},now);s=actWorkshop(s,{type:'test',part:'common-button',interaction:'press'},now);
    s=actWorkshop(s,{type:'export',part:'common-button'},now);
    expect(partRectValid(s,'common-heading',getWorkshopPart('common-heading').defaultRect)).toBe(false);
    const resources=s.resources,exported=s.run.workshop.parts['common-button']!.exportedAt;
    s=actWorkshop(s,{type:'place',part:'common-button',rect:getWorkshopPart('common-button').defaultRect},now);
    expect(s.resources).toBe(resources);expect(s.run.workshop.parts['common-button']).toMatchObject({step:4,exportedAt:exported,tested:true});
    expect(partRectValid(s,'common-heading',getWorkshopPart('common-heading').defaultRect)).toBe(true);
    expect(actWorkshop(s,{type:'export',part:'common-button'},now)).toBe(s);expect(isGameState(s)).toBe(true);
  });
  it('3部品を作っても必須セット未完成なら出口で止まったことにならない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
    for(const id of ['common-frame','common-button','common-heading'] as const)s=complete(s,id);
    s=actWorkshop(s,{type:'export'},now);expect(prototypeConditions(s)).toEqual([true,true,true]);
    expect(actWorkshop(s,{type:'exit'},now)).toBe(s);expect(s.run.workshop.exitInspected).toBe(false);
  });
  it('配置の刻みは解像度で8/4/2/1へ変わり、数値入力も保存も格子から外れない',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
    const base=getWorkshopPart('common-button').defaultRect,offGrid={...base,x:17,width:145};
    expect(workshopPlacementGrid(s)).toBe(8);expect(partRectValid(s,'common-button',offGrid)).toBe(false);
    expect(normalizeWorkshopRect(s,'common-button',offGrid)).toMatchObject({x:16,width:144});
    s=actWorkshop(s,{type:'place',part:'common-button',rect:offGrid},now);
    expect(s.run.workshop.parts['common-button']!.rect).toMatchObject({x:16,width:144});expect(isGameState(s)).toBe(true);
    const broken=structuredClone(s);broken.run.workshop.parts['common-button']!.rect.x=17;expect(isGameState(broken)).toBe(false);
    for(const [resolution,grid] of BALANCE.workshop.canvas.resolutionGrid.entries()){s.persistent.specs.resolution=resolution;expect(workshopPlacementGrid(s)).toBe(grid);}
    expect(partRectValid(s,'common-button',offGrid)).toBe(true);
  });
  it('追加パーツのプラグインは制作権利と未制作2部品を付与し、次の周回でも再課金しない',()=>{
    let s=workshop();s.run.version='v1';s.resources.tokens=15;const pixels=s.resources.pixels;
    s=actWorkshop(s,{type:'skill',id:'extraParts'},now);
    expect(s.resources).toMatchObject({pixels,tokens:0});expect(s.run.workshop.purchasedSets).toContain('extras');
    expect(s.run.workshop.parts['plugin-tabs']).toMatchObject({step:0,completedAt:null,exportedAt:null});
    expect(s.run.workshop.parts['plugin-table']).toMatchObject({step:0,completedAt:null,exportedAt:null});expect(completedParts(s)).toEqual([]);
    expect(actWorkshop(s,{type:'skill',id:'extraParts'},now)).toBe(s);
    let next=createInitialState(now);next.persistent.editorSkills=['extraParts'];next=enterWorkshop(next);
    expect(next.run.workshop.purchasedSets).toContain('extras');expect(next.run.workshop.parts['plugin-tabs']!.step).toBe(0);
    const settled=advanceWorkshop(next,BALANCE.workshop.enterMs);expect(advanceWorkshop(settled,0)).toBe(settled);expect(isGameState(settled)).toBe(true);
  });
  it('大きな文字は部品の必要寸法を広げ、狭いまま潰れる設定を操作と保存で拒む',()=>{
    let s=complete(actWorkshop(workshop(),{type:'buySet',set:'common'},now),'common-button');
    expect(actWorkshop(s,{type:'adjust',part:'common-button',patch:{fontSize:28}},now)).toBe(s);
    const enlarged={...s.run.workshop.parts['common-button']!.design,fontSize:28};
    expect(partMinimumSize(s,'common-button',enlarged)).toEqual({width:288,height:96});
    s=actWorkshop(s,{type:'place',part:'common-button',rect:{...getWorkshopPart('common-button').defaultRect,width:288,height:96}},now);
    s=actWorkshop(s,{type:'adjust',part:'common-button',patch:{fontSize:28}},now);
    expect(s.run.workshop.parts['common-button']!.design.fontSize).toBe(28);expect(isGameState(s)).toBe(true);
    const broken=structuredClone(s);broken.run.workshop.parts['common-button']!.rect.height=48;expect(isGameState(broken)).toBe(false);
    s=actWorkshop(s,{type:'place',part:'common-button',rect:{...s.run.workshop.parts['common-button']!.rect,height:48}},now);
    expect(s.run.workshop.parts['common-button']!.rect.height).toBe(96);
  });
  it('一覧が大きな矩形に収まっていても実際の選択で仕上げられ、完了報酬は一度だけ',()=>{
    let s=workshop();for(const set of ['common','foundation'] as const)s=completeSet(s,set);
    s=actWorkshop(s,{type:'buySet',set:'files'},now);const id='files-list',definition=getWorkshopPart(id);
    expect(definition.testInteraction).toBe('scroll');expect(definition.testAlternatives).toEqual(['select']);
    s=actWorkshop(s,{type:'place',part:id,rect:{x:8,y:8,width:624,height:400}},now);
    for(const element of definition.elements)s=actWorkshop(s,{type:'addElement',part:id,element},now);
    s=actWorkshop(s,{type:'confirmAdjustment',part:id},now);const before=s.resources.pixels,combo=workshopComboMultiplier(s,now);
    expect(actWorkshop(s,{type:'test',part:id,interaction:'press'},now)).toBe(s);
    s=actWorkshop(s,{type:'test',part:id,interaction:'select'},now);
    expect(s.run.workshop.parts[id]).toMatchObject({step:4,tested:true});
    expect(s.resources.pixels-before).toBe(BALANCE.workshop.categoryStepRewards.large[3]*combo+BALANCE.workshop.finishRewards.large);
    expect(actWorkshop(s,{type:'test',part:id,interaction:'select'},now)).toBe(s);
    expect(actWorkshop(s,{type:'test',part:id,interaction:'scroll'},now)).toBe(s);expect(isGameState(s)).toBe(true);
    expect(getWorkshopPart('common-button').testAlternatives).toEqual([]);
  });
  it('不正な工程飛ばし・未購入部品・未知要素は保存と操作の両方で拒む',()=>{
    let s=actWorkshop(workshop(),{type:'buySet',set:'common'},now);
    expect(actWorkshop(s,{type:'selectPart',part:'photo-crop'},now)).toBe(s);
    expect(actWorkshop(s,{type:'addElement',part:'common-button',element:'label'},now)).toBe(s);
    s=actWorkshop(s,{type:'place',part:'common-button',rect:getWorkshopPart('common-button').defaultRect},now);
    expect(actWorkshop(s,{type:'addElement',part:'common-button',element:'unknown'},now)).toBe(s);
    const bad=structuredClone(s);bad.run.workshop.parts['common-button']!.step=4;expect(isWorkshopState(bad.run.workshop)).toBe(false);
  });
});


describe('工房：同じ行き先の部品が共有する操作状態',()=>{
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
