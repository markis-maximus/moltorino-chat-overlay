'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({URL});
for (const file of ['modifiers.js', 'providers.js', 'renderer.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
}
const renderer = context.OverlayRenderer;
const modifiers = context.OverlayModifiers;
const normal = {id:'normal',name:'heyy',provider:'7tv',url:'https://example.test/heyy.webp',width:32,height:32};
const layer = {id:'rain',name:'RainTime',provider:'7tv',url:'https://example.test/rain.webp',width:32,height:32,zeroWidth:true};
const catalog = new Map([['heyy',normal],['RainTime',layer]]);
const parse = (text, extra = catalog) => renderer.parse({text,emotes:[]},extra);
const simplify = value => JSON.parse(JSON.stringify(value));

test('wide modifier attaches to preceding emote and consumes its separating space', () => {
  const parts = parse('before heyy ffzW after');
  assert.equal(parts.filter(p=>p.type==='emote').length,1);
  assert.equal(parts.find(p=>p.type==='emote').flags,9);
  assert.equal(parts.filter(p=>p.type==='text').map(p=>p.text).join(''),'before  after');
});

test('7TV layers and multiple FFZ suffixes form one composed emote', () => {
  const [part] = parse('heyy RainTime ffzW ffzRainbow ffzBounce');
  assert.equal(part.base.name,'heyy');
  assert.equal(part.overlays.length,1);
  assert.equal(part.overlays[0].name,'RainTime');
  assert.equal(part.flags,9|2049|65537);
  assert.deepEqual(simplify(part.modifiers),['RainTime','ffzW','ffzRainbow','ffzBounce']);
});

test('layers after an FFZ suffix stay attached to the same visual', () => {
  const parts=parse('heyy ffzW RainTime');
  assert.equal(parts.length,1);
  assert.equal(parts[0].overlays.length,1);
  assert.equal(parts[0].flags,9);
});

test('plain text breaks the modifier chain', () => {
  const parts=parse('heyy hello ffzW');
  assert.equal(parts[0].flags,0);
  assert.equal(parts.filter(p=>p.type==='text').map(p=>p.text).join(''),' hello ffzW');
});

test('orphan and unknown modifier words remain readable text', () => {
  assert.equal(parse('ffzW')[0].text,'ffzW');
  const parts=parse('heyy ffzFuture');
  assert.equal(parts[0].flags,0);
  assert.equal(parts.slice(1).map(p=>p.text).join(''),' ffzFuture');
});

test('native Twitch offsets after a non-BMP emoji use Unicode code points', () => {
  const parts=renderer.parse({text:'😀 Kappa ffzW',emotes:[{id:'25',start:2,end:6}]},new Map());
  const image=parts.find(p=>p.type==='emote');
  assert.equal(image.base.name,'Kappa');
  assert.equal(image.base.url,'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0');
  assert.equal(image.flags,9);
  assert.equal(parts[0].text,'😀');
});

test('invalid and overlapping Twitch ranges cannot duplicate or drop text', () => {
  const pieces=renderer.pieces({text:'abc Kappa xyz',emotes:[{id:'25',start:4,end:8},{id:'25',start:5,end:8},{id:'26',start:-1,end:3},{id:'27',start:9,end:999}]});
  assert.equal(pieces.map(p=>p.text).join(''),'abc Kappa xyz');
  assert.equal(pieces.filter(p=>p.emote).length,1);
});

test('future aliases use known FFZ metadata flags through provider parsing', () => {
  const map=new Map(catalog);
  context.OverlayProviders.parsers.ffz({sets:{1:{emoticons:[{id:123,name:'brandNewWide',width:1,height:1,urls:{1:'https://cdn.test/a.png'},modifier:true,modifier_flags:9}]}}},map,false);
  const parts=parse('heyy brandNewWide',map);
  assert.equal(parts.length,1);
  assert.equal(parts[0].flags,9);
  assert.equal(parts[0].overlays.length,0);
});

test('known metadata-based prefix modifiers attach to following emote', () => {
  const map=new Map(catalog);
  map.set('prefixWide',{id:'p',name:'prefixWide',url:'https://cdn.test/a.png',modifier:true,modifier_flags:9,modifier_prefix:true});
  const parts=parse('prefixWide heyy',map);
  assert.equal(parts.filter(p=>p.type==='emote').length,1);
  assert.equal(parts.find(p=>p.type==='emote').flags,9);
});

test('unknown effect flags are explicitly reported by metadata resolution', () => {
  const descriptor=modifiers.resolve('future',{modifier:true,modifierFlags:1|262144});
  assert.equal(descriptor.unsupportedFlags,262144);
});

test('unknown effect flags keep the modifier token visible in chat', () => {
  const map=new Map(catalog);map.set('future',{name:'future',url:'https://cdn.test/future.png',modifier:true,modifierFlags:262145});
  const parts=parse('heyy future',map);
  assert.equal(parts[0].flags,0);
  assert.equal(parts.slice(1).map(p=>p.text).join(''),' future');
});

test('FFZ effect bit assignments retain current effect names', () => {
  for(const [name,flags] of [['ffzW',9],['ffzX',3],['ffzY',5],['ffzSpin',129],['ffzJam',32769],['ffzBounce',65537],['ffzRainbow',2049],['ffzHyper',12289],['ffzCursed',16385],['ffzSlide',17],['ffzLeave',65],['ffzArrive',33]]) {
    assert.equal(modifiers.resolve(name).flags,flags,name);
  }
});

test('provider URL parser rejects executable and insecure asset URLs', () => {
  const map=new Map();
  context.OverlayProviders.parsers.ffz({sets:{1:{emoticons:[
    {id:1,name:'badJs',urls:{1:'javascript:alert(1)'}},
    {id:2,name:'badHttp',urls:{1:'http://example.test/pixel'}},
    {id:3,name:'safe',urls:{1:'//cdn.test/safe.png'}}
  ]}}},map,false);
  assert.equal(map.has('badJs'),false);
  assert.equal(map.has('badHttp'),false);
  assert.equal(map.get('safe').url,'https://cdn.test/safe.png');
});

test('7TV zero-width flag belongs to emote data rather than active alias', () => {
  const map=new Map();
  const make=(name,activeFlags,dataFlags)=>({id:name,name,flags:activeFlags,data:{id:name,flags:dataFlags,host:{url:'//cdn.test/'+name,files:[{name:'3x.webp',format:'WEBP',width:96,height:96}]}}});
  context.OverlayProviders.parsers.sevenTV({emotes:[make('zero',0,256),make('normal',256,0)]},map);
  assert.equal(map.get('zero').zeroWidth,true);
  assert.equal(map.get('normal').zeroWidth,false);
});
