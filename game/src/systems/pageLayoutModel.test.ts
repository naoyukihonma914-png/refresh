import {describe,expect,it} from 'vitest';
import {BALANCE} from '../config/balance';
import {creditPixels,passivePixelsPerSecond} from './economy';
import {actPageDesign,canSetPagePartSize,createPageDesign,fitPageLayout,initialPageLayout,isPageDesign,isRecommendedPage,PAGE_PARTS,PAGE_PART_SIZES,pagePartFontSize,pagePartSize,recommendedPage,setPagePartSize,validPagePlacement} from './pageDesign';
import {buildSeed,createSeedVersion} from './seed';
import {decodeSave,encodeSave} from './save';
import {createInitialState,isGameState} from './state';
const now=1_800_000_000_000;
function ready(){let s=creditPixels(createInitialState(now),100_000);for(const id of ['border','save','color','font','layout'] as const)s=buildSeed(s,id,now);return s;}
describe('TP1: 独立した6つの配置部品',()=>{
 it('初期と配置解放後の両方で6個を持ち、通知/数値の有無から座標を計算しない',()=>{
  expect(PAGE_PARTS).toEqual(['heading','notice','pixels','generator','cursors','upgrades']);
  for(const width of [1920,1366,1000,800,480,352])for(const initial of [true,false]){
   const layout=initial?initialPageLayout(width,720):recommendedPage(width,720);
   expect(isPageDesign({...createPageDesign(),layout})).toBe(true);
   expect(PAGE_PARTS.every(id=>validPagePlacement(layout,id,layout.parts[id]))).toBe(true);
   expect(layout.parts.generator.width).toBeLessThanOrEqual(BALANCE.pageDesign.partSizes.generator.large.width);
  }
  const a=initialPageLayout(),b=recommendedPage();expect(a.parts.generator).not.toEqual(b.parts.generator);
  expect(a.parts.pixels).toEqual(b.parts.pixels);
 });
 it('JSONキーの順だけが違う標準レイアウトを別の作品と誤判定しない',()=>{
  const layout=recommendedPage(),reordered={...layout,parts:Object.fromEntries([...PAGE_PARTS].reverse().map(id=>[id,layout.parts[id]])) as typeof layout.parts};
  expect(isRecommendedPage(reordered)).toBe(true);expect(fitPageLayout(reordered,1366,720)).toEqual(recommendedPage(1366,720));
 });
 it('3つのボタンpresetだけを変え、他の5部品と財布/生成量は同じ',()=>{
  const original=ready(),before=structuredClone(original.run.seed.page.layout!);
  for(const size of PAGE_PART_SIZES){
   expect(canSetPagePartSize(before,'generator',size)).toBe(true);
   const next=actPageDesign(original,{type:'part-size',part:'generator',size}),layout=next.run.seed.page.layout!;
   expect(layout.parts.generator).toMatchObject(BALANCE.pageDesign.partSizes.generator[size]);
   expect(pagePartSize(layout,'generator')).toBe(size);
   expect(layout.parts.generator.x).toBe(before.parts.generator.x);expect(layout.parts.generator.y).toBe(before.parts.generator.y);
   for(const id of PAGE_PARTS.filter(id=>id!=='generator'))expect(layout.parts[id]).toEqual(before.parts[id]);
   expect(next.resources).toEqual(original.resources);expect(passivePixelsPerSecond(next)).toBe(passivePixelsPerSecond(original));
   expect(decodeSave(encodeSave(next)).run.seed.page).toEqual(next.run.seed.page);
  }
 });
 it('すべての部品にsize選択の置き場があり、満杯ならほかを押し退けず拒む',()=>{
  const page=recommendedPage();
  for(const id of PAGE_PARTS)for(const size of PAGE_PART_SIZES){
   const result=setPagePartSize(page,id,size);
   if(result){expect(validPagePlacement(result,id,result.parts[id])).toBe(true);for(const sibling of PAGE_PARTS.filter(p=>p!==id))expect(result.parts[sibling]).toEqual(page.parts[sibling]);}
  }
  const narrow=recommendedPage(352,720),copy=structuredClone(narrow);
  expect(canSetPagePartSize(narrow,'generator','extraLarge')).toBe(false);expect(setPagePartSize(narrow,'generator','extraLarge')).toBeNull();expect(narrow).toEqual(copy);
 });
 it('部品ごとの文字段階は独立し、画面の書体と他部品の選択を保持する',()=>{
  const s=ready(),base=s.run.seed.page;
  const next=actPageDesign(s,{type:'part-font',part:'generator',size:'large'});
  expect(pagePartFontSize(next.run.seed.page,'generator')).toBe(BALANCE.pageDesign.partFontSizes.large);
  expect(next.run.seed.page.partFonts.heading).toBe(base.partFonts.heading);expect(next.run.seed.page.bodyFont).toBe(base.bodyFont);
  expect(next.run.seed.page.layout).toEqual(base.layout);expect(decodeSave(encodeSave(next)).run.seed.page).toEqual(next.run.seed.page);
  const locked=createInitialState(now);expect(actPageDesign(locked,{type:'part-font',part:'generator',size:'large'})).toBe(locked);expect(actPageDesign(locked,{type:'part-size',part:'generator',size:'large'})).toBe(locked);
 });
 it('初回の紹介済み印は明示表示時だけ付き、reset/周回後も消えない',()=>{
  let s=ready();expect(s.persistent.testplay.layoutGuideSeen).toBe(false);
  s=actPageDesign(s,{type:'layout-guide-seen'});expect(s.persistent.testplay.layoutGuideSeen).toBe(true);expect(actPageDesign(s,{type:'layout-guide-seen'})).toBe(s);
  s=actPageDesign(s,{type:'reset'});expect(s.persistent.testplay.layoutGuideSeen).toBe(true);
  s=createSeedVersion(s,'v1',now+1);expect(s.persistent.testplay.layoutGuideSeen).toBe(true);expect(decodeSave(encodeSave(s)).persistent.testplay.layoutGuideSeen).toBe(true);
  expect(actPageDesign(createInitialState(now),{type:'layout-guide-seen'}).persistent.testplay.layoutGuideSeen).toBe(false);
 });
 it('画面の縮小は保存元を書き換えず、6つを常に画面内/非重複に射影する',()=>{
  const source=setPagePartSize(recommendedPage(),'generator','extraLarge')!,saved=structuredClone(source);
  for(const width of [1920,1366,800,352]){const fitted=fitPageLayout(source,width,720);expect(isPageDesign({...createPageDesign(),layout:fitted})).toBe(true);expect(PAGE_PARTS.every(id=>validPagePlacement(fitted,id,fitted.parts[id]))).toBe(true);}
  expect(source).toEqual(saved);
 });
 it('不明な部品/文字段階、旧button拡張、欠けたrect、危険な数値を拒む',()=>{
  const page=createPageDesign(),layout=recommendedPage();
  expect(isPageDesign({...page,layout:{...layout,button:{width:320,height:80}}})).toBe(false);
  expect(isPageDesign({...page,partFonts:{...page.partFonts,generator:'giant'}})).toBe(false);
  const broken=structuredClone(layout) as unknown as {parts:Record<string,unknown>};delete broken.parts.cursors;broken.parts.fake={x:0,y:0,width:8,height:8};expect(()=>isPageDesign({...page,layout:broken})).not.toThrow();expect(isPageDesign({...page,layout:broken})).toBe(false);
  const s=ready();for(const patch of [{width:NaN},{x:-8},{width:8},{height:8}]){const unsafe=structuredClone(layout);Object.assign(unsafe.parts.generator,patch);expect(actPageDesign(s,{type:'layout',layout:unsafe})).toBe(s);}
  const invalid=structuredClone(s) as unknown as {persistent:{testplay:unknown}};invalid.persistent.testplay={layoutGuideSeen:true,helpSeen:['fake']};expect(isGameState(invalid)).toBe(false);
 });
});
