'use strict';
// A newly launched, headless browser; never connects to an existing user browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:1000,height:800}});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://overlay.test/')?route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="chat"></main><output id="status" hidden></output></body></html>'}):route.abort());
  await page.goto('http://overlay.test/?channel=test_channel&offline=1&test=1');
  await page.addStyleTag({path:path.join(root,'overlay.css')});
  for(const file of ['modifiers.js','renderer.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>';
    const base={id:'base',name:'heyy',provider:'7tv',url:'data:image/svg+xml,'+encodeURIComponent(svg),width:32,height:32};
    globalThis.OverlayDemoEmote=base;
    globalThis.testCatalog=new Map([['heyy',base],['RainTime',{...base,id:'rain',name:'RainTime',zeroWidth:true}]]);
  });
  await page.addScriptTag({path:path.join(root,'app.js')});
  await page.evaluate(()=>OverlayApp.setCatalog(testCatalog));
  await check('offline app initializes without page errors',async()=>assert.deepEqual(pageErrors,[]));
  await check('ffzW doubles the base width and reserves row layout width',async()=>{
    const result=await page.evaluate(()=>{
      const row=OverlayRenderer.render({text:'heyy heyy ffzW'},testCatalog,{names:false,emoteSize:36});document.getElementById('chat').append(row);
      const units=[...row.querySelectorAll('.emote-unit')];return {normal:units[0].getBoundingClientRect().width,wide:units[1].getBoundingClientRect().width,base:units[1].querySelector('.emote-base').getBoundingClientRect().width};
    });
    assert.equal(result.wide,result.normal*2);assert.equal(result.base,result.wide);
  });
  await check('7TV layers widen together with their base under ffzW',async()=>{
    const result=await page.evaluate(()=>{
      const row=OverlayRenderer.render({text:'heyy RainTime ffzW'},testCatalog,{names:false,emoteSize:36});document.getElementById('chat').append(row);
      return {base:row.querySelector('.emote-base').getBoundingClientRect().width,layer:row.querySelector('.emote-zero').getBoundingClientRect().width};
    });assert.equal(result.layer,result.base);
  });
  await check('slide clones the composed stack without duplicate element ids',async()=>{
    const result=await page.evaluate(()=>{
      const row=OverlayRenderer.render({text:'heyy RainTime ffzSlide'},testCatalog,{names:false});document.getElementById('chat').append(row);
      return {cells:row.querySelectorAll('.ffz-slide-cell').length,bases:row.querySelectorAll('.emote-base').length,layers:row.querySelectorAll('.emote-zero').length};
    });assert.deepEqual(result,{cells:3,bases:3,layers:3});
  });
  await check('all advertised modifier animations and filters are emitted',async()=>{
    const result=await page.evaluate(()=>{
      const names=['ffzJam','ffzBounce','ffzSpin','ffzRainbow','ffzHyper','ffzCursed','ffzArrive','ffzLeave','ffzSlide'];
      return names.map(name=>{const row=OverlayRenderer.render({text:'heyy '+name},testCatalog,{names:false});document.getElementById('chat').append(row);const stage=row.querySelector('.ffz-effect-stage');return {name,animation:row.querySelector('.ffz-modified').getAnimations({subtree:true}).map(a=>a.animationName).join(',')||'none',filter:getComputedStyle(stage).filter,slide:!!row.querySelector('.ffz-slide-strip')};});
    });
    for(const entry of result)assert.ok(entry.animation!=='none'||entry.filter!=='none'||entry.slide,entry.name);
  });
  await check('animation transforms and filters change across their timelines',async()=>{
    const values=await page.evaluate(async()=>{
      const row=OverlayRenderer.render({text:'heyy ffzBounce heyy ffzSpin heyy ffzRainbow heyy ffzSlide'},testCatalog,{names:false});document.getElementById('chat').append(row);
      const units=[...row.querySelectorAll('.emote-unit')];
      const nodes=[units[0].querySelector('.ffz-motion-bounce'),units[1].querySelector('.ffz-motion-spin'),units[2].querySelector('.ffz-effect-stage'),units[3].querySelector('.ffz-slide-strip')];
      const animations=nodes.map(node=>node.getAnimations()[0]);
      for(const animation of animations){animation.pause();animation.currentTime=0;}
      const sample=()=>nodes.map(n=>({transform:getComputedStyle(n).transform,filter:getComputedStyle(n).filter}));
      await new Promise(resolve=>requestAnimationFrame(resolve));const before=sample();
      for(const animation of animations)animation.currentTime=123;
      await new Promise(resolve=>requestAnimationFrame(resolve));return {before,after:sample()};
    });
    assert.notEqual(values.before[0].transform,values.after[0].transform,'bounce must move');
    assert.notEqual(values.before[1].transform,values.after[1].transform,'spin must rotate');
    assert.notEqual(values.before[2].filter,values.after[2].filter,'rainbow must change hue');
    assert.notEqual(values.before[3].transform,values.after[3].transform,'slide strip must move');
  });
  await check('malicious chat and display names stay inert text',async()=>{
    const result=await page.evaluate(()=>{
      const payload='<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>';
      const row=OverlayRenderer.render({text:payload,displayName:payload,color:'red;background:url(https://bad.test)'},testCatalog,{});document.getElementById('chat').append(row);
      return {text:row.textContent,images:row.querySelectorAll('img').length,scripts:row.querySelectorAll('script').length,pwned:globalThis.pwned||false,color:row.querySelector('.username').style.color,payload};
    });assert.equal(result.images,0);assert.equal(result.scripts,0);assert.equal(result.pwned,false);assert.equal(result.color,'');assert.ok(result.text.includes(result.payload));
  });
  await check('single-message deletion only removes the selected id',async()=>{
    const ids=await page.evaluate(()=>{
      OverlayApp.clear({all:true});for(const id of ['a','b','c'])OverlayApp.inject({id,text:'heyy ffzW',username:'user',userId:'5'});OverlayApp.removeMessage({id:'b'});return [...document.querySelectorAll('#chat>.message')].map(n=>n.dataset.id);
    });assert.deepEqual(ids,['a','c']);
  });
  await check('timeout/ban clear removes only the matching user',async()=>{
    const ids=await page.evaluate(()=>{
      OverlayApp.clear({all:true});OverlayApp.inject({id:'a',text:'one',username:'alice',userId:'1'});OverlayApp.inject({id:'b',text:'two',username:'bob',userId:'2'});OverlayApp.clear({userId:'1',username:'ALICE'});return [...document.querySelectorAll('#chat>.message')].map(n=>n.dataset.id);
    });assert.deepEqual(ids,['b']);
  });
  await check('full-chat clear removes every row',async()=>{
    const count=await page.evaluate(()=>{OverlayApp.clear({all:true});return document.querySelectorAll('#chat>.message').length;});assert.equal(count,0);
  });
  await check('unknown effect bits remain surfaced instead of masquerading as supported',async()=>{
    const value=await page.evaluate(()=>OverlayModifiers.resolve('new',{modifier:true,modifier_flags:262145}).unsupportedFlags);assert.equal(value,262144);
  });
  await check('image load failure recovers visible emote and modifier text',async()=>{
    const value=await page.evaluate(()=>{
      const row=OverlayRenderer.render({text:'heyy ffzW'},testCatalog,{names:false});document.getElementById('chat').append(row);row.querySelector('.emote-base').dispatchEvent(new Event('error'));return row.textContent;
    });assert.equal(value,'heyy ffzW');
  });
  await check('no rendering exceptions during the complete smoke test',async()=>assert.deepEqual(pageErrors,[]));
  if(process.argv.includes('--local')){
    const local=await browser.newPage({viewport:{width:1000,height:800}});
    const localErrors=[];local.on('pageerror',error=>localErrors.push(error.message));
    await check('localhost offline demo contains all 12 FFZ modifiers without broken images',async()=>{
      await local.goto('http://127.0.0.1:18765/overlay.html?channel=markis_maximus&demo=1&offline=1');
      await local.waitForFunction(()=>document.querySelectorAll('.message.preview').length>=6);
      await local.waitForFunction(()=>[...document.images].every(image=>image.complete));
      const result=await local.evaluate(()=>({rows:document.querySelectorAll('.message.preview').length,modifiers:[...document.querySelectorAll('.emote-unit')].flatMap(n=>n.dataset.modifiers.split(' ')),broken:[...document.images].filter(i=>!i.naturalWidth).length}));
      for(const name of ['ffzW','ffzX','ffzY','ffzJam','ffzBounce','ffzSpin','ffzRainbow','ffzHyper','ffzCursed','ffzArrive','ffzLeave','ffzSlide'])assert.ok(result.modifiers.includes(name),name);
      assert.equal(result.broken,0);assert.equal(localErrors.length,0);
      fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await local.screenshot({path:path.join(root,'test-results','offline-demo.png'),omitBackground:true});
    });
    await check('localhost live source loads catalogs and joins Twitch read-only',async()=>{
      await local.goto('http://127.0.0.1:18765/overlay.html?channel=markis_maximus&demo=1&debug=1');
      await local.waitForFunction(()=>globalThis.OverlayApp?.getStatus().connection==='connected'&&OverlayApp.getStatus().loaded>0,{},{timeout:45000});
      await local.waitForFunction(()=>document.querySelectorAll('.message.preview').length>=6);
      await local.waitForFunction(()=>[...document.images].every(image=>image.complete),{},{timeout:30000});
      const state=await local.evaluate(()=>OverlayApp.getStatus());
      assert.equal(state.connection,'connected');assert.ok(state.loaded>0);assert.equal(localErrors.length,0);
      const imageState=await local.evaluate(()=>({total:document.images.length,broken:[...document.images].filter(image=>!image.naturalWidth).map(image=>({url:image.src,alt:image.alt})),fallback:document.querySelectorAll('.emote-fallback').length}));
      assert.ok(imageState.total>12);assert.equal(imageState.broken.length,0,JSON.stringify(imageState));assert.equal(imageState.fallback,0);
      fs.writeFileSync(path.join(root,'test-results','live-status.json'),JSON.stringify(state,null,2));await local.screenshot({path:path.join(root,'test-results','preview.png'),omitBackground:true});
    });
    await check('single HTML file joins Twitch and loads public emotes without local hosting',async()=>{
      const {pathToFileURL}=require('node:url');
      await local.goto(pathToFileURL(path.join(root,'dist','chat-markis_maximus-preview.html')).href);
      await local.waitForFunction(()=>globalThis.OverlayApp?.getStatus().connection==='connected'&&OverlayApp.getStatus().loaded>0,{},{timeout:45000});
      await local.waitForFunction(()=>document.querySelectorAll('.message.preview').length>=6);
      const state=await local.evaluate(()=>OverlayApp.getStatus());assert.equal(state.connection,'connected');assert.ok(state.loaded>0);assert.equal(localErrors.length,0);
      fs.writeFileSync(path.join(root,'test-results','standalone-status.json'),JSON.stringify(state,null,2));
    });
    await check('generator produces a channel-specific single HTML download',async()=>{
      await local.goto('http://127.0.0.1:18765/');
      await local.locator('#channel').fill('other_streamer');
      await local.locator('#demo').uncheck();
      await local.locator('button[type="submit"]').click();
      assert.match(await local.locator('#sourceUrl').inputValue(),/channel=other_streamer/);
      const downloaded=local.waitForEvent('download');await local.locator('#download').click();const download=await downloaded;
      assert.equal(download.suggestedFilename(),'chat-other_streamer.html');
      const file=await download.path();const html=fs.readFileSync(file,'utf8');
      assert.ok(html.includes('"channel":"other_streamer"'));assert.ok(html.includes('"demo":false'));
      assert.equal(/<script src=/.test(html),false);assert.equal(/stylesheet.*href="overlay.css"/.test(html),false);
      assert.equal(localErrors.length,0);
    });
    await local.close();
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
