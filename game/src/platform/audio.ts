import {BALANCE} from '../config/balance';
export type SoundKind='press'|'build'|'export'|'screenshot'|'notification'|'release';
export type SoundWorld='seed'|'kumiki'|'desktop';
export interface SoundRequest {kind:SoundKind;world:SoundWorld;volume:number}
export function createAudio(){
 let context:AudioContext|undefined;const history=new Map<SoundKind,number[]>();
 return {play({kind,world,volume}:SoundRequest){
  if(!(volume>0)||!navigator.userActivation?.hasBeenActive)return;
  try{
   context??=new AudioContext();if(context.state==='suspended')void context.resume().catch(()=>{});
   const now=context.currentTime,previous=(history.get(kind)??[]).filter(t=>now-t<1);if(previous.length>=BALANCE.longPlay.soundPerSecond)return;history.set(kind,[...previous,now]);
   const tones={press:440,build:660,export:880,screenshot:520,notification:740,release:1040},duration=kind==='release'?.32:kind==='build'?.16:.065;
   const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=world==='kumiki'?'square':world==='seed'?'triangle':'sine';oscillator.frequency.setValueAtTime(tones[kind]*(world==='desktop'?.65:1),now);oscillator.frequency.exponentialRampToValueAtTime(tones[kind]*.7,now+duration);
   gain.gain.setValueAtTime(Math.min(1,Math.max(0,volume))*(world==='kumiki'?.08:.18),now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(context.destination);oscillator.start(now);oscillator.stop(now+duration);
  }catch{/* Audio can be unavailable; gameplay and saving continue. */}
 },dispose(){void context?.close().catch(()=>{});context=undefined;history.clear();}};
}
