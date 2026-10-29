'use strict';
(() => {
  const W=1456,H=816,$=id=>document.getElementById(id),host=$('game'),canvas=$('world');
  const keys=new Set(),regions=[],platforms=[],lights=[],enemies=[],shots=[],hostileShots=[],particles=[],labels=[];
  const names=['빛의 숲','폭포의 정원','녹스의 둥지'];
  const tints=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const BOSS_GROUND=385;
  const bossTerrain=[
    {x:0,x2:281,y:444,id:'boss-entry'}, {x:300,x2:439,y:479,id:'arena-step'},
    {x:482,x2:588,y:451,id:'arena-step'}, {x:608,x2:724,y:497,id:'arena-step'},
    {x:706,x2:796,y:430,id:'arena-step'}, {x:824,x2:941,y:393,id:'arena-step'},
    {x:973,x2:1456,y:BOSS_GROUND,id:'arena'}
  ];
  const warp={x:W+1340,y:486,w:160,h:240};
  let warpElapsed=0,warpMoved=false,warpHintTime=0;
  const thresholds=[0,200,500,900,1400,2100,3000];
  const profiles={angel:{name:'루미',title:'별의 천사',color:[1,.86,.48],file:'character'},devil:{name:'루아',title:'불꽃의 악마',color:[1,.39,.16],file:'devil'}};
  let selection='angel',playMode='solo',mode='loading',loaded=false,renderer,art={},assets={};
  let players=[],score=0,kills=0,level=1,damage=10,collected=0,tick=0,elapsed=0,cameraX=0,furthest=180,regionIndex=0;
  let checkpoint={x:180,y:674},lastTime=0,accumulator=0,uiClock=0,flash=0,trail=[],trailClock=0;
  let dialogue=[],dialogueIndex=0,afterDialogue=null,activeBoss=null,toastTimer,muted=false,audio,music,separationToast=0;
  const terrain=[
    {x:59,x2:296,y:674,id:'home'}, {x:306,x2:486,y:544,id:'step'},
    {x:465,x2:704,y:455,id:'center'}, {x:699,x2:870,y:467,id:'bridge'},
    {x:859,x2:1425,y:445,id:'gate'}, {x:622,x2:712,y:335,id:'rune',magic:true},
    {x:746,x2:1005,y:210,id:'crown'}
  ];
  const sparkPlaces=[[183,619],[369,493],[548,404],[666,291],[849,163],[957,396],[1162,391]];
  const secondTerrain=[
    {x:40,x2:317,y:662,id:'home'}, {x:22,x2:231,y:610,id:'left-high'},
    {x:317,x2:409,y:585,id:'step'}, {x:378,x2:519,y:552,id:'step-high'},
    {x:558,x2:704,y:516,id:'center'}, {x:591,x2:720,y:457,id:'center-high'},
    {x:716,x2:787,y:492,id:'bridge'}, {x:780,x2:919,y:451,id:'island'},
    {x:912,x2:969,y:501,id:'bridge'}, {x:968,x2:1326,y:486,id:'gate'},
    {x:1305,x2:1434,y:486,id:'warp-landing',stone:true},
    {x:873,x2:950,y:347,id:'rune',magic:true}, {x:944,x2:1028,y:256,id:'crown'}
  ];
  const secondSparks=[[174,615],[361,537],[624,469],[829,402],[909,301],[987,209],[1187,437]];
  const dust=Array.from({length:42},(_,i)=>({x:(i*183.23+43)%W,y:(i*79.71+70)%H,s:1+i%3*.6,phase:i*2.37}));
  function ensureRegion(index){
    if(index<0||index>2||regions[index])return;
    const base=index*W,r={index,base,checkpoint:false,gateLit:false,boss:null};regions[index]=r;
    const layout=index===0?terrain:index===1?secondTerrain:bossTerrain;
    layout.forEach(p=>platforms.push({...p,x:base+p.x,x2:base+p.x2,region:index}));
    if(index===1){platforms.push({x:base-35,x2:base+45,y:475,id:'link',magic:true,region:index},{x:base+30,x2:base+125,y:567,id:'link',magic:true,region:index});}
    (index===0?sparkPlaces:index===1?secondSparks:[]).forEach(([x,y])=>lights.push({x:base+x,y,region:index,taken:false}));
    const points=index===0?[[378,544,337,459],[604,455,504,670],[964,445,903,1033],[1250,445,1152,1360]]:index===1?[[369,585,338,390],[640,516,587,676],[837,451,804,892],[1190,486,1045,1255]]:[];
    points.forEach(([x,y,min,max],i)=>{
      const hp=20+index*7;enemies.push({id:enemies.length,x:base+x,y,min:base+min,max:base+max,vx:i%2? -26:26,hp,maxHp:hp,hit:0,region:index,dead:false});
    });
    if(index===2){const hp=20;r.boss={x:base+1180,y:BOSS_GROUND,hp,maxHp:hp,bodyHits:0,eyeKill:false,active:false,dead:false,cooldown:1.8,windup:0,phase:1,hit:0,region:index};}
  }
  ensureRegion(0);ensureRegion(1);
  function makePlayer(kind,index){return {kind,index,x:160+index*70,y:674,vx:0,vy:0,facing:index? -1:1,grounded:true,ground:platforms[0],hp:6,maxHp:6,invuln:0,cooldown:0,jumpBuffer:0,coyote:.1,drop:0,anim:0,downTime:0,attackFlash:0};}
  function image(path){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('이미지를 불러오지 못했습니다: '+path));im.src=window.FOREST_ASSETS?.[path]||path;});}
  async function json(path){if(window.FOREST_ASSETS?.[path])return window.FOREST_ASSETS[path];const r=await fetch(path);if(!r.ok)throw Error('애니메이션 정보를 불러오지 못했습니다: '+path);return r.json();}
  function makeArt(){
    const make=(size,draw,smooth=true)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);return renderer.texture(c,smooth);};
    art.white=make(1,c=>{c.fillStyle='white';c.fillRect(0,0,1,1);});
    art.glow=make(128,(c,s)=>{const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'#ffffff');g.addColorStop(.22,'#ffffff80');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,s,s);});
    art.star=make(32,(c,s)=>{c.fillStyle='white';c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?6:15;const x=s/2+Math.cos(a)*r,y=s/2+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();},false);
    art.flame=make(32,c=>{c.fillStyle='#fff';c.beginPath();c.moveTo(16,1);c.bezierCurveTo(29,13,33,24,22,30);c.bezierCurveTo(5,37,-4,21,8,9);c.bezierCurveTo(7,17,13,18,16,1);c.fill();c.fillStyle='#ffe59a';c.beginPath();c.moveTo(16,14);c.quadraticCurveTo(27,27,17,31);c.quadraticCurveTo(7,27,16,14);c.fill();},false);
    art.seam=make(128,(c,s)=>{const g=c.createLinearGradient(0,0,s,0);g.addColorStop(0,'#06160d00');g.addColorStop(.5,'#06160d66');g.addColorStop(1,'#06160d00');c.fillStyle=g;c.fillRect(0,0,s,s);});
    renderer.art=art;
  }
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
  function ensureAudio(){if(muted)return;if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A){audio=new A();music=new window.ForestMusic(audio);}}if(audio?.state==='suspended')audio.resume().catch(()=>{});syncMusic();}
  function syncMusic(){if(!music)return;music.setMuted(muted);if(muted||document.hidden||['intro','loading','error','paused','gameover'].includes(mode)){music.pause();return;}music.setScene(mode==='victory'?'victory':regionIndex===2?'boss':regionIndex===1?'garden':'forest');music.duck(mode==='dialogue');music.resume();}
  function tone(f,d=.2,v=.02,type='sine',delay=0){if(muted||!audio)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+d+.02);}
  function burst(x,y,color=[1,.8,.4],n=14){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*100,life=.3+Math.random()*.5;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,size:1+Math.random()*3,color});}}
  function label(x,y,text,color='#f2d79b'){labels.push({x,y,text,color,life:1});}
  function updateSelection(){
    document.querySelectorAll('[data-mode]').forEach(b=>{const yes=b.dataset.mode===playMode;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes);});
    document.querySelectorAll('[data-character]').forEach(b=>{const yes=b.dataset.character===selection;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes);});
    $('partner-note').textContent=playMode==='coop'?'다른 캐릭터는 2P가 조작합니다':'다른 캐릭터는 AI 동료가 됩니다';
    $('p2-help').classList.toggle('hidden',playMode!=='coop');
  }
  function updateHUD(){
    $('score').textContent=String(score).padStart(5,'0');$('level').textContent='Lv. '+level;$('attack-stat').textContent='공격력 '+damage;$('kills').textContent='처치 '+kills;
    const lower=thresholds[level-1]??thresholds.at(-1),upper=thresholds[level]??lower+1200;
    $('xp-fill').style.width=Math.min(100,(score-lower)/(upper-lower)*100)+'%';$('xp-label').textContent=level>=7?'최고 레벨 · 별과 불꽃의 공명':'다음 성장까지 '+Math.max(0,upper-score)+'점';
    players.forEach((p,i)=>{const n=i+1;$('p'+n+'-name').textContent=profiles[p.kind].name;$('p'+n+'-type').textContent=profiles[p.kind].title;$('p'+n+'-hp').textContent=p.hp>0?'♥'.repeat(p.hp)+'♡'.repeat(p.maxHp-p.hp):'잠시 회복 중…';$('p'+n+'-card').className='member '+p.kind+(p.hp<=0?' downed':'');});
    $('p2-tag').textContent=playMode==='coop'?'2P':'AI';$('controls-p2').classList.toggle('hidden',playMode!=='coop');
    $('region-name').textContent=String(regionIndex+1).padStart(2,'0')+' · '+names[regionIndex%names.length];
    const boss=regions[regionIndex]?.boss;
    $('objective-text').textContent=boss&&!boss.dead?'눈 1발 / 몸통 20발 · ↑+P로 눈 조준':regionIndex===1?(regions[2]?.boss?.dead?'숲을 지켰어요 · 자유롭게 둘러보세요':'맨 오른쪽 초록 워프에서 ↑ · 보스 맵으로'):'폭포의 정원으로 이어지는 길 →';
    $('distance').textContent=Math.floor(Math.max(0,furthest-180)/20)+' m';
    $('boss-hud').classList.toggle('hidden',!activeBoss||activeBoss.dead);
    if(activeBoss){$('boss-health').textContent='몸통 '+activeBoss.bodyHits+' / 20';$('boss-fill').style.width=Math.max(0,activeBoss.hp/activeBoss.maxHp*100)+'%';$('boss-hud').classList.toggle('enraged',activeBoss.phase===2);$('boss-name').textContent=activeBoss.phase===2?'흑염의 거대 뱀 · 녹스 — 분노':'흑염의 거대 뱀 · 녹스';}
    host.dataset.mode=mode;host.dataset.players=playMode==='coop'?'2':'1';host.dataset.kills=String(kills);host.dataset.level=String(level);host.dataset.region=String(regionIndex+1);
    canvas.dataset.playerX=String(Math.round(players[0]?.x||0));canvas.dataset.playerY=String(Math.round(players[0]?.y||0));
    syncMusic();
  }
  function reset(){
    keys.clear();score=kills=collected=0;level=1;damage=10;elapsed=0;cameraX=0;furthest=180;regionIndex=0;checkpoint={x:180,y:674};activeBoss=null;flash=0;trail=[];trailClock=0;warpElapsed=0;warpMoved=false;
    shots.length=hostileShots.length=particles.length=labels.length=0;
    regions.forEach(r=>{r.checkpoint=false;r.gateLit=false;if(r.boss)Object.assign(r.boss,{hp:r.boss.maxHp,bodyHits:0,eyeKill:false,active:false,dead:false,cooldown:1.8,windup:0,phase:1,hit:0});});
    lights.forEach(l=>l.taken=false);enemies.forEach(e=>{e.dead=false;e.hp=e.maxHp;e.hit=0;e.x=(e.min+e.max)/2;});
    players=[makePlayer(selection,0),makePlayer(selection==='angel'?'devil':'angel',1)];
    for(const id of ['intro','finish','gameover','pause'])$(id).classList.add('hidden');
    host.classList.add('playing');updateHUD();ensureAudio();
    startDialogue([
      ['angel','첫 번째 숲을 지나면 폭포의 정원이 나와. 그 맨 오른쪽 초록 워프가 거대한 뱀 녹스의 둥지로 이어진대.'],
      ['devil','그럼 같이 가자! 내 불꽃과 네 별빛이면 충분해. 작은 뱀을 물리칠수록 우리 공격도 강해질 거야.'],
      [selection,playMode==='coop'?'둘이 함께 움직이자. 1P는 P, 2P는 G로 공격! E를 누르면 다시 이야기할 수 있어.':'P를 누르면 공격할 수 있어. 내가 앞장설게. 동료는 따라오며 함께 싸울 거야!']
    ]);
  }
  function startDialogue(lines,after=null){dialogue=lines;dialogueIndex=0;afterDialogue=after;mode='dialogue';keys.clear();$('dialogue').classList.remove('hidden');showLine();updateHUD();}
  function showLine(){const [kind,text]=dialogue[dialogueIndex];$('speaker').textContent=profiles[kind].name+' · '+profiles[kind].title;$('speaker').style.color=kind==='angel'?'#e9d395':'#f4ac94';$('dialogue-text').textContent=text;$('dialogue-portrait').style.backgroundImage=`url("${window.FOREST_ASSETS?.['assets/'+profiles[kind].file+'.png']||'assets/'+profiles[kind].file+'.png'}")`;$('dialogue-next').innerHTML=dialogueIndex===dialogue.length-1?'출발 <kbd>E</kbd>':'다음 <kbd>E</kbd>';}
  function nextLine(){if(mode!=='dialogue')return;if(++dialogueIndex<dialogue.length)showLine();else{$('dialogue').classList.add('hidden');mode='playing';keys.clear();afterDialogue?.();afterDialogue=null;updateHUD();}}
  function talk(){
    if(mode==='dialogue'){nextLine();return;}
    if(mode!=='playing')return;
    if(Math.abs(players[0].x-players[1].x)>190){toast('동료 가까이에서 E를 눌러 대화하세요.');return;}
    const lines=activeBoss&&!activeBoss.dead?[
      ['devil','녹스가 붉게 빛나면 공격이 빨라져! 탄환은 점프로 피하고, 같이 계속 공격하자.'],['angel','괜찮아. 네 불꽃과 내 별이 함께 빛나고 있어. 끝까지 같이 가자!']
    ]:score>=200?[
      ['angel','우리가 물리친 뱀들이 힘이 되었어. 지금은 레벨 '+level+'! 공격력이 '+damage+'까지 올랐어.'],['devil','좋아! 다음 숲으로 계속 가자. 녹스도 우리 둘을 막지는 못할 거야.']
    ]:regionIndex===1?[['devil','폭포와 섬들이 보인다! 맨 오른쪽 초록빛 워프까지 가자.'],['angel','워프 앞에서 위쪽 화살표를 누르면 함께 녹스의 둥지로 갈 수 있어.']]:[['devil','내가 불꽃으로 길을 밝힐게. 너는 별로 지켜줘.'],['angel','물론이지. 혼자가 아니니까 무섭지 않아. 오른쪽으로 함께 가자!']];
    startDialogue(lines);
  }
  function award(points,x,y){
    score+=points;kills++;label(x,y,'+'+points);const old=level;
    level=Math.min(7,1+thresholds.slice(1).filter(t=>score>=t).length);damage=[10,16,24,34,46,60,78][level-1];
    if(level>old){players.forEach(p=>{if(p.hp>0)p.hp=Math.min(p.maxHp,p.hp+1);burst(p.x,p.y-45,profiles[p.kind].color,30);});toast('LEVEL UP! Lv. '+level+' · 공격력 '+damage+(level>=3?' · 2연발 해금':''));tone(659,.5,.035);tone(988,.5,.025,'sine',.13);flash=.12;}
    updateHUD();
  }
  function nearestTarget(p){
    const candidates=enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<560&&Math.abs(e.y-p.y)<150).map(e=>({entity:e,x:e.x,y:e.y-24}));
    if(activeBoss&&!activeBoss.dead&&Math.abs(activeBoss.x-p.x)<760){const eye=eyePosition(activeBoss);const aimEye=keys.has(p.index===0?'ArrowUp':'KeyW');candidates.push({entity:activeBoss,x:aimEye?eye.x:activeBoss.x-95,y:aimEye?eye.y:activeBoss.y-60});}
    return candidates.filter(t=>(t.x-p.x)*p.facing> -25).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  }
  function attack(p,auto=false){
    if(p.hp<=0||p.cooldown>0)return;
    const target=nearestTarget(p);if(auto&&!target)return;
    p.cooldown=auto?.54:Math.max(.18,.33-level*.016);p.attackFlash=.18;
    const x=p.x+p.facing*24,y=p.y-42,dx=target?target.x-x:p.facing*200,dy=target?target.y-y:0,baseAngle=Math.atan2(dy,dx);
    const angles=level>=5?[-.12,0,.12]:level>=3?[-.055,.055]:[0];
    angles.forEach(a=>shots.push({x,y,vx:Math.cos(baseAngle+a)*630,vy:Math.sin(baseAngle+a)*630,kind:p.kind,damage,life:1.2,size:level>=5?21:level>=3?18:15,owner:p.index}));
    burst(x,y,profiles[p.kind].color,3);tone(p.kind==='angel'?880:220,.1,.012,p.kind==='angel'?'sine':'triangle');
  }
  function hurt(p,amount=1,fromX=p.x+50){
    if(p.hp<=0||p.invuln>0||mode!=='playing')return;
    p.hp=Math.max(0,p.hp-amount);p.invuln=1.35;p.vx=fromX>p.x?-160:160;burst(p.x,p.y-40,[1,.42,.32],12);tone(147,.18,.025,'triangle');
    if(p.hp<=0){p.downTime=0;toast(profiles[p.kind].name+'가 잠시 쓰러졌어요. 동료가 버티면 다시 일어납니다.');}
    if(players.every(v=>v.hp<=0)){mode='gameover';keys.clear();$('gameover').classList.remove('hidden');}
    updateHUD();
  }
  function reviveAtCheckpoint(){
    players.forEach((p,i)=>Object.assign(p,{x:checkpoint.x+i*35,y:checkpoint.y,vx:0,vy:0,hp:6,invuln:2,grounded:true,coyote:.1,jumpBuffer:0,drop:0,downTime:0}));
    hostileShots.length=0;trail=[];mode='playing';$('gameover').classList.add('hidden');keys.clear();updateHUD();toast('함께 다시 출발! 점수와 공격력은 유지됩니다.');
  }
  function fall(p){
    hurt(p,1,p.x);Object.assign(p,{x:checkpoint.x+p.index*28,y:checkpoint.y,vx:0,vy:0,grounded:true,coyote:.1,jumpBuffer:0,drop:0});
    p.invuln=1.5;trail=[];toast('마지막 쉼터로 돌아왔어요. 모은 점수는 그대로예요.');
  }
  function inputFor(p){return p.index===0?{left:'ArrowLeft',right:'ArrowRight',jump:'Space',down:'ArrowDown',attack:'KeyP'}:{left:'KeyA',right:'KeyD',jump:'KeyF',down:'KeyS',attack:'KeyG'};}
  function eyePosition(b){const breath=Math.sin(tick*1.8)*3;return {x:b.x-210+420*(246/1536),y:b.y-280+breath+(280-breath)*(211/1024)};}
  function bossBodyHit(b,s){const breath=Math.sin(tick*1.8)*3,u=(s.x-b.x+210)/420,v=(s.y-b.y+280-breath)/(280-breath);if(u<0||u>1||v<0||v>1)return false;const mask=assets.bossMask;return mask.data[(Math.min(mask.h-1,Math.floor(v*mask.h))*mask.w+Math.min(mask.w-1,Math.floor(u*mask.w)))*4+3]>60;}
  function tryWarp(manual=false){
    if(mode!=='playing'||regionIndex!==1||regions[2]?.boss?.dead)return;
    const near=players.some(p=>p.hp>0&&Math.abs(p.x-warp.x)<(manual?100:43)&&Math.abs(p.y-warp.y)<90);
    if(!near)return;
    if(playMode==='coop'&&players.some(p=>p.hp>0&&(Math.abs(p.x-warp.x)>225||Math.abs(p.y-warp.y)>150))){if(tick-warpHintTime>3){toast('두 친구가 함께 초록 워프 앞에 모이면 이동합니다.');warpHintTime=tick;}return;}
    mode='warping';keys.clear();warpElapsed=0;warpMoved=false;
    shots.length=hostileShots.length=0;burst(warp.x,warp.y-100,[.5,1,.36],65);tone(523,.8,.03);tone(784,.8,.025,'sine',.17);updateHUD();
  }
  function moveThroughWarp(){
    ensureRegion(2);regionIndex=2;cameraX=2*W;activeBoss=regions[2].boss;activeBoss.active=true;
    checkpoint={x:2*W+155,y:444};
    players.forEach((p,i)=>Object.assign(p,{x:checkpoint.x+i*65,y:checkpoint.y,vx:0,vy:0,grounded:true,ground:platforms.find(s=>s.id==='boss-entry'),hp:6,invuln:2,coyote:.1,jumpBuffer:0,drop:0,downTime:0,facing:1}));
    trail=[];particles.length=0;furthest=Math.max(furthest,players[0].x);updateHUD();
  }
  function physics(p,dt){
    const input=inputFor(p),axis=(keys.has(input.right)?1:0)-(keys.has(input.left)?1:0),target=axis*260,accel=p.grounded?2000:1300;
    p.vx+=Math.max(-accel*dt,Math.min(accel*dt,target-p.vx));if(axis)p.facing=axis;
    p.coyote=p.grounded?.11:p.coyote-dt;p.jumpBuffer-=dt;p.drop-=dt;
    if(p.jumpBuffer>0&&p.coyote>0&&p.drop<=0){p.vy=-710;p.grounded=false;p.jumpBuffer=0;p.coyote=0;tone(440,.15,.012);burst(p.x,p.y,[.8,.85,.6],5);}
    const oldY=p.y;p.vy=Math.min(880,p.vy+1550*dt);p.x+=p.vx*dt;
    p.x=regionIndex===2?Math.max(2*W+35,Math.min(3*W-45,p.x)):Math.max(27,Math.min(2*W-35,p.x));
    if(playMode==='coop'){
      const other=players[1-p.index];if(other.hp>0&&Math.abs(p.x-other.x)>650){p.x=other.x+Math.sign(p.x-other.x)*650;if(tick-separationToast>5){toast('두 친구가 함께 화면 안에서 이동해 주세요.');separationToast=tick;}}
    }
    // The boss arena is reached by the warp, never by walking into a repeated third painting.
    p.y+=p.vy*dt;p.grounded=false;
    if(p.vy>=0&&p.drop<=0)for(const platform of platforms){if(Math.abs(platform.region-Math.floor(p.x/W))>1)continue;if(p.x+12>platform.x&&p.x-12<platform.x2&&oldY<=platform.y+1&&p.y>=platform.y){const landing=p.vy>250;p.y=platform.y;p.vy=0;p.grounded=true;p.ground=platform;if(landing)burst(p.x,p.y,[.8,.83,.6],4);if(platform.id==='center'&&!regions[platform.region].checkpoint){regions[platform.region].checkpoint=true;checkpoint={x:(platform.x+platform.x2)/2,y:platform.y};players.forEach(v=>{if(v.hp>0)v.hp=Math.min(v.maxHp,v.hp+1);});toast('빛의 쉼터 · 체력 회복 · 체크포인트 저장');}break;}}
    p.anim+=dt*(p.grounded&&Math.abs(p.vx)<20?.55:1);
    if(keys.has(input.attack))attack(p);
    if(p.y>H+70)fall(p);
  }
  function followAI(dt){
    const leader=players[0],p=players[1];
    trailClock+=dt;if(trailClock>=.025){trailClock=0;trail.push({t:tick,x:leader.x,y:leader.y,vx:leader.vx,vy:leader.vy,grounded:leader.grounded,facing:leader.facing});if(trail.length>90)trail.shift();}
    const aim=trail.find(v=>v.t>=tick-.38)||trail[0];
    if(aim){p.x+=(aim.x-42*aim.facing-p.x)*Math.min(1,dt*9);p.y+=(aim.y-p.y)*Math.min(1,dt*14);p.vx=aim.vx;p.vy=aim.vy;p.facing=aim.facing;p.grounded=aim.grounded;p.anim+=dt*(Math.abs(aim.vx)>20?1:.5);}
    const target=enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<440&&Math.abs(e.y-p.y)<150).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
    if(target)p.facing=target.x>p.x?1:-1;else if(activeBoss&&!activeBoss.dead&&Math.abs(activeBoss.x-p.x)<650)p.facing=1;
    attack(p,true);
  }
  function bossAttack(b){
    const living=players.filter(p=>p.hp>0);if(!living.length)return;
    const target=living[Math.floor(Math.random()*living.length)],x=b.x-100,y=b.y-142,a=Math.atan2(target.y-38-y,target.x-x);
    const offsets=b.phase===2?[-.18,0,.18]:[0];
    offsets.forEach(offset=>hostileShots.push({x,y,vx:Math.cos(a+offset)*(b.phase===2?310:255),vy:Math.sin(a+offset)*(b.phase===2?310:255),life:4,size:b.phase===2?24:21}));
    burst(x,y,[1,.25,.08],15);tone(98,.3,.03,'triangle');
  }
  function defeatBoss(b){
    b.dead=true;b.hp=0;hostileShots.length=0;score+=1000;flash=.8;burst(b.x,b.y-110,[1,.7,.25],90);
    const survivor=players.find(p=>p.hp>0)||players[0];
    players.forEach((p,i)=>{Object.assign(p,{x:2*W+1110+i*140,y:BOSS_GROUND,vx:0,vy:0,grounded:true,downTime:0});p.hp=6;p.invuln=2;});
    level=Math.min(7,1+thresholds.slice(1).filter(t=>score>=t).length);damage=[10,16,24,34,46,60,78][level-1];
    mode='victory';keys.clear();$('result-score').textContent=score.toLocaleString();$('result-level').textContent='Lv. '+level;$('finish').classList.remove('hidden');toast(b.eyeKill?'눈에 정확히 명중! 한 발로 녹스를 물리쳤어요!':'몸통 20발 명중! 녹스를 물리쳤어요!');
    [523,659,784,1046].forEach((f,i)=>tone(f,.7,.035,'sine',i*.12));updateHUD();
  }
  function update(dt){
    tick+=dt;flash=Math.max(0,flash-dt*.7);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=70*dt;if(p.life<=0)particles.splice(i,1);}
    for(let i=labels.length-1;i>=0;i--){labels[i].life-=dt;labels[i].y-=25*dt;if(labels[i].life<=0)labels.splice(i,1);}
    if(mode==='warping'){
      warpElapsed+=dt;
      if(warpElapsed>=.65&&!warpMoved){warpMoved=true;moveThroughWarp();}
      if(warpElapsed>=1.3){startDialogue([['devil','왼쪽 파란 워프에서 나왔어. 저 오른쪽에 녹스가 있어!'],['angel','눈에 한 발이면 끝! 아니면 몸에 스무 발을 맞히자. 점프하며 ↑+P로 눈을 조준할 수 있어.']]);}
      return;
    }
    if(mode==='victory'){if(Math.random()<dt*4)players.forEach(p=>burst(p.x,p.y-70,profiles[p.kind].color,4));return;}
    if(mode!=='playing')return;
    elapsed+=dt;
    for(const p of players){p.invuln=Math.max(0,p.invuln-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.attackFlash=Math.max(0,p.attackFlash-dt);if(p.hp<=0){p.downTime+=dt;const partner=players[1-p.index];if(p.downTime>4&&partner.hp>0){Object.assign(p,{x:partner.x-25,y:partner.y,hp:3,invuln:2,downTime:0,vx:0,vy:0});toast(profiles[p.kind].name+'가 다시 일어났어요!');}continue;}if(p.index===1&&playMode==='solo')followAI(dt);else physics(p,dt);}
    if(mode!=='playing')return;
    const leader=players[0].hp>0?players[0]:players[1];
    const current=Math.max(0,Math.floor(leader.x/W));ensureRegion(current);ensureRegion(current+1);
    if(current!==regionIndex){const forward=current>regionIndex;regionIndex=current;if(forward){checkpoint={x:current*W+12,y:475};toast(String(current+1).padStart(2,'0')+' · '+names[current]+' — 새로운 지형을 건너 초록 워프로!');}updateHUD();}
    furthest=Math.max(furthest,...players.map(p=>p.x));
    const cameraSubject=playMode==='coop'?players.filter(p=>p.hp>0).reduce((a,p)=>a+p.x,0)/Math.max(1,players.filter(p=>p.hp>0).length):leader.x;
    const cameraTarget=regionIndex===2?2*W:Math.max(0,Math.min(W,cameraSubject-W*.42));
    cameraX+=(cameraTarget-cameraX)*Math.min(1,dt*6);
    if(regionIndex===1){tryWarp();if(mode==='warping')return;}
    for(const l of lights){if(!l.taken&&players.some(p=>p.hp>0&&Math.hypot(p.x-l.x,p.y-40-l.y)<43)){l.taken=true;collected++;burst(l.x,l.y,[1,.85,.45],15);players.forEach(p=>{if(p.hp>0)p.hp=Math.min(6,p.hp+1);});tone(784,.3,.02);}}
    for(const e of enemies){if(e.dead||Math.abs(e.x-cameraSubject)>1100)continue;e.hit=Math.max(0,e.hit-dt);e.x+=e.vx*dt;if(e.x<e.min||e.x>e.max){e.x=Math.max(e.min,Math.min(e.max,e.x));e.vx*=-1;}for(const p of players)if(Math.abs(p.x-e.x)<41&&Math.abs(p.y-e.y)<58)hurt(p,1,e.x);}
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];s.life-=dt;const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;let hit=null;
      for(const e of enemies){if(!e.dead&&Math.abs(s.x-e.x)<46&&Math.abs(s.y-(e.y-25))<28){hit=e;break;}}
      if(hit){hit.hp-=s.damage;hit.hit=.13;burst(s.x,s.y,profiles[s.kind].color,6);if(hit.hp<=0){hit.dead=true;burst(hit.x,hit.y-20,[.63,.85,.28],20);award(100,hit.x,hit.y-55);}s.life=0;}
      else if(activeBoss&&!activeBoss.dead){const eye=eyePosition(activeBoss);if(window.BossRules.segmentDistance(eye.x,eye.y,oldX,oldY,s.x,s.y)<10+s.size*.3){window.BossRules.hit(activeBoss,'eye');s.life=0;defeatBoss(activeBoss);}else if(bossBodyHit(activeBoss,s)){const killed=window.BossRules.hit(activeBoss,'body');activeBoss.hit=.10;burst(s.x,s.y,profiles[s.kind].color,8);s.life=0;if(killed)defeatBoss(activeBoss);}}
      if(s.life<=0)shots.splice(i,1);
    }
    if(activeBoss&&!activeBoss.dead){const b=activeBoss;b.hit=Math.max(0,b.hit-dt);b.phase=b.hp<b.maxHp*.5?2:1;b.cooldown-=dt;
      if(b.windup>0){b.windup-=dt;if(b.windup<=0){bossAttack(b);b.cooldown=b.phase===2?1.15:1.95;}}
      else if(b.cooldown<=0)b.windup=.55;
      for(const p of players)if(Math.abs(p.x-b.x)<135&&p.y>b.y-185&&p.y<b.y+40)hurt(p,1,b.x);
    }
    for(let i=hostileShots.length-1;i>=0;i--){const s=hostileShots[i];s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;for(const p of players)if(p.hp>0&&Math.hypot(s.x-p.x,s.y-(p.y-38))<s.size/2+23&&p.invuln<=0){hurt(p,1,s.x);s.life=0;break;}if(s.life<=0)hostileShots.splice(i,1);}
    uiClock+=dt;if(uiClock>.1){uiClock=0;updateHUD();}
  }
  function drawPlayer(p){
    const celebrating=mode==='victory';const asset=celebrating?assets[p.kind+'Victory']:assets[p.kind],r=renderer;if(!asset)return;
    if(celebrating){const layout=asset.manifest.frame_layout,frames=Object.values(layout.rows)[0],fps=Object.values(asset.manifest.animation.rows)[0].fps||6,frame=frames[Math.floor(tick*fps)%frames.length],scale=1.45,hop=Math.abs(Math.sin(tick*6+p.index*.5))*36,margin=asset.manifest.cell.safe_margin_y;r.glow(p.x,p.y-35,100,[...profiles[p.kind].color,.2]);r.quad(asset.texture,Math.round(p.x-layout.cellWidth*scale/2),Math.round(p.y-(layout.cellHeight-margin)*scale-hop),layout.cellWidth*scale,layout.cellHeight*scale,[1,1,1,1],frame,false);return;}
    const state=p.grounded&&Math.abs(p.vx)<20?'side_idle':'side_run',frames=asset.manifest.frame_layout.rows[state],fps=asset.manifest.animation.rows[state].fps;
    const i=p.grounded?Math.floor(p.anim*fps)%frames.length:(p.vy<0?2:5)%frames.length;
    const frame=frames[i],cw=asset.manifest.frame_layout.cellWidth,ch=asset.manifest.frame_layout.cellHeight,margin=asset.manifest.cell.safe_margin_y;
    let alpha=p.hp<=0?.3:p.invuln>0?.45+.55*Math.abs(Math.sin(tick*18)):1;
    r.quad(art.glow,p.x-28,p.y-4,56,10,[.01,.05,.02,.35]);
    r.quad(asset.texture,Math.round(p.x-cw/2),Math.round(p.y-ch+margin),cw,ch,[1,p.attackFlash>0?.92:1,p.attackFlash>0?.85:1,alpha],frame,p.facing<0);
    const color=profiles[p.kind].color;r.rect(p.x-8,p.y-ch+margin-9,16,2,[...color,.8]);
    if(p.index===0)r.rect(p.x-1,p.y-ch+margin-15,2,5,[...color,.8]);else{r.rect(p.x-3,p.y-ch+margin-15,2,5,[...color,.8]);r.rect(p.x+2,p.y-ch+margin-15,2,5,[...color,.8]);}
    if(p.attackFlash>0)r.glow(p.x+p.facing*28,p.y-42,45,[...color,p.attackFlash*3]);
  }
  function draw(){
    if(!loaded)return;const r=renderer;r.begin(cameraX);
    const visible=regions.filter(v=>(regionIndex===2?v.index===2:v.index<2)&&v.base+W>=cameraX-80&&v.base<=cameraX+W+80);
    for(const v of visible){r.quad(v.index===2?art.arena:v.index===1?art.background2:art.background,v.base,0,W,H);const tint=tints[v.index];if(tint[3])r.rect(v.base,0,W,H,tint);}
    if(regionIndex!==2&&cameraX>0)r.quad(art.seam,W-60,0,120,H,[1,1,1,1]);
    for(const v of visible)for(const p of dust){const x=v.base+p.x+Math.sin(tick*.13+p.phase)*18,y=p.y-Math.sin(tick*.2+p.phase)*15;r.glow(x,y,p.s*9,[1,.84,.46,.13]);}
    for(const l of lights){if(l.taken||l.x<cameraX-30||l.x>cameraX+W+30)continue;const y=l.y+Math.sin(tick*2.2+l.x)*5;r.glow(l.x,y,45,[1,.82,.4,.46]);r.quad(art.star,l.x-6,y-6,12,12,[1,.89,.58,1],null,false,tick*.25);}
    for(const p of platforms){if(p.x2<cameraX-40||p.x>cameraX+W+40)continue;const width=p.x2-p.x;
      if(p.stone){r.rect(p.x,p.y+2,width,12,[.25,.33,.2,1]);r.rect(p.x+5,p.y+14,width-10,9,[.18,.24,.16,1]);r.rect(p.x,p.y,width,3,[.51,.65,.27,1]);for(let j=0;j<8;j++)r.rect(p.x+j*16,p.y+2,8,3,[.65,.72,.34,.9]);}
      if(!p.magic)continue;r.glow(p.x+width/2,p.y,width+30,[.4,.9,.75,.24]);r.rect(p.x,p.y,width,2,[.79,.93,.72,.85]);r.rect(p.x+10,p.y+4,width-20,1,[.7,.86,.65,.28]);for(let i=0;i<5;i++)r.rect(p.x+12+i*(width-24)/4,p.y+8+(i%2)*3,3,3,[.9,.85,.6,.4]);}
    for(const v of visible)if(v.checkpoint){const cp=platforms.find(p=>p.region===v.index&&p.id==='center');if(cp)r.glow((cp.x+cp.x2)/2,cp.y-6,60,[.4,.9,.7,.4]);}
    if(regionIndex!==2&&warp.x>cameraX-150&&warp.x<cameraX+W+150){const cleared=regions[2]?.boss?.dead;r.glow(warp.x,warp.y-100,220,[.4,1,.24,cleared?.13:.33+Math.sin(tick*2)*.08]);r.quad(art.warp,warp.x-warp.w/2,warp.y-warp.h,warp.w,warp.h,[1,1,1,cleared?.6:1]);if(!cleared){r.quad(art.star,warp.x-7,warp.y-warp.h-27+Math.sin(tick*2)*4,14,14,[.85,1,.55,.95],null,false,tick);}}
    if(regionIndex===2){r.glow(2*W+90,350,175,[.18,.62,1,.35]);r.quad(art.bossWarp,2*W+25,214,130,230,[1,1,1,1]);}
    for(const e of enemies){if(e.dead||e.x<cameraX-100||e.x>cameraX+W+100)continue;const stretch=1+Math.sin(tick*5+e.id)*.035;const color=e.hit>0?[1,.57,.4,1]:[1,1,1,1];r.quad(art.snake,e.x-45,e.y-45*stretch,90,45*stretch,color,null,e.vx>0);if(e.hp<e.maxHp){r.rect(e.x-24,e.y-54,48,3,[.06,.1,.04,.8]);r.rect(e.x-24,e.y-54,48*e.hp/e.maxHp,3,[.76,.88,.32,.9]);}}
    for(const v of visible){const b=v.boss;if(!b||b.dead)continue;const breathe=Math.sin(tick*1.8)*3;r.glow(b.x-60,b.y-100,300,[.95,.22,.04,b.active?.2:.08]);r.quad(art.boss,b.x-210,b.y-280+breathe,420,280-breathe,b.hit>0?[1,.55,.35,1]:[1,1,1,1]);const eye=eyePosition(b);r.glow(eye.x,eye.y,25,[1,.8,.2,.25+.2*Math.sin(tick*4)]);if(b.windup>0)r.glow(b.x-100,b.y-142,100,[1,.28,.06,.6+Math.sin(tick*30)*.3]);
      if(b.active){r.rect(v.base+1410,BOSS_GROUND-225,2,225,[.98,.4,.16,.3]);for(let j=0;j<12;j++)r.rect(v.base+1407,BOSS_GROUND-220+j*19,8,3,[1,.56,.19,.35+.25*Math.sin(tick*3+j)]);}}
    for(const s of shots){const color=profiles[s.kind].color;r.glow(s.x,s.y,s.size*3,[...color,.4]);r.quad(s.kind==='angel'?art.star:art.flame,s.x-s.size/2,s.y-s.size/2,s.size,s.size,[...color,1],null,false,s.kind==='angel'?tick*8:Math.atan2(s.vy,s.vx)+Math.PI/2);}
    for(const s of hostileShots){r.glow(s.x,s.y,60,[1,.25,.03,.65]);r.quad(art.flame,s.x-s.size/2,s.y-s.size/2,s.size,s.size,[1,.37,.10,1],null,false,Math.atan2(s.vy,s.vx)+Math.PI/2);}
    [...players].sort((a,b)=>a.y-b.y).forEach(drawPlayer);
    for(const p of particles)r.rect(p.x,p.y,p.size,p.size,[...p.color,p.life/p.max]);
    for(const v of visible)for(const p of dust){const x=v.base+p.x+Math.sin(tick*.13+p.phase)*18,y=p.y-Math.sin(tick*.2+p.phase)*15;r.rect(x,y,p.s,p.s,[1,.87,.5,.1+.4*(.5+.5*Math.sin(tick+p.phase))]);}
    if(flash>0)r.rect(cameraX,0,W,H,[1,.85,.5,Math.min(.4,flash)]);
    if(mode==='warping')r.rect(cameraX,0,W,H,[.04,.16,.08,Math.sin(Math.min(1,warpElapsed/1.3)*Math.PI)]);
    r.flush();
  }
  function pause(){if(mode!=='playing')return;mode='paused';keys.clear();$('pause').classList.remove('hidden');updateHUD();}
  function resume(){if(mode!=='paused')return;mode='playing';keys.clear();$('pause').classList.add('hidden');ensureAudio();updateHUD();}
  function home(){if(!loaded)return;mode='intro';keys.clear();for(const id of ['finish','gameover','dialogue','pause'])$(id).classList.add('hidden');$('intro').classList.remove('hidden');updateHUD();}
  function press(code){
    if(code==='KeyW'){keys.add('KeyW');code='KeyF';}
    if(code==='Escape'){mode==='paused'?resume():pause();return;}
    if(code==='KeyE'||code==='Enter'){if(mode==='dialogue')nextLine();else if(code==='KeyE')talk();return;}
    if(code==='ArrowUp'||(code==='KeyW'&&regionIndex===1)){tryWarp(true);if(mode==='warping')return;}
    if(mode!=='playing')return;keys.add(code);
    for(const p of players){if(p.index===1&&playMode==='solo')continue;const input=inputFor(p);if(code===input.jump)p.jumpBuffer=.14;if(code===input.down&&p.grounded&&!['home','arena'].includes(p.ground?.id)){p.drop=.24;p.y+=5;p.vy=60;p.grounded=false;p.coyote=0;}if(code===input.attack){attack(p);if(p.index===0&&playMode==='solo')attack(players[1],true);}}
  }
  function release(code){if(code==='KeyW'){keys.delete('KeyW');code='KeyF';}keys.delete(code);for(const p of players)if(code===inputFor(p).jump&&p.vy< -220)p.vy=-220;}
  addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyP','KeyE','KeyF','KeyG','KeyA','KeyD','KeyW','KeyS'].includes(e.code))e.preventDefault();if(e.code==='KeyR'&&!e.repeat&&loaded){home();return;}if(!e.repeat)press(e.code);});
  addEventListener('keyup',e=>release(e.code));addEventListener('blur',()=>{keys.clear();pause();music?.pause();});addEventListener('focus',syncMusic);document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause();music?.pause();}else syncMusic();});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{playMode=b.dataset.mode;updateSelection();}));
  document.querySelectorAll('[data-character]').forEach(b=>b.addEventListener('click',()=>{selection=b.dataset.character;updateSelection();}));
  $('start').addEventListener('click',()=>{if(loaded)reset();});$('dialogue-next').addEventListener('click',nextLine);$('resume').addEventListener('click',resume);$('restart').addEventListener('click',home);$('reselect').addEventListener('click',home);$('retry').addEventListener('click',reviveAtCheckpoint);
  $('continue').addEventListener('click',()=>{$('finish').classList.add('hidden');mode='playing';keys.clear();regionIndex=1;cameraX=W;activeBoss=null;checkpoint={x:warp.x-100,y:warp.y};players.forEach((p,i)=>Object.assign(p,{x:checkpoint.x+i*32,y:warp.y,vx:0,vy:0,grounded:true,invuln:2,downTime:0}));trail=[];startDialogue([['devil','해냈다! 워프를 타고 폭포의 정원으로 돌아왔어.'],['angel','우리의 힘이 함께여서 가능했어. 이제 숲이 다시 평화로워졌어!']]);});
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();home();});
  $('sound').addEventListener('click',()=>{muted=!muted;ensureAudio();syncMusic();$('sound').setAttribute('aria-pressed',!muted);$('sound').setAttribute('aria-label',muted?'음악과 효과음 켜기':'음악과 효과음 끄기');$('sound').textContent=muted?'♪':'♫';if(!muted)tone(659,.3,.025);});
  $('fullscreen').addEventListener('click',()=>{const p=document.fullscreenElement?document.exitFullscreen?.():host.requestFullscreen?.();p?.catch(()=>toast('이 창에서는 전체 화면을 사용할 수 없어요.'));});
  document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);press(b.dataset.key);ensureAudio();});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>release(b.dataset.key));});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('그래픽 연결 복구 중입니다.');});canvas.addEventListener('webglcontextrestored',()=>location.reload());
  function loop(now){if(!lastTime)lastTime=now;accumulator+=Math.min((now-lastTime)/1000,.05);lastTime=now;while(accumulator>=1/120){update(1/120);accumulator-=1/120;}draw();requestAnimationFrame(loop);}
  async function init(){
    try{
      renderer=new window.ForestRenderer(canvas);makeArt();
      const [bg,bg2,arena,warpImage,bossWarp,angel,angelData,devil,devilData,snake,boss,angelWin,angelWinData,devilWin,devilWinData]=await Promise.all([image('assets/forest.webp'),image('assets/forest-2.webp'),image('assets/boss-arena.webp'),image('assets/warp.webp'),image('assets/boss-warp.webp'),image('assets/character.png'),json('assets/character.json'),image('assets/devil.png'),json('assets/devil.json'),image('assets/snake.webp'),image('assets/boss.webp'),image('assets/angel-victory.png'),json('assets/angel-victory.json'),image('assets/devil-victory.png'),json('assets/devil-victory.json')]);
      art.background=renderer.texture(bg,true);art.background2=renderer.texture(bg2,true);art.arena=renderer.texture(arena,true);art.warp=renderer.texture(warpImage,true);art.bossWarp=renderer.texture(bossWarp,true);art.snake=renderer.texture(snake,true);art.boss=renderer.texture(boss,true);
      const maskCanvas=document.createElement('canvas');maskCanvas.width=384;maskCanvas.height=256;const maskContext=maskCanvas.getContext('2d');maskContext.drawImage(boss,0,0,384,256);assets.bossMask={w:384,h:256,data:maskContext.getImageData(0,0,384,256).data};
      assets.angel={texture:renderer.texture(angel,false),manifest:angelData};assets.devil={texture:renderer.texture(devil,false),manifest:devilData};
      assets.angelVictory={texture:renderer.texture(angelWin,false),manifest:angelWinData};assets.devilVictory={texture:renderer.texture(devilWin,false),manifest:devilWinData};
      for(const a of [assets.angel,assets.devil])if(!a.manifest.frame_layout?.rows?.side_run?.length||!a.manifest.frame_layout?.rows?.side_idle?.length)throw Error('캐릭터 애니메이션이 완성되지 않았습니다.');
      for(const a of [assets.angelVictory,assets.devilVictory])if(!Object.values(a.manifest.frame_layout?.rows||{})[0]?.length)throw Error('승리 애니메이션이 완성되지 않았습니다.');
      if(window.FOREST_ASSETS){document.querySelector('.angel-portrait').style.backgroundImage=`url("${window.FOREST_ASSETS['assets/character.png']}")`;document.querySelector('.devil-portrait').style.backgroundImage=`url("${window.FOREST_ASSETS['assets/devil.png']}")`;}
      players=[makePlayer('angel',0),makePlayer('devil',1)];loaded=true;mode='intro';updateSelection();updateHUD();$('start').disabled=false;$('start-label').textContent='함께 모험 시작하기';requestAnimationFrame(loop);
    }catch(e){$('error-message').textContent=e.message;$('error').classList.remove('hidden');console.error(e);}
  }
  init();
})();
