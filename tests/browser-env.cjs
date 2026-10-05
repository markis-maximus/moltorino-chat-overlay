'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

function launch(options={}){
  const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||process.env.PLAYWRIGHT_EXECUTABLE;
  return chromium.launch({...options,headless:options.headless!==false,...(executablePath?{executablePath}:{})});
}

module.exports={chromium,launch};
