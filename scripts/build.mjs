import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'dist'),output=path.join(root,'public');
fs.mkdirSync(path.join(output,'assets'),{recursive:true});
const digest=data=>crypto.createHash('sha256').update(data).digest('hex').slice(0,12);
const publish=(name,data)=>{
  const ext=path.extname(name),base=path.basename(name,ext),file=`assets/${base}.${digest(data)}${ext}`;
  fs.writeFileSync(path.join(output,file),data);
  return file;
};
const mapped={};
for(const name of ['forest.webp','forest-2.webp','boss-arena.webp','warp.webp','boss-warp.webp','title-logo.webp','snake.webp','boss.webp','character.png','devil.png','angel-victory.png','devil-victory.png']){
  const data=fs.readFileSync(path.join(source,'assets',name));
  mapped['assets/'+name]=publish(name,data);
}
for(const name of ['character.json','devil.json','angel-victory.json','devil-victory.json'])mapped['assets/'+name]=JSON.parse(fs.readFileSync(path.join(source,'assets',name),'utf8'));
const js='window.FOREST_ASSETS='+JSON.stringify(mapped)+';\n'+['engine.js','boss-rules.js','adventure.js'].map(file=>fs.readFileSync(path.join(source,file),'utf8')).join('\n;\n');
new Function(js);
const script=publish('game.js',js);
const css=['style.css','adventure.css'].map(file=>fs.readFileSync(path.join(source,file),'utf8')).join('\n').replace(/@import url\([^;]+;/g,'').replace(/url\('([^']+)'\)/g,(all,url)=>mapped[url]?'url("/'+mapped[url]+'")':all);
const style=publish('game.css',css);
let html=fs.readFileSync(path.join(source,'index.html'),'utf8').replace(/<link rel="stylesheet" href="[^"]+">/g,'').replace(/<script src="[^"]+"><\/script>/g,'');
html=html.replace('</head>',`<link rel="stylesheet" href="/${style}"></head>`).replace('</body>',`<script src="/${script}" defer></script></body>`);
html=html.replace(/src="(assets\/[^"]+)"/g,(all,url)=>typeof mapped[url]==='string'?'src="/'+mapped[url]+'"':all);
fs.writeFileSync(path.join(output,'index.html'),html);
const files=fs.readdirSync(path.join(output,'assets'));
const bytes=files.reduce((sum,file)=>sum+fs.statSync(path.join(output,'assets',file)).size,Buffer.byteLength(html));
console.log(`Built dependency-free Vercel static game: ${files.length+1} files, ${(bytes/1024/1024).toFixed(2)} MiB. Hashed assets use immutable caching.`);
