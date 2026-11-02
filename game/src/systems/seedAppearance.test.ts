import { describe, expect, it } from 'vitest';
import { createInitialState, isGameState } from './state';
import { applySeedSkills, createSeedVersion } from './seed';
import { decodeSave, encodeSave } from './save';
import { setDesktopStage } from './appearance';
import { desktopScreen, workHeight } from './desktopGeometry';
import { createEditorCustomization } from './workshopState';
describe('次の版でもエディタを組み立て直す',()=>{
 it.each([0,1,2,3] as const)('デスクトップ段%iを保って正しい空の窓を作り、工房は初期化する',era=>{
  let p=createInitialState(1000);p.run.version='v1';p.persistent.desktopPrefs.skills=['major1','major2','major3'];p=setDesktopStage(p,era);const n=createSeedVersion(p,'v2',2000),screen=desktopScreen(era);expect(n.persistent.appearance.desktop).toBe(era);expect(n.run.world).toBe('seed');expect(n.run.desktop.screen).toEqual(screen);expect(n.run.desktop.entered).toBe(false);expect(n.run.desktop.apps).toEqual([]);expect(n.run.seed.built).toEqual([]);expect(n.run.seed.installer).toBeNull();expect(n.run.workshop.entered).toBe(false);expect(n.run.workshop.parts).toEqual({});
  for(const w of Object.values(n.run.desktop.windows)){expect(w.open||w.minimized||w.maximized).toBe(false);expect(w.restore).toBeNull();expect(w.z).toBe(0);expect(w.x+w.width).toBeLessThanOrEqual(screen.width);expect(w.y+w.height).toBeLessThanOrEqual(workHeight(screen));}expect(isGameState(n)).toBe(true);expect(decodeSave(encodeSave(n)).run.desktop).toEqual(n.run.desktop);
 });
 it('大型アップデートだけで独立したホームページ外観を新たに解放しない',()=>{const p=createInitialState(1000);p.persistent.desktopPrefs.skills.push('major1');const n=createSeedVersion(p,'v2',2000);expect(n.persistent.seedAppearance).toEqual(p.persistent.seedAppearance);expect(n.persistent.editorCustomization).toEqual(createEditorCustomization());});
 it('引き継ぎを買った場合だけ、設定適用と保存をまたいで選択を保つ',()=>{const p=createInitialState(1000);p.persistent.seedSkills.push('inherit');p.persistent.editorCustomization.bandPosition='bottom';let n=createSeedVersion(p,'v2',2000);n=applySeedSkills(n,['inherit'],'none',false);expect(n.persistent.editorCustomization.bandPosition).toBe('bottom');expect(decodeSave(encodeSave(n)).persistent.editorCustomization).toEqual(n.persistent.editorCustomization);p.persistent.seedSkills=[];expect(createSeedVersion(p,'v2',2000).persistent.editorCustomization).toEqual(createEditorCustomization());});
});
