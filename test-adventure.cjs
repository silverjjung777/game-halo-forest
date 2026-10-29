const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const dist=path.join(__dirname,'dist');
const pixelProbe=spawnSync(process.env.HALO_PYTHON||'python3',['-c',"from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); im=im.resize((384,256)); sys.stdout.buffer.write(im.tobytes())",path.join(dist,'assets/boss.webp')]);
assert.equal(pixelProbe.status,0,pixelProbe.stderr.toString());
const bossPixels=new Uint8ClampedArray(pixelProbe.stdout);
class Element{
  constructor(id=''){this.id=id;this.style={};this.dataset={};this.textContent='';this.className='';this.handlers={};this.hidden=new Set();this.classList={add:c=>this.hidden.add(c),remove:c=>this.hidden.delete(c),toggle:(c,v)=>{if(v===undefined)v=!this.hidden.has(c);v?this.hidden.add(c):this.hidden.delete(c);}};}
  addEventListener(t,fn){(this.handlers[t]??=[]).push(fn);}setAttribute(){}click(){for(const fn of this.handlers.click||[])fn({preventDefault(){}});}
  getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},bezierCurveTo(){},quadraticCurveTo(){},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};},drawImage(){},getImageData(){return {data:bossPixels};}};}
}
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const modeButtons=['solo','coop'].map(v=>{const e=new Element();e.dataset.mode=v;return e;}),characterButtons=['angel','devil'].map(v=>{const e=new Element();e.dataset.character=v;return e;});
const listeners={},quads=[];let raf,now=0,audioCreated=0;
class Image{constructor(){this.width=768;this.height=224;}set src(v){this.path=v;queueMicrotask(()=>this.onload());}}
class Renderer{texture(s){return {src:s.path||'procedural',w:s.width,h:s.height};}begin(){quads.length=0;}quad(...args){quads.push(args);}rect(){}glow(){}flush(){}}
const sandbox={console,Image,Math:Object.create(Math),Uint8ClampedArray,performance:{now:()=>now},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>raf=fn,addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dist,url),'utf8'))}),document:{getElementById:element,createElement:()=>new Element(),querySelector:selector=>element(selector),querySelectorAll:selector=>selector==='[data-mode]'?modeButtons:selector==='[data-character]'?characterButtons:[],addEventListener(){}},location:{reload(){}},AudioContext:class{constructor(){audioCreated++;}},ForestRenderer:Renderer};
sandbox.Math.random=()=>.5;sandbox.window=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(dist,'boss-rules.js'),'utf8'),sandbox);vm.runInContext(fs.readFileSync(path.join(dist,'adventure.js'),'utf8'),sandbox);
const event=(type,code)=>{for(const fn of listeners[type]||[])fn({code,repeat:false,preventDefault(){}});};
function step(seconds){for(let i=0;i<Math.ceil(seconds*120);i++){now+=1000/120;raf(now);}}
function press(codes,seconds=.01,settle=.22){codes.forEach(c=>event('keydown',c));step(seconds);codes.forEach(c=>event('keyup',c));step(settle);}
const position=()=>({x:Number(element('world').dataset.playerX),y:Number(element('world').dataset.playerY),region:Number(element('game').dataset.region),mode:element('game').dataset.mode});
async function run(){
  for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));assert.equal(element('start').disabled,false,'all map and animation assets load');
  element('start').click();for(let i=0;i<3;i++)press(['KeyE']);
  press(['ArrowRight','Space','KeyP'],.73,.35);
  press(['ArrowRight','Space','KeyP'],.73,.35);
  press(['ArrowRight','Space','KeyP'],.76,.5);
  press(['ArrowRight','Space','KeyP'],1.05,.3);
  press(['ArrowRight','KeyP'],2.3,.4);
  assert.equal(position().region,2,'first map connects to supplied second map');console.log('Map 2 entry',position());
  press(['ArrowRight'],.35,.45);console.log('Map 2 home ledge',position());
  // New map stair/island route, rather than the old map geometry.
  press(['ArrowRight','Space','KeyP'],.78,.4);console.log('Map 2 jump 1',position());
  press(['ArrowRight','Space','KeyP'],.83,.4);console.log('Map 2 jump 2',position());
  press(['ArrowRight','Space','KeyP'],.82,.4);console.log('Map 2 jump 3',position());
  press(['ArrowRight','Space','KeyP'],1,.4);console.log('Map 2 jump 4',position());
  console.log('Map 2 right ledge',position());
  assert.equal(position().region,2);assert.ok(position().y<=501,'island route reaches the elevated warp ledge');
  press(['ArrowRight','KeyP'],1.4,1.6);
  assert.equal(position().region,3,'green warp teleports the party into a distinct boss map');assert.equal(position().mode,'dialogue');assert.equal(position().y,444,'blue warp arrives on the supplied left platform');console.log('Boss warp entry',position());
  press(['KeyE']);press(['KeyE']);
  press(['ArrowRight'],.65,.3);
  press(['ArrowRight','Space'],.9,.35);
  press(['ArrowRight','Space'],.82,.35);
  press(['ArrowRight','Space'],.83,.35);
  console.log('Boss approach',position(),element('boss-health').textContent);
  assert.ok(position().x>=2*1456+900,'supplied boss map stepping stones reach the arena');
  press(['ArrowUp','Space','KeyP'],.75,.4);
  if(position().mode!=='victory')press(['KeyP'],3,.5);
  assert.equal(position().mode,'victory','real game projectile collision reaches a victory condition');
  const first=quads.filter(q=>q[0].src?.includes('victory.png'));assert.equal(first.length,2,'both players use actual front-facing celebration atlases');assert.ok(first.every(q=>q[7]===false),'victory sprites face front without runtime mirroring');
  const initialY=first[0][2];step(.2);const next=quads.filter(q=>q[0].src?.includes('victory.png'));assert.notEqual(next[0][2],initialY,'celebrating players bounce repeatedly');
  assert.equal(audioCreated,0,'muted game never opens an audio context');
  console.log('Adventure checks passed: map1 → map2 new terrain → green warp → left blue warp → boss → smiling front celebration; no audio context.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
