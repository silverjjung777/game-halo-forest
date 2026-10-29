const assert=require('node:assert/strict');
const rules=require('./dist/boss-rules.js');
const fresh=()=>({hp:20,maxHp:20,bodyHits:0,eyeKill:false,dead:false});
const body=fresh();
for(let i=1;i<20;i++){assert.equal(rules.hit(body,'body'),false,`body hit ${i} must not win`);assert.equal(body.hp,20-i);}
assert.equal(rules.hit(body,'body'),true,'twentieth body projectile wins');
assert.equal(body.hp,0);assert.equal(body.eyeKill,false);
const eye=fresh();assert.equal(rules.hit(eye,'eye'),true,'one eye projectile wins at full health');assert.equal(eye.hp,0);assert.equal(eye.bodyHits,0);assert.equal(eye.eyeKill,true);
const miss=fresh();assert.equal(rules.hit(miss,'miss'),false);assert.equal(miss.hp,20);
const down={...fresh(),dead:true};assert.equal(rules.hit(down,'body'),false);assert.equal(down.bodyHits,0);
assert.equal(rules.segmentDistance(50,0,0,0,100,0),0,'fast projectile crossing an eye is detected between frames');
assert.equal(rules.segmentDistance(50,25,0,0,100,0),25,'nearby non-eye trajectory remains a body shot');
assert.equal(rules.segmentDistance(3,4,0,0,0,0),5,'stationary projectile is handled without division by zero');
console.log('Boss rules passed: 19 hits survive, 20th wins; 1 eye hit wins; misses/dead targets and swept trajectory checked.');
