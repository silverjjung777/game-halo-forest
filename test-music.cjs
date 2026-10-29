const assert=require('node:assert/strict');
const ForestMusic=require('./dist/music.js');
class Param{constructor(value=0){this.value=value;this.events=[];}cancelScheduledValues(t){this.events.push(['cancel',t]);}setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.events.push(['set',v,t]);}linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.setValueAtTime(v,t);}}
class Node{constructor(c,type){this.c=c;this.kind=type;this.gain=new Param();this.frequency=new Param();this.pan=new Param();this.delayTime=new Param();for(const p of ['threshold','knee','ratio','attack','release'])this[p]=new Param();}connect(n){return n;}disconnect(){this.disconnected=true;}start(t){assert.ok(t>=this.c.currentTime-.001,'notes must be scheduled ahead of playback');this.startTime=t;this.c.starts++;}stop(t){this.endTime=t;}}
class Context{constructor(){this.currentTime=0;this.sampleRate=8000;this.destination={};this.nodes=[];this.starts=0;}node(kind){const n=new Node(this,kind);this.nodes.push(n);return n;}createGain(){return this.node('gain');}createDynamicsCompressor(){return this.node('compressor');}createDelay(){return this.node('delay');}createBiquadFilter(){return this.node('filter');}createStereoPanner(){return this.node('panner');}createOscillator(){return this.node('oscillator');}createBufferSource(){return this.node('noise');}createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}advance(dt){this.currentTime+=dt;for(const n of this.nodes){if(n.endTime!==undefined&&n.endTime<=this.currentTime&&!n.ended){n.ended=true;n.onended?.();}}}}
const context=new Context(),timers=new Map();let nextTimer=0;
const music=new ForestMusic(context,{setInterval:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearInterval:id=>timers.delete(id)});
function advance(seconds){for(let i=0;i<Math.ceil(seconds/.05);i++){context.advance(.05);for(const fn of [...timers.values()])fn();}}
assert.equal(context.starts,0,'constructing the score does not autoplay');
music.resume();music.resume();assert.equal(timers.size,1,'resume never creates duplicate schedulers');
advance(58);assert.ok(context.starts>200,'forest score keeps scheduling beyond a complete musical loop');assert.equal(music.getState().scene,'forest');assert.ok(music.getState().voices<80,'finished voices are reclaimed');
const step=music.getState().step;music.setScene('forest');assert.equal(music.getState().step,step,'HUD refresh does not restart the melody');
music.setScene('garden');advance(3);assert.equal(music.getState().scene,'garden');assert.equal(music.retired.length,0,'cross-faded buses are disconnected');
const percussionBefore=context.nodes.filter(n=>n.kind==='noise').length;music.setScene('boss');advance(9);assert.ok(context.nodes.filter(n=>n.kind==='noise').length>percussionBefore,'boss theme includes rhythmic percussion');
music.setScene('victory');advance(4);assert.equal(music.getState().scene,'victory');
music.duck(true);assert.ok(music.master.gain.value<music.volume,'dialogue lowers music volume');music.duck(false);
music.setMuted(true);assert.equal(music.getState().running,false);assert.equal(timers.size,0);advance(.3);assert.equal(music.getState().voices,0,'muting stops voices as well as the scheduler');
const mutedStep=music.getState().step;advance(4);assert.equal(music.getState().step,mutedStep,'muted music does not consume playback work');
music.setMuted(false);assert.equal(music.getState().running,true);assert.equal(timers.size,1);music.pause();assert.equal(timers.size,0);advance(.3);
assert.ok(Math.abs(ForestMusic.frequency(69)-440)<1e-8);
console.log('Music checks passed: seamless scheduling, forest/garden/boss/victory themes, cross-fades, dialogue ducking, mute/pause, voice cleanup, and no autoplay.');
