"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const D = require('../js/classic-data.js');
const Combat = require('../js/class-combat.js');
const original = new Set(['first_aid','arun_slash','royal_flurry','shield_counter','lotus_bolt','lotus_storm','orb_burst','ward_script','sanctuary','garuda_combo','quick_stab','moon_venom','tiger_rend','aimed_shot','naga_trap','arcane_volley']);
function setup(classId, learn = []) {
  const s=C.createState(), cls=D.classes[classId];
  s.classId=classId; s.weaponSchool=cls.weaponType; s.job=cls.tier?'Swordman':'Novice'; s.equipment.weapon=cls.trainingWeapon;
  for(const id of learn) s.skills[id]=1;
  s.player.x=400; s.player.y=300; s.player.facing=1; s.player.hp=C.stats(s).maxHp-30; s.player.sp=1000;
  s.monsters=s.monsters.slice(0,3);
  s.monsters.forEach((m,i)=>Object.assign(m,{x:440+i*18,y:300,hp:10000,dead:0,cd:999}));
  return s;
}
function cast(s,id,target=s.monsters[0]) {return C.act(s,'skill',{id,target:target?.uid});}
function advance(s,n) {for(let i=0;i<n*10;i++) C.tick(s,.1);}
function gameplay(s) {const v=JSON.parse(JSON.stringify(s));delete v.log;return v;}

test('all 45 additions are present and every active has a real bounded outcome',()=>{
  const additions=Object.keys(D.skills).filter(id=>!original.has(id)); assert.equal(additions.length,45);
  for(const id of additions) {
    const sk=D.skills[id],s=setup(sk.owner,[id]);
    if(sk.chargeCost) s.classCombat={buffs:{},traps:[],orbCharges:1,orbTimer:12};
    const before=JSON.stringify({hp:s.monsters.map(m=>m.hp),x:s.player.x,y:s.player.y,b:s.classCombat});
    if(sk.kind==='passive') {assert.equal(cast(s,id).ok,false,id);assert.equal(C.act(s,'bind',{slot:0,value:'skill:'+id}).ok,false,id);continue;}
    assert.equal(cast(s,id).ok,true,id);
    const after=JSON.stringify({hp:s.monsters.map(m=>m.hp),x:s.player.x,y:s.player.y,b:s.classCombat});
    assert.notEqual(after,before,id+' must change real combat state');
    assert.ok(s.player.sp<1000,id+' spends actual SP');assert.equal(s.cooldowns[id],sk.cooldown,id);
    assert.ok((s.classCombat?.signals?.length||0)<=32,id);
  }
});

test('all new active rejections preserve SP, cooldown, RNG, status and feedback atomically',()=>{
  for(const [id,sk] of Object.entries(D.skills).filter(([id,sk])=>!original.has(id)&&sk.kind!=='passive')) {
    for(const mode of ['unlearned','sp','cooldown',...(!['self','shield','cleanse','empower','radial','debuff'].includes(sk.kind)&&!(sk.kind==='move'&&sk.moveMode==='backward')?['target']:[])]) {
      const s=setup(sk.owner,[id]); if(sk.chargeCost)s.classCombat={buffs:{},traps:[],orbCharges:1,orbTimer:12};
      if(mode==='unlearned')s.skills[id]=0;if(mode==='sp')s.player.sp=0;if(mode==='cooldown')s.cooldowns[id]=1;
      const before=gameplay(s);assert.equal(cast(s,id,mode==='target'?{uid:'missing'}:s.monsters[0]).ok,false,id+'/'+mode);assert.deepEqual(gameplay(s),before,id+'/'+mode);
    }
  }
});

test('cones hit only forward, pierce follows line, chain is unique and combo stops at death',()=>{
  for(const id of ['swordsman_sweep','scout_sweep','scripture_wave','city_guardian_wave','night_tiger_sweep']) {
    assert.ok(D.skills[id],id);const s=setup(D.skills[id].owner,[id]);s.monsters[1].x=370;s.monsters[2].x=400;s.monsters[2].y=345;
    cast(s,id);assert.ok(s.monsters[0].hp<10000,id);assert.equal(s.monsters[1].hp,10000,id+' behind');assert.equal(s.monsters[2].hp,10000,id+' side');
  }
  const p=setup('naga_ranger',['naga_piercing_shot']);p.monsters[1].x=500;p.monsters[2].y=350;cast(p,'naga_piercing_shot');assert.ok(p.monsters[1].hp<10000);assert.equal(p.monsters[2].hp,10000);
  const c=setup('orb_weaver',['orb_chain']);cast(c,'orb_chain');assert.equal(c.combatFeedback.events.filter(e=>e.kind==='impact').length,3);
  const d=setup('archer',['archer_double_shot']);d.monsters[0].hp=1;cast(d,'archer_double_shot');assert.equal(d.combatFeedback.events.filter(e=>e.kind==='impact').length,1);
});

test('shield absorbs actual incoming damage once and expires; charge shield cannot spend absent charges',()=>{
  const s=setup('mage',['lotus_veil']);cast(s,'lotus_veil');const b=s.classCombat.buffs.lotus_veil;assert.ok(b.shieldRemaining>0);
  const shield=b.shieldRemaining;assert.equal(Combat.absorbDamage(s,7),0);assert.equal(b.shieldRemaining,shield-7);
  assert.equal(Combat.absorbDamage(s,1000),1000-(shield-7));assert.equal(b.shieldRemaining,0);assert.ok(s.classCombat.signals.some(e=>e.kind==='absorb'));
  advance(s,10);assert.equal(s.classCombat.buffs.lotus_veil,undefined);
  const o=setup('orb_weaver',['prism_veil']);const before=gameplay(o);assert.equal(cast(o,'prism_veil').ok,false);assert.deepEqual(gameplay(o),before);
});

test('debuffs change actual attack, hit and speed, bosses resist hard root but retain hunt mark',()=>{
  const s=setup('city_guardian',['city_guardian_wave']);cast(s,'city_guardian_wave');assert.ok(Combat.enemyModifiers(s.monsters[0]).atkMultiplier<1);advance(s,5);assert.equal(Combat.enemyModifiers(s.monsters[0]).atkMultiplier,1);
  const m=setup('moon_shadow',['moon_shadow_veil']);cast(m,'moon_shadow_veil');assert.ok(Combat.enemyModifiers(m.monsters[0]).hitPenalty>0);
  const n=setup('naga_ranger',['naga_trap','naga_hunt_mastery']);n.monsters[0].kind=Object.keys(D.monsters).find(id=>D.monsters[id].boss);cast(n,'naga_trap');C.tick(n,.1);assert.equal(n.monsters[0].snare,0);assert.ok(n.monsters[0].skillMarks.naga_trap.remaining>0);
});

test('marks and one-use amplification enhance the next matching cast once',()=>{
  const base=setup('lotus_mage',['lotus_storm']), boosted=setup('lotus_mage',['lotus_storm','blossom_mark','gather_petals']);
  assert.equal(cast(boosted,'blossom_mark').ok,true);assert.ok(boosted.monsters[0].hp<10000,'mark resolves its real direct magic hit');assert.equal(boosted.combatFeedback.events.filter(e=>e.kind==='impact'&&e.skillId==='blossom_mark').length,1);assert.ok(boosted.monsters[0].skillMarks.blossom_mark);advance(boosted,.5);assert.equal(cast(boosted,'gather_petals').ok,true);advance(boosted,.5);cast(base,'lotus_storm');const hp=boosted.monsters.map(m=>m.hp);assert.equal(cast(boosted,'lotus_storm').ok,true);
  assert.ok(hp[0]-boosted.monsters[0].hp>10000-base.monsters[0].hp);assert.equal(boosted.monsters[0].skillMarks.blossom_mark,undefined);assert.equal(boosted.classCombat.buffs.gather_petals.empowerRemaining,0);
  const a=setup('arcane_archer',['arcane_arrow_inscription','arcane_harmonic_arrow']);assert.equal(cast(a,'arcane_arrow_inscription').ok,true);advance(a,.5);assert.equal(cast(a,'arcane_harmonic_arrow').ok,true);assert.equal(a.classCombat.buffs.arcane_arrow_inscription.empowerRemaining,0);
});

test('poison/bleed/garuda conditional bursts use real states and never invent DOT',()=>{
  for(const [id,pre] of [['moon_shadow_finisher','moon_venom'],['night_tiger_sweep','tiger_rend'],['garuda_pierce','garuda_combo']]) {
    const a=setup(D.skills[id].owner,[id]),b=setup(D.skills[id].owner,[id,pre]);assert.equal(cast(b,pre).ok,true);advance(b,.5);const hp=b.monsters[0].hp;cast(a,id);assert.equal(cast(b,id).ok,true);assert.ok(hp-b.monsters[0].hp>10000-a.monsters[0].hp,id);assert.ok(b.classCombat.signals.some(e=>e.kind==='conditional'&&e.skillId===id),id);
  }
});

test('cleanse removes real player debuffs only, MDEF buffs expire and movement has no fake impact',()=>{
  const s=setup('divine_scribe',['cleansing_script']);s.player.skillDebuffs={poison:{remaining:5,atkMultiplier:.5}};const m=C.stats(s).mdef;cast(s,'cleansing_script');assert.deepEqual(s.player.skillDebuffs,{});assert.ok(C.stats(s).mdef>m);assert.ok(s.classCombat.signals.some(e=>e.kind==='cleanse'));advance(s,10);assert.equal(C.stats(s).mdef,m);
  for(const id of ['garuda_step','archer_backstep']) {const a=setup(D.skills[id].owner,[id]),old=a.player.x;cast(a,id);assert.ok(id==='garuda_step'?a.player.x>old:a.player.x<old,id);assert.ok(a.player.x>=30&&a.player.x<=930);assert.equal(a.monsters[0].hp,10000);assert.equal(a.combatFeedback.events.filter(e=>e.kind==='impact').length,0);}
  const a=setup('garuda_monk',['garuda_step']);a.monsters[0].x=a.player.x+20;const before=gameplay(a);assert.equal(cast(a,'garuda_step').ok,false);assert.deepEqual(gameplay(a),before);
  for(let facing=0;facing<4;facing++) {
    const a=setup('archer',['archer_backstep']);a.monsters=[];a.player.facing=facing;
    const before={x:a.player.x,y:a.player.y};assert.equal(cast(a,'archer_backstep').ok,true,'backstep does not require an enemy');
    const [dx,dy]=[[0,-65],[-65,0],[0,65],[65,0]][facing];
    assert.deepEqual({x:a.player.x,y:a.player.y},{x:before.x+dx,y:before.y+dy});
  }
  const edge=setup('archer',['archer_backstep']);edge.player.x=30;edge.player.facing=1;
  const unchanged=gameplay(edge);assert.equal(cast(edge,'archer_backstep').ok,false);assert.deepEqual(gameplay(edge),unchanged,'blocked retreat never snaps inward from a portal edge');
});

test('all fifteen passives affect real stats, damage, cost, heal or cadence and cap at learned maximum',()=>{
  const R=require('../js/skill-rules.js');const ids=Object.entries(D.skills).filter(([,sk])=>sk.kind==='passive');assert.equal(ids.length,15);
  for(const [id,sk] of ids) {const s=setup(sk.owner),neutral=R.passives(s);s.skills[id]=5;const value=R.passives(s);assert.notDeepEqual(value,neutral,id);s.skills[id]=999;assert.deepEqual(R.passives(s),value,id+' overlevel cannot exceed the learned maximum');}
  const s=setup('swordsman',['swordsman_discipline']);const atk=C.stats(s).atk;s.skills.swordsman_discipline=0;assert.ok(atk>C.stats(s).atk);
  const g=setup('city_guardian',['city_guardian_foundation']);assert.ok(C.stats(g).hardMdef>setup('city_guardian').equipment.mdef||C.stats(g).hardMdef>0);
  const t=setup('night_tiger',['night_tiger_instinct']);assert.ok(C.stats(t).interval<C.stats(setup('night_tiger')).interval);
  const h=setup('divine_scribe',['mercy_scripture']);const hp=h.player.hp;cast(h,'first_aid');assert.ok(h.player.hp-hp>20);
});

test('inherited acolyte attacks adapt to knuckles and arcane magic arrow learns DEX/INT scaling',()=>{
  const s=setup('garuda_monk',['glyph_strike']);cast(s,'glyph_strike');assert.equal(s.combatFeedback.events.find(e=>e.kind==='impact').magic,false);
  const a=setup('arcane_archer',['arcane_harmonic_arrow','arcane_dual_art']);a.stats.dex=60;a.stats.int=1;const b=setup('arcane_archer',['arcane_harmonic_arrow','arcane_dual_art']);b.stats.dex=1;b.stats.int=1;cast(a,'arcane_harmonic_arrow');cast(b,'arcane_harmonic_arrow');assert.ok(10000-a.monsters[0].hp>10000-b.monsters[0].hp);
});

test('adaptive inherited skills respect knuckle range and hunt marks outlast the separate root',()=>{
  const R=require('../js/skill-rules.js');
  for(const id of ['glyph_strike','scripture_wave']) {
    const s=setup('garuda_monk',[id]);assert.equal(R.rangeFor(s,id),D.skills[id].meleeRange);
    s.monsters[0].x=s.player.x+D.skills[id].meleeRange+1;
    const before=gameplay(s);assert.equal(cast(s,id).ok,false);assert.deepEqual(gameplay(s),before);
    assert.ok(!Combat.targets(s,D.skills[id],s.monsters[0]).includes(s.monsters[0])||id==='glyph_strike');
    const b=setup('acolyte',[id]);b.monsters[0].x=b.player.x+90;
    assert.equal(cast(b,id).ok,true,'books retain their ranged magic');
  }
  const n=setup('naga_ranger',['naga_trap','naga_hunt_mastery']);cast(n,'naga_trap');C.tick(n,.1);
  assert.equal(n.monsters[0].skillMarks.naga_trap.remaining,6);assert.equal(n.monsters[0].snare,3);
  advance(n,3.1);assert.ok(n.monsters[0].skillMarks.naga_trap.remaining>0);assert.equal(n.monsters[0].snare,0);
});

test('Auto has useful learned choices for every class and never hits unrelated quest targets',()=>{
  for(const [cid,cls] of Object.entries(D.classes).filter(([,cl])=>cl.tier)) {const s=setup(cid);for(const id of C.skillsFor(s))s.skills[id]=1;assert.ok(Combat.suggestSkill(s,s.monsters[0],{stats:C.stats,dist:C.dist}),cid);}
  for(const id of ['orb_chain','naga_piercing_shot','swordsman_sweep']) {const s=setup(D.skills[id].owner,[id]);s.autoQuest={active:true,phase:'fighting'};s.monsters[1].kind=Object.keys(D.monsters).find(k=>k!==s.monsters[0].kind);assert.equal(Combat.suggestSkill(s,s.monsters[0],{stats:C.stats,dist:C.dist}),null,id);}
});

test('Auto approaches and retreats with learned movement while quest routes retain control',()=>{
  for(const [cid,id,gap] of [['garuda_monk','garuda_step',110],['archer','archer_backstep',35]]) {
    const s=setup(cid,[id]);s.monsters[0].x=s.player.x+gap;s.target=s.monsters[0].uid;s.auto=true;
    assert.equal(Combat.suggestMovement(s,s.monsters[0],{stats:C.stats,dist:C.dist}),id);
    const before=s.player.x;C.tick(s,.01);assert.ok(s.cooldowns[id]>0);assert.ok(cid==='archer'?s.player.x<before:s.player.x>before+50);
    assert.equal(Combat.suggestMovement(s,s.monsters[0],{stats:C.stats,dist:C.dist}),null,'cooldown prevents repeated movement');
    const q=setup(cid,[id]);q.monsters[0].x=q.player.x+gap;q.autoQuest={active:true,phase:'fighting'};
    assert.equal(Combat.suggestMovement(q,q.monsters[0],{stats:C.stats,dist:C.dist}),null);
  }
});

test('heals emit measured positive signals, shields share one budget and actual expiry emits its end',()=>{
  for(const [cid,id] of [['villager','first_aid'],['acolyte','ward_script'],['divine_scribe','sanctuary']]) {
    const s=setup(cid,[id]),hp=s.player.hp;cast(s,id);
    const e=s.classCombat.signals.find(e=>e.kind==='heal');assert.ok(e,id);assert.equal(e.amount,s.player.hp-hp);assert.ok(e.amount>0);
    const full=setup(cid,[id]);full.player.hp=C.stats(full).maxHp;cast(full,id);
    assert.equal(full.classCombat?.signals?.some(e=>e.kind==='heal')||false,false);
  }
  const s=setup('orb_weaver',['lotus_veil','prism_veil']);s.classCombat={buffs:{},traps:[],orbCharges:1,orbTimer:12};
  assert.equal(cast(s,'lotus_veil').ok,true);const first=s.classCombat.buffs.lotus_veil.shieldRemaining;advance(s,.5);assert.equal(cast(s,'prism_veil').ok,true);
  const pools=Object.values(s.classCombat.buffs).map(b=>b.shieldRemaining||0);assert.equal(pools.filter(n=>n>0).length,1);
  const remaining=Math.max(...pools);assert.ok(remaining>=first);assert.equal(Combat.absorbDamage(s,1000),1000-remaining);assert.equal(Combat.absorbDamage(s,1000),1000);
  assert.ok(s.classCombat.signals.some(e=>e.kind==='break'));
  const b=setup('swordsman',['swordsman_stance']);cast(b,'swordsman_stance');advance(b,6.1);assert.ok(b.classCombat.signals.some(e=>e.kind==='expire'));
});

test('active malformed levels reject atomically and death clears player debuffs',()=>{
  for(const value of [999,1.5,NaN,Infinity,-1]) {
    const s=setup('mage',['lotus_veil']);s.skills.lotus_veil=value;const before=gameplay(s);
    assert.equal(cast(s,'lotus_veil').ok,false);assert.deepEqual(gameplay(s),before);
  }
  const s=setup('swordsman');s.player.skillDebuffs={test:{remaining:5,atkMultiplier:.5}};s.player.hp=0;C.tick(s,.1);assert.equal(s.player.skillDebuffs,undefined);
});
module.exports={setup};
