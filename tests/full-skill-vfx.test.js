"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../js/vfx-skills.js'),C=require('../js/combat-effects.js');
const hasParts=fs.existsSync(require('node:path').join(__dirname,'../js/effect-parts.js')),F=hasParts?require('../js/effect-parts.js'):null;
function draw(paint){const calls=[],stack=[];let alpha=.7;const c={calls,get globalAlpha(){return alpha;},set globalAlpha(v){assert.ok(Number.isFinite(v)&&v>=0&&v<=1);alpha=v;},save(){stack.push(alpha);},restore(){assert.ok(stack.length);alpha=stack.pop();}};for(const n of ['beginPath','closePath','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','translate','rotate','scale','fillRect','stroke','fill','setLineDash'])c[n]=(...a)=>{for(const v of a.flat())if(typeof v==='number')assert.ok(Number.isFinite(v));calls.push([n,...a]);};paint(c);assert.equal(stack.length,0);assert.equal(alpha,.7);return calls;}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const event=(skillId,facing=1,p=.35)=>freeze({id:8,kind:'skill',source:{x:200,y:200},target:{x:260,y:225},classId:'swordsman',facing,weaponType:'sword',skillId,result:null,magic:false,age:p*.45,duration:.45});
test('all46 active skills including First Aid have executable VFX profiles',()=>{assert.equal(Object.keys(S.profiles).length,46);assert.ok(S.profiles.first_aid);});
if(F){
 test('all active recipes paint immutable snapshots in all directions while passive casts stay silent',()=>{for(const [id,r]of Object.entries(F.recipes))for(let facing=0;facing<4;facing++){const e=event(id,facing),before=JSON.stringify(e);const calls=draw(c=>{S.drawGround(c,e);S.drawFront(c,e);});assert.equal(JSON.stringify(e),before);if(r.passive)assert.equal(calls.length,0,id);else assert.ok(calls.some(c=>c[0]==='fill'),id+' real filled active VFX');}});
 test('new status loops require actual living positive timer and remaining shield or empowerment',()=>{for(const id of ['swordsman_stance','royal_duelist_tempo','city_guardian_vow','lotus_veil','gather_petals','prism_veil','cleansing_script','scout_shadow_step','night_tiger_tempo','naga_forest_veil','arcane_arrow_inscription']){const state=(remaining,extra={},hp=30)=>freeze({player:{x:200,y:200,hp},classCombat:{buffs:{[id]:{remaining,...extra}}}});const positive=draw(c=>{C.drawGround(c,state(3,{shieldRemaining:50,empowerRemaining:1}));C.drawFront(c,state(3,{shieldRemaining:50,empowerRemaining:1}));});assert.ok(positive.some(c=>c[0]==='fill'),id);assert.equal(draw(c=>{C.drawGround(c,state(0));C.drawFront(c,state(0));}).length,0,id+' expired');assert.equal(draw(c=>{C.drawGround(c,state(3,{shieldRemaining:50,empowerRemaining:1},0));C.drawFront(c,state(3,{shieldRemaining:50,empowerRemaining:1},0));}).length,0,id+' dead');if(['city_guardian_vow','lotus_veil','prism_veil','gather_petals','arcane_arrow_inscription'].includes(id))assert.equal(draw(c=>{C.drawGround(c,state(3,{shieldRemaining:0,empowerRemaining:0}));C.drawFront(c,state(3,{shieldRemaining:0,empowerRemaining:0}));}).length,0,id+' consumed');}});
 test('target marks debuffs and snares follow only their real living target state',()=>{for(const [field,id]of [['skillMarks','blossom_mark'],['skillMarks','naga_hunt_mastery'],['skillDebuffs','city_guardian_wave'],['skillDebuffs','moon_shadow_veil']]){const state=(remaining,hp=30)=>freeze({monsters:[{uid:3,x:240,y:240,hp,[field]:{[id]:{remaining}}}]});assert.ok(draw(c=>{C.drawGround(c,state(3));C.drawFront(c,state(3));}).some(c=>c[0]==='fill'),id);assert.equal(draw(c=>C.drawFront(c,state(0))).length,0);assert.equal(draw(c=>C.drawFront(c,state(3,0))).length,0);}const snare=freeze({monsters:[{uid:2,x:100,y:100,hp:20,snare:2}]});assert.ok(draw(c=>C.drawFront(c,snare)).some(c=>c[0]==='fill'));});
 test('committed movement and successful heal cleanse consume signals paint; nonexistent effects stay silent',()=>{for(const [kind,skillId,amount]of [['movement','archer_backstep',20],['movement','garuda_step',20],['cleanse','cleansing_script',1],['consume','gather_petals',1],['heal','first_aid',12],['absorb','city_guardian_vow',8],['expire','swordsman_stance',0],['break','lotus_veil',0]]){const s=freeze({classCombat:{signals:[{id:1,kind,skillId,amount,source:{x:100,y:100},target:{x:120,y:100},classId:'archer',facing:1,age:.2,duration:.7}]}});const calls=draw(c=>{C.drawGround(c,s);C.drawFront(c,s);});assert.ok(calls.some(c=>c[0]==='fill'),kind+' '+skillId);assert.equal(JSON.stringify(s),JSON.stringify(s));}assert.equal(draw(c=>C.drawFront(c,freeze({classCombat:{signals:[]}}))).length,0);});
 test('all61 recipes reference only their real event gates and shared impact types',()=>{for(const r of Object.values(F.recipes))for(const p of r.parts){assert.ok(['cast','impact','state','tick','apply','consume','absorb','cleanse','movement','heal','end'].includes(p.eventGate));if(p.partId==='common.hit_spark'||p.partId==='common.hit_bloom')assert.equal(p.eventGate,'impact');}assert.ok(F.recipes.moon_shadow_finisher.parts.some(p=>p.partId==='common.hit_spark'));assert.ok(!F.recipes.moon_shadow_finisher.parts.some(p=>p.partId==='common.hit_bloom'));});
}
test('inscription launch, adaptive stamps and movement dust use their actual committed gates',()=>{
 const r=F.recipes;
 assert.ok(r.arcane_arrow_inscription.parts.some(p=>p.partId==='arcane_archer.rune_arrow'&&p.eventGate==='consume'));
 assert.ok(!r.arcane_arrow_inscription.parts.some(p=>p.partId==='arcane_archer.rune_arrow'&&p.eventGate==='cast'));
 for(const id of ['glyph_strike','scripture_wave'])assert.ok(r[id].parts.some(p=>p.partId==='acolyte.glyph_stamp'&&p.eventGate==='impact'));
 for(const id of ['garuda_step','archer_backstep'])assert.ok(r[id].parts.some(p=>p.partId==='common.fade_motes'&&p.eventGate==='movement'&&p.anchor==='feet'));
});
test('actual chained impacts render links from each previous hit and consume flashes use canonical weapon sockets',()=>{
 const Core=require('../js/core.js'),D=require('../js/classic-data.js');
 const s=Core.createState(),cls=D.classes.orb_weaver;Object.assign(s,{classId:'orb_weaver',weaponSchool:cls.weaponType,job:'Swordman'});s.equipment.weapon=cls.trainingWeapon;s.skills.orb_chain=1;s.player.x=300;s.player.y=300;s.player.sp=1000;
 s.monsters=s.monsters.slice(0,3);s.monsters.forEach((m,i)=>Object.assign(m,{x:350+i*35,y:300,hp:1000,dead:0,cd:999}));
 assert.equal(Core.act(s,'skill',{id:'orb_chain',target:s.monsters[0].uid}).ok,true);
 const impacts=s.combatFeedback.events.filter(e=>e.kind==='impact');assert.equal(impacts.length,3);
 for(let i=1;i<impacts.length;i++){
  assert.deepEqual(impacts[i].source,impacts[i-1].target);
  const e={...impacts[i],classId:s.classId,age:.1};const calls=draw(c=>S.drawFront(c,freeze(e)));
  assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===e.source.x&&c[2]===e.source.y-17),'chain head must start at previous real endpoint');
 }
 const source={x:250,y:250},target={x:320,y:250},socket=F.socket('lotus_mage',1,.1/.22,source);
 const signal=freeze({classCombat:{signals:[{id:1,kind:'consume',skillId:'gather_petals',source,target,classId:'lotus_mage',facing:1,age:.1,duration:.7}]}});
 const calls=draw(c=>C.drawFront(c,signal));assert.ok(calls.some(c=>c[0]==='translate'&&c[1]===socket.x&&c[2]===socket.y));
});
test('real timer expiry paints a short fade and never retains the expired stance seal',()=>{
 const Core=require('../js/core.js'),D=require('../js/classic-data.js'),s=Core.createState(),cls=D.classes.swordsman;
 Object.assign(s,{classId:'swordsman',weaponSchool:cls.weaponType,job:'Swordman'});s.equipment.weapon=cls.trainingWeapon;s.skills.swordsman_stance=1;s.player.sp=1000;s.monsters=[];
 assert.equal(Core.act(s,'skill',{id:'swordsman_stance'}).ok,true);const duration=s.classCombat.buffs.swordsman_stance.remaining;
 for(let i=0;i<=Math.ceil(duration*10);i++)Core.tick(s,.1);
 assert.equal(s.classCombat.buffs.swordsman_stance,undefined);assert.ok(s.classCombat.signals.some(e=>e.kind==='expire'&&e.skillId==='swordsman_stance'));
 const snapshot=JSON.parse(JSON.stringify(s));assert.ok(draw(c=>{C.drawGround(c,snapshot);C.drawFront(c,snapshot);}).some(c=>c[0]==='fill'));
 snapshot.classCombat.signals=[];snapshot.combatFeedback.events=[];assert.equal(draw(c=>{C.drawGround(c,snapshot);C.drawFront(c,snapshot);}).length,0);
});
