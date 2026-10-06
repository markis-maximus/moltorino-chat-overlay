const fs=require('node:fs'),path=require('node:path');
const {launch}=require('../tests/browser-env.cjs');
(async()=>{
 const browser=await launch();
 try{
  const channel=(process.argv[2]||'jynxzi').toLowerCase();
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:18765/overlay.html?channel=${encodeURIComponent(channel)}&offline=1`);
  const report=await page.evaluate(async channel=>{
   let channelId='';try{const room=await(await fetch('https://api.frankerfacez.com/v1/room/'+encodeURIComponent(channel))).json();channelId=String(room.room?.twitch_id||'');}catch{}
   if(!channelId){const users=await(await fetch('https://api.ivr.fi/v2/twitch/user?login='+encodeURIComponent(channel))).json();channelId=String(users[0]?.id||'');}
   const users=new Map(),events=[],ops={};let messages=0;
   const chat=OverlayTransport.connect(channel,{onMessage:m=>{messages++;if(users.size<250)users.set(m.userId,{id:m.userId,username:m.username,displayName:m.displayName,badges:m.badges});}});
   const ws=new WebSocket('wss://events.7tv.io/v3');
   ws.onmessage=e=>{try{const d=JSON.parse(e.data);ops[d.op]=(ops[d.op]||0)+1;if(d.op===1){for(const type of ['cosmetic.*','entitlement.*'])ws.send(JSON.stringify({op:35,d:{type,condition:{platform:'TWITCH',ctx:'channel',id:channelId}}}));}if(d.op===0&&events.length<350)events.push(d.d);}catch{}};
   await new Promise(r=>setTimeout(r,165000));chat.close();ws.close();
   return {channel,channelId,messages,users:[...users.values()],ops,events};
  },channel);
  fs.writeFileSync(path.join(__dirname,'snapshots','channel-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({channel:report.channel,channelId:report.channelId,messages:report.messages,users:report.users.length,ops:report.ops,events:report.events.length,types:[...new Set(report.events.map(e=>e.type))]},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
