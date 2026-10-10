'use strict';
// Review reproductions only. Does not alter application code or contact public chat.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {launch}=require('../tests/browser-env.cjs');
const root=path.resolve(__dirname,'..'),report={checkedAt:new Date().toISOString(),engine:process.env.OVERLAY_BROWSER||'chromium',browser:[],data:[]};
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function context(extra={}){const c=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,...extra});vm.runInContext(read('cosmetics.js'),c);return c;}
async function dataChecks(){
 const c=context(),service=c.OverlayCosmetics.create();
 service.ingestBttv({name:'lookup_user',data:{providerId:'42',badge:{url:'https://example.test/pro.png'}}});
 service.ingestBttv({name:'lookup_user',data:{providerId:'42',badge:null}});
 report.data.push({case:'bttv-badge-removal',remaining:service.profile({userId:'42'}).badges.map(b=>b.source)});service.close();
 const tasks=new Map(),sockets=[];let seq=0;
 class WebSocket{constructor(){this.readyState=0;sockets.push(this);}send(){}close(){this.readyState=3;this.onclose?.();}}
 const t=vm.createContext({WebSocket,console,Date,Math,Set,setTimeout:(fn,delay)=>{const id=++seq;tasks.set(id,{fn,delay});return id;},clearTimeout:id=>tasks.delete(id)});vm.runInContext(read('transport.js'),t);
 const notices=[];const connection=t.OverlayTransport.connect('test_channel',{onMessage:m=>notices.push(m)});const connectingTimers=tasks.size;
 sockets[0].readyState=1;sockets[0].onopen();sockets[0].onmessage({data:'@room-id=99 :tmi.twitch.tv ROOMSTATE #test_channel\r\n'});
 report.data.push({case:'chat-watchdogs',connectingTimers,joinedTimers:tasks.size});
 for(const kind of ['announcement','resub'])sockets[0].onmessage({data:`@room-id=99;msg-id=${kind};user-id=42;display-name=Viewer :tmi.twitch.tv USERNOTICE #test_channel :User text in ${kind}\r\n`});
 report.data.push({case:'usernotice-text',inputMessages:2,displayedMessages:notices.length});connection.close();
 let resolveOld,first=true;
 const p=vm.createContext({URL,AbortController,setTimeout,clearTimeout,fetch:async endpoint=>{
  let data=[];if(endpoint.includes('/room/'))data={room:{twitch_id:'42'},sets:{}};
  if(endpoint.endsWith('/3/cached/emotes/global')){if(first){first=false;return new Promise(r=>resolveOld=r);}data=[{id:'new',code:'NewGlobal'}];}
  return {ok:true,json:async()=>data};
 }});vm.runInContext(read('providers.js'),p);
 const older=p.OverlayProviders.load('test_channel'),newer=await p.OverlayProviders.load('test_channel');
 resolveOld({ok:true,json:async()=>[{id:'old',code:'OldGlobal'}]});await older;
 p.fetch=async()=>{throw Error('Offline');};const cached=await p.OverlayProviders.load('test_channel');
 report.data.push({case:'emote-cache-refresh-race',newer:[...newer.emotes.keys()],cachedAfterOlder:[...cached.emotes.keys()]});
 p.fetch=async endpoint=>({ok:true,json:async()=>endpoint.includes('/set/global')?{sets:{1:{emoticons:{}}}}:endpoint.includes('/room/')?{room:{twitch_id:'42'},sets:{}}:endpoint.endsWith('/3/cached/emotes/global')?[{id:'valid',code:'ValidBTTV'}]:[]});
 let firstError,cachedError;
 try{await p.OverlayProviders.load('test_channel');}catch(e){firstError=e.message;}
 p.fetch=async()=>{throw Error('Offline');};try{await p.OverlayProviders.load('test_channel');}catch(e){cachedError=e.message;}
 report.data.push({case:'malformed-provider-poisons-cache',firstError,cachedError});
}
(async()=>{
 await dataChecks();const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:700,height:500}});
  await page.route('**/*',route=>{
   const u=route.request().url();
   if(u.startsWith('http://review.test/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="chat"></main><output id="status"></output></body></html>'});
   if(u==='https://assets.test/broken')return route.abort();
   if(u.startsWith('https://assets.test/'))return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${u.endsWith('/wide')?96:32}" height="32"><rect width="100%" height="100%" fill="lime"/></svg>`});
   return route.abort();
  });
  await page.goto('http://review.test/?channel=test_channel&offline=1&test=1&demo=0');await page.addStyleTag({path:path.join(root,'overlay.css')});
  for(const file of ['modifiers.js','cosmetics.js','renderer.js','app.js'])await page.addScriptTag({path:path.join(root,file)});
  report.browser.push(...await page.evaluate(async()=>{
   const out=[],chat=document.getElementById('chat'),frame=()=>new Promise(requestAnimationFrame);
   const base={name:'Base',id:'base',url:'https://assets.test/base',width:32,height:32};
   const layer={name:'Layer',id:'layer',url:'https://assets.test/wide',width:0,height:0,zeroWidth:true};
   const catalog=new Map([['Base',base],['Layer',layer]]);
   const slide=OverlayRenderer.render({text:'Base Layer ffzSlide'},catalog,{names:false,emoteSize:36});chat.append(slide);
   await Promise.all([...slide.querySelectorAll('img')].map(img=>img.decode()));await new Promise(r=>setTimeout(r,100));await frame();
   out.push({case:'slide-unknown-overlay-size',widths:[...slide.querySelectorAll('.emote-zero')].map(img=>img.getBoundingClientRect().width),natural:[...slide.querySelectorAll('.emote-zero')].map(img=>[img.naturalWidth,img.naturalHeight])});
   const broken=OverlayRenderer.render({text:'Broken'},new Map([['Broken',{...base,name:'Broken',url:'https://assets.test/broken',fallbackUrl:'https://assets.test/base'}]]),{names:false});chat.append(broken);
   await new Promise(resolve=>setTimeout(resolve,100));out.push({case:'static-image-fallback',fallbackText:broken.textContent,remainingImages:broken.querySelectorAll('img').length});
   const message={username:'badgeuser',text:'Badges'},first={id:'a',source:'hc',url:'https://assets.test/base'};
   const row=OverlayRenderer.render(message,catalog,{cosmeticsProfile:{badges:[first]}});chat.append(row);const original=row.querySelector('.badge');
   OverlayRenderer.decorate(row,message,{cosmeticsProfile:{badges:[first,{id:'b',source:'7',url:'https://assets.test/base'}]}});
   out.push({case:'unchanged-badge-on-other-provider-update',sameNode:original===row.querySelector('.badge')});
   const span=document.createElement('span');span.textContent='Paint';
   OverlayCosmetics.applyPaint(span,{id:'same',function:'RADIAL_GRADIENT',stops:[{at:0,color:0xff0000ff}]},'#ffffff');chat.append(span);
   OverlayCosmetics.applyPaint(span,{id:'same',function:'RADIAL_GRADIENT',stops:[{at:0,color:0x0000ffff}]},'#ffffff');
   const before=getComputedStyle(span).color;await frame();out.push({case:'radial-deferred-update-race',before,after:getComputedStyle(span).color});
   return out;
  }));
  // Start a separate app with controlled provider completion order.
  const live=await browser.newPage();await live.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main id="chat"></main><output id="status"></output>'}));
  await live.goto('http://review.test/?channel=test_channel&test=1&demo=0');
  await live.addStyleTag({path:path.join(root,'overlay.css')});
  for(const file of ['modifiers.js','renderer.js'])await live.addScriptTag({path:path.join(root,file)});
  await live.evaluate(()=>{globalThis.pendingLoads=[];globalThis.OverlayTransport={connect:()=>({close(){}})};globalThis.OverlayProviders={load:()=>new Promise(resolve=>pendingLoads.push(resolve))};});
  await live.addScriptTag({path:path.join(root,'app.js')});
  report.browser.push(await live.evaluate(async()=>{
   const done=data=>({channelId:'42',emotes:new Map([['Token',{id:data,name:'Token',url:'https://assets.test/'+data,width:32,height:32}]]),badges:new Map()});
   const later=OverlayApp.refresh();pendingLoads[1](done('new'));await later;pendingLoads[0](done('old'));await new Promise(r=>setTimeout(r,0));
   OverlayApp.inject({text:'Token'});return {case:'app-refresh-race',displayed:document.querySelector('.emote-base').src};
  }));
  await live.close();
 }finally{await browser.close();}
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,`test-results/review-20261010-${report.engine}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
