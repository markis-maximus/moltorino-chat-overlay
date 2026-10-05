const fs=require('node:fs'),path=require('node:path');
const {launch}=require('../tests/browser-env.cjs');
(async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:18765/overlay.html?channel=bonnie&offline=1');
  const report=await page.evaluate(async()=>{
   const room=await(await fetch('https://api.frankerfacez.com/v1/room/bonnie')).json();
   const channelId=String(room.room.twitch_id);const users=new Map(),events=[],ops={};let messages=0;
   const chat=OverlayTransport.connect('bonnie',{onMessage:m=>{messages++;if(users.size<250)users.set(m.userId,{id:m.userId,username:m.username,displayName:m.displayName,badges:m.badges});}});
   const ws=new WebSocket('wss://events.7tv.io/v3');
   ws.onmessage=e=>{try{const d=JSON.parse(e.data);ops[d.op]=(ops[d.op]||0)+1;if(d.op===1){for(const type of ['cosmetic.*','entitlement.*'])ws.send(JSON.stringify({op:35,d:{type,condition:{platform:'TWITCH',ctx:'channel',id:channelId}}}));}if(d.op===0&&events.length<350)events.push(d.d);}catch{}};
   await new Promise(r=>setTimeout(r,165000));chat.close();ws.close();
   return {channelId,room:room.room,messages,users:[...users.values()],ops,events};
  });
  fs.writeFileSync(path.join(__dirname,'snapshots','bonnie-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({channelId:report.channelId,messages:report.messages,users:report.users.length,ops:report.ops,events:report.events.length,types:[...new Set(report.events.map(e=>e.type))]},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
