(function(){
  const form=document.getElementById('configure'),url=document.getElementById('sourceUrl'),feedback=document.getElementById('feedback');
  function config(){return {channel:form.channel.value.trim().toLowerCase(),fontSize:Number(form.fontSize.value),emoteSize:Number(form.emoteSize.value),fade:Number(form.fade.value),maxMessages:Number(form.maxMessages.value),badges:form.badges.checked,names:form.names.checked,paints:form.paints.checked,demo:form.demo.checked};}
  function update(refresh=true){if(!form.reportValidity())return;const c=config(),params=new URLSearchParams();for(const [k,v] of Object.entries(c))params.set(k,typeof v==='boolean'?v?'1':'0':String(v));const href=new URL('overlay.html?'+params,location.href).href;url.value=href;document.getElementById('open').href=href;if(refresh)document.getElementById('preview').src=href;return c;}
  form.addEventListener('submit',e=>{e.preventDefault();update();feedback.textContent='Preview and source updated.';});
  document.getElementById('copy').addEventListener('click',async()=>{update(false);try{await navigator.clipboard.writeText(url.value);feedback.textContent='Source URL copied.';}catch{url.select();feedback.textContent='Select and copy the URL above.';}});
  document.getElementById('download').addEventListener('click',async()=>{
    const c=update(false);if(!c)return;
    try{const response=await fetch('standalone-template.html');if(!response.ok)throw new Error('Portable template is unavailable. Run node build.mjs.');const text=await response.text();const encoded=JSON.stringify(c).replace(/</g,'\\u003c');const html=text.replace('/*OVERLAY_CONFIG*/',`globalThis.OVERLAY_CONFIG=${encoded};`);const objectUrl=URL.createObjectURL(new Blob([html],{type:'text/html'}));const link=document.createElement('a');link.href=objectUrl;link.download=`chat-${c.channel}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);feedback.textContent='Portable source downloaded. In OBS, choose Browser → Local file.';}catch(err){feedback.textContent=err.message;}
  });update(false);
})();
