import {createServer} from '../game/node_modules/vite/dist/node/index.js';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root:resolve(root,'game'),server:{middlewareMode:true,hmr:false,ws:false},logLevel:'error'});
try{
 const {BALANCE}=await server.ssrLoadModule('/src/config/balance.ts');
 const result=spawnSync('python',[resolve(root,'tools/economy_stage65.py')],{input:JSON.stringify(BALANCE),encoding:'utf8',timeout:30000});
 if(result.status!==0)throw new Error(result.error?.message||result.stderr);
 const report=JSON.parse(result.stdout),out=resolve(root,'game/artifacts/stage65/economy.json');mkdirSync(resolve(root,'game/artifacts/stage65'),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({appendixHours:report.appendixE.v1Hours,implementationHours:report.implementationModel.v1Hours,withinTarget:report.implementationModel.withinSixToEightHours,report:out},null,2));
}finally{await server.close()}
