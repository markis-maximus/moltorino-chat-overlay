'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const cases=require('./fixtures/moltorino-rules.json');
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/moltorino-public-v2.json'),'utf8').replace(/^\uFEFF/,''));
const plain=value=>JSON.parse(JSON.stringify(value));
const paint={id:'01FRV9TXD0000E7692NF398GSS',function:'LINEAR_GRADIENT',angle:90,stops:[{at:0,color:-16776961},{at:1,color:65535}]};
const seven={id:'01H85EF8DR00020G66EN3RFP9G',host:{url:'https://cdn.test/seven',files:[{name:'3x.webp',format:'WEBP'}]}};
const definitions=[{id:'founder',priority:75},{id:'supporter',priority:100},{id:'developer',priority:10,listed:false}].map(b=>({...b,images:{'1x':'https://cdn.test/'+b.id+'/1x','3x':'https://cdn.test/'+b.id}}));
function environment(){
 const context=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch:async endpoint=>{
  const data=endpoint.includes('chatterinohomies')?{badges:[{userId:'42',badgeId:'custom',image1:'https://cdn.test/custom.webp',image3:'https://cdn.test/custom.webp'}]}:endpoint.includes('frankerfacez')?{badges:[]}:{schemaVersion:2,badges:[],users:{}};
  return {ok:true,json:async()=>data};
 }});
 for(const file of ['cosmetics.js','providers.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const api=context.OverlayCosmetics,service=api.create();
 service.remember('PAINT',paint);service.remember('BADGE',seven);
 for(const [kind,id] of [['PAINT',paint.id],['BADGE',seven.id]])service.ingest('entitlement.create',{object:{kind,ref_id:id,user:{connections:[{platform:'TWITCH',id:'42'}]}}});
 return {api,service,providers:context.OverlayProviders};
}
function registry(preferences){return {schemaVersion:2,badges:definitions,users:{42:preferences}};}
function message(sets=[]){return {userId:'42',badges:sets.map(set=>({set,version:'1'}))};}
function assets(sets){return new Map(sets.map(set=>[set+'/1','https://cdn.test/'+set.trim()]));}

for(const [group,sets] of Object.entries(cases.twitchGroups))for(const set of sets)test(`native mapping: ${set} -> ${group}`,()=>{
 const {service}=environment();
 assert.equal(service.profile(message([set]),assets([set])).badges.find(b=>b.set===set).source,group);service.close();
});
for(const fixture of cases.layouts)test('native layout: '+fixture.name,()=>{
 const {api,service}=environment();
 assert.deepEqual(plain(api.normalizeLayout(fixture.preferences,fixture.defaultOrder)),fixture.expected);service.close();
});
for(const fixture of cases.selections)test('native selection: '+fixture.name,()=>{
 const {service}=environment();service.setRegistry(registry(fixture.preferences));
 const selected=service.profile(message()).badges.find(b=>b.source==='m');
 assert.equal(selected?.id.replace('moltorino:','')||null,fixture.expected);service.close();
});
test('native layout: hiding tv keeps VIP/moderator and hides ordinary Twitch badges',()=>{
 const {service}=environment(),sets=['vip','moderator','bits','premium','subscriber'];
 service.setRegistry(registry({hidden:['tv']}));
 assert.deepEqual(plain(service.profile(message(sets),assets(sets)).badges.filter(b=>b.set).map(b=>b.set)),['vip','moderator','subscriber']);service.close();
});
test('native layout: legacy hidden key hides the entire role group including custom FFZ role images',()=>{
 const {service,providers}=environment(),sets=['moderator','vip','bits'],map=assets(sets);
 providers.parsers.channelBadges({mod_urls:{4:'https://cdn.test/custom-mod'},vip_badge:{4:'https://cdn.test/custom-vip'}},map);
 service.setRegistry(registry({hidden:['t:vip']}));
 assert.deepEqual(plain(service.profile(message(sets),map).badges.filter(b=>b.set).map(b=>b.set)),['bits']);service.close();
});
test('native layout: equal slot ranks keep incoming badge order',()=>{
 const {service}=environment(),sets=['vip','moderator','broadcaster'];service.setRegistry(registry({order:['ta']}));
 assert.deepEqual(plain(service.profile(message(sets),assets(sets)).badges.filter(b=>b.set).map(b=>b.set)),sets);service.close();
});
test('native layout: absent layout leaves Twitch insertion order and native supported-provider order',async()=>{
 const {service}=environment();await service.refresh();service.setRegistry(registry({badges:['founder']}));
 const sets=['bits','vip','subscriber'];
 assert.deepEqual(plain(service.profile(message(sets),assets(sets)).badges.map(b=>b.source)),['tv','ta','ts','m','7','hc']);service.close();
});
test('native decorations: only boolean false suppresses Homies custom, never paint or other badges',async()=>{
 const {service}=environment();await service.refresh();
 for(const value of [false,true,undefined,null,0,'false']){
  service.setRegistry(registry({badges:['founder'],...(value===undefined?{}:{decorations:value})}));
  const profile=service.profile(message(['moderator']),assets(['moderator']));
  assert.equal(profile.paint?.id,paint.id,`paint: ${value}`);
  assert.deepEqual(plain(profile.badges.map(b=>b.source)),value===false?['ta','m','7']:['ta','m','7','hc'],`badges: ${value}`);
 }
 service.close();
});
test('native decorations and hidden slots remain separate and reversible',async()=>{
 const {service}=environment();await service.refresh();
 service.setRegistry(registry({decorations:false,hidden:['7','m'],badges:['founder']}));
 assert.equal(service.profile(message()).paint?.id,paint.id);assert.equal(service.profile(message()).badges.length,0);
 service.setRegistry(registry({decorations:true,hidden:['hc'],badges:['founder']}));
 assert.deepEqual(plain(service.profile(message()).badges.map(b=>b.source)),['m','7']);service.close();
});
for(const [id,expected] of Object.entries(captured.expectedSelections))test(`public bundle 910: user ${id} selects ${expected}`,()=>{
 const {service}=environment();service.setRegistry(captured.registry);
 const selected=service.profile({userId:id}).badges.find(b=>b.source==='m');
 assert.equal(selected?.id.replace('moltorino:','')||null,expected);service.close();
});
test('public bundle 910: developer preference hides selected Twitch badges while preserving VIP',()=>{
 const {service}=environment(),sets=['vip','premium','bits','subscriber'];service.setRegistry(captured.registry);
 const profile=service.profile({...message(sets),userId:'506954718'},assets(sets));
 assert.deepEqual(plain(profile.badges.map(b=>b.id)),['t:vip','t:subscriber','moltorino:top_donor_alt']);service.close();
});
test('all nine public Moltorino IDs retain their explicit tooltip and asset mapping',()=>{
 const {service}=environment();
 for(const badge of captured.registry.badges){
  service.setRegistry({...captured.registry,users:{42:{badges:[badge.id]}}});
  const actual=service.profile(message()).badges.find(b=>b.source==='m');
  assert.deepEqual(plain(actual),{id:'moltorino:'+badge.id,source:'m',title:badge.tooltip,url:badge.images['3x']});
 }
 service.close();
});
test('native badge definitions require a 1x image before they can be assigned',()=>{
 const {service}=environment();
 service.setRegistry({...registry({badges:['broken','founder']}),badges:[{id:'broken',images:{'3x':'https://cdn.test/broken'}},...definitions]});
 assert.equal(service.profile(message()).badges.find(b=>b.source==='m')?.id,'moltorino:founder');service.close();
});
test('native global FFZ badges stay in ff and coexist with the Twitch role despite replaces metadata',async()=>{
 const context=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch:async endpoint=>({ok:true,json:async()=>endpoint.includes('frankerfacez')?{badges:[{id:10,title:'Other',urls:{4:'https://cdn.test/other'}},{id:2,title:'Bot',replaces:'moderator',color:'#595959',urls:{4:'https://cdn.test/bot'}}],users:{2:['42'],10:['42']}}:{schemaVersion:2,badges:[],users:{}}})});
 vm.runInContext(fs.readFileSync(path.join(root,'cosmetics.js'),'utf8'),context);
 const service=context.OverlayCosmetics.create();await service.refresh();
 for(const [hidden,expected] of [[[],['t:moderator','2','10']],[['ff'],['t:moderator']],[['ta'],['2','10']]]){
  service.setRegistry(registry({hidden}));const profile=service.profile(message(['moderator']),assets(['moderator']));
  assert.deepEqual(plain(profile.badges.map(b=>b.id)),expected);
  if(!hidden.includes('ff')){assert.equal(profile.badges.find(b=>b.id==='2').source,'ff');assert.equal(profile.badges.find(b=>b.id==='2').color,'#595959');}
 }
 service.close();
});
