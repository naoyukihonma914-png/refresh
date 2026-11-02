import { decodeCapture, type Screenshot } from './desktopState';
import { encodeScene, isCaptureScene, normalizeCapture, type CaptureScene } from './captureScene';
import { paletteFor } from '../content/palette';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Read schema-6 recordings as a historical document, without instantiating an old game. */
export function migrateCaptureV6(shot:Screenshot):Screenshot {
  const value=decodeCapture(shot.data);
  if(isCaptureScene(value))return shot;
  if(!record(value)||value.schemaVersion!==6||!record(value.run)||value.run.world!=='desktop'||!record(value.persistent)||!Array.isArray(value.persistent.screenshots)||value.persistent.screenshots.length!==0||!record(value.run.desktop)||!record(value.persistent.specs))throw new Error('Invalid version-6 screenshot');
  const d=value.run.desktop,p=value.persistent,specs=p.specs as CaptureScene['display']['specs'];
  if(!Array.isArray(d.feedback))throw new Error('Invalid historical feedback');
  const feedback=d.feedback.map(f=>{if(!record(f))throw new Error('Invalid historical feedback');return {id:f.id,kind:f.kind,target:f.target,at:f.at,completedAt:f.completedAt,sender:f.sender??'hikari'};});
  const scene={version:1,archived:true,
    display:{resources:value.resources,specs,productName:p.productName,runVersion:value.run.version,notation:p.numberNotation,savedAt:value.lastSavedAt,rate:0,parts:0,reward:0,cooldown:0,checks:[false,false,false,false,false],shotCount:0,shotBytes:0,fileCount:0,wallTime:value.lastTickAt,managerShotRate:0,managerTokenRate:0},
    desktop:{apps:d.apps,windows:d.windows,active:d.active,icons:d.icons,cooldownMs:d.cooldownMs,fileFolder:d.fileFolder,fileSelection:d.fileSelection,mailSelection:d.mailSelection,notice:d.notice,success:d.success,feedback},
    view:{preferences:{skills:[],disabled:[],mode:'light',accent:'#0067c0',radius:0,radiusCustom:false,iconSize:48,slideshow:false,wallpaper:null,lastShotId:0},photo:{source:'coast',brightness:1,tone:0,crop:0},desktop:{}},
    appearance:{editor:0,desktop:0},screen:{width:1920,height:1080},note:p.productionNote??'',files:[],palette:paletteFor(specs.color),
  };
  return {...shot,data:encodeScene(normalizeCapture(scene))};
}
