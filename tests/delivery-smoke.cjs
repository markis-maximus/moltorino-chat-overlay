'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
const result={};
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1400}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:18765/');
  await page.locator('#channel').fill('jynxzi');
  await page.locator('#fontSize').fill('26');
  await page.locator('button[type=submit]').click();
  assert.match(await page.locator('#sourceUrl').inputValue(),/fontSize=26/);
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#download').click();const download=await downloadEvent;
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  const downloaded=path.join(root,'test-results','downloaded.html');await download.saveAs(downloaded);
  assert.ok(fs.readFileSync(downloaded,'utf8').includes('"fontSize":26'));
  const preview=page.frames().find(f=>f.url().includes('/overlay.html'));
  await preview.waitForFunction(()=>document.querySelectorAll('#chat img').length>0&&[...document.querySelectorAll('#chat img')].every(i=>i.complete&&i.naturalWidth>0),{},{timeout:30000});
  await page.screenshot({path:path.join(root,'test-results','setup.png'),fullPage:true});
  result.generator={form:true,download:true};
  const filePage=await browser.newPage({viewport:{width:800,height:500}});
  const fileErrors=[];filePage.on('pageerror',e=>fileErrors.push(e.message));
  await filePage.goto(pathToFileURL(downloaded).href+'?test=1');
  await filePage.waitForFunction(()=>window.OverlayApp?.getStatus().loaded>100&&window.OverlayApp.getStatus().connection==='connected',{},{timeout:60000});
  await filePage.waitForFunction(()=>document.querySelectorAll('#chat img').length>0&&[...document.querySelectorAll('#chat img')].every(i=>i.complete&&i.naturalWidth>0),{},{timeout:30000});
  result.standalone=await filePage.evaluate(()=>({loaded:OverlayApp.getStatus().loaded,connection:OverlayApp.getStatus().connection,emotes:document.querySelectorAll('.emote-unit').length,images:document.querySelectorAll('img').length,transparent:getComputedStyle(document.body).backgroundColor,fontSize:OverlayApp.getStatus().config.fontSize}));
  assert.equal(result.standalone.transparent,'rgba(0, 0, 0, 0)');assert.equal(result.standalone.fontSize,26);
  assert.deepEqual(fileErrors,[]);
  await filePage.screenshot({path:path.join(root,'test-results','standalone-preview.png'),omitBackground:true});
  // A wide source image without provider dimensions must retain its actual shape after decoding.
  result.naturalWidth=await filePage.evaluate(async()=>{
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="96" height="32"><rect width="96" height="32" fill="lime"/></svg>';
    const cat=new Map([['wide',{id:'test',name:'wide',width:0,height:0,url:'data:image/svg+xml,'+encodeURIComponent(svg)}]]);
    const row=OverlayRenderer.render({text:'wide ffzW'},cat,{names:false,emoteSize:32});document.body.append(row);
    await row.querySelector('img').decode();await new Promise(resolve=>requestAnimationFrame(resolve));
    const width=row.querySelector('.emote-base').getBoundingClientRect().width;row.remove();return width;
  });
  assert.equal(result.naturalWidth,128); // FFZ caps modified width at128px, from an actual96px base.
  assert.deepEqual(errors,[]);result.passed=true;
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'test-results','delivery.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
