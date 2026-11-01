import { actAppBuild } from './appBuild';
import { featureApp, isBuildable } from './appLayout';
import type { DesktopUpgrade } from '../config/balance';
import { desktopScreen,resizeDesktop } from './desktopGeometry';
import { enterDesktop, buyDesktopApp as buyBlueprint, focusWindow, advanceDesktopTime, takeScreenshot, nextDesktopApp } from './desktop';
import { BALANCE } from '../config/balance';
import { createInitialState, type GameState } from './state';
import { createSeedVersion, updateSeedGuide } from './seed';
import { buildKumiki, enterKumiki, exportKumiki, ownedParts, paintDrawing, placePart, prepareDrawing, targetFor } from './kumiki';
import { blankDrawing } from './kumikiState';
import { advanceShipping, beginPrototypeRelease, buySpec, startNextVersion } from './release';

function buyDesktopApp(state:GameState,id:DesktopUpgrade):GameState {
 let next=buyBlueprint(state,id);const app=isBuildable(id)?id:featureApp(id);
 if(app){next=actAppBuild(next,{type:'app-recommend',app});next=actAppBuild(next,{type:'app-install',app});next=focusWindow(next,app);}
 return next;
}

export const FIXTURE_NAMES = [
  'app-build-missing','app-build-empty','app-build-files','intro', 'editor-stage0','editor-stage1','editor-stage2','desktop-stage0','desktop-stage1','desktop-stage2',
  'desktop-jobs','desktop-photo','desktop-ready','desktop-stalled',
  'desktop-early', 'desktop-wait', 'desktop-files', 'desktop-mail', 'desktop-modern', 'desktop-full',
  'foundation-start', 'foundation-saved', 'foundation-offline-capped',
  'seed-start', 'seed-border', 'seed-saved', 'seed-color', 'seed-font',
  'seed-layout', 'seed-motion', 'seed-complete', 'seed-return', 'seed-inheriting',
  'kumiki-early', 'kumiki-mature', 'kumiki-wall', 'kumiki-modern', 'kumiki-drift',
  'release-ready', 'release-counting', 'release-complete', 'release-rich', 'release-restarting', 'release-rebuilt', 'release-v1-tessera',
] as const;

// 実セーブと混ざらないよう、ランタイムは固定状態ではメモリ内の保存領域を使う。
export function createFixture(name: string | null, now: number): GameState | null {
  if (!FIXTURE_NAMES.some(item => item === name)) return null;
  const state = createInitialState(now);
  if (name === 'intro') return state;
  if(name==='app-build-missing'){const next=createFixture('desktop-stage2',now)!;next.run.desktop.projects.files!.draft.parts=next.run.desktop.projects.files!.draft.parts.filter(p=>p.id!=='sort');next.run.desktop.projects.files!.installed=structuredClone(next.run.desktop.projects.files!.draft);next.run.desktop.feedback=[{id:1,kind:'sort',sender:'hikari',target:'',baseline:[],baselineColor:'#000000',at:now,completedAt:null}];next.run.desktop.feedbackSerial=1;next.run.desktop.notice=1;next.run.desktop.success=null;return next;}
  if(name==='app-build-empty'||name==='app-build-files'){let next=createFixture('desktop-early',now)!;next.resources.pixels=next.run.totalPixelsGenerated=1e9;next=buyBlueprint(next,'files');if(name==='app-build-files'){next=actAppBuild(next,{type:'app-recommend',app:'files'});next=buyBlueprint(next,'sort');}next.persistent.artwork.skills.push('update');next.persistent.appearance.editor=1;next.run.desktop.windows.tessera={...next.run.desktop.windows.tessera,x:0,y:0,width:800,height:572,maximized:true,restore:{x:40,y:40,width:600,height:400}};return next;}
  if(name?.startsWith('editor-stage')||name?.startsWith('desktop-stage')){
    const index=Number(name.at(-1)) as 0|1|2;
    let next=createFixture(name.startsWith('editor')?'kumiki-modern':'desktop-ready',now)!;
    next.persistent.artwork.skills=['fill','mirror','layers','eyedropper','expand','snap','outline','animation','extraParts','wallpaper','update','modern'];
    next.persistent.desktopPrefs.skills=['major1','major2'];next.persistent.appearance={editor:index,desktop:index};next.persistent.artwork.modern=index===2;
    next.run.desktop=resizeDesktop(next.run.desktop,desktopScreen(index));
    if(name.startsWith('desktop'))next=advanceDesktopTime(next,720_000,now,true);
    next.run.kumiki.guide.collapsed=true;next.resources.tokens=200;return next;
  }
  if (name?.startsWith('desktop-')) {
    let next = createFixture('release-v1-tessera',now)!;
    next.resources.pixels = 2_000_000; next.run.totalPixelsGenerated = 4_000_000;
    next = enterDesktop(next); next.elapsedMs += BALANCE.w3.enterMs;
    if (name === 'desktop-early') return next;
    if (name === 'desktop-wait') { next.resources.pixels=20_000; return next; }
    next = buyDesktopApp(next,'files');
    if (name === 'desktop-files') return next;
    next=buyDesktopApp(next,'sort');next = buyDesktopApp(next,'mail'); next = focusWindow(next,'tessera');
    if (name === 'desktop-modern') {
      next.persistent.artwork.skills.push('update','modern','fill','layers'); next.persistent.artwork.modern=true;next.persistent.appearance={editor:2,desktop:2};next.persistent.desktopPrefs.skills.push('major1','major2');next.run.desktop=resizeDesktop(next.run.desktop,desktopScreen(2));
    }
    next = advanceDesktopTime(next,720_000,now);next.run.desktop.idleMs=0;next.run.desktop.stalled=null;next.run.desktop.stalledClosed=false;next.run.desktop.stallMs=BALANCE.w3.stallMinMs;
    if(['desktop-jobs','desktop-photo','desktop-ready','desktop-stalled'].includes(name!)){
      next.resources.pixels=next.run.totalPixelsGenerated=1e12;next.resources.tokens=200;
      const stop=name==='desktop-jobs'?'jobs':name==='desktop-photo'?'compare':'terminal';
      while(nextDesktopApp(next)){const id=nextDesktopApp(next)!.id;next=buyDesktopApp(next,id);if(id===stop)break;}
      next.run.desktop.feedback=[];next.run.desktop.feedbackSerial=0;next.run.desktop.notice=null;
      for(const id of ['folder','bin','clock','mail','photo','settings']){
        next=prepareDrawing(next,id);const work=next.run.kumiki.drawings[id]!,target=targetFor(next,id,work.size);
        for(const color of new Set(target.filter(c=>c>=0)))next=paintDrawing(next,id,target.flatMap((c,i)=>c===color?[i]:[]),color);
        next=exportKumiki(next,now);
      }
      for(const id of ['tessera','files','photo'] as const){if(id!=='tessera'&&!next.run.desktop.apps.includes(id))continue;next.run.desktop.jobs[id]={assigned:true,cursors:8,updates:1};}
      next=focusWindow(next,'tessera');next=focusWindow(next,'note');
      if(name!=='desktop-jobs')next=focusWindow(next,'photo');
      for(const id of ['manager','mail','bin','clock','theme','terminal','settings'] as const)next.run.desktop.windows[id].open=false;
      if(name==='desktop-stalled')next.run.desktop.stalled='photo';
      if(name==='desktop-ready'){
        next.persistent.desktopPrefs.wallpaper={source:'coast',brightness:1.1,tone:0,crop:0};
        next.run.desktop.terminal={...next.run.desktop.terminal,running:true,executions:1};
        for(let i=0;i<4;i++){next.run.desktop.cooldownMs=0;next=takeScreenshot(next,now+i,'ja');}
        next.run.desktop.cooldownMs=0;
      }
      return next;
    }
    if (name === 'desktop-full') {
      for(let i=0;i<BALANCE.w3.baseShotCapacity;i++) { next.run.desktop.cooldownMs=0; next=takeScreenshot(next,now,'ja'); }
      next.run.desktop.cooldownMs=0;
    }
    return next;
  }
  if (name?.startsWith('release-')) {
    let next = createFixture('kumiki-wall', now)!;
    for (const id of ['clock', 'mail', 'photo', 'settings']) {
      next = prepareDrawing(next, id);
      const drawing = next.run.kumiki.drawings[id]!;
      const target = targetFor(next, id, drawing.size);
      for (const color of new Set(target.filter(c => c >= 0))) next = paintDrawing(next, id, target.flatMap((c, i) => c === color ? [i] : []), color);
      next = exportKumiki(next, now);
    }
    next.persistent.playerName = 'Aoi';
    next.resources.pixels = 51_872;
    next.run.seed.autoCursors = 41;
    next.run.totalPixelsGenerated = 1_000_000;
    const elements=next.run.seed.built.length+next.run.kumiki.built.length+next.run.kumiki.exports.filter(e=>e.kind==='icon').length;
    next.run.totalPixelsGenerated=BALANCE.release.pixelUnit*(303.5/(BALANCE.release.base*(1+BALANCE.release.perElement*elements)))**(1/BALANCE.release.exponent);
    if (name === 'release-ready') return next;
    next = beginPrototypeRelease(next, now);
    next = advanceShipping(next, name === 'release-counting' ? 2_400 : BALANCE.release.animationMs);
    if (name === 'release-rich') { next.resources.dollars = 1_000_000; return next; }
    if (name === 'release-restarting' || name === 'release-rebuilt' || name === 'release-v1-tessera') {
      next = startNextVersion(buySpec(next, 'color'), now);
      if (name === 'release-rebuilt') {
        next.run.restartMs = 0;
        next.run.seed.built = ['border', 'save', 'color']; next.run.seed.autoCursors = 1;
        next.resources.pixels = 2_236; next.run.totalPixelsGenerated = 5_000;
        next.lastSavedAt = now;
      }
      if (name === 'release-v1-tessera') {
        next.run.restartMs = 0;
        next.run.seed.built = BALANCE.w1.items.map(item => item.id); next.run.seed.autoCursors = 41;
        next.resources.pixels = 1_000_000; next.run.totalPixelsGenerated = 2_000_000;
        next = enterKumiki(next);
        for (const item of BALANCE.w2.items) next = buildKumiki(next, item.id);
        for (const part of ownedParts(next)) next = placePart(next, part);
      }
    }
    return next;
  }
  if (name?.startsWith('kumiki-')) {
    state.run.seed.built = BALANCE.w1.items.map(item => item.id);
    state.run.seed.autoCursors = 12;
    state.resources.pixels = 1_000_000; state.run.totalPixelsGenerated = 2_000_000;
    state.lastSavedAt = now;
    if (name === 'kumiki-modern') {
      state.run.version = 'v2'; state.persistent.specs.color = 1; state.persistent.specs.resolution = 1;
      state.persistent.artwork.skills = BALANCE.w2.skills.map(skill => skill.id);
      state.persistent.artwork.modern = true;state.persistent.appearance={editor:2,desktop:2};state.persistent.desktopPrefs.skills=['major1','major2'];state.run.desktop=resizeDesktop(state.run.desktop,desktopScreen(2));
      state.persistent.artwork.sketchbook = blankDrawing(32);
    }
    let next = enterKumiki(state);
    if (name === 'kumiki-early') { next.resources.pixels = 0; return next; }
    for (const item of BALANCE.w2.items) {
      next = buildKumiki(next, item.id);
      if (name === 'kumiki-mature' && item.id === 'extensions') break;
    }
    for (const part of ownedParts(next)) if (name !== 'kumiki-mature' || part === 'button') next = placePart(next, part);
    for (const id of ['folder', 'bin']) {
      next = prepareDrawing(next, id);
      const drawing = next.run.kumiki.drawings[id]!;
      const target = targetFor(next, id, drawing.size);
      for (const color of new Set(target.filter(c => c >= 0))) next = paintDrawing(next, id, target.flatMap((c,i) => c === color ? [i] : []), color);
      next = exportKumiki(next, now);
    }
    next = prepareDrawing(next, 'clock');
    const clock = next.run.kumiki.drawings.clock!;
    const target = targetFor(next, 'clock', clock.size);
    for (const color of new Set(target.filter(c => c >= 0))) next = paintDrawing(next, 'clock', target.flatMap((c,i) => c === color && i < target.length / 2 ? [i] : []), color);
    next.resources.pixels = name === 'kumiki-wall' ? BALANCE.w2.desktopCost : 31_240;
    next.run.kumiki.guide.current = name === 'kumiki-wall' ? 'wall' : 'export';
    if (next.run.version !== 'v0.1') { next.run.kumiki.guide.current = null; next.run.kumiki.guide.collapsed = true; }
    if (name === 'kumiki-drift') next.run.kumiki.drift = { part: 'input', dx: 10, dy: -6, angle: 3 };
    return next;
  }
  if (name?.startsWith('seed-')) {
    if (name === 'seed-start') { state.resources.pixels = state.run.totalPixelsGenerated = 7; return state; }
    const end = name === 'seed-border' ? 'border' : name === 'seed-saved' ? 'save'
      : name === 'seed-color' ? 'color' : name === 'seed-font' ? 'font'
        : name === 'seed-layout' ? 'layout' : name === 'seed-complete' ? 'kumiki' : 'motion';
    state.run.seed.built = BALANCE.w1.items.slice(0, BALANCE.w1.items.findIndex(item => item.id === end) + 1).map(item => item.id);
    state.run.seed.history = state.run.seed.built.map((item, index) => ({ item, at: now - (10 - index) * 60_000 }));
    state.run.seed.autoCursors = end === 'border' || end === 'save' ? 0 : name === 'seed-motion' ? 24 : 8;
    state.resources.pixels = 12_000;
    state.run.totalPixelsGenerated = 40_000;
    state.lastSavedAt = now;
    if (name === 'seed-return' || name === 'seed-inheriting') {
      state.run.version = 'v1';
      state.persistent.specs.color = 1;
      state.resources.tokens = 40;
      if (name === 'seed-inheriting') {
        state.persistent.seedSkills = ['inherit'];
        return createSeedVersion(state, 'v2', now);
      }
    }
    return updateSeedGuide(state);
  }
  if (name === 'foundation-start') return state;
  state.run.seed.built = ['border', 'save'];
  state.run.seed.autoCursors = 1;
  state.lastSavedAt = now;
  if (name === 'foundation-offline-capped') {
    state.lastTickAt -= BALANCE.debug.offlineFixtureHours * BALANCE.time.millisecondsPerHour;
    state.createdAt = state.lastTickAt;
    state.lastSavedAt = state.lastTickAt;
  }
  return state;
}
