const fs=require('node:fs'),path=require('node:path');
const {launch}=require('../tests/browser-env.cjs');
(async()=>{
 const browser=await launch();
 try{
  const channel=(process.argv[2]||'jynxzi').toLowerCase();
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:18765/overlay.html?channel=${encodeURIComponent(channel)}&offline=1`);
  const report=await page.evaluate(async channel=>{
   const ids=['657457116','705840357','100135110'],events=[],observed=[];
   const data=await OverlayProviders.load(channel),service=OverlayCosmetics.create();
   await service.refresh();await Promise.all(ids.map(id=>service.ensureUser(id)));
   const profiles=ids.map(id=>({id,profile:service.profile({userId:id,badges:[{set:'moderator',version:'1'}]},data.badges)}));
   const rows=profiles.map(({id,profile})=>{const row=OverlayRenderer.render({userId:id,displayName:id,text:'badge check' },new Map(),{cosmeticsProfile:profile});document.getElementById('chat').append(row);return row;});
   await Promise.all(rows.flatMap(r=>[...r.querySelectorAll('img')].map(i=>i.decode().catch(()=>{}))));
   const rendered=rows.map(r=>({id:r.dataset.userId,badges:[...r.querySelectorAll('img')].map(i=>({src:i.src,loaded:i.naturalWidth>0,title:i.title,color:i.style.backgroundColor}))}));
   const registries=await Promise.all(['https://api.chatterino.com/badges','https://chatterinohomies.com/api/badges/list','https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges'].map(async url=>{try{const r=await fetch(url),d=await r.json();const list=d.badges||d;return {url,status:r.status,matches:Array.isArray(list)?list.filter(x=>ids.slice(0,2).some(id=>JSON.stringify(x).includes(id))):d};}catch(e){return{url,error:e.message};}}));
   const chat=OverlayTransport.connect(channel,{onMessage:m=>{if(ids.includes(m.userId))observed.push({userId:m.userId,username:m.username,badges:m.badges});}});
   const ws=new WebSocket('wss://events.7tv.io/v3');ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.op===1)for(const type of ['cosmetic.*','entitlement.*'])ws.send(JSON.stringify({op:35,d:{type,condition:{platform:'TWITCH',ctx:'channel',id:data.channelId}}}));if(d.op===0)events.push(d.d);};
   await new Promise(r=>setTimeout(r,75000));chat.close();ws.close();service.close();return{channel,profiles,rendered,registries,observed,events};
  },channel);
  fs.writeFileSync(path.join(__dirname,'snapshots/badge-diagnosis.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
