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
  const fileState=await page.evaluate(()=>OverlayApp.getStatus());
  assert.equal(fileState.channel,'my_channel');
  assert.equal(fileState.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
  const html=fs.readFileSync(path.join(root,'dist','chat-channelname.html'),'utf8');
  await page.route('http://absolute/**',route=>route.fulfill({contentType:'text/html',body:html}));
  const obsChannels=[];
  for(const [address,channel] of [
   ['http://absolute/D:/Downloads/chat-windows_channel.html?offline=1','windows_channel'],
   ['http://absolute/Users/streamer/Downloads/chat-macos_channel.html?offline=1','macos_channel'],
   ['http://absolute/home/streamer/chat-linux_channel.html?offline=1','linux_channel'],
  ]){
   await page.goto(address);const state=await page.evaluate(()=>OverlayApp.getStatus());assert.equal(state.channel,channel);obsChannels.push(state.channel);
  }
  console.log('Renamed standalone channels:',{file:fileState.channel,obs:obsChannels});
 }finally{await browser.close();fs.rmSync(out,{force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
