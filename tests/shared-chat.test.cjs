'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),plain=x=>JSON.parse(JSON.stringify(x));
function environment(){
 let requests=0;const c=vm.createContext({URL,Map,Set,Date,Promise,setTimeout,clearTimeout,AbortController,fetch:async()=>{requests++;return {ok:true,json:async()=>[{id:'55',displayName:'SourceChannel',login:'sourcechannel',logo:'https://cdn.test/avatar'}]};}});
 for(const file of ['transport.js','cosmetics.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const service=c.OverlayCosmetics.create();return {service,transport:c.OverlayTransport,requests:()=>requests};
}
const line='@room-id=99;source-room-id=55;source-badges=moderator/1,vip/1,subscriber/5;badges=moderator/1,subscriber/5;user-id=42;display-name=Viewer :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #test :hello';
test('shared chat preserves origin roles, deduplicates local roles and keeps origin outside vanity slots',()=>{
 const {service,transport}=environment();const message=transport.toMessage(transport.parseLine(line));
 assert.equal(message.sourceRoomId,'55');assert.equal(message.roomId,'99');assert.equal(message.sourceBadges.length,3);
 const map=new Map([['moderator/1','https://cdn.test/local-custom-mod'],['vip/1','https://cdn.test/local-custom-vip'],['subscriber/5','https://cdn.test/sub']]);
 map.twitchDefaults=new Map([['moderator/1','https://cdn.test/default-mod'],['vip/1','https://cdn.test/default-vip']]);
 let profile=service.profile(message,map);assert.deepEqual(plain(profile.badges.map(b=>b.source)),['shared','ta','ta','ts']);assert.equal(profile.badges[1].url,'https://cdn.test/default-mod');
 service.setRegistry({badges:[],users:{42:{hidden:['ta'],order:['ts']}}});profile=service.profile(message,map);assert.deepEqual(plain(profile.badges.map(b=>b.source)),['shared','ts']);service.close();
});
test('shared-room metadata lookup is deduplicated and enriches the origin badge and role tooltip',async()=>{
 const {service,transport,requests}=environment(),message=transport.toMessage(transport.parseLine(line));
 await Promise.all([service.ensureSharedRoom('55'),service.ensureSharedRoom('55')]);assert.equal(requests(),1);
 const profile=service.profile(message,new Map([['moderator/1','https://cdn.test/mod']]));assert.equal(profile.badges[0].url,'https://cdn.test/avatar');assert.match(profile.badges[0].title,/SourceChannel/);assert.match(profile.badges[1].title,/SourceChannel/);service.close();
});
test('own-channel messages and malformed source IDs do not acquire shared-chat badges',()=>{
 const {service,transport}=environment();for(const value of ['99','not-an-id']){
  const message=transport.toMessage(transport.parseLine(line.replace('source-room-id=55','source-room-id='+value)));
  assert.ok(!service.profile(message).badges.some(b=>b.source==='shared'));
 }service.close();
});
