'use strict';
(function(root){
  const rules={
    bodyLimit:20,
    segmentDistance(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/len)):0;return Math.hypot(px-x1-t*dx,py-y1-t*dy);},
    hit(boss,part){
      if(boss.dead)return false;
      if(part==='eye'){boss.eyeKill=true;boss.hp=0;return true;}
      if(part!=='body')return false;
      boss.bodyHits=(boss.bodyHits||0)+1;boss.hp=Math.max(0,20-boss.bodyHits);return boss.hp===0;
    }
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=rules;
  else root.BossRules=rules;
})(typeof window!=='undefined'?window:globalThis);
