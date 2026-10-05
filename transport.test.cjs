const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sockets = [], timers = new Map();
let timerId = 0;
class FakeSocket {
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
  send(value) { this.sent.push(value); }
  close() { this.readyState = 3; if (this.onclose) this.onclose(); }
  open() { this.readyState = 1; this.onopen(); }
  receive(value) { this.onmessage({data: value}); }
}
const context = vm.createContext({console, URL, AbortController, WebSocket: FakeSocket,
  setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); },
  fetch() { throw new Error('No network in unit tests'); }
});
for (const file of ['transport.js', 'providers.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
const transport = context.OverlayTransport;
const normalize = value => JSON.parse(JSON.stringify(value));
assert.equal(transport.channelName(' #Markis_Maximus '), 'markis_maximus');
assert.throws(() => transport.channelName('name\r\nPRIVMSG #channel :oops'));
const sample = '@id=abc;display-name=Alice\\sCo\\:Op;user-id=42;color=#abcdef;badges=moderator/1,subscriber/12;emotes=25:2-6;test=one\\\\two\\nthree :alice!alice@alice.tmi.twitch.tv PRIVMSG #markis_maximus :😀 Kappa ffzW';
const message = transport.toMessage(transport.parseLine(sample));
assert.equal(message.displayName, 'Alice Co;Op');
assert.equal(message.tags.test, 'one\\two\nthree');
assert.equal(message.text, '😀 Kappa ffzW');
assert.equal(Array.from(message.text).slice(message.emotes[0].start, message.emotes[0].end + 1).join(''), 'Kappa');
assert.deepEqual(normalize(message.badges), [{set: 'moderator', version: '1'}, {set: 'subscriber', version: '12'}]);
const action = transport.toMessage(transport.parseLine('@emotes=25:0-4 :alice!alice@tmi.twitch.tv PRIVMSG #markis_maximus :\x01ACTION Kappa ffzW\x01'));
assert.equal(action.text, 'Kappa ffzW');
assert.equal(action.isAction, true);
assert.deepEqual(normalize(action.emotes), [{id: '25', start: 0, end: 4}]);
assert.deepEqual(normalize(transport.parseEmotes('25:4-2,0-500/unsafe?:0-3/25:0-4', 5)), [{id: '25', start: 0, end: 4}]);
assert.equal(transport.parseLine(':bad'), null);
assert.equal(transport.parseLine('@bad'), null);
const messages = [], clears = [], deletes = [], statuses = [];
const connection = transport.connect('markis_maximus', {onMessage: m => messages.push(m), onClear: m => clears.push(m), onDelete: m => deletes.push(m), onStatus: m => statuses.push(m)});
const ws = sockets[0];
ws.open();
assert.deepEqual(ws.sent.map(line => line.split(' ')[0]), ['CAP', 'PASS', 'NICK', 'JOIN']);
assert.equal(ws.sent.some(line => line.startsWith('PRIVMSG')), false);
ws.receive('PING :tmi.twitch.tv\r');
assert.equal(ws.sent.length, 4);
ws.receive('\n@room-id=95463358 :tmi.twitch.tv ROOMSTATE #markis_maximus\r\n' + sample + '\r\n' + sample + '\r\n');
assert.equal(messages.length, 1, 'duplicate IDs are suppressed');
assert.equal(ws.sent[4], 'PONG :tmi.twitch.tv\r\n');
assert.equal(statuses.at(-1).state, 'connected');
ws.receive('@target-user-id=42 :tmi.twitch.tv CLEARCHAT #markis_maximus :alice\r\n@target-msg-id=abc :tmi.twitch.tv CLEARMSG #markis_maximus :deleted\r\n:tmi.twitch.tv CLEARCHAT #elsewhere\r\n');
assert.deepEqual(normalize(clears), [{userId: '42', username: 'alice', all: false}]);
assert.deepEqual(normalize(deletes), [{id: 'abc'}]);
ws.receive(':tmi.twitch.tv CLEARCHAT #markis_maximus\r\n');
assert.equal(clears[1].all, true);
connection.close();
assert.equal(timers.size, 0, 'closing clears reconnect and watchdog timers');
assert.equal(ws.sent.some(line => /^(PRIVMSG|USER|AUTHENTICATE)\b/.test(line)), false);

const p = context.OverlayProviders.parsers;
const map = new Map();
p.ffz({default_sets:[1], sets:{1:{emoticons:[{id:1,name:'ffzW',modifier:true,modifier_flags:9,modifier_prefix:false,width:32,height:32,urls:{4:'//cdn.frankerfacez.com/emote/1/4'}}]}, 2:{emoticons:[{id:2,name:'NotGlobal',urls:{1:'https://example.com/2'}},{id:3,name:'AdditionalModifier',modifier:true,modifier_flags:3,urls:{1:'https://example.com/3'}}]}}}, map, true);
assert.equal(map.has('NotGlobal'), false);
assert.equal(map.get('ffzW').modifierFlags, 9);
assert.equal(map.get('ffzW').modifier_flags, 9);
assert.equal(map.get('AdditionalModifier').modifierFlags, 3);
assert.equal(map.get('ffzW').zeroWidth, true);
assert.equal(map.get('ffzW').url, 'https://cdn.frankerfacez.com/emote/1/4');
p.sevenTV({emotes:[{name:'Alias', flags:0, data:{id:'01ABC',flags:256,host:{url:'//cdn.7tv.app/emote/01ABC',files:[{name:'1x.webp',width:64,height:32,format:'WEBP'},{name:'3x.webp',width:192,height:96,format:'WEBP'}]}}}]},map);
assert.equal(map.get('Alias').zeroWidth,true);
assert.equal(map.get('Alias').width,64);
assert.equal(map.get('Alias').height,32);
assert.equal(map.get('Alias').url,'https://cdn.7tv.app/emote/01ABC/3x.webp');
p.sevenTV({emotes:[{name:'ActiveFlagOnly',flags:256,data:{id:'01XYZ',flags:0,host:{url:'//cdn.7tv.app/emote/01XYZ',files:[{name:'1x.webp',width:32,height:32}]}}}]},map);
assert.equal(map.get('ActiveFlagOnly').zeroWidth,false);
p.ffz({sets:{1:{emoticons:[{id:9,name:'unsafe',urls:{1:'javascript:alert(1)'}}]}}},map,false);
assert.equal(map.has('unsafe'),false);
const badges = new Map();
p.twitchBadges([{set_id:'moderator',versions:[{id:'1',image_url_4x:'https://static-cdn.jtvnw.net/badges/v1/test/3'}]}],badges);
assert.equal(badges.get('moderator/1'),'https://static-cdn.jtvnw.net/badges/v1/test/3');
async function cacheChecks() {
  const urlRoot = 'https://api.betterttv.net/3/cached/users/twitch/';
  let outage = false;
  context.fetch = async url => {
    if (url === urlRoot + '1' && outage) throw new Error('Simulated provider outage');
    let data = [];
    if (url.includes('/room/first')) data = {room: {twitch_id: 1}, sets: {}};
    else if (url.includes('/room/second')) data = {room: {twitch_id: 2}, sets: {}};
    else if (url === urlRoot + '1') data = {channelEmotes: [{id:'abc',code:'FirstOnly'}],sharedEmotes:[]};
    else if (url === urlRoot + '2') data = {channelEmotes: [{id:'def',code:'SecondOnly'}],sharedEmotes:[]};
    return {ok:true,json:async () => data};
  };
  const first = await context.OverlayProviders.load('first');
  assert.equal(first.emotes.has('FirstOnly'), true);
  outage = true;
  const refresh = await context.OverlayProviders.load('first');
  assert.equal(refresh.emotes.has('FirstOnly'), true, 'provider outage retains the previous catalog');
  assert.equal(refresh.failures.includes('BTTV channel emotes'), true);
  const second = await context.OverlayProviders.load('second');
  assert.equal(second.emotes.has('SecondOnly'), true);
  assert.equal(second.emotes.has('FirstOnly'), false, 'cached channel emotes never leak into another channel');
  assert.equal(timers.size, 0);
}
cacheChecks().then(() => console.log('Transport and provider checks passed: IRC parsing, Unicode, /me, read-only handshake, fragmented frames, deduplication, moderation events, cleanup, provider schemas, FFZ metadata, 7TV flags, URL validation, outage cache retention, and channel isolation.')).catch(error => { console.error(error); process.exitCode = 1; });
