'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 const results=[],capacity=[];
 try{
  const page=await browser.newPage({viewport:{width:800,height:500}});
  await page.goto(process.env.OVERLAY_TEST_URL||'http://127.0.0.1:18765/overlay.html?channel=test_channel&offline=1&test=1');
  for(const size of [36,72]){
   for(const time of [0,125,375,900,2375,3500,4500]){
    results.push(...await page.evaluate(({size,time})=>{
     const chat=document.getElementById('chat');
     let style=document.getElementById('test-animation-clock');if(!style){style=document.createElement('style');style.id='test-animation-clock';document.head.append(style);}
     style.textContent=`.message{animation:none!important}.ffz-motion-stage,.ffz-transition-stage,.ffz-effect-stage,.ffz-slide-strip{animation-delay:-${time}ms!important;animation-play-state:paused!important}`;
     const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>';
     const base={name:'WW',id:'base',width:32,height:32,url:'data:image/svg+xml,'+encodeURIComponent(svg)};
     const cat=new Map([['WW',base],['layer',{...base,name:'layer',zeroWidth:true,provider:'7tv'}]]);OverlayApp.setCatalog(cat);
     // Set display size through the same render options as the app, keeping configuration intact.
     const original=OverlayRenderer.render;OverlayRenderer.render=(m,c,o)=>original(m,c,{...o,emoteSize:size});
     const cases={plain:'WW',wide:'WW ffzW',seven:'WW'+' layer'.repeat(30),sevenWide:'WW'+' layer'.repeat(30)+' ffzW',spinBounce:'WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW',all:'WW '+[...OverlayModifiers.builtIn.keys()].join(' ')};
     const out=[];
     for(const [name,text] of Object.entries(cases)){
      chat.replaceChildren();for(let i=0;i<8;i++)OverlayApp.inject({id:'old-'+i,displayName:'User',text:'Earlier message '+i});
      const before=chat.children.length;
      // Observe normal row layout before the app's pruning loop.
      const row=OverlayRenderer.render({id:'target',displayName:'User',text},cat,{emoteSize:size});chat.append(row);
      const geometry={rowHeight:row.offsetHeight,unitWidth:row.querySelector('.emote-unit').offsetWidth,scrollHeight:chat.scrollHeight,clientHeight:chat.clientHeight,text:row.querySelector('.message-text').textContent,layoutBottom:row.offsetTop+row.offsetHeight};row.remove();
      OverlayApp.inject({id:'target',displayName:'User',text});
      const kept=chat.children.length;
      OverlayApp.inject({id:'after',displayName:'User',text:'Next ordinary message'});
      out.push({size,time,name,before,kept,keptAfterNext:chat.children.length,...geometry});
     }
     OverlayRenderer.render=original;return out;
    },{size,time}));
   }
  }
  for(const width of [320,800]){
   await page.setViewportSize({width,height:500});
   capacity.push(await page.evaluate(()=>{
    const chat=document.getElementById('chat');chat.replaceChildren();
    for(let i=0;i<20;i++)OverlayApp.inject({id:'capacity-'+i,displayName:'User',text:'Earlier message '+i});
    const before=chat.children.length;
    OverlayApp.inject({id:'wrapped',displayName:'User',text:'A longer message that needs multiple lines. '.repeat(10)});
    const newest=chat.lastElementChild,css=getComputedStyle(chat),gap=parseFloat(css.rowGap),available=chat.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
    const occupied=[...chat.children].reduce((n,r)=>n+r.getBoundingClientRect().height,0)+gap*(chat.children.length-1);
    return {width:innerWidth,before,kept:chat.children.length,newestId:newest.dataset.id,newestHeight:newest.offsetHeight,occupied,available};
   }));
  }
 }finally{await browser.close();}
 const failures=[];
 for(const r of results){
  const baseline=results.find(x=>x.size===r.size&&x.time===r.time&&x.name==='wide');
  if(['spinBounce','all','sevenWide'].includes(r.name)&&r.kept<baseline.kept)failures.push({size:r.size,time:r.time,name:r.name,kept:r.kept,expected:baseline.kept,scrollHeight:r.scrollHeight,rowHeight:r.rowHeight,baselineRowHeight:baseline.rowHeight});
  if(['spinBounce','all','sevenWide'].includes(r.name)&&r.keptAfterNext<baseline.keptAfterNext)failures.push({size:r.size,time:r.time,name:r.name,afterNext:r.keptAfterNext,expected:baseline.keptAfterNext});
 }
 for(const r of capacity){if(r.newestId!=='wrapped'||r.kept>=r.before||(r.kept>1&&r.occupied>r.available+.5))failures.push({capacity:r});}
 fs.writeFileSync(path.join(root,'test-results/layout.json'),JSON.stringify({failures,results,capacity},null,2));
 console.log(JSON.stringify({cases:results.length,failures,capacity,examples:results.filter(x=>x.time===2375&&x.size===36)},null,2));
 if(process.argv.includes('--assert'))assert.deepEqual(failures,[],'motion must not evict extra messages');
})().catch(e=>{console.error(e);process.exitCode=1;});
