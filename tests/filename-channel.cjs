'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results','chat-my_channel.html');
(async()=>{
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.copyFileSync(path.join(root,'dist','chat-jynxzi.html'),out);
 const browser=await launch();
 try{
  const page=await browser.newPage();
  await page.goto(pathToFileURL(out).href+'?offline=1');
  const state=await page.evaluate(()=>OverlayApp.getStatus());
  assert.equal(state.channel,'my_channel');
  assert.equal(state.version,'0.2.5');
  console.log('Renamed standalone file selected channel:',state.channel);
 }finally{await browser.close();fs.rmSync(out,{force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
