'use strict';
// Explicit opt-in network check: public registry reads and one asset per provider.
// No account, chat connection, viewer announcement, or cosmetic mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage();
  await page.goto(pathToFileURL(path.join(root,'dist/chat-channelname.html')).href+'?offline=1&test=1&demo=0');
  await page.waitForFunction(()=>!!window.OverlayCosmetics);
  const results=await page.evaluate(async()=>{
   const parsers=OverlayCosmetics.parsers;
   return Promise.all([
    ['Chatterino','https://api.chatterino.com/badges',x=>parsers.categoryBadges(x,'c')],
    ['FFZ:AP','https://api.ffzap.com/v1/supporters',parsers.ffzapBadges],
    ['Bluzyrino','https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges',parsers.bluzyrinoBadges],
    ['Homies supporter','https://itzalex.github.io/badges',x=>parsers.categoryBadges(x,'hs1')],
    ['Homies staff','https://itzalex.github.io/badges2',x=>parsers.categoryBadges(x,'hs2')]
   ].map(async([provider,endpoint,parse])=>{
    try{
     const response=await fetch(endpoint,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);
     const badges=parse(await response.json()),badge=badges.values().next().value?.[0];if(!badge)throw Error('No assignments');
     const img=new Image();img.src=badge.url;
     await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Image timeout')),15000))]);
     return {provider,endpoint,users:badges.size,asset:badge.url,width:img.naturalWidth,height:img.naturalHeight,ok:true};
    }catch(error){return {provider,endpoint,ok:false,error:error.message};}
   }));
  });
  const report={checkedAt:new Date().toISOString(),engine:process.env.OVERLAY_BROWSER||'chromium',version:browser.version(),origin:'file://',results};
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/public-badge-providers.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));assert.ok(results.every(r=>r.ok),'A public provider or asset was unavailable; see report.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
