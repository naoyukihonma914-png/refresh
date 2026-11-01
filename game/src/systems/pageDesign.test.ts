import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';import{gunzipSync}from'node:zlib';
import {BALANCE} from '../config/balance';
import {createFixture} from './fixtures';import{createInitialState,isGameState}from'./state';
import{actPageDesign,createPageDesign,pageColors,contrast,recommendedPage,fitPageLayout,isRecommendedPage,PAGE_PARTS,validPagePlacement}from'./pageDesign';
import{decodeSave,encodeSave}from'./save';import{createSeedVersion,advanceSeedInstaller}from'./seed';
import{buildKumiki,placePart,prepareDrawing,targetFor,paintDrawing,availableIcons,exportKumiki,prototypeConditions}from'./kumiki';
import{passivePixelsPerSecond,manualClickValue,cursorPressesPerSecond}from'./economy';
import{projectCapture,readCapture,restoreScene}from'./captureScene';import{takeScreenshot}from'./desktop';
import{blankDrawing}from'./kumikiState';
import{beginPrototypeRelease,productPreviewState}from'./release';
import{BASE_PALETTE,paletteFor}from'../content/kumikiArt';
const now=1800000000000;
const evolved=()=>createFixture('seed-motion',now)!;
const legacy=()=>gunzipSync(readFileSync(new URL('./testdata/v11-home-controls.json.gz',import.meta.url))).toString();
describe('段階6.3：作った分だけページを設計する',()=>{
 it('未作成の色・書体・配置・動きは変更できず、財布と進行を保つ',()=>{
  const s=createInitialState(now);for(const a of [{type:'color',slot:'button',color:'#008080'},{type:'font',slot:'bodyFont',font:'pixel'},{type:'motion',motion:'lift'},{type:'layout',layout:recommendedPage()}] as const)expect(actPageDesign(s,a)).toBe(s);
 });
 it('背景を変えると読める文字色へ合わせ、近い色の文字は拒み、色深度外も使えない',()=>{
  let s=evolved();s=actPageDesign(s,{type:'color',slot:'background',color:BASE_PALETTE[0]!});const c=pageColors(s.run.seed.page,0);expect(contrast(c.background,c.text)).toBeGreaterThanOrEqual(4.5);expect(actPageDesign(s,{type:'color',slot:'text',color:BASE_PALETTE[0]!})).toBe(s);expect(actPageDesign(s,{type:'color',slot:'button',color:'#123456'})).toBe(s);
 });
 it('背景・文字・ボタン、見出し・本文の書体、押したときの動きをそれぞれ保存する',()=>{
  let s=evolved();s=actPageDesign(s,{type:'color',slot:'button',color:BASE_PALETTE[5]!});s=actPageDesign(s,{type:'font',slot:'headingFont',font:'mono'});s=actPageDesign(s,{type:'font',slot:'bodyFont',font:'pixel'});s=actPageDesign(s,{type:'motion',motion:'fade'});expect(decodeSave(encodeSave(s)).run.seed.page).toMatchObject({button:BASE_PALETTE[5]!,headingFont:'mono',bodyFont:'pixel',motion:'fade'});
 });
 it('標準背景で選べた文字色を、どちらの色深度でも保存し直して失わない',()=>{
  for(const level of [0,1])for(const color of paletteFor(level)){const s=evolved();s.persistent.specs.color=level;const next=actPageDesign(s,{type:'color',slot:'text',color});if(next!==s)expect(decodeSave(encodeSave(next)).run.seed.page).toEqual(next.run.seed.page);}
 });
 it('生成の部品を独立して動かし・広げても、ほかの3部品を動かさず報酬を変えない',()=>{
  const s=actPageDesign(evolved(),{type:'recommended'}),layout=structuredClone(s.run.seed.page.layout!);layout.parts.generator.x=16;layout.parts.generator.width=960;const next=actPageDesign(s,{type:'layout',layout});expect(next.run.seed.page.layout).toEqual(layout);expect(next.resources).toEqual(s.resources);expect(next.run.seed.page.layout!.parts.heading).toEqual(s.run.seed.page.layout!.parts.heading);expect(passivePixelsPerSecond(next)).toBe(passivePixelsPerSecond(s));
 });
 it('おすすめの記録とカスタム配置を判別し、ボタンの寸法は明示したときだけ保存する',()=>{
  const s=actPageDesign(evolved(),{type:'recommended'});expect(isRecommendedPage(s.run.seed.page.layout)).toBe(true);const layout=structuredClone(s.run.seed.page.layout!);layout.parts.generator.x=16;expect(isRecommendedPage(layout)).toBe(false);expect(actPageDesign(s,{type:'layout',layout}).run.seed.page.layout!.button).toBeUndefined();layout.button={width:320,height:48};const next=actPageDesign(s,{type:'layout',layout});expect(decodeSave(encodeSave(next)).run.seed.page.layout!.button).toEqual(layout.button);expect(fitPageLayout(layout,800,800).button).toEqual(layout.button);const centered={...recommendedPage(),button:layout.button};expect(isRecommendedPage(centered)).toBe(false);expect(fitPageLayout(centered,800,800).button).toEqual(layout.button);const desktop=createFixture('desktop-ready',now)!;desktop.run.seed.page=next.run.seed.page;desktop.run.desktop.cooldownMs=0;const shot=takeScreenshot(desktop,now,'ja').persistent.screenshots.at(-1)!;expect(restoreScene(shot,[shot]).run.seed.page.layout!.button).toEqual(layout.button);
  for(const button of [{width:8,height:32},{width:120,height:8},{width:1920,height:32}])expect(actPageDesign(s,{type:'layout',layout:{...layout,button}})).toBe(s);
 });
 it('窓外・重なり・小さすぎる寸法・格子外・NaNの配置は拒み、復旧操作は常に残る',()=>{
  const s=actPageDesign(evolved(),{type:'recommended'});
  for(const patch of [{x:-8},{x:1920},{width:8},{height:8},{x:13},{x:NaN},{y:s.run.seed.page.layout!.parts.heading.y}]){const layout=structuredClone(s.run.seed.page.layout!);Object.assign(layout.parts.generator,patch);expect(actPageDesign(s,{type:'layout',layout})).toBe(s);}
  const restored=actPageDesign(s,{type:'reset'});expect(restored.run.seed.page.layout).toEqual(recommendedPage());
 });
 it('狭いホーム画面では読める寸法へ置き直し、元の保存配置を変えない',()=>{
  const original=recommendedPage();for(const width of [352,416,640,1000,1920]){const fitted=fitPageLayout(original,width,800);expect(PAGE_PARTS.every(id=>validPagePlacement(fitted,id,fitted.parts[id]))).toBe(true);}expect(original).toEqual(recommendedPage());
 });
 it('おすすめは配置だけ、標準は配色・書体・動きも戻し、書いた見出しを消さない',()=>{
  let s=evolved();s.run.kumiki.placed=['input'];s=actPageDesign(s,{type:'heading',heading:'私の作業場'});s=actPageDesign(s,{type:'color',slot:'button',color:BASE_PALETTE[5]!});s=actPageDesign(s,{type:'recommended'});expect(s.run.seed.page.button).toBe(BASE_PALETTE[5]);s=actPageDesign(s,{type:'reset'});expect(s.run.seed.page).toEqual({...createPageDesign(),heading:'私の作業場',layout:recommendedPage()});
 });
 it('構成を引き継ぐ場合だけ次版へ複製し、作り直す前の版や獲得済みの権利を変えない',()=>{
  let s=evolved();s=actPageDesign(s,{type:'color',slot:'button',color:BASE_PALETTE[5]!});s=actPageDesign(s,{type:'font',slot:'bodyFont',font:'mono'});const layout=recommendedPage();layout.parts.generator.x=16;layout.parts.generator.width=960;s=actPageDesign(s,{type:'layout',layout});expect(createSeedVersion(s,'v1',now).run.seed.page).toEqual(createPageDesign());s.persistent.seedSkills=['inherit'];const next=createSeedVersion(s,'v1',now);expect(next.run.seed.page).toEqual(s.run.seed.page);expect(next.run.seed.page).not.toBe(s.run.seed.page);expect(advanceSeedInstaller(next,BALANCE.w1.inheritMs).run.seed.page).toEqual(s.run.seed.page);
 });
 it('出荷した見た目を、次の版で変更しても製品のプレビューへ戻さない',()=>{
  let s=createFixture('release-ready',now)!;s=actPageDesign(s,{type:'recommended'});s=actPageDesign(s,{type:'font',slot:'headingFont',font:'mono'});s=actPageDesign(s,{type:'heading',heading:'出荷したページ'});s.run.kumiki.legacyBonus={auto:1.2,drawing:2};const shipped=beginPrototypeRelease(s,now),product=shipped.persistent.products.at(-1)!;s.run.seed.page.heading='後から変更';expect(productPreviewState(product).run.kumiki.legacyBonus).toEqual({auto:1.2,drawing:2});expect(productPreviewState(product).run.seed.page).toEqual({...s.run.seed.page,heading:'出荷したページ'});expect(decodeSave(encodeSave(shipped)).persistent.products.at(-1)!.screen.page).toEqual(product.screen.page);
 });
 it('入力欄を置くまで見出しを付けられず、作者名・作品名と混ぜない',()=>{
  let s=evolved();s.persistent.playerName='作者';s.run.kumiki.exportName='作品';expect(actPageDesign(s,{type:'heading',heading:'見出し'})).toBe(s);s.run.kumiki.placed=['input'];s=actPageDesign(s,{type:'heading',heading:'見出し'});expect(s.run.seed.page.heading).toBe('見出し');expect(s.persistent.playerName).toBe('作者');expect(s.run.kumiki.exportName).toBe('作品');
 });
 it('新しいアイコンの届く順と試作条件は、プラグイン・入力欄・枠・タスクバーで進む',()=>{
  let s=createFixture('kumiki-early',now)!;s.resources.pixels=s.run.totalPixelsGenerated=1e6;
  const gates=[null,'button','extensions','input','frame','taskbar'];let index=0;
  for(const id of ['folder','bin','clock','mail','photo','settings']){
   const gate=gates[index++];while(gate&&!s.run.kumiki.built.includes(gate as 'input')){const next=BALANCE.w2.items.find(i=>!s.run.kumiki.built.includes(i.id))!;s=buildKumiki(s,next.id);}
   expect(availableIcons(s)).toContain(id);s=prepareDrawing(s,id);const target=targetFor(s,id,16);for(const color of new Set(target.filter(c=>c>=0)))s=paintDrawing(s,id,target.flatMap((c,i)=>c===color?[i]:[]),color);s=exportKumiki(s,now);
  }
  s=placePart(s,'button');expect(prototypeConditions(s)).toEqual([true,true,true]);expect(s.run.kumiki.built).not.toContain('switch');expect(s.run.kumiki.built).not.toContain('slider');
 });
});
describe('第11版の実データから損をしない移行',()=>{
 it('費用52,000と未受け取り120.5を一度だけ戻し、資源・作品・アプリ・撮影・ノートを保持する',()=>{
  const raw=legacy(),old=JSON.parse(raw),s=decodeSave(raw);expect(s.schemaVersion).toBe(12);expect(s.resources.pixels-old.resources.pixels).toBe(52120.5);expect(s.resources.tokens).toBe(old.resources.tokens);expect(s.resources.dollars).toBe(old.resources.dollars);expect(s.persistent).toEqual(old.persistent);expect(s.run.desktop.projects).toEqual(old.run.desktop.projects);expect(s.run.kumiki.exports).toEqual(old.run.kumiki.exports);expect(s.run.kumiki.bank).toBe(0);expect(s.run.kumiki.focus).toBe(false);expect(s.run.kumiki.interval).toBe(1);expect(s.run.kumiki.built).not.toContain('switch');expect(s.run.kumiki.placed).not.toContain('slider');expect(isGameState(s)).toBe(true);expect(decodeSave(encodeSave(s))).toEqual(s);
 });
 it('旧順序で届いていた絵と、満たしていた試作条件を取り上げない',()=>{
  const old=JSON.parse(legacy());old.run.kumiki.built=['select','button','extensions','switch','slider'];old.run.kumiki.placed=['button','switch','slider'];const s=decodeSave(JSON.stringify(old));expect(s.run.kumiki.built).toContain('input');expect(prototypeConditions(s)).toEqual([true,true,true]);expect(availableIcons(s)).toContain('photo');expect(availableIcons(s)).toContain('settings');expect(s.run.kumiki.drawings.photo).toEqual(old.run.kumiki.drawings.photo);
 });
 it('旧集中モードで停止せず、支払い済みの最大倍率も現在の版の間は残す',()=>{
  let s=decodeSave(legacy());expect(s.run.kumiki.legacyBonus).toEqual({auto:1.2,drawing:2});expect(passivePixelsPerSecond(s)).toBeGreaterThan(0);const base=manualClickValue(s)*cursorPressesPerSecond(s)*1.5*1.2*s.run.seed.autoCursors;expect(passivePixelsPerSecond(s)).toBeGreaterThanOrEqual(base);s.run.kumiki.drawings.document=blankDrawing(16);const target=targetFor(s,'document',16),cell=target.findIndex(c=>c>=0),before=s.resources.pixels;s=paintDrawing(s,'document',[cell],target[cell]!);expect(s.resources.pixels-before).toBe(BALANCE.w2.dotValue*BALANCE.spec.color[s.persistent.specs.color]!.multiplier*2);
 });
 it('新しい撮影は見出し・配置・書体を独立して保持し、旧撮影の本文とデータはそのまま読める',()=>{
  let s=decodeSave(legacy());const old=s.persistent.screenshots[0]!;expect(readCapture(old).version).toBe(6);const frozen=old.data;s.run.desktop.cooldownMs=0;s.run.seed.page.heading='撮影した見出し';s.run.seed.page.bodyFont='mono';s=takeScreenshot(s,now,'ja');const shot=s.persistent.screenshots.at(-1)!;expect(readCapture(shot).version).toBe(7);s.run.seed.page.heading='後で変更';expect(restoreScene(shot,s.persistent.screenshots).run.seed.page.heading).toBe('撮影した見出し');expect(old.data).toBe(frozen);expect(projectCapture(s,'ja').page.bodyFont).toBe('mono');
 });
});
