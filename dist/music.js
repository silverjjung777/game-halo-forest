'use strict';
// Original, lightweight fantasy score. No streamed audio or third-party samples.
(function(root){
  const frequency=midi=>440*Math.pow(2,(midi-69)/12);
  const scores={
    forest:{bpm:74,chords:[[50,57,61,66],[47,54,57,62],[43,50,57,59],[45,52,57,62],[50,57,61,64],[47,54,57,66],[43,50,54,62],[45,52,57,61]],melody:[78,null,81,78,76,74,73,null,74,null,78,81,83,81,78,null,78,76,74,null,73,74,78,null,76,null,73,69,73,76,74,null]},
    garden:{bpm:80,chords:[[43,50,54,59],[50,57,61,66],[40,47,55,59],[45,52,55,61],[43,50,57,62],[47,54,57,62],[40,47,54,59],[45,52,57,61]],melody:[83,null,81,78,79,null,78,74,78,81,83,null,86,83,81,null,79,78,76,null,78,79,81,null,78,76,74,73,74,null,78,null]},
    boss:{bpm:108,chords:[[38,45,50,53],[34,41,46,50],[31,38,43,46],[33,40,45,49],[38,45,50,57],[34,41,46,53],[31,38,43,50],[33,40,45,49]],melody:[74,null,69,72,73,null,69,null,74,77,76,74,73,null,69,null]},
    victory:{bpm:92,chords:[[50,57,61,66],[43,50,54,59],[47,54,57,62],[45,52,57,61]],melody:[74,78,81,null,86,null,83,81,78,null,81,83,86,88,86,null,83,81,78,null,79,81,78,76,74,null,78,81,86,null,81,null]}
  };
  class ForestMusic{
    constructor(context,options={}){
      this.context=context;this.setInterval=options.setInterval||root.setInterval.bind(root);this.clearInterval=options.clearInterval||root.clearInterval.bind(root);
      this.scene='forest';this.running=false;this.muted=false;this.timer=null;this.lane=null;this.retired=[];this.sources=new Set();this.volume=.38;this.ducked=false;
      this.master=context.createGain();this.master.gain.value=0;
      const limiter=context.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=16;limiter.ratio.value=3;limiter.attack.value=.008;limiter.release.value=.3;this.master.connect(limiter);limiter.connect(context.destination);
      this.delay=context.createDelay(1);this.delay.delayTime.value=.32;
      const feedback=context.createGain(),soften=context.createBiquadFilter(),wet=context.createGain();feedback.gain.value=.22;soften.type='lowpass';soften.frequency.value=2200;wet.gain.value=.16;
      this.delay.connect(soften);soften.connect(feedback);feedback.connect(this.delay);soften.connect(wet);wet.connect(this.master);
      this.noise=context.createBuffer(1,Math.floor(context.sampleRate*.22),context.sampleRate);const data=this.noise.getChannelData(0);let seed=137;
      for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/1073741824-1)*(1-i/data.length);}
    }
    fade(param,value,seconds=.16){const t=this.context.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(value,t+seconds);}
    setScene(scene){if(!scores[scene])scene='forest';if(scene===this.scene&&this.lane)return;this.scene=scene;const t=this.context.currentTime;
      if(this.lane){this.fade(this.lane.gain.gain,0,.7);this.retired.push({gain:this.lane.gain,until:t+1});}
      const gain=this.context.createGain();gain.gain.value=0;gain.connect(this.master);gain.connect(this.delay);this.lane={gain,step:0,next:t+.06};this.fade(gain.gain,1,.8);
    }
    resume(){if(this.muted||this.running)return;this.running=true;if(!this.lane)this.setScene(this.scene);this.lane.next=this.context.currentTime+.06;this.fade(this.master.gain,this.volume*(this.ducked?.65:1),.35);this.tick();this.timer=this.setInterval(()=>this.tick(),50);}
    pause(){if(!this.running)return;this.running=false;this.fade(this.master.gain,0,.08);if(this.timer!==null)this.clearInterval(this.timer);this.timer=null;const t=this.context.currentTime+.09;for(const source of this.sources){try{source.stop(t);}catch{}}}
    setMuted(muted){if(this.muted===muted)return;this.muted=muted;if(muted)this.pause();else this.resume();}
    duck(value){if(this.ducked===value)return;this.ducked=value;if(this.running)this.fade(this.master.gain,this.volume*(value?.65:1),.2);}
    track(source,nodes,end){this.sources.add(source);source.onended=()=>{this.sources.delete(source);for(const node of [source,...nodes]){try{node.disconnect();}catch{}}};source.stop(end);}
    note(midi,time,duration,volume,kind,lane,pan=0){
      const c=this.context,osc=c.createOscillator(),amp=c.createGain(),filter=c.createBiquadFilter(),stereo=c.createStereoPanner();
      osc.type=kind==='flute'||kind==='bell'?'sine':kind==='bass'?'sine':'triangle';osc.frequency.setValueAtTime(frequency(midi),time);
      filter.type='lowpass';filter.frequency.value=kind==='pad'?1100:kind==='bass'?430:kind==='harp'?2900:4200;
      const attack=kind==='pad'?.5:kind==='flute'?.07:.012,release=kind==='pad'?.8:kind==='harp'?.45:.17;
      amp.gain.setValueAtTime(.0001,time);amp.gain.linearRampToValueAtTime(volume,time+attack);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*(kind==='harp'?.18:.7)),time+Math.max(attack+.01,duration));amp.gain.exponentialRampToValueAtTime(.0001,time+duration+release);
      stereo.pan.value=pan;osc.connect(filter);filter.connect(amp);amp.connect(stereo);stereo.connect(lane.gain);osc.start(time);this.track(osc,[filter,amp,stereo],time+duration+release+.04);
      if(kind==='flute'){osc.frequency.setValueAtTime(frequency(midi)*.998,time);osc.frequency.linearRampToValueAtTime(frequency(midi)*1.002,time+duration);}
    }
    drum(time,accent,lane){
      const c=this.context,osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(accent?105:76,time);osc.frequency.exponentialRampToValueAtTime(37,time+.19);gain.gain.setValueAtTime(accent?.12:.07,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.26);osc.connect(gain);gain.connect(lane.gain);osc.start(time);this.track(osc,[gain],time+.28);
    }
    brush(time,volume,lane){const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type='highpass';filter.frequency.value=5000;gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.13);source.connect(filter);filter.connect(gain);gain.connect(lane.gain);source.start(time);this.track(source,[filter,gain],time+.22);}
    schedule(lane,step,time){
      const score=scores[this.scene],eighth=30/score.bpm,bar=Math.floor(step/8),position=step%8,chord=score.chords[bar%score.chords.length];
      if(position===0){for(const [i,n] of chord.slice(1).entries())this.note(n,time,eighth*7,.024,'pad',lane,(i-1)*.32);this.note(chord[0],time,eighth*3.4,.075,'bass',lane);}
      if(this.scene==='boss'){
        this.note(chord[[0,2,1,2,0,3,1,2][position]]+12,time,eighth*.65,.07,'harp',lane,position%2?.2:-.2);
        if(position%2===0)this.drum(time,position===0,lane);
        if(position===2||position===6)this.brush(time,.035,lane);
        if(step%2===0){const n=score.melody[Math.floor(step/2)%score.melody.length];if(n!==null)this.note(n,time,eighth*1.3,.045,'flute',lane,.12);}
      }else{
        this.note(chord[[1,2,3,2,1,3,2,3][position]]+12,time,eighth*.8,this.scene==='victory'?.065:.052,'harp',lane,position%2?.3:-.3);
        if(position===4)this.note(chord[0]+12,time,eighth*2.7,.045,'bass',lane);
        if(step%2===0){const n=score.melody[Math.floor(step/2)%score.melody.length];if(n!==null)this.note(n,time,eighth*1.65,this.scene==='victory'?.075:.055,'flute',lane,.08);}
        if((this.scene==='garden'&&position===6)||(this.scene==='victory'&&position===0))this.note(chord[3]+24,time,eighth*.8,.026,'bell',lane,-.35);
      }
    }
    tick(){if(!this.running||this.muted)return;const now=this.context.currentTime;this.retired=this.retired.filter(old=>{if(old.until<now){old.gain.disconnect();return false;}return true;});
      if(this.lane.next<now-.3)this.lane.next=now+.04;
      let scheduled=0;while(this.lane.next<now+.22&&scheduled++<8){this.schedule(this.lane,this.lane.step,this.lane.next);this.lane.step=(this.lane.step+1)%128;this.lane.next+=30/scores[this.scene].bpm;}
    }
    getState(){return {scene:this.scene,running:this.running,muted:this.muted,step:this.lane?.step||0,voices:this.sources.size};}
  }
  ForestMusic.scores=scores;ForestMusic.frequency=frequency;
  if(typeof module!=='undefined'&&module.exports)module.exports=ForestMusic;else root.ForestMusic=ForestMusic;
})(typeof window!=='undefined'?window:globalThis);
