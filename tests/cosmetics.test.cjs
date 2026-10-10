const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');const c=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch:async()=>{throw new Error('offline fixture');}});
for(const file of ['cosmetics.js','providers.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
const cosmetics=c.OverlayCosmetics;
const paint={id:'01FRV9TXD0000E7692NF398GSS',function:'LINEAR_GRADIENT',angle:90,stops:[{at:0,color:-16776961},{at:1,color:65535}],shadows:[]};
const badge={id:'01H85EF8DR00020G66EN3RFP9G',tooltip:'7TV Subscriber',host:{url:'//cdn.7tv.app/badge/test',files:[{name:'3x.webp',format:'WEBP'}]}};
const ent=(kind,ref)=>({object:{kind,ref_id:ref,user:{connections:[{platform:'TWITCH',id:'42'}]}}});
test('FFZ channel moderator and VIP URLs override Twitch defaults',()=>{
 const map=new Map([['moderator/1','default'],['vip/1','default']]);
 c.OverlayProviders.parsers.channelBadges({mod_urls:{4:'https://cdn.test/custom-mod'},vip_badge:{4:'https://cdn.test/custom-vip'}},map);
 assert.equal(map.get('moderator/1').url,'https://cdn.test/custom-mod');assert.equal(map.get('moderator/1').color,'#34ae0a');assert.equal(map.get('vip/1'),'https://cdn.test/custom-vip');
});
test('paint builder handles signed RGBA, gradients and safe animated image URLs',()=>{
 assert.equal(cosmetics.color(-16776961),'rgba(255,0,0,1)');
 const style=cosmetics.paintStyle(paint);assert.match(style.background,/linear-gradient\(90deg,rgba\(255,0,0,1\) 0%/);
 assert.equal(cosmetics.paintStyle({function:'URL',image_url:'javascript:alert(1)'}),null);
 assert.match(cosmetics.paintStyle({function:'URL',image_url:'https://cdn.test/image.webp'}).background,/^url\(/);
 assert.equal(cosmetics.paintStyle({function:'url',image_url:'http://insecure.test/a'}),null);
});
test('cosmetic and entitlement events attach to Twitch ID and delete cleanly',()=>{
 const service=cosmetics.create();service.ingest('cosmetic.create',{object:{id:paint.id,kind:'PAINT',data:paint}});service.ingest('cosmetic.create',{object:{id:badge.id,kind:'BADGE',data:badge}});
 service.ingest('entitlement.create',ent('PAINT',paint.id));service.ingest('entitlement.create',ent('BADGE',badge.id));
 const msg={userId:'42',badges:[]};assert.equal(service.profile(msg).paint.id,paint.id);assert.equal(service.profile(msg).badges[0].source,'7');
 service.ingest('entitlement.delete',ent('PAINT',paint.id));assert.equal(service.profile(msg).paint,null);
 service.ingest('cosmetic.delete',{object:{id:badge.id}});assert.equal(service.profile(msg).badges.length,0);service.close();
});
test('Moltorino assignment, active choice, hidden groups and ordering are honored',()=>{
 const service=cosmetics.create();const registry={badges:[{id:'supporter',images:{'1x':'https://cdn.test/supporter/1x','3x':'https://cdn.test/supporter'},tooltip:'Supporter',priority:1}],users:{42:{badges:['supporter'],activeBadge:'supporter',order:['m','ta','7'],hidden:['ts']}},layout:{defaultOrder:['ta','ts','tv','m','7']}};
 service.setRegistry(registry);const p=service.profile({userId:'42',badges:[{set:'subscriber',version:'1'},{set:'vip',version:'1'}]},new Map([['subscriber/1','https://cdn.test/sub'],['vip/1','https://cdn.test/vip']]));
 assert.equal(p.badges.length,2);assert.equal(p.badges[0].source,'m');assert.equal(p.badges[1].source,'ta');registry.users[42].activeBadge=null;service.setRegistry(registry);assert.equal(service.profile({userId:'42',badges:[]}).badges.length,0);service.close();
});
test('entitlement before cosmetic becomes visible once the definition arrives',()=>{
 const service=cosmetics.create();service.ingest('entitlement.create',ent('PAINT',paint.id));assert.equal(service.profile({userId:'42'}).paint,null);service.remember('PAINT',paint);assert.equal(service.profile({userId:'42'}).paint.id,paint.id);service.close();
});

test('Homies assignments use Twitch IDs and preserve animated asset URLs safely',()=>{
 const parsed=cosmetics.homiesBadges({badges:[{badgeId:'custom',userId:'42',tooltip:'Custom Badge',image1:'https://cdn.chatterinohomies.com/test/18.webp',image3:'https://cdn.chatterinohomies.com/test/72.webp'},{badgeId:'unsafe',userId:'43',image3:'javascript:alert(1)'}]});
 assert.equal(parsed.get('42')[0].source,'hc');assert.match(parsed.get('42')[0].url,/72\.webp$/);assert.equal(parsed.has('43'),false);
 assert.throws(()=>cosmetics.homiesBadges({error:'unavailable'}));
});

test('Homies refresh retains data during outages and FFZ bot coexists with green moderator role',async()=>{
 let fail=false;
 const context=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch:async endpoint=>{
  let data={schemaVersion:2,badges:[],users:{}};
  if(endpoint.includes('frankerfacez'))data={badges:[{id:2,title:'Bot',replaces:'moderator',color:'#595959',urls:{4:'https://cdn.test/bot'}}],users:{2:['42']}};
  if(endpoint.includes('chatterinohomies')){if(fail)throw Error('offline');data={badges:[{badgeId:'custom',userId:'42',image1:'https://cdn.test/small.webp',image3:'https://cdn.test/animated.webp'}]};}
  return {ok:true,json:async()=>data};
 }});
 vm.runInContext(fs.readFileSync(path.join(root,'cosmetics.js'),'utf8'),context);const service=context.OverlayCosmetics.create();
 await service.refresh();const map=new Map([['moderator/1',{url:'https://cdn.test/mod',color:'#34ae0a'}]]);
 const p=service.profile({userId:'42',badges:[{set:'moderator',version:'1'}]},map);
 assert.equal(p.badges.filter(b=>b.source==='ta').length,1);assert.equal(p.badges.find(b=>b.source==='ta').color,'#34ae0a');assert.equal(p.badges.find(b=>b.id==='2').color,'#595959');assert.equal(p.badges.find(b=>b.id==='2').source,'ff');assert.ok(p.badges.some(b=>b.source==='hc'));
 assert.equal(service.profile({userId:'42',badges:[]}).badges.find(b=>b.id==='2').color,'#595959');
 fail=true;await service.refresh();assert.ok(service.profile({userId:'42'}).badges.some(b=>b.source==='hc'));service.close();
});
