"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=path.join(__dirname,'../js/effect-parts.js');
const exists=fs.existsSync(modulePath),FX=exists?require(modulePath):null;
const spec=fs.readFileSync(path.join(__dirname,'../docs/superpowers/specs/2026-10-20-class-skills-effect-parts-design.md'),'utf8');
const partIds=[...new Set([...spec.matchAll(/^\| `([a-z_]+\.[a-z_]+)` \|/gm)].map(m=>m[1]))];
function context(){const calls=[],stack=[];let state={globalAlpha:.7,lineWidth:1,fillStyle:'#000',strokeStyle:'#000',lineCap:'butt',lineJoin:'miter',globalCompositeOperation:'source-over'};const initial={...state};const c={calls,initial,get state(){return {...state};},get depth(){return stack.length;},save(){stack.push({...state});},restore(){assert.ok(stack.length);state=stack.pop();}};
  for(const n of ['beginPath','closePath','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','translate','rotate','scale','fillRect','stroke','fill','setLineDash'])c[n]=(...a)=>{for(const v of a.flat())if(typeof v==='number')assert.ok(Number.isFinite(v)&&Math.abs(v)<20000,n+' finite bounded geometry');calls.push([n,...a]);};
  for(const k of Object.keys(initial))Object.defineProperty(c,k,{get(){return state[k];},set(v){if(typeof v==='number')assert.ok(Number.isFinite(v));if(k==='globalAlpha')assert.ok(v>=0&&v<=1);state[k]=v;calls.push([k,v]);}});return c;
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const geometry=c=>c.calls.filter(v=>['moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','fillRect','translate','rotate','scale'].includes(v[0]));
test('all approved Effect Parts are implemented in a public pure module',()=>{assert.equal(exists,true,'js/effect-parts.js must implement the approved58 shapes');});
if(FX){
  test('frozen definitions match every approved template and all recipe references resolve',()=>{
    assert.ok(Object.isFrozen(FX));assert.ok(Object.isFrozen(FX.definitions));assert.ok(Object.isFrozen(FX.recipes));
    assert.equal(partIds.length,58);assert.deepEqual(Object.keys(FX.definitions).sort(),partIds.sort());assert.equal(Object.keys(FX.recipes).length,61);
    for(const [id,d]of Object.entries(FX.definitions)){assert.equal(d.id,id);assert.ok(Object.isFrozen(d));for(const key of ['shape','anchor','layer','directionMode','palette','size','frameCount','envelope','endPolicy'])assert.ok(d[key],id+' '+key);}
    for(const [id,r]of Object.entries(FX.recipes)){assert.equal(r.id,id);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.parts));for(const p of r.parts){assert.ok(FX.definitions[p.partId],id+' '+p.partId);for(const key of ['eventGate','anchor','layer','variant','stateBinding'])assert.ok(p[key],id+' '+key);}}
    assert.equal(Object.values(FX.recipes).filter(r=>r.passive).length,15);
  });
  test('every one of58 templates paints a distinct filled silhouette with bounded deterministic lifetime geometry',()=>{
    const traces=[];
    for(const id of partIds){const phases=[];for(const progress of [0,.35,.75,.98]){const options=freeze({x:180,y:190,source:{x:150,y:190},target:{x:215,y:190},facing:1,progress,radius:34,seed:7,count:3,remaining:3,variant:'default'});const a=context(),b=context();FX.draw(a,id,options);FX.draw(b,id,options);assert.deepEqual(a.calls,b.calls,id+' deterministic');assert.equal(a.depth,0);assert.deepEqual(a.state,a.initial);assert.ok(a.calls.some(c=>c[0]==='fill'),id+' actual filled art');assert.ok(a.calls.length<2200,id+' bounded');phases.push(JSON.stringify(geometry(a)));if(progress===.35)traces.push(phases.at(-1));}assert.ok(new Set(phases).size>=3,id+' must animate geometry');}
    assert.equal(new Set(traces).size,58,'templates need shapes beyond palette changes');
  });
  test('sockets map the actual canonical class attack frames in all four directions',()=>{
    const A=require('../js/school-art.js');for(const id of Object.keys(A.frames))for(let facing=0;facing<4;facing++)for(const phase of [.1,.5,.9]){const source=freeze({x:300,y:300}),s=FX.socket(id,facing,phase,source),frame=A.frames[id][s.frame],scale=34/frame.bodyHeight;
      assert.ok(s&&Number.isFinite(s.x)&&Number.isFinite(s.y),id+' '+facing);assert.equal(s.frame,facing*6+(phase<.3?3:phase<.7?4:5));assert.deepEqual(s.feet,source);assert.equal(s.head.x,300+(frame.head[0]-frame.foot[0])*scale);assert.equal(s.head.y,300+(frame.head[1]-frame.foot[1])*scale);const px=frame.foot[0]+(s.x-300)/scale,py=frame.foot[1]+(s.y-300)/scale;assert.ok(px>=frame.bounds.x-1&&px<=frame.bounds.x+frame.bounds.w+1,id+' tip must be in actual sprite crop x');assert.ok(py>=frame.bounds.y-1&&py<=frame.bounds.y+frame.bounds.h+1,id+' tip must be in actual sprite crop y');
    }
    assert.equal(FX.socket('missing',0,.3,{x:1,y:2}),null);assert.equal(FX.socket('swordsman',9,.3,{x:1,y:2}),null);
  });
  test('unknown, malformed, expired and inactive state draws paint nothing',()=>{for(const [id,o]of [['missing',{x:1,y:2}],['common.cast_pulse',{x:NaN,y:1}],['common.cast_pulse',{x:1,y:2,age:1,duration:1}],['common.cast_pulse',{x:1,y:2,progress:-1}],['mage.lotus_veil',{x:1,y:2,persistent:true,remaining:0}]]){const c=context();FX.draw(c,id,o);assert.equal(c.calls.length,0);}});
  test('browser export contains no state mutation clock scheduling DOM randomness or network dependencies',()=>{const source=fs.readFileSync(modulePath,'utf8');assert.match(source,/root\.BCFXParts\s*=\s*api/);assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|requestAnimationFrame|setTimeout|document\.|fetch\(/);});
}
