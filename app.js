(function(){
  'use strict';
  const defaults={channel:'markis_maximus',fontSize:24,emoteSize:36,maxMessages:30,fade:0,badges:true,names:true,paints:true,demo:false};
  const qs=new URLSearchParams(location.search || location.hash.replace(/^#/, '?'));
  const config={...defaults,...(globalThis.OVERLAY_CONFIG||{})};
  const numeric=(key,min,max)=>{const n=Number(qs.get(key)??config[key]);config[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):defaults[key];};
  config.channel=(qs.get('channel')||config.channel).trim().replace(/^#/, '').toLowerCase();
  for(const key of ['demo','badges','names','paints'])if(qs.has(key))config[key]=!['0','false','off'].includes(qs.get(key));
  numeric('fontSize',12,72);numeric('emoteSize',16,128);numeric('maxMessages',1,100);numeric('fade',0,3600);
  const debug=qs.get('debug')==='1',offline=qs.get('offline')==='1';
  const chat=document.getElementById('chat'),status=document.getElementById('status');
  document.documentElement.style.setProperty('--font-size',config.fontSize+'px');
  document.documentElement.style.setProperty('--emote-size',config.emoteSize+'px');
  let catalog=new Map(),badgeMap=new Map(),connection=null,seeded=false,loading=true,pending=[];
  const state={version:OverlayModifiers.version,channel:config.channel,connection:'starting',providers:[],loaded:0,lastMessageAt:null,config};
  const history=[];
  const rowMessages=new WeakMap();let updateFrame=null;
  const cosmetics=!offline&&window.OverlayCosmetics?OverlayCosmetics.create({onStatus:setStatus,onUpdate:()=>{
    if(updateFrame!==null)return;
    updateFrame=requestAnimationFrame(()=>{updateFrame=null;for(const row of chat.children){const m=rowMessages.get(row);if(m)OverlayRenderer.decorate(row,m,{...config,badgeMap,cosmeticsProfile:cosmetics.profile(m,badgeMap)});}});
  }}):null;
  function setStatus(value){
    if(['connected','connecting','reconnecting','disconnected','error','joined'].includes(value.state))state.connection=value.state;
    state.providers.push(value);if(state.providers.length>20)state.providers.shift();
    document.body.dataset.connection=state.connection;
    status.hidden=!debug;status.textContent=`#${config.channel} · ${state.connection} · ${catalog.size} emotes\n${state.providers.map(x=>x.message).slice(-5).join('\n')}`;
  }
  function paint(message){
    if(chat.children.length>=config.maxMessages)chat.firstElementChild?.remove();
    const row=OverlayRenderer.render(message,catalog,{...config,badgeMap,cosmeticsProfile:cosmetics?.profile(message,badgeMap)});rowMessages.set(row,message);chat.append(row);
    if(message.userId)cosmetics?.ensureUser(message.userId);
    // scrollHeight includes transformed emote pixels outside their line box.
    // Removing older rows cannot fix overflow below the newest row; measure
    // actual row layout instead so an animation cannot empty the history.
    const layout=getComputedStyle(chat),gap=parseFloat(layout.rowGap)||0;
    const available=chat.clientHeight-(parseFloat(layout.paddingTop)||0)-(parseFloat(layout.paddingBottom)||0);
    const heights=[...chat.children].map(child=>child.getBoundingClientRect().height);
    let occupied=heights.reduce((sum,height)=>sum+height,0)+gap*(heights.length-1),first=0;
    while(occupied>available+.5&&chat.children.length>1){occupied-=heights[first++]+gap;chat.firstElementChild.remove();}
    if(config.fade>0)row.dataset.expires=String(Date.now()+config.fade*1000);
    return row;
  }
  function receive(message){
    if(loading){if(pending.length===100)pending.shift();pending.push(message);return;}
    state.lastMessageAt=Date.now();history.push(message);if(history.length>100)history.shift();paint(message);
  }
  function demo(){
    if(seeded)return;seeded=true;
    const example=globalThis.OverlayDemoEmote;
    const demoCatalog=new Map(catalog);
    demoCatalog.set('heyy',catalog.get('heyy')||example);
    if(globalThis.OverlayDemoBrightEmote)demoCatalog.set('Kappa',globalThis.OverlayDemoBrightEmote);
    const old=catalog;catalog=demoCatalog;
    const rows=[
      ['Normal → wide','heyy heyy ffzW'],
      ['Flip → flip + wide','heyy ffzX heyy ffzY heyy ffzW ffzX'],
      ['Jam → bounce → spin','heyy ffzJam heyy ffzBounce heyy ffzSpin'],
      ['Rainbow → hyper → cursed',globalThis.OverlayDemoBrightEmote?'heyy ffzRainbow Kappa ffzHyper Kappa ffzCursed':'heyy ffzRainbow heyy ffzHyper heyy ffzCursed'],
      ['Arrive → leave → slide','heyy ffzArrive heyy ffzLeave heyy ffzSlide'],
      ['Combined effects','heyy ffzW ffzRainbow ffzBounce heyy ffzArrive ffzLeave'],
      ['Spin + bounce + wide','heyy ffzBounce ffzSpin ffzArrive ffzLeave ffzW'],
    ];
    const zero=[...catalog.values()].find(e=>e.zeroWidth&&e.provider==='7tv'&&['JailTime','RainTime','SnowTime'].includes(e.name));
    if(zero)rows.push(['7TV layer + FFZ',`heyy ${zero.name} ffzW ffzRainbow`]);
    for(const [displayName,text] of rows)paint({id:`preview-${chat.children.length}`,username:'overlay_preview',displayName,text,preview:true,badges:[],emotes:[]});
    catalog=old;
  }
  async function refresh(initial=false){
    try{
      const next=await OverlayProviders.load(config.channel,setStatus);
      // Keep existing catalogs during temporary provider failure; load() merges its own provider cache.
      if(next.emotes.size)catalog=next.emotes;if(next.badges.size)badgeMap=next.badges;
      state.loaded=catalog.size;
      if(next.channelId)cosmetics?.connect(next.channelId);
      cosmetics?.refresh();
      setStatus({state:'catalog',message:`Loaded ${catalog.size} emotes. Catalog refresh every 5 minutes.`});
    }catch(err){setStatus({state:'catalog-error',message:`Emote catalog: ${err.message}`});}
    finally{
      if(initial){loading=false;if(config.demo){for(const row of [...chat.querySelectorAll('.preview')])row.remove();seeded=false;demo();}for(const m of pending)receive(m);pending=[];}
    }
  }
  function clear(info){
    const matches=m=>info.all||(info.userId&&m.userId===info.userId)||(info.username&&m.username?.toLowerCase()===info.username.toLowerCase());
    pending=pending.filter(m=>!matches(m));
    for(const row of [...chat.children])if(matches({userId:row.dataset.userId,username:row.dataset.username}))row.remove();
  }
  function removeMessage(info){pending=pending.filter(m=>m.id!==info.id);for(const row of [...chat.children])if(row.dataset.id===info.id)row.remove();}
  if(!/^[a-z0-9_]{1,25}$/.test(config.channel)){status.hidden=false;status.textContent='Set a valid Twitch channel in the source URL: ?channel=your_channel';return;}
  window.OverlayApp={getStatus:()=>({...state,config:{...config},cosmetics:cosmetics?.stats()||null}),refresh:()=>refresh(false)};
  if(qs.get('test')==='1'){Object.assign(window.OverlayApp,{inject:receive,setCatalog:map=>{catalog=map;loading=false;},clear,removeMessage,demo});}
  if(offline){loading=false;catalog.set('heyy',globalThis.OverlayDemoEmote);setStatus({state:'offline',message:'Offline preview; no chat connection.'});if(config.demo)demo();}
  else{
    if(config.demo)demo();
    connection=OverlayTransport.connect(config.channel,{onMessage:receive,onStatus:setStatus,onClear:clear,onDelete:removeMessage});
    refresh(true);
    setInterval(()=>refresh(false),300000);
  }
  window.addEventListener('beforeunload',()=>{connection?.close();cosmetics?.close();});
  if(config.fade>0)setInterval(()=>{const now=Date.now();for(const row of chat.children){const expires=Number(row.dataset.expires);if(!expires)continue;if(now>expires+450)row.remove();else if(now>expires)row.classList.add('expired');}},250);
})();
