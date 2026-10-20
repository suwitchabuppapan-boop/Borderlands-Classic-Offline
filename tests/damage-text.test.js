"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path').join(__dirname,'../js/damage-text.js');
const M=()=>{assert.ok(fs.existsSync(path),'pixel combat number painter is missing');return require(path);};
function context(){
  const calls=[],stack=[];let depth=0,alpha=.8;
  const c={calls,get depth(){return depth;},fillStyle:'#original',strokeStyle:'#original',lineWidth:7};
  Object.defineProperty(c,'globalAlpha',{get:()=>alpha,set:v=>{assert.ok(Number.isFinite(v)&&v>=0&&v<=1);alpha=v;calls.push(['alpha',v]);}});
  c.save=()=>{stack.push([alpha,c.fillStyle,c.strokeStyle,c.lineWidth]);depth++;calls.push(['save']);};
  c.restore=()=>{assert.ok(depth>0);[alpha,c.fillStyle,c.strokeStyle,c.lineWidth]=stack.pop();depth--;calls.push(['restore']);};
  for(const name of ['translate','scale','fillRect','beginPath','moveTo','lineTo','closePath','fill','stroke'])c[name]=(...args)=>{args.forEach(v=>{if(typeof v==='number')assert.ok(Number.isFinite(v),name);});calls.push([name,...args,c.fillStyle]);};
  c.fillText=c.strokeText=()=>assert.fail('combat digits must be actual pixel glyphs, not a system font');
  return c;
}
const event=(extra={})=>({kind:'damage',amount:123,critical:false,magic:false,target:'monster',x:250,y:260,ttl:.8,...extra});
const render=(e,options)=>{const c=context();const painted=M().draw(c,e,options);assert.equal(c.depth,0);assert.equal(c.globalAlpha,.8);assert.equal(c.fillStyle,'#original');return {painted,calls:c.calls};};

test('pixel painter works as a pure browser and CommonJS module',()=>{
  const m=M();assert.equal(typeof m.draw,'function');const sandbox={};vm.runInNewContext(fs.readFileSync(path,'utf8'),sandbox);assert.equal(typeof sandbox.BCDamageText.draw,'function');
});
test('digits 0–9 have distinct filled pixel silhouettes with dark outlines and no font calls',()=>{
  const shapes=[];
  for(let amount=0;amount<10;amount++){
    const r=render(event({amount}));assert.equal(r.painted,true);
    const pixels=r.calls.filter(c=>c[0]==='fillRect');assert.ok(pixels.length>=20,'outlined pixel glyph');
    assert.ok(pixels.some(c=>/^#(?:1|2)/.test(c.at(-1))),'dark outline');
    assert.ok(pixels.some(c=>/^#(?:f|e)/.test(c.at(-1))),'bright fill');shapes.push(JSON.stringify(pixels));
  }
  assert.equal(new Set(shapes).size,10);
});
test('only real physical critical outcomes add a starburst and Critical legend',()=>{
  const normal=render(event()),crit=render(event({critical:true})),magic=render(event({magic:true,critical:true}));
  assert.ok(crit.calls.some(c=>c[0]==='fill'),'critical burst is a filled shape');
  assert.ok(crit.calls.length>normal.calls.length*2,'critical includes its pixel legend');
  assert.ok(!normal.calls.some(c=>c[0]==='fill'));
  assert.deepEqual(magic,render(event({magic:true,critical:false})),'magic never invents a physical critical');
});
test('normal magic incoming miss and lucky outcomes have distinct styles',()=>{
  const traces=[event(),event({magic:true}),event({target:'player'}),event({kind:'miss'}),event({kind:'lucky',target:'player'})].map(e=>render(e));
  assert.ok(traces.every(r=>r.painted));assert.equal(new Set(traces.map(r=>JSON.stringify(r.calls))).size,5);
});
test('numbers use measured amount metadata, never parse cosmetic text',()=>{
  assert.deepEqual(render(event({amount:42,text:'CRIT 999'})),render(event({amount:42,text:'anything'})));
  assert.notDeepEqual(render(event({amount:42})),render(event({amount:43})));
  for(const e of [{text:'123',x:5,y:5,ttl:1},{kind:'guard',x:5,y:5,ttl:1}])assert.deepEqual(render(e),{painted:false,calls:[]});
});
test('expired malformed or unreasonable effects paint nothing and cannot poison canvas state',()=>{
  for(const overrides of [{ttl:0},{ttl:-1},{ttl:NaN},{ttl:2},{x:NaN},{y:Infinity},{amount:-1},{amount:1.5},{amount:Number.MAX_VALUE},{amount:'123'},{target:'unknown'}]){
    assert.deepEqual(render(event(overrides)),{painted:false,calls:[]},JSON.stringify(overrides));
  }
});
test('animation is deterministic immutable bounded and fades before expiry',()=>{
  const e=Object.freeze(event({critical:true,amount:999999999}));
  assert.deepEqual(render(e),render(e));assert.ok(render(e).calls.length<16000,'bounded nine digit/legend geometry');
  const late=render(event({ttl:.01}));assert.ok(late.calls.some(c=>c[0]==='alpha'&&c[1]>.0&&c[1]<.1));
  assert.notDeepEqual(render(event({ttl:.95})).calls,render(event({ttl:.5})).calls,'floating motion changes over the real lifetime');
});
test('camera scale and overlap lanes are bounded without changing input events',()=>{
  const e=Object.freeze(event());
  assert.ok(render(e,{scale:1.5}).calls.some(c=>c[0]==='scale'&&c[1]===1/1.5&&c[2]===1/1.5));
  assert.notDeepEqual(render(e,{lane:0}).calls,render(e,{lane:1}).calls,'combo hits get separate readable positions');
  for(const options of [{scale:0},{scale:Infinity},{scale:NaN},{lane:Infinity},{lane:-100}])assert.ok(render(e,options).painted);
});
test('packing bounds contain every actual glyph pixel including long critical numbers',()=>{
  for(const amount of [0,123,999999999]){
    const e=event({amount,critical:true,ttl:.5}),box=M().bounds(e),r=render(e);
    const shift=r.calls.filter(c=>c[0]==='translate').at(-1);
    for(const [name,x,y,w,h] of r.calls.filter(c=>c[0]==='fillRect')){
      assert.ok(x+shift[1]>=box.left&&x+w+shift[1]<=box.right,`${amount} glyph pixel outside horizontal bounds`);
      assert.ok(y+shift[2]>=box.top&&y+h+shift[2]<=box.bottom,`${amount} glyph pixel outside vertical bounds`);
    }
  }
});
