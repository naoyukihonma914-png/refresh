import {describe,expect,it} from 'vitest';
import {evaluateVisibility,rectangleArea,subtractRect,unionRects,type CaptureElement} from './captureVisibility';

const viewport={x:0,y:0,width:800,height:600};
const part=(id:string,x:number,y:number,width=100,height=40,layer=1):CaptureElement=>({id,type:id,rects:[{x,y,width,height}],layer,app:'back'});
describe('写真に写った内容の幾何',()=>{
 it('上の窓が全面を覆う部品だけを除き、見えた根拠の矩形を残す',()=>{
  const result=evaluateVisibility([part('behind',10,10),part('outside',250,10)],[{id:'front',layer:2,rect:{x:0,y:0,width:200,height:200}}],viewport);
  expect(result.visibleCount).toBe(1);expect(result.fullyHidden).toBe(1);
  expect(result.parts[0]).toMatchObject({visible:false,visibleArea:0,hiddenArea:4000,visibleRects:[]});
  expect(result.parts[1]!.visibleRects).toEqual([{x:250,y:10,width:100,height:40}]);
 });
 it('一部だけ残る場合は1部品。露出した面積や並べ方を得点にはしない',()=>{
  const elements=[part('button',0,0,100,40)];
  const full=evaluateVisibility(elements,[],viewport);
  const sliver=evaluateVisibility(elements,[{id:'front',layer:2,rect:{x:1,y:0,width:99,height:40}}],viewport);
  expect(sliver.visibleCount).toBe(full.visibleCount);expect(sliver.kinds).toBe(full.kinds);
  expect(sliver.parts[0]!.visibleRects).toEqual([{x:0,y:0,width:1,height:40}]);
 });
 it('複数の前面窓を差し引き、重なる遮蔽を二重に差し引かない',()=>{
  const result=evaluateVisibility([part('wide',0,0,300,100)],[
   {id:'front-left',layer:2,rect:{x:0,y:0,width:180,height:100}},
   {id:'front-right',layer:3,rect:{x:120,y:0,width:180,height:100}},
  ],viewport);
  expect(result.visibleCount).toBe(0);expect(result.parts[0]!.hiddenArea).toBe(30000);
 });
 it('画面の外・ゼロ面積・不正数値を数えず、窓自身で自身を隠さない',()=>{
  const result=evaluateVisibility([part('partial',-50,0),part('offscreen',900,0),part('zero',0,0,0),part('invalid',Number.NaN,0)],
   [{id:'back',layer:2,rect:viewport}],viewport);
  expect(result.visibleCount).toBe(1);expect(result.parts[0]!.visibleArea).toBe(2000);
  expect(result.parts.slice(1).every(item=>!item.visible)).toBe(true);
 });
 it('同じ部品を描く複数roleの領域をunionし、1部品として数える',()=>{
  const element=part('list',0,0);element.rects.push({x:50,y:0,width:100,height:40});
  const result=evaluateVisibility([element],[],viewport);
  expect(result.visibleCount).toBe(1);expect(result.parts[0]!.area).toBe(6000);
  expect(result.parts[0]!.visibleArea).toBe(6000);
 });
 it('入力の位置や保存値を変更せず、前後関係を逆にすると可視内容だけが変わる',()=>{
  const elements=[part('one',0,0)],covers=[{id:'front',layer:0,rect:{x:0,y:0,width:100,height:40}}];
  const original=structuredClone({elements,covers});
  expect(evaluateVisibility(elements,covers,viewport).visibleCount).toBe(1);
  expect(evaluateVisibility(elements,[{...covers[0]!,layer:2}],viewport).visibleCount).toBe(0);
  expect({elements,covers}).toEqual(original);
 });
 it('境界で接しているだけの矩形を遮蔽にせず、差分とunionの面積を保存する',()=>{
  const subject={x:0,y:0,width:100,height:100};
  expect(subtractRect(subject,{x:100,y:0,width:100,height:100})).toEqual([subject]);
  const pieces=subtractRect(subject,{x:20,y:30,width:40,height:50});
  expect(pieces.reduce((sum,piece)=>sum+rectangleArea(piece),0)).toBe(8000);
  expect(unionRects([subject,subject]).reduce((sum,piece)=>sum+rectangleArea(piece),0)).toBe(10000);
 });
 it('実表示の拡縮から出る浮動小数点の残差だけを露出した部品として数えない',()=>{
  const result=evaluateVisibility([part('covered',0,0,100,40)],[{id:'front',layer:2,rect:{x:1e-10,y:0,width:100,height:40}}],viewport);
  expect(result.visibleCount).toBe(0);
  expect(evaluateVisibility([part('real-sliver',0,0,100,40)],[{id:'front',layer:2,rect:{x:0.5,y:0,width:100,height:40}}],viewport).visibleCount).toBe(1);
 });
});
