import {spawn} from 'node:child_process';
import process from 'node:process';

const port=Number(process.env.OVERLAY_TEST_PORT||18766);
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,OVERLAY_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let serverError='';
server.stderr.on('data',chunk=>{serverError+=chunk;});

async function ready(){
  for(let attempt=0;attempt<50;attempt++){
    if(server.exitCode!==null)throw new Error(`Test server stopped early: ${serverError.trim()}`);
    try{const response=await fetch(base+'/health');if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Timed out waiting for the local test server.');
}

function run(file,extraEnv={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[file,'--assert'],{env:{...process.env,...extraEnv},stdio:'inherit'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file} exited with ${code}`)));
  });
}

try{
  await ready();
  await run('tests/browser-smoke.cjs');
  await run('tests/filename-channel.cjs');
  await run('tests/stacking-regression.cjs');
  await run('tests/layout-regression.cjs',{OVERLAY_TEST_URL:base+'/overlay.html?channel=test_channel&offline=1&test=1'});
}finally{
  server.kill();
}
