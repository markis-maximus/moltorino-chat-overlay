'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../cosmetics.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const response=data=>({ok:true,json:async()=>data});
const definition=id=>({id,images:{'1x':`https://cdn.test/${id}/1x`,'3x':`https://cdn.test/${id}/3x`}});
const registry=(version,id='supporter',generation='epoch-one')=>({schemaVersion:2,generation,bundleVersion:version,badges:[definition(id)],users:{42:{badges:[id]}}});
function environment(fetch=async()=>response({badges:[]})){
 const c=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch});vm.runInContext(source,c);
 const statuses=[],service=c.OverlayCosmetics.create({onStatus:s=>statuses.push(s)});return {api:c.OverlayCosmetics,service,statuses};
}
const selected=service=>service.profile({userId:'42'}).badges.find(b=>b.source==='m')?.id||null;
test('registry freshness: late older response cannot roll back a newer bundle',async()=>{
 const pending=[];const {service}=environment(async endpoint=>endpoint.includes('moltorino')?new Promise(resolve=>pending.push(resolve)):response({badges:[]}));
 const a=service.refresh(),b=service.refresh();pending[1](response(registry(12,'new')));await b;pending[0](response(registry(11,'old')));await a;
 assert.equal(selected(service),'moltorino:new');service.close();
});
test('registry freshness: a later request with a lower bundle in the same generation is rejected',async()=>{
 let data=registry(12,'new');const {service}=environment(async endpoint=>response(endpoint.includes('moltorino')?data:{badges:[]}));
 await service.refresh();data=registry(11,'old');await service.refresh();assert.equal(selected(service),'moltorino:new');
 data=registry(1,'reset','epoch-two');await service.refresh();assert.equal(selected(service),'moltorino:reset');service.close();
});
test('malformed registry metadata preserves cached badges and reports failure',async()=>{
 let data=registry(12);const {service,statuses}=environment(async endpoint=>response(endpoint.includes('moltorino')?data:{badges:[]}));await service.refresh();
 for(const invalid of [{schemaVersion:2,badges:[],users:{}},{...registry(13),generation:' '},{...registry(13),bundleVersion:-1},{...registry(13),bundleVersion:1.2},{...registry(13),users:[]}]){
  data=invalid;await service.refresh();assert.equal(selected(service),'moltorino:supporter');
 }
 assert.ok(statuses.some(s=>s.message.includes('Moltorino')&&s.state==='warning'));service.close();
});
test('close prevents an in-flight refresh from mutating cached state',async()=>{
 let resolve;const {service}=environment(async endpoint=>endpoint.includes('moltorino')?new Promise(r=>resolve=r):response({badges:[]}));
 service.setRegistry(registry(1,'initial'));const pending=service.refresh();service.close();resolve(response(registry(2,'late')));await pending;assert.equal(selected(service),'moltorino:initial');
});
for(const changed of ['paint','badge'])test(`7TV ${changed} event protects only that field during profile lookup`,async()=>{
 let resolve;const {service}=environment(async()=>new Promise(r=>resolve=r));
 const oldPaint='aaaaaaaaaaaaaaaaaaaaaaaa',newPaint='bbbbbbbbbbbbbbbbbbbbbbbb',oldBadge='cccccccccccccccccccccccc',newBadge='dddddddddddddddddddddddd';
 for(const id of [oldPaint,newPaint])service.remember('PAINT',{id,function:'LINEAR_GRADIENT',stops:[{at:0,color:-1}]});
 for(const id of [oldBadge,newBadge])service.remember('BADGE',{id,host:{url:'https://cdn.test/'+id,files:[{name:'3x.webp'}]}});
 const pending=service.ensureUser('42');service.ingest('entitlement.create',{object:{kind:changed.toUpperCase(),ref_id:changed==='paint'?newPaint:newBadge,user:{connections:[{platform:'TWITCH',id:'42'}]}}});
 resolve(response({user:{style:{paint_id:oldPaint,badge_id:oldBadge}}}));await pending;
 const result=service.profile({userId:'42'});assert.equal(result.paint?.id,changed==='paint'?newPaint:oldPaint);assert.equal(result.badges.find(b=>b.source==='7')?.id,changed==='badge'?newBadge:oldBadge);service.close();
});
test('category assignments precede root assignments and inherit false decorations',async()=>{
 const {service}=environment(async endpoint=>response(endpoint.includes('chatterinohomies')?{badges:[{userId:'42',image1:'https://cdn.test/custom'}]}:{badges:[]}));await service.refresh();
 const data=registry(1,'second');data.badges.unshift({...definition('first'),users:[{id:'42',decorations:false}]});
 service.setRegistry(data);assert.equal(selected(service),'moltorino:first');assert.ok(!service.profile({userId:'42'}).badges.some(b=>b.source==='hc'));
 data.users[42].activeBadge='second';service.setRegistry(data);assert.equal(selected(service),'moltorino:second');service.close();
});
test('category object assignments and whitespace image fallback follow native parsing',()=>{
 const {service}=environment();service.setRegistry({schemaVersion:2,badges:[{id:' x ',images:{'1x':' '},image1:' https://cdn.test/x ',users:{' 42 ':{}}}],users:{}});
 assert.equal(selected(service),'moltorino:x');service.close();
});
test('Homies keeps only the last valid custom assignment per user',()=>{
 const {api,service}=environment();const result=api.homiesBadges({badges:[{userId:'42',badgeId:'old',image1:'https://cdn.test/old'},{userId:'42',badgeId:'new',image1:'https://cdn.test/new'},{userId:'42',badgeId:'invalid',image3:'https://cdn.test/invalid'}]});
 assert.deepEqual(plain(result.get('42').map(b=>b.id)),['homies:new']);service.close();
});
test('paint one-stop gradient renders its color over the username color',()=>{
 const {api,service}=environment();const style=api.paintStyle({function:'LINEAR_GRADIENT',stops:[{at:0,color:0xff000080}]},'#0000ff');
 assert.equal(style.color,'rgba(128,0,127,1)');service.close();
});
test('paint radial radius follows half the largest dimension and images stretch',()=>{
 const {api,service}=environment();const style=api.paintStyle({function:'RADIAL_GRADIENT',shape:'ellipse',stops:[{at:0,color:-1},{at:1,color:255}]},'#ffffff',{width:200,height:20});
 assert.match(style.background,/circle 100px at center/);assert.equal(api.paintStyle({function:'URL',image_url:'https://cdn.test/paint'}).backgroundSize,'100% 100%');service.close();
});
test('paint valid shadows and stops are not silently truncated',()=>{
 const {api,service}=environment();const style=api.paintStyle({function:'LINEAR_GRADIENT',stops:Array.from({length:40},(_,i)=>({at:i/39,color:-1})),shadows:Array.from({length:8},()=>({x_offset:30,y_offset:-25,radius:24,color:-1}))});
 assert.equal((style.background.match(/rgba/g)||[]).length,40);assert.equal((style.filter.match(/drop-shadow/g)||[]).length,8);assert.match(style.filter,/30px -25px/);service.close();
});
for(const action of ['update','delete','close'])test(`late cosmetic definition cannot undo ${action}`,async()=>{
 let resolve;const {service}=environment(async()=>new Promise(r=>resolve=r));
 const id='aaaaaaaaaaaaaaaaaaaaaaaa';
 service.ingest('entitlement.create',{object:{kind:'PAINT',ref_id:id,user:{connections:[{platform:'TWITCH',id:'42'}]}}});
 if(action==='close')service.close();
 else service.ingest('cosmetic.'+action,{object:{id,kind:'PAINT',data:{id,name:'new',function:'LINEAR_GRADIENT',stops:[]}}});
 resolve(response({data:{cosmetics:{paints:[{id,name:'old',function:'LINEAR_GRADIENT',stops:[]}]}}}));
 await new Promise(r=>setTimeout(r,0));
 assert.equal(service.profile({userId:'42'}).paint?.name,action==='update'?'new':undefined);service.close();
});
