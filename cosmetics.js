/* Public cosmetic data only: no login, credentials, presence announcements or remote code. */
(function(root){
 'use strict';
 const DEFAULT_ORDER=['ta','ts','tv','tp','c','ff','fa','bt','bl','m','7','hc','hs'];
 const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
 const key=value=>typeof value==='string'?value.trim().toLowerCase():'';
 const array=value=>Array.isArray(value)?value:[];
 const text=value=>typeof value==='string'?value.trim():'';
 const userId=value=>/^\d{1,32}$/.test(text(value))?text(value):'';
 const firstUrl=(...values)=>values.map(value=>url(text(value))).find(Boolean)||'';
 const validId=x=>typeof x==='string'&&/^(?:[0-9a-f]{24}|[0-9A-HJKMNP-TV-Z]{26})$/i.test(x);
 const url=x=>{try{const u=new URL(String(x).replace(/^\/\//,'https://'));return u.protocol==='https:'?u.href:'';}catch{return '';}};
 const number=(x,min,max,fallback=0)=>Number.isFinite(Number(x))?Math.min(max,Math.max(min,Number(x))):fallback;
 const paintRevisions=new WeakMap();
 function color(x){if(!Number.isInteger(x))return '';const v=x>>>0;return `rgba(${v>>>24},${v>>>16&255},${v>>>8&255},${(v&255)/255})`;}
 function paintStyle(p,fallbackColor='#ffffff',size={}){
  if(!p||typeof p!=='object')return null;
  const type=String(p.function||'').toUpperCase().replace(/-/g,'_');let background='';
  const base=/^#[\da-f]{6}$/i.test(fallbackColor)?fallbackColor:'#ffffff';
  const rgb=[1,3,5].map(index=>parseInt(base.slice(index,index+2),16));
  const composite=value=>{const v=value>>>0,a=(v&255)/255;return `rgba(${[v>>>24,v>>>16&255,v>>>8&255].map((n,i)=>Math.floor(rgb[i]*(1-a)+n*a)).join(',')},1)`;};
  let previous=-1;
  const stops=array(p.stops).filter(s=>s&&Number.isFinite(s.at)&&Number.isInteger(s.color)).map(s=>{const at=s.at<=previous?previous+0.0000001:s.at;previous=at;return {at,color:composite(s.color)};});
  const repeat=p.repeat===true,start=stops[0]?.at,end=stops.at(-1)?.at;
  const cssStops=stops.map(s=>`${s.color} ${s.at*100}%`);
  let fallback=base;
  if(['LINEAR_GRADIENT','RADIAL_GRADIENT'].includes(type)&&stops.length===1)fallback=stops[0].color;
  if(type==='LINEAR_GRADIENT'&&stops.length>=2)background=`${repeat?'repeating-':''}linear-gradient(${((Number.isFinite(p.angle)?p.angle:0)%360+360)%360}deg,${cssStops.join(',')})`;
  else if(type==='RADIAL_GRADIENT'&&stops.length>=2){
   const radius=Math.max(Number(size.width)||0,Number(size.height)||0)/2*(repeat?end:1);
   const radialStops=repeat?stops.map(s=>`${s.color} ${(s.at-start)/(end-start)*100}%`):cssStops;
   background=`${repeat?'repeating-':''}radial-gradient(circle${radius>0?' '+radius+'px':''} at center,${radialStops.join(',')})`;
  }
  else if(type==='URL'&&url(p.image_url))background=`url("${url(p.image_url).replace(/["\\\n\r]/g,c=>encodeURIComponent(c))}")`;
  if(!['LINEAR_GRADIENT','RADIAL_GRADIENT'].includes(type)&&!(type==='URL'&&background))return null;
  // Native defaults enable large paint shadows (3x radius). Browser blur kernels
  // still differ from Qt; this preserves the published values and native setting.
  const shadows=array(p.shadows).filter(s=>s&&Number.isInteger(s.color)&&Number.isFinite(s.radius)&&s.radius>0).map(s=>`drop-shadow(${Number.isFinite(s.x_offset)?s.x_offset:0}px ${Number.isFinite(s.y_offset)?s.y_offset:0}px ${s.radius*3}px ${color(s.color)})`).join(' ');
  return {background,color:fallback,filter:shadows,backgroundSize:'100% 100%'};
 }
 function applyPaint(element,paint,fallbackColor){
  const revision={};paintRevisions.set(element,revision);
  element.removeAttribute('style');element.removeAttribute('data-paint');
  const css=paintStyle(paint,fallbackColor,element.getBoundingClientRect());if(!css)return false;
  element.dataset.paint=String(paint.id||'');
  element.style.textShadow='none';element.style.webkitTextStroke='0 transparent';
  if(css.color)element.style.color=css.color;
  if(css.background){Object.assign(element.style,{backgroundImage:css.background,backgroundColor:css.color,backgroundSize:css.backgroundSize,backgroundRepeat:'no-repeat',backgroundClip:'text',webkitBackgroundClip:'text',webkitTextFillColor:'transparent',textShadow:'none',webkitTextStroke:'0 transparent'});}
  if(css.filter)element.style.filter=css.filter;
  // Rows are initially decorated before insertion. Resolve radial geometry once
  // the real font and name width are available, without keeping observers alive.
  if(paint&&String(paint.function).toUpperCase().replace(/-/g,'_')==='RADIAL_GRADIENT'&&!element.isConnected&&root.requestAnimationFrame){
   root.requestAnimationFrame(()=>{if(element.isConnected&&paintRevisions.get(element)===revision)applyPaint(element,paint,fallbackColor);});
  }
  return true;
 }
 function badgeFrom7(data){
  const host=data?.host,files=host?.files||[];
  const file=files.find(f=>f.name==='3x.webp')||files.find(f=>f.name==='2x.webp')||files.find(f=>f.format==='WEBP')||files[0];
  const src=host&&url(host.url);if(!src)return null;
  return {id:String(data.id),source:'7',url:src.replace(/\/$/,'')+'/'+(file?encodeURIComponent(file.name):'3x'),title:data.tooltip||data.name||'7TV Badge'};
 }
 // Native rule provenance and comparison cases: research/moltorino-semantics.md.
 // "tv" is Twitch's selected/vanity badge group; VIP is a role in "ta".
 function twitchCategory(set){
  set=key(set);
  if(['staff','admin','global_mod','lead_moderator','moderator','vip','broadcaster'].includes(set))return 'ta';
  if(['subscriber','founder'].includes(set))return 'ts';
  return set==='predictions'?'tp':'tv';
 }
 function vanityKeys(value){
  const keys=[];
  for(const item of array(value)){
   const normalized=key(item);
   if((DEFAULT_ORDER.includes(normalized)||/^t:[a-z0-9_-]{1,48}$/.test(normalized))&&!keys.includes(normalized))keys.push(normalized);
   if(keys.length===64)break;
  }
  return keys;
 }
 const badgeSlot=value=>value.startsWith('t:')?twitchCategory(value.slice(2)):value;
 function normalizeLayout(preferences={},defaultOrder=DEFAULT_ORDER){
  if(!['order','hidden','activeBadge'].some(field=>own(preferences,field)))return null;
  const requested=vanityKeys(own(preferences,'order')?preferences.order:defaultOrder);
  const slots=requested.map(badgeSlot),twitch=['ta','ts','tv','tp'];
  // Legacy per-badge layouts migrate to grouped Twitch slots at the front.
  const leading=requested.some(value=>value.startsWith('t:'))?
   [...twitch.filter(slot=>slots.includes(slot)),...slots.filter(slot=>!twitch.includes(slot))]:slots;
  const order=[...new Set([...leading,...DEFAULT_ORDER.filter(slot=>slot!=='fa'&&slot!=='bl')])];
  if(!order.includes('fa'))order.splice(order.indexOf('ff')+1,0,'fa');
  if(!order.includes('bl'))order.splice(order.indexOf('m'),0,'bl');
  return {order,hidden:[...new Set(vanityKeys(preferences.hidden).map(badgeSlot))]};
 }
 function selectedMoltorinoBadge(registry,preferences){
  const definitions=new Map();
  for(const badge of array(registry.badges)){
   const id=key(badge?.id);if(!id||id.length>128)continue;
   const image1=firstUrl(badge.images?.['1x'],badge.image1);if(!image1)continue;
   const src=firstUrl(badge.images?.['3x'],badge.image3,badge.images?.['2x'],badge.image2)||image1;
   if(src)definitions.set(id,{id:'moltorino:'+id,source:'m',title:typeof badge.tooltip==='string'&&badge.tooltip.trim()||id,url:src});
  }
  const assigned=[...new Set(array(preferences.badges).map(key))].filter(id=>definitions.has(id));
  const preferred=key(preferences.activeBadge);
  if(own(preferences,'activeBadge')&&!preferred)return null;
  // The client ignores numeric priority and catalog listing when displaying assignments.
  return definitions.get(assigned.includes(preferred)?preferred:assigned[0])||null;
 }
 function prepareRegistry(data){
  const badges=array(data.badges).length?data.badges:array(data.categories),users=Object.create(null),valid=new Set();
  const get=id=>users[id]||(users[id]={badges:[]});
  const assign=(id,badge,policy)=>{if(!id)return;const u=get(id);if(!u.badges.includes(badge))u.badges.push(badge);if(policy?.decorations===false)u.decorations=false;};
  for(const badge of badges){
   const id=key(badge?.id);if(!id||id.length>128||!firstUrl(badge.images?.['1x'],badge.image1))continue;valid.add(id);
   if(Array.isArray(badge.users))for(const item of badge.users)assign(userId(item?.id)||userId(item?.userId),id,item);
   else if(badge.users&&typeof badge.users==='object')for(const [raw,policy] of Object.entries(badge.users))assign(userId(raw),id,policy);
  }
  for(const [raw,p] of Object.entries(data.users||{})){
   const id=userId(raw);if(!id||!p||typeof p!=='object'||Array.isArray(p))continue;
   const u=get(id),assigned=u.badges,disabled=u.decorations===false;Object.assign(u,p);u.badges=assigned;
   for(const badge of array(p.badges).map(key))if(valid.has(badge)&&!assigned.includes(badge))assigned.push(badge);
   if(disabled)u.decorations=false;
  }
  return {...data,badges,users};
 }
 function registryMetadataValid(data){return data?.schemaVersion===2&&text(data.generation).length>0&&text(data.generation).length<=128&&Number.isInteger(data.bundleVersion)&&data.bundleVersion>=0&&(Array.isArray(data.badges)||Array.isArray(data.categories))&&(!own(data,'users')||(data.users&&typeof data.users==='object'&&!Array.isArray(data.users)));}
 function homiesBadges(data){
  const entries=Array.isArray(data)?data:data?.badges;
  if(!Array.isArray(entries))throw new Error('Invalid Homies badge registry');
  const result=new Map();
  for(const item of entries){
   const id=userId(item?.userId),image1=firstUrl(item?.image1),src=firstUrl(item?.image3,item?.image2)||image1;
   if(!id||!image1)continue;
   result.set(id,[{id:'homies:'+String(item.badgeId||src),source:'hc',title:item.tooltip||'Chatterino Homies',url:src}]);
  }
  return result;
 }
 function categoryBadges(data,source){
  const entries=Array.isArray(data)?data:data?.badges;
  if(!Array.isArray(entries))throw Error('Invalid badge list');
  const result=new Map();
  for(const item of entries){
   const primary=firstUrl(item?.image1);if(!primary)continue;
   const badge={id:source+':'+(text(item.id)||primary),source:source.startsWith('hs')?'hs':source,title:text(item.tooltip)||'Badge',url:firstUrl(item.image3,item.image2)||primary};
   for(const raw of array(item.users)){const id=userId(raw);if(id)result.set(id,[badge]);}
  }
  return result;
 }
 function ffzapBadges(data){
  if(!Array.isArray(data)||data.length>5000)throw Error('Invalid FFZ:AP list');
  const result=new Map(),helpers=['11819690','36442149','29519423','22025290','4867723'];
  for(const entry of data){
   const id=userId(entry?.id);if(!id||id.length>20)continue;
   const colored=entry.badge_is_colored===true||(typeof entry.badge_is_colored==='number'&&Math.trunc(entry.badge_is_colored)!==0)||['1','true'].includes(key(entry.badge_is_colored));
   result.set(id,[{id:'ffzap:'+id,source:'fa',title:id==='26964566'?'FFZ:AP Developer':helpers.includes(id)?'FFZ:AP Helper':'FFZ:AP Supporter',url:'https://api.ffzap.com/v1/user/badge/'+id+'/3',color:colored?text(entry.badge_color):''}]);
  }
  if(!result.size)throw Error('Empty FFZ:AP list');return result;
 }
 function bluzyrinoBadges(data){
  if(data?.version!==1||!Array.isArray(data.catalog)||!Array.isArray(data.badges)||data.catalog.length>128||data.badges.length>data.catalog.length)throw Error('Invalid Bluzyrino registry');
  const definitions=new Map(),result=new Map(),assigned=new Set(),counts=new Map();let total=0;
  const validUrl=value=>{try{const u=new URL(value);return value.length<=2048&&u.protocol==='https:'&&u.hostname==='bluzyrino-badge-registry.blu901-55.workers.dev'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname.startsWith('/badges/');}catch{return false;}};
  data.catalog.forEach((b,index)=>{if(typeof b?.id!=='string'||!b.id||b.id.length>64||typeof b.tooltip!=='string'||!b.tooltip||b.tooltip.length>256||definitions.has(b.id)||![b.image_url_1x,b.image_url_2x,b.image_url_4x].every(v=>typeof v==='string'&&validUrl(v)))throw Error('Invalid Bluzyrino definition');definitions.set(b.id,{index,badge:{id:'bluzyrino:'+b.id,source:'bl',title:b.tooltip,url:b.image_url_4x}});});
  for(const item of data.badges){
   const definition=definitions.get(item?.id);if(!definition||!Array.isArray(item.users)||assigned.has(item.id))throw Error('Invalid Bluzyrino assignment');assigned.add(item.id);
   const seen=new Set();for(const id of item.users){if(typeof id!=='string'||!/^[1-9]\d{0,19}$/.test(id)||++total>50000)throw Error('Invalid Bluzyrino user');if(seen.has(id))continue;seen.add(id);counts.set(id,(counts.get(id)||0)+1);if(counts.get(id)>16)throw Error('Too many Bluzyrino badges');const previous=result.get(id);if(!previous||definition.index<previous.index)result.set(id,definition);}
  }
  return new Map([...result].map(([id,item])=>[id,[item.badge]]));
 }
 function create({onUpdate=()=>{},onStatus=()=>{}}={}){
  let stopped=false,channelId='',socket=null,retryTimer=null,watchdog=null,retry=0;
  let registry={badges:[],users:{},layout:{defaultOrder:DEFAULT_ORDER}},ffz=[],homies=new Map();
  let refreshSequence=0;const applied=new Map();
  const extraBadges=new Map(),bttv=new Map();let bttvSocket=null,bttvRetry=null,bttvWatchdog=null,bttvAttempt=0;
  const rooms=new Map(),roomLookups=new Map(),roomQueue=[];let roomActive=0;
  const sharedIcon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#a970ff" d="M2 2h15v12H9l-4 4v-4H2z"/><path fill="#fff" d="M10 9h12v10h-3v3l-3-3h-6z"/></svg>');
  const users=new Map(),cosmetics=new Map(),pendingCosmetics=new Map(),lookup=new Map(),queue=[];
  let active=0;
  const notify=id=>{if(!stopped)onUpdate(id||null);};
  async function json(endpoint,options={}){
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
   try{const r=await fetch(endpoint,{...options,signal:c.signal,credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}
  }
  function ensureSharedRoom(raw){
   const id=userId(raw);if(stopped||!id||id===channelId)return Promise.resolve();
   const cached=roomLookups.get(id);if(cached&&Date.now()-cached.at<300000)return cached.promise;
   let resolve;const promise=new Promise(r=>resolve=r);roomLookups.set(id,{at:Date.now(),promise});
   if(roomLookups.size>128)roomLookups.delete(roomLookups.keys().next().value);
   if(roomQueue.length>=32){const old=roomQueue.shift();roomLookups.delete(old.id);old.resolve();}
   roomQueue.push({id,resolve});drainRooms();return promise;
  }
  function drainRooms(){
   while(!stopped&&roomActive<2&&roomQueue.length){
    const task=roomQueue.shift();roomActive++;
    json('https://api.ivr.fi/v2/twitch/user?id='+task.id).then(data=>{
     const row=array(data).find(u=>String(u.id)===task.id);if(stopped||!row)return;
     rooms.set(task.id,{name:text(row.displayName)||text(row.login)||task.id,url:firstUrl(row.logo)});if(rooms.size>128)rooms.delete(rooms.keys().next().value);notify();
    }).catch(()=>{}).finally(()=>{roomActive--;task.resolve();drainRooms();});
   }
  }
  function user(id){id=String(id);let u=users.get(id);if(!u){u={paint:null,badge:null,revision:{paint:0,badge:0}};users.set(id,u);if(users.size>2000)users.delete(users.keys().next().value);}return u;}
  function remember(kind,data){if(data&&validId(String(data.id))){cosmetics.set(String(data.id),{...data,kind});if(cosmetics.size>2500)cosmetics.delete(cosmetics.keys().next().value);}}
  async function hydrate(ids){
   ids=[...new Set(ids.filter(id=>validId(id)&&!cosmetics.has(id)))];if(!ids.length)return;
   const fresh=ids.filter(id=>!pendingCosmetics.has(id));
   if(fresh.length){
    const promise=json('https://7tv.io/v3/gql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query OverlayCosmetics($list: [Id!]!) { cosmetics(list: $list) { paints { id name color function repeat angle shape image_url stops { at color } shadows { x_offset y_offset radius color } } badges { id name tooltip host { url files { name width height format } } } } }',variables:{list:fresh.slice(0,50)}})})
     .then(data=>{if(stopped)return;for(const [kind,items] of [['PAINT',data.data?.cosmetics?.paints],['BADGE',data.data?.cosmetics?.badges]])for(const item of array(items))if(pendingCosmetics.get(String(item.id))===promise)remember(kind,item);notify();})
     .catch(()=>{}).finally(()=>{for(const id of fresh)if(pendingCosmetics.get(id)===promise)pendingCosmetics.delete(id);});
    for(const id of fresh)pendingCosmetics.set(id,promise);
   }
   await Promise.all(ids.map(id=>pendingCosmetics.get(id)));
  }
  async function loadUser(id){
   const u=user(id),revision={...u.revision};
   try{
    const data=await json('https://7tv.io/v3/users/twitch/'+encodeURIComponent(id));
    const style=data.user?.style||data.style||{};
    if(stopped)return;
    for(const field of ['paint','badge'])if(u.revision[field]===revision[field]){
     u[field]=style[field+'_id']||style[field==='paint'?'activePaintId':'activeBadgeId']||null;
     if(style[field]&&!cosmetics.has(String(style[field].id)))remember(field.toUpperCase(),style[field]);
    }
    await hydrate([u.paint,u.badge]);notify(id);
   }catch{/* A Twitch user need not have a 7TV account. */}
  }
  function drain(){while(!stopped&&active<3&&queue.length){const task=queue.shift();active++;loadUser(task.id).finally(()=>{active--;task.resolve();drain();});}}
  function ensureUser(id){
   id=String(id||'');if(stopped||!/^\d+$/.test(id))return Promise.resolve();
   const cached=lookup.get(id);if(cached&&Date.now()-cached.at<600000)return cached.promise;
   let resolve;const promise=new Promise(r=>resolve=r);lookup.set(id,{at:Date.now(),promise});
   if(lookup.size>2000)lookup.delete(lookup.keys().next().value);
   if(queue.length>=200){const old=queue.shift();lookup.delete(old.id);old.resolve();}
   queue.push({id,resolve});drain();return promise;
  }
  function ingest(type,body){
   if(stopped)return;
   const object=body?.object;if(!object)return;
   if(type.startsWith('cosmetic.')){
    const id=String(object.id||body.id||'');
    pendingCosmetics.delete(id);
    if(type==='cosmetic.delete')cosmetics.delete(id);
    else{let data=object.data;const previous=cosmetics.get(id);if(!data&&previous){data={...previous};for(const field of body.updated||[])if(['color','function','repeat','angle','shape','image_url','stops','shadows','host','name','tooltip'].includes(field.key))data[field.key]=field.value;}
     if(data)remember(object.kind||previous?.kind,{...data,id});}
    notify();return;
   }
   if(type.startsWith('entitlement.')){
    const account=object.user?.connections?.find(c=>c.platform==='TWITCH');
    const id=String(account?.id||'');if(!/^\d+$/.test(id))return;
    const key=object.kind==='PAINT'?'paint':object.kind==='BADGE'?'badge':null;if(!key)return;
    const u=user(id),ref=String(object.ref_id||'');u.revision[key]++;
    if(type==='entitlement.delete'){if(u[key]===ref)u[key]=null;}
    else if(validId(ref))u[key]=ref;
    hydrate([u[key]]);notify(id);
   }
  }
  function connect(id){
   if(stopped||!/^\d+$/.test(String(id))||channelId===String(id))return;
   channelId=String(id);if(socket){socket.onclose=null;socket.close();}clearTimeout(retryTimer);open();
   if(bttvSocket){bttvSocket.onclose=null;bttvSocket.close();}clearTimeout(bttvRetry);clearTimeout(bttvWatchdog);openBttv();
  }
  function ingestBttv(event){
   if(event?.name!=='lookup_user')return;
   const id=userId(event.data?.providerId),src=firstUrl(event.data?.badge?.url);if(!id||!src)return;
   bttv.set(id,[{id:'bttv:'+src,source:'bt',title:'BTTV Pro',url:src}]);
   if(bttv.size>5000)bttv.delete(bttv.keys().next().value);notify(id);
  }
  function openBttv(){
   if(stopped||!channelId)return;
   const schedule=()=>{if(!stopped)bttvRetry=setTimeout(openBttv,Math.min(30000,1000*2**Math.min(bttvAttempt++,5)));};
   let ws;try{ws=new WebSocket('wss://sockets.betterttv.net/ws');}catch{schedule();return;}bttvSocket=ws;
   const retire=()=>{if(stopped||ws!==bttvSocket)return;clearTimeout(bttvWatchdog);bttvSocket=null;ws.onclose=null;try{ws.close();}catch{}schedule();};
   bttvWatchdog=setTimeout(retire,20000);
   ws.onopen=()=>{
    if(stopped||ws!==bttvSocket)return;
    bttvAttempt=0;clearTimeout(bttvWatchdog);
    // BTTV has no documented application heartbeat. Renew the subscription
    // every fifteen minutes instead of inventing a ping or treating quiet chat
    // as a failure. Retain existing badge assignments across renewals.
    bttvWatchdog=setTimeout(retire,900000);
    ws.send(JSON.stringify({name:'join_channel',data:{name:'twitch:'+channelId}}));
   };
   ws.onmessage=e=>{if(ws!==bttvSocket||stopped)return;try{ingestBttv(JSON.parse(e.data));}catch{}};
   ws.onerror=retire;ws.onclose=retire;
  }
  function open(){
   if(stopped||!channelId)return;
   const schedule=()=>{if(!stopped)retryTimer=setTimeout(open,Math.min(30000,1000*2**Math.min(retry++,5)));};
   let ws;try{ws=new WebSocket('wss://events.7tv.io/v3');}catch{schedule();return;}socket=ws;
   const retire=()=>{if(stopped||socket!==ws)return;clearTimeout(watchdog);socket=null;ws.onclose=null;try{ws.close();}catch{}schedule();};
   const arm=ms=>{clearTimeout(watchdog);watchdog=setTimeout(retire,ms);};arm(20000);
   ws.onmessage=e=>{if(ws!==socket||stopped)return;try{
    const event=JSON.parse(e.data);
    if(event.op===1){retry=0;arm(Math.max(45000,Number(event.d?.heartbeat_interval||25000)*3));for(const type of ['entitlement.*','cosmetic.*'])ws.send(JSON.stringify({op:35,d:{type,condition:{platform:'TWITCH',ctx:'channel',id:channelId}}}));onStatus({state:'cosmetics',message:'7TV live paints and badges connected.'});}
    else if(event.op===2)arm(90000);
    else if(event.op===0)ingest(event.d?.type||'',event.d?.body);
    else if(event.op===4)retire();
   }catch{/* Ignore a malformed dispatch without disrupting chat. */}};
   ws.onerror=retire;ws.onclose=retire;
  }
  async function refresh(){
   const sequence=++refreshSequence;
   const accept=(provider,apply)=>{if(stopped||sequence<(applied.get(provider)||0))return;apply();applied.set(provider,sequence);};
   await Promise.all([
    json('https://api.moltorino.com/v2/badges').then(data=>{if(!registryMetadataValid(data))throw Error('Invalid registry');accept('m',()=>{if(text(data.generation)===text(registry.generation)&&data.bundleVersion<registry.bundleVersion)return;registry=prepareRegistry(data);});}).catch(()=>onStatus({state:'warning',message:'Moltorino badges unavailable; keeping cached data.'})),
    json('https://api.frankerfacez.com/v1/badges/ids').then(data=>{if(!Array.isArray(data.badges))throw Error('Invalid FFZ list');const parsed=data.badges.map(b=>({badge:{id:String(b.id),source:'ff',title:b.title||b.name,url:url(b.urls?.['4']||b.urls?.['2']||b.urls?.['1']||b.image),color:/^#[\da-f]{6}$/i.test(b.color||'')?b.color:''},users:new Set((data.users?.[b.id]||[]).map(String))})).sort((a,b)=>Number(a.badge.id)-Number(b.badge.id));accept('ff',()=>{ffz=parsed;});}).catch(()=>{}),
    json('https://chatterinohomies.com/api/badges/list').then(data=>{const parsed=homiesBadges(data);accept('hc',()=>{homies=parsed;});}).catch(()=>onStatus({state:'warning',message:'Chatterino Homies badges unavailable; keeping cached data.'})),
    ...[
     ['c','https://api.chatterino.com/badges',data=>categoryBadges(data,'c')],
     ['fa','https://api.ffzap.com/v1/supporters',ffzapBadges],
     ['bl','https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges',bluzyrinoBadges],
     ['hs1','https://itzalex.github.io/badges',data=>categoryBadges(data,'hs1')],
     ['hs2','https://itzalex.github.io/badges2',data=>categoryBadges(data,'hs2')],
    ].map(([source,endpoint,parse])=>json(endpoint).then(data=>{const parsed=parse(data);accept(source,()=>extraBadges.set(source,parsed));}).catch(()=>onStatus({state:'warning',message:source+' badges unavailable; keeping cached data.'}))),
   ]);notify();
  }
  function profile(message,badgeMap=new Map()){
   const id=String(message.userId||''),u=users.get(id)||{},preferences=registry.users?.[id]||{};
   let badges=(message.badges||[]).map(b=>{const asset=badgeMap.get(`${b.set}/${b.version}`);return {id:'t:'+b.set,source:twitchCategory(b.set),set:b.set,version:b.version,title:b.set,...(b.set==='moderator'?{color:'#34ae0a'}:{}),...(typeof asset==='string'?{url:asset}:asset)};}).filter(b=>b.url);
   const sourceRoom=userId(message.sourceRoomId),isShared=sourceRoom&&sourceRoom!==(message.roomId||channelId),room=rooms.get(sourceRoom);
   if(isShared){
    const sourceBadges=[];
    for(const b of array(message.sourceBadges)){
     if(!['moderator','vip','lead_moderator'].includes(b.set))continue;
     const asset=(badgeMap.twitchDefaults||badgeMap).get(`${b.set}/${b.version}`);if(!asset)continue;
     sourceBadges.push({id:'t:'+b.set,source:'ta',set:b.set,title:b.set+' ('+(room?.name||sourceRoom)+')',...(typeof asset==='string'?{url:asset}:asset)});
     const duplicate=badges.findIndex(local=>local.set===b.set&&local.version===b.version);if(duplicate>=0)badges.splice(duplicate,1);
    }
    badges.unshift(...sourceBadges);
   }
   const append=source=>badges.push(...(extraBadges.get(source)?.get(id)||[]));append('c');
   // Native global FFZ badges are independent of Twitch roles. Channel-specific
   // FFZ mod/VIP images are already applied to Twitch assets by providers.js.
   for(const item of ffz)if(item.users.has(id)&&item.badge.url)badges.push(item.badge);
   append('fa');badges.push(...(bttv.get(id)||[]));append('bl');
   const mb=selectedMoltorinoBadge(registry,preferences);if(mb)badges.push(mb);
   const seven=cosmetics.get(u.badge);if(seven?.kind==='BADGE'){const badge=badgeFrom7(seven);if(badge)badges.push(badge);}
   // Anonymous overlay viewers have no signed-in native-client "self" exemption.
   // Decorations controls Homies custom badges only, independently of 7TV paints.
   if(preferences.decorations!==false)badges.push(...(homies.get(id)||[]));
   append('hs1');append('hs2');
   const layout=normalizeLayout(preferences,registry.layout?.defaultOrder);
   if(layout)badges=badges.filter(b=>!layout.hidden.includes(b.source)).sort((a,b)=>layout.order.indexOf(a.source)-layout.order.indexOf(b.source));
   if(isShared)badges.unshift({id:'shared:'+sourceRoom,source:'shared',title:'Shared Message from '+(room?.name||sourceRoom),url:room?.url||sharedIcon});
   const paint=cosmetics.get(u.paint);
   return {badges,paint:paint?.kind==='PAINT'?paint:null};
  }
  function close(){stopped=true;clearTimeout(retryTimer);clearTimeout(watchdog);clearTimeout(bttvRetry);clearTimeout(bttvWatchdog);if(socket){socket.onclose=null;socket.close();}if(bttvSocket){bttvSocket.onclose=null;bttvSocket.close();}for(const task of [...queue.splice(0),...roomQueue.splice(0)])task.resolve();}
  return {connect,refresh,ensureUser,ensureSharedRoom,profile,close,ingest,ingestBttv,remember,
   // Data ingestion is separately exposed for deterministic replay of public payloads.
   setRegistry:data=>{registry=prepareRegistry(data);notify();},stats:()=>({users:users.size,cosmetics:cosmetics.size,moltorinoUsers:Object.keys(registry.users||{}).length,connected:socket?.readyState===1})};
 }
 root.OverlayCosmetics={create,paintStyle,applyPaint,badgeFrom7,color,homiesBadges,normalizeLayout,parsers:{categoryBadges,ffzapBadges,bluzyrinoBadges,prepareRegistry}};
})(typeof window==='object'?window:globalThis);
