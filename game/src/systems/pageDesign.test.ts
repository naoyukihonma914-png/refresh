import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { BASE_PALETTE } from '../content/palette';
import { creditPixels, passivePixelsPerSecond } from './economy';
import { buildSeed, createSeedVersion } from './seed';
import { actWorkshop } from './workshop';
import { createInitialState, isGameState } from './state';
import { actPageDesign, contrast, createPageDesign, fitPageLayout, isPageDesign, isRecommendedPage, pageColors, PAGE_PARTS, recommendedPage, validPagePlacement } from './pageDesign';
import { decodeSave, encodeSave } from './save';
const now=1_800_000_000_000;
function ready(){let s=creditPixels(createInitialState(now),100_000);for(const id of ['border','save','color','font','layout','motion'] as const)s=buildSeed(s,id,now);return s;}
describe('組み立て中のエディタを安全に設計する',()=>{
 it('未作成の色・書体・配置・動きを変更できない',()=>{
  const s=createInitialState(now);for(const a of [{type:'color',slot:'button',color:BASE_PALETTE[6]!},{type:'font',slot:'bodyFont',font:'pixel'},{type:'motion',motion:'lift'},{type:'layout',layout:recommendedPage()}] as const)expect(actPageDesign(s,a)).toBe(s);
 });
 it('部品ごとに背景色と文字色を持て、読めない組み合わせを拒む',()=>{
  let s=ready();
  s=actPageDesign(s,{type:'part-color',part:'heading',slot:'background',color:BASE_PALETTE[0]!});
  expect(s.run.seed.page.partColors?.heading?.background).toBe(BASE_PALETTE[0]);
  expect(actPageDesign(s,{type:'part-color',part:'heading',slot:'text',color:BASE_PALETTE[0]!})).toBe(s);
  s=actPageDesign(s,{type:'part-color',part:'generator',slot:'background',color:BASE_PALETTE[6]!});
  expect(s.run.seed.page.partColors?.generator?.background).toBe(BASE_PALETTE[6]);
  expect(s.run.seed.page.partColors?.heading?.background).toBe(BASE_PALETTE[0]);
  expect(actPageDesign(s,{type:'part-color',part:'generator',slot:'background',color:'#123456'})).toBe(s);
  expect(decodeSave(encodeSave(s)).run.seed.page).toEqual(s.run.seed.page);
  expect(isPageDesign(s.run.seed.page)).toBe(true);
  expect(isPageDesign({...s.run.seed.page,partColors:{heading:{background:'red',text:null}}})).toBe(false);
 });
 it('おすすめは中央カードでなく作業面と右の一覧を分け、狭い面でも全領域を保つ',()=>{
  const l=recommendedPage();expect(l.parts.upgrades.x).toBeGreaterThan(l.parts.generator.x+l.parts.generator.width);expect(l.parts.generator.width).toBe(BALANCE.pageDesign.partSizes.generator.extraLarge.width);expect(l.parts.generator.height).toBe(BALANCE.pageDesign.partSizes.generator.extraLarge.height);expect(l.parts.generator.x-l.parts.heading.x).toBe(l.parts.heading.x+l.parts.heading.width-(l.parts.generator.x+l.parts.generator.width));expect(l.parts.upgrades.y).toBe(l.parts.heading.y);expect(isRecommendedPage(l)).toBe(true);
  for(const width of [1920,1552,1366,800,480,352]){const f=fitPageLayout(l,width,720);expect(PAGE_PARTS.every(id=>validPagePlacement(f,id,f.parts[id]))).toBe(true);expect(isPageDesign({...createPageDesign(),layout:f})).toBe(true);expect(isRecommendedPage(f)).toBe(true);if(width>=1000)expect(f.parts.upgrades.x-f.parts.generator.x-f.parts.generator.width).toBeGreaterThanOrEqual(16);}
 });
 it('読めない文字色と色深度外を拒み、同じ工房の色の設定へ反映する',()=>{
  let s=actPageDesign(ready(),{type:'color',slot:'background',color:BASE_PALETTE[0]!});const c=pageColors(s.run.seed.page,0,s.persistent.editorCustomization);expect(contrast(c.background,c.text)).toBeGreaterThanOrEqual(4.5);expect(actPageDesign(s,{type:'color',slot:'text',color:BASE_PALETTE[0]!})).toBe(s);expect(actPageDesign(s,{type:'color',slot:'button',color:'#123456'})).toBe(s);
  s=actPageDesign(s,{type:'color',slot:'button',color:BASE_PALETTE[6]!});expect(s.persistent.editorCustomization.accent).toBe(BASE_PALETTE[6]);expect(s.persistent.editorCustomization.background).toBe(BASE_PALETTE[0]);const b=pageColors(s.run.seed.page,0,s.persistent.editorCustomization);expect(contrast(b.button,b.buttonText)).toBeGreaterThanOrEqual(4.5);expect(decodeSave(encodeSave(s)).run.seed.page).toEqual(s.run.seed.page);
 });
 it('色から作業台まで同じ実際の背景に合わせ、背景変更後も文字を読める色へ保つ',()=>{
  let s=creditPixels(createInitialState(now),100_000);
  for(const id of ['border','save','color','font','layout','motion','bars','workspace'] as const){
   s=buildSeed(s,id,now);
   if(s.run.seed.built.includes('color')){const c=pageColors(s.run.seed.page,s.persistent.specs.color,s.persistent.editorCustomization);expect(c.background).toBe('#5d6f7d');expect(contrast(c.background,c.text)).toBeGreaterThanOrEqual(4.5);}
  }
  s=actPageDesign(s,{type:'color',slot:'background',color:BASE_PALETTE[0]!});s=actPageDesign(s,{type:'color',slot:'text',color:BASE_PALETTE[4]!});expect(s.run.seed.page.text).toBe(BASE_PALETTE[4]);
  s=actPageDesign(s,{type:'color',slot:'background',color:BASE_PALETTE[4]!});const c=pageColors(s.run.seed.page,s.persistent.specs.color,s.persistent.editorCustomization);expect(c.text).not.toBe(BASE_PALETTE[4]);expect(contrast(c.background,c.text)).toBeGreaterThanOrEqual(4.5);expect(decodeSave(encodeSave(s)).run.seed.page).toEqual(s.run.seed.page);
 });
 it.each([[0,'#5d6f7d'],[1,'#29292f'],[2,'#2b2b2b']] as const)('段%iの素の画面と工房が標準背景を共有し、明示した紫と標準を区別する',(stage,expected)=>{
  let s=ready();s.persistent.editorSkills=['update','modern'];s.persistent.desktopPrefs.skills=['major1','major2','major3'];s.persistent.appearance.editor=stage;s.run.seed.page.background=BASE_PALETTE[0]!;
  const current=()=>pageColors(s.run.seed.page,s.persistent.specs.color,s.persistent.editorCustomization,stage);
  expect(current().background).toBe(expected);expect(contrast(current().background,current().text)).toBeGreaterThanOrEqual(4.5);
  s=actPageDesign(s,{type:'color',slot:'background',color:'#3a3450'});expect(s.persistent.editorCustomization.nativeBackground).toBe(false);expect(current().background).toBe('#3a3450');
  s=actPageDesign(s,{type:'color',slot:'background',color:null});expect(s.persistent.editorCustomization.nativeBackground).toBe(true);expect(current().background).toBe(expected);
  s=actPageDesign(s,{type:'color',slot:'background',color:'#3a3450'});s=decodeSave(encodeSave(s));expect(current().background).toBe('#3a3450');
  s=actPageDesign(s,{type:'reset'});expect(current().background).toBe(expected);expect(s.persistent.editorCustomization.nativeBackground).toBe(true);
  delete s.persistent.editorCustomization.nativeBackground;expect(current().background).toBe(expected);
 });
 it('工房で背景を変えて次の版へ戻った後も、書体を変えて読める設定を保存できる',()=>{
  let s=actPageDesign(ready(),{type:'color',slot:'background',color:BASE_PALETTE[1]!});s=actPageDesign(s,{type:'color',slot:'text',color:BASE_PALETTE[4]!});
  for(const id of ['bars','workspace','export'] as const)s=buildSeed(s,id,now);s.run.workshop.enterMs=0;
  s=actWorkshop(s,{type:'customize',patch:{background:BASE_PALETTE[4]!}},now);s.persistent.seedSkills.push('inherit');
  s=creditPixels(createSeedVersion(s,'v1',now),100_000);for(const id of ['border','save','color','font'] as const)s=buildSeed(s,id,now);
  expect(s.run.seed.page.background).toBe(BASE_PALETTE[1]);const current=pageColors(s.run.seed.page,0,s.persistent.editorCustomization);expect(current.background).toBe(BASE_PALETTE[4]);expect(contrast(current.background,current.text)).toBeGreaterThanOrEqual(4.5);
  s=actPageDesign(s,{type:'font',slot:'bodyFont',font:'mono'});expect(s.run.seed.page.background).toBe(BASE_PALETTE[4]);expect(s.run.seed.page.text).not.toBe(BASE_PALETTE[4]);expect(decodeSave(encodeSave(s)).run.seed.page).toEqual(s.run.seed.page);
 });
 it('生成の領域だけを動かしても、財布・毎秒・ほかの領域は変わらない',()=>{
  const s=ready(),l=structuredClone(s.run.seed.page.layout!);l.parts.generator.x+=8;l.parts.generator.width-=8;const n=actPageDesign(s,{type:'layout',layout:l});expect(n.run.seed.page.layout).toEqual(l);expect(n.run.seed.page.layout!.parts.heading).toEqual(s.run.seed.page.layout!.parts.heading);expect(n.resources).toEqual(s.resources);expect(passivePixelsPerSecond(n)).toBe(passivePixelsPerSecond(s));expect(isRecommendedPage(l)).toBe(false);
 });
 it('画面外・重なり・小さすぎる・格子外・NaNを拒み、標準へ戻せる',()=>{
  const s=ready();for(const p of [{x:-8},{x:1920},{width:8},{height:8},{x:13},{x:NaN},{y:s.run.seed.page.layout!.parts.heading.y}]){const l=structuredClone(s.run.seed.page.layout!);Object.assign(l.parts.generator,p);expect(actPageDesign(s,{type:'layout',layout:l})).toBe(s);}
  const l=structuredClone(s.run.seed.page.layout!);l.parts.generator.x+=8;l.parts.generator.width-=8;expect(actPageDesign(actPageDesign(s,{type:'layout',layout:l}),{type:'recommended'}).run.seed.page.layout).toEqual(recommendedPage());
 });
 it('ボタン自身の寸法だけを変更し、資源とカーソルの領域は変えない',()=>{
  const s=ready(),l=structuredClone(s.run.seed.page.layout!),original=structuredClone(l);
  for(const size of [{width:8,height:40},{width:160,height:8},{width:1920,height:40}])expect(actPageDesign(s,{type:'layout',layout:{...l,parts:{...l.parts,generator:{...l.parts.generator,...size}}}})).toBe(s);
  l.parts.generator={...l.parts.generator,width:320,height:40};const n=actPageDesign(s,{type:'layout',layout:l});
  expect(decodeSave(encodeSave(n)).run.seed.page.layout!.parts.generator).toEqual(l.parts.generator);
  expect(n.run.seed.page.layout!.parts.pixels).toEqual(original.parts.pixels);expect(n.run.seed.page.layout!.parts.cursors).toEqual(original.parts.cursors);expect(isGameState(n)).toBe(true);
 });
 it('書体の後だけ見出しを付け、作者や製品名を変えない',()=>{
  const empty=createInitialState(now);expect(actPageDesign(empty,{type:'heading',heading:'My editor'})).toBe(empty);const s=ready();s.persistent.playerName='Author';s.persistent.productName='Product';const n=actPageDesign(s,{type:'heading',heading:'My editor'});expect(n.run.seed.page.heading).toBe('My editor');expect(n.persistent.playerName).toBe('Author');expect(n.persistent.productName).toBe('Product');expect(actPageDesign(n,{type:'heading',heading:'x'.repeat(100)}).run.seed.page.heading).toHaveLength(80);
 });
});
