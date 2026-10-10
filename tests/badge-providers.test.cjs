'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../cosmetics.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const badge=(name,users=['42'])=>({id:name,tooltip:name,image1:'https://cdn.test/'+name,users});
const blue=id=>({id,tooltip:id,...Object.fromEntries(['1x','2x','4x'].map(size=>['image_url_'+size,'https://bluzyrino-badge-registry.blu901-55.workers.dev/badges/'+id+'-'+size+'.webp']))});
const payloads={
 'https://api.chatterino.com/badges':{badges:[badge('donor'),badge('developer')]},
 'https://api.ffzap.com/v1/supporters':[{id:'42',badge_color:'#123456',badge_is_colored:1}],
 'https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges':{version:1,catalog:[blue('staff'),blue('supporter')],badges:[{id:'supporter',users:['42']},{id:'staff',users:['42']}]},
 'https://itzalex.github.io/badges':{badges:[badge('supporter')]},
 'https://itzalex.github.io/badges2':{badges:[badge('staff')]},
 'https://chatterinohomies.com/api/badges/list':{badges:[{userId:'42',image1:'https://cdn.test/custom'}]},
 'https://api.frankerfacez.com/v1/badges/ids':{badges:[]},
 'https://api.moltorino.com/v2/badges':{schemaVersion:2,generation:'test',bundleVersion:1,badges:[],users:{42:{decorations:false}}}
};
function environment(fetch=async endpoint=>({ok:true,json:async()=>payloads[endpoint]})){
 const sockets=[];class WebSocket{constructor(url){this.url=url;this.sent=[];sockets.push(this);}send(message){this.sent.push(JSON.parse(message));}close(){this.closed=true;this.onclose?.();}}
 const c=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch,WebSocket});vm.runInContext(code,c);return {api:c.OverlayCosmetics,service:c.OverlayCosmetics.create(),sockets};
}
test('all newly loaded providers have native precedence, including both Homies supporter lists',async()=>{
 const {service}=environment();await service.refresh();service.ingestBttv({name:'lookup_user',data:{providerId:'42',badge:{url:'https://cdn.test/bttv'}}});
 const badges=service.profile({userId:'42'}).badges;assert.deepEqual(plain(badges.map(b=>b.source)),['c','fa','bt','bl','hs','hs']);
 assert.equal(badges[0].title,'developer');assert.equal(badges[1].color,'#123456');assert.equal(badges[3].id,'bluzyrino:staff');service.close();
});
test('extra providers independently obey category visibility and retain cached data on failure',async()=>{
 let fail=false;const {service}=environment(async endpoint=>{if(fail)throw Error('offline');return {ok:true,json:async()=>payloads[endpoint]};});await service.refresh();
 service.setRegistry({badges:[],users:{42:{hidden:['c','fa','bl','hs']}}});assert.deepEqual(plain(service.profile({userId:'42'}).badges.map(b=>b.source)),['hc']);
 await service.refresh();fail=true;await service.refresh();assert.deepEqual(plain(service.profile({userId:'42'}).badges.map(b=>b.source)),['c','fa','bl','hs','hs']);service.close();
});
test('FFZ:AP special labels and typed colored flag match native rules',()=>{
 const {api,service}=environment();const map=api.parsers.ffzapBadges([{id:'26964566',badge_is_colored:'TRUE',badge_color:'#abcdef'},{id:'4867723',badge_is_colored:'false',badge_color:'#abcdef'},{id:'42',badge_is_colored:0}]);
 assert.equal(map.get('26964566')[0].title,'FFZ:AP Developer');assert.equal(map.get('26964566')[0].color,'#abcdef');assert.equal(map.get('4867723')[0].title,'FFZ:AP Helper');assert.equal(map.get('4867723')[0].color,'');assert.equal(map.get('42')[0].title,'FFZ:AP Supporter');service.close();
});
test('Bluzyrino rejects malformed assignments atomically and uses catalog precedence',()=>{
 const {api,service}=environment(),data=payloads['https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges'];assert.equal(api.parsers.bluzyrinoBadges(data).get('42')[0].id,'bluzyrino:staff');
 assert.throws(()=>api.parsers.bluzyrinoBadges({...data,badges:[{id:'unknown',users:['42']}]}));
 assert.throws(()=>api.parsers.bluzyrinoBadges({...data,catalog:[{...blue('staff'),image_url_4x:'https://other.test/a'}]}));service.close();
});
test('Bluzyrino limits distinct badges per user to sixteen',()=>{
 const {api,service}=environment(),catalog=Array.from({length:17},(_,i)=>blue('badge'+i));
 const badges=catalog.map(b=>({id:b.id,users:['42','42']}));
 assert.equal(api.parsers.bluzyrinoBadges({version:1,catalog:catalog.slice(0,16),badges:badges.slice(0,16)}).size,1);
 assert.throws(()=>api.parsers.bluzyrinoBadges({version:1,catalog,badges}));service.close();
});
test('BTTV subscribes read-only, never broadcasts a viewer identity, and closes both sockets',()=>{
 const {service,sockets}=environment();service.connect('99');assert.equal(sockets.length,2);const socket=sockets.find(s=>s.url.includes('betterttv'));socket.onopen();
 assert.deepEqual(plain(socket.sent),[{name:'join_channel',data:{name:'twitch:99'}}]);
 socket.onmessage({data:JSON.stringify({name:'lookup_user',data:{providerId:'42',badge:{url:'https://cdn.test/bttv'}}})});assert.equal(service.profile({userId:'42'}).badges[0].source,'bt');
 service.close();assert.ok(sockets.every(s=>s.closed));
});
