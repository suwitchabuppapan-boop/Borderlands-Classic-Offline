"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, '../js/combat-effects.js');
const D = require('../js/classic-data.js');
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
  for (const key of ['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin', 'globalCompositeOperation']) Object.defineProperty(c, key, { set(value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); calls.push([key, value]); } });
  return c;
}
function event(overrides = {}) { return { id: 1, kind: 'attack', source: {x:250,y:280}, target:{x:300,y:280}, facing:1, weaponType:'sword', skillId:null, result:null, phase:'direct', amount:null, magic:false, age:.08, duration:.28, ...overrides }; }
function state(events = [], extra = {}) { return {player:{x:250,y:280,facing:1}, clock:1, monsters:[], combatFeedback:{events}, ...extra}; }
function draw(s) { const c = context(); FX.drawGround(c,s); FX.drawFront(c,s); assert.equal(c.depth,0); return c.calls; }

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
    const monster={x:300,y:280,hp:10,classDots:Array(10000).fill({id:'moon_venom',remaining:2})};
    assert.ok(draw(state([],{monsters:Array(10000).fill(monster)})).length<20000);
  });
  test('module does not use random, wall clock, DOM or scheduling', () => {
    const source=fs.readFileSync(modulePath,'utf8');
    assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|requestAnimationFrame|setTimeout|document\.|fetch\(/);
  });
  test('browser render places ground behind sorted entities and front before text', () => {
    const source=fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8');
    assert.ok(source.indexOf('BCCombatEffects?.drawGround(c, s)')<source.indexOf('const entities ='));
    assert.ok(source.indexOf('BCCombatEffects?.drawFront(c, s)')>source.indexOf('entities.sort('));
    assert.ok(source.indexOf('BCCombatEffects?.drawFront(c, s)')<source.indexOf('for (const e of s.effects)'));
  });
}
