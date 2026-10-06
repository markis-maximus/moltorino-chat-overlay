import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
let html=await readFile(path.join(root,'overlay.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="overlay.css">',`<style>${await readFile(path.join(root,'overlay.css'),'utf8')}</style>`);
for(const match of [...html.matchAll(/<script src="([^\"]+)"><\/script>/g)]){
  const source=await readFile(path.join(root,match[1]),'utf8');html=html.replace(match[0],`<script>\n${source.replace(/<\/script/gi,'<\\/script')}\n</script>`);
}
const license=await readFile(path.join(root,'LICENSE-FFZ.txt'),'utf8');
html=html.replace('<head>',`<head><!-- FFZ effect code adapted under Apache-2.0. Copyright 2016 Dan Salvato LLC and contributors.\n${license.replace(/--/g,'—')}\n-->`);
await writeFile(path.join(root,'standalone-template.html'),html);
await mkdir(path.join(root,'dist'),{recursive:true});
const channel=(process.argv.find(x=>x.startsWith('--channel='))?.split('=')[1]||'jynxzi').toLowerCase();
if(!/^[a-z0-9_]{1,25}$/.test(channel))throw new Error('Invalid channel');
const file=`chat-${channel}.html`;
await writeFile(path.join(root,'dist',file),html.replace('/*OVERLAY_CONFIG*/',`globalThis.OVERLAY_CONFIG=${JSON.stringify({channel,demo:true})};`));
console.log('Built dist/'+file);
