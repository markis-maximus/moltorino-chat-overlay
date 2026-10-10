'use strict';
// Regression checks for the second review. Does not contact public chat.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
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
  const routeAssets=route=>{
   const u=route.request().url();
   if(u.startsWith('http://review.test/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="chat"></main><output id="status"></output></body></html>'});
   if(u==='https://assets.test/broken'||u==='https://assets.test/also-broken'||u==='https://assets.test/bad-badge')return route.abort();
   if(u.startsWith('https://assets.test/'))return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${u.endsWith('/wide')?96:32}" height="32"><rect width="100%" height="100%" fill="lime"/></svg>`});
   return u.startsWith('file:')?route.continue():route.abort();
  };
  await page.route('**/*',routeAssets);
  await page.goto('http://review.test/?channel=test_channel&offline=1&test=1&demo=0');await page.addStyleTag({path:path.join(root,'overlay.css')});
  for(const file of ['modifiers.js','cosmetics.js','renderer.js','app.js'])await page.addScriptTag({path:path.join(root,file)});
  const renderingChecks=async()=>{
   const out=[],chat=document.getElementById('chat'),frame=()=>new Promise(requestAnimationFrame);
   const until=async predicate=>{const deadline=performance.now()+5000;while(!predicate()){if(performance.now()>deadline)throw Error('Timed out waiting for fixture image handling');await new Promise(r=>setTimeout(r,10));}};
   const base={name:'Base',id:'base',url:'https://assets.test/base',width:32,height:32};
   const layer={name:'Layer',id:'layer',url:'https://assets.test/wide',width:0,height:0,zeroWidth:true};
   const catalog=new Map([['Base',base],['Layer',layer]]);
   const slide=OverlayRenderer.render({text:'Base Layer ffzSlide'},catalog,{names:false,emoteSize:36});chat.append(slide);
   for(const a of slide.getAnimations({subtree:true})){a.pause();a.currentTime=543;}
   await Promise.all([...slide.querySelectorAll('img')].map(img=>img.decode()));await new Promise(r=>setTimeout(r,100));await frame();
   out.push({case:'slide-unknown-overlay-size',widths:[...slide.querySelectorAll('.emote-zero')].map(img=>img.getBoundingClientRect().width),natural:[...slide.querySelectorAll('.emote-zero')].map(img=>[img.naturalWidth,img.naturalHeight])});
   out.push({case:'slide-clock-preservation',times:slide.getAnimations({subtree:true}).map(a=>a.currentTime)});
   const broken=OverlayRenderer.render({text:'Broken'},new Map([['Broken',{...base,name:'Broken',url:'https://assets.test/broken',fallbackUrl:'https://assets.test/base'}]]),{names:false});chat.append(broken);
   await until(()=>broken.querySelector('img')?.naturalWidth>0);out.push({case:'static-image-fallback',fallbackText:broken.textContent,remainingImages:broken.querySelectorAll('img').length,loadedUrl:broken.querySelector('img')?.src});
   const message={username:'badgeuser',text:'Badges'},first={id:'a',source:'hc',url:'https://assets.test/base'};
   const row=OverlayRenderer.render(message,catalog,{cosmeticsProfile:{badges:[first]}});chat.append(row);const original=row.querySelector('.badge');
   OverlayRenderer.decorate(row,message,{cosmeticsProfile:{badges:[first,{id:'b',source:'7',url:'https://assets.test/base'}]}});
   out.push({case:'unchanged-badge-on-other-provider-update',sameNode:original===row.querySelector('.badge')});
   const second=row.querySelectorAll('.badge')[1];
   OverlayRenderer.decorate(row,message,{cosmeticsProfile:{badges:[{id:'b',source:'7',url:'https://assets.test/base'}, {...first,title:'Updated label',color:'#34ae0a'}]}});
   out.push({case:'badge-reorder-and-metadata',firstPreserved:row.querySelectorAll('.badge')[1]===original,secondPreserved:row.querySelector('.badge')===second,title:original.title,color:getComputedStyle(original).backgroundColor});
   const failedBadge={id:'failed',source:'m',url:'https://assets.test/bad-badge'};
   OverlayRenderer.decorate(row,message,{cosmeticsProfile:{badges:[failedBadge,first]}});
   await until(()=>!row.querySelector('[data-badge-id="failed"]'));
   for(let i=0;i<5;i++)OverlayRenderer.decorate(row,message,{cosmeticsProfile:{badges:[failedBadge,first]}});
   out.push({case:'badge-failure-isolation',preserved:row.querySelector('[data-badge-id="a"]')===original,count:row.querySelectorAll('.badge').length});
   const failed=OverlayRenderer.render({text:'Failed'},new Map([['Failed',{...base,name:'Failed',url:'https://assets.test/broken',fallbackUrl:'https://assets.test/also-broken'}]]),{names:false});chat.append(failed);
   await until(()=>!!failed.querySelector('.emote-fallback'));out.push({case:'double-image-failure',fallback:failed.classList.contains('emote-fallback')||!!failed.querySelector('.emote-fallback'),images:failed.querySelectorAll('img').length});
   const span=document.createElement('span');span.textContent='Paint';
   OverlayCosmetics.applyPaint(span,{id:'same',function:'RADIAL_GRADIENT',stops:[{at:0,color:0xff0000ff}]},'#ffffff');chat.append(span);
   OverlayCosmetics.applyPaint(span,{id:'same',function:'RADIAL_GRADIENT',stops:[{at:0,color:0x0000ffff}]},'#ffffff');
   const before=getComputedStyle(span).color;await frame();out.push({case:'radial-deferred-update-race',before,after:getComputedStyle(span).color});
   return out;
  };
  report.browser.push(...await page.evaluate(renderingChecks));
  const noticeRenderingCheck=()=>{
   const notice=OverlayTransport.toMessage(OverlayTransport.parseLine('@id=subscription;room-id=42;msg-id=resub;login=viewer;user-id=123;display-name=Viewer :tmi.twitch.tv USERNOTICE #test_channel :Token ffzW'));
   if(!notice)return {case:'notice-rendering',present:false};OverlayApp.inject(notice);
   const row=document.querySelector('[data-id="subscription"]');return {case:'notice-rendering',present:!!row,subscription:row.classList.contains('subscription'),type:row.dataset.noticeType,emote:row.querySelector('.emote-unit')?.dataset.emote,flags:row.querySelector('.emote-unit')?.dataset.flags};
  };
  const portable=await browser.newPage({viewport:{width:700,height:500}});await portable.route('**/*',routeAssets);
  await portable.goto(pathToFileURL(path.join(root,'dist/chat-channelname.html')).href+'?channel=test_channel&offline=1&test=1&demo=0');
  await portable.waitForFunction(()=>!!globalThis.OverlayApp?.inject);
  report.standalone=await portable.evaluate(renderingChecks);
  report.standalone.push(await portable.evaluate(async()=>{
   const pending=[];globalThis.OverlayProviders={load:()=>new Promise(resolve=>pending.push(resolve))};
   const done=id=>({channelId:'42',emotes:new Map([['Token',{id,name:'Token',url:'https://assets.test/'+id,width:32,height:32}]]),badges:new Map()});
   const older=OverlayApp.refresh(),newer=OverlayApp.refresh();pending[1](done('new'));await newer;pending[0](done('old'));await older;
   OverlayApp.inject({id:'portable-freshness',text:'Token'});return {case:'app-refresh-race',displayed:document.querySelector('[data-id="portable-freshness"] .emote-base').src};
  }));
  report.standalone.push(await portable.evaluate(noticeRenderingCheck));
  await portable.close();
  // Start a separate app with controlled provider completion order.
  const live=await browser.newPage();await live.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main id="chat"></main><output id="status"></output>'}));
  await live.goto('http://review.test/?channel=test_channel&test=1&demo=0');
  await live.addStyleTag({path:path.join(root,'overlay.css')});
  for(const file of ['modifiers.js','renderer.js','transport.js'])await live.addScriptTag({path:path.join(root,file)});
  await live.evaluate(()=>{globalThis.pendingLoads=[];globalThis.OverlayTransport={...OverlayTransport,connect:()=>({close(){}})};globalThis.OverlayProviders={load:()=>new Promise(resolve=>pendingLoads.push(resolve))};});
  await live.addScriptTag({path:path.join(root,'app.js')});
  report.browser.push(await live.evaluate(async()=>{
   const done=data=>({channelId:'42',emotes:new Map([['Token',{id:data,name:'Token',url:'https://assets.test/'+data,width:32,height:32}]]),badges:new Map()});
   const later=OverlayApp.refresh();pendingLoads[1](done('new'));await later;pendingLoads[0](done('old'));await new Promise(r=>setTimeout(r,0));
   OverlayApp.inject({text:'Token'});return {case:'app-refresh-race',displayed:document.querySelector('.emote-base').src};
  }));
  report.browser.push(await live.evaluate(noticeRenderingCheck));
  await live.close();
 }finally{await browser.close();}
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,`test-results/repairs-20261010-${report.engine}.json`),JSON.stringify(report,null,2));
 const failures=[];let currentMode;const check=(name,fn)=>{try{fn();}catch(e){failures.push({mode:currentMode,name,error:e.message});}};
 for(const [mode,observations] of [['source',report.browser],['standalone',report.standalone]]){
 currentMode=mode;
 const get=name=>[...observations,...report.browser,...report.data].find(r=>r.case===name);
 check('Slide late dimensions',()=>{for(const width of get('slide-unknown-overlay-size').widths)assert.ok(Math.abs(width-108)<.2);});
 check('Slide clock preservation',()=>{assert.ok(get('slide-clock-preservation').times.length);for(const t of get('slide-clock-preservation').times)assert.equal(t,543);});
 check('Static fallback',()=>{assert.equal(get('static-image-fallback').remainingImages,1);assert.equal(get('static-image-fallback').loadedUrl,'https://assets.test/base');});
 check('Individual badge preservation',()=>assert.equal(get('unchanged-badge-on-other-provider-update').sameNode,true));
 check('Badge reorder/metadata',()=>{const r=get('badge-reorder-and-metadata');assert.ok(r.firstPreserved&&r.secondPreserved);assert.equal(r.title,'Updated label');assert.equal(r.color,'rgb(52, 174, 10)');});
 check('Badge failure isolation',()=>{assert.ok(get('badge-failure-isolation').preserved);assert.equal(get('badge-failure-isolation').count,1);});
 check('Image double failure',()=>{assert.ok(get('double-image-failure').fallback);assert.equal(get('double-image-failure').images,0);});
 check('Radial paint revision',()=>assert.equal(get('radial-deferred-update-race').after,'rgb(0, 0, 255)'));
 check('App freshness',()=>assert.equal(get('app-refresh-race').displayed,'https://assets.test/new'));
 check('Provider cache freshness',()=>assert.deepEqual(get('emote-cache-refresh-race').cachedAfterOlder,['NewGlobal']));
 check('Provider isolation',()=>{assert.equal(get('malformed-provider-poisons-cache').firstError,undefined);assert.equal(get('malformed-provider-poisons-cache').cachedError,undefined);});
 check('Notice content',()=>assert.equal(get('usernotice-text').displayedMessages,2));
 check('Notice rendering',()=>{const r=get('notice-rendering');assert.ok(r.present&&r.subscription);assert.equal(r.type,'resub');assert.equal(r.emote,'Token');assert.equal(r.flags,'9');});
 check('Connection guards',()=>{assert.ok(get('chat-watchdogs').connectingTimers>0);assert.ok(get('chat-watchdogs').joinedTimers>0);});
 }
 console.log(JSON.stringify({engine:report.engine,failures},null,2));
 if(process.argv.includes('--assert'))assert.deepEqual(failures,[]);
})().catch(e=>{console.error(e);process.exitCode=1;});
