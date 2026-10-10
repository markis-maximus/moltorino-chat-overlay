'use strict';
// Isolated headless browser, intercepted public data, no existing browser or client session.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {launch}=require('./browser-env.cjs');
const root=path.resolve(__dirname,'..'),results=[];
const base=`http://127.0.0.1:${Number(process.env.OVERLAY_TEST_PORT||18766)}`;
(async()=>{
 const browser=await launch();
 try{
  for(const [mode,source] of [['localhost',base+'/overlay.html'],['standalone',pathToFileURL(path.join(root,'dist/chat-channelname.html')).href]]){
   const page=await browser.newPage({viewport:{width:1000,height:500}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith('https://cdn.test/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#88ccff"/></svg>'});
    let data;
    if(url==='https://api.moltorino.com/v2/badges')data={schemaVersion:2,badges:[],users:{}};
    else if(url==='https://api.frankerfacez.com/v1/badges/ids')data={badges:[{id:2,title:'Bot',replaces:'moderator',color:'#595959',urls:{4:'https://cdn.test/bot'}}],users:{2:['42']}};
    else if(url==='https://chatterinohomies.com/api/badges/list')data={badges:[{userId:'42',badgeId:'custom',tooltip:'Homies custom',image1:'https://cdn.test/homies.webp',image3:'https://cdn.test/homies.webp'}]};
    if(data)return route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
    return url.startsWith(base+'/')||url.startsWith('file:')?route.continue():route.abort();
   });
   await page.goto(source+'?channel=test_channel&offline=1&test=1&demo=0');
   await page.waitForFunction(()=>!!window.OverlayApp?.inject);
   const report=await page.evaluate(async()=>{
    const service=OverlayCosmetics.create();await service.refresh();
    const paint={id:'01FRV9TXD0000E7692NF398GSS',function:'LINEAR_GRADIENT',angle:90,stops:[{at:0,color:-16776961},{at:1,color:65535}]};
    const seven={id:'01H85EF8DR00020G66EN3RFP9G',tooltip:'7TV',host:{url:'https://cdn.test/seven',files:[{name:'3x.webp',format:'WEBP'}]}};
    service.remember('PAINT',paint);service.remember('BADGE',seven);
    for(const [kind,id] of [['PAINT',paint.id],['BADGE',seven.id]])service.ingest('entitlement.create',{object:{kind,ref_id:id,user:{connections:[{platform:'TWITCH',id:'42'}]}}});
    const definitions=[{id:'founder',priority:75},{id:'supporter',priority:100}].map(b=>({...b,images:{'1x':'https://cdn.test/'+b.id+'/1x','3x':'https://cdn.test/'+b.id}}));
    const map=new Map(['moderator','vip','premium'].map(set=>[set+'/1','https://cdn.test/'+set]));
    OverlayProviders.parsers.channelBadges({mod_urls:{4:'https://cdn.test/custom-mod'},vip_badge:{4:'https://cdn.test/custom-vip'}},map);
    const cases=[
     {label:'Decorations off: paint and 7TV badge remain',prefs:{decorations:false}},
     {label:'Decorations on: Homies custom returns',prefs:{decorations:true}},
     {label:'Hide tv: VIP and moderator remain',prefs:{hidden:['tv']}},
     {label:'Legacy hide t:vip: all roles disappear',prefs:{hidden:['t:vip']}},
     {label:'Explicit null: no Moltorino badge',prefs:{activeBadge:null}},
     {label:'Overlay paints off: badges remain',prefs:{decorations:true},paints:false},
     {label:'Overlay badges off: paint remains',prefs:{decorations:true},badges:false},
     {label:'Hide ff: green moderator remains',prefs:{hidden:['ff']}}
    ];
    document.getElementById('chat').replaceChildren();
    const result=[];
    for(const item of cases){
     service.setRegistry({badges:definitions,users:{42:{badges:['founder','supporter'],...item.prefs}}});
     const message={userId:'42',displayName:'Comparison',username:'comparison',color:'#aa55ff',badges:['moderator','vip','premium'].map(set=>({set,version:'1'})),text:item.label};
     const profile=service.profile(message,map),options={cosmeticsProfile:profile,badges:item.badges,paints:item.paints};
     const row=OverlayRenderer.render(message,new Map(),options);document.getElementById('chat').append(row);
     const original=row.querySelector('[data-source="7"]');OverlayRenderer.decorate(row,message,options);
     await Promise.all([...row.querySelectorAll('img')].map(img=>img.decode()));
     const text=row.querySelector('.name-text'),mod=row.querySelector('[data-badge-id="t:moderator"]');
     const bot=row.querySelector('[data-source="ff"]');
     result.push({label:item.label,paint:text.dataset.paint||null,background:getComputedStyle(text).backgroundImage,badges:[...row.querySelectorAll('.badge')].map(img=>({id:img.dataset.badgeId,source:img.dataset.source})),moderatorBackground:mod?getComputedStyle(mod).backgroundColor:null,botBackground:bot?getComputedStyle(bot).backgroundColor:null,preservedSevenNode:original===row.querySelector('[data-source="7"]')});
    }
    service.close();return result;
   });
   const sources=index=>report[index].badges.map(b=>b.source);
   assert.deepEqual(sources(0),['ta','ta','tv','ff','m','7']);
   assert.deepEqual(sources(1),['ta','ta','tv','ff','m','7','hc']);
   assert.deepEqual(sources(2),['ta','ta','ff','m','7','hc']);
   assert.deepEqual(sources(3),['tv','ff','m','7','hc']);
   assert.deepEqual(sources(4),['ta','ta','tv','ff','7','hc']);
   assert.deepEqual(sources(5),sources(1));assert.deepEqual(sources(6),[]);
   assert.deepEqual(sources(7),['ta','ta','tv','m','7','hc']);
   assert.equal(report[5].paint,null);assert.equal(report[5].background,'none');
   for(const index of [0,1,2,3,4,6,7]){assert.ok(report[index].paint);assert.match(report[index].background,/linear-gradient/);}
   for(const row of report){assert.ok(row.preservedSevenNode);if(row.moderatorBackground)assert.equal(row.moderatorBackground,'rgb(52, 174, 10)');if(row.botBackground)assert.equal(row.botBackground,'rgb(89, 89, 89)');for(const badge of row.badges.filter(b=>b.source==='m'))assert.equal(badge.id,'moltorino:founder');}
   assert.deepEqual(errors,[]);results.push({mode,cases:report});
   fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
   await page.screenshot({path:path.join(root,`test-results/moltorino-${process.env.OVERLAY_BROWSER||'chromium'}-${mode}.png`),omitBackground:process.env.OVERLAY_BROWSER!=='firefox'});await page.close();
  }
  fs.writeFileSync(path.join(root,`test-results/moltorino-browser-${process.env.OVERLAY_BROWSER||'chromium'}.json`),JSON.stringify(results,null,2));
  console.log(`Moltorino comparisons: ${results.length} modes, 8 cases each passed.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
