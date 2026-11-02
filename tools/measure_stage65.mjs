import {createServer} from '../game/node_modules/vite/dist/node/index.js';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const targetAt=process.argv.indexOf('--target-hours');
const targetHours=targetAt<0?[6,8]:process.argv.slice(targetAt+1,targetAt+3).map(Number);
if(targetHours.length!==2||targetHours.some(n=>!Number.isFinite(n)||n<=0)||targetHours[0]>targetHours[1])throw new Error('--target-hours requires a positive minimum and maximum');
const server=await createServer({root:resolve(root,'game'),server:{middlewareMode:true,hmr:false,ws:false},logLevel:'error'});
try{
 const {BALANCE}=await server.ssrLoadModule('/src/config/balance.ts');
 const result=spawnSync('python',[resolve(root,'tools/economy_stage65.py')],{input:JSON.stringify(BALANCE),encoding:'utf8',timeout:30000});
 if(result.status!==0)throw new Error(result.error?.message||result.stderr);
 const report=JSON.parse(result.stdout),out=resolve(root,arg('--out','game/artifacts/stage65/economy.json'));
 report.assessment={targetHours,withinTarget:targetHours[0]<=report.implementationModel.v1Hours&&report.implementationModel.v1Hours<=targetHours[1]};
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({appendixHours:report.appendixE.v1Hours,implementationHours:report.implementationModel.v1Hours,...report.assessment,report:out},null,2));
}finally{await server.close()}
