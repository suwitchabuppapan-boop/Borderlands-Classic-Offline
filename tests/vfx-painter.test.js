"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file=require('node:path').resolve(__dirname,'../js/vfx-painter.js');
const painter=()=>{assert.ok(fs.existsSync(file),'classic VFX painter must exist');return require(file);};
function context(){
  const calls=[],stack=[];let state={globalAlpha:.6,fillStyle:'#000',strokeStyle:'#000',lineWidth:1};
  const c={calls,get depth(){return stack.length;}};
  c.save=()=>{stack.push({...state});calls.push(['save']);};c.restore=()=>{assert.ok(stack.length);state=stack.pop();calls.push(['restore']);};
  for(const key of ['beginPath','closePath','fill','stroke','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','translate','rotate','fillRect'])c[key]=(...args)=>{args.filter(x=>typeof x==='number').forEach(x=>assert.ok(Number.isFinite(x),key));calls.push([key,...args]);};
  for(const key of ['globalAlpha','fillStyle','strokeStyle','lineWidth','lineCap','lineJoin'])Object.defineProperty(c,key,{get:()=>state[key],set:v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));if(key==='globalAlpha')assert.ok(v>=0&&v<=1);state[key]=v;calls.push([key,v]);}});
  return c;
}
test('shared painter exposes CommonJS/browser pure drawing primitives',()=>{
  const P=painter();for(const k of ['withSaved','polygon','stroke','ribbon','arcRibbon','glowDot','spark','petal','lotus','glyph','halo','motes','progress','envelope','clamp'])assert.equal(typeof P[k],'function',k);
  const ctx={};vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);assert.equal(typeof ctx.BCVFXPainter.ribbon,'function');
});
test('filled ribbons have a warm silhouette and narrow core without mutating their path',()=>{
  const P=painter(),c=context(),points=Object.freeze([[0,0],[12,-6],[28,3]].map(Object.freeze));
  P.ribbon(c,points,7,'#b87e48','#fff1ce');
  assert.ok(c.calls.filter(x=>x[0]==='fill').length>=2);assert.ok(c.calls.some(x=>x[0]==='fillStyle'&&x[1]==='#fff1ce'));
  assert.deepEqual(points,[[0,0],[12,-6],[28,3]]);assert.equal(c.depth,0);
});
test('nested opacity multiplies the parent and restores canvas state even after a throw',()=>{
  const P=painter(),c=context();P.withSaved(c,.5,()=>{assert.equal(c.globalAlpha,.3);P.withSaved(c,.5,()=>assert.equal(c.globalAlpha,.15));assert.equal(c.globalAlpha,.3);});
  assert.equal(c.globalAlpha,.6);assert.equal(c.depth,0);
  assert.throws(()=>P.withSaved(c,.8,()=>{throw Error('paint');}),/paint/);assert.equal(c.globalAlpha,.6);assert.equal(c.depth,0);
});
test('ribbon, petal, lotus, glyph and particles make finite bounded geometry',()=>{
  const P=painter(),c=context();
  P.arcRibbon(c,0,0,35,25,-1.2,1.2,7,'#c98b50','#fff1ce');
  P.petal(c,4,5,12,.3,'#cc99c7','#fff1ce');P.lotus(c,0,0,20,'#cc99c7','#fff1ce',.7);
  P.glyph(c,0,0,18,'#8dbd91','#fff1ce',.4);P.halo(c,0,0,20,7,'#aabbcc',1);
  P.spark(c,0,0,12,'#e3b261','#fff1ce',.4);P.glowDot(c,0,0,3,'#bb99ff','#fff1ce');
  const start=c.calls.length;P.motes(c,0,0,.4,100000,'#bbaa88','#fff1ce',Number.MAX_VALUE,20);
  assert.ok(c.calls.length-start<500,'particle count is bounded');assert.equal(c.depth,0);
});
test('invalid primitive coordinates do not reach Canvas and zero opacity allocates nothing',()=>{
  const P=painter(),c=context();
  P.ribbon(c,[[NaN,0],[0,0]],4,'#fff','#fff');P.arcRibbon(c,0,0,Infinity,20,0,1,4,'#fff','#fff');
  P.glowDot(c,Infinity,0,3,'#fff','#fff');P.spark(c,0,NaN,4,'#fff','#fff');P.petal(c,0,0,NaN,0,'#fff','#fff');
  P.withSaved(c,0,()=>assert.fail('invisible work must be skipped'));assert.equal(c.calls.length,0);
});
test('classic envelope is visible early, peaks early and reaches transparent before expiry',()=>{
  const P=painter();assert.ok(P.envelope(0)>.3);assert.ok(P.envelope(.12)>P.envelope(0));
  assert.ok(P.envelope(.12)>P.envelope(.7));assert.ok(P.envelope(.99)<.02);assert.equal(P.envelope(1),0);
  assert.equal(P.progress({age:.1,duration:.4}),.25);assert.equal(P.progress({age:Infinity,duration:.4}),1);
});
test('arc phase wrapping preserves the original short sweep across multiple revolutions',()=>{
  const P=painter(),a=context(),b=context(),start=100,delta=2;
  P.arcRibbon(a,0,0,30,20,start,start+delta,6,'#c9a166','#fff1ce');
  P.arcRibbon(b,0,0,30,20,start%(Math.PI*2),start%(Math.PI*2)+delta,6,'#c9a166','#fff1ce');
  assert.equal(a.calls.length,b.calls.length);
  a.calls.forEach((call,i)=>call.forEach((v,j)=>{if(typeof v==='number')assert.ok(Math.abs(v-b.calls[i][j])<1e-8,'same short sweep');else assert.equal(v,b.calls[i][j]);}));
});

test('luminous ribbons use transparent color falloff rather than an opaque flat plate',()=>{
  const P=painter(),c=context(),gradients=[];
  for(const kind of ['Linear','Radial'])c['create'+kind+'Gradient']=(...coordinates)=>{const stops=[];const g={kind,coordinates,stops,addColorStop(offset,color){assert.ok(offset>=0&&offset<=1);stops.push([offset,color]);}};gradients.push(g);return g;};
  P.ribbon(c,[[0,0],[12,-5],[28,2]],7,'#66aacc','#fff7de');
  assert.ok(gradients.some(g=>g.kind==='Linear'),'trail needs color falloff along its length');
  assert.ok(gradients.some(g=>g.stops.some(([,color])=>/rgba\([^)]*,\s*0\)/.test(color))),'at least one edge fades to transparent');
  assert.equal(c.depth,0);assert.equal(c.globalAlpha,.6);
});
test('soft auras are bounded and restore parent alpha and transform state',()=>{
  const P=painter(),c=context();assert.equal(typeof P.aura,'function');
  P.aura(c,12,8,22,9,'#779ddd',.4);
  assert.ok(c.calls.some(row=>['ellipse','arc'].includes(row[0])));assert.equal(c.depth,0);assert.equal(c.globalAlpha,.6);
  const before=c.calls.length;P.aura(c,NaN,8,22,9,'#779ddd',.4);P.aura(c,12,8,Infinity,9,'#779ddd',.4);P.aura(c,12,8,22,9,'#779ddd',0);assert.equal(c.calls.length,before);
});
test('impact rays evolve in space with a bounded particle count',()=>{
  const P=painter();assert.equal(typeof P.rays,'function');const a=context(),b=context();
  P.rays(a,0,0,.1,100000,'#77bbee','#fff7de',24);P.rays(b,0,0,.7,100000,'#77bbee','#fff7de',24);
  assert.notDeepEqual(a.calls,b.calls);assert.ok(a.calls.length<700);assert.equal(a.depth,0);assert.equal(b.depth,0);
});
