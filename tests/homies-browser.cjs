const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();const results=[];
 try{
  for(const address of ['http://127.0.0.1:18765/overlay.html?channel=jynxzi&test=1&maxMessages=100',pathToFileURL(path.join(root,'dist/chat-jynxzi.html')).href+'?test=1&maxMessages=100']){
   // Keep locally injected fixtures visible while the busy reference channel runs.
   const page=await browser.newPage({viewport:{width:1000,height:10000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(address);
   await page.waitForFunction(()=>OverlayApp.getStatus().loaded>100&&OverlayApp.getStatus().connection==='connected',null,{timeout:45000});
   await page.evaluate(()=>OverlayApp.disconnect());
   await page.evaluate(()=>{
    for(const [userId,displayName,badges] of [['657457116','moonie142',[]],['705840357','Karma_SL',[]],['732707575','TheBRGbot',[{set:'moderator',version:'1'}]],['100135110','StreamElements',[{set:'moderator',version:'1'}]]])OverlayApp.inject({id:'regression-'+userId,userId,username:displayName.toLowerCase(),displayName,badges,text:'Local badge verification'});
   });
   const samples={};
   for(const [id,asset] of [['657457116','3479271e-1ae5-4507-abdb-ea2eff38d822'],['705840357','0381b600-59d7-4a67-9f06-c4c426e6f341']]){
    const icon=page.locator(`[data-id="regression-${id}"] .badge[data-source="hc"]`);await icon.waitFor({timeout:45000});assert.ok((await icon.getAttribute('src')).includes(asset));await icon.evaluate(i=>i.decode());
    const hashes=[];for(let j=0;j<4;j++){await page.waitForTimeout(250);hashes.push(crypto.createHash('sha256').update(await icon.screenshot()).digest('hex'));}
    assert.ok(new Set(hashes).size>1,'actual animated badge frames must change');samples[id]={url:await icon.getAttribute('src'),distinctFrames:new Set(hashes).size};
   }
   await page.locator('[data-id="regression-100135110"] .badge[data-badge-id="2"]').waitFor({timeout:30000});
   const checks=await page.evaluate(()=>{
    const rows=['732707575','100135110'].map(id=>{const row=document.querySelector(`[data-id="regression-${id}"]`);const img=row.querySelector('.badge[data-badge-id="t:moderator"]'),bot=row.querySelector('.badge[data-source="ff"][data-badge-id="2"]');return{id,color:img&&getComputedStyle(img).backgroundColor,botColor:bot&&getComputedStyle(bot).backgroundColor};});
    const row=document.querySelector('[data-id="regression-657457116"]'),image=row.querySelector('.badge[data-source="hc"]');
    const profile={badges:[...row.querySelectorAll('.badge')].map(i=>({id:i.dataset.badgeId,source:i.dataset.source,title:i.title,url:i.src}))};
    // Establish one normalized profile, then prove repeated updates retain the image node.
    OverlayRenderer.decorate(row,{}, {cosmeticsProfile:profile});const first=row.querySelector('.badge[data-source="hc"]');OverlayRenderer.decorate(row,{}, {cosmeticsProfile:profile});
    return {rows,preserved:first===row.querySelector('.badge[data-source="hc"]'),version:OverlayApp.getStatus().version};
   });
   for(const r of checks.rows)assert.equal(r.color,'rgb(52, 174, 10)');assert.equal(checks.rows.find(r=>r.id==='100135110').botColor,'rgb(89, 89, 89)');assert.ok(checks.preserved);assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(root,'test-results/homies-'+(address.startsWith('file:')?'file':'http')+'.png'),omitBackground:true});results.push({source:address.startsWith('file:')?'file':'http',samples,...checks});await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'test-results/homies.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
