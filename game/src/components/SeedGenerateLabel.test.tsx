import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createI18n} from '../content/i18n';
import {SeedGenerateLabel,seedGenerateLabelMode} from './SeedGenerateLabel';

describe('小さい生成ボタンでも、選択した文字サイズを変えず内容を収める',()=>{
 it('全文が入るときは省略せず、行の高さだけ足りないときはピクセル記号と数にする',()=>{
  expect(seedGenerateLabelMode({width:132,height:28},{width:132,height:24},{width:70,height:24})).toBe('full');
  expect(seedGenerateLabelMode({width:132,height:28},{width:132,height:48},{width:70,height:24})).toBe('compact');
 });
 it('長い数や大きな文字が数表示にも収まらなければ記号だけへ切り替え、広げれば全文へ戻る',()=>{
  const full={width:132,height:72},compact={width:160,height:24};
  expect(seedGenerateLabelMode({width:132,height:28},full,compact)).toBe('icon');
  expect(seedGenerateLabelMode({width:132,height:20},full,{width:70,height:24})).toBe('icon');
  expect(seedGenerateLabelMode({width:320,height:80},full,compact)).toBe('full');
 });
 for(const language of ['ja','en','en-XA'])it(`${language}: 元の操作名とアニメーション用styleを保ち、測定用の重複文面を支援技術から隠す`,()=>{
  const i18n=createI18n(language),caption=i18n.t('seed.generate',{count:1234}),gain=i18n.pixels(1234);
  const markup=renderToStaticMarkup(<button aria-label={caption} title={caption}><SeedGenerateLabel fullCaption={caption} formattedGain={gain} style={{transform:'translateY(2px)',opacity:.8}}/></button>);
  expect(markup).toContain(`aria-label="${caption}"`);expect(markup).toContain(`title="${caption}"`);expect(markup).toContain('data-seed-generate-label="full"');
  expect(markup).toContain('seed-generate-label-measure" aria-hidden="true"');expect(markup).toContain('data-seed-generate-probe="full"');expect(markup).toContain('data-seed-generate-probe="compact"');
  expect(markup).toContain('transform:translateY(2px);opacity:0.8');expect(markup).toContain('aria-hidden="true" focusable="false"');
 });
});
