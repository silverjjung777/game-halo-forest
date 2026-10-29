import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const embedded = {};
for(const name of ['forest.webp','forest-2.webp','boss-arena.webp','warp.webp','boss-warp.webp','title-logo.webp','character.png','devil.png','snake.webp','boss.webp','angel-victory.png','devil-victory.png'])embedded['assets/'+name]='data:image/'+(name.endsWith('.webp')?'webp':'png')+';base64,'+fs.readFileSync(path.join(dist,'assets',name)).toString('base64');
for(const name of ['character.json','devil.json','angel-victory.json','devil-victory.json'])embedded['assets/'+name]=JSON.parse(fs.readFileSync(path.join(dist,'assets',name),'utf8'));
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,name)=>{
  let css=fs.readFileSync(path.join(dist,name),'utf8').replace(/@import url\([^;]+;/,'');
  css=css.replace(/url\('([^']+)'\)/g,(match,url)=>embedded[url]?'url("'+embedded[url]+'")':match);
  return '<style>'+css+'</style>';
});
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,name)=>{const js=fs.readFileSync(path.join(dist,name),'utf8');new Function(js);return '<script>'+js+'</script>';});
html=html.replace(/src="(assets\/[^\"]+)"/g,(match,name)=>embedded[name]?'src="'+embedded[name]+'"':match);
html=html.replace('<script>', '<script>window.FOREST_ASSETS='+JSON.stringify(embedded)+';</script><script>');
fs.writeFileSync(path.join(root, 'play.html'), html);
console.log('Created self-contained co-op adventure play.html with all images and animation manifests embedded.');
