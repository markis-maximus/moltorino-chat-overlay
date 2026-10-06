/* Public cosmetic data only: no login, credentials, presence announcements or remote code. */
(function(root){
 'use strict';
 const DEFAULT_ORDER=['ta','ts','tv','tp','c','ff','fa','bt','bl','m','7','hc','hs'];
 const validId=x=>typeof x==='string'&&/^(?:[0-9a-f]{24}|[0-9A-HJKMNP-TV-Z]{26})$/i.test(x);
 const url=x=>{try{const u=new URL(String(x).replace(/^\/\//,'https://'));return u.protocol==='https:'?u.href:'';}catch{return '';}};
 const number=(x,min,max,fallback=0)=>Number.isFinite(Number(x))?Math.min(max,Math.max(min,Number(x))):fallback;
 function color(x){if(!Number.isInteger(x))return '';const v=x>>>0;return `rgba(${v>>>24},${v>>>16&255},${v>>>8&255},${(v&255)/255})`;}
 function paintStyle(p){
  if(!p||typeof p!=='object')return null;
  const type=String(p.function||'').toUpperCase().replace(/-/g,'_');let background='';
  const stops=(p.stops||[]).slice(0,32).filter(s=>Number.isFinite(s.at)&&Number.isInteger(s.color)).map(s=>`${color(s.color)} ${number(s.at,0,1)*100}%`);
  if(type==='LINEAR_GRADIENT'&&stops.length>=2)background=`${p.repeat?'repeating-':''}linear-gradient(${number(p.angle,-3600,3600)}deg,${stops.join(',')})`;
  else if(type==='RADIAL_GRADIENT'&&stops.length>=2)background=`${p.repeat?'repeating-':''}radial-gradient(${p.shape==='ellipse'?'ellipse':'circle'},${stops.join(',')})`;
  else if(type==='URL'&&url(p.image_url))background=`url("${url(p.image_url).replace(/["\\\n\r]/g,c=>encodeURIComponent(c))}")`;
  const fallback=color(p.color);if(!background&&!fallback)return null;
  const shadows=(p.shadows||(p.drop_shadow?[p.drop_shadow]:[])).slice(0,6).filter(s=>Number.isInteger(s.color)).map(s=>`drop-shadow(${number(s.x_offset,-20,20)}px ${number(s.y_offset,-20,20)}px ${number(s.radius,0,20)}px ${color(s.color)})`).join(' ');
  return {background,color:fallback,filter:shadows};
 }
 function applyPaint(element,paint,fallbackColor){
  element.removeAttribute('style');element.removeAttribute('data-paint');
  const css=paintStyle(paint);if(!css)return false;
  element.dataset.paint=String(paint.id||'');
  if(css.color)element.style.color=css.color;
  if(css.background){Object.assign(element.style,{backgroundImage:css.background,backgroundColor:css.color||fallbackColor||'#fff',backgroundSize:'cover',backgroundClip:'text',webkitBackgroundClip:'text',webkitTextFillColor:'transparent',textShadow:'none',webkitTextStroke:'0 transparent'});}
  if(css.filter)element.style.filter=css.filter;
  return true;
 }
 function badgeFrom7(data){
  const host=data?.host,files=host?.files||[];
  const file=files.find(f=>f.name==='3x.webp')||files.find(f=>f.name==='2x.webp')||files.find(f=>f.format==='WEBP')||files[0];
  const src=host&&url(host.url);if(!src)return null;
  return {id:String(data.id),source:'7',url:src.replace(/\/$/,'')+'/'+(file?encodeURIComponent(file.name):'3x'),title:data.tooltip||data.name||'7TV Badge'};
 }
 function twitchCategory(set){if(['subscriber','founder'].includes(set))return 'ts';if(set==='vip')return 'tv';if(set.startsWith('predictions'))return 'tp';return 'ta';}
 function homiesBadges(data){
  if(!Array.isArray(data?.badges))throw new Error('Invalid Homies badge registry');
  const result=new Map();
  for(const item of data.badges){
   const id=String(item.userId||''),src=url(item.image3||item.image2||item.image1);
   if(!/^\d+$/.test(id)||!src)continue;
   const badges=result.get(id)||[];
   badges.push({id:'homies:'+String(item.badgeId||src),source:'hc',title:item.tooltip||'Chatterino Homies',url:src});result.set(id,badges);
  }
  return result;
 }
 function create({onUpdate=()=>{},onStatus=()=>{}}={}){
  let stopped=false,channelId='',socket=null,retryTimer=null,watchdog=null,retry=0;
  let registry={badges:[],users:{},layout:{defaultOrder:DEFAULT_ORDER}},ffz=[],homies=new Map();
  const users=new Map(),cosmetics=new Map(),pendingCosmetics=new Map(),lookup=new Map(),queue=[];
  let active=0;
  const notify=id=>{if(!stopped)onUpdate(id||null);};
  async function json(endpoint,options={}){
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
   try{const r=await fetch(endpoint,{...options,signal:c.signal,credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}
  }
  function user(id){id=String(id);let u=users.get(id);if(!u){u={paint:null,badge:null,revision:0};users.set(id,u);if(users.size>2000)users.delete(users.keys().next().value);}return u;}
  function remember(kind,data){if(data&&validId(String(data.id))){cosmetics.set(String(data.id),{...data,kind});if(cosmetics.size>2500)cosmetics.delete(cosmetics.keys().next().value);}}
  async function hydrate(ids){
   ids=[...new Set(ids.filter(id=>validId(id)&&!cosmetics.has(id)))];if(!ids.length)return;
   const fresh=ids.filter(id=>!pendingCosmetics.has(id));
   if(fresh.length){
    const promise=json('https://7tv.io/v3/gql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query OverlayCosmetics($list: [Id!]!) { cosmetics(list: $list) { paints { id name color function repeat angle shape image_url stops { at color } shadows { x_offset y_offset radius color } } badges { id name tooltip host { url files { name width height format } } } } }',variables:{list:fresh.slice(0,50)}})})
     .then(data=>{for(const p of data.data?.cosmetics?.paints||[])remember('PAINT',p);for(const b of data.data?.cosmetics?.badges||[])remember('BADGE',b);notify();})
     .catch(()=>{}).finally(()=>{for(const id of fresh)pendingCosmetics.delete(id);});
    for(const id of fresh)pendingCosmetics.set(id,promise);
   }
   await Promise.all(ids.map(id=>pendingCosmetics.get(id)));
  }
  async function loadUser(id){
   const u=user(id),revision=u.revision;
   try{
    const data=await json('https://7tv.io/v3/users/twitch/'+encodeURIComponent(id));
    const style=data.user?.style||data.style||{};
    if(u.revision===revision){u.paint=style.paint_id||style.activePaintId||null;u.badge=style.badge_id||style.activeBadgeId||null;}
    if(style.paint)remember('PAINT',style.paint);if(style.badge)remember('BADGE',style.badge);
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
   const object=body?.object;if(!object)return;
   if(type.startsWith('cosmetic.')){
    const id=String(object.id||body.id||'');
    if(type==='cosmetic.delete')cosmetics.delete(id);
    else{let data=object.data;const previous=cosmetics.get(id);if(!data&&previous){data={...previous};for(const field of body.updated||[])if(['color','function','repeat','angle','shape','image_url','stops','shadows','host','name','tooltip'].includes(field.key))data[field.key]=field.value;}
     if(data)remember(object.kind||previous?.kind,{...data,id});}
    notify();return;
   }
   if(type.startsWith('entitlement.')){
    const account=object.user?.connections?.find(c=>c.platform==='TWITCH');
    const id=String(account?.id||'');if(!/^\d+$/.test(id))return;
    const key=object.kind==='PAINT'?'paint':object.kind==='BADGE'?'badge':null;if(!key)return;
    const u=user(id),ref=String(object.ref_id||'');u.revision++;
    if(type==='entitlement.delete'){if(u[key]===ref)u[key]=null;}
    else if(validId(ref))u[key]=ref;
    hydrate([u[key]]);notify(id);
   }
  }
  function connect(id){
   if(stopped||!/^\d+$/.test(String(id))||channelId===String(id))return;
   channelId=String(id);if(socket){socket.onclose=null;socket.close();}clearTimeout(retryTimer);open();
  }
  function open(){
   if(stopped||!channelId)return;
   const ws=new WebSocket('wss://events.7tv.io/v3');socket=ws;
   const arm=ms=>{clearTimeout(watchdog);watchdog=setTimeout(()=>ws.close(),ms);};arm(20000);
   ws.onmessage=e=>{try{
    const event=JSON.parse(e.data);
    if(event.op===1){retry=0;arm(Math.max(45000,Number(event.d?.heartbeat_interval||25000)*3));for(const type of ['entitlement.*','cosmetic.*'])ws.send(JSON.stringify({op:35,d:{type,condition:{platform:'TWITCH',ctx:'channel',id:channelId}}}));onStatus({state:'cosmetics',message:'7TV live paints and badges connected.'});}
    else if(event.op===2)arm(90000);
    else if(event.op===0)ingest(event.d?.type||'',event.d?.body);
    else if(event.op===4)ws.close();
   }catch{/* Ignore a malformed dispatch without disrupting chat. */}};
   ws.onerror=()=>ws.close();
   ws.onclose=()=>{clearTimeout(watchdog);if(stopped||socket!==ws)return;retryTimer=setTimeout(open,Math.min(30000,1000*2**Math.min(retry++,5)));};
  }
  async function refresh(){
   await Promise.all([
    json('https://api.moltorino.com/v2/badges').then(data=>{if(data.schemaVersion===2&&Array.isArray(data.badges)&&data.users&&typeof data.users==='object')registry=data;}).catch(()=>onStatus({state:'warning',message:'Moltorino badges unavailable; keeping cached data.'})),
    json('https://api.frankerfacez.com/v1/badges/ids').then(data=>{if(Array.isArray(data.badges))ffz=data.badges.map(b=>({badge:{id:String(b.id),source:'ff',title:b.title||b.name,url:url(b.urls?.['4']||b.urls?.['2']||b.image),replaces:b.replaces,color:/^#[\da-f]{6}$/i.test(b.color||'')?b.color:''},users:new Set((data.users?.[b.id]||[]).map(String))}));}).catch(()=>{}),
    json('https://chatterinohomies.com/api/badges/list').then(data=>{homies=homiesBadges(data);}).catch(()=>onStatus({state:'warning',message:'Chatterino Homies badges unavailable; keeping cached data.'})),
   ]);notify();
  }
  function profile(message,badgeMap=new Map()){
   const id=String(message.userId||''),u=users.get(id)||{},preferences=registry.users?.[id]||{};
   let badges=(message.badges||[]).map(b=>{const asset=badgeMap.get(`${b.set}/${b.version}`);return {id:'t:'+b.set,source:twitchCategory(b.set),set:b.set,title:b.set,...(b.set==='moderator'?{color:'#34ae0a'}:{}),...(typeof asset==='string'?{url:asset}:asset)};}).filter(b=>b.url);
   for(const item of ffz)if(item.users.has(id)&&item.badge.url){
    const replaced=badges.find(b=>b.set===item.badge.replaces);
    if(item.badge.replaces)badges=badges.filter(b=>b.set!==item.badge.replaces);
    // A bot icon replacing a moderator badge retains the visible moderator role.
    badges.push(replaced?.set==='moderator'?{...item.badge,source:replaced.source,color:replaced.color||'#34ae0a'}:item.badge);
   }
   badges.push(...(homies.get(id)||[]));
   const assigned=preferences.badges||[];
   const selected=Object.prototype.hasOwnProperty.call(preferences,'activeBadge')?preferences.activeBadge:assigned.slice().sort((a,b)=>(registry.badges.find(x=>x.id===b)?.priority||0)-(registry.badges.find(x=>x.id===a)?.priority||0))[0];
   const mb=assigned.includes(selected)?registry.badges.find(b=>b.id===selected):null;
   if(mb){const src=url(mb.images?.['3x']||mb.images?.['2x']||mb.images?.['1x']);if(src)badges.push({id:'moltorino:'+mb.id,source:'m',title:mb.tooltip||mb.id,url:src});}
   const seven=cosmetics.get(u.badge);if(seven?.kind==='BADGE'){const badge=badgeFrom7(seven);if(badge)badges.push(badge);}
   const hidden=new Set(preferences.hidden||[]),order=[...(preferences.order||registry.layout?.defaultOrder||DEFAULT_ORDER),...DEFAULT_ORDER];
   badges=badges.filter(b=>!hidden.has(b.source)&&!hidden.has(b.id)).sort((a,b)=>order.indexOf(a.source)-order.indexOf(b.source));
   const paint=cosmetics.get(u.paint);
   return {badges,paint:preferences.decorations===false?null:paint?.kind==='PAINT'?paint:null};
  }
  function close(){stopped=true;clearTimeout(retryTimer);clearTimeout(watchdog);if(socket){socket.onclose=null;socket.close();}for(const task of queue.splice(0))task.resolve();}
  return {connect,refresh,ensureUser,profile,close,ingest,remember,
   // Data ingestion is separately exposed for deterministic replay of public payloads.
   setRegistry:data=>{registry=data;notify();},stats:()=>({users:users.size,cosmetics:cosmetics.size,moltorinoUsers:Object.keys(registry.users||{}).length,connected:socket?.readyState===1})};
 }
 root.OverlayCosmetics={create,paintStyle,applyPaint,badgeFrom7,color,homiesBadges};
})(typeof window==='object'?window:globalThis);
