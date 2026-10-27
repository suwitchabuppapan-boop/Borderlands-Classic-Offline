"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../js/effect-parts.js'),S=require('../js/vfx-skills.js'),D=require('../js/classic-data.js');

function context(){
  const calls=[],fills=[],stack=[];let current=[],alpha=1;
  const c={calls,fills,fillStyle:'#000',save(){stack.push({alpha,fillStyle:this.fillStyle});},restore(){const s=stack.pop();alpha=s.alpha;this.fillStyle=s.fillStyle;},get globalAlpha(){return alpha;},set globalAlpha(v){alpha=v;}};
  for(const name of ['beginPath','closePath','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','translate','rotate','scale','fillRect','stroke','fill','setLineDash'])c[name]=(...args)=>{
    calls.push([name,...args]);if(name==='beginPath')current=[];
    else if(name==='fill')fills.push({path:current.slice(),alpha,color:c.fillStyle});
    else if(['moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','closePath'].includes(name))current.push([name,...args]);
  };
  return c;
}
const event=(skillId,p)=>({id:7,kind:'skill',source:{x:200,y:220},target:{x:260,y:240},facing:1,skillId,age:p*.45,duration:.45});

test('Garuda strikes paint a curved rushing crest rather than a literal fist stamp',()=>{
  const c=context();F.draw(c,'garuda_monk.fist_burst',{x:0,y:0,progress:.35,distance:60});
  assert.ok(c.fills.some(f=>f.path.some(p=>p[0]==='bezierCurveTo')),'a curved gust must carry the strike silhouette');
});

test('the scout needle never redraws the same filled core over itself',()=>{
  const c=context();F.draw(c,'scout.needle_thrust',{x:0,y:0,progress:.35});
  const paths=c.fills.map(f=>JSON.stringify(f.path));
  assert.equal(new Set(paths).size,paths.length,'identical filled paths waste brightness and flatten the core');
});

test('scripture waves and verdicts keep a single readable crest within a restrained fill budget',()=>{
  for(const id of ['acolyte.scripture_wave','divine_scribe.verdict_column']){
    const c=context();F.draw(c,id,{x:0,y:0,progress:.35,radius:60});
    assert.ok(c.fills.length<50,id+' repeated seals must not crowd the crest');
  }
});

test('area cues retain exact gameplay boundaries and a faint interior that dissolves',()=>{
  for(const id of ['lotus_storm','sanctuary','naga_trap','arcane_volley']){
    const samples=[.3,.95].map(p=>{const c=context();S.drawGround(c,event(id,p));return c;});
    const r=D.skills[id].radius,center=id==='sanctuary'?event(id,.3).source:event(id,.3).target;
    for(const c of samples)assert.ok(c.calls.some(p=>p[0]==='arc'&&p[1]===center.x&&p[2]===center.y&&p[3]===r),id+' exact radius');
    const interior=c=>c.fills.find(f=>f.path.some(p=>p[0]==='ellipse'&&p[1]===center.x&&p[2]===center.y&&p[3]>r*.8&&p[3]<r));
    const crest=interior(samples[0]),end=interior(samples[1]);
    assert.ok(crest,id+' needs a soft filled area cue');assert.ok(crest.alpha<=.16,id+' must leave the scene visible');
    assert.ok(end&&end.alpha<crest.alpha*.3,id+' interior must dissolve before expiry');
  }
});

test('every effect part paints nothing at or after its real expiry',()=>{
  for(const id of Object.keys(F.definitions))for(const progress of [1,1.1,Infinity]){
    const c=context();F.draw(c,id,{x:0,y:0,progress});assert.equal(c.calls.length,0,id+' expired');
  }
});
