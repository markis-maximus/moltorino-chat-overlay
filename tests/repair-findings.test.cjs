'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function clockEnvironment(file){
 let now=1000,sequence=0;const timers=new Map(),sockets=[],statuses=[],messages=[];
 class WebSocket{
  constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
  send(message){this.sent.push(message);}
  // Deliberately no close event: watchdogs must retire and reconnect themselves.
  close(){this.readyState=3;}
  open(){this.readyState=1;this.onopen?.();}
  receive(message){this.onmessage?.({data:message});}
 }
 const c=vm.createContext({URL,Map,Set,Promise,Math,console,AbortController,WebSocket,Date:class extends Date{static now(){return now;}},setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(read(file),c);
 function tick(ms){const target=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=target;}
 const service=file==='transport.js'?c.OverlayTransport.connect('test_channel',{onStatus:s=>statuses.push(s),onMessage:m=>messages.push(m)}):c.OverlayCosmetics.create();
 return {c,service,sockets,timers,tick,statuses,messages};
}
const joined=socket=>{socket.open();socket.receive('@room-id=99 :tmi.twitch.tv ROOMSTATE #test_channel\r\n');};
for(const phase of ['handshake','join','idle'])test(`Twitch ${phase} timeout reconnects even without a close event`,()=>{
 const e=clockEnvironment('transport.js'),first=e.sockets[0];
 if(phase==='join')first.open();if(phase==='idle')joined(first);
 e.tick(phase==='idle'?360000:20000);assert.equal(first.readyState,3);assert.equal(e.statuses.at(-1).state,'reconnecting');
 e.tick(1400);assert.equal(e.sockets.length,2);e.service.close();assert.equal(e.timers.size,0);
});
test('Twitch inbound keepalives extend the idle deadline and only emit protocol replies',()=>{
 const e=clockEnvironment('transport.js');joined(e.sockets[0]);e.tick(300000);e.sockets[0].receive('PING :tmi.twitch.tv\r\n');e.tick(60001);
 assert.equal(e.sockets.length,1);assert.equal(e.sockets[0].readyState,1);assert.equal(e.sockets[0].sent.at(-1),'PONG :tmi.twitch.tv\r\n');e.service.close();assert.equal(e.timers.size,0);
});
test('late Twitch callbacks cannot change a replacement socket or restart a closed service',()=>{
 const e=clockEnvironment('transport.js'),old=e.sockets[0],open=old.onopen,error=old.onerror,close=old.onclose;
 e.tick(21400);assert.equal(e.sockets.length,2);open();error();close();assert.equal(e.sockets.length,2);
 e.service.close();e.tick(1000000);assert.equal(e.sockets.length,2);assert.equal(e.timers.size,0);
});
test('USERNOTICE user text preserves names, emotes, badges, IDs and subscription flags',()=>{
 const e=clockEnvironment('transport.js');joined(e.sockets[0]);
 const line='@id=notice-1;room-id=99;msg-id=resub;login=viewer;display-name=Viewer;user-id=42;badges=subscriber/3;emotes=25:2-6 :tmi.twitch.tv USERNOTICE #test_channel :😀 Kappa ffzW\r\n';
 e.sockets[0].receive(line+line);assert.equal(e.messages.length,1);const m=e.messages[0];
 assert.equal(m.username,'viewer');assert.equal(m.noticeType,'resub');assert.equal(m.isSubscription,true);assert.equal(m.userId,'42');assert.deepEqual(plain(m.emotes),[{id:'25',start:2,end:6}]);assert.equal(m.badges[0].set,'subscriber');e.service.close();
});
test('shared announcements render, while mirrored payments, empty and unknown notices do not',()=>{
 const e=clockEnvironment('transport.js'),parse=e.c.OverlayTransport.parseLine,toMessage=e.c.OverlayTransport.toMessage;
 const notice=(type,text='content',extra='')=>toMessage(parse(`@msg-id=${type};room-id=99;source-room-id=55;${extra} :tmi.twitch.tv USERNOTICE #test_channel :${text}`));
 assert.equal(notice('announcement').noticeType,'announcement');assert.equal(notice('sharedchatnotice','content','source-msg-id=announcement;').noticeType,'announcement');
 for(const [type,text,extra] of [['resub','content',''],['sharedchatnotice','content','source-msg-id=resub;'],['announcement','',''],['unknown','content','']])assert.equal(notice(type,text,extra),null);
 e.sockets[0].open();e.sockets[0].receive('@msg-id=announcement :tmi.twitch.tv USERNOTICE #other :wrong channel\r\n');assert.equal(e.messages.length,0);e.service.close();
});
for(const phase of ['handshake','renewal'])test(`BetterTTV ${phase} deadline reconnects read-only and preserves badges`,()=>{
 const e=clockEnvironment('cosmetics.js');e.service.connect('99');const bt=e.sockets.find(s=>s.url.includes('betterttv'));
 // Keep the separate 7TV socket out of this isolated BTTV clock exercise.
 const seven=e.sockets.find(s=>s.url.includes('7tv'));seven.receive(JSON.stringify({op:1,d:{heartbeat_interval:1000000}}));
 if(phase==='renewal'){bt.open();e.service.ingestBttv({name:'lookup_user',data:{providerId:'42',badge:{url:'https://example.test/badge'}}});}
 e.tick(phase==='renewal'?900000:20000);assert.equal(bt.readyState,3);e.tick(1000);
 assert.equal(e.sockets.filter(s=>s.url.includes('betterttv')).length,2);
 if(phase==='renewal'){assert.equal(e.service.profile({userId:'42'}).badges[0].source,'bt');assert.deepEqual(bt.sent.map(JSON.parse),[{name:'join_channel',data:{name:'twitch:99'}}]);}
 e.service.close();assert.equal(e.timers.size,0);
});
test('7TV hello timeout retires without needing a browser close event',()=>{
 const e=clockEnvironment('cosmetics.js');e.service.connect('99');e.tick(21000);assert.equal(e.sockets.filter(s=>s.url.includes('7tv')).length,2);e.service.close();assert.equal(e.timers.size,0);
});
test('cosmetic sockets retry synchronous connection failures and stop all retries on close',()=>{
 const e=clockEnvironment('cosmetics.js');let attempts=0;e.c.WebSocket=class{constructor(){attempts++;throw Error('Unavailable');}};
 e.service.connect('99');assert.equal(attempts,2);e.tick(1000);assert.equal(attempts,4);e.service.close();e.tick(1000000);assert.equal(attempts,4);assert.equal(e.timers.size,0);
});
test('late BTTV open callbacks cannot subscribe a retired connection to a new channel',()=>{
 const e=clockEnvironment('cosmetics.js');e.service.connect('99');const old=e.sockets.find(s=>s.url.includes('betterttv')),open=old.onopen;
 e.service.connect('100');open();assert.equal(old.sent.length,0);e.service.close();assert.equal(e.timers.size,0);
});
function providerEnvironment(fetch){const c=vm.createContext({URL,Map,Set,AbortController,setTimeout,clearTimeout,fetch});vm.runInContext(read('providers.js'),c);return c.OverlayProviders;}
function payload(endpoint){
 if(endpoint.includes('frankerfacez'))return endpoint.includes('/room/')?{room:{twitch_id:'42'},sets:{}}:{default_sets:[],sets:{}};
 if(endpoint.includes('/3/cached/users/'))return {channelEmotes:[],sharedEmotes:[]};
 if(endpoint.includes('7tv'))return endpoint.includes('emote-sets')?{emotes:[]}:{emote_set:null};
 return [];
}
test('a malformed FFZ response preserves its last parsed cache without losing valid BTTV updates',async()=>{
 let mode='good';const api=providerEnvironment(async endpoint=>{
  if(mode==='outage')throw Error('offline');let data=payload(endpoint);
  if(endpoint.endsWith('/set/global'))data=mode==='bad'?{sets:{1:{emoticons:{}}}}:{default_sets:[1],sets:{1:{emoticons:[{id:1,name:'GoodFFZ',urls:{1:'https://example.test/ffz'}}]}}};
  if(endpoint.endsWith('/3/cached/emotes/global'))data=[{id:'bt',code:'GoodBTTV'}];return {ok:true,json:async()=>data};
 });
 await api.load('test_channel');mode='bad';const b=await api.load('test_channel');assert.ok(b.emotes.has('GoodFFZ'));assert.ok(b.emotes.has('GoodBTTV'));assert.ok(b.failures.includes('FFZ global emotes'));
 mode='outage';const cached=await api.load('test_channel');assert.ok(cached.emotes.has('GoodFFZ'));assert.ok(cached.emotes.has('GoodBTTV'));
});
test('malformed 7TV and Twitch badge collections are isolated before cache replacement',async()=>{
 const api=providerEnvironment(async endpoint=>{let data=payload(endpoint);if(endpoint.includes('7tv'))data={emotes:{}};if(endpoint.includes('/badges/'))data=[{set_id:'x',versions:{}}];if(endpoint.endsWith('/3/cached/emotes/global'))data=[{id:'bt',code:'StillWorks'}];return {ok:true,json:async()=>data};});
 const result=await api.load('test_channel');assert.ok(result.emotes.has('StillWorks'));assert.ok(result.failures.includes('7TV global emotes'));assert.ok(result.failures.includes('Global Twitch badges'));
});
