"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/classic-data.js');
const modulePath = path.join(__dirname, '../js/vfx-skills.js');
const exists = fs.existsSync(modulePath);
const FX = exists ? require(modulePath) : null;
const ids = Object.keys(D.skills).filter(id => D.skills[id].owner);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function event(skillId, p = .35, extra = {}) {
  return freeze({id:17,kind:'skill',source:{x:250,y:280},target:{x:310,y:305},
    facing:1,weaponType:'sword',skillId,phase:'direct',result:null,amount:null,magic:false,
    age:p*.45,duration:.45,...extra});
}
function context() {
  const calls = [], stack = [], fills = [],worldPoints=[];
  const initial = {globalAlpha:.63,globalCompositeOperation:'source-over',lineWidth:7,
    fillStyle:'#123456',strokeStyle:'#654321',lineCap:'butt',lineJoin:'miter'};
  let state = {...initial}, currentPath = [],matrix=[1,0,0,1,0,0];
  const c = {calls,fills,worldPoints,get depth(){return stack.length;},get state(){return {...state};},initial};
  c.save = () => {stack.push({state:{...state},matrix:matrix.slice()});calls.push(['save']);};
  c.restore = () => {assert.ok(stack.length,'unbalanced restore');const saved=stack.pop();state=saved.state;matrix=saved.matrix;calls.push(['restore']);};
  for (const name of ['beginPath','closePath','moveTo','lineTo','bezierCurveTo','quadraticCurveTo',
    'arc','ellipse','translate','rotate','scale','setLineDash','fillRect','stroke','fill']) {
    c[name] = (...args) => {
      for (const n of args.flat()) if(typeof n === 'number') {
        assert.ok(Number.isFinite(n),name+' requires finite coordinates');
        assert.ok(Math.abs(n)<5000,name+' exceeds local world bounds');
      }
      const call=[name,...args];calls.push(call);
      const [a,b,d,e,x,y]=matrix;
      if(name==='translate')matrix=[a,b,d,e,x+a*args[0]+d*args[1],y+b*args[0]+e*args[1]];
      else if(name==='rotate') {
        const cosine=Math.cos(args[0]),sine=Math.sin(args[0]);
        matrix=[a*cosine+d*sine,b*cosine+e*sine,d*cosine-a*sine,e*cosine-b*sine,x,y];
      } else if(name==='scale')matrix=[a*args[0],b*args[0],d*args[1],e*args[1],x,y];
      else if(name==='moveTo'||name==='lineTo')worldPoints.push([x+a*args[0]+d*args[1],y+b*args[0]+e*args[1]]);
      if(name==='beginPath')currentPath=[];
      else if(name==='fill')fills.push({path:currentPath.slice(),alpha:state.globalAlpha,color:state.fillStyle});
      else if(!['stroke','translate','rotate','scale','setLineDash'].includes(name))currentPath.push(call);
    };
  }
  for(const key of Object.keys(initial)) Object.defineProperty(c,key,{get(){return state[key];},set(value){
    if(typeof value==='number')assert.ok(Number.isFinite(value));
    if(key==='globalAlpha')assert.ok(value>=0&&value<=1);
    state[key]=value;calls.push([key,value]);
  }});
  return c;
}
function draw(e, layer) {
  const c=context(),before=JSON.stringify(e);
  if(!layer||layer==='ground')FX.drawGround(c,e);
  if(!layer||layer==='front')FX.drawFront(c,e);
  assert.equal(c.depth,0,'each layer must balance all saves');
  assert.deepEqual(c.state,c.initial,'each layer must restore canvas paint state');
  assert.equal(JSON.stringify(e),before,'drawing must preserve the immutable feedback snapshot');
  return c;
}
function geometry(c) {
  return c.calls.filter(call=>['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse',
    'translate','rotate','scale','fillRect'].includes(call[0]));
}

test('skill drawing module exists before the dispatcher loads it',()=>{
  assert.equal(exists,true,'js/vfx-skills.js must exist');
});
if(FX) {
  test('frozen API identifies exactly the fifteen existing class skills with gameplay radii',()=>{
    assert.ok(Object.isFrozen(FX));assert.ok(Object.isFrozen(FX.profiles));
    assert.deepEqual(Object.keys(FX).sort(),['drawFront','drawGround','profiles']);
    assert.deepEqual(Object.keys(FX.profiles).sort(),ids.sort());assert.equal(ids.length,15);
    for(const id of ids) {
      assert.ok(Object.isFrozen(FX.profiles[id]));assert.ok(FX.profiles[id].name.length>3);
      assert.equal(FX.profiles[id].radius,D.skills[id].radius||0,id);
    }
  });
  test('fifteen skills have distinct filled silhouettes independent of their colors',()=>{
    const traces=[];
    for(const id of ids) {
      const c=draw(event(id));
      assert.ok(c.fills.length>=3,id+' must compose filled forms');
      assert.ok(c.calls.length<5000,id+' must remain bounded');
      traces.push(JSON.stringify(geometry(c)));
    }
    assert.equal(new Set(traces).size,15);
  });
  test('release, crest and dissipation change geometry over the real .45 second lifetime',()=>{
    for(const id of ids) {
      const traces=[.08,.35,.75,.97].map(p=>JSON.stringify(geometry(draw(event(id,p)))));
      assert.equal(new Set(traces).size,4,id+' needs changing shapes, not only alpha');
    }
  });
  test('skill layers inherit the dispatcher lifetime opacity without fading the whole event again',()=>{
    for(const layer of ['ground','front']) {
      const c=draw(event('lotus_storm',.97),layer);
      assert.equal(c.calls.find(call=>call[0]==='globalAlpha')[1],c.initial.globalAlpha);
    }
  });
  test('all four area boundaries use their exact gameplay radii and source or target anchor',()=>{
    for(const id of ['lotus_storm','sanctuary','naga_trap','arcane_volley']) {
      const e=event(id), c=draw(e,'ground'),center=id==='sanctuary'?e.source:e.target;
      assert.ok(c.calls.some(call=>call[0]==='arc'&&call[1]===center.x&&call[2]===center.y&&
        call[3]===D.skills[id].radius),id+' needs its actual world boundary');
      assert.ok(!c.fills.some(fill=>fill.path.some(call=>call[0]==='arc'&&
        call[3]>=D.skills[id].radius&&Math.abs(call[5]-call[4])>=Math.PI*1.99)),
      id+' must not cover its area with a large filled disk');
    }
  });
  test('naga body completes its decorated loop despite the painter ribbon segment bound',()=>{
    const e=event('naga_trap'),c=draw(e,'ground');
    const points=c.fills.filter(fill=>fill.color==='#4d9777').flatMap(fill=>
      fill.path.filter(call=>call[0]==='moveTo'||call[0]==='lineTo').map(call=>call.slice(1)));
    const r=D.skills.naga_trap.radius;
    assert.ok(Math.min(...points.map(point=>point[0]))<e.target.x-r*.5,'body must reach the left of the loop');
    assert.ok(Math.min(...points.map(point=>point[1]))<e.target.y-r*.5,'body must reach the back of the loop');
    assert.ok(Math.max(...points.map(point=>point[0]))>e.target.x+r*.5,'body must reach the right of the loop');
    assert.ok(Math.max(...points.map(point=>point[1]))>e.target.y+r*.5,'body must reach the front of the loop');
  });
  test('self wards remain anchored to the source and directional skills follow actual targets',()=>{
    for(const id of ['ward_script','sanctuary']) {
      const a=draw(event(id)),b=draw(event(id,.35,{target:{x:900,y:900}}));
      assert.deepEqual(geometry(a),geometry(b),id+' is a source-centered self skill');
    }
    for(const id of ['arun_slash','quick_stab','aimed_shot','royal_flurry','shield_counter',
      'garuda_combo','moon_venom','tiger_rend','lotus_bolt','orb_burst']) {
      const c=draw(event(id));
      assert.ok(c.calls.some(call=>call[0]==='rotate'&&
        Math.abs(call[1]-Math.atan2(25,60))<1e-10),id+' must follow the snapshot target direction');
    }
  });
  test('every profile safely renders deterministic geometry in all four facings',()=>{
    for(const id of ids)for(let facing=0;facing<4;facing++) {
      const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][facing];
      const e=event(id,.35,{facing,target:{x:250+dx*60,y:280+dy*60}});
      assert.deepEqual(draw(e).calls,draw(e).calls,id+' must be deterministic');
    }
  });
  test('directional ground marks rotate around the source feet in all four facings',()=>{
    for(const id of ['arun_slash','quick_stab','aimed_shot','shield_counter','garuda_combo','tiger_rend']) {
      const source={x:250,y:280};
      const right=draw(event(id,.35,{source,target:{x:310,y:280}}),'ground').worldPoints;
      for(let facing=0;facing<4;facing++) {
        const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][facing];
        const rotated=draw(event(id,.35,{source,facing,target:{x:250+dx*60,y:280+dy*60}}),'ground').worldPoints;
        assert.equal(rotated.length,right.length);
        right.forEach(([x,y],i)=>{
          const expected=[source.x+(x-source.x)*dx-(y-source.y)*dy,
            source.y+(x-source.x)*dy+(y-source.y)*dx];
          assert.ok(Math.hypot(rotated[i][0]-expected[0],rotated[i][1]-expected[1])<1e-8,
            `${id} facing ${facing} vertex ${i} must rotate around the feet: expected ${expected}, got ${rotated[i]}`);
        });
      }
    }
  });
  test('unknown, expired and malformed snapshots draw nothing',()=>{
    const samples=[null,{},event('unknown'),event('arun_slash',1),event('arun_slash',-1),
      event('arun_slash',.35,{source:{x:NaN,y:0}}),event('arun_slash',.35,{target:{x:0,y:Infinity}}),
      event('arun_slash',.35,{duration:Infinity}),event('arun_slash',.35,{facing:8})];
    for(const e of samples)assert.equal(draw(e).calls.length,0);
  });
  test('browser export uses the same API without DOM, randomness, or scheduling',()=>{
    const source=fs.readFileSync(modulePath,'utf8');
    assert.match(source,/root\.BCSkillVFX\s*=\s*api/);
    assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|requestAnimationFrame|setTimeout|document\.|fetch\(/);
  });
}
