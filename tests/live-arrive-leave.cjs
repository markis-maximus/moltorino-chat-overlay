'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:800,height:500}});
  await page.goto('http://127.0.0.1:18765/overlay.html?channel=jynxzi&offline=1&test=1');
  const result=await page.evaluate(async()=>{
   const data=await OverlayProviders.load('jynxzi');const base=data.emotes.get('LMAO');
   if(!base)return {found:false,similar:[...data.emotes.keys()].filter(k=>/lmao/i.test(k))};
   const rows=[];
   for(const suffix of ['', 'ffzArrive','ffzLeave','ffzArrive ffzLeave']){
    const row=OverlayRenderer.render({displayName:suffix||'Original',text:'LMAO'+(suffix?' '+suffix:'')},data.emotes,{emoteSize:48});document.getElementById('chat').append(row);
    await row.querySelector('img').decode();
    const animations=row.getAnimations({subtree:true});for(const a of animations)a.pause();
    const samples=[];
    for(const time of [0,900,2500,4500,5900]){for(const a of animations)a.currentTime=time;await new Promise(r=>requestAnimationFrame(r));const b=row.querySelector('.emote-base').getBoundingClientRect();samples.push({time,width:b.width,height:b.height});}
    for(const a of animations)a.play();
    rows.push({suffix,modifiers:row.querySelector('.emote-unit').dataset.modifiers,animations:animations.map(a=>a.animationName),samples});
   }
   return {found:true,base,rows};
  });
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results','live-arrive-leave.json'),JSON.stringify(result,null,2));
  if(result.found){const both=result.rows[3];assert.ok(both.samples[0].width<.01);assert.ok(both.samples[2].width>10);assert.ok(both.samples[4].height<.1);await page.screenshot({path:path.join(root,'test-results','live-arrive-leave.png'),omitBackground:true});}
  console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
