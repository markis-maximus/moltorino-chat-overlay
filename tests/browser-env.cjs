'use strict';

const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {chromium}=engines;

function launch(options={}){
  const name=process.env.OVERLAY_BROWSER||'chromium';
  if(!['chromium','firefox','webkit'].includes(name))throw Error('Unsupported test browser: '+name);
  const executablePath=name==='chromium'&&(process.env.PLAYWRIGHT_EXECUTABLE_PATH||process.env.PLAYWRIGHT_EXECUTABLE);
  return engines[name].launch({...options,headless:options.headless!==false,...(executablePath?{executablePath}:{})});
}

module.exports={chromium,launch};
