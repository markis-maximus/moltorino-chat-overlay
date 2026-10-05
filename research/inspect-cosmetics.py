from pathlib import Path
import os,re,json,sys
R=Path(__file__).parent/'snapshots';R.mkdir(exist_ok=True)
default=Path(os.environ.get('LOCALAPPDATA',''))/'MoltoBenne.Moltorino7'/'current'/'Moltorino7.exe'
binary=Path(sys.argv[1]) if len(sys.argv)>1 else default
if not binary.is_file(): raise SystemExit('Pass the path to Moltorino7.exe as the first argument.')
b=binary.read_bytes()
items=[]
for enc,rx in [('ascii',rb'[\x20-\x7e]{5,}'),('utf16le',rb'(?:[\x20-\x7e]\x00){5,}')]:
 for m in re.finditer(rx,b):
  s=m.group().decode('ascii' if enc=='ascii' else 'utf-16le')
  if re.search(r'vanity|cosmetic|badge.?order|hidden.?badge|paint.?id|https?://[^ ]*(molto|7tv|badge)',s,re.I) and len(s)<450:
   items.append({'offset':hex(m.start()),'text':s,'encoding':enc})
(R/'moltorino-cosmetics-strings.json').write_text(json.dumps(items,indent=2),encoding='utf8')
for x in items:
 if not x['text'].startswith('.?'):print(x['offset'],x['text'])
