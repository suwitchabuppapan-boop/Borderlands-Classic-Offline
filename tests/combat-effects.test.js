"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, '../js/combat-effects.js');
const pureModulePaths = ['combat-effects.js','vfx-painter.js','vfx-weapons.js','vfx-skills.js'].map(name=>path.join(__dirname,'../js',name));
const D = require('../js/classic-data.js');
const Core = require('../js/core.js');
const Feedback = require('../js/combat-feedback.js');
const exists = fs.existsSync(modulePath);
const FX = exists ? require(modulePath) : null;
const types = Object.keys(D.weaponTypes);
const signatures = Object.keys(D.skills).filter(id => D.skills[id].owner);
const frozen = obj => { if (obj && typeof obj === 'object') { Object.values(obj).forEach(frozen); Object.freeze(obj); } return obj; };
function context() {
  const calls = []; let depth = 0;
  const c = { calls, get depth() { return depth; } };
  for (const key of ['save', 'restore', 'beginPath', 'closePath', 'stroke', 'fill', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'translate', 'rotate', 'scale', 'setLineDash', 'fillRect']) {
    c[key] = (...args) => { for (const arg of args.flat()) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key} has a nonfinite coordinate`); calls.push([key, ...args]); if (key === 'save') depth++; if (key === 'restore') assert.ok(--depth >= 0); };
  }
  for (const key of ['createLinearGradient','createRadialGradient']) c[key]=(...args)=>{
    for(const arg of args)assert.ok(Number.isFinite(arg));
    calls.push([key,...args]);
    return {addColorStop(offset,color){assert.ok(Number.isFinite(offset));calls.push(['addColorStop',offset,color]);}};
  };
  for (const key of ['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin', 'globalCompositeOperation', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']) Object.defineProperty(c, key, { set(value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); calls.push([key, value]); } });
  return c;
}
function event(overrides = {}) { return { id: 1, kind: 'attack', source: {x:250,y:280}, target:{x:300,y:280}, facing:1, weaponType:'sword', skillId:null, result:null, phase:'direct', amount:null, magic:false, age:.08, duration:.28, ...overrides }; }
function state(events = [], extra = {}) { return {player:{x:250,y:280,facing:1}, clock:1, monsters:[], combatFeedback:{events}, ...extra}; }
function draw(s) { const c = context(); FX.drawGround(c,s); FX.drawFront(c,s); assert.equal(c.depth,0); return c.calls; }
const geometry = calls => JSON.stringify(calls.filter(call=>['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','translate','rotate','scale','fillRect'].includes(call[0])));
function footprint(calls) {
  let matrix=[1,0,0,1,0,0];const stack=[],points=[];
  const multiply=n=>{const [a,b,c,d,e,f]=matrix,[g,h,i,j,k,l]=n;matrix=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];};
  const point=(x,y)=>points.push([matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]);
  for(const [key,...a] of calls) {
    if(key==='save')stack.push([...matrix]);
    else if(key==='restore')matrix=stack.pop();
    else if(key==='translate')multiply([1,0,0,1,a[0],a[1]]);
    else if(key==='scale')multiply([a[0],0,0,a[1],0,0]);
    else if(key==='rotate')multiply([Math.cos(a[0]),Math.sin(a[0]),-Math.sin(a[0]),Math.cos(a[0]),0,0]);
    else if(['moveTo','lineTo','bezierCurveTo','quadraticCurveTo'].includes(key))for(let i=0;i<a.length;i+=2)point(a[i],a[i+1]);
    else if(key==='arc'||key==='ellipse')for(let i=0;i<32;i++){
      const angle=i*Math.PI/16,rx=a[2],ry=key==='arc'?rx:a[3],rotation=key==='arc'?0:a[4];
      const x=Math.cos(angle)*rx,y=Math.sin(angle)*ry;
      point(a[0]+x*Math.cos(rotation)-y*Math.sin(rotation),a[1]+x*Math.sin(rotation)+y*Math.cos(rotation));
    }
  }
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}

test('Canvas effects module is available in CommonJS', () => { assert.equal(exists,true, 'combat-effects module must exist'); assert.equal(typeof FX.drawGround,'function'); assert.equal(typeof FX.drawFront,'function'); });
if (FX) {
  test('metadata covers all eleven combat profiles, neutral training and fifteen existing signatures', () => {
    assert.deepEqual(Object.keys(FX.weaponProfiles).sort(), types.sort());
    assert.deepEqual(Object.keys(FX.skillProfiles).sort(), signatures.sort());
    assert.equal(Object.keys(FX.weaponProfiles).length,12);
    for (const id of signatures) assert.equal(FX.skillProfiles[id].radius || 0,D.skills[id].radius || 0);
  });
  test('all weapon profiles draw four finite directional gestures without mutating game state', () => {
    for (const weaponType of types) {
      const traces = [];
      for (let facing=0; facing<4; facing++) {
        const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][facing];
        const s=frozen(state([event({weaponType,facing,target:{x:250+dx*50,y:280+dy*50}})])); const before=JSON.stringify(s);
        const calls=draw(s); assert.ok(calls.some(call => call[0]==='stroke'||call[0]==='fill'),weaponType);
        assert.equal(JSON.stringify(s),before); traces.push(JSON.stringify(calls));
      }
      assert.equal(new Set(traces).size,4,weaponType+' must orient all four ways');
    }
  });
  test('classic fantasy weapon silhouettes are filled and change geometry through their lifetime', () => {
    for (const weaponType of types) {
      for (let facing=0; facing<4; facing++) {
        const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][facing];
        const traces=[0,.07,.14,.224].map(age => draw(frozen(state([event({weaponType,facing,age,target:{x:250+dx*50,y:280+dy*50}})]))));
        assert.ok(traces.every(calls=>calls.some(call=>call[0]==='fill')),weaponType+' needs a filled silhouette at every visible stage');
        const geometries=traces.map(geometry);
        assert.equal(new Set(geometries).size,4,weaponType+' must evolve geometry rather than only opacity');
        assert.equal(draw(state([event({weaponType,facing,age:.28})])).length,0,weaponType+' must expire at 280ms');
      }
    }
  });
  test('ranged trails follow the actual snapshotted target even on a diagonal', () => {
    for(const weaponType of ['staff','orb','book','bow','magic_bow']) {
      const calls=draw(state([event({weaponType,target:{x:290,y:310}})]));
      assert.ok(calls.some(call=>call[0]==='rotate' && Math.abs(call[1]-Math.atan2(30,40))<1e-10),weaponType);
    }
  });
  test('fifteen signatures have distinct composed geometry', () => {
    const traces=signatures.map(skillId => JSON.stringify(draw(frozen(state([event({kind:'skill',skillId,duration:.45})])))));
    assert.equal(new Set(traces).size,15);
  });
  test('all fifteen signatures have filled, deterministic geometry at four real lifetime stages', () => {
    for(const skillId of signatures) {
      const cls=D.classes[D.skills[skillId].owner];
      const traces=[0,.1125,.225,.36].map(age=>{
        const s=frozen(state([event({kind:'skill',skillId,weaponType:cls.weaponType,duration:.45,age})]));
        const first=draw(s);
        assert.deepEqual(draw(s),first,skillId+' draw must be deterministic');
        assert.ok(first.some(call=>call[0]==='fill'),skillId+' needs a filled silhouette');
        return geometry(first);
      });
      assert.equal(new Set(traces).size,4,skillId+' must evolve geometry rather than only opacity');
      assert.equal(draw(state([event({kind:'skill',skillId,weaponType:cls.weaponType,duration:.45,age:.45})])).length,0);
    }
  });
  test('AoE outlines use the actual target or sanctuary source and actual world radii', () => {
    for(const skillId of ['lotus_storm','sanctuary','arcane_volley']) {
      const c=context(); FX.drawGround(c,state([event({kind:'skill',skillId,duration:.45})]));
      const center=skillId==='sanctuary'?[250,280]:[300,280];
      assert.ok(c.calls.some(call => call[0]==='arc' && call[1]===center[0] && call[2]===center[1] && call[3]===D.skills[skillId].radius),skillId);
    }
  });
  test('miss draws no impact; critical accent requires an actual physical critical', () => {
    assert.equal(draw(state([event({kind:'impact',result:'miss'})])).length,0);
    const trace=(result,magic) => JSON.stringify(draw(state([event({kind:'impact',result,magic})])));
    assert.notEqual(trace('hit',false),trace('crit',false));
    assert.equal(trace('hit',true),trace('crit',true));
  });
  test('physical critical is immediately visible with filled layered geometry and an expanding flash', () => {
    const start=draw(frozen(state([event({kind:'impact',result:'crit',age:0,duration:.25})])));
    assert.ok(start.some(call=>call[0]==='globalAlpha' && call[1]>=.9),'critical must be visible on its first frame');
    assert.ok(start.filter(call=>call[0]==='fill').length>=4,'critical needs several filled layers');
    const initial=footprint(start);
    assert.ok(initial.width>=40 && initial.height>=40,'critical flash must cover a readable area around the target body');
    const later=draw(state([event({kind:'impact',result:'crit',age:.15,duration:.25})]));
    const expanded=footprint(later);
    assert.ok(expanded.width>initial.width || expanded.height>initial.height,'critical flash expands over its real event lifetime');
  });
  test('seeded real critical uses its immutable hit snapshot and expires at the actual impact duration', () => {
    const outcomes={};
    for(const [seed,result] of [[1,'crit'],[158,'hit'],[161,'miss']]) {
      const s=Core.createState(),cls=D.classes.swordsman;
      Object.assign(s,{classId:'swordsman',weaponSchool:cls.weaponType,job:'Swordman',seed});s.equipment.weapon=cls.trainingWeapon;
      s.stats.luk=99;s.stats.dex=1;s.player.x=250;s.player.y=310;
      s.monsters=[{uid:'crit-target',kind:'guardian',x:280,y:310,hp:10000,cd:9999,dead:0,provoke:0}];
      assert.equal(Core.act(s,'attack',{target:'crit-target'}).ok,true);
      const impact=s.combatFeedback.events.find(e=>e.kind==='impact');assert.equal(impact.result,result);
      assert.equal(impact.duration,.25);assert.equal(impact.magic,false);
      const view=frozen(state([impact]));const before=JSON.stringify(view);outcomes[result]=draw(view);
      assert.equal(JSON.stringify(view),before);s.monsters[0].x=900;s.player.x=20;
      assert.deepEqual(impact.target,{x:280,y:310});assert.ok(Object.isFrozen(impact.target));
      assert.deepEqual(impact.source,{x:250,y:310});assert.ok(Object.isFrozen(impact.source));
      const lifecycle={combatFeedback:{events:[{...impact}]}};Feedback.tick(lifecycle,.249);
      assert.ok(draw(state(lifecycle.combatFeedback.events)).length>0 || result==='miss');
      Feedback.tick(lifecycle,.001);assert.equal(draw(state(lifecycle.combatFeedback.events)).length,0);
    }
    assert.equal(outcomes.miss.length,0);
    assert.notEqual(geometry(outcomes.crit),geometry(outcomes.hit),'real critical needs its own geometry');
    const alphaAt=age=>draw(state([event({kind:'impact',result:'crit',age,duration:.25})])).find(call=>call[0]==='globalAlpha')[1];
    const alpha=[0,.05,.1,.15,.2,.249].map(alphaAt);
    assert.ok(alpha.every((value,i)=>value>0 && (!i||value<alpha[i-1])),'critical event opacity must fade monotonically');
  });
  test('persistent buffs, three orb charges, trap and live DOTs draw only while actual timers are positive', () => {
    const extra={classCombat:{buffs:{ward_script:{remaining:2},shield_counter:{remaining:2},garuda_combo:{remaining:2}},orbCharges:3,orbTimer:2,traps:[{id:'naga_trap',x:350,y:320,remaining:2}]},monsters:[{x:300,y:280,hp:100,dead:0,classDots:[{id:'moon_venom',remaining:2},{id:'tiger_rend',remaining:1}]}]};
    assert.ok(draw(frozen(state([],extra))).length>100);
    const expired=JSON.parse(JSON.stringify(extra));
    Object.values(expired.classCombat.buffs).forEach(b=>b.remaining=0); expired.classCombat.orbTimer=0; expired.classCombat.traps[0].remaining=0; expired.monsters[0].classDots.forEach(d=>d.remaining=0);
    assert.equal(draw(frozen(state([],expired))).length,0);
    const dead={monsters:[{x:300,y:280,hp:0,dead:1,classDots:[{id:'moon_venom',remaining:2}]}]};
    assert.equal(draw(state([],dead)).length,0);
  });
  test('expired or malformed events are ignored and empty state has no draws', () => {
    assert.equal(draw({}).length,0);
    assert.equal(draw(state([event({age:.28}),event({age:-1}),event({duration:Infinity}),event({source:{x:NaN,y:0}}),event({facing:10}),null])).length,0);
  });
  test('extreme finite timer inputs cannot overflow Canvas geometry', () => {
    assert.doesNotThrow(()=>draw(state([],{monsters:[{x:300,y:280,hp:10,classDots:[{id:'moon_venom',remaining:Number.MAX_VALUE}]}]})));
  });
  test('drawing is bounded to sixty-four events and bounded persistent collections', () => {
    const e=event(); const small=draw(state(Array(64).fill(e))).length; const large=draw(state(Array(10000).fill(e))).length;
    assert.equal(large,small); assert.ok(large<20000);
    const critical=event({kind:'impact',result:'crit',duration:.25});
    const criticalSmall=draw(state(Array(64).fill(critical))).length;
    assert.equal(draw(state(Array(10000).fill(critical))).length,criticalSmall);assert.ok(criticalSmall<20000);
    // Filled ribbons and layered petals require more calls than the old wire outlines.
    // Measured worst weapon: 24,192 calls; sanctuary ground/front: 105,088 for 64 events.
    for(const weaponType of types)assert.ok(draw(state(Array(64).fill(event({weaponType})))).length<30000,weaponType+' exceeds the filled-weapon budget');
    const sanctuary=event({kind:'skill',skillId:'sanctuary',weaponType:'book',duration:.45});
    const sanctuarySmall=draw(state(Array(64).fill(sanctuary))).length;
    assert.ok(sanctuarySmall<120000,'layered sanctuary exceeds the bounded AoE budget');
    assert.equal(draw(state(Array(10000).fill(sanctuary))).length,sanctuarySmall);
    const monster={x:300,y:280,hp:10,classDots:Array(10000).fill({id:'moon_venom',remaining:2})};
    assert.ok(draw(state([],{monsters:Array(10000).fill(monster)})).length<20000);
  });
  test('module does not use random, wall clock, DOM or scheduling', () => {
    for(const file of pureModulePaths) {
      assert.ok(fs.existsSync(file),path.basename(file)+' pure renderer module must exist');
      const source=fs.readFileSync(file,'utf8');
      assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|requestAnimationFrame|setTimeout|document\.|fetch\(/,path.basename(file));
    }
  });
  test('browser render places ground behind sorted entities and front before text', () => {
    const source=fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8');
    assert.ok(source.indexOf('BCCombatEffects?.drawGround(c, s)')<source.indexOf('const entities ='));
    assert.ok(source.indexOf('BCCombatEffects?.drawFront(c, s)')>source.indexOf('entities.sort('));
    assert.ok(source.indexOf('BCCombatEffects?.drawFront(c, s)')<source.indexOf('for (const e of s.effects)'));
  });
}
