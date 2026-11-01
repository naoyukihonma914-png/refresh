import {afterEach,describe,it,expect,vi} from 'vitest';
import {createAudio,type SoundKind} from './audio';
afterEach(()=>vi.unstubAllGlobals());
describe('合成する効果音',()=>{
 it('ユーザーの操作前には音声機能を起動せず、同じ音を毎秒8回までに抑える',()=>{
  const oscillators:{type:string}[]=[],frequency={setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},gain={gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn()};
  const context={currentTime:0,state:'running',destination:{},createOscillator:vi.fn(()=>{const o={type:'sine',frequency,connect:vi.fn(()=>gain),start:vi.fn(),stop:vi.fn()};oscillators.push(o);return o;}),createGain:vi.fn(()=>gain),close:vi.fn(async()=>{})};
  const Constructor=vi.fn(function(){return context});vi.stubGlobal('AudioContext',Constructor);vi.stubGlobal('navigator',{userActivation:{hasBeenActive:false}});const audio=createAudio();audio.play({kind:'press',world:'seed',volume:.15});expect(Constructor).not.toHaveBeenCalled();
  vi.stubGlobal('navigator',{userActivation:{hasBeenActive:true}});for(let i=0;i<20;i++)audio.play({kind:'press',world:'kumiki',volume:.15});expect(oscillators).toHaveLength(8);expect(oscillators.every(o=>o.type==='square')).toBe(true);context.currentTime=1.01;audio.play({kind:'press',world:'desktop',volume:.15});expect(oscillators).toHaveLength(9);expect(oscillators.at(-1)!.type).toBe('sine');for(const kind of ['press','build','export','screenshot','notification','release'] as SoundKind[])audio.play({kind,world:'seed',volume:.15});expect(oscillators.slice(-6).every(o=>o.type==='triangle')).toBe(true);expect(new Set(frequency.setValueAtTime.mock.calls.slice(-6).map(args=>args[0])).size).toBe(6);audio.dispose();expect(context.close).toHaveBeenCalledOnce();
 });
 it('無音・音声API不在でも例外をゲームへ伝えない',()=>{
  vi.stubGlobal('navigator',{userActivation:{hasBeenActive:true}});vi.stubGlobal('AudioContext',undefined);const audio=createAudio();for(const kind of ['press','build','export','screenshot','notification','release'] as SoundKind[])expect(()=>audio.play({kind,world:'seed',volume:.15})).not.toThrow();expect(()=>audio.play({kind:'press',world:'seed',volume:0})).not.toThrow();audio.dispose();
 });
});
