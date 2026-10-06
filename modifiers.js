/*
 * FFZ modifier compatibility for the local chat overlay.
 * Effect definitions and keyframe values adapted from FrankerFaceZ:
 * https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/emotes.js
 * Copyright 2016 Dan Salvato LLC. Licensed under Apache-2.0.
 * http://www.apache.org/licenses/LICENSE-2.0
 * Distributed on an AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 * Changes: standalone renderer, metadata discovery, composed-image slide adapter,
 * independent arrival/departure stage so other motion cannot replace its transform.
 */
(function (global) {
  'use strict';
  const Flags = Object.freeze({Hidden:1, FlipX:2, FlipY:4, GrowX:8, Slide:16,
    Appear:32, Leave:64, Rotate:128, Rotate90:256, Greyscale:512, Sepia:1024,
    Rainbow:2048, HyperRed:4096, Shake:8192, Cursed:16384, Jam:32768,
    Bounce:65536, NoSpace:131072});
  const supportedMask = 1|2|4|8|16|32|64|128|2048|4096|8192|16384|32768|65536;
  const builtIn = new Map([
    ['ffzHyper',12289,720507], ['ffzRainbow',2049,720510], ['ffzBounce',65537,721137],
    ['ffzJam',32769,720730], ['ffzSlide',17,723889], ['ffzLeave',65,723887],
    ['ffzArrive',33,723888], ['ffzSpin',129,723886], ['ffzW',9,723890],
    ['ffzX',3,720508], ['ffzY',5,720509], ['ffzCursed',16385,720729]
  ].map(([name,flags,id]) => [name,Object.freeze({name,flags,id,modifier:true,
    hidden:true,prefix:false,unsupportedFlags:0})]));

  function resolve(token, emote) {
    const metadataFlags = emote && (emote.modifier_flags ?? emote.modifierFlags);
    if (emote && emote.modifier === true && Number.isSafeInteger(metadataFlags)) {
      const flags = metadataFlags >>> 0;
      return {name:token,flags,id:emote.id,modifier:true,prefix:!!(emote.modifier_prefix ?? emote.modifierPrefix),
        hidden:!!(flags & Flags.Hidden),unsupportedFlags:(flags & ~supportedMask) >>> 0};
    }
    return builtIn.get(token) || null;
  }

  // Frame arrays preserve FFZ's timing, including abrupt horizontal flips.
  const appear = [[0,-18,0,0],[19.99,-18,0,0],[20,-18,.1,0],[25,-16,.2,.6],
    [30,-14,.3,-4],[35,-12,.4,.6],[40,-10,.5,-4],[45,-8,.6,2],
    [50,-6,.7,-3],[55,-4,.8,2],[60,-2,.9,-3],[65,0,1,0],[100,0,1,0]];
  const leave = [[0,0,1,0],[39.99,0,1,0],[40,0,-.9,.9,-3],
    [45,-2,-.8,.8,2],[50,-4,-.7,.7,-3],[55,-6,-.6,.6,2],
    [60,-8,-.5,.5,-4],[65,-10,-.4,.4,.6],[70,-12,-.3,.3,-4],
    [75,-14,-.2,.2,.6],[80,-16,-.1,.1,0],[85,-18,-.01,0,0],[100,-18,0,0,0]];
  const shake = [[1,1],[-1,-2],[-3,0],[3,2],[1,-1],[-1,2],[-3,1],[3,1],[-1,-1],[1,2],[1,-2]];
  const jam = [[-2,-2,-6],[-1.5,-2,-8],[1,-1.5,-8],[3,2.5,-6],[3,4,-2],
    [2,4,3],[1,4,3],[-.5,3,2],[-1.25,1,0],[-1.75,-.5,-2],[-2,-2,-5]];
  const bounce = [[0,.8,1],[10,.9,.8],[20,1,.4],[25,1.2,.3],[25.001,-1.2,.3],
    [30,-1,.4],[40,-.9,.8],[50,-.8,1],[60,-.9,.8],[70,-1,.4],
    [75,-1.2,.3],[75.001,1.2,.3],[80,1,.4],[90,.9,.8],[100,.8,1]];

  function appearFrames(frames,multi=1,offset=0) {
    return frames.map(f => {
      const scale = f.length === 4 ? `scale(${f[2]})` : `scale(${f[2]},${f[3]})`;
      const y = f.length === 4 ? f[3] : f[4];
      return `${f[0]*multi+offset}%{transform:var(--ffz-base-transform) translateX(${f[1]}px) ${scale} translateY(${y}px)}`;
    }).join('');
  }
  function installStyles(doc) {
    if (doc.getElementById('overlay-ffz-effect-styles')) return;
    const style=doc.createElement('style'); style.id='overlay-ffz-effect-styles';
    style.textContent = `
      .ffz-modified{position:relative;display:inline-block;vertical-align:middle;overflow:visible;line-height:0}
      .ffz-effect-stage{position:relative;display:block;overflow:visible;--ffz-base-transform:translate(0);--ffz-base-filter:brightness(1)}
      .ffz-transition-stage{position:relative;display:block;width:100%;height:100%;--ffz-base-transform:translate(0)}
      .ffz-motion-stage{position:relative;display:block;width:100%;height:100%;--ffz-base-transform:translate(0)}
      .ffz-effect-content{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important}
      .ffz-slide-window{width:100%;height:100%;overflow:hidden;position:relative}
      .ffz-slide-strip{height:100%;display:flex;width:300%;animation:overlay-ffz-slide var(--ffz-slide-duration) linear infinite}
      .ffz-slide-cell{height:100%;flex:0 0 33.333333333333%;position:relative}
      @keyframes overlay-ffz-slide{from{transform:translateX(0)}to{transform:translateX(-33.333333333333%)}}
      @keyframes overlay-ffz-appear{${appearFrames(appear)}}
      @keyframes overlay-ffz-leave{${appearFrames(leave)}}
      @keyframes overlay-ffz-in-out{${appearFrames(appear,.5)}${appearFrames(leave,.5,50)}}
      @keyframes overlay-ffz-spin{0%{transform:var(--ffz-base-transform) rotate(0deg)}100%{transform:var(--ffz-base-transform) rotate(360deg)}}
      @keyframes overlay-ffz-rainbow{0%{filter:var(--ffz-base-filter) hue-rotate(0deg)}100%{filter:var(--ffz-base-filter) hue-rotate(360deg)}}
      @keyframes overlay-ffz-shake{${shake.map((p,i)=>`${i*10}%{transform:var(--ffz-base-transform) translate(${p[0]}px,${p[1]}px)}`).join('')}}
      @keyframes overlay-ffz-jam{${jam.map((p,i)=>`${i*10}%{transform:var(--ffz-base-transform) translate(${p[0]}px,${p[1]}px) rotate(${p[2]}deg)}`).join('')}}
      @keyframes overlay-ffz-bounce{${bounce.map(p=>`${p[0]}%{transform:scale(${p[1]},${p[2]}) var(--ffz-base-transform)}`).join('')}}
    `;
    doc.head.appendChild(style);
  }
  function finiteSize(value,fallback) { return Number.isFinite(value) && value>0 ? value : fallback; }
  function apply(element, flags, options={}) {
    if (!element || !element.ownerDocument) throw new TypeError('apply expects a DOM element');
    flags=Number(flags)>>>0;
    const doc=element.ownerDocument;
    installStyles(doc);
    const scale=finiteSize(options.scale,1);
    const originalWidth=finiteSize(options.width,32*scale);
    const originalHeight=finiteSize(options.height,32*scale);
    let width=originalWidth, height=originalHeight;
    if (flags & Flags.GrowX) width*=2;
    if (flags) { width=Math.min(width,128*scale); height=Math.min(height,40*scale); }
    const wrapper=doc.createElement('span');
    wrapper.className='ffz-modified';
    wrapper.dataset.effects=String(flags);
    wrapper.dataset.unsupportedEffects=String((flags & ~supportedMask)>>>0);
    wrapper.style.width=`${Math.max(originalWidth,width)}px`;
    wrapper.style.height=`${Math.max(originalHeight,height)}px`;
    const stage=doc.createElement('span'); stage.className='ffz-effect-stage';
    stage.style.width=`${width}px`; stage.style.height=`${height}px`;
    stage.style.marginLeft=`${(Math.max(originalWidth,width)-width)/2}px`;
    stage.style.marginTop=`${(Math.max(originalHeight,height)-height)/2}px`;
    const transforms=[],filters=[],animations=[],motions=[];
    if (flags & Flags.FlipX) transforms.push('scaleX(-1)');
    if (flags & Flags.FlipY) transforms.push('scaleY(-1)');
    // Arrival/departure changes visibility over a longer cycle. Keep its transform
    // independent of Bounce, Jam, Shake and Spin, which otherwise replace it in CSS.
    let transition='';
    if (flags & Flags.Appear) transition=flags & Flags.Leave ? 'overlay-ffz-in-out 6s linear infinite' : 'overlay-ffz-appear 3s linear infinite';
    else if (flags & Flags.Leave) transition='overlay-ffz-leave 3s linear infinite';
    if (flags & Flags.Rotate) motions.push(['spin','1.5s']);
    if (flags & Flags.Rainbow) animations.push('overlay-ffz-rainbow 2s linear infinite');
    if (flags & Flags.HyperRed) filters.push('brightness(0.2) sepia(1) brightness(2.2) contrast(3) saturate(8)');
    if (flags & Flags.Shake) motions.push(['shake','0.1s']);
    if (flags & Flags.Cursed) filters.push('grayscale(1) brightness(0.7) contrast(2.5)');
    if (flags & Flags.Jam) motions.push(['jam','0.6s']);
    if (flags & Flags.Bounce) motions.push(['bounce','0.5s']);
    if (transforms.length) {
      stage.style.setProperty('--ffz-base-transform',transforms.join(' '));
      stage.style.transform=transforms.join(' ');
    }
    if (filters.length) {
      stage.style.setProperty('--ffz-base-filter',filters.join(' '));
      stage.style.filter=filters.join(' ');
    }
    if (animations.length) stage.style.animation=animations.join(', ');
    let contentParent=stage;
    // Each motion owns a transform. Their matrices compose instead of replacing
    // one another; keeping size on the outer stage also preserves Wide + Spin.
    for(const [kind,duration] of motions){
      const motion=doc.createElement('span');motion.className='ffz-motion-stage ffz-motion-'+kind;
      motion.style.animation=`overlay-ffz-${kind} ${duration} linear infinite`;
      if(kind==='bounce')motion.style.transformOrigin='bottom center';
      contentParent.appendChild(motion);contentParent=motion;
    }
    if (transition) {
      const lifecycle=doc.createElement('span');lifecycle.className='ffz-transition-stage';
      lifecycle.style.animation=transition;
      contentParent.appendChild(lifecycle);contentParent=lifecycle;
    }
    element.classList.add('ffz-effect-content');
    if (flags & Flags.Slide) {
      const viewport=doc.createElement('span'); viewport.className='ffz-slide-window'; viewport.style.display='block';
      const strip=doc.createElement('span');strip.className='ffz-slide-strip';
      strip.style.setProperty('--ffz-slide-duration',`${.5*width/(32*scale)}s`);
      for (let i=0;i<3;i++) {
        const cell=doc.createElement('span');cell.className='ffz-slide-cell';
        const content=i===0 ? element : element.cloneNode(true);
        if (i) { content.removeAttribute('id'); for(const node of content.querySelectorAll('[id]')) node.removeAttribute('id'); }
        cell.appendChild(content);strip.appendChild(cell);
      }
      viewport.appendChild(strip);contentParent.appendChild(viewport);
    } else contentParent.appendChild(element);
    wrapper.appendChild(stage);
    return wrapper;
  }
  global.OverlayModifiers=Object.freeze({version:'0.2.8',Flags,builtIn,resolve,apply,installStyles,supportedMask,
    source:'https://github.com/FrankerFaceZ/FrankerFaceZ/blob/master/src/modules/chat/emotes.js'});
})(typeof window==='object' ? window : globalThis);
