import { decodeCapture, type Screenshot } from './desktopState';
import { encodeScene, isCaptureScene, projectCaptureV1 } from './captureScene';
import type { GameState } from './state';
// Historical v6 recordings are converted directly to presentation format 1.
// Never validate a historical recording against the current GameState schema.
export function migrateCaptureV6(shot:Screenshot):Screenshot {
  const value=decodeCapture(shot.data) as GameState;
  if(isCaptureScene(value))return shot;
  if(!value||Number(value.schemaVersion)!==6||value.run?.world!=='desktop'||!Array.isArray(value.persistent?.screenshots)||value.persistent.screenshots.length!==0)throw new Error('Invalid version-6 screenshot');
  const next={...value,persistent:{...value.persistent,homeUpdatedAt:null,sketchUpdatedAt:null},run:{...value.run,desktop:{...value.run.desktop,feedback:value.run.desktop.feedback.map(f=>({...f,sender:f.sender??'hikari'}))}}} as GameState;
  return {...shot,data:encodeScene(projectCaptureV1(next,shot.language))};
}
