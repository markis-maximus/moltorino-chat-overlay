'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 const results=[];
 try{
  for(const address of ['http://127.0.0.1:18765/overlay.html?channel=jynxzi&test=1&maxMessages=100',pathToFileURL(path.join(root,'dist/chat-jynxzi.html')).href+'?test=1&maxMessages=100']){
   // Jynxzi is deliberately used as a busy public reference channel. The tall
   // viewport keeps its live traffic from evicting the locally injected row.
   const page=await browser.newPage({viewport:{width:1000,height:10000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(address);
   await page.waitForFunction(()=>OverlayApp.getStatus().loaded>100&&OverlayApp.getStatus().connection==='connected',null,{timeout:60000});
   await page.evaluate(()=>OverlayApp.disconnect());
   // Local renderer injection only; no messages are sent to Twitch.
   await page.evaluate(()=>OverlayApp.inject({id:'cosmetic-integration',userId:'227313621',username:'djrr13',displayName:'Djrr13',text:'WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW',badges:[]}));
   const row=page.locator('[data-id="cosmetic-integration"]');
   await row.locator('.name-text[data-paint]').waitFor({timeout:45000});
   await row.locator('.badge[data-source="7"]').waitFor({timeout:30000});
   await row.locator('.badge[data-source="m"]').waitFor({timeout:30000});
   const result=await row.evaluate(async row=>{
    await Promise.all([...row.querySelectorAll('img')].map(i=>i.decode()));
    const animations=row.querySelector('.emote-unit').getAnimations({subtree:true});
    for(const a of animations){a.pause();a.currentTime=2375;}
    const spin=animations.find(a=>a.animationName==='overlay-ffz-spin');
    const name=row.querySelector('.name-text'),css=getComputedStyle(name);
    return {status:OverlayApp.getStatus(),paint:name.dataset.paint,clip:css.backgroundClip,filter:css.filter,badges:[...row.querySelectorAll('.badge')].map(i=>i.dataset.source),imagesDecoded:[...row.querySelectorAll('img')].every(i=>i.naturalWidth>0),spinB:spin?new DOMMatrix(getComputedStyle(spin.effect.target).transform).b:0,animations:animations.map(a=>a.animationName)};
   });
   assert.equal(result.status.version,'0.2.6');assert.equal(result.clip,'text');assert.ok(result.imagesDecoded);assert.ok(Math.abs(result.spinB)>.1);assert.ok(result.animations.includes('overlay-ffz-bounce'));assert.deepEqual(errors,[]);
   results.push({source:address.startsWith('file:')?'standalone':'localhost',...result});await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'test-results/app-cosmetics-live.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
