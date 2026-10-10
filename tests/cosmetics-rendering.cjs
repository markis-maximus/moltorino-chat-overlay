'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..'),base=`http://127.0.0.1:${Number(process.env.OVERLAY_TEST_PORT||18766)}`;
(async()=>{
 const browser=await launch(),reports=[];
 try{
  for(const [mode,url] of [['localhost',base+'/overlay.html'],['standalone',pathToFileURL(path.join(root,'dist/chat-channelname.html')).href]]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const u=route.request().url(),badge={tooltip:'Fixture',image1:'https://cdn.test/badge',users:['42']};
    const blue={id:'staff',tooltip:'Bluzyrino',...Object.fromEntries(['1x','2x','4x'].map(s=>['image_url_'+s,'https://bluzyrino-badge-registry.blu901-55.workers.dev/badges/staff-'+s+'.webp']))};
    const payloads={
     'https://api.moltorino.com/v2/badges':{schemaVersion:2,generation:'test',bundleVersion:1,badges:[],users:{}},
     'https://api.chatterino.com/badges':{badges:[badge]},
     'https://api.ffzap.com/v1/supporters':[{id:'42',badge_is_colored:1,badge_color:'#123456'}],
     'https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges':{version:1,catalog:[blue],badges:[{id:'staff',users:['42']}]},
     'https://itzalex.github.io/badges':{badges:[badge]},'https://itzalex.github.io/badges2':{badges:[badge]},
     'https://api.frankerfacez.com/v1/badges/ids':{badges:[]},'https://chatterinohomies.com/api/badges/list':{badges:[]},
     'https://api.ivr.fi/v2/twitch/user?id=99':[{id:'99',displayName:'SourceChannel',logo:'https://cdn.test/portrait'}]
    };
    if(payloads[u])return route.fulfill({json:payloads[u],headers:{'Access-Control-Allow-Origin':'*'}});
    if(u.startsWith('https://cdn.test/')||u.includes('/badges/staff-')||u.includes('/v1/user/badge/42/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'});
    return u.startsWith(base+'/')||u.startsWith('file:')?route.continue():route.abort();
   });
   await page.goto(url+'?channel=test_channel&offline=1&test=1&demo=0');await page.waitForFunction(()=>!!window.OverlayApp?.inject);
   const report=await page.evaluate(async()=>{
    const service=OverlayCosmetics.create();await service.refresh();await service.ensureSharedRoom('99');
    service.ingestBttv({name:'lookup_user',data:{providerId:'42',badge:{url:'https://cdn.test/bttv'}}});
    const message={userId:'42',username:'example',displayName:'LongExampleName',color:'#0000ff',roomId:'1',sourceRoomId:'99',badges:[{set:'moderator',version:'1'}],sourceBadges:[{set:'moderator',version:'1'}],text:'Provider and paint comparison'};
    const map=new Map([['moderator/1',{url:'https://cdn.test/custom',color:'#34ae0a'}]]);map.twitchDefaults=new Map([['moderator/1','https://cdn.test/global']]);
    const profile=service.profile(message,map),row=OverlayRenderer.render(message,new Map(),{cosmeticsProfile:profile});document.getElementById('chat').replaceChildren(row);
    await Promise.all([...row.querySelectorAll('img')].map(img=>img.decode()));
    const badges=[...row.querySelectorAll('.badge')].map(img=>({source:img.dataset.source,url:img.src,color:getComputedStyle(img).backgroundColor}));
    const name=row.querySelector('.name-text'),stops=[{at:0,color:-1},{at:1,color:255}];
    OverlayCosmetics.applyPaint(name,{id:'one',function:'LINEAR_GRADIENT',stops:[{at:0,color:0xff000080}]},message.color);
    const solid=getComputedStyle(name).color;
    OverlayCosmetics.applyPaint(name,{id:'image',function:'URL',image_url:'https://cdn.test/paint'},message.color);
    const image={size:getComputedStyle(name).backgroundSize,clip:getComputedStyle(name).backgroundClip};
    const detached=document.createElement('span');detached.textContent='Radial username with measured width';detached.style.display='inline-block';
    OverlayCosmetics.applyPaint(detached,{id:'radial',function:'RADIAL_GRADIENT',stops},message.color);row.append(detached);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    const radial={background:detached.style.backgroundImage,radius:Math.max(detached.getBoundingClientRect().width,detached.getBoundingClientRect().height)/2};
    OverlayCosmetics.applyPaint(name,{id:'many',function:'LINEAR_GRADIENT',stops:Array.from({length:40},(_,i)=>({at:i/39,color:-1})),shadows:Array.from({length:8},()=>({radius:1,color:255}))},message.color);
    const many={gradient:getComputedStyle(name).backgroundImage,filter:getComputedStyle(name).filter};service.close();return {badges,solid,image,radial,many};
   });
   assert.deepEqual(report.badges.map(b=>b.source),['shared','ta','c','fa','bt','bl','hs','hs']);
   assert.equal(report.badges[0].url,'https://cdn.test/portrait');assert.equal(report.badges[1].url,'https://cdn.test/global');
   assert.equal(report.badges.find(b=>b.source==='fa').color,'rgb(18, 52, 86)');
   assert.equal(report.solid,'rgb(128, 0, 127)');assert.equal(report.image.size,'100% 100%');assert.equal(report.image.clip,'text');
   const radius=Number(report.radial.background.match(/radial-gradient\((?:circle )?([\d.]+)px/)?.[1]);assert.ok(Math.abs(radius-report.radial.radius)<0.1,JSON.stringify(report.radial));
   assert.equal((report.many.gradient.match(/rgb\(/g)||[]).length,40);assert.equal((report.many.filter.match(/drop-shadow/g)||[]).length,8);
   assert.deepEqual(errors,[]);reports.push({mode,...report});await page.close();
  }
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,`test-results/cosmetics-rendering-${process.env.OVERLAY_BROWSER||'chromium'}.json`),JSON.stringify(reports,null,2));
  console.log('Paint geometry, provider rendering and Shared Chat passed in both modes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
