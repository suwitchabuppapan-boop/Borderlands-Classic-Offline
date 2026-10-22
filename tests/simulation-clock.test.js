"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"),vm=require("node:vm");
const C=require("../js/core.js");
const file=require("node:path").resolve(__dirname,"../js/simulation-clock.js");
const clock=()=>{assert.ok(fs.existsSync(file),"simulation clock module must exist");return require(file);};
const drain=(timer,now,step)=>{let result;do{result=timer.advance(now,step);}while(result.behind);return result;};

test("one shared elapsed clock prevents RAF and background timer double counting",()=>{
  const M=clock(), t=M.create(1000);let seconds=0;
  const step=dt=>seconds+=dt;
  t.advance(1016,step);t.advance(1016,step);t.advance(1100,step);t.advance(1100,step);
  assert.ok(Math.abs(seconds-.1)<1e-9);assert.ok(t.pendingSeconds< M.STEP);
  assert.equal(t.advance(1100,step).steps,0);
});
test("delayed callbacks retain all debt, process bounded chunks and eventually settle",()=>{
  const M=clock(), t=M.create(0);let steps=0;
  const r=t.advance(3600000,()=>steps++);
  assert.equal(r.steps,M.MAX_STEPS);assert.equal(r.behind,true);assert.ok(r.pendingSeconds>3000);
  drain(t,3600000,()=>steps++);assert.equal(steps,216000);assert.ok(t.pendingSeconds<M.STEP);
});
test("backward or malformed clock values cannot invent time, lose debt or poison subsequent ticks",()=>{
  const M=clock(),t=M.create(1000);let total=0;const step=dt=>total+=dt;
  t.advance(2000,step);const before=t.pendingSeconds;
  for(const value of [NaN,Infinity,-Infinity,null,"3000",{},Number.MAX_VALUE]){
    assert.equal(t.advance(value,step).steps,0);assert.equal(t.pendingSeconds,before);
  }
  t.advance(1500,step);t.advance(2500,step);
  assert.ok(Math.abs(total-1.5)<1e-9,"backward samples must not count overlapping elapsed time twice");assert.ok(Number.isFinite(t.pendingSeconds));
  assert.throws(()=>M.create(NaN),/time/i);
});
test("reset starts a new import/new-game epoch without replaying elapsed time from the previous game",()=>{
  const M=clock(),t=M.create(0);t.advance(3600000,()=>{});
  t.reset(3600000);assert.equal(t.pendingSeconds,0);
  assert.equal(t.advance(3600000,()=>assert.fail("old elapsed debt replayed")).steps,0);
  let steps=0;t.advance(3601000,()=>steps++);assert.equal(steps,60);
});
test("regular and delayed scheduling produce identical real Auto Battle state, RNG and saved progress",()=>{
  const M=clock(), setup=()=>{
    const s=C.createState();C.gain(s,5000,5000);s.stats.str=25;s.stats.vit=18;s.stats.dex=12;
    Object.assign(s.player,{x:450,y:280});s.player.hp=C.stats(s).maxHp;s.player.sp=C.stats(s).maxSp;
    C.act(s,"auto");return s;
  };
  const regular=setup(),delayed=setup(),a=M.create(0),b=M.create(0);
  for(let ms=100;ms<=120000;ms+=100)a.advance(ms,dt=>C.tick(regular,dt));
  drain(b,120000,dt=>C.tick(delayed,dt));
  assert.deepEqual(delayed,regular);assert.equal(C.serialize(delayed),C.serialize(regular));
  assert.ok(Object.values(delayed.kills).reduce((a,b)=>a+b,0)>0,"must exercise actual seeded kills/loot");
});
test("simulated time only enters through callbacks; module works in browser without timers or storage",()=>{
  const M=clock(),context={};vm.runInNewContext(fs.readFileSync(file,"utf8"),context);
  assert.equal(typeof context.BCSimulationClock.create,"function");
  const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/Date\.|performance\.|setInterval|setTimeout|document\.|localStorage/);
  const t=M.create(0);assert.equal(t.pendingSeconds,0);assert.equal(typeof M.STEP,"number");
});

test("throttled Auto Quest matches regular scheduling through actual combat, rewards and six portals",()=>{
  const M=clock(),D=require("../js/classic-data.js");
  const setup=()=>{
    const s=C.createState();C.gain(s,5000,5000);
    const at=id=>Object.assign(s.player,D.npcs.find(n=>n.id===id));
    const act=(action,p)=>assert.equal(C.act(s,action,p).ok,true,action);
    at("merchant");act("buy",{id:"arun_sword"});at("guide");act("class",{id:"swordsman"});
    for(const [id,max] of Object.entries({str:25,vit:18,dex:12,agi:8}))while(s.stats[id]<max)act("stat",{id});
    at("healer");act("heal");act("auto-quest");return s;
  };
  const regular=setup(),delayed=setup(),a=M.create(0),b=M.create(0),portals=[];
  let zone=delayed.zone;
  for(let ms=250;ms<=900000;ms+=250)a.advance(ms,dt=>C.tick(regular,dt));
  drain(b,900000,dt=>{C.tick(delayed,dt);if(delayed.zone!==zone){portals.push([zone,delayed.zone]);zone=delayed.zone;}});
  assert.deepEqual(delayed,regular);
  assert.equal(delayed.autoQuest.phase,"complete");assert.equal(delayed.quest,3);
  assert.deepEqual(portals,[[0,1],[1,0],[0,1],[1,2],[2,1],[1,0]]);
  assert.equal(delayed.inventory.guardian_core,1);assert.equal(delayed.inventory.silver_circlet,1);
});
