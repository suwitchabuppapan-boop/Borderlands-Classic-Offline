"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const FX=require('../js/combat-effects.js');
function draw(s){const calls=[],stack=[];let alpha=1;const c={get globalAlpha(){return alpha;},set globalAlpha(v){assert.ok(Number.isFinite(v)&&v>=0&&v<=1);alpha=v;calls.push(['alpha',v]);},save(){stack.push(alpha);},restore(){assert.ok(stack.length);alpha=stack.pop();}};
  for(const key of ['beginPath','closePath','stroke','fill','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','translate','rotate','scale','setLineDash','fillRect'])c[key]=(...args)=>{for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x),key);calls.push([key,...args]);};
  FX.drawGround(c,s);FX.drawFront(c,s);assert.equal(stack.length,0);return calls;
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const geometry=calls=>JSON.stringify(calls.filter(x=>x[0]!=='alpha'));
test('each active ward has a filled classic silhouette with timer-driven geometry',()=>{
  for(const id of ['ward_script','shield_counter','garuda_combo']){
    const s=remaining=>freeze({player:{x:200,y:200},monsters:[],classCombat:{buffs:{[id]:{remaining}}}});
    const early=draw(s(3)),later=draw(s(2));
    assert.ok(early.some(x=>x[0]==='fill'),id+' must have filled readable marks');
    assert.notEqual(geometry(early),geometry(later),id+' geometry must breathe with its real timer');
    assert.equal(draw(s(0)).length,0);
  }
});
test('poison and rend use different filled marks only while the victim is alive',()=>{
  const state=(id,remaining=2,dead=0)=>freeze({monsters:[{x:200,y:200,hp:dead?0:100,dead,classDots:[{id,remaining}]}]});
  const poison=draw(state('moon_venom')),rend=draw(state('tiger_rend'));
  assert.ok(poison.some(x=>x[0]==='fill'));assert.ok(rend.some(x=>x[0]==='fill'));
  assert.notEqual(geometry(poison),geometry(rend));assert.equal(draw(state('moon_venom',0)).length,0);assert.equal(draw(state('tiger_rend',2,1)).length,0);
});
test('ordinary hit light is visible at the real hit instant and fades smoothly before expiry',()=>{
  const event={id:1,kind:'impact',source:{x:200,y:200},target:{x:240,y:200},facing:1,weaponType:'sword',skillId:null,result:'hit',phase:'direct',amount:10,magic:false,duration:.25};
  const calls=age=>draw(freeze({monsters:[],combatFeedback:{events:[{...event,age}]}}));
  assert.ok(calls(0).filter(x=>x[0]==='alpha').some(x=>x[1]>.5),'actual hit should not start invisible');
  const late=calls(.249).filter(x=>x[0]==='alpha').map(x=>x[1]);assert.ok(late.length>0&&Math.max(...late)<.04);
  assert.equal(calls(.25).length,0);
});
