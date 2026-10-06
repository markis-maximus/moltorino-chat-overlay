const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:1100,height:500}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:18765/overlay.html?channel=jynxzi&offline=1&test=1');
  const report=await page.evaluate(async()=>{
   const data=await OverlayProviders.load('jynxzi'),service=OverlayCosmetics.create();await service.refresh();
   const ids=['227313621','90843101','506954718'];await Promise.all(ids.map(id=>service.ensureUser(id)));
   const selected=[{id:'227313621',username:'djrr13',displayName:'Djrr13',badges:[]},{id:'90843101',username:'zincoc',displayName:'ZincOC',badges:[]},{id:'506954718',username:'moltobenne_',displayName:'MoltoBenne',badges:[]}];
   const rows=[];
   for(const u of selected){
    const message={...u,userId:u.id,text:'WW ffzBounce ffzSpin ffzArrive ffzLeave ffzW'};
    const profile=service.profile(message,data.badges);const row=OverlayRenderer.render(message,data.emotes,{cosmeticsProfile:profile,badgeMap:data.badges,emoteSize:40});document.getElementById('chat').append(row);
    await Promise.all([...row.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));
    rows.push({username:u.username,paint:profile.paint?.name,paintStyle:row.querySelector('.name-text')?.style.backgroundImage,badges:[...row.querySelectorAll('.badge')].map(i=>({source:i.dataset.source,id:i.dataset.badgeId,url:i.src,loaded:i.naturalWidth>0}))});
   }
   const row=document.querySelector('.message'),unit=row.querySelector('.emote-unit');
   const animations=unit.getAnimations({subtree:true});const times=animations.map(a=>a.currentTime);
   OverlayRenderer.decorate(row,{displayName:'Djrr13',userId:'227313621',color:'#aa44bb',badges:[]},{cosmeticsProfile:service.profile({userId:'227313621',badges:[]},data.badges)});
   const preserved=row.querySelector('.emote-unit')===unit&&animations.every((a,i)=>a.currentTime===times[i]);
   const result={channel:data.channelId,rows,cosmeticUpdatePreservedEmotes:preserved};service.close();return result;
  });
  assert.ok(report.rows.some(r=>r.paintStyle?.startsWith('linear-gradient')),'real observed paint renders');
  assert.ok(report.rows.some(r=>r.badges.some(b=>b.source==='7'&&b.loaded)),'7TV badge image decodes');
  assert.ok(report.rows.some(r=>r.badges.some(b=>b.source==='m'&&b.loaded)),'Moltorino badge image decodes');
  assert.ok(report.cosmeticUpdatePreservedEmotes);assert.deepEqual(errors,[]);
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results','cosmetics.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(root,'test-results','cosmetics.png'),omitBackground:true});console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
