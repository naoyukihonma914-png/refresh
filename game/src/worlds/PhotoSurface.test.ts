import { expect,it } from 'vitest';
import { photographPolicy } from './PhotoSurface';
it('壁紙・写真・記録した画面が共有する写真の表示は256色だけ各色6段階にし、解像度を保持する',()=>{
 for(const resolution of [0,1,2,3]){
  expect(photographPolicy({color:1,resolution})).toEqual({colorSteps:6,resolution});
  for(const color of [0,2,3])expect(photographPolicy({color,resolution}).colorSteps).toBeNull();
 }
});
