import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { partsForSet, type WorkshopPartId } from '../content/workshopCatalog';
import { adoptedPartIds, appIsOperational } from './appAssembly';
import { APP_PARTS } from './appLayout';
import { actAppBuild, ownAppBlueprint } from './appBuild';
import { featureCount, jobCursorRate, jobProduction, jobsRate } from './desktopJobs';
import type { BuiltApp } from './desktopState';
import { enterDesktop } from './desktop';
import { completeWorkshopPartFixture, createFixture } from './fixtures';
import { createProgress, globalMultiplier } from './longPlay';
import { desktopAppPixelsPerSecond, desktopToolsPixelsPerSecond, installedToolCount, componentBaseRate, sourceTotal, editorPartSources } from './productionModel';
import { advanceHomeGeneration, homePixelsPerSecond, passivePixelsPerSecond, producerLedger, seedPartsPixelsPerSecond, workshopPartsPixelsPerSecond } from './economy';
import { madeContentCounts, releaseEstimate } from './release';
import { createInitialState, type GameState } from './state';

const now=1_800_000_000_000;
function desktop():GameState {
  let s=createFixture('stage8a-required-complete-16color',now)!;
  s.run.version='v1';s.persistent.specs.color=1;s.persistent.progress=createProgress();
  s.resources.pixels=s.run.totalPixelsGenerated=1e12;
  s=enterDesktop(s);s.run.seed.autoCursors=0;
  return s;
}
function install(s:GameState,app:BuiltApp):GameState {
  const blueprint=ownAppBlueprint(s,app);
  return actAppBuild(actAppBuild(blueprint,{type:'app-recommend',app}),{type:'app-install',app});
}
function craft(s:GameState,ids:readonly WorkshopPartId[]):GameState {
  for(const id of ids)s=completeWorkshopPartFixture(s,id,now,false);
  return s;
}
const photoBase=['photo-display','photo-brightness','photo-tone','photo-wallpaper','photo-switch'] as const;

describe('第3版：生産者の統合台帳',()=>{
  it('世界1と2では個別の部品を一度ずつ数え、同じ区分でも固有の毎秒を使う',()=>{
    const s=createInitialState(now);s.run.seed.built=['border','save'];
    expect(passivePixelsPerSecond(s)).toBeCloseTo(BALANCE.w1.items[0].perSecond+BALANCE.w1.items[1].perSecond);
    const base=createFixture('stage8a-required-complete-16color',now)!;base.persistent.progress=createProgress();base.run.seed.autoCursors=0;
    const rows=producerLedger(base);
    expect(rows.find(row=>row.id==='files-list')?.perSecond).toBe(BALANCE.workshop.partRates['files-list']);
    expect(rows.find(row=>row.id==='files-storage')?.perSecond).toBe(BALANCE.workshop.partRates['files-storage']);
    expect(new Set(rows.map(row=>row.id)).size).toBe(rows.length);
    expect(passivePixelsPerSecond(base)).toBeCloseTo(seedPartsPixelsPerSecond(base)+workshopPartsPixelsPerSecond(base));
  });
  it('世界3は採用した材料の和を使い、複数の表示roleが同じ材料を使っても一回だけ数える',()=>{
    const s=install(desktop(),'files');
    const graph=s.run.desktop.projects.files!.installedAssembly!;
    expect(graph.slots.filter(slot=>slot.source==='files-back')).toHaveLength(2);
    const sources=adoptedPartIds(s,'files'),base=sources.reduce((sum,id)=>sum+componentBaseRate(id),0);
    expect(sources.length).toBeLessThan(graph.common.length+graph.slots.length);
    const row=producerLedger(s).find(row=>row.id==='app:files')!;
    expect(row.sourceIds).toEqual(sources);expect(row.baseRate).toBe(base);
    expect(row.perSecond).toBeCloseTo(base*BALANCE.spec.color[1].multiplier);
    expect(seedPartsPixelsPerSecond(s)).toBe(0);expect(workshopPartsPixelsPerSecond(s)).toBe(0);
    expect(producerLedger(s).some(row=>row.id==='files-list')).toBe(false);
    expect(passivePixelsPerSecond(s)).toBeCloseTo(homePixelsPerSecond(s)+desktopToolsPixelsPerSecond(s)+jobsRate(s));
  });
  it('完成した未採用の材料は重ねて生成せず、アプリへ採用して初めて毎秒の土台が増える',()=>{
    let s=install(craft(desktop(),photoBase),'photo');
    const before=passivePixelsPerSecond(s),appBefore=desktopAppPixelsPerSecond(s,'photo');
    s=craft(s,['photo-crop']);
    expect(passivePixelsPerSecond(s)).toBeCloseTo(before);
    s=install(s,'photo');
    expect(desktopAppPixelsPerSecond(s,'photo')-appBefore).toBeCloseTo(BALANCE.workshop.partRates['photo-crop']*BALANCE.spec.color[1].multiplier);
    expect(passivePixelsPerSecond(s)).toBeGreaterThan(before);
  });
  it('未完成のアプリは稼働源にしない。編集中の材料変更と窓の開閉は入れてあるアプリの毎秒を変えない',()=>{
    const s=install(desktop(),'files'),before=passivePixelsPerSecond(s);
    const editing=actAppBuild(s,{type:'app-remove',app:'files',part:'list'});
    s.run.desktop.windows.files.open=false;s.run.desktop.windows.files.minimized=true;
    expect(appIsOperational(editing,'files')).toBe(true);expect(passivePixelsPerSecond(editing)).toBeCloseTo(before);
    const broken=actAppBuild(editing,{type:'app-install',app:'files'});
    expect(appIsOperational(broken,'files')).toBe(false);
    expect(desktopAppPixelsPerSecond(broken,'files')).toBe(0);
    expect(installedToolCount(broken)).toBe(installedToolCount(s)-1);
  });
  it('アプリ更新は材料の和に掛け、実績・案件・色の倍率は一度だけ掛かる',()=>{
    const s=install(desktop(),'files');s.run.desktop.jobs.files.updates=2;
    s.persistent.progress.records={'first-pixel':now,'save-created':now};s.persistent.progress.completed={'no-color':now};
    const row=producerLedger(s).find(row=>row.id==='app:files')!,factor=globalMultiplier(s);
    expect(row.multipliers.update).toBe(BALANCE.w3.updateMultiplier**2);
    expect(row.perSecond).toBeCloseTo(row.baseRate*BALANCE.w3.updateMultiplier**2*BALANCE.spec.color[1].multiplier*factor);
    const noBonuses=structuredClone(s);noBonuses.persistent.progress=createProgress();
    expect(passivePixelsPerSecond(s)/passivePixelsPerSecond(noBonuses)).toBeCloseTo(factor);
    expect(sourceTotal(editorPartSources(s))).toBeGreaterThan(0);
  });
  it('持ち場の土台は稼働ツールの数に直接比例し、機能倍率は材料ごとに一度だけ掛かる',()=>{
    let s=install(desktop(),'files');s.run.desktop.jobs.files={assigned:true,cursors:2,updates:1};
    const before=jobProduction(s,'files'),tools=installedToolCount(s);
    expect(before.multipliers.tools).toBe(tools);
    expect(featureCount(s,'files')).toBe(APP_PARTS.files.features.length);
    expect(before.perSecond).toBeCloseTo(before.baseRate*2*Object.values(before.multipliers).reduce((product,n)=>product*n,1));
    s=install(s,'mail');
    expect(installedToolCount(s)).toBe(tools+1);
    expect(jobCursorRate(s,'files')/before.perCursor).toBeCloseTo((tools+1)/tools);
    const rawGraph=s.run.desktop.projects.files!.installedAssembly!;
    const navigation=rawGraph.slots.find(slot=>slot.role==='navigation')!;
    expect(rawGraph.slots.some(slot=>slot.role==='places'&&slot.source===navigation.source)).toBe(true);
  });
  it('更新周期は自動カーソルと持ち場へ掛かり、通常のアプリ材料を二重に加速しない',()=>{
    const s=install(desktop(),'files');s.run.seed.autoCursors=3;s.run.desktop.jobs.files={assigned:true,cursors:1,updates:0};
    const app=desktopAppPixelsPerSecond(s,'files'),cursor=homePixelsPerSecond(s),job=jobCursorRate(s,'files');
    s.persistent.specs.refresh=1;const factor=BALANCE.spec.refresh[1].multiplier/BALANCE.spec.refresh[0].multiplier;
    expect(desktopAppPixelsPerSecond(s,'files')).toBe(app);expect(homePixelsPerSecond(s)).toBeCloseTo(cursor*factor);expect(jobCursorRate(s,'files')).toBeCloseTo(job*factor);
  });
  it('機能材料の制作とアプリ採用を区別し、ジョブの機能倍率は入れた後に一度だけ増える',()=>{
    let s=install(craft(desktop(),photoBase),'photo');
    const original=jobProduction(s,'photo');
    s=craft(s,['photo-crop']);
    const material=jobProduction(s,'photo');
    expect(material.multipliers.features).toBe(original.multipliers.features);
    s=install(s,'photo');
    const adopted=jobProduction(s,'photo');
    expect(adopted.multipliers.features/material.multipliers.features).toBeCloseTo(BALANCE.w3.featureMultiplier);
    expect(adopted.perCursor/material.perCursor).toBeCloseTo(BALANCE.w3.featureMultiplier);
    const once=adopted.perCursor;s=install(s,'photo');expect(jobCursorRate(s,'photo')).toBeCloseTo(once);
  });
  it('現在の位置・面積・影・写真履歴を変えても毎秒と固定された写真素材の売上を変えない',()=>{
    const s=install(desktop(),'files'),before=passivePixelsPerSecond(s),sale=releaseEstimate(s);
    const changed=structuredClone(s);changed.run.desktop.windows.files.x=0;changed.run.desktop.windows.files.y=0;
    changed.run.workshop.parts['files-list']!.rect.width+=BALANCE.workshop.canvas.grid;
    changed.run.workshop.parts['files-list']!.design.shadow=true;
    changed.run.desktop.shotHistory=[{at:now,pixels:1e15}];changed.persistent.progress.counts.shots=1_000_000;changed.persistent.progress.counts.icons=1_000_000;
    expect(passivePixelsPerSecond(changed)).toBeCloseTo(before);expect(jobCursorRate(changed,'files')).toBeCloseTo(jobCursorRate(s,'files'));expect(releaseEstimate(changed)).toBe(sale);
    const advanced=advanceHomeGeneration(s,BALANCE.time.millisecondsPerSecond);
    expect(advanced.resources.pixels-s.resources.pixels).toBeCloseTo(before);
    expect(advanced.run.totalPixelsGenerated-s.run.totalPixelsGenerated).toBeCloseTo(before);
  });
  it('出荷中は全生産者を停止し、未来の配信材料を世界3の単独毎秒へ足さない',()=>{
    const s=desktop();s.run.version='v2';const before=passivePixelsPerSecond(s);
    const stream=partsForSet('stream');expect(stream.length).toBeGreaterThan(0);
    const made=craft(s,stream.map(part=>part.id));expect(passivePixelsPerSecond(made)).toBeCloseTo(before);
    made.run.world='release';expect(producerLedger(made)).toEqual([]);expect(passivePixelsPerSecond(made)).toBe(0);
  });
});

describe('第3版：作った中身の売上',()=>{
  it('部品・稼働アプリ・完成セットを分類して数え、旧アイコン数と書き出し回数を式へ入れない',()=>{
    const s=install(desktop(),'files'),counts=madeContentCounts(s),weights=BALANCE.release.contentWeights;
    expect(counts.parts).toBe(21);expect(counts.sets).toBe(4);expect(counts.apps).toBe(2);
    expect(counts.total).toBe(counts.seedParts*weights.seedParts+21*weights.parts+2*weights.apps+4*weights.sets);
    const expected=Math.floor(BALANCE.release.base*(s.run.totalPixelsGenerated/BALANCE.release.pixelUnit)**BALANCE.release.exponent*(1+BALANCE.release.perElement*counts.total));
    expect(releaseEstimate(s)).toBe(expected);
    const changed=structuredClone(s);changed.persistent.progress.counts.icons=10000;
    for(const part of Object.values(changed.run.workshop.parts))if(part)part.exportedAt=null;
    expect(madeContentCounts(changed)).toEqual(counts);expect(releaseEstimate(changed)).toBe(expected);
  });
});
