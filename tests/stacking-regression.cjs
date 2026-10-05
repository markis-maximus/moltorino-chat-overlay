'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 const observations=[];let spinStack;
 try{
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  for(const file of ['modifiers.js','renderer.js','demo-emote.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.addStyleTag({path:path.join(root,'overlay.css')});
  const suffixes=['ffzArrive ffzLeave','ffzLeave ffzArrive','ffzArrive ffzLeave ffzBounce','ffzJam ffzBounce ffzRainbow ffzSpin ffzArrive ffzLeave ffzSlide ffzHyper'];
  for(const suffix of suffixes){
   observations.push(await page.evaluate(async suffix=>{
    const row=OverlayRenderer.render({text:'heyy '+suffix},new Map([['heyy',OverlayDemoEmote]]),{names:false,emoteSize:32});document.body.append(row);
    const animations=row.getAnimations({subtree:true});for(const a of animations)a.pause();
    const samples=[];
    for(const time of [0,900,2500,4500,5900]){
     for(const a of animations)a.currentTime=time;
     await new Promise(r=>requestAnimationFrame(r));
     const rect=row.querySelector('.emote-base').getBoundingClientRect();
     samples.push({time,width:rect.width,height:rect.height});
    }
    const result={suffix,animations:animations.map(a=>({name:a.animationName,duration:a.effect.getTiming().duration})),samples};row.remove();return result;
   },suffix));
  }
  spinStack=await page.evaluate(()=>{
   const cat=new Map([['WW',{...OverlayDemoEmote,name:'WW'}]]);
   const row=OverlayRenderer.render({text:'WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW'},cat,{names:false,emoteSize:32});document.body.append(row);
   const animations=row.getAnimations({subtree:true});for(const a of animations){a.pause();a.currentTime=2375;}
   const spin=animations.find(a=>a.animationName==='overlay-ffz-spin');
   const bounce=animations.find(a=>a.animationName==='overlay-ffz-bounce');
   const matrix=spin?new DOMMatrix(getComputedStyle(spin.effect.target).transform):null;
   return {spin:!!spin,bounce:!!bounce,spinB:matrix?.b,layoutWidth:row.querySelector('.ffz-effect-stage').offsetWidth};
  });
 }finally{await browser.close();}
 const failures=[];
 for(const observation of observations){
  try{
   assert.ok(observation.samples[0].width<.01,'arrival must begin hidden, even alongside other modifiers');
   assert.ok(observation.samples[2].width>10,'emote must appear midway through the combined cycle');
   assert.ok(observation.samples[4].width<2,'emote must leave before the cycle restarts');
  }catch(error){failures.push({suffix:observation.suffix,error:error.message});}
 }
 try{assert.ok(spinStack.spin&&spinStack.bounce);assert.ok(Math.abs(spinStack.spinB)>.1,'Spin must visibly rotate while Bounce is active');assert.equal(spinStack.layoutWidth,64,'Spin must not undo ffzW');}catch(error){failures.push({suffix:'WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW',error:error.message});}
 const result={passed:failures.length===0,failures,spinStack,observations};
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 fs.writeFileSync(path.join(root,'test-results','stacking.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
