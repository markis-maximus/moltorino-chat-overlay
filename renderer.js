/* Text is always inserted as text nodes. Provider names and chat never become HTML. */
(function(root){
  'use strict';
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const badgeSignatures=new WeakMap();
  function pieces(message){
    const text=Array.from(message.text || '');
    const ranges=(message.emotes||[]).filter(r=>Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=0&&r.end>=r.start&&r.end<text.length).sort((a,b)=>a.start-b.start);
    const out=[]; let cursor=0;
    const plain=s=>{ for(const token of s.match(/\s+|\S+/gu)||[]) out.push({text:token}); };
    for(const r of ranges){
      if(r.start<cursor)continue;
      plain(text.slice(cursor,r.start).join(''));
      const name=text.slice(r.start,r.end+1).join('');
      out.push({text:name,emote:{id:r.id,name,provider:'twitch',url:`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(r.id)}/default/dark/3.0`,width:0,height:0}});
      cursor=r.end+1;
    }
    plain(text.slice(cursor).join(''));return out;
  }
  function parse(message,catalog){
    const out=[];let last=null,pending='',prefix=[];
    function flush(){if(pending){out.push({type:'text',text:pending});pending='';}}
    function flushPrefix(){for(const p of prefix){out.push({type:'text',text:p.name+' '});}prefix=[];}
    for(const piece of pieces(message)){
      if(/^\s+$/u.test(piece.text)){pending+=piece.text;continue;}
      const emote=piece.emote||catalog.get(piece.text);
      const resolved=!piece.emote ? root.OverlayModifiers.resolve(piece.text,emote):null;
      // Do not silently hide an effect this renderer does not understand yet.
      const mod=resolved&&!resolved.unsupportedFlags?resolved:null;
      if(resolved?.unsupportedFlags){flush();flushPrefix();out.push({type:'text',text:piece.text});last=null;continue;}
      if(mod&&mod.prefix){flush();prefix.push(mod);last=null;continue;}
      if(mod&&last){
        // Consume only the whitespace between a visual emote and its modifiers.
        pending='';last.flags|=mod.flags;last.modifiers.push(piece.text);
        if(emote&&!mod.hidden){last.overlays.push(emote);}
        continue;
      }
      if(emote&&emote.zeroWidth&&!mod&&last){pending='';last.overlays.push(emote);last.modifiers.push(piece.text);continue;}
      flush();
      if(emote&&!mod){
        last={type:'emote',base:emote,overlays:[],flags:0,modifiers:[]};
        for(const p of prefix){last.flags|=p.flags;last.modifiers.push(p.name);}prefix=[];
        out.push(last);
      }else{
        flushPrefix();out.push({type:'text',text:piece.text});last=null;
      }
    }
    flush();flushPrefix();return out;
  }
  function image(emote,classes){
    const img=document.createElement('img');img.className=classes;img.alt=emote.name;img.src=emote.url;img.decoding='async';img.draggable=false;
    img.addEventListener('error',()=>{img.dataset.failed='true';},{once:true});return img;
  }
  function visual(cluster,size){
    const unit=document.createElement('span');unit.className='emote-unit';
    unit.dataset.emote=cluster.base.name;unit.dataset.modifiers=cluster.modifiers.join(' ');unit.dataset.flags=String(cluster.flags);
    unit.title=[cluster.base.name,...cluster.modifiers].join(' ');unit.setAttribute('role','img');unit.setAttribute('aria-label',unit.title);
    const raw=document.createElement('span');raw.className='emote-stack';
    const ratio=cluster.base.width>0&&cluster.base.height>0?cluster.base.width/cluster.base.height:1;
    let width=clamp(ratio*size,4,size*12);
    raw.style.width=width+'px';raw.style.height=size+'px';
    const base=image(cluster.base,'emote-image emote-base');raw.append(base);
    for(const over of cluster.overlays){
      const layer=image(over,'emote-image emote-zero');
      layer.style.height='100%';layer.dataset.ratio=String(over.width&&over.height?over.width/over.height:1);
      if(!over.width||!over.height)layer.addEventListener('load',()=>{
        if(layer.naturalWidth&&layer.naturalHeight){layer.dataset.ratio=String(layer.naturalWidth/layer.naturalHeight);layer.style.width=(Number(layer.dataset.ratio)*size/width*100)+'%';}
      },{once:true});
      raw.append(layer);
    }
    function mount(){
      const old=unit.firstChild;
      raw.style.width=width+'px';raw.style.height=size+'px';
      for(const layer of raw.querySelectorAll('.emote-zero'))layer.style.width=(Number(layer.dataset.ratio)*size/width*100)+'%';
      const decorated=root.OverlayModifiers.apply(raw,cluster.flags,{width,height:size,scale:size/32});
      if(old)old.remove();unit.append(decorated);
    }
    mount();
    const resizeBase=()=>{
      if(!cluster.base.width&&base.naturalWidth&&base.naturalHeight){
        const actual=clamp(base.naturalWidth/base.naturalHeight*size,4,size*12);
        if(Math.abs(actual-width)>.5){width=actual;mount();}
      }
    };
    base.addEventListener('load',resizeBase,{once:true});
    if(base.complete&&base.naturalWidth)resizeBase();
    base.addEventListener('error',()=>{unit.textContent=unit.title;unit.classList.add('emote-fallback');},{once:true});
    return unit;
  }
  function decorate(row,message,options={}){
    let holder=row.querySelector('.message-badges');
    if(!holder){holder=document.createElement('span');holder.className='message-badges';row.prepend(holder);}
    const profile=options.cosmeticsProfile;
    const badges=options.badges===false?[]:(profile?.badges||(message.badges||[]).map(b=>{const asset=options.badgeMap?.get(`${b.set}/${b.version}`);return {id:b.set,source:'twitch',title:b.set,...(b.set==='moderator'?{color:'#34ae0a'}:{}),...(typeof asset==='string'?{url:asset}:asset)};})).slice(0,24);
    const signature=JSON.stringify(badges);
    if(badgeSignatures.get(holder)!==signature){
    badgeSignatures.set(holder,signature);holder.replaceChildren();
    for(const badge of badges){
      if(!badge.url)continue;const img=document.createElement('img');img.className='badge';img.src=badge.url;img.alt=badge.title||badge.id;img.title=badge.title||badge.id;img.dataset.source=badge.source||'';img.dataset.badgeId=badge.id||'';
      if(/^#[\da-f]{6}$/i.test(badge.color||''))img.style.backgroundColor=badge.color;
      img.addEventListener('error',()=>{img.remove();badgeSignatures.delete(holder);},{once:true});holder.append(img);
    }
    }
    const name=row.querySelector('.username'),text=name?.querySelector('.name-text');
    if(text&&root.OverlayCosmetics)root.OverlayCosmetics.applyPaint(text,options.paints===false?null:profile?.paint,message.color);
  }
  function render(message,catalog,options={}){
    const row=document.createElement('div');row.className='message'+(message.isAction?' action':'')+(message.preview?' preview':'');
    row.dataset.id=message.id||'';row.dataset.userId=message.userId||'';row.dataset.username=message.username||'';
    if(options.names!==false){
      const name=document.createElement('span');name.className='username';
      const text=document.createElement('span');text.className='name-text';text.textContent=message.displayName||message.username||'Chat';name.append(text);
      if(/^#[\da-f]{6}$/i.test(message.color||''))name.style.color=message.color;
      row.append(name);
    }
    const body=document.createElement('span');body.className='message-text';
    for(const p of parse(message,catalog)){if(p.type==='text')body.append(document.createTextNode(p.text));else body.append(visual(p,options.emoteSize||36));}
    row.append(body);decorate(row,message,options);return row;
  }
  root.OverlayRenderer={parse,pieces,render,decorate};
})(typeof window==='object'?window:globalThis);
