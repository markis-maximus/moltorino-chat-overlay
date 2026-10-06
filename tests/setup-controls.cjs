'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.OVERLAY_TEST_PORT||18766);
const base=`http://127.0.0.1:${port}`;

(async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1400}});
    await page.goto(base+'/');
    const values={channel:'other_streamer',fontSize:'31',emoteSize:'54',fade:'1',maxMessages:'2'};
    for(const [name,value] of Object.entries(values))await page.locator(`[name="${name}"]`).fill(value);
    for(const name of ['badges','names','paints','demo'])await page.locator(`[name="${name}"]`).uncheck();
    await page.locator('button[type="submit"]').click();

    const source=new URL(await page.locator('#sourceUrl').inputValue());
    for(const [name,value] of Object.entries(values))assert.equal(source.searchParams.get(name),value);
    for(const name of ['badges','names','paints','demo'])assert.equal(source.searchParams.get(name),'0');

    const preview=page.frames().find(frame=>frame.url().includes('/overlay.html'));
    await preview.waitForFunction(()=>globalThis.OverlayApp);
    const previewConfig=await preview.evaluate(()=>OverlayApp.getStatus().config);
    assert.deepEqual({...previewConfig},{channel:'other_streamer',fontSize:31,emoteSize:54,maxMessages:2,fade:1,badges:false,names:false,paints:false,demo:false});

    const downloadEvent=page.waitForEvent('download');
    await page.locator('#download').click();
    const download=await downloadEvent;
    assert.equal(download.suggestedFilename(),'chat-other_streamer.html');
    const results=path.join(root,'test-results');fs.mkdirSync(results,{recursive:true});
    const downloaded=path.join(results,'setup-controls.html');await download.saveAs(downloaded);
    const sourceText=fs.readFileSync(downloaded,'utf8');
    for(const expected of ['"channel":"other_streamer"','"fontSize":31','"emoteSize":54','"fade":1','"maxMessages":2','"badges":false','"names":false','"paints":false','"demo":false'])assert.ok(sourceText.includes(expected),expected);

    const overlay=await browser.newPage({viewport:{width:800,height:500}});
    await overlay.goto(pathToFileURL(downloaded).href+'?offline=1&test=1');
    await overlay.waitForFunction(()=>globalThis.OverlayApp?.inject);
    const embedded=await overlay.evaluate(()=>OverlayApp.getStatus().config);
    assert.deepEqual({...embedded},{channel:'other_streamer',fontSize:31,emoteSize:54,maxMessages:2,fade:1,badges:false,names:false,paints:false,demo:false});

    await overlay.evaluate(()=>{
      for(let i=1;i<=3;i++)OverlayApp.inject({id:'control-'+i,userId:'42',username:'tester',displayName:'Tester',badges:[{set:'moderator',version:'1'}],text:'heyy'});
    });
    assert.equal(await overlay.locator('.message').count(),2);
    assert.equal(await overlay.locator('.username').count(),0);
    assert.equal(await overlay.locator('.badge').count(),0);
    const rendered=await overlay.locator('.emote-base').last().evaluate(node=>({height:node.getBoundingClientRect().height,font:getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()}));
    assert.equal(Math.round(rendered.height),54);
    assert.equal(rendered.font,'31px');
    await overlay.waitForFunction(()=>document.querySelectorAll('.message').length===0,null,{timeout:3000});
    console.log('Setup controls passed: URL, preview, portable file, sizing, visibility, message limit, and fade.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
