import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const port=Number(process.env.OVERLAY_PORT||18765);
const routes=new Map(['index.html','setup.js','setup.css','overlay.html','overlay.css','demo-emote.js','modifiers.js','providers.js','transport.js','cosmetics.js','renderer.js','app.js','standalone-template.html'].map(f=>['/'+f,f]));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({app:'local-ffz-chat-overlay',version}));}
  const file=routes.get(pathname==='/'?'/index.html':pathname);
  if(!file){res.writeHead(404);return res.end('Not found');}
  try{
    const data=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('File not built yet. Run node build.mjs.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local chat overlay: http://127.0.0.1:${port}/`));
server.on('error',err=>{console.error(err.message);process.exitCode=1;});
